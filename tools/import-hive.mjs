#!/usr/bin/env node
/*
 * import-hive.mjs — read the shop's Hive toolbooks (through MB Toolbook's importer) and write
 * shop/tools.js for Sine's Shop Tools card. Reads only; the toolbooks are never changed.
 *
 *   node tools/import-hive.mjs [hiveFolder] [mbToolbookFolder] [outFile]
 *
 * shop/ is gitignored: tool lists carry job, quote and part numbers, and this repo is public.
 * Only the offline/installer and Forge builds pick the file up.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const hive = path.resolve(process.argv[2] || "/run/media/matt/Coding Work/Hive");
const toolbook = path.resolve(process.argv[3] || path.join(root, "..", "MB Toolbook"));
const out = path.resolve(process.argv[4] || path.join(root, "shop", "tools.js"));

const BOOKS = [
  ["391-392", ["391-392 MASTER TOOL HIVE.xlsm"]],
  ["464-465", ["TOOLBOOKS/464 465 COMBINED TOOL BOOK.xlsx"]],
  ["467-468", ["TOOLBOOKS/467-468/MSTR TL- BLT 467.xlsx", "TOOLBOOKS/467-468/MASTER TOOL BELT 468 (2023) .xlsx"]],
  ["469-471", ["TOOLBOOKS/Tool Book 469-471.xlsx"]],
  ["476-477", ["TOOLBOOKS/OKM-MSTR-TL-HIVE_476-477.xlsx"]],
  // the file says 487-488; the machines are really 387-388 (Matt, 1.3.0)
  ["387-388", ["TOOLBOOKS/M487-488 COMBIED TOOLBOOK.xlsx"]],
  ["372", ["TOOLBOOKS/tools_372.dgn"]],
  ["459", ["TOOLBOOKS/tools_459.dgn"]],
];

const { readSource, detect, run } = await import(pathToFileURL(path.join(toolbook, "ui/lib/import/index.js")));
const { parseHiveTool } = require("./hive-parse.js");
const data = require("../js/data.js");
const drillSizes = Object.fromEntries([...data.numberDrills, ...data.letterDrills]);

const tools = [], books = [];
for (const [name, files] of BOOKS) {
  const sources = [];
  for (const f of files) sources.push(await readSource(path.basename(f), new Uint8Array(await fs.readFile(path.join(hive, f)))));
  const best = detect(sources)[0];
  if (!best || !best.score) throw new Error(`No MB Toolbook profile recognises ${files.join(", ")}`);
  const parsed = run(best.profile, sources, { name }).book.tools.map(t => parseHiveTool(t, name, drillSizes)).filter(Boolean);
  books.push({ name, count: parsed.length });
  tools.push(...parsed);
  console.log(`${name}: ${parsed.length} tools`);
}

const built = new Date().toISOString().slice(0, 10);
await fs.mkdir(path.dirname(out), { recursive: true });
await fs.writeFile(out, `/* Shop tools from the Hive toolbooks, built ${built} by tools/import-hive.mjs. Not for the public site. */\n` +
  `globalThis.MBShopTools = ${JSON.stringify({ built, books, tools })};\n`);
console.log(`Wrote ${out} (${tools.length} tools)`);
