import { LOCALE_BCP47, type Locale } from '../config/locales';

// Money fields in @tukio/contracts are stored in CENTS (integer, never float)
// per ADR-014. This invariant is the entire reason `Money.amount` is `number`
// constrained to integer — passing a float here is always a caller bug, so
// we throw rather than silently rendering "0,9999 €".
//
// Examples:
//   formatCurrency(80000, 'EUR', 'fr') → "800,00 €"
//   formatCurrency(80000, 'EUR', 'en') → "€800.00"
//   formatCurrency(99,    'EUR', 'fr') → "0,99 €"
export function formatCurrency(amountInCents: number, currency: 'EUR', locale: Locale): string {
  if (!Number.isInteger(amountInCents)) {
    throw new TypeError(
      `[formatCurrency] expected integer cents (ADR-014 Money invariant), got ${amountInCents}`,
    );
  }
  return new Intl.NumberFormat(LOCALE_BCP47[locale], {
    style: 'currency',
    currency,
    currencyDisplay: 'symbol',
  }).format(amountInCents / 100);
}
