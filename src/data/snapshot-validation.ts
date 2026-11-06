import type { DatabaseSnapshot } from './schema';

type Rule = (value: unknown) => boolean;
type Fields = Record<string, Rule>;
const text: Rule = value => typeof value === 'string';
const numeric: Rule = value => typeof value === 'number' && Number.isFinite(value);
const integer: Rule = value => typeof value === 'number' && Number.isSafeInteger(value);
const id: Rule = value => integer(value) && Number(value) > 0;
const nullable = (rule: Rule): Rule => value => value === null || rule(value);
const oneOf = (...values: string[]): Rule => value => typeof value === 'string' && values.includes(value);
const businessType = oneOf('restaurant', 'retail', 'accounting');
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid snapshot object');
  return value as Record<string, unknown>;
}
function fields(value: unknown, rules: Fields) {
  const row = record(value);
  for (const [key, valid] of Object.entries(rules)) {
    if (!valid(row[key])) throw new Error(`Invalid snapshot field: ${key}`);
  }
  return row;
}
function rows(value: unknown, rules: Fields) {
  if (!Array.isArray(value)) throw new Error('Invalid snapshot rows');
  return value.map(row => fields(row, rules));
}
const numericFields = (names: string, rule = numeric): Fields => Object.fromEntries(names.split(' ').map(name => [name, rule]));

/** Validate both HTTP responses and persisted snapshots before any screen reads them. */
export function assertSnapshot(value: unknown): asserts value is DatabaseSnapshot {
  const db = record(value);
  const meta = fields(db.metadata, { schemaVersion: value => value === 1, activeUserId: id, activeBusinessId: id, currency: text, timeZone: text, asOf: integer });
  // Invalid timezone strings otherwise fail later while rendering dates.
  new Intl.DateTimeFormat('en', { timeZone: String(meta.timeZone) });
  const users = rows(db.users, { id, name: text, email: text, phone: nullable(text) });
  const businesses = rows(db.businesses, { id, name: text, type: businessType });
  rows(db.memberships, { id, userId: id, businessId: id, role: oneOf('owner', 'manager') });
  rows(db.branches, { id, businessId: id, name: text, type: businessType });
  rows(db.systems, { id, businessId: id, type: oneOf('restaurant_pos', 'retail_inventory', 'accounting') });
  rows(db.sales, { id, branchId: id, receiptNumber: id, occurredAt: integer, amountMinor: integer, paymentMethod: oneOf('card', 'cash'), type: oneOf('sale', 'refund') });
  rows(db.products, { id, businessId: id, name: text, code: text, unit: oneOf('kg', 'liter', 'box', 'piece'), costPriceMinor: integer, salePriceMinor: integer });
  rows(db.stock, { id, branchId: id, productId: id, quantity: numeric });
  rows(db.suppliers, { id, businessId: id, name: text, taxId: text, phone: text, balanceMinor: integer, depositMinor: integer });
  rows(db.cashTransactions, { id, branchId: id, description: text, amountMinor: integer, account: oneOf('bank', 'cash'), occurredAt: integer });
  const events = rows(db.events, { id, occurredAt: integer, type: oneOf('receipt_cancelled', 'discount_applied', 'daily_report_ready') });
  for (const event of events) {
    if (event.type === 'daily_report_ready') fields(event, { businessId: id });
    else fields(event, { branchId: id, receiptNumber: id, ...(event.type === 'receipt_cancelled' ? { amountMinor: integer, reason: text } : { discountPercent: numeric }) });
  }
  rows(db.notifications, { id, userId: id, eventId: id, createdAt: integer, readAt: nullable(integer) });
  const periods = rows(db.periods, { id, code: oneOf('week', 'month', 'year') });
  for (const code of ['week', 'month', 'year']) {
    if (!periods.some(period => period.code === code)) throw new Error('Missing report period');
  }
  for (const period of periods) {
    if (!rows(period.buckets, { id, startsAt: integer, endsAt: integer }).length) throw new Error('Missing report buckets');
  }
  const overview = fields(db.overview, { id, businessId: id, startsAt: integer, asOf: integer });
  fields(overview.sales, { ...numericFields('revenueMinor costMinor', integer), ...numericFields('revenueChangePercent costChangePercent profitChangePercent') });
  fields(overview.inventory, { ...numericFields('costMinor retailMinor', integer), ...numericFields('quantity quantityChangePercent costChangePercent retailChangePercent') });
  fields(overview.suppliers, { ...numericFields('debtMinor purchasesMinor interestMinor', integer), ...numericFields('debtChangePercent purchasesChangePercent interestChangePercent') });
  fields(overview.cash, { ...numericFields('inflowMinor outflowMinor', integer), ...numericFields('balanceChangePercent inflowChangePercent outflowChangePercent') });
  const pointFields: Record<string, Fields> = {
    salesHistory: numericFields('customerCount revenueMinor costMinor', integer),
    inventoryHistory: { ...numericFields('salesMinor costMinor unsoldAmountMinor', integer), ...numericFields('quantity unsoldQuantity') },
    cashHistory: numericFields('balanceMinor inflowMinor outflowMinor', integer),
    companyHistory: numericFields('balanceMinor purchasesMinor paymentsMinor', integer),
  };
  for (const [key, pointRules] of Object.entries(pointFields)) {
    const datasets = rows(db[key], { id, businessId: id, periodId: id, ...(key === 'salesHistory' ? { branchId: nullable(id), changePercent: numeric } : {}) });
    for (const dataset of datasets) {
      const points = rows(dataset.points, { bucketId: id, ...pointRules });
      const period = periods.find(row => row.id === dataset.periodId);
      const buckets = period?.buckets as { id: number }[] | undefined;
      if (!buckets || points.length !== buckets.length || !buckets.every(bucket => points.some(point => point.bucketId === bucket.id))) throw new Error('Invalid dataset buckets');
    }
  }
  if (!users.some(user => user.id === meta.activeUserId) || !businesses.some(business => business.id === meta.activeBusinessId)) throw new Error('Missing active account');
  const snapshot = value as DatabaseSnapshot;
  const branchIds = snapshot.branches.filter(branch => branch.businessId === meta.activeBusinessId).map(branch => branch.id);
  for (const period of snapshot.periods) {
    for (const branchId of [null, ...branchIds]) {
      if (!snapshot.salesHistory.some(dataset => dataset.businessId === meta.activeBusinessId && dataset.periodId === period.id && dataset.branchId === branchId)) throw new Error('Missing sales dataset');
    }
    for (const history of [snapshot.inventoryHistory, snapshot.cashHistory, snapshot.companyHistory]) {
      if (!history.some(dataset => dataset.businessId === meta.activeBusinessId && dataset.periodId === period.id)) throw new Error('Missing report dataset');
    }
  }
}
