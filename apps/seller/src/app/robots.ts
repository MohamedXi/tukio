import type { MetadataRoute } from 'next';

// seller.tukio.one is a Pro-only portal — the `/seller/*` tree (dashboard,
// onboarding, listings) is private in BOTH states. Only the public-facing
// `/seller-coming-soon` landing (Story 0.18) is crawler-visible.
// Paths are locale-prefixed: crawlers prefix-match literally
// (Story 0.15 post-review P5/P9).
const PRIVATE_DISALLOW = ['/api/', '/_next/', '/fr/seller/', '/en/seller/'];

const PRE_LAUNCH_ALLOW = ['/', '/fr/seller-coming-soon', '/en/seller-coming-soon'];

export default function robots(): MetadataRoute.Robots {
  const sellerBaseUrl = process.env.NEXT_PUBLIC_SELLER_BASE_URL ?? 'https://seller.tukio.one';
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
    sitemap: `${sellerBaseUrl}/sitemap.xml`,
    host: sellerBaseUrl,
  };
}
