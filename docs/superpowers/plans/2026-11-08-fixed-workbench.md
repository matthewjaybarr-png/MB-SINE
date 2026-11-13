# Fixed Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make MB Sine's calculators easier to navigate and results easier to scan through a fixed desktop workbench that adapts to mobile.

**Architecture:** Keep the existing static HTML page and all calculations. Move the current category links into a left rail and the latest-result/copy/download panel into a right rail; keep calculator sections and their inline results in the main column. The result tracker already keeps plain-text output, so display that text with `textContent` in the rail rather than parsing result HTML. CSS handles the desktop grid and mobile stacking.

**Tech Stack:** Existing HTML, CSS, and plain JavaScript; no new dependencies.

**Spec:** `/tmp/mb-sine-frontend-design/design.md`

## Global Constraints

- Preserve all existing calculators, formulas, data, preferences, machine profiles, and result actions.
- Add no UI framework, runtime dependency, or font dependency.
- Keep keyboard access, visible focus, readable result status, and responsive mobile layout.
- Preserve the existing MB Forge host theme overrides.

## Review Focus

- Long section names on a narrow screen must remain readable and navigable; inspect the horizontal category strip at 390px.
- Category links must continue to land on their matching section IDs; inspect every link and keyboard activation.
- Moving the latest-result panel must preserve its existing copy/download button IDs and live status updates; inspect the panel after a calculation.
- The result rail must not cover calculator inputs at desktop or mobile widths; inspect at 1440px and 390px.
- Result text may contain user-entered drill text; inspect that it displays as text and never renders as markup.
- Forge-hosted colors must retain contrast and focus visibility; inspect the existing `?host=forge` preview.

The result rail keeps each calculator's full output text and does not normalize different result formats into a shared RPM/feed display.

---

### Task 1: Put the page in a workbench shell

**Files:**
- Modify: `index.html`

**Interfaces:**
- Keep existing section IDs and category hrefs unchanged.
- Keep `latestResultStatus`, `copyLatestButton`, and `downloadLatestButton` IDs unchanged so current JavaScript continues to find them.
- Add `latestResultDetail` as a plain-text output target for the latest calculation.

- [x] Add a semantic workbench layout with the existing brand header, category navigation rail, main calculator content, and latest-result rail.
- [x] Move the existing category links into the navigation rail without changing their targets or labels.
- [x] Move the existing `workflow-output` block into the result rail without changing its controls or IDs.
- [x] Add a `latestResultDetail` output element in the result rail for the latest result text.
- [x] Keep all machine-profile inputs and calculator sections in the main content.

### Task 2: Show the full latest result safely

**Files:**
- Modify: `js/app.js`
- Modify: `index.html`

**Interfaces:**
- `recordLatestResult(element)` already records `latestShopResult.text`; write it to `#latestResultDetail` using `textContent`.
- Do not parse or reformat calculation output.

- [x] Update the latest-result detail each time `recordLatestResult` records a result.
- [x] Leave the existing label, machine name, copy, download, and result event behavior intact.

### Task 3: Style the fixed workbench and mobile layout

**Files:**
- Modify: `css/styles.css`

**Interfaces:**
- Use the approved colors from the design spec: `#17232C`, `#202F3A`, `#263640`, `#39A9B8`, `#73DCE5`, and `#E3A744`.
- Keep `Orbitron` for the SINE wordmark; use system sans for labels and system monospace for numeric results.

- [x] Replace the broad blue-card treatment with a graphite/steel workbench while retaining semantic status colors and the Forge token overrides.
- [x] At desktop widths, use a persistent left category rail, flexible calculator column, and persistent result rail.
- [x] At narrow widths, stack content, convert category links to a horizontal strip, and keep results inline without covering inputs.
- [x] Add visible keyboard focus and honor `prefers-reduced-motion` for any scrolling or transition behavior.

### Task 4: Review the rendered interface

**Files:**
- Review only; no additional product files.

- [x] Inspect the standalone app at desktop width and confirm the category rail, calculator content, and result rail remain legible.
- [ ] Inspect at 390px and confirm no horizontal page overflow, hidden controls, or overlapping result panel.
- [x] Confirm category navigation reaches its original section in the Forge preview; links retain their original `href` targets.
- [x] Inspect the latest-result actions after a calculation and confirm status/copy/download controls remain visible.
- [x] Inspect the `?host=forge` view for host theme and result contrast.

The in-session browser did not expose an explicit mobile viewport override, so 390px layout was not visually captured. Responsive rules are present in the stylesheet, but narrow-screen appearance still needs a direct viewport review. Keyboard-only traversal was not separately exercised.

Automated tests are not included in this plan; the current task instructions prohibit adding or running them unless requested.
