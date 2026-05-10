import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

export default defineConfig({
  plugins: [
    swc.vite({
      jsc: {
        parser: { syntax: 'typescript', decorators: true, dynamicImport: true },
        transform: { decoratorMetadata: true, legacyDecorator: true },
        target: 'es2022',
      },
      module: { type: 'es6' },
    }),
  ],
  test: {
    environment: 'node',
    globals: false,
    coverage: {
      provider: 'v8',
      thresholds: { lines: 85, functions: 85, branches: 80, statements: 85 },
      exclude: [
        '**/__tests__/**',
        '**/*.spec.ts',
        '**/index.ts',
        '**/tokens.ts',
        '**/*.module.ts',
        '**/types/**',
        '**/exceptions/index.ts',
        '**/types/index.ts',
        '**/decorators/**', // simple SetMetadata wrappers, tested via guards
      ],
    },
  },
});
