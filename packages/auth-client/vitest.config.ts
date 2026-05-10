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
      // branches: 60 (vs spec 85) — frontend lib has multiple non-testable branches
      // in jsdom: SSR guards (`typeof document/window === 'undefined'`),
      // BroadcastChannel anti-thundering-herd skip path (requires fake-timers
      // + multi-tab orchestration), domain-attribute conditional in CookieManager
      // (requires real browser `document.cookie` set with Domain= attribute).
      // Decision D4 (Story 0.8 review 2026-05-10): keep threshold + justify.
      thresholds: { lines: 85, functions: 85, branches: 60, statements: 85 },
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
