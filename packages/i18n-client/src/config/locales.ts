// Tukio supported locales — bilingual FR/EN per PRD NFR56-58.
// MVP: linguistic bilingualism (not geographic) — both locales available
// regardless of country code.
export const LOCALES = ['fr', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

// Default for first-visit users whose Accept-Language doesn't match any
// supported Tukio locale. We picked `en` (not `fr`) because:
// 1. The marketplace is repositioned as France-wide (not Pays-de-la-Loire-only),
//    so the audience extends beyond strictly francophone visitors.
// 2. Browser language detection (`localeDetection: true` in
//    `createTukioI18nMiddleware`) already routes French-speaking visitors to
//    `/fr/...` via Accept-Language — this constant is the EDGE-CASE fallback
//    for browsers that report a non-FR, non-EN language. `en` is the safer
//    international default.
// 3. Persisted locale (cookie `NEXT_LOCALE`) overrides this on subsequent visits.
export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_LABELS: Record<Locale, string> = {
  fr: 'Français',
  en: 'English',
};

// Emoji flags consumed by LocaleSwitcher pattern (Story 0.5).
export const LOCALE_FLAGS: Record<Locale, string> = {
  fr: '🇫🇷',
  en: '🇬🇧',
};

// BCP 47 tags used by Intl.* APIs (date, number, currency formatters).
export const LOCALE_BCP47: Record<Locale, string> = {
  fr: 'fr-FR',
  en: 'en-GB',
};

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}
