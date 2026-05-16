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
      // Two entries: bare `/fr/seller` + `/fr/seller/*` — the path-to-regexp
      // {/:path*} optional-group syntax used pre-Story 0.14 broke under
      // Next.js 16's stricter rewrite parser. Trailing slash (`/fr/seller/`)
      // is normalised by Next.js default trailingSlash:false before rewrites.
      {
        source: '/:locale/seller',
        destination: `${sellerHost}/:locale/seller`,
      },
      {
        source: '/:locale/seller/:path*',
        destination: `${sellerHost}/:locale/seller/:path*`,
      },
    ];
  },

  // Transpile workspace source packages so Turbopack resolves their `.js`
  // import extensions (TS NodeNext convention) to the `.ts` sources during
  // `next build`. Without this, the build fails with:
  //   "Module not found: Can't resolve './envelope-handler.js'" inside
  //   `@tukio/api-client/src/client/axios-client.ts`.
  transpilePackages: [
    '@tukio/api-client',
    '@tukio/auth-client',
    '@tukio/contracts',
    '@tukio/i18n-client',
    '@tukio/ui',
  ],

  // Tree-shaking for @tukio/* shared packages (ADR-0011).
  experimental: {
    optimizePackageImports: ['@tukio/ui', '@tukio/i18n-client', '@tukio/api-client'],
  },

  // Webpack `resolve.extensionAlias` strips the `.js` extension used by
  // workspace packages (per AGENTS code-style: "ESM source files use `.js`
  // import extensions so the same source compiles for both bundler and Node
  // ESM consumers"). Without this, webpack cannot resolve relative imports
  // like `from './envelope-handler.js'` against the actual `.ts` source.
  // `transpilePackages` alone does not configure extension fallback.
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };
    return config;
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
