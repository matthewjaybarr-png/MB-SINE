const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveView, splitCard, parseSaved } = require('../js/layout.js');

const pages = [
  { id: 'shopsetup', tabs: [{ id: 'limits', visible: true }, { id: 'tools', visible: false }] },
  { id: 'threads', tabs: [{ id: 'setup', visible: true }, { id: 'npt', visible: false }] },
];
const kid = s => { const [tag, cls] = s.split('|'); return { tag, cls }; };

test('hash wins over saved page', () => assert.deepEqual(resolveView('#threads', { page: 'shopsetup', tabs: {} }, pages), { page: 'threads', tab: 'setup' }));
test('unknown hash falls back to saved, then first page', () => {
  assert.equal(resolveView('#nope', { page: 'threads', tabs: {} }, pages).page, 'threads');
  assert.equal(resolveView('#nope', null, pages).page, 'shopsetup');
});
test('hidden saved tab falls back to first visible', () => assert.equal(resolveView('#threads', { tabs: { threads: 'npt' } }, pages).tab, 'setup'));
test('splitCard picks last result, tool list and trailing notes', () => {
  const kids = ['h2|', 'div|row2', 'button|', 'div|result', 'button|', 'div|result', 'div|shop-tool-list', 'div|note'].map(kid);
  assert.deepEqual(splitCard(kids), { out: [5, 6], notes: [7] });
});
test('splitCard leaves cards without a result alone', () => assert.deepEqual(splitCard([{ tag: 'h2', cls: '' }, { tag: 'table', cls: '' }]), { out: [], notes: [] }));
test('parseSaved survives junk', () => {
  assert.deepEqual(parseSaved('{oops'), { tabs: {} });
  assert.deepEqual(parseSaved('[1]'), { tabs: {} });
  assert.deepEqual(parseSaved(null), { tabs: {} });
});
