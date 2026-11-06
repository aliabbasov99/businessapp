const assert = require('node:assert/strict');
const { after, test } = require('node:test');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const { readFixtures } = require('./db/fixtures.cjs');

const root = path.resolve(__dirname, '..');
const output = mkdtempSync(path.join(tmpdir(), 'dashboard-offline-test-'));
after(() => rmSync(output, { recursive: true, force: true }));
const program = ts.createProgram([path.join(root, 'src/data/sync.ts')], {
  outDir: output, rootDir: path.join(root, 'src'), target: ts.ScriptTarget.ES2020,
  module: ts.ModuleKind.CommonJS, moduleResolution: ts.ModuleResolutionKind.Node10,
  strict: true, skipLibCheck: true, types: [], ignoreDeprecations: '6.0',
});
const diagnostics = ts.getPreEmitDiagnostics(program);
assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
  getCurrentDirectory: () => root, getCanonicalFileName: file => file, getNewLine: () => '\n',
}));
assert.equal(program.emit().emitSkipped, false);
const { createDataSync } = require(path.join(output, 'data/sync.js'));
const offline = async () => { throw new Error('Network unavailable'); };
const flush = () => new Promise(resolve => setImmediate(resolve));
function storage(initial = null) {
  let raw = initial;
  return { getItem: async () => raw, setItem: async (_, value) => { raw = value; } };
}
function session(disk, fetchSnapshot, cacheKey = 'test') {
  let snapshot = null;
  const sync = createDataSync({ storage: disk, cacheKey, fetchSnapshot,
    getSnapshot: () => snapshot, setSnapshot: value => { snapshot = value; },
  });
  return { sync, snapshot: () => snapshot };
}

test('a new offline app session restores the last successful server snapshot', async () => {
  const disk = storage();
  const online = session(disk, async () => readFixtures());
  assert.equal(await online.sync.refresh(), true);
  assert.equal(online.sync.getState().cacheAvailable, true);
  const restarted = session(disk, offline);
  assert.equal(await restarted.sync.refresh(), false);
  assert.deepEqual(restarted.snapshot(), online.snapshot());
  assert.equal(restarted.sync.getState().phase, 'offline');
  assert.equal(restarted.sync.getState().savedAt, online.sync.getState().savedAt);
});

test('cached data is visible before a slow network request finishes', async () => {
  const disk = storage(JSON.stringify({ version: 1, savedAt: 1000, data: readFixtures() }));
  let rejectNetwork;
  const app = session(disk, () => new Promise((_, reject) => { rejectNetwork = reject; }));
  const refreshing = app.sync.refresh();
  await flush();
  assert.ok(app.snapshot().sales.length > 0);
  assert.equal(app.sync.getState().phase, 'refreshing');
  rejectNetwork(new Error('timeout'));
  assert.equal(await refreshing, false);
  assert.ok(app.snapshot().sales.length > 0);
  assert.equal(app.sync.getState().savedAt, 1000);
});

test('reconnection refreshes data and replaces the persisted snapshot', async () => {
  const data = readFixtures();
  const disk = storage(JSON.stringify({ version: 1, savedAt: 1000, data }));
  let connected = false;
  const newer = structuredClone(data);
  newer.sales[0].amountMinor += 100;
  const app = session(disk, () => connected ? Promise.resolve(newer) : offline());
  await app.sync.refresh();
  assert.deepEqual(app.snapshot(), data);
  connected = true;
  await app.sync.refresh();
  assert.deepEqual(app.snapshot(), newer);
  assert.equal(app.sync.getState().phase, 'online');
  const restarted = session(disk, offline);
  await restarted.sync.refresh();
  assert.deepEqual(restarted.snapshot(), newer);
});

test('first launch without a cache stays empty offline; corrupt caches never crash the app', async () => {
  const invalid = readFixtures();
  delete invalid.salesHistory[0].points;
  for (const raw of [null, '{bad json', JSON.stringify({ version: 99, savedAt: 1000, data: readFixtures() }), JSON.stringify({ version: 1, savedAt: 1000, data: invalid })]) {
    const app = session(storage(raw), offline);
    assert.equal(await app.sync.refresh(), false);
    assert.equal(app.snapshot(), null);
    assert.equal(app.sync.getState().phase, 'offline');
  }
  const online = session(storage('bad cache'), async () => readFixtures());
  assert.equal(await online.sync.refresh(), true);
  assert.ok(online.snapshot());
});

test('invalid HTTP data cannot replace a valid offline snapshot', async () => {
  const good = readFixtures();
  const disk = storage(JSON.stringify({ version: 1, savedAt: 1000, data: good }));
  const invalid = structuredClone(good);
  invalid.sales[0].amountMinor = '12850';
  const app = session(disk, async () => invalid);
  assert.equal(await app.sync.refresh(), false);
  assert.deepEqual(app.snapshot(), good);
  assert.deepEqual(JSON.parse(await disk.getItem('test')).data, good);
});

test('confirmed profile and notification writes survive an offline restart', async () => {
  const disk = storage();
  const app = session(disk, async () => readFixtures());
  await app.sync.refresh();
  const edited = structuredClone(app.snapshot());
  edited.users[0].name = 'Updated from server';
  edited.notifications[0].readAt = Date.now();
  await app.sync.commit(edited);
  const restarted = session(disk, offline);
  await restarted.sync.refresh();
  assert.equal(restarted.snapshot().users[0].name, edited.users[0].name);
  assert.equal(restarted.snapshot().notifications[0].readAt, edited.notifications[0].readAt);
});

test('a stale background fetch cannot undo a confirmed write', async () => {
  const original = readFixtures();
  const disk = storage(JSON.stringify({ version: 1, savedAt: 1000, data: original }));
  let finishFetch;
  const app = session(disk, () => new Promise(resolve => { finishFetch = resolve; }));
  const pending = app.sync.refresh();
  await flush();
  const edited = structuredClone(original);
  edited.users[0].name = 'New profile';
  await app.sync.commit(edited);
  finishFetch(original);
  await pending;
  assert.equal(app.snapshot().users[0].name, 'New profile');
  assert.equal(JSON.parse(await disk.getItem('test')).data.users[0].name, 'New profile');
});

test('storage failure does not discard live data or claim that it was cached', async () => {
  const disk = { getItem: async () => null, setItem: async () => { throw new Error('Storage full'); } };
  const app = session(disk, async () => readFixtures());
  assert.equal(await app.sync.refresh(), true);
  assert.ok(app.snapshot());
  assert.equal(app.sync.getState().phase, 'online');
  assert.equal(app.sync.getState().cacheAvailable, false);
});

test('overlapping refresh requests share one network call', async () => {
  let requests = 0;
  const app = session(storage(), async () => { requests++; return readFixtures(); });
  await Promise.all([app.sync.refresh(), app.sync.refresh(), app.sync.refresh()]);
  assert.equal(requests, 1);
});
