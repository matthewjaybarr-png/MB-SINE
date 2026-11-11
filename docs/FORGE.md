# Sine in MB Forge

Sine is one of the MB tools. MB Forge (the MB-Editor repository) can carry a copy of Sine inside its app, so the calculator works on shop PCs without a browser or a network connection.

## What Sine provides

```bash
npm run build:forge
```

This writes `dist/forge/sine/`:

| File | What it is |
| --- | --- |
| `index.html` | The calculator page, marked `<html data-host="forge">` |
| `css/styles.css`, `js/*.js`, `icons/mb-sine.svg` | The same files the website uses, copied unchanged |
| `VERSION.json` | `{ "name", "version", "commit", "built" }` for Forge's version notes |

To build straight into a Forge checkout next to this one:

```bash
npm run build:forge -- "../MB-Editor/ui/vendor/sine"
```

The build stops with an error if the page would break Forge's Content Security Policy (`script-src 'self'`, nothing from the internet). Sine does not use inline scripts or inline event handlers: buttons name their calculation in `data-click` / `data-change`, and `js/actions.js` runs it.

## What changes inside Forge

Only the look and the offline handling. No calculation changes.

- Forge's graphite colours and its MB Mono NL font. The font files are Forge's own (`ui/fonts/`), found at `../../fonts/` from `ui/vendor/sine/`. Anywhere else, Sine falls back to Consolas.
- No service worker and no Online / Offline badge. Forge ships the files.
- No Google Font and no web-app manifest.
- Machine profiles and remembered selections are kept in Forge's web storage, separate from the website's.

To preview the Forge look in a browser, open the site with `?host=forge` (for example `http://localhost:8000/?host=forge`).

## Where Forge puts it

The recommended place is `ui/vendor/sine/`, beside xterm. `ui/vendor/` is already ignored by git there and filled by `scripts/vendor.mjs`, so Sine is a build input, not code copied into Forge's history.

Forge can show it either way:

- **Panel** (recommended): an `<iframe src="vendor/sine/index.html" allow="clipboard-write">` in a pane next to the program, the same way Compare and Backplot sit next to the terminal. The CSP already allows it (`default-src 'self'`).
- **Window**: a second Tauri window on `vendor/sine/index.html`. Its label must then be added to `src-tauri/capabilities/default.json`.

## Messages from Sine to Forge

When Sine runs in a frame of a Forge page from the same origin, it posts these with `window.parent.postMessage(message, location.origin)`:

```js
{ source: "mb-sine", type: "ready",  version: "1.1.0" }   // the calculator is ready
{ source: "mb-sine", type: "result", version: "1.1.0",
  label: "Milling and Drilling Calculator",              // the card the result came from
  machine: "No machine profile selected",                // Sine's active machine profile name
  text: "Basis: entered SFM\nRPM: 573\n...",             // the result, plain text
  note: "Sine\nMilling and Drilling Calculator\n...",    // the same note Copy Result copies
  created: "2026-11-07T12:00:00.000Z" }
```

Forge should check `event.origin === location.origin` and `event.data.source === "mb-sine"` before using one. A result is information for the programmer to look at (for example to offer it as a `( ... )` comment at the cursor). Forge must never put numbers from it into a program without the programmer choosing to.

Sine posts nothing when it runs on its own, or from a `file://` page. It does not act on any message sent to it.

## Versions

`package.json` and `js/host.js` (`VERSION`) hold the same version; a test checks it. Record each version in `CHANGES.txt`. When Forge takes a new Sine, note the Sine version and commit from `VERSION.json` in Forge's `scripts/CHANGES.txt`.

## Checks

```bash
npm run check
```

`tests/forge.test.js` covers the build, the policy check, the action parser and the messages.
