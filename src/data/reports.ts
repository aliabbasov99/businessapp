import { formatDay, formatMonth, formatWeekday } from '../utils/format';
import { getDatabase } from './database';
import { getActiveBusiness } from './queries';
import type { BranchSelection, CashPoint, CompanyPoint, Dataset, InventoryPoint, PeriodData, ReportPeriod, SalesPoint, SeriesItem } from './schema';

export const REPORT_PERIODS = ['Həftə', 'Ay', 'İl'];
export const REPORT_PERIOD_LABELS = ['Bu həftə', 'Bu ay', 'Son 12 ay'];

type SeriesDefinition<Point> = Omit<SeriesItem, 'values'> & { value: (point: Point) => number };
const salesSeries: SeriesDefinition<SalesPoint>[] = [
  { key: 'customers', name: 'Müştərilər', color: '#ff7900', isCurrency: false, value: point => point.customerCount },
  { key: 'revenue', name: 'Satış Məbləği', color: '#00bf8d', isCurrency: true, area: true, value: point => point.revenueMinor / 100 },
  { key: 'cost', name: 'Maya Dəyəri', color: '#ff4348', isCurrency: true, value: point => point.costMinor / 100 },
  { key: 'profit', name: 'Mənfəət', color: '#054f96', isCurrency: true, value: point => (point.revenueMinor - point.costMinor) / 100 },
];
const inventorySeries: SeriesDefinition<InventoryPoint>[] = [
  { key: 'sales', name: 'Satış Məbləği', color: '#3980ff', isCurrency: true, value: point => point.salesMinor / 100 },
  { key: 'cost', name: 'Maya Dəyəri', color: '#ff4348', isCurrency: true, area: true, value: point => point.costMinor / 100 },
  { key: 'quantity', name: 'Miqdar', color: '#00bf8d', isCurrency: false, value: point => point.quantity },
  { key: 'unsoldAmount', name: 'Satılmayan Məbləğ', color: '#ff9b00', isCurrency: true, value: point => point.unsoldAmountMinor / 100 },
  { key: 'unsoldQuantity', name: 'Satılmayan Miqdar', color: '#925cff', isCurrency: false, value: point => point.unsoldQuantity },
];
const cashSeries: SeriesDefinition<CashPoint>[] = [
  { key: 'balance', name: 'Balans', color: '#6d63ff', isCurrency: true, area: true, value: point => point.balanceMinor / 100 },
  { key: 'outflow', name: 'Gedən Pul', color: '#ff4348', isCurrency: true, value: point => point.outflowMinor / 100 },
  { key: 'inflow', name: 'Gələn Pul', color: '#00bf8d', isCurrency: true, value: point => point.inflowMinor / 100 },
];
const companySeries: SeriesDefinition<CompanyPoint>[] = [
  { key: 'balance', name: 'Balans', color: '#6d63ff', isCurrency: true, area: true, value: point => point.balanceMinor / 100 },
  { key: 'purchases', name: 'Alışlar', color: '#00bf8d', isCurrency: true, value: point => point.purchasesMinor / 100 },
  { key: 'payments', name: 'Ödənişlər', color: '#ff4348', isCurrency: true, value: point => point.paymentsMinor / 100 },
];

function chartData<Point extends { bucketId: number }>(period: ReportPeriod, points: Point[], definitions: SeriesDefinition<Point>[], locale: string): PeriodData {
  const ordered = period.buckets.map(bucket => {
    const point = points.find(item => item.bucketId === bucket.id);
    if (!point) throw new Error(`Missing report bucket: ${bucket.id}`);
    return point;
  });
  return {
    labels: period.buckets.map(bucket => period.code === 'week'
      ? formatWeekday(bucket.startsAt, locale)
      : period.code === 'year' ? formatMonth(bucket.startsAt, locale)
        : `${formatDay(bucket.startsAt, locale)}–${formatDay(bucket.endsAt - 1, locale)}`),
    series: definitions.map(({ value, ...definition }) => ({ ...definition, values: ordered.map(value) })),
  };
}

function historyData<Point extends { bucketId: number }>(datasets: Dataset<Point>[], definitions: SeriesDefinition<Point>[], locale: string) {
  return getDatabase().periods.map(period => {
    const dataset = datasets.find(item => item.businessId === getActiveBusiness().id && item.periodId === period.id);
    if (!dataset) throw new Error(`Missing history dataset: ${period.id}`);
    return chartData(period, dataset.points, definitions, locale);
  });
}

function closingSummary(data: PeriodData, key: string) {
  const values = data.series.find(series => series.key === key)!.values;
  const total = values[values.length - 1];
  const previous = values[values.length - 2];
  return { total, change: previous ? (total - previous) / Math.abs(previous) * 100 : 0 };
}

export function createReports(branchId: BranchSelection = null, locale = 'az-AZ') {
  const sales = getDatabase().periods.map(period => {
    const dataset = getDatabase().salesHistory.find(item => item.businessId === getActiveBusiness().id && item.periodId === period.id && item.branchId === branchId);
    if (!dataset) throw new Error(`Missing sales report: ${period.code}, branch ${branchId}`);
    const data = chartData(period, dataset.points, salesSeries, locale);
    // The annual chart includes one baseline month; total only the last 12.
    const points = period.code === 'year' ? dataset.points.slice(-12) : dataset.points;
    return { data, summary: { total: points.reduce((sum, point) => sum + point.revenueMinor, 0) / 100, change: dataset.changePercent } };
  });
  const inventory = historyData(getDatabase().inventoryHistory, inventorySeries, locale);
  const cash = historyData(getDatabase().cashHistory, cashSeries, locale);
  const company = historyData(getDatabase().companyHistory, companySeries, locale);
  const scopeLabel = branchId === null ? undefined : 'Bütün filiallar';
  return [
    { key: 'sales', title: 'Dövriyyə', chartTitle: 'Satış Göstəriciləri', data: sales.map(item => item.data), summaries: sales.map(item => item.summary), scopeLabel: undefined },
    { key: 'inventory', title: 'Anbarın maya dəyəri', chartTitle: 'Anbar Analizi', data: inventory, summaries: inventory.map(data => closingSummary(data, 'cost')), scopeLabel },
    { key: 'cash', title: 'Pul balansı', chartTitle: 'Pul Axını', data: cash, summaries: cash.map(data => closingSummary(data, 'balance')), scopeLabel },
    { key: 'company', title: 'Firma balansı', chartTitle: 'Firma Göstəriciləri', data: company, summaries: company.map(data => closingSummary(data, 'balance')), scopeLabel },
  ];
}
