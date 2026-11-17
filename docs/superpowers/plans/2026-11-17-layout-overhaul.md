# Sine Layout Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show one calculator at a time (menu picks the section, tabs pick the calculator), with inputs left and result right, no empty result rail, and shop tool lists in a drawer.

**Architecture:** `index.html` wraps each section in `<section class="page">`. A new `js/layout.js` does the rest at load: shows one page, builds a tab row from each page's cards, splits each card into inputs / output / folded notes by moving existing nodes (ids and `data-click` actions are untouched), moves the existing Copy/Download block into the active card, and turns the shop tool lists into a `<dialog>` drawer. Pure decision functions live in the same file and are tested with `node --test`.

**Tech Stack:** Plain HTML/CSS/JS (no framework), `node --test`, Tauri 2 for Windows, Forge copies the same files.

**Spec:** `docs/superpowers/specs/2026-11-17-layout-overhaul-design.md`

## Global Constraints

- No machining math changes: `js/core.js`, `js/data.js`, `js/workflow.js` calculation code is not edited.
- No inline `<script>`, `<style>` or `on*=` handlers (Forge runs Sine under `script-src 'self'`); controls use `data-click` / `data-change`.
- Every new script file is added to `index.html`, `tools/build-forge.js` (FILES list), `tools/build-offline.js` (`scripts`), and `service-worker.js` (cache list), in the same order.
- Works at 320–460 px (Forge panel): one column, no sideways scroll.
- `localStorage` reads/writes are wrapped in try/catch; the page works without it.
- Keep the `mb-sine:result` event, `recordLatestResult`, `copyLatestResult`, `downloadLatestResult` and their element ids.
- Work on a new branch `sine-1.4.0` cut from `sine-1.3.1`. Version becomes 1.4.0.

## Review Focus

1. A hash that names no page (`#nope`, an old bookmark like `#milling-load` in release) → show the first page, no blank screen.
2. A remembered tab that is now hidden (NPT Helper after switching away from NPT, Shop Tools card with no toolbook) → fall back to the first visible tab.
3. A card with no `.result` (Reference tables, Shop Tools search) → no split, shown full width.
4. Browser Back/Forward after switching sections → the page and the menu highlight follow the hash.
5. Saved state written by a later version or corrupt JSON → ignored, defaults used.

---

### Task 1: Pure layout decisions + script wiring

**Files:**
- Create: `js/layout.js`
- Create: `tests/layout.test.js`
- Modify: `index.html` (script tag after `js/actions.js`), `tools/build-forge.js:27-32`, `tools/build-offline.js:64` and its header comment, `service-worker.js:6-11`, `package.json` `check` script (`node --check js/layout.js`), `tests/page-contract.test.js` (script-order regex)

**Interfaces:**
- Produces (exported via `module.exports` when `typeof module !== "undefined"`, same pattern as `js/actions.js`):
  - `resolveView(hash: string, saved: {page?: string, tabs?: Record<string,string>} | null, pages: {id: string, tabs: {id: string, visible: boolean}[]}[]) -> {page: string, tab: string | null}`
  - `splitCard(children: {cls: string, tag: string}[]) -> {out: number[], notes: number[]}` — indexes into `children`. `out` = the last child whose `cls` contains `result`, plus every following child whose `cls` contains `shop-tool-list`; `notes` = children whose `cls` contains `note` and that come after the last `button`. No `result` child → `{out: [], notes: []}`.
  - `parseSaved(text: string | null) -> {page?: string, tabs: Record<string,string>}` — bad JSON or wrong shape → `{tabs: {}}`.

- [ ] **Step 1: Write failing tests in `tests/layout.test.js`**

```js
const { resolveView, splitCard, parseSaved } = require('../js/layout.js');
const pages = [
  { id: 'shopsetup', tabs: [{ id: 'limits', visible: true }, { id: 'tools', visible: false }] },
  { id: 'threads', tabs: [{ id: 'setup', visible: true }, { id: 'npt', visible: false }] },
];
test('hash wins over saved page', () => assert.deepEqual(resolveView('#threads', { page: 'shopsetup', tabs: {} }, pages), { page: 'threads', tab: 'setup' }));
test('unknown hash falls back to saved, then first page', () => {
  assert.equal(resolveView('#nope', { page: 'threads', tabs: {} }, pages).page, 'threads');
  assert.equal(resolveView('#nope', null, pages).page, 'shopsetup');
});
test('hidden saved tab falls back to first visible', () => assert.equal(resolveView('#threads', { tabs: { threads: 'npt' } }, pages).tab, 'setup'));
test('splitCard picks last result, tool list and trailing notes', () => {
  const kids = ['h2|', 'div|row2', 'button|', 'div|result', 'button|', 'div|result', 'div|shop-tool-list', 'div|note'].map(s => { const [tag, cls] = s.split('|'); return { tag, cls }; });
  assert.deepEqual(splitCard(kids), { out: [5, 6], notes: [7] });
});
test('splitCard leaves cards without a result alone', () => assert.deepEqual(splitCard([{ tag: 'h2', cls: '' }, { tag: 'table', cls: '' }]), { out: [], notes: [] }));
test('parseSaved survives junk', () => { assert.deepEqual(parseSaved('{oops'), { tabs: {} }); assert.deepEqual(parseSaved('[1]'), { tabs: {} }); assert.deepEqual(parseSaved(null), { tabs: {} }); });
```

