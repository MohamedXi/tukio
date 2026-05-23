import type { MetadataRoute } from 'next';
import { LOCALES, DEFAULT_LOCALE } from '@tukio/i18n-client/config';

// Static lastModified (Story 0.15 post-review P4) — recomputing per request
// defeats crawler caches and inflates re-crawl frequency for no benefit.
// Bumped each Story 0.21+ deploy that changes any indexable surface.
const LAST_MODIFIED = new Date('2026-05-23T00:00:00Z');

const ROUTES = [
  { path: '/coming-soon', priority: 1.0, changeFrequency: 'weekly' as const },
  { path: '/a-propos', priority: 0.7, changeFrequency: 'monthly' as const },
  { path: '/contact', priority: 0.6, changeFrequency: 'monthly' as const },
  { path: '/confidentialite', priority: 0.4, changeFrequency: 'yearly' as const },
  { path: '/mentions-legales', priority: 0.4, changeFrequency: 'yearly' as const },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://tukio.one';

  // 5 routes × 2 locales = 10 entries. Each entry carries hreflang alternates
  // for the language-switcher equivalent URL so Google can group them.
  return ROUTES.flatMap((route) =>
    LOCALES.map((locale) => ({
      url: `${baseUrl}/${locale}${route.path}`,
      lastModified: LAST_MODIFIED,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
      alternates: {
        languages: {
          fr: `${baseUrl}/fr${route.path}`,
          en: `${baseUrl}/en${route.path}`,
          'x-default': `${baseUrl}/${DEFAULT_LOCALE}${route.path}`,
        },
      },
    })),
  );
}
