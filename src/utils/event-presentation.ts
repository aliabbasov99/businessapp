import { getDatabase, getById } from '../data/database';
import type { BusinessEvent } from '../data/schema';
import { formatMoney, formatNumber, formatTime } from './format';

type Translate = (text: string) => string;
export function interpolate(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match));
}

export function presentEvent(event: BusinessEvent, locale: string, t: Translate) {
  if (event.type === 'daily_report_ready') {
    const body = t('Satış, maya dəyəri və mənfəət göstəricilərini hesabatlar bölməsində görə bilərsiniz.');
    return { title: t('Günün hesabatı hazırdır'), body, detail: body, sub: formatTime(event.occurredAt, locale), amount: '', icon: 'receipt' as const };
  }
  const branch = getById(getDatabase().branches, event.branchId);
  const time = formatTime(event.occurredAt, locale);
  const title = t(event.type === 'receipt_cancelled' ? 'Çek ləğv edilib' : 'Endirim tətbiq edilib');
  const amount = event.type === 'receipt_cancelled' ? formatMoney(event.amountMinor, locale) : `${formatNumber(event.discountPercent, locale)}%`;
  const values = { branch: t(branch.name), amount, receipt: event.receiptNumber, time, reason: event.type === 'receipt_cancelled' ? t(event.reason) : '' };
  const body = interpolate(t(event.type === 'receipt_cancelled'
    ? '{branch}: {amount} məbləğində çek ləğv edilib. Çek №{receipt} · Səbəb: {reason}.'
    : '{branch}: sifarişə {amount} endirim tətbiq edilib. Çek №{receipt}.'), values);
  return { title, body, detail: `${body} · ${time}`, sub: `${t(branch.name)} · ${time}`, amount, icon: event.type === 'receipt_cancelled' ? 'receipt' as const : 'percent' as const };
}
