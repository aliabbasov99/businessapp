const assert = require('node:assert/strict');
const { after, test } = require('node:test');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const ts = require('typescript');

// Compile the pure data layer with the project's existing TypeScript dependency.
// No Expo runtime, simulator, extra test framework, or checked-in build is needed.
const root = path.resolve(__dirname, '..');
const output = mkdtempSync(path.join(tmpdir(), 'dashboard-data-test-'));
after(() => rmSync(output, { recursive: true, force: true }));
const program = ts.createProgram([
  'src/data/database.ts', 'src/data/queries.ts', 'src/data/overview.ts',
  'src/data/reports.ts', 'src/utils/assistant.ts',
].map(file => path.join(root, file)), {
  outDir: output, rootDir: path.join(root, 'src'), target: ts.ScriptTarget.ES2020,
  module: ts.ModuleKind.CommonJS, moduleResolution: ts.ModuleResolutionKind.Node10,
  resolveJsonModule: true, esModuleInterop: true, strict: true, skipLibCheck: true,
  types: [], ignoreDeprecations: '6.0',
});
const diagnostics = ts.getPreEmitDiagnostics(program);
assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
  getCurrentDirectory: () => root, getCanonicalFileName: file => file, getNewLine: () => '\n',
}));
assert.equal(program.emit().emitSkipped, false);
const { setDatabase, getById } = require(path.join(output, 'data/database.js'));
const db = require('./db/fixtures.cjs').readFixtures();
setDatabase(db);
const queries = require(path.join(output, 'data/queries.js'));
const { createReports } = require(path.join(output, 'data/reports.js'));
const { getOverviewCards } = require(path.join(output, 'data/overview.js'));
const format = require(path.join(output, 'utils/format.js'));
const { assistantReply } = require(path.join(output, 'utils/assistant.js'));
const { presentEvent } = require(path.join(output, 'utils/event-presentation.js'));
const identity = value => value;
const has = (rows, id) => rows.some(row => row.id === id);
function unique(rows, key, label) {
  assert.equal(new Set(rows.map(key)).size, rows.length, `${label} must be unique`);
}

function numericFields(value, field = '') {
  if (Array.isArray(value)) return value.forEach(item => numericFields(item));
  if (value && typeof value === 'object') return Object.entries(value).forEach(([key, item]) => numericFields(item, key));
  if (field === 'taxId') {
    assert.equal(typeof value, 'string');
    return;
  }
  if (field === 'id' || field.endsWith('Id') || field.endsWith('Minor') || /^(occurredAt|createdAt|readAt|startsAt|endsAt|asOf)$/.test(field)) {
    if (value === null && ['phone', 'branchId', 'readAt'].includes(field)) return;
    assert.equal(Number.isSafeInteger(value), true, `${field} must be a safe integer: ${value}`);
    if (field === 'id' || field.endsWith('Id')) assert.ok(value > 0, `${field} must be positive`);
  }
  if (/Percent$/.test(field) || field === 'quantity' || field === 'customerCount') {
    assert.equal(typeof value, 'number', `${field} must be numeric`);
    assert.ok(Number.isFinite(value));
  }
}

test('numeric storage, primary keys, and composite keys are valid', () => {
  numericFields(db);
  for (const [name, rows] of Object.entries(db)) {
    if (Array.isArray(rows)) unique(rows, row => row.id, name);
  }
  unique(db.memberships, row => `${row.userId}:${row.businessId}`, 'membership');
  unique(db.stock, row => `${row.productId}:${row.branchId}`, 'stock balance');
  unique(db.sales, row => `${row.branchId}:${row.receiptNumber}`, 'receipt number per branch');
});

test('foreign keys connect records within the correct business', () => {
  assert.ok(has(db.users, db.metadata.activeUserId));
  assert.ok(has(db.businesses, db.metadata.activeBusinessId));
  for (const row of [...db.branches, ...db.systems, ...db.products, ...db.suppliers, db.overview]) assert.ok(has(db.businesses, row.businessId));
  for (const row of db.memberships) {
    assert.ok(has(db.users, row.userId)); assert.ok(has(db.businesses, row.businessId));
  }
  for (const row of [...db.sales, ...db.cashTransactions, ...db.stock]) assert.ok(has(db.branches, row.branchId));
  for (const row of db.stock) {
    const product = getById(db.products, row.productId);
    assert.equal(getById(db.branches, row.branchId).businessId, product.businessId);
    assert.ok(row.quantity >= 0);
  }
  for (const event of db.events) assert.ok('branchId' in event ? has(db.branches, event.branchId) : has(db.businesses, event.businessId));
  for (const row of db.notifications) {
    assert.ok(has(db.users, row.userId));
    const event = getById(db.events, row.eventId);
    const businessId = 'branchId' in event ? getById(db.branches, event.branchId).businessId : event.businessId;
    assert.ok(db.memberships.some(member => member.userId === row.userId && member.businessId === businessId));
    assert.ok(row.createdAt >= event.occurredAt);
    assert.ok(row.readAt === null || row.readAt >= row.createdAt);
  }
});

