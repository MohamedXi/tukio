import { describe, it, expect } from 'vitest';
import { Linter } from 'eslint';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
const rule = require('../src/rules/no-hardcoded-text.js') as import('eslint').Rule.RuleModule;

const linter = new Linter({ configType: 'flat' });

function verify(code: string): import('eslint').Linter.LintMessage[] {
  return linter.verify(code, [
    {
      languageOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        parserOptions: { ecmaFeatures: { jsx: true } },
      },
      plugins: { tukio: { rules: { 'no-hardcoded-text': rule } } },
      rules: { 'tukio/no-hardcoded-text': 'error' },
    },
  ]);
}

describe('tukio/no-hardcoded-text — valid cases', () => {
  it('allows t() calls', () => {
    expect(verify("const X = () => <button>{t('reserve')}</button>;")).toHaveLength(0);
  });
  it('allows whitelisted technical strings', () => {
    expect(verify('const X = () => <input placeholder="utf-8" />;')).toHaveLength(0);
  });
  it('allows tech slugs in attributes', () => {
    expect(verify('const X = () => <input placeholder="application/json" />;')).toHaveLength(0);
  });
});

describe('tukio/no-hardcoded-text — invalid cases', () => {
  it('warns on JSX text content', () => {
    const msgs = verify('const X = () => <button>Reserver</button>;');
    expect(msgs.length).toBeGreaterThanOrEqual(1);
    expect(msgs[0]?.messageId).toBe('jsxText');
  });
  it('warns on placeholder="..."', () => {
    const msgs = verify('const X = () => <input placeholder="Adresse email" />;');
    expect(msgs.length).toBeGreaterThanOrEqual(1);
    expect(msgs[0]?.messageId).toBe('jsxAttr');
  });
  it('warns on aria-label="..."', () => {
    const msgs = verify('const X = () => <button aria-label="Fermer la modale" />;');
    expect(msgs.length).toBeGreaterThanOrEqual(1);
    expect(msgs[0]?.messageId).toBe('jsxAttr');
  });
});
