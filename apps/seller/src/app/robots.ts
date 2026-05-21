import type { MetadataRoute } from 'next';

// Story 0.15 stub. Story 0.21 will deliver the full robots.txt with sitemap
// reference. seller.tukio.one is a Pro-only portal — pre-launch and after
// launch the `/seller/*` tree must never be indexed (post code-review P5,
// the disallow lives in the BASE rule for both flag states). Only the
// public `/seller-coming-soon` (pre-launch) and Story 0.18's `/devenir-pro`
// landing (post-launch) are crawler-visible.
export default function robots(): MetadataRoute.Robots {
  const isComingSoon = process.env.NEXT_PUBLIC_COMING_SOON_MODE === 'true';
  const baseDisallow = ['/api/', '/_next/', '/fr/seller/', '/en/seller/'];
  return {
    rules: [
      isComingSoon
        ? {
            userAgent: '*',
            allow: ['/fr/seller-coming-soon', '/en/seller-coming-soon', '/'],
            disallow: [...baseDisallow, '/fr/', '/en/'],
          }
        : { userAgent: '*', allow: ['/'], disallow: baseDisallow },
    ],
    sitemap: 'https://seller.tukio.one/sitemap.xml',
  };
}
