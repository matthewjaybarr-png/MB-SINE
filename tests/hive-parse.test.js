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

test("tap threads read the shop's ways of writing them", () => {
  const cases = [
    ['3/8"-16 H5 TAP - SS', "3/8-16", "inch", 0.375, 16],
    ["10-24 NC RH FORM TAP", "#10-24", "inch", 0.19, 24],
    ["1-14 RIGID TAP", "1-14", "inch", 1, 14],
    ["1-1/8 - 12 EXT BOT TAP", "1 1/8-12", "inch", 1.125, 12],
    ["1.8750-12 TAP", "1.875-12", "inch", 1.875, 12],
    ["3/4'-14 NPT TAP", "3/4-14 NPT", "npt", 0.75, 14],
    ['1/2" NPT TAP', "1/2 NPT", "npt", 0.5, undefined],
    ['1 - 1/4 ( 1.250" ) EXT NPT TAP', "1 1/4 NPT", "npt", 1.25, undefined],
    ["1.0-11.5 EXTENTED N.P.T. TAP", "1-11.5 NPT", "npt", 1, 11.5],
    ["M6 X 1MM METRIC TAP", "M6 × 1", "metric", 6, 1],
    ["12 X 1.75 MM EXT. BOT TAP", "M12 × 1.75", "metric", 12, 1.75],
  ];
  for (const [desc, thread, std, major, pitch] of cases) {
    const t = p(desc);
    assert.deepEqual([t.thread, t.std, t.major, t.pitch], [thread, std, major, pitch], desc);
  }
  assert.equal(p("3/8-16 RIGID FORM TAP").form, true);
  assert.equal(p("3/8-16 BOTTOM TAP").form, undefined);
});

test("the toolbook's SFM/FPT line is the speed and feed the shop runs", () => {
  const t = p('3/8"-16 H5 TAP - SS', { detail_lines: ["HOLDER: C50-77TR4C", "SFM/FPT: 44.18 / .0625"] });
  assert.deepEqual([t.sfm, t.fpt], [44.18, 0.0625]);
  assert.equal(p("1/2 DRILL", { detail_lines: ["SFM/FPT:  / "] }).sfm, undefined);
});

test("chamfer mills keep angle and insert count; proven S/F comes from the notes", () => {
  const t = p("2.5 X 45° SNDVK R-M", { inserts: 5, extra_notes: ["S = 1053  F = 73.7"] });
  assert.deepEqual([t.kind, t.dia, t.angle, t.teeth, t.rpm, t.ipm], ["chamfer", 2.5, 45, 5, 1053, 73.7]);
});

test("removed tools are dropped and drills never get a tooth count", () => {
  assert.equal(parseHiveTool({ tool_id: 2, description: "1/2 DRILL", removed: true }, "T"), null);
  assert.equal(p("1/2 DRILL", { inserts: 2 }).teeth, undefined);
  assert.equal(p('1/2" CHIP SURFER ENDMILL', { inserts: 1 }).teeth, undefined);
  assert.equal(p('3.0" FACE MILL', { inserts: 6 }).teeth, 6);
});
