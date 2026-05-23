import type { MetadataRoute } from 'next';
import { LOCALES, DEFAULT_LOCALE } from '@tukio/i18n-client/config';

// Static lastModified (Story 0.15 post-review P4) — recomputing per request
// defeats crawler caches and inflates re-crawl frequency for no benefit.
const LAST_MODIFIED = new Date('2026-05-23T00:00:00Z');

const ROUTES = [{ path: '/seller-coming-soon', priority: 1.0, changeFrequency: 'weekly' as const }];

export default function sitemap(): MetadataRoute.Sitemap {
  const sellerBaseUrl = process.env.NEXT_PUBLIC_SELLER_BASE_URL ?? 'https://seller.tukio.one';

  // 1 route × 2 locales = 2 entries today. Post-launch, more public pages
  // (e.g. pricing, features) will land here via the same flatMap pattern.
  return ROUTES.flatMap((route) =>
    LOCALES.map((locale) => ({
      url: `${sellerBaseUrl}/${locale}${route.path}`,
      lastModified: LAST_MODIFIED,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
      alternates: {
        languages: {
          fr: `${sellerBaseUrl}/fr${route.path}`,
          en: `${sellerBaseUrl}/en${route.path}`,
          'x-default': `${sellerBaseUrl}/${DEFAULT_LOCALE}${route.path}`,
        },
      },
    })),
  );
}
