import boundaries from 'eslint-plugin-boundaries';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// CJS plugin loaded via require (no "type":"module" in plugin package)
const tukioPlugin = require('./tools/eslint-plugin-tukio/src/index.js');

// I/O libs strictly forbidden in domain/ layers (Pattern Pretre — AC2/AC8 Story 0.6)
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

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/build/**',
      '**/out/**',
      '_bmad/**',
      '_bmad-output/**',
      'docs/**',
      '**/next-env.d.ts',
      // ESLint plugin source is CJS — exclude its own test files from root config
      'tools/**',
    ],
  },
  // Workspace-level boundaries (apps/packages/tools) + tukio custom rules.
  // Story 0.11 — most rules promoted to `error` (Sprint 0 is now-or-never).
  {
    files: ['**/*.{ts,tsx,js,jsx,mjs,cjs}'],
    plugins: { boundaries, tukio: tukioPlugin },
    settings: {
      'boundaries/elements': [
        { type: 'app', pattern: 'apps/*' },
        { type: 'package', pattern: 'packages/*' },
        { type: 'tool', pattern: 'tools/*' },
      ],
    },
    rules: {
      'boundaries/element-types': [
        'warn',
        {
          default: 'allow',
          rules: [],
        },
      ],
      // NATS event naming (Story 0.2)
      'tukio/event-naming': 'error',
      // Anti-barrel imports (Stories 0.2 / 0.3) — promoted warn → error in Story 0.11
      'tukio/no-barrel-import-contracts': 'error',
      'tukio/no-barrel-import-ui': 'error',
      // OutboxPublisher discipline (Story 0.7) — promoted warn → error in Story 0.11
      'tukio/no-direct-event-publish': 'error',
      // Story 0.11 — new rules
      'tukio/no-fr-paths': 'error',
      'tukio/no-class-validator': 'error',
      'tukio/error-code-format': 'error',
      'tukio/no-buyer': 'error',
      // Filename-scoped internally (apps/<svc>/src/infrastructure/http/**)
      'tukio/no-bypass-envelope': 'error',
      // Warn-only — heuristic, may produce false-positives until typed publish helpers exist
      'tukio/require-correlation-id': 'warn',
    },
  },
  // `no-hardcoded-text` + `no-pure-black-white` — frontend-only. Backend
  // services may legitimately use `#000`/`#fff` (PDF generation, Stripe Elements
  // iframe theme, chart palettes) and don't speak next-intl.
  {
    files: [
      'apps/public/src/**/*.{tsx,jsx,ts}',
      'apps/customer/src/**/*.{tsx,jsx,ts}',
      'apps/seller/src/**/*.{tsx,jsx,ts}',
      'apps/admin/src/**/*.{tsx,jsx,ts}',
      'packages/ui/src/**/*.{tsx,jsx,ts}',
    ],
    plugins: { tukio: tukioPlugin },
    rules: {
      'tukio/no-hardcoded-text': 'error',
      'tukio/no-pure-black-white': 'error',
    },
  },
  // Storybook / test files / story rule fixtures are exempt from heuristic
  // rules that flag legitimate test content. Black/white hex literals, FR-path
  // fixtures, hardcoded English copy, and "buyer" all appear intentionally in
  // test data.
  {
    files: [
      '**/*.stories.{ts,tsx,jsx}',
      '**/*.spec.{ts,tsx,jsx}',
      '**/*.test.{ts,tsx,jsx}',
      '**/*.e2e-spec.{ts,tsx}',
      '**/__tests__/**/*',
      '**/test/**/*',
      '**/fixtures/**/*',
      '**/messages/**/*.{json,ts}',
    ],
    plugins: { tukio: tukioPlugin },
    rules: {
      'tukio/no-hardcoded-text': 'off',
      'tukio/no-buyer': 'off',
      'tukio/no-pure-black-white': 'off',
      'tukio/no-fr-paths': 'off',
      'tukio/error-code-format': 'off',
    },
  },
  // Pattern Pretre Clean Architecture — strict boundaries (Story 0.6 AC2/AC8)
  // Applies to backend services (apps/*-svc/src/**) and gateway-api (apps/gateway-api/src/**).
  // Layered isolation: domain → domain only ; usecases → domain+usecases ; infrastructure → domain+infrastructure.
  // I/O libraries are forbidden inside `domain/` to keep it framework-free.
  {
    files: ['apps/*-svc/src/**/*.{ts,tsx}', 'apps/gateway-api/src/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'boundaries/elements': [
        // Backend microservices (*-svc)
        { type: 'pretre-domain', pattern: 'apps/*-svc/src/domain/**', mode: 'folder' },
        { type: 'pretre-usecases', pattern: 'apps/*-svc/src/usecases/**', mode: 'folder' },
        {
          type: 'pretre-infrastructure',
          pattern: 'apps/*-svc/src/infrastructure/**',
          mode: 'folder',
        },
        {
          type: 'pretre-app',
          pattern: ['apps/*-svc/src/app.module.ts', 'apps/*-svc/src/main.ts'],
          mode: 'file',
        },
        // gateway-api (no -svc suffix, same Pretre layout)
        { type: 'pretre-domain', pattern: 'apps/gateway-api/src/domain/**', mode: 'folder' },
        { type: 'pretre-usecases', pattern: 'apps/gateway-api/src/usecases/**', mode: 'folder' },
        {
          type: 'pretre-infrastructure',
          pattern: 'apps/gateway-api/src/infrastructure/**',
          mode: 'folder',
        },
        {
          type: 'pretre-app',
          pattern: ['apps/gateway-api/src/app.module.ts', 'apps/gateway-api/src/main.ts'],
          mode: 'file',
        },
      ],
      'boundaries/include': ['apps/*-svc/src/**', 'apps/gateway-api/src/**'],
    },
    rules: {
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            { from: ['pretre-domain'], allow: ['pretre-domain'] },
            { from: ['pretre-usecases'], allow: ['pretre-domain', 'pretre-usecases'] },
            {
              from: ['pretre-infrastructure'],
              allow: ['pretre-domain', 'pretre-infrastructure'],
            },
            {
              from: ['pretre-app'],
              allow: ['pretre-domain', 'pretre-usecases', 'pretre-infrastructure'],
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
                'Pattern Pretre violation: domain/ must not import I/O libs ({{dependency}}). Move the implementation to infrastructure/ and depend on a port interface in domain/ports/.',
            },
          ],
        },
      ],
    },
  },
];
