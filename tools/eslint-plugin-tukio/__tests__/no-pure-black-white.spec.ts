import { describe, it, expect } from 'vitest';
import { Linter } from 'eslint';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
const rule = require('../src/rules/no-pure-black-white.js') as import('eslint').Rule.RuleModule;

const linter = new Linter({ configType: 'flat' });

function verify(code: string): import('eslint').Linter.LintMessage[] {
  return linter.verify(code, [
    {
      languageOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        parserOptions: { ecmaFeatures: { jsx: true } },
      },
      plugins: { tukio: { rules: { 'no-pure-black-white': rule } } },
      rules: { 'tukio/no-pure-black-white': 'error' },
    },
  ]);
}

describe('tukio/no-pure-black-white — valid', () => {
  it('allows Tukio tokens', () => {
    expect(verify('const c = <div className="text-charcoal-700 bg-cream-50" />;')).toHaveLength(0);
  });
  it('allows non-color strings', () => {
    expect(verify("const url = 'https://example.com';")).toHaveLength(0);
  });
  it('allows hex other than black/white', () => {
    expect(verify("const c = '#3b82f6';")).toHaveLength(0);
  });
});

describe('tukio/no-pure-black-white — invalid', () => {
  it('rejects text-black Tailwind class', () => {
    const msgs = verify('const c = <div className="text-black" />;');
    expect(msgs.length).toBeGreaterThanOrEqual(1);
    expect(msgs[0]?.messageId).toBe('tailwind');
  });
  it('rejects bg-white Tailwind class', () => {
    const msgs = verify('const c = <div className="bg-white px-4" />;');
    expect(msgs.length).toBeGreaterThanOrEqual(1);
  });
  it('rejects #000 hex literal', () => {
    const msgs = verify("const color = '#000';");
    expect(msgs.length).toBeGreaterThanOrEqual(1);
    expect(msgs[0]?.messageId).toBe('cssValue');
  });
  it('rejects rgb(255,255,255)', () => {
    const msgs = verify("const color = 'rgb(255, 255, 255)';");
    expect(msgs.length).toBeGreaterThanOrEqual(1);
  });
});
