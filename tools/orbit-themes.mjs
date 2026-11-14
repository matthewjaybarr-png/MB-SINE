#!/usr/bin/env node
/*
 * orbit-themes.mjs — copy Orbit's theme list into js/host.js (the Windows app's theme picker).
 *
 * Usage:  node tools/orbit-themes.mjs "<Orbit>/MBKeyspace-0.25.0-windows-x64/MB Keyspace/SOURCE"
 *
 * Reads Orbit's 6 built-in palettes (src/theme.rs) and its Omarchy theme files
 * (assets/omarchy-themes/*.toml), parsed the way Orbit's src/theme_files.rs does, and rewrites the
 * block between "BEGIN ORBIT THEMES" and "END ORBIT THEMES" in js/host.js. Run it again when Orbit's
 * themes change. Each theme is Orbit's 7 values: background, surface, text, muted, accent, border, dark.
 */
import fs from "node:fs";
import path from "node:path";

const source = process.argv[2];
if (!source) { console.error("Give Orbit's SOURCE folder."); process.exit(1); }
const version = (source.match(/MBKeyspace-([\d.]+)/) || [])[1] || "unknown";
const hex = n => "#" + n.toString(16).padStart(6, "0");

const themeRs = fs.readFileSync(path.join(source, "src", "theme.rs"), "utf8");
const labels = Object.fromEntries([...themeRs.matchAll(/\("([a-z-]+)", "([^"]+)"\)/g)].map(m => [m[1], m[2]]));
const builtIn = [...themeRs.matchAll(/"([a-z-]+)" => \(\s*((?:0x[0-9a-f]{6},\s*){6})(true|false)/g)]
  .map(m => [m[1], labels[m[1]], ...m[2].match(/0x[0-9a-f]{6}/g).map(v => hex(parseInt(v, 16))), m[3] === "true"]);
const order = Object.keys(labels);
builtIn.sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));

// Orbit's theme_files.rs: luminance, contrast and the "dim colour moves toward the text" rule.
const lum = c => [16, 8, 0].map(s => ((c >> s) & 255) / 255)
  .map(s => s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4)
  .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
function readable(muted, text, background) {
  for (let i = 0; i < 8 && contrast(lum(muted), lum(background)) < 4.5; i++) {
    muted = [16, 8, 0].map(s => (Math.floor((((muted >> s) & 255) * 3 + ((text >> s) & 255)) / 4)) << s).reduce((a, b) => a + b, 0);
  }
  return muted;
}
function parseToml(id, fileText) {
  const values = {};
  let mode = null;
  for (const raw of fileText.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith("[")) continue;
    const eq = line.indexOf("=");
    const key = line.slice(0, eq).trim();
    const value = (line.slice(eq + 1).trim().match(/^"([^"]*)"/) || [])[1];
    if (eq < 0 || value === undefined) throw new Error(`${id}: bad line ${line}`);
    if (key.startsWith("hyprland_")) continue;
    if (key === "mode") { mode = value === "dark"; continue; }
    if (!/^#[0-9a-fA-F]{6}$/.test(value)) throw new Error(`${id}: ${key} is not a colour`);
    values[key] = parseInt(value.slice(1), 16);
  }
  const get = keys => keys.map(k => values[k]).find(v => v !== undefined);
  const background = values.background, text = values.foreground, accent = values.accent;
  if ([background, text, accent].includes(undefined)) throw new Error(`${id}: needs background, foreground and accent`);
  const brightness = ((background >> 16) & 255) + ((background >> 8) & 255) + (background & 255);
  return [id, id.split("-").map(w => w[0].toUpperCase() + w.slice(1)).join(" "),
    hex(background), hex(get(["lighter_background", "selection"]) ?? background), hex(text),
    hex(readable(get(["dark_foreground", "muted"]) ?? text, text, background)), hex(accent),
    hex(get(["selection", "lighter_background"]) ?? accent), mode ?? brightness < 384];
}
const dir = path.join(source, "assets", "omarchy-themes");
const omarchy = fs.readdirSync(dir).filter(f => f.endsWith(".toml")).sort()
  .map(f => parseToml(f.slice(0, -5), fs.readFileSync(path.join(dir, f), "utf8")));

const lines = [...builtIn, ...omarchy].map(t => "    " + JSON.stringify(t) + ",");
const block = `  // BEGIN ORBIT THEMES (tools/orbit-themes.mjs, from Orbit ${version}: ${builtIn.length} built in + ${omarchy.length} Omarchy)\n` +
  `  // [id, label, background, surface, text, muted, accent, border, dark]\n  const THEMES = [\n${lines.join("\n").replace(/,$/, "")}\n  ];\n  // END ORBIT THEMES`;
const hostFile = path.join(import.meta.dirname, "..", "js", "host.js");
const host = fs.readFileSync(hostFile, "utf8");
const re = /  \/\/ BEGIN ORBIT THEMES[\s\S]*?\/\/ END ORBIT THEMES/;
if (!re.test(host)) throw new Error("js/host.js has no BEGIN/END ORBIT THEMES block");
fs.writeFileSync(hostFile, host.replace(re, () => block));
console.log(`js/host.js: ${builtIn.length + omarchy.length} themes from Orbit ${version}`);
