const test = require("node:test");
const assert = require("node:assert/strict");
const { parseHiveTool } = require("../tools/hive-parse.js");

const p = (description, extra = {}) => parseHiveTool({ tool_id: 1, description, ...extra }, "T", { "#21": 0.159 });

test("toolbook descriptions parse to kind, diameter, thread and maker", () => {
  const cases = [
    ['17/32 ( .531" ) EXT. SANDVIK 880 DRILL', { kind: "drill", dia: 0.531, maker: "Sandvik Coromant" }],
    ["9/16 - 12 EXT. BOT TAP", { kind: "tap", thread: "9/16-12" }],
    ["7\\16 .437 CHRM BDY ALLD DRL", { kind: "drill", dia: 0.4375, maker: "Allied Machine" }],
    ["U - .368 HSS DRILL", { kind: "drill", dia: 0.368 }],
    ["#21 HSS DRILL", { kind: "drill", dia: 0.159 }],
    ["M10 x 1.5 RIGID TAP", { kind: "tap", thread: "M10 × 1.5" }],
    ["3.965/3.965 KMT R-B", { kind: "bore", dia: 3.965, maker: "Kennametal" }],
    ["18MM (.7086) 3X GEN3SYS 60318S-100F", { kind: "drill", dia: 0.7086 }],
    ['29.0" MM 1.141" SANDVIK 880 DRILL', { kind: "drill", dia: 1.1417 }],
    ["DRL FUR 3/8 NPT", { kind: "drill" }],
  ];
  for (const [desc, want] of cases) {
    const got = p(desc);
    for (const [k, v] of Object.entries(want)) assert.equal(got[k], v, `${desc} -> ${k}`);
  }
});

test("chamfer mills keep angle and insert count; proven S/F comes from the notes", () => {
  const t = p("2.5 X 45° SNDVK R-M", { inserts: 5, extra_notes: ["S = 1053  F = 73.7"] });
  assert.deepEqual([t.kind, t.dia, t.angle, t.teeth, t.rpm, t.ipm], ["chamfer", 2.5, 45, 5, 1053, 73.7]);
});

test("removed tools are dropped and drills never get a tooth count", () => {
  assert.equal(parseHiveTool({ tool_id: 2, description: "1/2 DRILL", removed: true }, "T"), null);
  assert.equal(p("1/2 DRILL", { inserts: 2 }).teeth, undefined);
});
