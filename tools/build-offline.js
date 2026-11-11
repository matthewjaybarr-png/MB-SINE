#!/usr/bin/env node
/*
 * build-offline.js — bundle Sine (MB Sine) into ONE self-contained HTML file.
 *
 * Usage (from the repo root, or pass the repo root as the first argument):
 *   node tools/build-offline.js [repoRoot] [outFile]
 *
 * What it does:
 *   - inlines css/styles.css and js/host.js, data.js, core.js, workflow.js, app.js, actions.js (same load order as index.html)
 *   - removes the Google Fonts link and the web-app manifest link (neither works from a USB drive)
 *   - swaps the favicon for an inline data URI
 *   - leaves every calculation untouched; the result runs by double-clicking it (file://)
 *
 * No dependencies. Node 18+.
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || path.join(__dirname, ".."));
const out = path.resolve(process.argv[3] || path.join(root, "dist", "Sine.html"));
fs.mkdirSync(path.dirname(out), { recursive: true });
const read = rel => fs.readFileSync(path.join(root, rel), "utf8");

let html = read("index.html");

function replaceOnce(pattern, replacement, label) {
  if (!pattern.test(html)) throw new Error("Expected markup not found in index.html: " + label);
  html = html.replace(pattern, () => replacement);
}

// Never let inlined JS/CSS terminate its own tag.
const safeScript = js => js.replace(/<\/script/gi, "<\\/script");
const safeStyle = css => css.replace(/<\/style/gi, "<\\/style");

// Head: drop things that need a network or a web server.
replaceOnce(/<link[^>]*rel="manifest"[^>]*\/?>\s*/i, "", "manifest link");
replaceOnce(/<link[^>]*fonts\.googleapis\.com[^>]*\/?>\s*/i, "", "Google Fonts link");

const svg = read("icons/mb-sine.svg").trim();
const favicon = "data:image/svg+xml," + encodeURIComponent(svg);
replaceOnce(/<link[^>]*rel="icon"[^>]*\/?>/i, `<link href="${favicon}" rel="icon" type="image/svg+xml"/>`, "favicon link");

replaceOnce(
  /<link[^>]*href="\.\/css\/styles\.css"[^>]*\/?>/i,
  "<style>\n" + safeStyle(read("css/styles.css")) + "\n</style>",
  "stylesheet link"
);

// Scripts: same order the page contract test enforces (host.js sits in <head>).
const scripts = ["js/host.js", "js/data.js", "js/core.js", "js/workflow.js", "js/app.js", "js/actions.js"];
for (const rel of scripts) {
  const tag = new RegExp(`<script src="\\./${rel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"></script>`);
  replaceOnce(tag, "<script>\n/* " + rel + " */\n" + safeScript(read(rel)) + "\n</script>", rel);
}

// Build stamp (comment + meta only; no visible UI change).
let commit = "unknown";
try {
  commit = require("child_process")
    .execSync("git rev-parse --short HEAD", { cwd: root, stdio: ["ignore", "pipe", "ignore"] })
    .toString().trim() || "unknown";
} catch (_) { /* source snapshot without .git */ }
const stamp = `Sine (project: MB Sine) — offline single-file build. Source commit ${process.env.GR_COMMIT || commit}. Built ${new Date().toISOString().slice(0, 10)}.`;
html = html.replace("<head>", `<head>\n<!-- ${stamp} -->\n<meta name="mb-offline-build" content="${stamp}"/>`);

fs.writeFileSync(out, html);
console.log(`Wrote ${out} (${(Buffer.byteLength(html) / 1024).toFixed(1)} KB)`);
