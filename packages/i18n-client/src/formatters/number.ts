import { LOCALE_BCP47, type Locale } from '../config/locales.js';

export function formatNumber(
  value: number,
  locale: Locale,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(LOCALE_BCP47[locale], options).format(value);
}

// Format a fractional value (0.05 → "5 %"). Pass `0.05`, not `5`.
export function formatPercent(value: number, locale: Locale): string {
  return formatNumber(value, locale, {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
}
