import type { Config } from 'jest';

// Integration test config — runs `*.integration.spec.ts` specs that depend on
// testcontainers (Keycloak + Postgres). Requires `pnpm docker:up:wait` OR
// network access for the containers to start. Excluded from the default
// `pnpm test` (unit) run via `testPathIgnorePatterns`.
//
// Story 1.2b — runs alongside unit jest config, sharing transform + module
// resolution. Use:
//   pnpm --filter=identity-svc test:integration
const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '\\.integration\\.spec\\.ts$',
  testTimeout: 180_000, // testcontainer boots (Keycloak ~10-20s, Postgres ~3s).
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'commonjs',
          moduleResolution: 'node',
          esModuleInterop: true,
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          resolvePackageJsonExports: false,
          allowJs: true,
          target: 'ES2022',
        },
      },
    ],
  },
  transformIgnorePatterns: ['/node_modules/(?!.*?(jose|testcontainers)/)'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@tukio/contracts$': '<rootDir>/../../../packages/contracts/src/index.ts',
    '^@tukio/contracts/(.*)\\.js$': [
      '<rootDir>/../../../packages/contracts/src/$1.ts',
      '<rootDir>/../../../packages/contracts/src/$1.exception.ts',
      '<rootDir>/../../../packages/contracts/src/$1/index.ts',
    ],
    '^@tukio/contracts/(.*)$': [
      '<rootDir>/../../../packages/contracts/src/$1.ts',
      '<rootDir>/../../../packages/contracts/src/$1.exception.ts',
      '<rootDir>/../../../packages/contracts/src/$1/index.ts',
    ],
    '^@tukio/testing/(.*)\\.js$': [
      '<rootDir>/../../../packages/testing/src/$1.ts',
      '<rootDir>/../../../packages/testing/src/$1/index.ts',
    ],
    '^@tukio/testing/(.*)$': [
      '<rootDir>/../../../packages/testing/src/$1.ts',
      '<rootDir>/../../../packages/testing/src/$1/index.ts',
    ],
  },
  testEnvironment: 'node',
  // Run integration specs sequentially — testcontainer pools must not overlap.
  maxWorkers: 1,
};

export default config;
