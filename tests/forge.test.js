const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const { parseActions, runActions } = require('../js/actions.js');
const host = require('../js/host.js');
const forge = require('../tools/build-forge.js');
const pkg = JSON.parse(read('package.json'));

test('actions parse plain calls, one number or one quoted string, never code', () => {
  assert.deepEqual(parseActions('calcMain()'), [{ name: 'calcMain', args: [] }]);
  assert.deepEqual(parseActions("toggleCalcType(); updatePresetPreview();"),
    [{ name: 'toggleCalcType', args: [] }, { name: 'updatePresetPreview', args: [] }]);
  assert.deepEqual(parseActions('setChamferAngle(120)'), [{ name: 'setChamferAngle', args: [120] }]);
  assert.deepEqual(parseActions("updateSpeedBasisUI('tap')"), [{ name: 'updateSpeedBasisUI', args: ['tap'] }]);
  for (const bad of ['alert(document.cookie)()', 'a(b())', "a('x', 'y')", 'a.b()', 'fetch("//x")+1', 'calcMain']) {
    assert.throws(() => parseActions(bad), /Unsupported action/, bad);
  }
});

test('actions run in order and refuse unknown names', () => {
  const calls = [];
  const scope = { a: () => calls.push('a'), b: x => calls.push('b' + x) };
  runActions("a(); b(2); b('x')", scope);
  assert.deepEqual(calls, ['a', 'b2', 'bx']);
  assert.throws(() => runActions('missing()', scope), /Unknown action/);
});

test('host version matches package.json', () => {
  assert.equal(host.VERSION, pkg.version);
});

test('host detection: preset attribute, then ?host=, else web', () => {
  const doc = preset => ({ documentElement: { getAttribute: () => preset } });
  assert.equal(host.detectHost(doc('forge'), ''), 'forge');
  assert.equal(host.detectHost(doc(null), '?host=forge'), 'forge');
  assert.equal(host.detectHost(doc(null), '?host=evil'), 'web');
  assert.equal(host.detectHost(doc(null), ''), 'web');
});

test('result messages are plain data with an ISO date', () => {
  const created = new Date('2026-11-07T12:00:00Z');
  assert.deepEqual(host.resultMessage({ label: 'Milling', machine: 'M391', text: 'RPM: 2000', note: 'Sine\nMilling', created }), {
    source: 'mb-sine', type: 'result', version: pkg.version, label: 'Milling', machine: 'M391',
    text: 'RPM: 2000', note: 'Sine\nMilling', created: '2026-11-07T12:00:00.000Z'
  });
});

test('Sine posts to a same-origin Forge parent only, and never to file://', () => {
  const sent = [];
  const listeners = {};
  const doc = { readyState: 'complete', addEventListener: (type, fn) => { listeners[type] = fn; } };
  const parent = { postMessage: (message, origin) => sent.push([message, origin]) };
  const win = { parent, location: { origin: 'http://tauri.localhost' } };
  assert.equal(host.connectToForge(win, doc), true);
  listeners['mb-sine:result']({ detail: { label: 'Drill', created: new Date(0) } });
  assert.deepEqual(sent.map(([m, o]) => [m.type, o]), [['ready', 'http://tauri.localhost'], ['result', 'http://tauri.localhost']]);

  const topLevel = { location: { origin: 'http://tauri.localhost' } };
  topLevel.parent = topLevel;
  assert.equal(host.connectToForge(topLevel, doc), false);
  assert.equal(host.connectToForge({ parent, location: { origin: 'null' } }, doc), false);
});

test('in Forge, the theme comes from the Forge page and follows its changes', () => {
  const forgeVars = { '--panel': ' #151e40', '--red': '#f2668f', '--ui': '"MB Mono NL", Consolas, monospace' };
  const top = {};
  const parent = { document: { documentElement: top },
    getComputedStyle: el => { assert.equal(el, top); return { getPropertyValue: n => forgeVars[n] || '' }; } };
  const set = {};
  const doc = { documentElement: { style: { setProperty: (n, v) => { set[n] = v; }, removeProperty: n => { delete set[n]; } } } };
  let watch;
  class MutationObserver { constructor(fn) { this.fn = fn; } observe(el, opts) { watch = { el, opts, fn: this.fn }; } }
  assert.equal(host.followForgeTheme({ parent, MutationObserver }, doc), true);
  assert.deepEqual(set, { '--forge-panel': '#151e40', '--forge-red': '#f2668f', '--forge-ui': '"MB Mono NL", Consolas, monospace' });
  assert.equal(watch.el, top);
  assert.deepEqual(watch.opts.attributeFilter, ['style', 'class']);
  forgeVars['--ui'] = '"Consolas", monospace';   // Settings > Font
  delete forgeVars['--red'];
  watch.fn();
  assert.equal(set['--forge-ui'], '"Consolas", monospace');
  assert.equal('--forge-red' in set, false);

  const crossOrigin = { get document() { throw new Error('SecurityError'); } };
  assert.equal(host.followForgeTheme({ parent: crossOrigin }, doc), false);
  const topLevel = {}; topLevel.parent = topLevel;
  assert.equal(host.followForgeTheme(topLevel, doc), false);
});

test('every token styles.css reads from Forge is one host.js copies', () => {
  const css = read('css/styles.css');
  const used = new Set([...css.matchAll(/var\(--forge-([a-z-]+)/g)].map(m => m[1]));
  assert.ok(used.size > 10);
  for (const name of used) assert.ok(host.FORGE_TOKENS.includes(name), name);
});

test('the Forge build passes MB Forge\'s Content Security Policy and ships every asset', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'sine-forge-'));
  try {
    forge.build(out);
    const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
    assert.deepEqual(forge.checkForgePolicy(html), []);
    assert.match(html, /<html lang="en" data-host="forge">/);
    assert.doesNotMatch(html, /fonts\.googleapis|rel="manifest"/);
    for (const m of html.matchAll(/(?:src|href)="\.\/([^"]+)"/g)) {
      assert.ok(fs.existsSync(path.join(out, m[1])), 'missing ' + m[1]);
    }
    for (const rel of forge.ASSETS) assert.equal(fs.readFileSync(path.join(out, rel), 'utf8'), read(rel), rel + ' must be copied unchanged');
    const version = JSON.parse(fs.readFileSync(path.join(out, 'VERSION.json'), 'utf8'));
    assert.equal(version.version, pkg.version);
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});

test('the policy check catches what Forge would block', () => {
  const problems = forge.checkForgePolicy('<script>x()</script><button onclick="a()"></button>' +
    '<link href="https://fonts.googleapis.com/x" rel="stylesheet"/><script src="//cdn.example/x.js"></script>');
  assert.equal(problems.length, 4, problems.join('\n'));
  assert.deepEqual(forge.checkForgePolicy('<a href="https://example.com/doc" target="_blank">doc</a><script src="./js/app.js"></script>'), []);
});
