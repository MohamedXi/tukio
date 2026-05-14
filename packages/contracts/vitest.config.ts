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
        // Type-only files (no runtime code — TS interfaces/types compile to
        // empty JS modules). v8 reports them as 0% which artificially
        // depresses the project coverage. Each is intentionally type-only:
        // they describe the shape consumed by other packages and have no
        // behavior to unit-test.
        'src/envelope/**', // ErrorBody, ErrorEnvelope, Meta, Method, Pagination, SuccessEnvelope — all interfaces
        'src/types/**', // Actor, Currency, DomainEvent, Locale, Money — all type aliases
        'src/index.ts', // root barrel — `export type` re-exports + 1 runtime `export { DomainException }` covered via subpath import
        'src/dtos/index.ts', // dtos barrel — `export type` re-exports only
      ],
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 90,
      },
    },
  },
});
