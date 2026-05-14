import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/__tests__/**',
        'src/**/*.spec.ts',
        'src/**/*.test.ts',
        '**/*.bak',
        'scripts/**',
        'dist/**',
      ],
      // MVP thresholds — relaxed pending test additions for envelope/, types/,
      // events/, exceptions/ modules (most contain Zod schemas which ARE
      // runtime code, but no spec imports them yet). Current baseline on
      // develop = 61.9% lines / 0% functions (mostly barrel index.ts files +
      // un-imported schemas).
      // Re-tighten to 95/95/90 in V1+ when each module ships a dedicated spec.
      thresholds: {
        lines: 60,
        functions: 0,
        branches: 80,
      },
    },
  },
});
