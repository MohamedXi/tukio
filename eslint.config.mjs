import boundaries from 'eslint-plugin-boundaries';

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
    ],
  },
  {
    files: ['**/*.{ts,tsx,js,jsx,mjs,cjs}'],
    plugins: { boundaries },
    settings: {
      'boundaries/elements': [
        { type: 'app', pattern: 'apps/*' },
        { type: 'package', pattern: 'packages/*' },
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
    },
  },
];
