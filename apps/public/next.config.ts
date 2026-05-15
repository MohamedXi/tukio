import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const config: NextConfig = {
  // Standalone server (server.js + pruned node_modules) — Story 0.14.
  // Root-cause fix for the Next.js 16 + next-intl port leak in Location
  // headers (Story 0.13b). Bonus: ~50-80 MB image vs ~250 MB.
  output: 'standalone',

  async rewrites() {
    const sellerHost = process.env.NEXT_PUBLIC_SELLER_HOST ?? 'https://seller.tukio.one';
    return [
      // /{locale}/seller/* → seller app. Customer-area routes (`/account`,
      // `/cart`, …) are served locally by the (authenticated) route group
      // since Story 0.14 (ADR-016 supersedes ADR-013 multi-zones).
      {
        source: '/:locale/seller{/:path*}',
        destination: `${sellerHost}/:locale/seller/:path*`,
      },
    ];
  },

  // Tree-shaking for @tukio/* shared packages (ADR-0011).
  experimental: {
    optimizePackageImports: ['@tukio/ui', '@tukio/i18n-client', '@tukio/api-client'],
  },

  images: {
    remotePatterns: [
      // Cloudflare Images for listing photos (Story 3.4)
      { protocol: 'https', hostname: 'images.tukio.one' },
      { protocol: 'https', hostname: '*.cloudflareimages.com' },
    ],
  },
};

export default withNextIntl(config);
