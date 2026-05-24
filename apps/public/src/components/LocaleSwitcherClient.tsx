'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { LocaleSwitcher } from '@tukio/ui/top-bar';

/**
 * Client-side wrapper around the presentational `<LocaleSwitcher>` pattern.
 *
 * - Reads current locale via `next-intl`'s `useLocale()`.
 * - Switches by replacing the first path segment with the new locale code
 *   (works under `localePrefix: 'always'` — every URL is prefixed).
 * - `next-intl` middleware auto-writes the `NEXT_LOCALE` cookie on the next
 *   request so the user's choice persists across sessions until cookies are
 *   cleared (long-term persistence per user requirement).
 */
export function LocaleSwitcherClient() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();

  const handleChange = (newLocale: string) => {
    // Replace the locale segment (index 1 — index 0 is empty before leading `/`).
    const segments = pathname.split('/');
    segments[1] = newLocale;
    router.push(segments.join('/'));
  };

  return <LocaleSwitcher locale={locale} onLocaleChange={handleChange} />;
}
