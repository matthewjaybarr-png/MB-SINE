# Sine

Project name: **MB Sine**. On screen it is just **Sine**.

Sine is a browser-based machining calculator for CNC programmers, machinists, and manufacturing engineers. It combines commonly used speed-and-feed, drilling, threading, geometry, inspection, and shop-math tools in one page that works on a desktop or phone.

[Open the live calculator](https://matthewjaybarr-png.github.io/MB-Sine/)

## What it does

The calculator includes:

- Milling, drilling, turning, and tapping speeds and feeds
- Radial chip-thinning calculations for end mills
- Drill-size search, conversion, quick selection, point and spot depth, and peck guidance
- UNC, UNF, metric, and NPT tap-drill checks
- Cutting-tap and form-tap drills, tap speeds and feeds, and thread-mill centerline feed
- Chamfer and countersink depth, helix, bolt-circle, circle, taper, triangle, and conversion math
- Circular-interpolation feed compensation
- Ball-nose and tapered-tool effective cutting diameter
- Scallop height and stepover calculations
- True-position and bore-stock planning

It also supports browser-local machine profiles. A profile can hold a machine's maximum spindle RPM and feed rate so calculated results can display a warning when they exceed those saved limits. Results are advisory and are never silently reduced or changed.

## Basic use

1. Open the calculator and choose the section you need from the top navigation.
2. Select the calculation basis and enter the known values.
3. Use an MB baseline when helpful, or enter verified tool-manufacturer values directly.
4. Select **Calculate** and review the displayed units, basis, and warnings.
5. Copy or download the latest result when you want a compact setup note.

Machine profiles and common selections are stored only in the current browser. Clearing site data removes them.

For a short section-by-section explanation, see the [User Guide](docs/USER_GUIDE.md).

## Important limits

This is a programming and planning aid, not a replacement for:

- Tool and insert manufacturer data
- Machine, spindle, holder, and workholding limits
- Coolant, chip-control, rigidity, and stickout review
- Print requirements, inspection plans, or thread gaging
- Prove-out, simulation, or operator verification

The calculator does not generate controller-ready CNC code and is not connected to a machine tool.

## Data and reliability

Mathematical formulas are isolated from the page controls and covered by automated regression tests. Generic cutting presets are clearly identified as MB baselines rather than manufacturer recommendations. See [Calculation and Data Provenance](SOURCES.md) for sources and update rules, and [Audit Record](AUDIT.md) for the completed reliability review.

## Offline use

After the calculator has loaded once from GitHub Pages, supported browsers can install it as an app and cache the local calculator files for offline use. The external title font may fall back to a system font while offline; calculator functions remain local.

## MB suite and MB Forge

Sine is part of the MB tools. MB Forge, the shop's G-code editor, can carry Sine inside its app so it works without a browser or a network connection:

```bash
npm run build:forge
```

This writes `dist/forge/sine/`, a copy that follows Forge's security policy and uses Forge's look. See [Sine in MB Forge](docs/FORGE.md) for where it goes in Forge and the messages Sine sends it. Open the site with `?host=forge` to preview the Forge look in a browser.

## Run locally

The site has no production dependencies. From the repository directory:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Test

Node.js is required, but no package installation is needed:

```bash
npm test
```

The complete release check is:

```bash
npm run check
```

## Project structure

- `index.html` — interface markup
- `css/styles.css` — responsive layout and component styles
- `js/host.js` — standalone or MB Forge, and the messages Sine sends Forge
- `js/app.js` — browser controls and result presentation
- `js/actions.js` — runs the calculation a button names (`data-click` / `data-change`), with no inline handlers
- `js/core.js` — pure machining and geometry calculations
- `js/data.js` — material, drill, and thread reference data
- `js/workflow.js` — machine-profile validation and limit checks
- `tests/` — calculation, data, workflow, and page-contract tests
- `manifest.webmanifest` and `service-worker.js` — installable/offline support
- `docs/USER_GUIDE.md` — concise user guide
- `docs/FORGE.md` — how MB Forge carries Sine
- `tools/` — the MB Forge, offline single-file and reference-sheet builds
- `CHANGES.txt` — what changed in each version
