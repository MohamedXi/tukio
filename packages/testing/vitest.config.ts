import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    // Testcontainers boot time + slow Keycloak realm import means tests can take
    // 30s+. Default Vitest 5s timeout is too tight.
    testTimeout: 90_000,
    hookTimeout: 120_000,
    coverage: {
      provider: 'v8',
      // testing has heavy I/O (real Docker containers); coverage threshold is
      // intentionally lower per Story 0.9 spec (≥ 70%).
      thresholds: { lines: 70, functions: 70, branches: 60, statements: 70 },
      exclude: [
        '**/__tests__/**',
        '**/*.spec.ts',
        '**/index.ts',
        '**/types.ts',
        '**/types.d.ts',
        // Container helpers + chaos helpers: thin wrappers over Docker — covered
        // by integration tests (run in CI nightly), unit testing in isolation
        // would mock everything and prove nothing.
        '**/testcontainers/**',
        '**/chaos/**',
      ],
    },
  },
});
