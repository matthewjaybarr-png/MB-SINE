const test = require('node:test');
const assert = require('node:assert/strict');
const workflow = require('../js/workflow.js');

test('machine profiles require a name and at least one usable limit', () => {
  assert.throws(() => workflow.normalizeMachineProfile({name:'', maxRpm:10000}), /profile name/);
  assert.throws(() => workflow.normalizeMachineProfile({name:'Mill', maxRpm:0, maxFeedIpm:0}), /at least one/);
  assert.throws(() => workflow.normalizeMachineProfile({name:'Mill', maxRpm:-1}), /positive number/);
});

test('machine profiles normalize persisted numeric values', () => {
  assert.deepEqual(
    workflow.normalizeMachineProfile({id:'m1', name:'  Mill  ', maxRpm:'12000', maxFeedIpm:'400'}),
    {id:'m1', name:'Mill', maxRpm:12000, maxFeedIpm:400, toolbooks:[], tools:[]}
  );
});

test('machine limit checks report RPM and feed independently', () => {
  const profile = {id:'m1', name:'Mill', maxRpm:12000, maxFeedIpm:400};
  const result = workflow.evaluateMachineLimits(profile, {rpm:12500, feedIpm:450});
  assert.equal(result.withinLimits, false);
  assert.deepEqual(result.warnings.map(warning => warning.type), ['rpm', 'feed']);
});

test('zero means a machine limit is intentionally not configured', () => {
  const result = workflow.evaluateMachineLimits(
    {id:'m1', name:'Lathe', maxRpm:0, maxFeedIpm:200},
    {rpm:50000, feedIpm:150}
  );
  assert.equal(result.withinLimits, true);
  assert.deepEqual(result.warnings, []);
});

function fakeStorage(initial) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    dump: () => Object.fromEntries(map),
  };
}

test('legacy saved settings are copied to the new keys once', () => {
  const storage = fakeStorage({ oldProfiles: '[{"id":"m1"}]', oldActive: 'm1' });
  const copied = workflow.migrateLegacyKeys(storage, { oldProfiles: 'newProfiles', oldActive: 'newActive' });
  assert.equal(copied, 2);
  assert.equal(storage.getItem('newProfiles'), '[{"id":"m1"}]');
  assert.equal(storage.getItem('newActive'), 'm1');
  assert.equal(storage.getItem('oldProfiles'), '[{"id":"m1"}]', 'old keys are left in place');
  assert.equal(workflow.migrateLegacyKeys(storage, { oldProfiles: 'newProfiles' }), 0, 'second run copies nothing');
});

test('migration never overwrites settings already saved under the new key', () => {
  const storage = fakeStorage({ oldProfiles: 'old', newProfiles: 'current' });
  assert.equal(workflow.migrateLegacyKeys(storage, { oldProfiles: 'newProfiles' }), 0);
  assert.equal(storage.getItem('newProfiles'), 'current');
});

test('migration tolerates missing or blocked storage', () => {
  assert.equal(workflow.migrateLegacyKeys(null, { a: 'b' }), 0);
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(workflow.migrateLegacyKeys(blocked, { a: 'b' }), 0);
  assert.equal(workflow.migrateLegacyKeys(fakeStorage({}), { missing: 'b' }), 0);
});

test('a profile saved before 1.3.0 loads unchanged; unknown fields are dropped', () => {
  const old = {id:'machine-1', name:'M391', maxRpm:12000, maxFeedIpm:0, colour:'blue'};
  assert.deepEqual(workflow.normalizeMachineProfile(old),
    {id:'machine-1', name:'M391', maxRpm:12000, maxFeedIpm:0, toolbooks:[], tools:[]});
});

test('profiles keep toolbooks and extra tools, rename 487-488 and drop duplicates', () => {
  const p = workflow.normalizeMachineProfile({name:'M387', toolbooks:['487-488', '387-388', ' 372 '],
    tools:[{book:'487-488', id:'100'}, {book:'387-388', id:'100'}, {book:'', id:'5'}, {book:'459', id:7}]});
  assert.deepEqual(p.toolbooks, ['387-388', '372']);
  assert.deepEqual(p.tools, [{book:'387-388', id:'100'}, {book:'459', id:'7'}]);
  assert.equal(p.maxRpm, 0); // a toolbook alone is enough; no limits means no limit warnings
  assert.throws(() => workflow.normalizeMachineProfile({name:'Empty'}), /at least one machine limit, or tick a toolbook/);
});

test('the profile filter limits the tool list; unknown books and tools are skipped and counted', () => {
  const books = [{name:'391-392'}, {name:'372'}];
  const all = [{book:'391-392', id:'1'}, {book:'391-392', id:'2'}, {book:'372', id:'9'}, {book:'459', id:'4'}];
  assert.equal(workflow.profileShopTools(null, all, books).tools.length, 4);
  assert.equal(workflow.profileShopTools({toolbooks:[], tools:[]}, all, books).filtered, false);
  const r = workflow.profileShopTools({toolbooks:['391-392', 'gone-book'],
    tools:[{book:'372', id:'9'}, {book:'372', id:'404'}]}, all, books);
  assert.deepEqual(r.tools.map(t => t.book + ' T' + t.id), ['391-392 T1', '391-392 T2', '372 T9']);
  assert.equal(r.missingTools, 1);
  assert.equal(r.missingBooks, 1);
});

test('a profile named for a machine number picks that toolbook', () => {
  const books = [{name:'391-392'}, {name:'464-465'}, {name:'372'}];
  assert.deepEqual(workflow.toolbooksForName('M391', books), ['391-392']);
  assert.deepEqual(workflow.toolbooksForName('Okuma 465', books), ['464-465']);
  assert.deepEqual(workflow.toolbooksForName('M372', books), ['372']);
  assert.deepEqual(workflow.toolbooksForName('Haas', books), []);
});
