# Sine layout overhaul — design (2026-11-17)

Source: `G:\SINE\REQUESTED CHANGES\SINE - LAYOUT OVERHAUL REQUEST 2026-11-17.txt` and the
work-PC screenshots in `G:\SINE\WORK PC REVIEW 2026-11-17\`.

## Why
Sine 1.3.1 is one long page. Cards sit in pairs, so a short card (Turning) leaves a big
empty block next to a tall one (Milling/Drilling). The "Latest shop result" panel on the
right keeps its space even when it is empty, and the shop tool list scrolls inside the
page. Matt wants the empty space gone and the calculator he is using to be the whole
focus. This is a layout change, not a theme change.

## Goals
- Only one calculator on screen at a time. Its inputs, Calculate, warnings and result fit
  together with little or no scrolling at 1366×768 (100–150% Windows scaling).
- No tall empty column, no empty reserved panel, one scrollbar.
- The same layout in release and DEV (DEV adds Calculation Sheets and Milling Load).

## Non-goals and anti-goals
- No math changes. All existing tests and the work-PC probes (T102 → 76.4 IPM, T151 clears
  flutes, limit warning over max RPM) must give the same answers.
- No new features to fill space. Anything extra goes to Matt first.
- Must not break Forge's Sine panel (320–460 px wide), the `mb-sine:result` event Forge
  listens to, offline start, saved profiles/sheets, or Copy/Download.

## Approaches considered
- **A. One calculator at a time — chosen by Matt.** The menu switches sections instead of
  scrolling to them; tabs pick the calculator inside a section.
- B. Keep the long page, make each calculator full width with its result inside. Smaller
  change, but you still scroll through everything.
- C. Long page with cards that flow to fill gaps. Dropped: it keeps unrelated calculators
  mixed together, which the request asks to avoid.

## Design
**Sections.** The left menu keeps today's sections (Shop Setup, Speeds and Feeds, Drill
Charts, Threads and Taps, Geometry and Helix, Advanced Math, Shop Math, Reference; DEV adds
its two). Clicking one shows only that section; the rest are hidden. The menu marks the
current section. The URL hash still names it (`#speeds`), so links and Back keep working.

**Tabs.** Each section with more than one calculator gets a tab row: one tab per card
heading (e.g. Speeds and Feeds → Milling and Drilling | Turning; Shop Math → Conversions |
Bolt Circle | Circle | Taper | Point to Point | Right Triangle). Sections with one card show
no tab row.

**Work area.** Inside a calculator, inputs and Calculate sit on the left, and the result,
warnings and Copy/Download sit on the right. Under about 900 px wide (and in Forge's panel)
the result moves below Calculate in one column. The long explanation text goes into a
closed "How this is worked out" section under the inputs. Units and safety lines that
matter stay visible.

**Result.** The right-hand "Latest shop result" panel is removed. Copy and Download move
next to each shop calculator's own result. The saved note still says calculator, tool,
machine, units and time (the same `recordLatestResult` data and the same `mb-sine:result`
event).

**Shop tools.** "Shop drills at this size" and the other in-card tool lists become a button
showing the count ("Shop tools at this size (4)") that opens a drawer from the right with
the list. Picking a tool fills the calculator and closes the drawer.

**Jumps between calculators.** Today some actions scroll to another card (e.g. a shop tool
filling the spot-drill or thread calculator). These switch to that section and tab first.

## Calls I made (Matt can change any)
- Tabs in every multi-card section, including Shop Math's six small calculators.
- Sine remembers the last section and tab per section between launches.
- The active machine profile name shows in the top bar so it stays visible on every page
  (existing data, no new setting).

## Left to the builder
Exact spacing, the drawer's width, keyboard order (tabs reachable by keyboard, focus moves
into the section on switch), and how the narrow Forge layout stacks.

## Checks before the build goes on the stick
Screenshots of release and DEV at 1280×800, 1366×768, 1920×1080 and in a 460 px and 320 px
window; every section and tab, empty and filled results; the tool drawer; machine-limit
warning; offline restart; saved profiles and sheets; Copy and Download. All existing
tests pass unchanged.
