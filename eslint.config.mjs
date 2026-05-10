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
  // Workspace-level boundaries (apps/packages/tools) + tukio custom rules — keep light, warn-only
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
      // Event naming convention: lowercase.dot.separated.v1 format (AC8)
      'tukio/event-naming': 'error',
      // Anti-barrel imports from @tukio/contracts (warn at Sprint 0, error in Story 0.11)
      'tukio/no-barrel-import-contracts': 'warn',
      // Anti-barrel imports from @tukio/ui (warn at Sprint 0, error in Story 0.11)
      'tukio/no-barrel-import-ui': 'warn',
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
