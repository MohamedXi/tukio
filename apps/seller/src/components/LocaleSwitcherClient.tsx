'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { LocaleSwitcher } from '@tukio/ui/top-bar';

/**
 * Client-side wrapper around the presentational `<LocaleSwitcher>` pattern.
 * Mirrors `apps/public/src/components/LocaleSwitcherClient.tsx` — kept per-app
 * because `@tukio/ui` is Next-agnostic and shouldn't import next/navigation.
 *
 * Switching replaces the first path segment with the new locale code (works
 * under `localePrefix: 'always'`). `next-intl` middleware writes the
 * `NEXT_LOCALE` cookie on the next request → persistence across sessions.
 */
export function LocaleSwitcherClient() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();

  const handleChange = (newLocale: string) => {
    const segments = pathname.split('/');
    segments[1] = newLocale;
    router.push(segments.join('/'));
  };

  return <LocaleSwitcher locale={locale} onLocaleChange={handleChange} />;
}
