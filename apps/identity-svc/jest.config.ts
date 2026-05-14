import type { Config } from 'jest';

// Unit-test config — covers domain/ + usecases/ only (NFR71).
// Infrastructure coverage is enforced by E2E tests (test/jest-e2e.json) — see test:e2e:cov.
const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        // Inline tsconfig overrides forces CJS output regardless of
        // workspace `"type": "module"` (e.g. @tukio/contracts). Mirrors
        // the e2e config — without it ts-jest emits ESM for cross-package
        // imports and Node fails with "Unexpected token 'export'".
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
  transformIgnorePatterns: ['/node_modules/(?!.*?(jose)/)'],
  moduleNameMapper: {
    // Strip `.js` extension from relative imports (NodeNext ESM → ts-jest CJS).
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@tukio/contracts$': '<rootDir>/../../../packages/contracts/src/index.ts',
    // Resolve @tukio/contracts/* subpaths. Jest ignores package.json `exports`,
    // so we mirror its mapping by trying, in order:
    //   1. <name>.ts                   — direct file (e.g. types/Money.ts)
    //   2. <name>.exception.ts         — domain exceptions convention
    //   3. <name>/index.ts             — barrel folder
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
  },
  collectCoverageFrom: [
    'domain/**/*.ts',
    'usecases/**/*.ts',
    '!**/*.spec.ts',
    '!**/*.module.ts',
    '!**/index.ts',
    // tokens.ts is a constants file (Symbol DI tokens) — only used at infrastructure
    // wiring level, never directly imported by domain or use-case tests.
    '!domain/ports/tokens.ts',
  ],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  coverageThreshold: {
    global: {
      lines: 80,
      functions: 80,
      branches: 75,
      statements: 80,
    },
    'src/domain/**/*.ts': {
      lines: 80,
      functions: 80,
      branches: 75,
      statements: 80,
    },
    'src/usecases/**/*.ts': {
      lines: 70,
      functions: 70,
      branches: 65,
      statements: 70,
    },
  },
};

export default config;
