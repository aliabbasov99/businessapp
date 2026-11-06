const { connect } = require('./connection.cjs');
const { readFixtures } = require('./fixtures.cjs');
const snake = name => name.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
const dateFields = new Set(['occurredAt', 'createdAt', 'readAt', 'startsAt', 'endsAt', 'asOf']);

async function seed() {
  const db = readFixtures();
  const client = connect();
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('dashboard-seed'))");
    await client.query('CREATE TABLE IF NOT EXISTS seed_runs (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    if ((await client.query("SELECT 1 FROM seed_runs WHERE name = 'initial-v1'")).rowCount) {
      await client.query('COMMIT');
      console.log('Initial seed already imported; existing database changes preserved.');
      return;
    }
    async function insert(table, rows) {
      for (const row of rows) {
        const entries = Object.entries(row);
        const columns = entries.map(([key]) => `"${snake(key)}"`).join(', ');
        const values = entries.map(([key, value]) => dateFields.has(key) && value !== null ? new Date(value) : value);
        await client.query(`INSERT INTO ${table} (${columns}) VALUES (${values.map((_, i) => `$${i + 1}`).join(', ')})`, values);
      }
    }
    for (const key of ['users', 'businesses', 'memberships', 'branches', 'systems', 'sales', 'products', 'suppliers']) await insert(key, db[key]);
    const branchBusiness = id => db.branches.find(branch => branch.id === id).businessId;
    await insert('stock_balances', db.stock.map(row => ({ ...row, businessId: branchBusiness(row.branchId) })));
    await insert('cash_transactions', db.cashTransactions);
    const events = db.events.map(row => ({ ...row, businessId: row.businessId ?? branchBusiness(row.branchId) }));
    await insert('events', events);
    await insert('notifications', db.notifications.map(row => ({ ...row, businessId: events.find(event => event.id === row.eventId).businessId })));
    await insert('app_metadata', [{ id: 1, ...db.metadata }]);
    await insert('report_periods', db.periods.map(({ buckets, ...period }) => period));
    await insert('report_buckets', db.periods.flatMap(period => period.buckets.map(bucket => ({ ...bucket, periodId: period.id }))));
    const flatOverview = {};
    for (const [key, value] of Object.entries(db.overview)) {
      if (typeof value !== 'object') flatOverview[key] = value;
      else for (const [metric, amount] of Object.entries(value)) flatOverview[key + metric[0].toUpperCase() + metric.slice(1)] = amount;
    }
    await insert('overview_snapshots', [flatOverview]);
    for (const kind of ['sales', 'inventory', 'cash', 'company']) {
      const datasets = db[`${kind}History`];
      await insert(`${kind}_datasets`, datasets.map(({ points, ...dataset }) => dataset));
      await insert(`${kind}_points`, datasets.flatMap(dataset => dataset.points.map(point => ({ ...point, datasetId: dataset.id, periodId: dataset.periodId }))));
    }
    const identities = await client.query("SELECT table_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'id' AND is_identity = 'YES'");
    for (const { table_name: table } of identities.rows) {
      await client.query(`SELECT setval(pg_get_serial_sequence($1, 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM "${table}"`, [table]);
    }
    await client.query("INSERT INTO seed_runs (name) VALUES ('initial-v1')");
    await client.query('COMMIT');
    console.log('Initial data imported into PostgreSQL.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { await client.end(); }
}
seed().catch(error => { console.error(error.message); process.exitCode = 1; });
