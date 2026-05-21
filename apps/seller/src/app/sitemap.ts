import type { MetadataRoute } from 'next';

// Story 0.15 minimal sitemap. Story 0.21 will expand to all seller-facing
// public pages × locales with hreflang alternates.
//
// `lastModified` uses a static deploy-time constant (post code-review P4)
// to keep crawler caches stable.
const LAST_MODIFIED = new Date('2026-05-21T00:00:00Z');

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://seller.tukio.one';
  return [
    {
      url: `${base}/fr/seller-coming-soon`,
      lastModified: LAST_MODIFIED,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${base}/en/seller-coming-soon`,
      lastModified: LAST_MODIFIED,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
  ];
}
