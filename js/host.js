/*
 * host.js — tells Sine where it is running and talks to MB Forge when Sine is inside it.
 *
 * Loaded in <head>, before the page is drawn, so the Forge look applies without a flash.
 *   Standalone (GitHub Pages, installed web app, single-file build): nothing changes.
 *   In MB Forge: <html data-host="forge"> (set by tools/build-forge.js, or ?host=forge when testing).
 *     - styles.css switches to Forge's graphite theme
 *     - app.js skips the service worker (Forge ships the files itself)
 *     - when Sine sits in a frame of a Forge page of the same origin, it posts messages to it:
 *         { source: "mb-sine", type: "ready",  version }
 *         { source: "mb-sine", type: "result", version, label, machine, text, note, created }
 *       Sine never acts on messages sent to it. See docs/FORGE.md.
 */
(function (root) {
  "use strict";

  const VERSION = "1.1.0";
  const HOSTS = new Set(["web", "forge"]);

  function detectHost(doc, search) {
    const preset = doc.documentElement.getAttribute("data-host");
    if (HOSTS.has(preset)) return preset;
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

  const api = { VERSION, detectHost, resultMessage, connectToForge };
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  if (typeof document !== "undefined" && root.location) {
    const host = detectHost(document, root.location.search);
    document.documentElement.setAttribute("data-host", host);
    root.MBSine = { version: VERSION, host };
    if (host === "forge") connectToForge(root, document);
  }
})(typeof window !== "undefined" ? window : globalThis);
