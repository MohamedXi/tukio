import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  output: 'standalone',

  // Transpile workspace source packages so Turbopack resolves their `.js`
  // import extensions (TS NodeNext convention) to the `.ts` sources.
  transpilePackages: [
    '@tukio/api-client',
    '@tukio/auth-client',
    '@tukio/contracts',
    '@tukio/i18n-client',
    '@tukio/ui',
  ],

  experimental: {
    optimizePackageImports: ['@tukio/ui', '@tukio/i18n-client', '@tukio/api-client'],
  },

  // Webpack extensionAlias so `.js` imports in workspace packages resolve
  // to `.ts/.tsx` sources (mirrors apps/public setup).
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };
    return config;
  },
};

export default withNextIntl(nextConfig);
