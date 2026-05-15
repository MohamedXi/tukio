import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const config: NextConfig = {
  async rewrites() {
    const customerHost = process.env.NEXT_PUBLIC_CUSTOMER_HOST ?? 'https://customer.tukio.one';
    const sellerHost = process.env.NEXT_PUBLIC_SELLER_HOST ?? 'https://seller.tukio.one';
    return [
      // /{locale}/account/* and /{locale}/cart/* → customer app (ADR-0013)
      {
        source: '/:locale/account/:path*',
        destination: `${customerHost}/:locale/account/:path*`,
      },
      {
        source: '/:locale/cart/:path*',
        destination: `${customerHost}/:locale/cart/:path*`,
      },
      // /{locale}/seller/* → seller app
      {
        source: '/:locale/seller/:path*',
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
