import boundaries from 'eslint-plugin-boundaries';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// CJS plugin loaded via require (no "type":"module" in plugin package)
const tukioPlugin = require('./tools/eslint-plugin-tukio/src/index.js');

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
];
