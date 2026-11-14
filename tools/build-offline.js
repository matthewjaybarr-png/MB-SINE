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
 *   - copies fonts/ (JetBrains Mono NL + OFL.txt) beside the page; without it the page falls back to Consolas
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

// The font (JetBrains Mono NL, OFL) goes in a fonts folder beside the page; styles.css names
// Forge's copy (../../../fonts), so the path is pointed at the local folder here.
const css = read("css/styles.css");
if (!css.includes("url(../../../fonts/")) throw new Error("Expected @font-face lines not found in css/styles.css");
replaceOnce(
  /<link[^>]*href="\.\/css\/styles\.css"[^>]*\/?>/i,
  "<style>\n" + safeStyle(css.replaceAll("url(../../../fonts/", "url(fonts/")) + "\n</style>",
  "stylesheet link"
);
fs.mkdirSync(path.join(path.dirname(out), "fonts"), { recursive: true });
for (const f of fs.readdirSync(path.join(root, "fonts"))) {
  fs.copyFileSync(path.join(root, "fonts", f), path.join(path.dirname(out), "fonts", f));
}

// Scripts: same order the page contract test enforces (host.js sits in <head>).
// The shop's own tool list (gitignored, from tools/import-hive.mjs) goes in before app.js when it exists.
const shopTools = path.join(root, "shop", "tools.js");
if (fs.existsSync(shopTools)) {
  replaceOnce(/<script src="\.\/js\/app\.js"><\/script>/, "<script>\n/* shop/tools.js */\n" + safeScript(fs.readFileSync(shopTools, "utf8")) + "\n</script>\n<script src=\"./js/app.js\"></script>", "app.js script (shop tools)");
}
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
