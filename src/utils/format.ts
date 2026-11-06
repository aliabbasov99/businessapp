import { getDatabase } from '../data/database';

const numberFormats = new Map<string, Intl.NumberFormat>();
const dateFormats = new Map<string, Intl.DateTimeFormat>();

export function formatNumber(value: number, locale = 'az-AZ', fractionDigits = 2) {
  const key = `${locale}:${fractionDigits}`;
  let formatter = numberFormats.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: fractionDigits });
    numberFormats.set(key, formatter);
  }
  return `${value < 0 ? '−' : ''}${formatter.format(Math.abs(value))}`;
}

export function formatMoney(amountMinor: number, locale = 'az-AZ') {
  return `${formatNumber(amountMinor / 100, locale)} ₼`;
}

export function formatPercent(value: number, locale = 'az-AZ', arrow = false) {
  const amount = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Math.abs(value));
  return `${arrow ? (value > 0 ? '↑ ' : value < 0 ? '↓ ' : '→ ') : ''}${value > 0 ? '+' : value < 0 ? '−' : ''}${amount}%`;
}

function dateFormatter(locale: string, kind: 'time' | 'date' | 'day' | 'month' | 'weekday') {
  const timeZone = getDatabase().metadata.timeZone;
  const key = `${locale}:${kind}:${timeZone}`;
  let formatter = dateFormats.get(key);
  if (!formatter) {
    const options: Record<typeof kind, Intl.DateTimeFormatOptions> = {
      time: { hour: '2-digit', minute: '2-digit', hour12: false },
      date: { day: 'numeric', month: 'long', year: 'numeric' },
      day: { day: 'numeric' },
      month: { month: 'long' },
      weekday: { weekday: 'short' },
    };
    formatter = new Intl.DateTimeFormat(locale, { ...options[kind], timeZone: getDatabase().metadata.timeZone });
    dateFormats.set(key, formatter);
  }
  return formatter;
}

export const formatTime = (timestamp: number, locale = 'az-AZ') => dateFormatter(locale, 'time').format(timestamp);
export const formatDate = (timestamp: number, locale = 'az-AZ') => dateFormatter(locale, 'date').format(timestamp);
export const formatMonth = (timestamp: number, locale = 'az-AZ') => dateFormatter(locale, 'month').format(timestamp);
export const formatWeekday = (timestamp: number, locale = 'az-AZ') => dateFormatter(locale, 'weekday').format(timestamp);
export const formatDay = (timestamp: number, locale = 'az-AZ') => dateFormatter(locale, 'day').format(timestamp);

/** A grouping key in the business timezone, independent of the display language. */
export function dateKey(timestamp: number) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: getDatabase().metadata.timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(timestamp);
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)?.value).join('-');
}
