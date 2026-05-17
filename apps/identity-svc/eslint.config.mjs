// @ts-check
import eslint from '@eslint/js';
import boundaries from 'eslint-plugin-boundaries';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// I/O libs strictly forbidden in domain/ (Pattern Pretre — Story 0.6 AC2/AC8).
// Mirror of root eslint.config.mjs FORBIDDEN_IN_DOMAIN — kept in sync manually.
const FORBIDDEN_IN_DOMAIN = [
  '@nestjs/*',
  'typeorm',
  '@nestjs/typeorm',
  '@nestjs/config',
  '@nestjs/platform-fastify',
  'axios',
  'pg',
  'keycloak-connect',
  'stripe',
  '@tukio/messaging',
  '@tukio/auth',
  'pino',
  'nestjs-pino',
  'pino-http',
  'pino-pretty',
  'rxjs',
];

export default tseslint.config(
  {
    ignores: [
      'eslint.config.mjs',
      'jest.config.ts',
      'dist/**',
      'coverage/**',
      'node_modules/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'module',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
    },
  },
  // Pattern Pretre Clean Architecture boundaries (Story 0.6 AC2/AC8) — STRICT.
  {
    files: ['src/**/*.ts'],
    plugins: { boundaries },
    settings: {
      'boundaries/elements': [
        { type: 'pretre-domain', pattern: 'src/domain/**', mode: 'folder' },
        { type: 'pretre-usecases', pattern: 'src/usecases/**', mode: 'folder' },
        {
          type: 'pretre-infrastructure',
          pattern: 'src/infrastructure/**',
          mode: 'folder',
        },
        {
          type: 'pretre-app',
          pattern: ['src/app.module.ts', 'src/main.ts'],
          mode: 'file',
        },
      ],
      'boundaries/include': ['src/**/*'],
    },
    rules: {
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            { from: ['pretre-domain'], allow: ['pretre-domain'] },
            {
              from: ['pretre-usecases'],
              allow: ['pretre-domain', 'pretre-usecases'],
            },
            {
              from: ['pretre-infrastructure'],
              allow: ['pretre-domain', 'pretre-infrastructure'],
            },
            {
              from: ['pretre-app'],
              allow: [
                'pretre-domain',
                'pretre-usecases',
                'pretre-infrastructure',
              ],
            },
          ],
        },
      ],
      'boundaries/external': [
        'error',
        {
          default: 'allow',
          rules: [
            {
              from: ['pretre-domain'],
              disallow: FORBIDDEN_IN_DOMAIN,
              message:
                'Pattern Pretre violation: domain/ must not import I/O libs ({{dependency}}). Move impl to infrastructure/ and depend on a port interface from domain/ports/.',
            },
          ],
        },
      ],
    },
  },
  // Tests can use any source — relax type-checked strict rules.
  {
    files: ['src/**/*.spec.ts', 'test/**/*.ts'],
    rules: {
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },
  // @fastify/multipart augments FastifyRequest via declaration merging. ESLint's
  // TypeScript project service does not always resolve the augmentation through
  // the `type` import, causing false-positive `no-unsafe-*` violations on
  // `req.isMultipart()` and `req.parts()`. The parse utility is pure
  // infrastructure glue — it is tested via e2e specs, not unit specs.
  {
    files: ['src/infrastructure/http/utils/parse-multipart-pro-register.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },
);
