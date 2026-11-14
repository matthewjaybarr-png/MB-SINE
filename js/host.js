/*
 * host.js — tells Sine where it is running and talks to MB Forge when Sine is inside it.
 *
 * Loaded in <head>, before the page is drawn, so the Forge look applies without a flash.
 *   Standalone (GitHub Pages, installed web app, single-file build): nothing changes.
 *   In the Windows app (Tauri): data-host="app"; app.js skips the service worker and opens outside links in the browser.
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

  // Forge's panel is narrow, so the section tabs wrap and the sticky top bar grows. Its height goes
  // to --topbar-h, which styles.css uses so a jump to a section is not hidden under the bar.
  function trackTopbar(win, doc) {
    const bar = doc.querySelector(".topbar");
    if (!bar || typeof win.ResizeObserver !== "function") return false;
    new win.ResizeObserver(() => doc.documentElement.style.setProperty("--topbar-h", bar.offsetHeight + "px")).observe(bar);
    return true;
  }

  const api = { VERSION, FORGE_TOKENS, trackTopbar, detectHost, resultMessage, connectToForge, followForgeTheme };
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
  }
})(typeof window !== "undefined" ? window : globalThis);
