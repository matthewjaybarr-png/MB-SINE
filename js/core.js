(function attachMBCalculatorCore(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.MBCalc = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCore() {
  const INCHES_PER_MILLIMETER = 1 / 25.4;
  const SFM_RPM_CONSTANT = 12 / Math.PI;

  function requirePositive(value, label) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) {
      throw new RangeError(`${label} must be greater than zero.`);
    }
    return number;
  }

  function requireNonNegative(value, label) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) {
      throw new RangeError(`${label} cannot be negative.`);
    }
    return number;
  }

  function rpmFromSfm(sfm, diameterInches) {
    return requirePositive(sfm, "SFM") * SFM_RPM_CONSTANT /
      requirePositive(diameterInches, "Diameter");
  }

  function sfmFromRpm(rpm, diameterInches) {
    return requirePositive(rpm, "RPM") * requirePositive(diameterInches, "Diameter") /
      SFM_RPM_CONSTANT;
  }

  function resolveSurfaceSpeed({ basis, sfm, rpm, diameterInches }) {
    const diameter = requirePositive(diameterInches, "Diameter");
    if (basis === "rpm") {
      const resolvedRpm = requirePositive(rpm, "RPM");
      return { rpm: resolvedRpm, sfm: sfmFromRpm(resolvedRpm, diameter), basis: "rpm" };
    }
    const resolvedSfm = requirePositive(sfm, "SFM");
    return { rpm: rpmFromSfm(resolvedSfm, diameter), sfm: resolvedSfm, basis: "sfm" };
  }

  function feedFromIpr(rpm, ipr) {
    return requirePositive(rpm, "RPM") * requirePositive(ipr, "IPR");
  }

  function feedFromChipLoad(rpm, cuttingEdges, chipLoad) {
    return requirePositive(rpm, "RPM") * requirePositive(cuttingEdges, "Cutting edges") *
      requirePositive(chipLoad, "Chip load");
  }

  function radialChipThinningFactor(stepoverInches, diameterInches) {
    const stepover = requirePositive(stepoverInches, "Radial stepover");
    const diameter = requirePositive(diameterInches, "Tool diameter");
    if (stepover > diameter) throw new RangeError("Radial stepover cannot exceed tool diameter.");
    const ratio = stepover / diameter;
    if (ratio >= 0.5) return 1;
    return 1 / Math.sqrt(1 - Math.pow(1 - 2 * ratio, 2));
  }

  function threadMill({
    threadMajorInches,
    toolDiameterInches,
    rpm,
    cuttingEdges,
    chipLoad,
    pitchInches,
    threadLocation = "internal",
  }) {
    const major = requirePositive(threadMajorInches, "Thread major diameter");
    const tool = requirePositive(toolDiameterInches, "Thread mill diameter");
    const pitch = requirePositive(pitchInches, "Thread pitch");
    if (threadLocation === "internal" && tool >= major) {
      throw new RangeError("An internal thread mill must be smaller than the thread major diameter.");
    }
    if (!['internal', 'external'].includes(threadLocation)) {
      throw new RangeError("Thread location must be internal or external.");
    }
    // The chip load sets the feed at the cutting edge, on the thread major diameter. The machine
    // is programmed at the tool centerline, which travels a smaller circle inside a thread
    // (larger outside), so the programmed feed is scaled by centerline / major diameter.
    // Programming the cutting-edge feed instead overfeeds an internal thread mill by major / (major - tool).
    const centerlineDiameter = threadLocation === "internal" ? major - tool : major + tool;
    const peripheryFeedIpm = feedFromChipLoad(rpm, cuttingEdges, chipLoad);
    const compensationRatio = centerlineDiameter / major;
    return {
      centerlineDiameter,
      compensationRatio,
      peripheryFeedIpm,
      feedIpm: peripheryFeedIpm * compensationRatio,
      pitchInches: pitch,
      threadLocation,
    };
  }

  function tapDrillRange(threadType, thread, tapStyle = "cut") {
    if (!thread || !Number.isFinite(Number(thread.major)) || !Number.isFinite(Number(thread.pitch))) {
      throw new RangeError("A valid thread definition is required.");
    }
    if (!['cut', 'form'].includes(tapStyle)) throw new RangeError("Tap style must be cut or form.");
    if (threadType === "NPT") {
      if (tapStyle === "form") {
        return {
          unsupported: true,
          note: "NPT form-tap sizing is tool-specific and is not estimated by this calculator. Use the tap manufacturer's drill recommendation.",
        };
      }
      return {
        typicalDec: Number(thread.tapDec),
        minDec: Number(thread.tapDec),
        maxDec: Number(thread.tapDec),
        exact: true,
        note: thread.tapConfidence === "published"
          ? "Published pipe-tap drill reference."
          : "Large NPT reference value—verify with the selected tap manufacturer and gaging plan.",
      };
    }

    // Drill = major - K x pitch x thread percent.
    //   Cutting tap: K = 1.299038 (= 0.01299 x %thread / TPI), 65-80 % thread, 75 % typical.
    //   Form tap:    K = 0.68     (= 0.0068  x %thread / TPI), 55-75 % thread, 65 % typical.
    // A form tap displaces metal instead of cutting it, so its drill is larger:
    // 1/4-20 form tap at 65 % -> 0.2279 (#1 / 5.8 mm), M6 x 1 -> 5.56 mm.
    const form = tapStyle === "form";
    const constant = form ? 0.68 : 1.299038;
    const typicalPercent = form ? 0.65 : 0.75;
    const minimumPercent = form ? 0.55 : 0.65;
    const maximumPercent = form ? 0.75 : 0.80;
    const major = Number(thread.major);
    const pitch = Number(thread.pitch);
    const divisor = threadType === "METRIC" ? 25.4 : 1;
    const pitchLength = threadType === "METRIC" ? pitch : 1 / pitch;
    const drillFor = percent => (major - constant * pitchLength * percent) / divisor;
    return {
      typicalDec: drillFor(typicalPercent),
      minDec: drillFor(maximumPercent),
      maxDec: drillFor(minimumPercent),
      percentRange: [minimumPercent, typicalPercent, maximumPercent],
      exact: false,
      note: tapStyle === "form"
        ? "Form-tap drill sizes are larger than cutting-tap sizes; verify with the tap manufacturer."
        : "Calculated range is based on common thread-percentage values.",
    };
  }

  function circleFrom(source, value) {
    const input = requirePositive(value, source);
    let diameter;
    if (source === "diameter") diameter = input;
    else if (source === "radius") diameter = input * 2;
    else if (source === "circumference") diameter = input / Math.PI;
    else throw new RangeError("Circle source must be diameter, radius, or circumference.");
    const radius = diameter / 2;
    return {
      diameter,
      radius,
      circumference: Math.PI * diameter,
      area: Math.PI * radius * radius,
    };
  }

  function rightTriangle({ solveFrom, sideA, sideB, hypotenuse, angleA }) {
    let a = Number(sideA);
    let b = Number(sideB);
    let h = Number(hypotenuse);
    let angle = Number(angleA);
    const validAngle = () => {
      angle = requirePositive(angle, "Angle A");
      if (angle >= 90) throw new RangeError("Angle A must be less than 90 degrees.");
      return angle * Math.PI / 180;
    };

    if (solveFrom === "a_b") {
      a = requirePositive(a, "Side A");
      b = requirePositive(b, "Side B");
      h = Math.hypot(a, b);
      angle = Math.atan2(a, b) * 180 / Math.PI;
    } else if (solveFrom === "a_h") {
      a = requirePositive(a, "Side A");
      h = requirePositive(h, "Hypotenuse");
      if (a >= h) throw new RangeError("Hypotenuse must be longer than Side A.");
      b = Math.sqrt(h * h - a * a);
      angle = Math.asin(a / h) * 180 / Math.PI;
    } else if (solveFrom === "b_h") {
      b = requirePositive(b, "Side B");
      h = requirePositive(h, "Hypotenuse");
      if (b >= h) throw new RangeError("Hypotenuse must be longer than Side B.");
      a = Math.sqrt(h * h - b * b);
      angle = Math.acos(b / h) * 180 / Math.PI;
    } else if (solveFrom === "angle_h") {
      h = requirePositive(h, "Hypotenuse");
      const radians = validAngle();
      a = h * Math.sin(radians);
      b = h * Math.cos(radians);
    } else if (solveFrom === "angle_a") {
      a = requirePositive(a, "Side A");
      const radians = validAngle();
      h = a / Math.sin(radians);
      b = a / Math.tan(radians);
    } else if (solveFrom === "angle_b") {
      b = requirePositive(b, "Side B");
      const radians = validAngle();
      a = b * Math.tan(radians);
      h = b / Math.cos(radians);
    } else {
      throw new RangeError("Choose which two triangle values to solve from.");
    }

    return { sideA: a, sideB: b, hypotenuse: h, angleA: angle, angleB: 90 - angle };
  }

  function countersinkDepth(holeDiameter, majorDiameter, includedAngleDegrees) {
    const hole = requirePositive(holeDiameter, "Starting hole diameter");
    const major = requirePositive(majorDiameter, "Countersink major diameter");
    const angle = requirePositive(includedAngleDegrees, "Included angle");
    if (major <= hole) throw new RangeError("Countersink major diameter must exceed the starting hole diameter.");
    if (angle >= 180) throw new RangeError("Included angle must be less than 180 degrees.");
    return ((major - hole) / 2) / Math.tan(angle * Math.PI / 360);
  }

  function helixPitch(boreDiameter, toolDiameter, angleDegrees) {
    const bore = requirePositive(boreDiameter, "Bore diameter");
    const tool = requirePositive(toolDiameter, "Tool diameter");
    if (tool >= bore) throw new RangeError("Tool diameter must be smaller than bore diameter.");
    const angle = requireNonNegative(angleDegrees, "Helix angle");
    if (angle >= 90) throw new RangeError("Helix angle must be less than 90 degrees.");
    const radius = (bore - tool) / 2;
    const circumference = 2 * Math.PI * radius;
    return { radius, circumference, pitch: circumference * Math.tan(angle * Math.PI / 180) };
  }

  function helixAngle(boreDiameter, toolDiameter, pitch) {
    const bore = requirePositive(boreDiameter, "Bore diameter");
    const tool = requirePositive(toolDiameter, "Tool diameter");
    if (tool >= bore) throw new RangeError("Tool diameter must be smaller than bore diameter.");
    const resolvedPitch = requirePositive(pitch, "Pitch");
    const radius = (bore - tool) / 2;
    const circumference = 2 * Math.PI * radius;
    return {
      radius,
      circumference,
      angleDegrees: Math.atan(resolvedPitch / circumference) * 180 / Math.PI,
    };
  }

  function circularInterpolationFeed({ featureDiameter, toolDiameter, surfaceFeedIpm, location = "internal" }) {
    const feature = requirePositive(featureDiameter, "Feature diameter");
    const tool = requirePositive(toolDiameter, "Tool diameter");
    const surfaceFeed = requirePositive(surfaceFeedIpm, "Surface feed");
    if (!['internal', 'external'].includes(location)) {
      throw new RangeError("Feature location must be internal or external.");
    }
    if (location === "internal" && tool >= feature) {
      throw new RangeError("Tool diameter must be smaller than an internal feature diameter.");
    }
    const centerlineDiameter = location === "internal" ? feature - tool : feature + tool;
    const compensationRatio = centerlineDiameter / feature;
    return {
      location,
      centerlineDiameter,
      compensationRatio,
      centerlineFeedIpm: surfaceFeed * compensationRatio,
    };
  }

  function effectiveCuttingDiameter({ toolType, toolDiameter, axialDepth, tipDiameter = 0, includedAngleDegrees = 0 }) {
    const diameter = requirePositive(toolDiameter, "Tool diameter");
    const depth = requirePositive(axialDepth, "Axial depth");
    let effectiveDiameter;
    if (toolType === "ball") {
      const radius = diameter / 2;
      effectiveDiameter = depth >= radius
        ? diameter
        : 2 * Math.sqrt(depth * (diameter - depth));
    } else if (toolType === "taper") {
      const tip = requireNonNegative(tipDiameter, "Tip diameter");
      if (tip >= diameter) throw new RangeError("Tip diameter must be smaller than tool diameter.");
      const angle = requirePositive(includedAngleDegrees, "Included angle");
      if (angle >= 180) throw new RangeError("Included angle must be less than 180 degrees.");
      effectiveDiameter = Math.min(diameter, tip + 2 * depth * Math.tan(angle * Math.PI / 360));
    } else {
      throw new RangeError("Tool type must be ball or taper.");
    }
    return {toolType, effectiveDiameter};
  }

  function scallopGeometry({ solveFrom, ballDiameter, stepover, scallopHeight }) {
    const radius = requirePositive(ballDiameter, "Ball diameter") / 2;
    if (solveFrom === "stepover") {
      const width = requirePositive(stepover, "Stepover");
      if (width > radius * 2) throw new RangeError("Stepover cannot exceed ball diameter.");
      return {
        stepover: width,
        scallopHeight: radius - Math.sqrt(radius * radius - Math.pow(width / 2, 2)),
      };
    }
    if (solveFrom === "height") {
      const height = requirePositive(scallopHeight, "Scallop height");
      if (height > radius) throw new RangeError("Scallop height cannot exceed ball radius.");
      return {
        stepover: 2 * Math.sqrt(2 * radius * height - height * height),
        scallopHeight: height,
      };
    }
    throw new RangeError("Scallop calculation must solve from stepover or height.");
  }

  function truePosition(deltaX, deltaY) {
    const x = Number(deltaX);
    const y = Number(deltaY);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new RangeError("X and Y deviations must be valid numbers.");
    }
    const radialError = Math.hypot(x, y);
    return {radialError, diametricalTruePosition: radialError * 2};
  }

  function boreStockPlan({ currentDiameter, finishDiameter, maxRadialDepth, finishAllowanceDiameter = 0 }) {
    const current = requirePositive(currentDiameter, "Current bore diameter");
    const finish = requirePositive(finishDiameter, "Finish bore diameter");
    const maxDepth = requirePositive(maxRadialDepth, "Maximum radial depth per rough pass");
    const finishAllowance = requireNonNegative(finishAllowanceDiameter, "Finish allowance on diameter");
    if (finish <= current) throw new RangeError("Finish bore diameter must exceed current bore diameter.");
    const diameterRemoval = finish - current;
    if (finishAllowance >= diameterRemoval) {
      throw new RangeError("Finish allowance must be smaller than total diameter removal.");
    }
    const totalRadialStock = diameterRemoval / 2;
    const finishRadialStock = finishAllowance / 2;
    const roughRadialStock = totalRadialStock - finishRadialStock;
    const roughPasses = Math.ceil(roughRadialStock / maxDepth);
    return {
      diameterRemoval,
      totalRadialStock,
      roughRadialStock,
      finishRadialStock,
      roughPasses,
      radialDepthPerRoughPass: roughRadialStock / roughPasses,
      prefinishDiameter: finish - finishAllowance,
    };
  }

  return {
    INCHES_PER_MILLIMETER,
    SFM_RPM_CONSTANT,
    circleFrom,
    circularInterpolationFeed,
    boreStockPlan,
    countersinkDepth,
    effectiveCuttingDiameter,
    feedFromChipLoad,
    feedFromIpr,
    helixAngle,
    helixPitch,
    radialChipThinningFactor,
    resolveSurfaceSpeed,
    rightTriangle,
    rpmFromSfm,
    sfmFromRpm,
    tapDrillRange,
    threadMill,
    scallopGeometry,
    truePosition,
  };
});
