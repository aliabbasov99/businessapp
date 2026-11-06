import type {
  BusinessEvent, DatabaseSnapshot, Dataset, Metadata, OverviewSnapshot,
  ReportBucket, ReportPeriod,
} from '../data/schema';
import { getPool, queryRows } from './postgres';

export async function readSnapshot(): Promise<DatabaseSnapshot> {
  const client = await getPool().connect();
  try {
    // One coherent snapshot even if a transaction is written during these queries.
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const [metadata] = await queryRows<Metadata>(client, 'SELECT schema_version, active_user_id, active_business_id, currency, time_zone, as_of FROM app_metadata WHERE id = 1');
    if (!metadata) throw new Error('Database has not been seeded');
    const userId = metadata.activeUserId;
    const businessScope = 'SELECT business_id FROM memberships WHERE user_id = $1';
    async function entities<K extends keyof DatabaseSnapshot>(key: K, table: string, condition: string, columns = '*'): Promise<DatabaseSnapshot[K]> {
      return await queryRows(client, `SELECT ${columns} FROM ${table} WHERE ${condition} ORDER BY id`, [userId]) as DatabaseSnapshot[K];
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
    const eventRows = await queryRows<BusinessEvent & Record<string, unknown>>(client, `SELECT * FROM events WHERE business_id IN (${businessScope}) ORDER BY id`, [userId]);
    const events = eventRows.map(row => Object.fromEntries(Object.entries(row).filter(([key, value]) =>
      value !== null && !(key === 'businessId' && row.type !== 'daily_report_ready'),
    )) as BusinessEvent);
    const notifications = await entities('notifications', 'notifications', 'user_id = $1', 'id, user_id, event_id, created_at, read_at');
    const periodRows = await queryRows<Omit<ReportPeriod, 'buckets'>>(client, 'SELECT * FROM report_periods ORDER BY id');
    const buckets = await queryRows<ReportBucket & { periodId: number }>(client, 'SELECT * FROM report_buckets ORDER BY starts_at');
    const periods = periodRows.map(period => ({ ...period, buckets: buckets.filter(bucket => bucket.periodId === period.id).map(({ periodId, ...bucket }) => bucket) }));
    const [overviewRow] = await queryRows<Record<string, number>>(client, 'SELECT * FROM overview_snapshots WHERE business_id = $1 ORDER BY as_of DESC, id DESC LIMIT 1', [metadata.activeBusinessId]);
    if (!overviewRow) throw new Error('Overview snapshot missing');
    const overview = { id: overviewRow.id, businessId: overviewRow.businessId, startsAt: overviewRow.startsAt, asOf: overviewRow.asOf } as OverviewSnapshot;
    for (const group of ['sales', 'inventory', 'suppliers', 'cash'] as const) {
      Object.assign(overview, { [group]: Object.fromEntries(Object.entries(overviewRow)
        .filter(([key]) => key.startsWith(group))
        .map(([key, value]) => { const metric = key.slice(group.length); return [metric[0].toLowerCase() + metric.slice(1), value]; })) });
    }
    async function history<K extends 'salesHistory' | 'inventoryHistory' | 'cashHistory' | 'companyHistory'>(key: K, kind: string): Promise<DatabaseSnapshot[K]> {
      const datasets = await queryRows<Omit<Dataset<unknown>, 'points'>>(client, `SELECT * FROM ${kind}_datasets WHERE business_id IN (${businessScope}) ORDER BY id`, [userId]);
      const points = await queryRows<{ datasetId: number; periodId: number; bucketId: number }>(client,
        `SELECT p.* FROM ${kind}_points p JOIN report_buckets b ON b.id = p.bucket_id WHERE p.dataset_id IN (SELECT id FROM ${kind}_datasets WHERE business_id IN (${businessScope})) ORDER BY b.starts_at`, [userId]);
      return datasets.map(dataset => ({ ...dataset, points: points.filter(point => point.datasetId === dataset.id).map(({ datasetId, periodId, ...point }) => point) })) as DatabaseSnapshot[K];
    }
    const salesHistory = await history('salesHistory', 'sales');
    const inventoryHistory = await history('inventoryHistory', 'inventory');
    const cashHistory = await history('cashHistory', 'cash');
    const companyHistory = await history('companyHistory', 'company');
    await client.query('COMMIT');
    return { metadata, overview, users, businesses, branches, memberships, systems, sales, products, stock, suppliers, cashTransactions, events, notifications, periods, salesHistory, inventoryHistory, cashHistory, companyHistory };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
