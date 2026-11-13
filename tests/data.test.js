const test = require('node:test');
const assert = require('node:assert/strict');
const data = require('../js/data.js');

const requiredProfiles = [
  'drillHss', 'drillCarbide', 'endmillCarbide', 'indexableMill',
  'turnCarbide', 'boreCarbide', 'grooveCarbide', 'tapHss', 'tapCarbide',
];

test('every shop material has ordered operation-specific SFM ranges', () => {
  for (const material of data.materials) {
    assert.match(material.isoGroup, /^[PKMNSH]$/);
    for (const key of requiredProfiles) {
      const range = material.sfm[key];
      assert.equal(range.length, 3, `${material.id}.${key}`);
      assert.ok(range[0] > 0 && range[0] <= range[1] && range[1] <= range[2], `${material.id}.${key}`);
    }
    assert.notDeepEqual(material.sfm.drillHss, material.sfm.indexableMill);
  }
});

test('material profile selection is explicit and deterministic', () => {
  const ductile = data.materials.find(material => material.id === 'ductile-65-45-12');
  assert.equal(data.materialProfile(ductile, 'drillHss', 'conservative').sfm, 60);
  assert.equal(data.materialProfile(ductile, 'drillCarbide', 'standard').sfm, 280);
  assert.equal(data.materialProfile(ductile, 'indexableMill', 'upper').sfm, 575);
});

test('thread data covers small machine screws and larger shop NPT work', () => {
  assert.equal(data.threads.UNC[0].thread, '#4-40');
  assert.equal(data.threads.UNF[0].thread, '#4-48');
  assert.ok(data.threads.METRIC.some(thread => thread.thread.startsWith('M30')));
  assert.ok(data.threads.NPT.some(thread => thread.thread === '3-8 NPT'));
  assert.ok(data.threads.NPT.some(thread => thread.thread === '4-8 NPT'));
});

test('published 2-inch NPT drill reference remains exact', () => {
  const thread = data.threads.NPT.find(item => item.thread === '2-11.5 NPT');
  assert.equal(thread.tapDec, 2.1875);
  assert.equal(thread.tapConfidence, 'published');
});

test('provenance distinguishes shop baselines from external classification', () => {
  assert.equal(data.provenance.baseline.id, 'mb-baseline-v1');
  assert.match(data.provenance.baseline.note, /manufacturer/i);
  assert.match(data.provenance.classification.url, /^https:\/\//);
});

test('every UNC, UNF and metric chart tap drill gives a 65-80% cutting-tap thread', () => {
  for (const type of ['UNC', 'UNF', 'METRIC']) {
    for (const t of data.threads[type]) {
      const pitch = type === 'METRIC' ? t.pitch / 25.4 : 1 / t.pitch;
      const major = type === 'METRIC' ? t.major / 25.4 : t.major;
      const pct = (major - t.tapDec) / (1.299038 * pitch);
      assert.ok(pct >= 0.645 && pct <= 0.805, `${t.thread} ${t.tap} = ${(pct * 100).toFixed(1)}%`);
    }
  }
});
