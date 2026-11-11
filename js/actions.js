/*
 * actions.js — wires page controls to calculator functions without inline handlers.
 *
 * Markup names its action in data-click / data-change instead of onclick / onchange, e.g.
 *   <button data-click="calcMain()">          <select data-change="toggleCalcType(); updatePresetPreview()">
 *   <button data-click="setChamferAngle(30)"> <select data-change="updateSpeedBasisUI('tap')">
 * Each call is a global function name with no argument or one number / quoted-string argument.
 * Nothing is evaluated as code, so the page runs under a strict Content Security Policy
 * (script-src 'self'), which is what MB Forge uses.
 */
(function (root) {
  "use strict";

  const CALL = /^([A-Za-z_$][\w$]*)\(\s*(?:(-?\d+(?:\.\d+)?)|'([^'\\]*)'|"([^"\\]*)")?\s*\)$/;

  // "a(); b('x'); c(3)" -> [{name:"a", args:[]}, {name:"b", args:["x"]}, {name:"c", args:[3]}]
  function parseActions(text) {
    return String(text || "")
      .split(";")
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => {
        const match = CALL.exec(part);
        if (!match) throw new Error("Unsupported action: " + part);
        const args = match[2] !== undefined ? [Number(match[2])]
          : match[3] !== undefined ? [match[3]]
          : match[4] !== undefined ? [match[4]]
          : [];
        return { name: match[1], args };
      });
  }

  function runActions(text, scope) {
    for (const action of parseActions(text)) {
      const fn = scope[action.name];
      if (typeof fn !== "function") throw new Error("Unknown action: " + action.name);
      fn.apply(scope, action.args);
    }
  }

  function bindActions(doc, scope) {
    for (const type of ["click", "change"]) {
      doc.addEventListener(type, event => {
        const target = event.target instanceof Element ? event.target.closest("[data-" + type + "]") : null;
        if (!target || (type === "click" && target.disabled)) return;
        try {
          runActions(target.getAttribute("data-" + type), scope);
        } catch (error) {
          console.error(error);
        }
      });
    }
  }

  const api = { parseActions, runActions, bindActions };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.MBActions = api;
  if (typeof document !== "undefined") bindActions(document, root);
})(typeof window !== "undefined" ? window : globalThis);