- [ ] **Step 2: Run `rtk node --test tests/layout.test.js`** — expected FAIL (cannot find module).
- [ ] **Step 3: Implement the three functions in `js/layout.js`; wire the file into index.html, build-forge, build-offline, service-worker, `check`, and the page-contract regex.**
- [ ] **Step 4: Run `rtk npm run check`** — expected all tests PASS.
- [ ] **Step 5: Commit** `Layout: pure view/card decisions and script wiring`

### Task 2: Pages and menu

**Files:**
- Modify: `index.html:22-26` and each section boundary (shopsetup, speeds, drillcharts, threads, milling, advanced, shopmath, reference); `css/styles.css:93-96` (`:target` nav rules), `.workbench` grid; `js/layout.js`; `tests/page-contract.test.js`

**Interfaces:**
- Consumes: `resolveView`, `parseSaved` (Task 1)
- Produces: `showPage(id: string): void`, `initLayout(): void` (called on `DOMContentLoaded` from `js/layout.js`), storage key `"mb-sine:view"` holding `{page, tabs}`.

- [ ] **Step 1: Add contract test** `every menu link opens a section.page`: each `href="#x"` in `.nav` has exactly one `<section class="page" id="x"`, each page holds one `class="sectionhead"`, and no `sectionhead` keeps an `id`.
- [ ] **Step 2: Run it** — expected FAIL.
- [ ] **Step 3: Wrap each section** from its `sectionhead` to the next one in `<section class="page" id="…" aria-labelledby="…-title">`, moving the id from the sectionhead to the section (sectionhead gets `id="…-title"`). Geometry's intro `<p class="note">` stays inside its page.
- [ ] **Step 4: Implement `showPage`**: sets `hidden` on every other `.page`, sets `aria-current="page"` on the matching `.nav a` (remove the `:target` CSS, style `[aria-current=page]` the same), updates `location.hash` with `history.replaceState` only when it differs, saves to storage, scrolls to top. `hashchange` and nav clicks call it (Review Focus 1, 4).
- [ ] **Step 5: Run `rtk npm run check`** — PASS.
- [ ] **Step 6: Check in the browser preview** (`.claude/launch.json` entry): each menu item shows only its section; Back returns to the previous one; `#nope` shows Shop Setup.
- [ ] **Step 7: Commit** `Layout: one section at a time`

### Task 3: Tabs and the card split

**Files:**
- Modify: `js/layout.js`, `css/styles.css` (`.grid2`, `.grid-auto`, `.compact-grid`, `.center-narrow` lose their side-by-side role inside pages; new `.tabs`, `.card-in`, `.card-out`, `.card-help`)

**Interfaces:**
- Consumes: `splitCard`, `resolveView`, `showPage` (Tasks 1–2)
- Produces: `showTab(pageId: string, tabId: string): void`; tab id = card's `id` if it has one, else a slug of its `h2` text (`"bolt-circle"`), set as `data-tab` on the card.

- [ ] **Step 1: Build a tab row per page** at init: one `<button role="tab">` per `.card` with an `h2` inside the page (document order, including nested grids), skipped when the page has one card. `role="tablist"` container, arrow keys move between tabs, Enter/Space selects, focus moves to the card's first input on select.
- [ ] **Step 2: Mirror `hidden`**: a `MutationObserver` on each card's `hidden` attribute hides its tab; if the active card becomes hidden, show the first visible tab (Review Focus 2).
- [ ] **Step 3: Split each card** with `splitCard` over its direct children: wrap inputs in `.card-in`, `out` nodes in `.card-out`, `notes` in `<details class="card-help"><summary>How this is worked out</summary>…</details>` placed at the end of `.card-in`. The `h2` stays above both. Cards without a result are untouched (Review Focus 3).
- [ ] **Step 4: CSS**: active card `display:grid; grid-template-columns:minmax(0,1.15fr) minmax(0,1fr); gap:16px`; `.card-out` `position:sticky; top:<topbar+tabs>`; one column below 900 px and under `html[data-host="forge"]` (set by `js/host.js:209`). Remove the old two-column grids' empty-column effect by letting `.page` children be single column.
- [ ] **Step 5: Run `rtk npm run check`** — PASS.
- [ ] **Step 6: Preview** at 1366×768: Milling/Drilling tab shows inputs left, Calculate, and result right with no page scroll at default values; Turning tab likewise; NPT Helper tab appears only for NPT.
- [ ] **Step 7: Commit** `Layout: calculator tabs, inputs beside result`

### Task 4: Result block moves into the active card; machine name in the top bar

