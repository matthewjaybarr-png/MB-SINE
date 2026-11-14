/*
 * host.js — tells Sine where it is running and talks to MB Forge when Sine is inside it.
 *
 * Loaded in <head>, before the page is drawn, so the Forge look applies without a flash.
 *   Standalone (GitHub Pages, installed web app, single-file build): nothing changes.
 *   In the Windows app (Tauri): data-host="app"; app.js skips the service worker and opens outside links in the browser.
 *     The Forge look in Neon Ridge, or the Orbit theme picked in the top bar (applyTheme), remembered on this PC.
 *   In MB Forge: <html data-host="forge"> (set by tools/build-forge.js, or ?host=forge when testing).
 *     - styles.css switches to Forge's theme, read from the Forge page (followForgeTheme)
 *     - app.js skips the service worker (Forge ships the files itself)
 *     - when Sine sits in a frame of a Forge page of the same origin, it posts messages to it:
 *         { source: "mb-sine", type: "ready",  version }
 *         { source: "mb-sine", type: "result", version, label, machine, text, note, created }
 *       Sine never acts on messages sent to it. See docs/FORGE.md.
 */
(function (root) {
  "use strict";

  const VERSION = "1.2.1";
  const HOSTS = new Set(["web", "forge", "app"]);

  // "app" is the Windows app: its page is http://tauri.localhost/ (tauri://localhost elsewhere).
  function detectHost(doc, search, loc) {
    const preset = doc.documentElement.getAttribute("data-host");
    if (HOSTS.has(preset)) return preset;
    if (loc && (loc.hostname === "tauri.localhost" || loc.protocol === "tauri:")) return "app";
    let requested = null;
    try { requested = new URLSearchParams(search || "").get("host"); } catch (_) { /* old browser */ }
    return HOSTS.has(requested) ? requested : "web";
  }

  // The message Forge receives for a new result. Plain data only (structured-clone safe).
  function resultMessage(result) {
    return {
      source: "mb-sine",
      type: "result",
      version: VERSION,
      label: String(result.label || ""),
      machine: String(result.machine || ""),
      text: String(result.text || ""),
      note: String(result.note || ""),
      created: result.created instanceof Date ? result.created.toISOString() : String(result.created || "")
    };
  }

  function connectToForge(win, doc) {
    const parent = win.parent;
    const origin = win.location.origin;
    // Only a same-origin Forge page gets results; a file:// page has origin "null" and posts nothing.
    if (!parent || parent === win || !origin || origin === "null") return false;
    const post = message => { try { parent.postMessage(message, origin); } catch (_) { /* parent gone */ } };
    doc.addEventListener("mb-sine:result", event => post(resultMessage(event.detail || {})));
    const ready = () => post({ source: "mb-sine", type: "ready", version: VERSION });
    if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", ready, { once: true });
    else ready();
    return true;
  }

  // Forge's theme tokens (ui/app.css :root, and the font from Settings > Font) that styles.css reads
  // as --forge-*. Copied, not hand-picked, so a new Forge theme or font changes Sine as well.
  const FORGE_TOKENS = ["chrome", "panel", "raised", "rule", "text", "bright", "dim", "dykem", "dykem-deep",
    "dykem-hover", "red", "green", "amber", "ui", "ui-weight"];

  // In a frame of a same-origin Forge page: copy its tokens now, and again whenever Forge changes
  // its <html> style or class (Settings > Font sets --ui there). Anywhere else nothing happens.
  function followForgeTheme(win, doc) {
    let parent, top;
    try {
      parent = win.parent;
      if (!parent || parent === win) return false;
      top = parent.document.documentElement;   // throws for a page of another origin
    } catch (_) { return false; }
    const copy = () => {
      const css = parent.getComputedStyle(top);
      for (const name of FORGE_TOKENS) {
        const value = css.getPropertyValue("--" + name).trim();
        if (value) doc.documentElement.style.setProperty("--forge-" + name, value);
        else doc.documentElement.style.removeProperty("--forge-" + name);
      }
    };
    copy();
    if (typeof win.MutationObserver === "function") {
      new win.MutationObserver(copy).observe(top, { attributes: true, attributeFilter: ["style", "class"] });
    }
    return true;
  }

  // The Windows app's theme picker: Orbit's themes (Forge owns the theme inside Forge, so no picker there).
  // BEGIN ORBIT THEMES (tools/orbit-themes.mjs, from Orbit 0.25.0: 6 built in + 21 Omarchy)
  // [id, label, background, surface, text, muted, accent, border, dark]
  const THEMES = [
    ["neon-ridge","Neon Ridge","#0a1028","#1a2550","#d7dcf5","#8089bd","#38bdfa","#2a3a78",true],
    ["tokyo-night","Tokyo Night","#1a1b26","#24283b","#c0caf5","#9aa5ce","#7aa2f7","#414868",true],
    ["jade","Jade","#181b22","#232a32","#cedfea","#889bad","#a6da95","#34433e",true],
    ["nord","Nord","#2e3440","#3b4252","#eceff4","#b5c0d0","#88c0d0","#4c566a",true],
    ["paper","Paper","#f5f2ea","#e8e4da","#252a32","#58606b","#276749","#c8c4b8",false],
    ["alpenglow-night","Alpenglow Night","#181529","#29233d","#e7dcff","#ab9fc4","#c995f4","#635078",true],
    ["catppuccin-latte","Catppuccin Latte","#eff1f5","#dce0e8","#4c4f69","#64677e","#1e66f5","#ccd0da",false],
    ["catppuccin","Catppuccin","#1e1e2e","#313244","#cdd6f4","#8489a1","#89b4fa","#45475a",true],
    ["ethereal","Ethereal","#060b1e","#131a3a","#ffcead","#6d7db6","#7d82d9","#252e56",true],
    ["everforest","Everforest","#2d353b","#343f44","#d3c6aa","#a8a291","#7fbbb3","#3d484d",true],
    ["flexoki-light","Flexoki Light","#fffcf0","#e6e4d9","#100f0f","#696763","#205ea6","#cecdc3",false],
    ["gruvbox","Gruvbox","#282828","#3c3836","#d4be98","#a2917a","#7daea3","#504945",true],
    ["hackerman","Hackerman","#0b0c16","#151828","#ddf7ff","#8690af","#82fb9c","#1f253a",true],
    ["jade-horse","Jade Horse","#142620","#203b31","#dfede5","#91ad9f","#8bcbb1","#2b5147",true],
    ["kanagawa","Kanagawa","#1f1f28","#223249","#dcd7ba","#8c8a7d","#dcd7ba","#363646",true],
    ["last-horizon","Last Horizon","#0c0b0c","#0c0b0c","#fafcfb","#80797b","#b59790","#584e51",true],
    ["lumon","Lumon","#16242d","#1b2d40","#d6e2ee","#6f9dbf","#8bc9eb","#243d56",true],
    ["lupine","Lupine","#fafafa","#f5f5f5","#212121","#606060","#3264eb","#d0d0d0",false],
    ["matte-black","Matte Black","#121212","#1e1e1e","#bebebe","#828282","#e68e0d","#2a2a2a",true],
    ["miasma","Miasma","#222222","#2c2c2c","#c2c2b0","#939389","#78824b","#383838",true],
    ["retro-82","Retro 82","#05182e","#0a2540","#f6dcac","#3f8f8a","#faa968","#134e5a",true],
    ["ristretto","Ristretto","#2c2525","#3d2f2a","#e6d9db","#a49a9b","#f38d70","#403e41",true],
    ["rose-pine","Rose Pine","#faf4ed","#f2e9e1","#575279","#6b6686","#56949f","#dfdad9",false],
    ["solitude","Solitude","#101315","#101315","#cacccc","#828488","#798186","#343d41",true],
    ["starship","Starship","#1c1c1e","#2c2c2e","#f5f5f7","#98989d","#ff9f0a","#3a3a3c",true],
    ["vantablack","Vantablack","#000000","#1a1a1a","#ffffff","#7b7b7b","#8d8d8d","#1a1a1a",true],
    ["white","White","#ffffff","#c0c0c0","#000000","#6c6c6c","#6e6e6e","#c0c0c0",false]
  ];
  // END ORBIT THEMES
  const THEME_KEY = "mbSine.theme.v1";

  const rgbOf = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const mix = (a, b, t) => "#" + rgbOf(a).map((v, i) => Math.round(v + (rgbOf(b)[i] - v) * t).toString(16).padStart(2, "0")).join("");
  const luminance = hex => rgbOf(hex).map(v => v / 255).map(s => s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4)
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  function contrast(a, b) {
    const x = luminance(a), y = luminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }
  // Orbit's rule for dim text, used for every derived colour: move toward `toward` until it reads on every ground.
  function readable(color, toward, grounds, min) {
    for (let i = 0; i < 12 && grounds.some(g => contrast(color, g) < min); i++) color = mix(color, toward, 0.25);
    return color;
  }

  // Sine's --forge-* colours worked out from a theme's 7 values. Neon Ridge gives none, so the Forge
  // Neon Ridge values in styles.css apply: the Windows app and the Forge panel use one palette.
  // Red is only Delete Profile and errors; warnings are amber.
  function themeTokens(theme) {
    const [id, , bg, surface, text, muted, accent, border, dark] = theme;
    if (id === "neon-ridge") return {};
    const panel = mix(bg, surface, 0.4);
    const grounds = [bg, panel, surface];
    const far = dark ? "#ffffff" : "#000000";
    const ink = readable(text, far, grounds, 7);
    const bright = mix(ink, far, 0.5);
    const onAccent = [bright, bg, "#ffffff", "#000000"].find(c => contrast(c, accent) >= 4.5)
      || (contrast("#ffffff", accent) > contrast("#000000", accent) ? "#ffffff" : "#000000");
    const signal = (onDark, onLight) => readable(dark ? onDark : onLight, ink, grounds, 4.5);
    return {
      chrome: bg, panel, raised: surface, rule: readable(border, ink, [panel], 1.6),
      text: ink, bright, dim: readable(muted, ink, grounds, 4.5),
      dykem: readable(accent, ink, [panel], 3), "dykem-deep": accent,
      "dykem-hover": mix(accent, luminance(onAccent) > luminance(accent) ? "#000000" : "#ffffff", 0.12),
      red: signal("#f2668f", "#b42343"), green: signal("#4fe0b0", "#1a7f50"), amber: signal("#f5c98a", "#8a5a00"),
      "on-accent": onAccent
    };
  }

  // Sets the theme on the page and the window frame; an unknown id (a removed theme) is Neon Ridge.
  function applyTheme(win, doc, id) {
    const theme = THEMES.find(t => t[0] === id) || THEMES.find(t => t[0] === "neon-ridge");
    const tokens = themeTokens(theme);
    const style = doc.documentElement.style;
    for (const name of [...FORGE_TOKENS, "on-accent"]) {
      if (tokens[name]) style.setProperty("--forge-" + name, tokens[name]);
      else style.removeProperty("--forge-" + name);
    }
    style.colorScheme = theme[8] ? "dark" : "light";
    const css = name => tokens[name] || win.getComputedStyle(doc.documentElement).getPropertyValue("--f-" + name).trim();
    try {
      win.__TAURI_INTERNALS__.invoke("frame_colors", { dark: theme[8], caption: css("panel"), text: css("text"), border: css("rule") })
        .catch(() => {});
    } catch (_) { /* not the Windows app */ }
    return theme[0];
  }

  function themePicker(win, doc) {
    const select = doc.getElementById("themePicker");
    let saved = null;
    try { saved = win.localStorage.getItem(THEME_KEY); } catch (_) { /* storage off */ }
    const current = applyTheme(win, doc, saved);
    if (!select) return;
    const group = (label, list) => `<optgroup label="${label}">` +
      list.map(t => `<option value="${t[0]}">${t[1]}${t[8] ? "" : " (light)"}</option>`).join("") + "</optgroup>";
    select.innerHTML = group("Orbit", THEMES.slice(0, 6)) + group("Omarchy", THEMES.slice(6));
    select.value = current;
    select.addEventListener("change", () => {
      const id = applyTheme(win, doc, select.value);
      try { win.localStorage.setItem(THEME_KEY, id); } catch (_) { /* storage off: this run only */ }
    });
  }

  // Forge's panel is narrow, so the section tabs wrap and the sticky top bar grows. Its height goes
  // to --topbar-h, which styles.css uses so a jump to a section is not hidden under the bar.
  function trackTopbar(win, doc) {
    const bar = doc.querySelector(".topbar");
    if (!bar || typeof win.ResizeObserver !== "function") return false;
    new win.ResizeObserver(() => doc.documentElement.style.setProperty("--topbar-h", bar.offsetHeight + "px")).observe(bar);
    return true;
  }

  const api = { VERSION, FORGE_TOKENS, THEMES, contrast, themeTokens, trackTopbar, detectHost, resultMessage, connectToForge, followForgeTheme };
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  if (typeof document !== "undefined" && root.location) {
    const host = detectHost(document, root.location.search, root.location);
    document.documentElement.setAttribute("data-host", host);
    root.MBSine = { version: VERSION, host };
    if (host === "forge") {
      followForgeTheme(root, document);
      connectToForge(root, document);
      const track = () => trackTopbar(root, document);
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", track, { once: true });
      else track();
    }
    if (host === "app") {
      applyTheme(root, document, (() => { try { return root.localStorage.getItem(THEME_KEY); } catch (_) { return null; } })());
      const pick = () => themePicker(root, document);
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", pick, { once: true });
      else pick();
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
