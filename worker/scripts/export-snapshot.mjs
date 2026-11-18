// Exports the current local PostgreSQL snapshot and prepares it for Cloudflare D1.
// Usage:
//   node worker/scripts/export-snapshot.mjs
//   node worker/scripts/export-snapshot.mjs --upload
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const seedDir = resolve(root, 'worker/seed');
mkdirSync(seedDir, { recursive: true });

function readDatabaseUrl() {
  const env = readFileSync(resolve(root, '.env.local'), 'utf8');
  const match = env.match(/^\s*DATABASE_URL\s*=\s*(.+)$/m);
  if (!match) throw new Error('DATABASE_URL .env.local faylında tapılmadı');
  return match[1].trim().replace(/^["']|["']$/g, '');
}

const { Pool, types } = pg;
types.setTypeParser(types.builtins.INT8, (value) => Number(value));
types.setTypeParser(types.builtins.NUMERIC, (value) => Number(value));

function mapRow(row) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [
    key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()),
    value instanceof Date ? value.getTime() : value,
  ]));
}

async function queryRows(client, sql, params = []) {
  const result = await client.query(sql, params);
  return result.rows.map(mapRow);
}

async function readSnapshot() {
  const pool = new Pool({
    connectionString: readDatabaseUrl(),
    max: 2,
    connectionTimeoutMillis: 10000,
  });
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const [metadata] = await queryRows(client, 'SELECT schema_version, active_user_id, active_business_id, currency, time_zone, as_of FROM app_metadata WHERE id = 1');
    if (!metadata) throw new Error('Database has not been seeded');
    const userId = metadata.activeUserId;
    const businessScope = 'SELECT business_id FROM memberships WHERE user_id = $1';

    async function entities(key, table, condition, columns = '*') {
      return await queryRows(client, `SELECT ${columns} FROM ${table} WHERE ${condition} ORDER BY id`, [userId]);
    }

    const users = await entities('users', 'users', 'id = $1');
    const businesses = await entities('businesses', 'businesses', `id IN (${businessScope})`);
    const branches = await entities('branches', 'branches', `business_id IN (${businessScope})`);
    const memberships = await entities('memberships', 'memberships', 'user_id = $1');
    const systems = await entities('systems', 'systems', `business_id IN (${businessScope})`);
    const branchScope = `branch_id IN (SELECT id FROM branches WHERE business_id IN (${businessScope}))`;
    const sales = await entities('sales', 'sales', branchScope);
    const cashTransactions = await entities('cashTransactions', 'cash_transactions', branchScope);
    const products = await entities('products', 'products', `business_id IN (${businessScope})`);
    const stock = await entities('stock', 'stock_balances', `business_id IN (${businessScope})`, 'id, branch_id, product_id, quantity');
    const suppliers = await entities('suppliers', 'suppliers', `business_id IN (${businessScope})`);
    const eventRows = await queryRows(client, `SELECT * FROM events WHERE business_id IN (${businessScope}) ORDER BY id`, [userId]);
    const events = eventRows.map((row) => Object.fromEntries(Object.entries(row).filter(([key, value]) =>
      value !== null && !(key === 'businessId' && row.type !== 'daily_report_ready'),
    )));
    const notifications = await entities('notifications', 'notifications', 'user_id = $1', 'id, user_id, event_id, created_at, read_at');
    const periodRows = await queryRows(client, 'SELECT * FROM report_periods ORDER BY id');
    const buckets = await queryRows(client, 'SELECT * FROM report_buckets ORDER BY starts_at');
    const periods = periodRows.map((period) => ({
      ...period,
      buckets: buckets.filter((bucket) => bucket.periodId === period.id).map(({ periodId, ...bucket }) => bucket),
    }));

    const [overviewRow] = await queryRows(client, 'SELECT * FROM overview_snapshots WHERE business_id = $1 ORDER BY as_of DESC, id DESC LIMIT 1', [metadata.activeBusinessId]);
    if (!overviewRow) throw new Error('Overview snapshot missing');
    const overview = {
      id: overviewRow.id,
      businessId: overviewRow.businessId,
      startsAt: overviewRow.startsAt,
      asOf: overviewRow.asOf,
    };
    for (const group of ['sales', 'inventory', 'suppliers', 'cash']) {
      Object.assign(overview, {
        [group]: Object.fromEntries(Object.entries(overviewRow)
          .filter(([key]) => key.startsWith(group))
          .map(([key, value]) => {
            const metric = key.slice(group.length);
            return [metric[0].toLowerCase() + metric.slice(1), value];
          })),
      });
    }

    async function history(kind) {
      const datasets = await queryRows(client, `SELECT * FROM ${kind}_datasets WHERE business_id IN (${businessScope}) ORDER BY id`, [userId]);
      const points = await queryRows(client,
        `SELECT p.* FROM ${kind}_points p JOIN report_buckets b ON b.id = p.bucket_id WHERE p.dataset_id IN (SELECT id FROM ${kind}_datasets WHERE business_id IN (${businessScope})) ORDER BY b.starts_at`,
        [userId]);
      return datasets.map((dataset) => ({
        ...dataset,
        points: points.filter((point) => point.datasetId === dataset.id).map(({ datasetId, periodId, ...point }) => point),
      }));
    }

    const salesHistory = await history('sales');
    const inventoryHistory = await history('inventory');
    const cashHistory = await history('cash');
    const companyHistory = await history('company');

    await client.query('COMMIT');
    return {
      metadata,
      overview,
      users,
      businesses,
      branches,
      memberships,
      systems,
      sales,
      products,
      stock,
      suppliers,
      cashTransactions,
      events,
      notifications,
      periods,
      salesHistory,
      inventoryHistory,
      cashHistory,
      companyHistory,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

function buildSql(snapshot) {
  const json = JSON.stringify(snapshot);
  const hex = Buffer.from(json, 'utf8').toString('hex');
  const updatedAt = new Date().toISOString();
  return [
    '-- Generated by worker/scripts/export-snapshot.mjs. Do not edit by hand.',
    'CREATE TABLE IF NOT EXISTS app_snapshots (',
    '  database_target TEXT PRIMARY KEY,',
    '  data TEXT NOT NULL,',
    '  updated_at TEXT NOT NULL',
    ');',
    `INSERT INTO app_snapshots (database_target, data, updated_at) VALUES ('main', CAST(X'${hex}' AS TEXT), '${updatedAt}')`,
    'ON CONFLICT(database_target) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at;',
    '',
  ].join('\n');
}

const snapshot = await readSnapshot();
const json = JSON.stringify(snapshot, null, 2);
const sql = buildSql(snapshot);
writeFileSync(resolve(seedDir, 'snapshot-main.json'), json);
writeFileSync(resolve(seedDir, 'snapshot-main.sql'), sql);

const counts = Object.fromEntries(
  Object.entries(snapshot).map(([key, value]) => [key, Array.isArray(value) ? value.length : typeof value]),
);
console.log('Snapshot exported:', counts);
console.log(`JSON: ${resolve(seedDir, 'snapshot-main.json')} (${json.length} bytes)`);
console.log(`SQL : ${resolve(seedDir, 'snapshot-main.sql')} (${sql.length} bytes)`);

if (process.argv.includes('--upload')) {
  console.log('Uploading to Cloudflare D1 (businessapp-main)...');
  execFileSync('npx', [
    'wrangler', 'd1', 'execute', 'businessapp-main', '--remote',
    `--file=${resolve(seedDir, 'snapshot-main.sql')}`,
  ], { cwd: root, stdio: 'inherit', shell: true });
  console.log('Upload complete.');
}
