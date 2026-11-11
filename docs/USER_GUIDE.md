# Sine User Guide

## Purpose

Sine puts frequently used CNC programming and machine-shop calculations on one webpage. It is intended for planning, programming, and checking work—not for automatically controlling a machine or replacing tooling data and prove-out.

Live calculator: [matthewjaybarr-png.github.io/MB-Sine](https://matthewjaybarr-png.github.io/MB-Sine/)

## Main sections

### Shop Setup

Create named machine profiles with optional maximum RPM and feed-IPM values. When a profile is active, applicable milling, drilling, turning, tapping, and thread-milling results show whether the calculation is within the saved limits.

Profiles are saved in the current browser only. The calculator warns when a value exceeds a limit but does not alter the result.

This section also lets you copy the latest calculation to the clipboard or download it as a text setup note.

### Speeds and Feeds

The milling and drilling calculator covers drills, end mills, 45-degree face mills, and 90-degree shoulder mills. Choose whether SFM or RPM is the source value so the calculator never has to guess which field controls the result.

End-mill mode uses radial stepover for chip thinning. Face-mill and shoulder-mill modes do not apply radial chip thinning.

The turning calculator covers OD/face turning, boring, grooving, and drilling on a lathe. It uses IPR and the selected SFM/RPM basis.

MB baselines are starting assumptions. Enter manufacturer values when they are available.

### Drill Charts and Sizes

- **Quick Select** displays values from the built-in drill chart.
- **Search or Convert** accepts standard drill names, fractions, decimal inches, and millimeters.
- **Point and Spot Depth** gives a drill's point length, or the depth a spot or center drill needs to make a given diameter.
- **Peck Guide** classifies hole depth by diameter ratio.

Peck output is general guidance. Drill geometry, chip form, coolant delivery, and manufacturer recommendations still control the actual cycle.

### Threads and Taps

- **Tap Drill Check** covers UNC, UNF, metric, and NPT threads.
- Cutting taps and form taps are handled separately. Form-tap drills are larger (0.68 × pitch instead of 1.299 × pitch), and the standard chart drill is shown for cutting taps.
- Unsupported NPT form-tap estimates are not invented; the calculator directs the user to manufacturer data.
- **Tap Speeds and Feeds** calculates RPM and synchronized feed from thread pitch.
- **Thread Mill Helper** includes flute count and internal/external centerline diameter, and gives the programmed feed at the tool centerline as well as the feed at the cutting edge.
- **NPT Helper** gives pitch-and-turn travel guidance, not finished-thread gage depth.

Always verify threaded work with the correct tap or thread-mill data and inspection method.

### Geometry and Helix

This section contains chamfer and countersink depth (give a size per side or a top diameter) and helical-pitch/angle calculations. Invalid geometry—such as a cutter larger than its bore—is reported as an error instead of being formatted as a plausible zero.

### Advanced Milling and Inspection Math

- **Circular Interpolation Feed** converts desired feed at the cutting edge to cutter-centerline feed for internal bores or external bosses.
- **Effective Cutting Diameter** calculates the active diameter and SFM for ball-nose or tapered tools.
- **Scallop Height and Stepover** solves from either a known stepover or a target theoretical scallop height.
- **True Position** calculates diametrical true position from nominal and actual X/Y centers.
- **Bore Stock Planning** divides radial roughing stock into equal passes while preserving a finish allowance.

These are mathematical helpers. Surface angle, cutter deflection, runout, tolerance, datum structure, and material-condition modifiers may require additional engineering judgment.

### Shop Math

Includes inch/millimeter, decimal/fraction, pitch, and surface-speed conversions plus bolt circles, circle properties, taper, point-to-point distance, and right-triangle solving.

### Reference Tables

The formula table summarizes the relationships used by the calculators. The material table shows low, standard, and upper MB baselines by operation and tool class.

## Saved preferences and offline use

The browser remembers common operation, material, tool, unit, and baseline selections. It does not upload those preferences or machine profiles.

On supported browsers, use the browser's install option after opening the live calculator. Once cached, the calculator can load without a network connection. Reopen it online after an update so the newest offline files can replace the previous cache.

## Before using a result

Confirm the exact cutter or insert data, machine and holder limits, tool stickout, workholding, coolant, material condition, engagement, tolerance, and inspection plan. Treat the displayed result as one checked input to the programming process—not final authority by itself.
