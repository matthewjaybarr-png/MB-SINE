const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync(new URL('../index.html', `file://${__filename}`), 'utf8');
const app = fs.readFileSync(new URL('../js/app.js', `file://${__filename}`), 'utf8');
const styles = fs.readFileSync(new URL('../css/styles.css', `file://${__filename}`), 'utf8');
const serviceWorker = fs.readFileSync(new URL('../service-worker.js', `file://${__filename}`), 'utf8');
const manifest = JSON.parse(fs.readFileSync(new URL('../manifest.webmanifest', `file://${__filename}`), 'utf8'));

test('page loads the tested calculation core before its controller', () => {
  assert.match(html, /<script src="\.\/js\/data\.js"><\/script>\s*<script src="\.\/js\/core\.js"><\/script>\s*<script src="\.\/js\/workflow\.js"><\/script>\s*<script src="\.\/js\/app\.js"><\/script>\s*<script src="\.\/js\/actions\.js"><\/script>/);
  assert.match(html, /<link href="\.\/css\/styles\.css" rel="stylesheet"\/>\s*<script src="\.\/js\/host\.js"><\/script>\s*<\/head>/);
  assert.doesNotMatch(html, /<script>(?:\s|.)*?<\/script>/);
  assert.doesNotMatch(html, /<style>/);
  assert.match(html, /<link href="\.\/css\/styles\.css" rel="stylesheet"\/>/);
  assert.doesNotThrow(() => new vm.Script(app));
  assert.ok(styles.length > 0, 'Expected extracted stylesheet content.');
});

test('no inline event handlers (MB Forge runs Sine under script-src \'self\')', () => {
  assert.doesNotMatch(html, /\son[a-z]+\s*=\s*["']/i);
  assert.doesNotMatch(app, /\.on(?:click|change|input)\s*=|\son[a-z]+=\\?["']/);
});

test('every data-click / data-change action names an existing function', () => {
  const { parseActions } = require('../js/actions.js');
  const actions = [...html.matchAll(/data-(?:click|change)="([^"]*)"/g)].map(match => match[1]);
  assert.ok(actions.length > 60, 'Expected the calculator buttons to use data actions.');
  const functions = new Set([...app.matchAll(/function\s+([A-Za-z0-9_]+)\s*\(/g)].map(match => match[1]));
  const names = actions.flatMap(text => parseActions(text).map(action => action.name));
  assert.deepEqual([...new Set(names)].filter(name => !functions.has(name)), []);
});

test('direct DOM references point to existing element IDs', () => {
  const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map(match => match[1]));
  const references = new Set([...app.matchAll(/gid\("([^"]+)"\)/g)].map(match => match[1]));
  const missing = [...references].filter(reference => !ids.has(reference));
  assert.deepEqual(missing, []);
});

test('critical source-of-truth controls remain present', () => {
  for (const id of ['machineProfileSelect', 'machineMaxRpm', 'machineMaxFeed', 'copyLatestButton', 'speedBasis', 'turnSpeedBasis', 'tapSpeedBasis', 'tmFlutes', 'tmLocation', 'circleSource', 'trigSolveFrom', 'arcLocation', 'effectiveToolType', 'scallopSolveFrom', 'positionActualX', 'boreFinishDia']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.doesNotMatch(html, /setTimeout\(forceRebuildSelectors/);
});

test('fractional drill generation remains available through two inches', () => {
  assert.match(app, /for\(let n=1;n<=128;n\+\+\)/);
});

test('offline application metadata and cache contracts remain complete', () => {
  assert.match(html, /rel="manifest"/);
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, './');
  assert.match(serviceWorker, /mb-sine-v\d+/);
  assert.deepEqual(manifest.icons.map(icon => icon.sizes), ['192x192', '512x512']);
  for (const asset of ['./index.html', './css/styles.css', './js/host.js', './js/data.js', './js/core.js', './js/workflow.js', './js/app.js', './js/actions.js', './icons/mb-sine-192.png', './icons/mb-sine-512.png']) {
    assert.match(serviceWorker, new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(app, /navigator\.serviceWorker\.register\("\.\/service-worker\.js"\)/);
});
