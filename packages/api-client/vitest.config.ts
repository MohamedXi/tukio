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
      // Thresholds aligned with Story 0.9 AC16 (≥ 80 %) after review patches —
      // additional tests cover the retry + correlation-id fallback paths plus
      // QueryProvider mutations.onError that the original suite missed.
      thresholds: { lines: 85, functions: 85, branches: 85, statements: 85 },
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
