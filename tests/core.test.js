const test = require('node:test');
const assert = require('node:assert/strict');
const calc = require('../js/core.js');

const closeTo = (actual, expected, tolerance = 1e-9) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} was not within ${tolerance} of ${expected}`);
};

test('surface-speed calculation uses one explicit basis', () => {
  const fromSfm = calc.resolveSurfaceSpeed({ basis: 'sfm', sfm: 350, rpm: 999, diameterInches: 0.5 });
  closeTo(fromSfm.rpm, 350 * (12 / Math.PI) / 0.5);
  assert.equal(fromSfm.sfm, 350);

  const fromRpm = calc.resolveSurfaceSpeed({ basis: 'rpm', sfm: 999, rpm: 2500, diameterInches: 0.5 });
  closeTo(fromRpm.sfm, 2500 * 0.5 / (12 / Math.PI));
  assert.equal(fromRpm.rpm, 2500);
});

test('thread-mill feed includes cutting-edge count and is programmed at the tool centerline', () => {
  const result = calc.threadMill({
    threadMajorInches: 0.5,
    toolDiameterInches: 0.375,
    rpm: 1800,
    cuttingEdges: 3,
    chipLoad: 0.0015,
    pitchInches: 1 / 13,
  });
  closeTo(result.peripheryFeedIpm, 8.1);            // 1800 x 3 x .0015 at the cutting edge
  closeTo(result.centerlineDiameter, 0.125);
  closeTo(result.compensationRatio, 0.25);          // .125 / .5
  closeTo(result.feedIpm, 2.025);                   // what goes in the program (G41 off, centerline)
});

test('external thread-mill feed is compensated on the major diameter; the minor sets the path', () => {
  const result = calc.threadMill({
    threadMajorInches: 1, threadMinorInches: 0.75, toolDiameterInches: 0.5, rpm: 2000, cuttingEdges: 4, chipLoad: 0.001,
    pitchInches: 1 / 8, threadLocation: 'external',
  });
  closeTo(result.peripheryFeedIpm, 8);
  closeTo(result.centerlineDiameter, 1.25);
  closeTo(result.compensationRatio, 1.5);            // (1 + 0.5) / 1, Kennametal TMS
  closeTo(result.feedIpm, 12);                      // 8 x 1.5
});

test('external thread-mill feed requires a component minor diameter', () => {
  assert.throws(() => calc.threadMill({
    threadMajorInches: 1, toolDiameterInches: 0.25, rpm: 1000, cuttingEdges: 4, chipLoad: 0.001,
    pitchInches: 0.05, threadLocation: 'external',
  }), /minor diameter/i);
});

test('thread-mill centerline supports internal and external threads', () => {
  closeTo(calc.threadMill({
    threadMajorInches: 1,
    toolDiameterInches: 0.25,
    rpm: 1000,
    cuttingEdges: 4,
    chipLoad: 0.001,
    pitchInches: 0.05,
    threadLocation: 'internal',
  }).centerlineDiameter, 0.75);

  closeTo(calc.threadMill({
    threadMajorInches: 1,
    threadMinorInches: 0.8,
    toolDiameterInches: 0.25,
    rpm: 1000,
    cuttingEdges: 4,
    chipLoad: 0.001,
    pitchInches: 0.05,
    threadLocation: 'external',
  }).centerlineDiameter, 1.05);
});

test('circle calculation obeys the selected source field', () => {
  closeTo(calc.circleFrom('radius', 2).diameter, 4);
  closeTo(calc.circleFrom('circumference', Math.PI * 3).diameter, 3);
});

test('depth-to-diameter ratio validates both positive dimensions', () => {
  closeTo(calc.depthDiameterRatio(1.5, 0.375), 4);
  assert.throws(() => calc.depthDiameterRatio(0, 0.375), /greater than zero/);
});

test('taper geometry calculates angles and rejects zero length or reversed diameters', () => {
  const result = calc.taperGeometry(1, 0.75, 1);
  closeTo(result.diameterChange, 0.25);
  closeTo(result.perSideAngleDegrees, 7.1250163489, 1e-8);
  closeTo(result.taperPerInch, 0.25);
  closeTo(result.taperPerFoot, 3);
  assert.throws(() => calc.taperGeometry(1, 0.75, 0), /length.*greater than zero/i);
  assert.throws(() => calc.taperGeometry(0.75, 1, 1), /large diameter.*small diameter/i);
});

test('bolt-circle geometry returns equally spaced points around the selected center', () => {
  const result = calc.boltCircle({diameter:4, holeCount:4, startAngleDegrees:0, centerX:1, centerY:2});
  assert.equal(result.angleStepDegrees, 90);
  closeTo(result.holes[0].x, 3);
  closeTo(result.holes[0].y, 2);
  closeTo(result.holes[1].x, 1);
  closeTo(result.holes[1].y, 4);
  closeTo(result.holes[2].x, -1);
  closeTo(result.holes[2].y, 2);
  assert.throws(() => calc.boltCircle({diameter:4, holeCount:0}), /hole count.*positive integer/i);
});

test('fraction parser accepts shop fractions and rejects zero denominators or trailing text', () => {
  assert.equal(calc.parseFraction('1 1/2'), 1.5);
  assert.equal(calc.parseFraction('-1 1/2'), -1.5);
  assert.equal(calc.parseFraction('13/64'), 13 / 64);
  assert.throws(() => calc.parseFraction('1/0'), /denominator/i);
  assert.throws(() => calc.parseFraction('0.257junk'), /valid fraction or decimal/i);
});

test('nearest drill lookup returns no match outside the built-in chart range', () => {
  const drills = [{ name: '#80', dec: 0.0135 }, { name: '2', dec: 2 }];
  assert.equal(calc.nearestDrillInRange(2.5, drills), null);
  assert.equal(calc.nearestDrillInRange(1.9, drills).name, '2');
});

test('right-triangle calculation obeys the selected input pair', () => {
  const sides = calc.rightTriangle({ solveFrom: 'a_b', sideA: 3, sideB: 4 });
  closeTo(sides.hypotenuse, 5);

  const angleAndHypotenuse = calc.rightTriangle({
    solveFrom: 'angle_h',
    sideA: 999,
    sideB: 999,
    hypotenuse: 10,
    angleA: 30,
  });
  closeTo(angleAndHypotenuse.sideA, 5);
  closeTo(angleAndHypotenuse.sideB, 5 * Math.sqrt(3));
});

test('invalid machining geometry throws instead of returning a plausible zero', () => {
  assert.throws(() => calc.countersinkDepth(0.5, 0.25, 82), /must exceed/);
  assert.throws(() => calc.helixPitch(0.5, 0.75, 3), /smaller than bore/);
  assert.throws(() => calc.rpmFromSfm(350, 0), /greater than zero/);
});

test('known drill-point-independent geometry calculations remain precise', () => {
  closeTo(calc.countersinkDepth(0.25, 0.5, 90), 0.125);
  const helix = calc.helixPitch(1.5675, 0.75, 3);
  closeTo(helix.radius, 0.40875);
  closeTo(helix.pitch, 2 * Math.PI * 0.40875 * Math.tan(3 * Math.PI / 180));
});

test('NPT drill handling never invents a form-tap recommendation', () => {
  const thread = { major: 1.315, pitch: 11.5, tapDec: 1.15625, tapConfidence: 'published' };
  const cutting = calc.tapDrillRange('NPT', thread, 'cut');
  assert.equal(cutting.exact, true);
  assert.equal(cutting.typicalDec, 1.15625);

  const forming = calc.tapDrillRange('NPT', thread, 'form');
  assert.equal(forming.unsupported, true);
  assert.match(forming.note, /manufacturer/i);
});

test('straight-thread tap drill ranges preserve low-to-high drill order', () => {
  const thread = { major: 0.5, pitch: 13 };
  const range = calc.tapDrillRange('UNC', thread, 'cut');
  assert.ok(range.minDec < range.typicalDec);
  assert.ok(range.typicalDec < range.maxDec);
});

test('circular interpolation compensates feed at the cutter centerline', () => {
  const bore = calc.circularInterpolationFeed({
    featureDiameter: 2,
    toolDiameter: 0.5,
    surfaceFeedIpm: 20,
    location: 'internal',
  });
  closeTo(bore.centerlineDiameter, 1.5);
  closeTo(bore.centerlineFeedIpm, 15);

  const boss = calc.circularInterpolationFeed({
    featureDiameter: 2,
    toolDiameter: 0.5,
    surfaceFeedIpm: 20,
    location: 'external',
  });
  closeTo(boss.centerlineDiameter, 2.5);
  closeTo(boss.centerlineFeedIpm, 25);
});

test('effective cutting diameter supports ball-nose and tapered tools', () => {
  closeTo(calc.effectiveCuttingDiameter({
    toolType: 'ball', toolDiameter: 1, axialDepth: 0.125,
  }).effectiveDiameter, 2 * Math.sqrt(0.125 * 0.875));
  closeTo(calc.effectiveCuttingDiameter({
    toolType: 'taper', toolDiameter: 1, tipDiameter: 0.25, axialDepth: 0.25, includedAngleDegrees: 60,
  }).effectiveDiameter, 0.25 + 0.5 * Math.tan(Math.PI / 6));
});

test('scallop geometry solves in either direction', () => {
  const fromStepover = calc.scallopGeometry({solveFrom:'stepover', ballDiameter:1, stepover:0.1});
  const fromHeight = calc.scallopGeometry({solveFrom:'height', ballDiameter:1, scallopHeight:fromStepover.scallopHeight});
  closeTo(fromHeight.stepover, 0.1);
});

test('true position reports diametrical position from axis deviations', () => {
  const position = calc.truePosition(0.003, 0.004);
  closeTo(position.radialError, 0.005);
  closeTo(position.diametricalTruePosition, 0.01);
});

test('bore stock planning preserves finish allowance and pass limits', () => {
  const plan = calc.boreStockPlan({
    currentDiameter: 1,
    finishDiameter: 1.5,
    maxRadialDepth: 0.1,
    finishAllowanceDiameter: 0.02,
  });
  assert.equal(plan.roughPasses, 3);
  assert.ok(plan.radialDepthPerRoughPass <= 0.1);
  closeTo(plan.prefinishDiameter, 1.48);
  closeTo(plan.finishRadialStock, 0.01);
});

test('advanced geometry rejects impossible domains', () => {
  assert.throws(() => calc.circularInterpolationFeed({featureDiameter:1, toolDiameter:1, surfaceFeedIpm:10}), /smaller/);
  assert.throws(() => calc.scallopGeometry({solveFrom:'height', ballDiameter:1, scallopHeight:0.6}), /ball radius/);
  assert.throws(() => calc.boreStockPlan({currentDiameter:2, finishDiameter:1, maxRadialDepth:0.1}), /must exceed/);
});

test('cutting-tap drills match the standard 75 % chart sizes', () => {
  const unc = (major, tpi) => calc.tapDrillRange('UNC', { major, pitch: tpi }, 'cut');
  closeTo(unc(0.25, 20).typicalDec, 0.2013, 1e-4);         // #7 (.201)
  closeTo(unc(0.5, 13).typicalDec, 0.4251, 1e-4);          // 27/64 (.4219)
  closeTo(calc.tapDrillRange('METRIC', { major: 6, pitch: 1 }, 'cut').typicalDec * 25.4, 5.026, 1e-3); // 5.0 mm
});

test('form-tap drills are larger than cutting-tap drills and match published form-tap sizes', () => {
  const quarter = calc.tapDrillRange('UNC', { major: 0.25, pitch: 20 }, 'form');
  closeTo(quarter.typicalDec, 0.2279, 1e-4);               // #1 (.228) / 5.8 mm
  assert.ok(quarter.minDec < quarter.typicalDec && quarter.typicalDec < quarter.maxDec);
  closeTo(calc.tapDrillRange('UNF', { major: 0.19, pitch: 32 }, 'form').typicalDec, 0.1762, 1e-4);  // #16 (.177)
  closeTo(calc.tapDrillRange('METRIC', { major: 6, pitch: 1 }, 'form').typicalDec * 25.4, 5.558, 1e-3); // 5.55 mm
  for (const [type, t] of [['UNC', { major: 0.5, pitch: 13 }], ['METRIC', { major: 10, pitch: 1.5 }]]) {
    assert.ok(calc.tapDrillRange(type, t, 'form').typicalDec > calc.tapDrillRange(type, t, 'cut').maxDec,
      `${type} form drill must be larger than any cutting-tap drill`);
  }
});


test('shop mill calculation type comes from the toolbook description', () => {
  assert.deepEqual(calc.shopMillCalcType('3.0" CERATIZIT 45 DEG ROUGH FACE MILL'), { type: 'face45', sure: true });
  assert.deepEqual(calc.shopMillCalcType('1.25" ISCAR 90 DEG SHOULDER MILL'), { type: 'shoulder90', sure: true });
  assert.deepEqual(calc.shopMillCalcType('.500 4FL CRBD END MILL'), { type: 'endmill', sure: true });
  assert.deepEqual(calc.shopMillCalcType('1/2 .500 CRBD ED-M FIN OD ON PD BCKHD'), { type: 'endmill', sure: true });
  // a face mill without a lead angle, or a turbo mill: keep Endmill but say it was a guess
  assert.deepEqual(calc.shopMillCalcType('3.0" EXT DGC ROUGH FACE MILL - SS'), { type: 'endmill', sure: false });
  assert.deepEqual(calc.shopMillCalcType('2.0" POWER TURBO MILL'), { type: 'endmill', sure: false });
});

test('T102 3.0" face mill at its toolbook numbers: 955 RPM, 76.4 IPM, equal to the toolbook feed', () => {
  // 391-392 T102: 750 SFM / .010 FPT / 8 inserts, run in 45 degree face mode (no chip thinning)
  const { rpm } = calc.resolveSurfaceSpeed({ basis: 'sfm', sfm: 750, diameterInches: 3 });
  closeTo(rpm, 954.93, 0.01);
  const programmed = rpm * 8 * 0.01;
  closeTo(programmed, 76.39, 0.01);
  const book = calc.toolbookFeed({ rpm, teeth: 8, fpt: 0.01, programmedIpm: programmed });
  closeTo(book.ipm, programmed);
  assert.equal(book.over, false);
  // the 1.2.1 result: Endmill mode with a left-over .078 stepover tripled it
  const thinned = programmed * calc.radialChipThinningFactor(0.078, 3);
  assert.ok(thinned > 239 && thinned < 241);
  assert.equal(calc.toolbookFeed({ rpm, teeth: 8, fpt: 0.01, programmedIpm: thinned }).over, true);
});

test('a shop endmill run at 25% stepover is flagged above its toolbook feed', () => {
  const rpm = 3000, teeth = 4, fpt = 0.003;
  const thinned = rpm * teeth * fpt * calc.radialChipThinningFactor(0.125, 0.5);
  assert.equal(calc.toolbookFeed({ rpm, teeth, fpt, programmedIpm: thinned }).over, true);
  // 50% stepover, the shop-fill default, has no chip thinning
  assert.equal(calc.radialChipThinningFactor(0.25, 0.5), 1);
});
