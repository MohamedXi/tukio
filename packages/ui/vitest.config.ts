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
      exclude: ['src/**/__tests__/**', 'src/**/*.spec.ts', 'src/**/*.test.ts'],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
      },
    },
  },
});
