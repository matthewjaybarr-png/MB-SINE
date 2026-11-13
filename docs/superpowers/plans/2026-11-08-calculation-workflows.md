# Calculation Workflow Review Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` task by task. Steps use checkboxes for tracking.

**Goal:** Make Sine's machining calculations safer to interpret and easier to use as connected shop workflows.

**Architecture:** Keep the static app and pure `js/core.js` calculations. Correct external thread-mill compensation using a required minor diameter, replace unsupported peck-depth prescriptions with a depth-ratio readout, validate fragile shop-math inputs, and use one shared thread/tap selection. Label unit boundaries and preserve distinct tools where they answer different questions.

**Tech Stack:** Existing HTML, CSS, JavaScript, Node test suite; no dependencies.

**Spec:** User request on 2026-11-08; source review at `/tmp/mb-sine-calculation-research.md`.

## Global Constraints

- Preserve the prior fixed-workbench UI and the user-selected 1/8-27 NPT R drill entry.
- Keep manufacturer advice and MB baselines clearly distinguished.
- Never calculate external thread-mill feed without the actual external minor diameter.
- Keep controller behavior and gage depth out of generic NPT recommendations.
- Preserve MB Forge's theme and build contract.

## Review Focus

- External thread-mill inputs must use external minor diameter for the centerline ratio.
- Chip-thinning output and machine-limit checks must both identify the same programmed feed.
- Peck guidance must not prescribe a universal numeric peck depth.
- Invalid fraction, zero-length taper, and zero-hole bolt-circle inputs must show errors instead of plausible results.
- Drill conversions outside the built-in chart must not claim a false nearest listed size.
- All thread tools must show results from the same selected thread and tap style.
- Forge typography and compact layout must remain readable after removing repeated selectors.

### Task 1: Correct pure calculation contracts

**Files:** Modify `js/core.js`; modify `tests/core.test.js`.

- [x] Add failing external-thread test using minor diameter and a missing-minor rejection test.
- [x] Verify RED, update `threadMill()` to accept `threadMinorInches`, and compute external centerline diameter and ratio from minor diameter.
- [x] Add failing tests for positive depth/diameter ratio, taper geometry validation, bolt-circle validation, and strict fraction parsing.
- [x] Verify RED, add the smallest pure functions needed for those behaviors.
- [x] Run `node --test tests/core.test.js` and record the green result.

### Task 2: Make calculator handlers use those contracts

**Files:** Modify `js/app.js`; modify `tests/data.test.js` or `tests/page-contract.test.js` only where an interface contract needs coverage.

- [x] Add a failing test for malformed fraction input and drill sizes above the built-in chart range.
- [x] Verify RED, use strict parsing and show conversion without a false nearest-chart claim.
- [x] Replace fixed peck-depth outputs with the tested ratio classifier and tool-data guidance.
- [x] Use validated taper/bolt-circle/turn-count helpers; show direct errors on invalid entries.
- [x] Correct chip-thinning output labels so the increased feed is identified as the programmed value checked against machine limits.
- [x] Run affected test files and the full existing test suite.

### Task 3: Connect the thread workbench and clarify units

**Files:** Modify `index.html`, `js/app.js`, `js/actions.js` if needed, `css/styles.css`, `docs/USER_GUIDE.md`, `CHANGES.txt`.

- [x] Add one shared thread standard/size and tap-style selection to Threads and Taps; remove repeated selectors from the individual cards and NPT helper.
- [x] Keep tap drill, tap speed/feed, thread-mill, and NPT helper values synchronized from the shared selection.
- [x] Add an external minor-diameter field that is required only for external thread milling and labels units from the selected thread standard.
- [x] State which feed inputs remain inch-based, which diameter units are selectable, and that geometry outputs follow their input length units.
- [x] Remove redundant face-mill multiplier and drill per-tooth outputs where they repeat the useful programmed result; keep the distinct calculator cards.
- [x] Cover the shared selector/action contract and rerun all tests.

### Task 4: Review standalone and Forge views

**Files:** No product files unless a visual correction is required.

- [x] Inspect standalone and Forge desktop layouts, thread workbench, and result rail; narrow viewport review was outside this pass.
- [x] Build the Forge bundle and inspect `?host=forge` styling, thread layout, and result contrast.
- [x] Run `npm test` and `npm run check`; report any viewport review limitations.
- [x] Record final review findings and unresolved source-data boundaries: external thread minor diameter remains manual because values depend on thread class/tolerance; peck size remains tool/controller guidance.

Automated tests are explicitly requested by the calculation review and will be run as part of it.
