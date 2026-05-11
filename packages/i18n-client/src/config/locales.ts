// Tukio supported locales — bilingual FR/EN per PRD NFR56-58.
// MVP: linguistic bilingualism (not geographic) — both locales available
// regardless of country code.
export const LOCALES = ['fr', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

// Default for first-visit users without Accept-Language preference.
// Pays de la Loire / France-first launch → fr.
export const DEFAULT_LOCALE: Locale = 'fr';

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
