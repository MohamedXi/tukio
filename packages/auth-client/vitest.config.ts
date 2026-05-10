import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      // branches: 65 (not 80) — SSR guards (typeof document/window) are not testable in jsdom
      thresholds: { lines: 85, functions: 85, branches: 65, statements: 85 },
      exclude: [
        '**/__tests__/**',
        '**/*.spec.{ts,tsx}',
        '**/index.ts',
        '**/tokens.ts',
        '**/types/**',
        '**/providers/**', // AuthProvider tested via hook tests; full render is Story 1.x
        '**/middleware/**', // Next.js Edge runtime, minimal testable surface
      ],
    },
  },
});
