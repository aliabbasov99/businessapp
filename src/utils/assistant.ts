import { getDatabase } from '../data/database';
import { getEvents } from '../data/queries';
import { interpolate, presentEvent } from './event-presentation';
import { formatMoney, formatNumber, formatPercent } from './format';

export function assistantReply(text: string, locale: string, t: (text: string) => string) {
  const q = text.toLocaleLowerCase('az');
  const { sales, cash, inventory, suppliers } = getDatabase().overview;
  const money = (value: number) => formatMoney(value, locale);
  const render = (template: string, values: Record<string, string>) => interpolate(t(template), values);
  if (/kassa|pul|qalıq pul/.test(q)) return render('Kassa qalığı {balance} təşkil edir. Daxil olan vəsait {inflow}, ödənilən məbləğ isə {outflow}-dir.', {
    balance: money(cash.inflowMinor - cash.outflowMinor), inflow: money(cash.inflowMinor), outflow: money(cash.outflowMinor),
  });
  if (/anbar|məhsul/.test(q)) return render('Anbarda qalıq sayı {quantity}-dir. Maya dəyəri {cost}, satış qiyməti ilə dəyəri {retail} təşkil edir.', {
    quantity: formatNumber(inventory.quantity, locale), cost: money(inventory.costMinor), retail: money(inventory.retailMinor),
  });
  if (/təchizat|firma|borc/.test(q)) return render('Təchizatçılara borc {debt}, alış dəyəri {purchases}, faiz daxilolması isə {interest}-dir.', {
    debt: money(suppliers.debtMinor), purchases: money(suppliers.purchasesMinor), interest: money(suppliers.interestMinor),
  });
  if (/mənfəət|azal/.test(q)) return render('Mənfəət {profit}-dir. Əvvəlki dövrə nəzərən mənfəət: {profitChange}, satış: {revenueChange}, maya dəyəri: {costChange}.', {
    profit: money(sales.revenueMinor - sales.costMinor), profitChange: formatPercent(sales.profitChangePercent, locale), revenueChange: formatPercent(sales.revenueChangePercent, locale), costChange: formatPercent(sales.costChangePercent, locale),
  });
  if (/diqqət|hadisə|ləğv|bildiriş/.test(q)) return getEvents().filter(event => event.type !== 'daily_report_ready').map(event => presentEvent(event, locale, t).body).join(' ');
  if (/satış|icmal|dövriyyə/.test(q)) return render('Satış {revenue}, maya dəyəri {cost}, mənfəət isə {profit} təşkil edir.', {
    revenue: money(sales.revenueMinor), cost: money(sales.costMinor), profit: money(sales.revenueMinor - sales.costMinor),
  });
  return t('Satış, mənfəət, anbar, təchizatçılar və kassa haqqında soruşa bilərsiniz. Hansı göstəriciyə baxaq?');
}
