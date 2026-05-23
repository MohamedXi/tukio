import type { MetadataRoute } from 'next';

// Locale-prefixed paths because crawlers prefix-match literally —
// `/auth/` would NOT cover `/fr/auth/sign-up` (Story 0.15 post-review P9).
// `/account/`, `/cart/`, `/checkout/`, `/auth/` stay disallowed in BOTH states:
// they are private/transactional surfaces, never indexable.
const PRIVATE_DISALLOW = [
  '/api/',
  '/_next/',
  '/fr/auth/',
  '/en/auth/',
  '/fr/account/',
  '/en/account/',
  '/fr/cart/',
  '/en/cart/',
  '/fr/checkout/',
  '/en/checkout/',
];

// Pre-launch whitelist — every other Epic 1+ surface is hidden via the
// `/fr/`+`/en/` blanket disallow. Story 0.18 `/devenir-pro` lives on
// seller.tukio.one and is not relevant here.
const PRE_LAUNCH_ALLOW = [
  '/',
  '/fr/coming-soon',
  '/en/coming-soon',
  '/fr/a-propos',
  '/en/a-propos',
  '/fr/confidentialite',
  '/en/confidentialite',
  '/fr/mentions-legales',
  '/en/mentions-legales',
  '/fr/contact',
  '/en/contact',
];

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://tukio.one';
  const isComingSoon = process.env.NEXT_PUBLIC_COMING_SOON_MODE === 'true';

  return {
    rules: [
      isComingSoon
        ? {
            userAgent: '*',
            allow: PRE_LAUNCH_ALLOW,
            disallow: [...PRIVATE_DISALLOW, '/fr/', '/en/'],
          }
        : { userAgent: '*', allow: ['/'], disallow: PRIVATE_DISALLOW },
      { userAgent: 'GPTBot', disallow: ['/'] },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
