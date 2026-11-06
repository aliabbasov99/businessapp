import { getDatabase } from './database';

export type CardKey = 'dovriyye' | 'anbar' | 'techizatcilar' | 'kassa';
export type Metric = { label: string; value: number; unit: 'money' | 'count'; changePercent: number };
export type OverviewCard = { key: CardKey; title: string; main: Metric; details: Metric[] };

const money = (label: string, value: number, changePercent: number): Metric => ({ label, value, changePercent, unit: 'money' });

export function getOverviewCards(): OverviewCard[] {
  const { sales, inventory, suppliers, cash } = getDatabase().overview;
  return [
    {
      key: 'dovriyye', title: 'Dövriyyə',
      main: money('Satış', sales.revenueMinor, sales.revenueChangePercent),
      details: [money('Maya dəyəri', sales.costMinor, sales.costChangePercent), money('Mənfəət', sales.revenueMinor - sales.costMinor, sales.profitChangePercent)],
    },
    {
      key: 'anbar', title: 'Anbar',
      main: { label: 'Qalıq sayı', value: inventory.quantity, changePercent: inventory.quantityChangePercent, unit: 'count' },
      details: [money('Maya dəyəri ilə', inventory.costMinor, inventory.costChangePercent), money('Satış qiyməti ilə', inventory.retailMinor, inventory.retailChangePercent)],
    },
    {
      key: 'techizatcilar', title: 'Təchizatçılar',
      main: money('Firmaya borc', suppliers.debtMinor, suppliers.debtChangePercent),
      details: [money('Alış dəyəri', suppliers.purchasesMinor, suppliers.purchasesChangePercent), money('Faiz daxilolması', suppliers.interestMinor, suppliers.interestChangePercent)],
    },
    {
      key: 'kassa', title: 'Kassa qalığı',
      main: money('Qalıq pul', cash.inflowMinor - cash.outflowMinor, cash.balanceChangePercent),
      details: [money('Daxil olanlar', cash.inflowMinor, cash.inflowChangePercent), money('Ödənilən pullar', cash.outflowMinor, cash.outflowChangePercent)],
    },
  ];
}