test('transaction dates and refund signs are consistent', () => {
  for (const sale of db.sales) {
    assert.equal(sale.amountMinor < 0, sale.type === 'refund');
    assert.ok(sale.occurredAt <= db.metadata.asOf, `Receipt ${sale.receiptNumber} is after the snapshot`);
  }
  for (const row of db.cashTransactions) assert.ok(row.occurredAt <= db.metadata.asOf);
  const sales = queries.getRecentSales();
  assert.ok(sales.every((sale, index) => index === 0 || sales[index - 1].occurredAt >= sale.occurredAt));
  assert.deepEqual(queries.getRecentSales(2), []);
  assert.deepEqual(queries.getInventory(2), []);
});

test('period buckets are contiguous and every chart point has a valid bucket', () => {
  const bucketIds = db.periods.flatMap(period => period.buckets.map(bucket => bucket.id));
  assert.equal(new Set(bucketIds).size, bucketIds.length);
  for (const period of db.periods) {
    assert.ok(period.buckets.length > 1);
    period.buckets.forEach((bucket, index) => {
      assert.ok(bucket.startsAt < bucket.endsAt);
      if (index) assert.equal(period.buckets[index - 1].endsAt, bucket.startsAt);
    });
  }
  for (const rows of [db.salesHistory, db.inventoryHistory, db.cashHistory, db.companyHistory]) {
    unique(rows, row => `${row.businessId}:${row.branchId ?? 'all'}:${row.periodId}`, 'report scope');
    for (const row of rows) {
      assert.ok(has(db.businesses, row.businessId));
      if (row.branchId != null) assert.equal(getById(db.branches, row.branchId).businessId, row.businessId);
      const period = getById(db.periods, row.periodId);
      assert.equal(row.points.length, period.buckets.length);
      unique(row.points, point => point.bucketId, 'point per bucket');
      for (const point of row.points) assert.ok(has(period.buckets, point.bucketId));
    }
  }
});

test('branch sales reconcile exactly to aggregate sales in every bucket', () => {
  for (const period of db.periods) {
    const combined = db.salesHistory.find(row => row.periodId === period.id && row.branchId === null);
    const branches = db.salesHistory.filter(row => row.periodId === period.id && row.branchId !== null);
    for (const point of combined.points) {
      for (const field of ['revenueMinor', 'costMinor', 'customerCount']) {
        assert.equal(branches.reduce((sum, row) => sum + row.points.find(item => item.bucketId === point.bucketId)[field], 0), point[field]);
      }
    }
  }
});

test('reports total flow metrics and select the closing value of balances', () => {
  const reports = createReports();
  for (const [index, period] of db.periods.entries()) {
    const data = db.salesHistory.find(row => row.periodId === period.id && row.branchId === null);
    const points = period.code === 'year' ? data.points.slice(-12) : data.points;
    assert.equal(reports[0].summaries[index].total, points.reduce((sum, point) => sum + point.revenueMinor, 0) / 100);
    for (const [pointIndex, point] of data.points.entries()) assert.equal(reports[0].data[index].series.find(series => series.key === 'profit').values[pointIndex], (point.revenueMinor - point.costMinor) / 100);
    const cash = db.cashHistory.find(row => row.periodId === period.id);
    assert.equal(reports[2].summaries[index].total, cash.points.at(-1).balanceMinor / 100);
    const branchTotal = [1, 2].reduce((sum, branch) => sum + createReports(branch)[0].summaries[index].total, 0);
    assert.ok(Math.abs(branchTotal - reports[0].summaries[index].total) < 0.000001);
  }
});

test('overview, notifications, profile, and assistant use shared records', () => {
  const cards = getOverviewCards();
  const revenue = cards.find(card => card.key === 'dovriyye');
  assert.equal(revenue.details[1].value, db.overview.sales.revenueMinor - db.overview.sales.costMinor);
  assert.equal(cards.find(card => card.key === 'kassa').main.value, db.overview.cash.inflowMinor - db.overview.cash.outflowMinor);
  for (const row of queries.getInventory()) assert.equal(row.stockAmountMinor, Math.round(row.quantity * row.costPriceMinor));
  assert.deepEqual(queries.getUserBusinesses().map(business => business.branchCount), [2, 1, 0]);
  assert.equal(queries.getNotifications().filter(item => item.readAt === null).length, 2);
  const cancellation = presentEvent(getById(db.events, 1), 'en-US', identity);
  assert.ok(cancellation.body.includes(format.formatMoney(getById(db.events, 1).amountMinor, 'en-US')));
  assert.ok(assistantReply('satış', 'en-US', identity).includes(format.formatMoney(revenue.main.value, 'en-US')));
  assert.ok(assistantReply('mənfəət', 'en-US', identity).includes(format.formatMoney(revenue.details[1].value, 'en-US')));
});

test('formatting preserves minor units, negative signs, and Baku dates', () => {
  assert.equal(format.formatMoney(12850, 'en-US'), '128.5 ₼');
  assert.equal(format.formatMoney(-9370, 'en-US'), '−93.7 ₼');
  assert.equal(format.formatMoney(1, 'en-US'), '0.01 ₼');
  assert.equal(format.formatTime(Date.parse('2026-11-03T10:32:00Z'), 'en-US'), '14:32');
  assert.equal(format.dateKey(Date.parse('2026-11-02T21:30:00Z')), '2026-11-03');
  assert.notEqual(format.formatMoney(123456, 'en-US'), format.formatMoney(123456, 'az-AZ'));
  assert.notEqual(createReports(null, 'en-US')[0].data[2].labels[0], createReports(null, 'az-AZ')[0].data[2].labels[0]);
});
