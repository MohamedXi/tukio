'use client';
import { useLocale } from 'next-intl';
import { isLocale, type Locale } from '../config/locales';

// Wrapper over next-intl's useLocale() that narrows the return type from
// `string` to Tukio's `Locale` union. The middleware (createTukioI18nMiddleware)
// is supposed to make invalid locales unreachable, so an unknown locale here
// indicates a configuration bug — we throw to fail loud rather than silently
// rendering broken content.
export function useCurrentLocale(): Locale {
  const raw = useLocale();
  if (!isLocale(raw)) {
    throw new Error(
      `[useCurrentLocale] Unknown locale "${raw}" — middleware should have blocked this. Check createTukioI18nMiddleware wiring.`,
    );
  }
  return raw;
}
