# Calculation and Data Provenance

Revision: 2026-08-17

## How to read the calculator's data

The calculator separates three kinds of information:

1. **Mathematical formulas** — deterministic geometry, speed, and feed relationships covered by regression tests.
2. **MB baselines** — low, standard, and upper starting assumptions for planning. These are deliberately labeled as internal baselines, not manufacturer recommendations.
3. **Published reference data** — thread designations, selected tap-drill sizes, and material classifications tied to an identified external source.

Tool-specific manufacturer cutting data always outranks an MB baseline.

## MB baseline v1

The operation-specific SFM and feed-factor ranges in `js/data.js` are internal conservative starting assumptions for:

- HSS drilling
- Carbide drilling
- Solid-carbide end milling
- Indexable face/shoulder milling
- Carbide turning, boring, and grooving
- HSS and carbide tapping

They are organized by actual shop materials, including ASTM A536 65-45-12 ductile iron, ASTM A897 ADI 200/155/1, CD4MCuN cast stainless, and SG70A-T6 aluminum casting. They are not copied from one manufacturer's product table because a generic calculator does not know the exact grade, geometry, coating, stickout, coolant, or setup.

Before cutting, verify the selected baseline against the exact tool/insert manufacturer's data and the machine, holder, workholding, coolant, casting condition, engagement, and tolerance.

## External primary references

### Workpiece-material groups

- [Sandvik Coromant — Workpiece materials](https://www.sandvik.coromant.com/en-us/knowledge/materials/workpiece-materials)

Used for the ISO P/K/M/N material-family labels and the relative machinability cautions shown in the data model. Sandvik notes that gray iron is generally easier to machine than nodular iron, CGI, and ADI, and that cast iron is abrasive to cutting edges.

### Cast-iron milling context

- [Sandvik Coromant — Milling inserts and grades for cast iron](https://www.sandvik.coromant.com/en-us/tools/inserts-grades/insert-grade-information/milling-inserts-grades/milling-inserts-grades-cast-iron)

Used to support keeping nodular/ductile iron, gray iron, and ADI distinct rather than assigning every cast iron one cutting-speed value.

### Tap and tap-drill guidance

- [Guhring — Tap Drill Calculator](https://guhring.com/Tech/tapdrill)
- [OSG — Tap Drill Size and Pitch Limits chart](https://osgtool.com/800274ca-v3/)
- [OSG — 2-inch NPT pipe tap](https://osgtool.com/1311001/)

Guhring explains that a single chart size is normally an approximate thread-percentage choice and that lower percentages can improve tap life. OSG provides product/chart references used for the published pipe-tap entries. Large NPT entries marked `reference` in `js/data.js` remain verification-required values rather than manufacturer-certified recommendations.

### Tapping speed context

- [OSG — A-SFT spiral-flute tap product data](https://osgtool.com/content/literature/8002024CA/List%2016505%20-%20A%20BRAND%20A-SFT.pdf)

Used only as evidence that tapping speed ranges are product- and material-specific. The calculator does not present these OSG product values as universal tap speeds.

## Formula constants

The speed calculations use the exact relationship:

`RPM = (SFM × 12) / (π × diameter in inches)`

The familiar shop constant `3.82` is the rounded value of `12 / π`.

Tap drills use `drill = major − K × pitch × thread fraction`: `K = 1.299038` for cutting taps (the familiar `0.01299 × % thread / TPI`, 65–80 % thread) and `K = 0.68` for form taps (`0.0068 × % thread / TPI`, 55–75 % thread). These reproduce the standard chart sizes, for example 1/4-20 cutting #7 (.201) and form #1 (.228), and M6 × 1 cutting 5.0 mm and form 5.55 mm.

Thread milling and circular interpolation are programmed at the tool centerline: `centerline feed = edge feed × centerline diameter / feature diameter`, where the centerline diameter is the feature diameter minus the tool diameter inside and plus it outside.

## Update policy

Any future preset-data change must include:

- a revision date;
- a source or an explicit `MB baseline` label;
- the affected operation and tool class;
- regression-test updates;
- no silent replacement of a manufacturer value with a generic estimate.
