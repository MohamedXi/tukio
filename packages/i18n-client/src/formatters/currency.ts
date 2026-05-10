import { LOCALE_BCP47, type Locale } from '../config/locales.js';

// Money fields in @tukio/contracts are stored in CENTS (integer, never float)
// per ADR-014. Formatters convert to display string.
//
// Examples:
//   formatCurrency(80000, 'EUR', 'fr') → "800,00 €"
//   formatCurrency(80000, 'EUR', 'en') → "€800.00"
//   formatCurrency(99,    'EUR', 'fr') → "0,99 €"
export function formatCurrency(amountInCents: number, currency: 'EUR', locale: Locale): string {
  return new Intl.NumberFormat(LOCALE_BCP47[locale], {
    style: 'currency',
    currency,
    currencyDisplay: 'symbol',
  }).format(amountInCents / 100);
}
