import { LOCALE_BCP47, type Locale } from '../config/locales.js';
import { DEFAULT_TIME_ZONE } from '../config/time-zones.js';

// Tukio always renders dates in Europe/Paris (MVP business is FR-only).
// V2+ will accept per-user time zones for international users.
function bcp47(locale: Locale): string {
  return LOCALE_BCP47[locale];
}

export function formatDate(
  date: Date | string,
  locale: Locale,
  options?: Intl.DateTimeFormatOptions,
): string {
  const value = typeof date === 'string' ? new Date(date) : date;
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
  const value = typeof date === 'string' ? new Date(date) : date;
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
// Uses Intl.DateTimeFormat#formatRange (Stage 4, supported in Node 18+ and
// modern browsers).
export function formatDateRange(
  from: Date | string,
  to: Date | string,
  locale: Locale,
  options?: Intl.DateTimeFormatOptions,
): string {
  const fromDate = typeof from === 'string' ? new Date(from) : from;
  const toDate = typeof to === 'string' ? new Date(to) : to;
  return new Intl.DateTimeFormat(bcp47(locale), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: DEFAULT_TIME_ZONE,
    ...options,
  }).formatRange(fromDate, toDate);
}