**Files:**
- Modify: `index.html:~735-753` (the `<aside class="result-rail">`), `css/styles.css` (`.workbench` to two columns `184px minmax(0,1fr)`, drop `.result-rail`), `js/layout.js`, `js/app.js` (the profile-change handler that already calls `activeMachineProfile()`)

**Interfaces:**
- Consumes: `showTab` (Task 3)
- Produces: element `#topMachine` in `.topbar`; `.result-actions` block (existing `latestResultStatus`, `latestResultDetail`, copy/download buttons) re-parented into the active card's `.card-out` on every `showTab`.

- [ ] **Step 1: Replace the aside** with a `.result-actions` block holding the same ids; it is hidden on cards whose output id is in `NON_EXPORTABLE_RESULTS` or that have no `.card-out`. `latestResultDetail` is not shown (the card's own result is visible); `latestResultStatus` shows "Copied…" messages. The note text from `latestResultNote()` is unchanged.
- [ ] **Step 2: Add `<span id="topMachine">` in the topbar**, filled with `activeMachineProfile()?.name || "No machine profile"` at load and wherever the active profile changes (grep `activeMachineProfile` callers in `js/app.js` for the change handler).
- [ ] **Step 3: Extend the page-contract test**: `#topMachine`, `#copyLatestButton`, `#downloadLatestButton` still exist; no `result-rail` in `index.html`.
- [ ] **Step 4: Run `rtk npm run check`** — PASS.
- [ ] **Step 5: Preview**: calculate T102 on milling → Copy and Download sit under the result; downloaded note still names calculator, machine, time.
- [ ] **Step 6: Commit** `Layout: results stay with their calculator`

### Task 5: Shop tool drawer

**Files:**
- Modify: `index.html` (one `<dialog id="toolDrawer" class="drawer">` before `</body>` with a close button), `css/styles.css`, `js/layout.js`, `js/app.js:1793-1830` (where `tapShopTools` / `mainShopTools` are filled)

**Interfaces:**
- Produces: `openToolDrawer(listId: string): void`; per list a button `.drawer-open` showing `Shop tools at this size (n)`, `n` = item count, hidden when `n` is 0 or the list is `hidden`.

- [ ] **Step 1: After each fill in `app.js`**, call `syncToolButton(listId)` (in `layout.js`) to update the button count/visibility.
- [ ] **Step 2: `openToolDrawer`** moves the list into the dialog, `showModal()`; on close (button, Esc, or a tool pick's existing action finishing) the list returns to its card. Remove the inner `max-height`/overflow on `.shop-tool-list` so only the drawer scrolls.
- [ ] **Step 3: Run `rtk npm run check`** — PASS.
- [ ] **Step 4: Preview**: 3/16 drill → button reads "(4)" → drawer lists T303 etc. → picking T303 fills the card, closes the drawer, result updates.
- [ ] **Step 5: Commit** `Layout: shop tools in a drawer`

### Task 6: Jumps between calculators

**Files:**
- Modify: `js/app.js:1735,1743,1748,1753,1773` (the five `scrollIntoView` calls), `js/layout.js`

**Interfaces:**
- Produces: `revealField(id: string): void` — finds the element's `.page` and card, calls `showPage` and `showTab`, then `scrollIntoView({block:"center"})` and focuses it.

- [ ] **Step 1: Replace the five calls** with `revealField("toolDia")` etc.
- [ ] **Step 2: Run `rtk npm run check`** — PASS (DOM-reference contract test still passes).
- [ ] **Step 3: Preview**: from the Shop Tools search, pick a spot drill → Drill Charts page, Point and Spot Depth tab, field focused; pick a tap → Threads page.
- [ ] **Step 4: Commit** `Layout: shop tool picks open the right calculator`

### Task 7: Version 1.4.0 and DEV

**Files:**
- Modify: `package.json` version, `CHANGES.txt`; then on branch `DEV`: merge `sine-1.4.0`, wrap DEV's `worksheet` and `milling-load` sections (`h2.sectionhead`) as pages and add them to its nav.

- [ ] **Step 1: Bump to 1.4.0**, add a CHANGES entry, `rtk npm run check`, commit `Sine 1.4.0: one calculator at a time`.
- [ ] **Step 2: Merge into DEV**, resolve conflicts, wrap the two DEV sections, `rtk npm run check` (DEV's own test count must not drop), commit.

### Task 8: Acceptance pass (spec "Checks")

- [ ] Preview release and DEV at 1280×800, 1366×768, 1920×1080, 460 px and 320 px: every page and tab, empty and filled result, drawer, no sideways scroll, no clipped labels, menu highlight correct. Screenshots saved for the return report.
- [ ] Re-run the work-PC probes: T102 → 76.4 IPM; T151 after T102 clears flutes and shows no feed; machine max 800 RPM warns at 955 RPM and keeps 955.
- [ ] `rtk npm run build:offline` and `rtk npm run build:forge` succeed; offline file opens and switches pages.
- [ ] Saved profiles, DEV sheets, Copy and Download still work after a reload.
