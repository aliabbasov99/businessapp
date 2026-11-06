/** Monetary values are signed integer qəpik; timestamps are Unix milliseconds. */
export type MoneyMinor = number;
export type Timestamp = number;
export type BusinessType = 'restaurant' | 'retail' | 'accounting';
export type Unit = 'kg' | 'liter' | 'box' | 'piece';
export type PeriodCode = 'week' | 'month' | 'year';
export type BranchSelection = number | null;

export interface User { id: number; name: string; email: string; phone: string | null }
export interface Business { id: number; name: string; type: BusinessType }
export interface Branch { id: number; businessId: number; name: string; type: BusinessType }
export interface Membership { id: number; userId: number; businessId: number; role: 'owner' | 'manager' }
export interface BusinessSystem { id: number; businessId: number; type: 'restaurant_pos' | 'retail_inventory' | 'accounting' }
export interface Sale {
  id: number;
  branchId: number;
  receiptNumber: number;
  occurredAt: Timestamp;
  amountMinor: MoneyMinor;
  paymentMethod: 'card' | 'cash';
  type: 'sale' | 'refund';
}
export interface Product {
  id: number;
  businessId: number;
  name: string;
  code: string;
  unit: Unit;
  costPriceMinor: MoneyMinor;
  salePriceMinor: MoneyMinor;
}
export interface StockBalance { id: number; branchId: number; productId: number; quantity: number }
export interface Supplier {
  id: number;
  businessId: number;
  name: string;
  taxId: string;
  phone: string;
  balanceMinor: MoneyMinor;
  depositMinor: MoneyMinor;
}
export interface CashTransaction {
  id: number;
  branchId: number;
  description: string;
  amountMinor: MoneyMinor;
  account: 'bank' | 'cash';
  occurredAt: Timestamp;
}
export type BusinessEvent =
  | { id: number; branchId: number; type: 'receipt_cancelled'; occurredAt: Timestamp; receiptNumber: number; amountMinor: MoneyMinor; reason: string }
  | { id: number; branchId: number; type: 'discount_applied'; occurredAt: Timestamp; receiptNumber: number; discountPercent: number }
  | { id: number; businessId: number; type: 'daily_report_ready'; occurredAt: Timestamp };
export interface AppNotification {
  id: number;
  userId: number;
  eventId: number;
  createdAt: Timestamp;
  readAt: Timestamp | null;
}
export interface ReportBucket { id: number; startsAt: Timestamp; endsAt: Timestamp }
export interface ReportPeriod { id: number; code: PeriodCode; buckets: ReportBucket[] }
export interface Dataset<Point> { id: number; businessId: number; periodId: number; points: Point[] }
export interface SalesPoint { bucketId: number; customerCount: number; revenueMinor: MoneyMinor; costMinor: MoneyMinor }
export interface SalesDataset extends Dataset<SalesPoint> { branchId: BranchSelection; changePercent: number }
export interface InventoryPoint { bucketId: number; salesMinor: MoneyMinor; costMinor: MoneyMinor; quantity: number; unsoldAmountMinor: MoneyMinor; unsoldQuantity: number }
export interface CashPoint { bucketId: number; balanceMinor: MoneyMinor; inflowMinor: MoneyMinor; outflowMinor: MoneyMinor }
export interface CompanyPoint { bucketId: number; balanceMinor: MoneyMinor; purchasesMinor: MoneyMinor; paymentsMinor: MoneyMinor }

/** Chart presentation types live here so the data layer never imports UI components. */
export interface SeriesItem { key: string; name: string; color: string; values: number[]; isCurrency: boolean; area?: boolean }
export interface PeriodData { labels: string[]; series: SeriesItem[]; yMin?: number; yMax?: number; yStep?: number }

export interface Metadata {
  schemaVersion: number;
  activeUserId: number;
  activeBusinessId: number;
  currency: string;
  timeZone: string;
  asOf: Timestamp;
}
export interface OverviewSnapshot {
  id: number;
  businessId: number;
  startsAt: Timestamp;
  asOf: Timestamp;
  sales: {
    revenueMinor: number;
    costMinor: number;
    revenueChangePercent: number;
    costChangePercent: number;
    profitChangePercent: number;
  };
  inventory: {
    quantity: number;
    costMinor: number;
    retailMinor: number;
    quantityChangePercent: number;
    costChangePercent: number;
    retailChangePercent: number;
  };
  suppliers: {
    debtMinor: number;
    purchasesMinor: number;
    interestMinor: number;
    debtChangePercent: number;
    purchasesChangePercent: number;
    interestChangePercent: number;
  };
  cash: {
    inflowMinor: number;
    outflowMinor: number;
    balanceChangePercent: number;
    inflowChangePercent: number;
    outflowChangePercent: number;
  };
}
export interface DatabaseSnapshot {
  metadata: Metadata;
  overview: OverviewSnapshot;
  users: User[];
  businesses: Business[];
  branches: Branch[];
  memberships: Membership[];
  systems: BusinessSystem[];
  sales: Sale[];
  products: Product[];
  stock: StockBalance[];
  suppliers: Supplier[];
  cashTransactions: CashTransaction[];
  events: BusinessEvent[];
  notifications: AppNotification[];
  periods: ReportPeriod[];
  salesHistory: SalesDataset[];
  inventoryHistory: Dataset<InventoryPoint>[];
  cashHistory: Dataset<CashPoint>[];
  companyHistory: Dataset<CompanyPoint>[];
}
