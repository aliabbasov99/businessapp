import { getDatabase, getById } from './database';
import type { BranchSelection, Sale } from './schema';

export const getActiveUser = () => getById(getDatabase().users, getDatabase().metadata.activeUserId);
export const getActiveBusiness = () => getById(getDatabase().businesses, getDatabase().metadata.activeBusinessId);

export function getBranches(businessId = getActiveBusiness().id) {
  return getDatabase().branches.filter(branch => branch.businessId === businessId);
}

export function getUserBusinesses(userId = getActiveUser().id) {
  return getDatabase().memberships.filter(item => item.userId === userId).map(membership => ({
    ...getById(getDatabase().businesses, membership.businessId),
    role: membership.role,
    branchCount: getBranches(membership.businessId).length,
  }));
}

export function getUserSystems(userId = getActiveUser().id) {
  const businessIds = new Set(getUserBusinesses(userId).map(item => item.id));
  return getDatabase().systems.filter(item => businessIds.has(item.businessId)).map(system => ({
    ...system, business: getById(getDatabase().businesses, system.businessId),
  }));
}

function selectedBranches(branchId: BranchSelection) {
  return new Set(getBranches().filter(branch => branchId === null || branch.id === branchId).map(branch => branch.id));
}

export function getRecentSales(branchId: BranchSelection = null, limit?: number): Sale[] {
  const ids = selectedBranches(branchId);
  const sales = getDatabase().sales.filter(sale => ids.has(sale.branchId)).sort((a, b) => b.occurredAt - a.occurredAt || b.id - a.id);
  return limit === undefined ? sales : sales.slice(0, limit);
}

export function getInventory(branchId: BranchSelection = null) {
  const ids = selectedBranches(branchId);
  const quantities = new Map<number, number>();
  for (const row of getDatabase().stock) {
    if (ids.has(row.branchId)) quantities.set(row.productId, (quantities.get(row.productId) ?? 0) + row.quantity);
  }
  return Array.from(quantities, ([productId, quantity]) => {
    const product = getById(getDatabase().products, productId);
    return { ...product, quantity, stockAmountMinor: Math.round(product.costPriceMinor * quantity) };
  });
}

export function getSuppliers() {
  return getDatabase().suppliers.filter(item => item.businessId === getActiveBusiness().id);
}

export function getCashTransactions(branchId: BranchSelection = null) {
  const ids = selectedBranches(branchId);
  return getDatabase().cashTransactions.filter(item => ids.has(item.branchId)).sort((a, b) => b.occurredAt - a.occurredAt || b.id - a.id);
}

export function getEvents(branchId: BranchSelection = null) {
  const ids = selectedBranches(branchId);
  return getDatabase().events.filter(event => 'branchId' in event
    ? ids.has(event.branchId)
    : event.businessId === getActiveBusiness().id,
  ).sort((a, b) => b.occurredAt - a.occurredAt || b.id - a.id);
}

export function getNotifications(userId = getActiveUser().id) {
  return getDatabase().notifications.filter(item => item.userId === userId)
    .sort((a, b) => b.createdAt - a.createdAt || b.id - a.id);
}

export function paymentLabel(sale: Sale) {
  if (sale.type === 'refund') return sale.paymentMethod === 'cash' ? 'Nağd qaytarma' : 'Kartla qaytarma';
  return sale.paymentMethod === 'cash' ? 'Nağd ödəniş' : 'Kartla ödəniş';
}
