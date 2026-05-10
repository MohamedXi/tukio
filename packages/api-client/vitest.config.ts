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
      // branches: 65 (vs spec 80 lines/statements) — axios retry backoff path
      // requires timer mocking that interacts poorly with axios-mock-adapter
      // (the response interceptor calls `client.request(cfg)` recursively which
      // mock-adapter cannot intercept the second time around in jsdom). Spec
      // AC16 requires ≥80 % on lines/statements only, branches lowered.
      thresholds: { lines: 80, functions: 80, branches: 65, statements: 80 },
      exclude: [
        '**/__tests__/**',
        '**/*.spec.{ts,tsx}',
        '**/index.ts',
        '**/types/index.ts',
        '**/hooks/*/index.ts',
      ],
    },
  },
});
