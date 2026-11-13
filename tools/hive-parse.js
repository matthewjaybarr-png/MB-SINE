/*
 * hive-parse.js — turn one MB Toolbook tool record (from the Hive toolbooks) into what Sine's
 * Shop Tools card needs: kind, cutting diameter (inch), thread, teeth, maker, part lines, proven S/F.
 * The toolbook descriptions are free shop text ("17/32 ( .531" ) EXT. SANDVIK 880 DRILL"), so every
 * parsed value is a suggestion the card shows next to the original text, never a silent input.
 */
"use strict";

// Most specific first: a tap holder line is still a tap; "X 45°" without DRILL is a chamfer tool.
const KINDS = [
  ["probe", /\bPROBE\b/],
  ["threadmill", /\b(THD|THRD|THREAD)\.?\s*MILL|\bTHD\s*ML\b/],
  ["tap", /\bTAP\b(?!\s*DR)/],
  ["spot", /\bSPOT|\bCNTR\.?\s*DR|\bCENTER\s*-?DR|CENTERDR|\bC['-]?\s*DR(I)?L/],
  ["drill", /DRILL|\bDRL\b|\bSUMO\s*DR|GOLD\s*TWIST|\bGLD\s*TWST|GEN3SYS/],
  ["ream", /\bREAM/],
  ["bore", /\b[RF]\s*-\s*B\b|\bB[-.\s]?BAR\b|\bBOR(E|ING|INB)\b|\bBAR\b/],
  ["chamfer", /CHAMF|\bCHF\b|\bCSK|C'?SINK|COUNTERSINK|\bX\s*\d{2,3}\s*°|\bX\s*(30|45|60|82|90|100)\b(?!\s*")/],
  ["mill", /MILL|\bEM\b|\bE\/M\b|\b(R|F|HG|ED|FIN|RGH)\s*-\s*M\b|\bHOG|\bFACE\b|\bSHELL\b|\bFM\b|CUTTER|\bGRV\s*CT|\bSAW\b|TURBO|\bFLT\b|FLUTE|CHIP\s*SURFER|CENTR?E?\s*-?DEX|K\s*-?\s*TOOL/],
];

const MAKERS = [
  [/SANDVIK|SNDVK|SNDVIK|\bSDVK\b|COROMANT/, "Sandvik Coromant"],
  [/KENNAMETAL|\bKMT\b|\bKENNA\b/, "Kennametal"],
  [/INGERSOLL|INGERSOL|INGRSL|INGRSOL/, "Ingersoll"],
  [/\bSECO\b/, "Seco"],
  [/ALLIED|\bALLD\b|\bAMEC\b/, "Allied Machine"],
  [/CERATIZIT|CRTZT|\bCTZT\b/, "Ceratizit"],
  [/ISCAR|\bSUMO/, "Iscar"],
  [/SUMITOMO|SUMI\b/, "Sumitomo"],
  [/WALTER/, "Walter"],
  [/\bOSG\b/, "OSG"],
  [/EMUGE/, "Emuge"],
  [/GUHRING|GÜHRING/, "Guhring"],
  [/\bYG-?1\b/, "YG-1"],
  [/HARVEY/, "Harvey Tool"],
  [/KYOCERA/, "Kyocera"],
  [/MITSUBISHI|\bMITSU\b/, "Mitsubishi"],
  [/TUNGALOY/, "Tungaloy"],
  [/WIDIA|HANITA/, "Widia"],
  [/NACHI/, "Nachi"],
  [/DORMER/, "Dormer"],
  [/VARGUS|VARDEX/, "Vargus"],
  [/\bGRAF\b|GRAFLEX/, "Graflex"],
  [/KAISER|\bBIG\b/, "BIG Kaiser"],
  [/\bHELICAL\b/, "Helical"],
  [/\bGARR\b/, "Garr"],
  [/\bMA\s*FORD\b|\bMAFORD\b/, "M.A. Ford"],
  [/\bNIAGARA\b/, "Niagara"],
  [/\bKORLOY\b/, "Korloy"],
  [/\bPRAMET\b/, "Pramet"],
  [/\bTITEX\b/, "Titex"],
];

const num = s => {
  const m = /^(\d+)\s+(\d+)\/(\d+)$/.exec(s) || /^(\d+)\/(\d+)$/.exec(s);
  if (m && m.length === 4) return +m[1] + m[2] / m[3];
  if (m) return m[1] / m[2];
  return parseFloat(s);
};

/** Cutting diameter in inches, or null. Tries "( .437" )" first, then the leading size. */
function diameterOf(text, kind) {
  const paren = /\(\s*(\d*\.\d+)\s*"?\s*\)/.exec(text);
  if (paren && kind !== "tap") return +paren[1];
  if (kind === "tap" || kind === "probe") return null;
  const mm = /^(\d+(?:\.\d+)?)\s*"?\s*MM\b/.exec(text);
  if (mm) return +mm[1] / 25.4;
  const lead = /^(\d+\s+\d+\/\d+|\d+\/\d+|\d*\.\d+|\d+)\s*(?:"|''|IN\b)?/.exec(text);
  if (!lead) {
    // letter/number drills: "U - .368 HSS DRILL", "#39 .100" EXTENDED DRILL"
    const any = /(?:^|[\s(-])(\d*\.\d{2,4})\s*"?(?=[\s)]|$)/.exec(text);
    return any ? +any[1] : null;
  }
  const value = num(lead[1]);
  // a bare whole number like "387" is a tool id or machine, not a size
  if (!Number.isFinite(value) || value <= 0 || value > 40 || (/^\d+$/.test(lead[1]) && !/"/.test(lead[0]) && value > 12)) return null;
  // "5.558 .218 CRBD DRL": a drill over 3" with an inch decimal after it is in mm
  const after = kind === "drill" && value > 3 && /^\S+\s+(\.\d{3,4})\b/.exec(text);
  return after ? +after[1] : value;
}

/** "9/16-12", "#10-24", "M10 X 1.5", "3/4-14 NPT" -> {thread, npt} or null. */
function threadOf(text) {
  const metric = /\bM(\d+(?:\.\d+)?)\s*[X×]\s*(\d+(?:\.\d+)?)/.exec(text);
  if (metric) return { thread: `M${metric[1]} × ${metric[2]}`, npt: false };
  const inch = /(#\d+|\d+\s+\d+\/\d+|\d+\/\d+|\d+)\s*-\s*(\d+(?:\.\d+)?)\b/.exec(text);
  if (!inch) return null;
  const npt = /N\.?P\.?T/.test(text);
  return { thread: `${inch[1].replace(/\s+/, " ")}-${inch[2]}${npt ? " NPT" : ""}`, npt };
}

const clean = s => String(s || "").replace(/\s+/g, " ").trim();

/** One toolbook tool -> Sine shop tool, or null for removed tools. drillSizes = {"#21": .159, "U": .368}. */
function parseHiveTool(tool, book, drillSizes = {}) {
  if (tool.removed) return null;
  const desc = clean(tool.description);
  // shop shorthand: 7\16 means 7/16
  const up = desc.toUpperCase().replace(/(\d)\\(\d)/g, "$1/$2");
  const lines = (tool.detail_lines || []).map(clean).filter(Boolean);
  let kind = (KINDS.find(([, re]) => re.test(up)) || ["other"])[0];
  const all = (up + " " + lines.join(" ").toUpperCase());
  const maker = (MAKERS.find(([re]) => re.test(up)) || MAKERS.find(([re]) => re.test(all)) || [null, ""])[1];
  const sf = (tool.extra_notes || []).map(n => /\bS\s*=\s*(\d+(?:\.\d+)?)\s*,?\s*F\s*=\s*(\d+(?:\.\d+)?)/i.exec(n)).find(Boolean);
  const angle = /X\s*(\d{2,3})\s*°/.exec(up);
  const machines = Object.entries(tool.machines || {}).filter(([, m]) => m && m.built !== false).map(([k]) => k);
  // "3.0 X 90° SHOULDER MILL": X NN° is the angle per side, so 90° is a square shoulder, not a chamfer
  if (kind === "chamfer" && angle && +angle[1] === 90 && !/CHAMF|\bCHF\b|CSK|C'?SINK/.test(up)) kind = "mill";
  const out = { book, id: String(tool.tool_id), desc, kind, maker, lines, machines };
  let dia = diameterOf(up, kind);
  if (!dia && kind === "drill") {
    // "#21 HSS DRILL", "LETTER 'F' DRILL": look up the number/letter drill chart
    const name = /^(#\d+)\b/.exec(up) || /LETTER\s*'?([A-Z])'?/.exec(up) || /^([A-Z])\s*-/.exec(up);
    if (name && drillSizes[name[1]]) dia = drillSizes[name[1]];
  }
  if (dia) out.dia = Math.round(dia * 10000) / 10000;
  if (kind === "tap" || kind === "threadmill") {
    const t = threadOf(up);
    if (t) out.thread = t.thread;
  }
  // inserts = cutting edges on mills; on drills and bores the count is not the feed multiplier
  if (["mill", "chamfer", "threadmill"].includes(kind) && Number.isInteger(tool.inserts) && tool.inserts > 0) out.teeth = tool.inserts;
  if (angle && kind === "chamfer") out.angle = +angle[1]; // per side: 45° = 90° included
  if (sf) { out.rpm = +sf[1]; out.ipm = +sf[2]; }
  if (tool.coolant) out.coolant = clean(tool.coolant);
  return out;
}

const api = { parseHiveTool, diameterOf, threadOf };
if (typeof module === "object" && module.exports) module.exports = api;
