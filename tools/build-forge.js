#!/usr/bin/env node
/*
 * build-forge.js — the copy of Sine that MB Forge ships inside its app.
 *
 * Usage (from the repo root):
 *   node tools/build-forge.js [outDir]          default: dist/forge/sine
 *   npm run build:forge -- "../MB-Editor/ui/vendor/sine"
 *
 * Output is a folder (not one file): MB Forge's Content Security Policy is
 *   default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'
 * so every script must be its own file and nothing may come from the internet.
 * The build:
 *   - marks the page <html data-host="forge"> (Forge theme, no service worker, result messages)
 *   - drops the web-app manifest and the Google Fonts link
 *   - copies the page's own CSS, JS and icon unchanged; no calculation is touched
 *   - writes VERSION.json (version, commit, date) for Forge's About / release notes
 *   - refuses to finish if the page would break that policy (see checkForgePolicy)
 *
 * No dependencies. Node 18+.
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const ASSETS = [
  "css/styles.css",
  "js/host.js",
  "js/data.js",
  "js/core.js",
  "js/workflow.js",
  "js/app.js",
  "js/actions.js",
  "icons/mb-sine.svg"
];

function forgePage(html, stamp) {
  const replaceOnce = (pattern, replacement, label) => {
    if (!pattern.test(html)) throw new Error("Expected markup not found in index.html: " + label);
    html = html.replace(pattern, () => replacement);
  };
  replaceOnce(/<html lang="en">/i, '<html lang="en" data-host="forge">', "<html> tag");
  replaceOnce(/<link[^>]*rel="manifest"[^>]*\/?>\s*/i, "", "manifest link");
  replaceOnce(/<link[^>]*fonts\.googleapis\.com[^>]*\/?>\s*/i, "", "Google Fonts link");
  replaceOnce(/<meta charset="utf-8"\/>/i, `<meta charset="utf-8"/>\n<!-- ${stamp} -->\n<meta name="mb-forge-build" content="${stamp}"/>`, "charset meta");
  return html;
}

// Everything MB Forge's CSP would block. Returns a list of problems (empty = fine).
function checkForgePolicy(html) {
  const problems = [];
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (m[2].trim() || !/\bsrc=/i.test(m[1])) problems.push("inline script: " + m[0].slice(0, 60));
  }
  for (const m of html.matchAll(/\son[a-z]+\s*=\s*["']/gi)) problems.push("inline event handler: " + m[0].trim());
  // Things the page loads (scripts, styles, icons, images, frames). Ordinary <a href> links are not loads.
  const loads = [...html.matchAll(/\ssrc\s*=\s*["']([^"']*)/gi), ...html.matchAll(/<link\b[^>]*\shref\s*=\s*["']([^"']*)/gi)];
  for (const m of loads) if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(m[1]) && !/^data:/i.test(m[1])) problems.push("network resource: " + m[1]);
  if (/javascript:/i.test(html)) problems.push("javascript: URL");
  if (/<base\b/i.test(html)) problems.push("<base> tag");
  return problems;
}

function gitCommit() {
  try {
    return require("child_process")
      .execSync("git rev-parse --short HEAD", { cwd: root, stdio: ["ignore", "pipe", "ignore"] })
      .toString().trim() || "unknown";
  } catch (_) {
    return "unknown";
  }
}

function build(outDir) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const commit = process.env.SINE_COMMIT || gitCommit();
  const built = new Date().toISOString().slice(0, 10);
  const stamp = `Sine (MB Sine) ${pkg.version} for MB Forge. Source commit ${commit}. Built ${built}.`;

  const html = forgePage(fs.readFileSync(path.join(root, "index.html"), "utf8"), stamp);
  const problems = checkForgePolicy(html);
  if (problems.length) throw new Error("Page would break MB Forge's Content Security Policy:\n  " + problems.join("\n  "));

  fs.rmSync(outDir, { recursive: true, force: true });
  for (const rel of ASSETS) {
    const dest = path.join(outDir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(root, rel), dest);
  }
  fs.writeFileSync(path.join(outDir, "index.html"), html);
  fs.writeFileSync(path.join(outDir, "VERSION.json"),
    JSON.stringify({ name: "MB Sine", version: pkg.version, commit, built }, null, 2) + "\n");
  return { outDir, version: pkg.version, commit };
}

if (require.main === module) {
  const outDir = path.resolve(process.argv[2] || path.join(root, "dist", "forge", "sine"));
  const result = build(outDir);
  console.log(`Wrote ${result.outDir} (Sine ${result.version}, ${result.commit})`);
}

module.exports = { ASSETS, forgePage, checkForgePolicy, build };
