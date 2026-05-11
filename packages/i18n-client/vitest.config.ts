import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: false,
    coverage: {
      provider: 'v8',
      // Thresholds aligned with Story 0.9 AC16 (≥ 80 %) after review patches
      // added defensive guards in formatters + Hreflang and the corresponding
      // tests.
      thresholds: { lines: 85, functions: 85, branches: 80, statements: 85 },
      exclude: [
        '**/__tests__/**',
        '**/*.spec.{ts,tsx}',
        '**/index.ts',
        '**/types/index.ts',
        '**/formatters/index.ts',
        '**/config/next-intl.config.ts', // Server Component factory, tested via apps wiring
      ],
    },
  },
});
