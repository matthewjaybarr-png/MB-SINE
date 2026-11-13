(function attachMBCalculatorData(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.MBData = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createData() {
  const LEVEL_INDEX = { conservative: 0, standard: 1, upper: 2 };

  const provenance = {
    revision: "2026-08-17",
    baseline: {
      id: "mb-baseline-v1",
      label: "MB baseline v1",
      note: "Conservative non-tool-specific starting assumptions. Verify against the exact tool manufacturer's data before cutting.",
    },
    classification: {
      label: "Sandvik Coromant workpiece material groups",
      url: "https://www.sandvik.coromant.com/en-us/knowledge/materials/workpiece-materials",
    },
    nptSmall: {
      label: "OSG A-Pipe/pipe-tap published drill sizes",
      url: "https://osgtool.com/threading/style/spiral-flute/16590/",
    },
    nptLarge: {
      label: "Large NPT reference values—verify with the selected tap manufacturer",
      url: "https://osgtool.com/1311001/",
    },
  };

  const materials = [
    {
      id: "ductile-65-45-12",
      name: "Ductile Iron, Grade 65-45-12, ASTM A536",
      isoGroup: "K",
      desc: "Primary shop nodular/ductile iron.",
      sfm: {
        drillHss: [60, 75, 90], drillCarbide: [220, 280, 350], endmillCarbide: [250, 325, 400],
        indexableMill: [325, 450, 575], turnCarbide: [300, 425, 550], boreCarbide: [260, 375, 475],
        grooveCarbide: [225, 325, 425], tapHss: [15, 25, 35], tapCarbide: [35, 55, 75],
      },
      feed: { hssDrillFactor: 0.010, carbideDrillFactor: 0.021, endmillFactor: 0.018, indexableFactor: 0.016, turnFactor: 0.0075 },
    },
    {
      id: "gray-iron-class-30",
      name: "Gray Iron, Class 30, ASTM A48",
      isoGroup: "K",
      desc: "Free-machining gray cast iron.",
      sfm: {
        drillHss: [70, 90, 110], drillCarbide: [275, 350, 450], endmillCarbide: [325, 450, 600],
        indexableMill: [400, 575, 750], turnCarbide: [375, 525, 700], boreCarbide: [325, 475, 625],
        grooveCarbide: [275, 400, 525], tapHss: [20, 35, 50], tapCarbide: [45, 70, 95],
      },
      feed: { hssDrillFactor: 0.011, carbideDrillFactor: 0.022, endmillFactor: 0.020, indexableFactor: 0.018, turnFactor: 0.0080 },
    },
    {
      id: "cast-iron-generic",
      name: "Generic Cast Iron",
      isoGroup: "K",
      desc: "Fallback when the cast-iron grade is not known.",
      sfm: {
        drillHss: [55, 75, 95], drillCarbide: [200, 300, 400], endmillCarbide: [250, 375, 500],
        indexableMill: [325, 475, 625], turnCarbide: [300, 450, 600], boreCarbide: [260, 400, 525],
        grooveCarbide: [225, 350, 475], tapHss: [15, 30, 45], tapCarbide: [35, 60, 85],
      },
      feed: { hssDrillFactor: 0.010, carbideDrillFactor: 0.020, endmillFactor: 0.018, indexableFactor: 0.016, turnFactor: 0.0075 },
    },
    {
      id: "adi-200-155-1",
      name: "Austempered Ductile Iron, ASTM A897, ADI 200/155/1",
      isoGroup: "K",
      desc: "Harder, abrasive ADI with substantially reduced machinability.",
      sfm: {
        drillHss: [20, 30, 40], drillCarbide: [80, 125, 175], endmillCarbide: [90, 140, 200],
        indexableMill: [110, 170, 230], turnCarbide: [90, 145, 210], boreCarbide: [75, 125, 175],
        grooveCarbide: [65, 105, 150], tapHss: [6, 10, 15], tapCarbide: [12, 20, 30],
      },
      feed: { hssDrillFactor: 0.007, carbideDrillFactor: 0.014, endmillFactor: 0.010, indexableFactor: 0.009, turnFactor: 0.0055 },
    },
    {
      id: "cd4mcun",
      name: "Cast Stainless Steel, CD4MCuN, ASTM A890",
      isoGroup: "M",
      desc: "Duplex cast stainless; heat- and work-hardening sensitive.",
      sfm: {
        drillHss: [18, 25, 35], drillCarbide: [65, 95, 135], endmillCarbide: [75, 115, 160],
        indexableMill: [85, 130, 180], turnCarbide: [70, 110, 155], boreCarbide: [60, 95, 135],
        grooveCarbide: [50, 80, 115], tapHss: [6, 12, 18], tapCarbide: [12, 22, 35],
      },
      feed: { hssDrillFactor: 0.006, carbideDrillFactor: 0.013, endmillFactor: 0.009, indexableFactor: 0.008, turnFactor: 0.0055 },
    },
    {
      id: "sg70a-t6",
      name: "Aluminum Casting, ASTM B26 SG70A-T6 / SAE 323",
      isoGroup: "N",
      desc: "Primary shop aluminum casting alloy.",
      sfm: {
        drillHss: [180, 250, 350], drillCarbide: [500, 750, 1000], endmillCarbide: [600, 900, 1200],
        indexableMill: [700, 1050, 1400], turnCarbide: [600, 900, 1200], boreCarbide: [550, 825, 1100],
        grooveCarbide: [450, 700, 950], tapHss: [40, 70, 100], tapCarbide: [80, 130, 180],
      },
      feed: { hssDrillFactor: 0.012, carbideDrillFactor: 0.024, endmillFactor: 0.020, indexableFactor: 0.020, turnFactor: 0.0090 },
    },
    {
      id: "steel-generic",
      name: "Generic Steel",
      isoGroup: "P",
      desc: "Fallback for an unidentified low/alloy steel.",
      sfm: {
        drillHss: [45, 65, 85], drillCarbide: [140, 210, 300], endmillCarbide: [160, 240, 340],
        indexableMill: [220, 325, 450], turnCarbide: [200, 300, 425], boreCarbide: [175, 270, 375],
        grooveCarbide: [150, 225, 325], tapHss: [15, 25, 40], tapCarbide: [30, 50, 75],
      },
      feed: { hssDrillFactor: 0.008, carbideDrillFactor: 0.018, endmillFactor: 0.014, indexableFactor: 0.013, turnFactor: 0.0065 },
    },
    {
      id: "stainless-generic",
      name: "Generic Stainless Steel",
      isoGroup: "M",
      desc: "Fallback for an unidentified stainless grade.",
      sfm: {
        drillHss: [18, 25, 35], drillCarbide: [60, 90, 130], endmillCarbide: [70, 110, 160],
        indexableMill: [80, 125, 180], turnCarbide: [70, 105, 155], boreCarbide: [60, 90, 135],
        grooveCarbide: [50, 75, 110], tapHss: [6, 12, 20], tapCarbide: [12, 22, 35],
      },
      feed: { hssDrillFactor: 0.006, carbideDrillFactor: 0.014, endmillFactor: 0.010, indexableFactor: 0.009, turnFactor: 0.0055 },
    },
    {
      id: "aluminum-generic",
      name: "Generic Aluminum",
      isoGroup: "N",
      desc: "Fallback for an unidentified machinable aluminum alloy.",
      sfm: {
        drillHss: [180, 275, 375], drillCarbide: [550, 800, 1100], endmillCarbide: [650, 950, 1300],
        indexableMill: [750, 1100, 1500], turnCarbide: [650, 950, 1300], boreCarbide: [575, 850, 1150],
        grooveCarbide: [475, 725, 1000], tapHss: [45, 75, 110], tapCarbide: [90, 140, 200],
      },
      feed: { hssDrillFactor: 0.012, carbideDrillFactor: 0.024, endmillFactor: 0.020, indexableFactor: 0.020, turnFactor: 0.0090 },
    },
  ];

  const threads = {
    UNC: [
      {thread:"#4-40",major:0.112,pitch:40,tap:"#43",tapDec:0.0890},
      {thread:"#6-32",major:0.138,pitch:32,tap:"#36",tapDec:0.1065},
      {thread:"#8-32",major:0.164,pitch:32,tap:"#29",tapDec:0.1360},
      {thread:"#10-24",major:0.190,pitch:24,tap:"#25",tapDec:0.1495},
      {thread:"#12-24",major:0.216,pitch:24,tap:"#16",tapDec:0.1770},
      {thread:"1/4-20",major:0.250,pitch:20,tap:"#7",tapDec:0.2010},
      {thread:"5/16-18",major:0.3125,pitch:18,tap:"F",tapDec:0.2570},
      {thread:"3/8-16",major:0.375,pitch:16,tap:"5/16",tapDec:0.3125},
      {thread:"7/16-14",major:0.4375,pitch:14,tap:"U",tapDec:0.368},
      {thread:"1/2-13",major:0.500,pitch:13,tap:"27/64",tapDec:0.421875},
      {thread:"9/16-12",major:0.5625,pitch:12,tap:"31/64",tapDec:0.484375},
      {thread:"5/8-11",major:0.625,pitch:11,tap:"17/32",tapDec:0.53125},
      {thread:"3/4-10",major:0.750,pitch:10,tap:"21/32",tapDec:0.65625},
      {thread:"7/8-9",major:0.875,pitch:9,tap:"49/64",tapDec:0.765625},
      {thread:"1-8",major:1.000,pitch:8,tap:"7/8",tapDec:0.8750},
    ],
    UNF: [
      {thread:"#4-48",major:0.112,pitch:48,tap:"#42",tapDec:0.0935},
      {thread:"#6-40",major:0.138,pitch:40,tap:"#33",tapDec:0.1130},
      {thread:"#8-36",major:0.164,pitch:36,tap:"#29",tapDec:0.1360},
      {thread:"#10-32",major:0.190,pitch:32,tap:"#21",tapDec:0.1590},
      {thread:"#12-28",major:0.216,pitch:28,tap:"#14",tapDec:0.1820},
      {thread:"1/4-28",major:0.250,pitch:28,tap:"#3",tapDec:0.2130},
      {thread:"5/16-24",major:0.3125,pitch:24,tap:"I",tapDec:0.2720},
      {thread:"3/8-24",major:0.375,pitch:24,tap:"Q",tapDec:0.3320},
      {thread:"7/16-20",major:0.4375,pitch:20,tap:"25/64",tapDec:0.390625},
      {thread:"1/2-20",major:0.500,pitch:20,tap:"29/64",tapDec:0.453125},
      {thread:"9/16-18",major:0.5625,pitch:18,tap:"33/64",tapDec:0.515625},
      {thread:"5/8-18",major:0.625,pitch:18,tap:"37/64",tapDec:0.578125},
      {thread:"3/4-16",major:0.750,pitch:16,tap:"11/16",tapDec:0.6875},
      {thread:"7/8-14",major:0.875,pitch:14,tap:"13/16",tapDec:0.8125},
      {thread:"1-12",major:1.000,pitch:12,tap:"59/64",tapDec:0.921875},
    ],
    NPT: [
      {thread:"1/16-27 NPT",size:"1/16",major:0.3125,pitch:27,tap:"C",tapDec:0.2420,tapConfidence:"published"},
      {thread:"1/8-27 NPT",size:"1/8",major:0.405,pitch:27,tap:"R",tapDec:0.3390,tapConfidence:"published"},
      {thread:"1/4-18 NPT",size:"1/4",major:0.540,pitch:18,tap:"7/16",tapDec:0.4375,tapConfidence:"published"},
      {thread:"3/8-18 NPT",size:"3/8",major:0.675,pitch:18,tap:"37/64",tapDec:0.578125,tapConfidence:"published"},
      {thread:"1/2-14 NPT",size:"1/2",major:0.840,pitch:14,tap:"23/32",tapDec:0.71875,tapConfidence:"published"},
      {thread:"3/4-14 NPT",size:"3/4",major:1.050,pitch:14,tap:"59/64",tapDec:0.921875,tapConfidence:"published"},
      {thread:"1-11.5 NPT",size:"1",major:1.315,pitch:11.5,tap:"1 5/32",tapDec:1.15625,tapConfidence:"published"},
      {thread:"1 1/4-11.5 NPT",size:"1 1/4",major:1.660,pitch:11.5,tap:"1 31/64",tapDec:1.484375,tapConfidence:"reference"},
      {thread:"1 1/2-11.5 NPT",size:"1 1/2",major:1.900,pitch:11.5,tap:"1 47/64",tapDec:1.734375,tapConfidence:"reference"},
      {thread:"2-11.5 NPT",size:"2",major:2.375,pitch:11.5,tap:"2 3/16",tapDec:2.1875,tapConfidence:"published"},
      {thread:"2 1/2-8 NPT",size:"2 1/2",major:2.875,pitch:8,tap:"2 5/8",tapDec:2.625,tapConfidence:"reference"},
      {thread:"3-8 NPT",size:"3",major:3.500,pitch:8,tap:"3 1/4",tapDec:3.25,tapConfidence:"reference"},
      {thread:"3 1/2-8 NPT",size:"3 1/2",major:4.000,pitch:8,tap:"3 3/4",tapDec:3.75,tapConfidence:"reference"},
      {thread:"4-8 NPT",size:"4",major:4.500,pitch:8,tap:"4 1/4",tapDec:4.25,tapConfidence:"reference"},
    ],
    METRIC: [
      {thread:"M3 × 0.5",major:3,pitch:0.5,tap:"2.5 mm",tapDec:2.5/25.4},
      {thread:"M4 × 0.7",major:4,pitch:0.7,tap:"3.3 mm",tapDec:3.3/25.4},
      {thread:"M5 × 0.8",major:5,pitch:0.8,tap:"4.2 mm",tapDec:4.2/25.4},
      {thread:"M6 × 1.0",major:6,pitch:1.0,tap:"5.0 mm",tapDec:5/25.4},
      {thread:"M8 × 1.25",major:8,pitch:1.25,tap:"6.8 mm",tapDec:6.8/25.4},
      {thread:"M10 × 1.5",major:10,pitch:1.5,tap:"8.5 mm",tapDec:8.5/25.4},
      {thread:"M12 × 1.75",major:12,pitch:1.75,tap:"10.2 mm",tapDec:10.2/25.4},
      {thread:"M14 × 2.0",major:14,pitch:2.0,tap:"12.0 mm",tapDec:12/25.4},
      {thread:"M16 × 2.0",major:16,pitch:2.0,tap:"14.0 mm",tapDec:14/25.4},
      {thread:"M18 × 2.5",major:18,pitch:2.5,tap:"15.5 mm",tapDec:15.5/25.4},
      {thread:"M20 × 2.5",major:20,pitch:2.5,tap:"17.5 mm",tapDec:17.5/25.4},
      {thread:"M24 × 3.0",major:24,pitch:3.0,tap:"21.0 mm",tapDec:21/25.4},
      {thread:"M30 × 3.5",major:30,pitch:3.5,tap:"26.5 mm",tapDec:26.5/25.4},
    ],
  };

  const nptPitchMap = Object.fromEntries(threads.NPT.map(thread => [thread.size, thread.pitch]));

  const numberDrills = [
    ["#80",0.0135],["#79",0.0145],["#78",0.0160],["#77",0.0180],["#76",0.0200],["#75",0.0210],["#74",0.0225],["#73",0.0240],["#72",0.0250],["#71",0.0260],["#70",0.0280],["#69",0.0292],["#68",0.0310],["#67",0.0320],["#66",0.0330],["#65",0.0350],["#64",0.0360],["#63",0.0370],["#62",0.0380],["#61",0.0390],["#60",0.0400],["#59",0.0410],["#58",0.0420],["#57",0.0430],["#56",0.0465],["#55",0.0520],["#54",0.0550],["#53",0.0595],["#52",0.0635],["#51",0.0670],["#50",0.0700],["#49",0.0730],["#48",0.0760],["#47",0.0785],["#46",0.0810],["#45",0.0820],["#44",0.0860],["#43",0.0890],["#42",0.0935],["#41",0.0960],["#40",0.0980],["#39",0.0995],["#38",0.1015],["#37",0.1040],["#36",0.1065],["#35",0.1100],["#34",0.1110],["#33",0.1130],["#32",0.1160],["#31",0.1200],["#30",0.1285],["#29",0.1360],["#28",0.1405],["#27",0.1440],["#26",0.1470],["#25",0.1495],["#24",0.1520],["#23",0.1540],["#22",0.1570],["#21",0.1590],["#20",0.1610],["#19",0.1660],["#18",0.1695],["#17",0.1730],["#16",0.1770],["#15",0.1800],["#14",0.1820],["#13",0.1850],["#12",0.1890],["#11",0.1910],["#10",0.1935],["#9",0.1960],["#8",0.1990],["#7",0.2010],["#6",0.2040],["#5",0.2055],["#4",0.2090],["#3",0.2130],["#2",0.2210],["#1",0.2280]
  ];

  const letterDrills = [
    ["A",0.2340],["B",0.2380],["C",0.2420],["D",0.2460],["E",0.2500],["F",0.2570],["G",0.2610],["H",0.2660],["I",0.2720],["J",0.2770],["K",0.2810],["L",0.2900],["M",0.2950],["N",0.3020],["O",0.3160],["P",0.3230],["Q",0.3320],["R",0.3390],["S",0.3480],["T",0.3580],["U",0.3680],["V",0.3770],["W",0.3860],["X",0.3970],["Y",0.4040],["Z",0.4130]
  ];

  const metricDrills = [1,1.5,2,2.5,3,3.2,3.3,3.5,4,4.1,4.2,4.5,4.8,5,5.1,5.5,6,6.2,6.5,6.8,7,7.5,8,8.5,9,9.5,10,10.2,10.5,11,11.5,12,12.5,13,14,15,15.5,16,17.5,18,19,20,21,22,24,25,26.5,28,30]
    .map(mm => [`${mm} mm`, mm / 25.4]);

  function selectRange(range, level = "standard") {
    if (!Array.isArray(range) || range.length !== 3) throw new RangeError("Expected a low/standard/high range.");
    return range[LEVEL_INDEX[level] ?? LEVEL_INDEX.standard];
  }

  function materialProfile(material, operation, level = "standard") {
    if (!material || !material.sfm || !material.sfm[operation]) {
      throw new RangeError(`No material profile exists for ${operation}.`);
    }
    const range = material.sfm[operation];
    return {
      operation,
      range: [...range],
      sfm: selectRange(range, level),
      level,
      source: provenance.baseline,
    };
  }

  return { materials, threads, nptPitchMap, numberDrills, letterDrills, metricDrills, provenance, selectRange, materialProfile };
});
