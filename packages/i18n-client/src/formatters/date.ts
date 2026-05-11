import { LOCALE_BCP47, type Locale } from '../config/locales';
import { DEFAULT_TIME_ZONE } from '../config/time-zones';

// Tukio always renders dates in Europe/Paris (MVP business is FR-only).
// V2+ will accept per-user time zones for international users.
function bcp47(locale: Locale): string {
  return LOCALE_BCP47[locale];
}

function toValidDate(value: Date | string, fnName: string): Date {
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) {
    throw new RangeError(`[${fnName}] received an invalid date: ${String(value)}`);
  }
  return d;
}

export function formatDate(
  date: Date | string,
  locale: Locale,
  options?: Intl.DateTimeFormatOptions,
): string {
  const value = toValidDate(date, 'formatDate');
  return new Intl.DateTimeFormat(bcp47(locale), {
    dateStyle: 'long',
    timeZone: DEFAULT_TIME_ZONE,
    ...options,
  }).format(value);
}

export function formatDateTime(
  date: Date | string,
  locale: Locale,
  options?: Intl.DateTimeFormatOptions,
): string {
  const value = toValidDate(date, 'formatDateTime');
  return new Intl.DateTimeFormat(bcp47(locale), {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: DEFAULT_TIME_ZONE,
    ...options,
  }).format(value);
}

// Renders a date range with single-month optimization:
//   formatDateRange('2026-06-15', '2026-06-22', 'fr') → "15 – 22 juin 2026"
//   formatDateRange('2026-06-15', '2026-07-02', 'fr') → "15 juin – 2 juillet 2026"
// Uses Intl.DateTimeFormat#formatRange (Stage 4, supported in Node 18+).
//
// Defensive: if `from > to` (inverted by caller mistake or data bug),
// `Intl.formatRange` throws RangeError in modern browsers. We swap to render
// the chronological range rather than crash a Server Component.
export function formatDateRange(
  from: Date | string,
  to: Date | string,
  locale: Locale,
  options?: Intl.DateTimeFormatOptions,
): string {
  const fromDate = toValidDate(from, 'formatDateRange');
  const toDate = toValidDate(to, 'formatDateRange');
  const [start, end] =
    fromDate.getTime() <= toDate.getTime() ? [fromDate, toDate] : [toDate, fromDate];
  return new Intl.DateTimeFormat(bcp47(locale), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: DEFAULT_TIME_ZONE,
    ...options,
  }).formatRange(start, end);
}
