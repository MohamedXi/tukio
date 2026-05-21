import type { MetadataRoute } from 'next';

// Story 0.15 minimal sitemap. Story 0.21 will expand to all public pages ×
// locales with hreflang alternates + priority + changeFrequency.
//
// `lastModified` uses a static deploy-time constant (post code-review P4)
// rather than `new Date()` — recomputing per request defeats crawler
// caching and inflates re-crawl frequency for no benefit.
const LAST_MODIFIED = new Date('2026-05-21T00:00:00Z');

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://tukio.one';
  return [
    {
      url: `${base}/fr/coming-soon`,
      lastModified: LAST_MODIFIED,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${base}/en/coming-soon`,
      lastModified: LAST_MODIFIED,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
  ];
}
