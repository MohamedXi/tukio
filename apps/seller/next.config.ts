import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Standalone server — Story 0.14 (cohérence avec apps/public, root-cause
  // fix du port leak observé en Story 0.13b).
  output: 'standalone',
};

export default nextConfig;
