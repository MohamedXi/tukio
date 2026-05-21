import type { MetadataRoute } from 'next';

// Story 0.15 stub. Story 0.21 will deliver the full robots.txt with sitemap
// reference + per-locale disallows once the public site goes live.
//
// Disallow list notes (post code-review patches P2/P3/P9):
//   - Private/auth paths are listed per locale (crawlers prefix-match
//     literally, so `/auth/` would NOT cover `/fr/auth/sign-up`).
//   - `/account/` and `/auth/` stay in the BASE rule so they remain
//     disallowed after the flag flips OFF at launch (they're private
//     transactional surfaces, never indexable).
//   - The Next.js route group `(authenticated)` is a filesystem-only
//     convention that never appears in URLs — no point listing it.
export default function robots(): MetadataRoute.Robots {
  const isComingSoon = process.env.NEXT_PUBLIC_COMING_SOON_MODE === 'true';
  const baseDisallow = [
    '/api/',
    '/_next/',
    '/fr/auth/',
    '/en/auth/',
    '/fr/account/',
    '/en/account/',
  ];
  return {
    rules: [
      isComingSoon
        ? // Pre-launch: keep all Epic 1+ surfaces off the index. The
          // landing copy lives only at /(fr|en)/coming-soon (whitelist).
          {
            userAgent: '*',
            allow: ['/fr/coming-soon', '/en/coming-soon', '/'],
            disallow: [...baseDisallow, '/fr/', '/en/'],
          }
        : { userAgent: '*', allow: ['/'], disallow: baseDisallow },
    ],
    sitemap: 'https://tukio.one/sitemap.xml',
  };
}
