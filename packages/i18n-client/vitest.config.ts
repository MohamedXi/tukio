import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: false,
    coverage: {
      provider: 'v8',
      thresholds: { lines: 80, functions: 80, branches: 75, statements: 80 },
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
