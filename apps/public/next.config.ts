import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

// Wires the next-intl Server Components config from src/i18n/request.ts.
// See @tukio/i18n-client/config/next-intl for the shared factory.
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // Story 0.9 — empty for now. Story Epic 7 may add image domains, headers, etc.
};

export default withNextIntl(nextConfig);
