import { describe, it, expect } from 'vitest';
import { Linter } from 'eslint';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
const rule = require('../src/rules/no-fr-paths.js') as import('eslint').Rule.RuleModule;

const linter = new Linter({ configType: 'flat' });

function verify(code: string): import('eslint').Linter.LintMessage[] {
  return linter.verify(code, [
    {
      languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
      plugins: { tukio: { rules: { 'no-fr-paths': rule } } },
      rules: { 'tukio/no-fr-paths': 'error' },
    },
  ]);
}

describe('tukio/no-fr-paths — valid cases', () => {
  it('allows EN paths under fr locale', () => {
    expect(verify("const url = '/fr/category/marquees';")).toHaveLength(0);
  });
  it('allows EN paths under en locale', () => {
    expect(verify("const url = '/en/profile/edit';")).toHaveLength(0);
  });
  it('allows non-URL strings containing FR words', () => {
    expect(verify("const x = 'this is a normal sentence about a reservation';")).toHaveLength(0);
  });
  it('ignores import sources (no autofix on imports)', () => {
    expect(verify("import x from '/fr/profil/edit';")).toHaveLength(0);
  });
  it('ignores require() calls (no autofix on imports)', () => {
    expect(verify("const x = require('/fr/profil/edit');")).toHaveLength(0);
  });
  it('ignores paths without locale prefix', () => {
    expect(verify("const filesystem = '/profil/path';")).toHaveLength(0);
  });
});

describe('tukio/no-fr-paths — invalid cases', () => {
  it('rejects /fr/categorie/...', () => {
    const msgs = verify("const url = '/fr/categorie/tentes';");
    expect(msgs.length).toBeGreaterThanOrEqual(1);
    expect(msgs[0]?.messageId).toBe('frPath');
  });
  it('rejects /fr/profil', () => {
    const msgs = verify("redirect('/fr/profil/edit');");
    expect(msgs.length).toBeGreaterThanOrEqual(1);
  });
  it('rejects /en/panier (EN locale with FR slug)', () => {
    const msgs = verify("router.push('/en/panier');");
    expect(msgs.length).toBeGreaterThanOrEqual(1);
  });
  it('autofixes /fr/categorie/ to /fr/category/', () => {
    const out = linter.verifyAndFix("const url = '/fr/categorie/marquees';", [
      {
        languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
        plugins: { tukio: { rules: { 'no-fr-paths': rule } } },
        rules: { 'tukio/no-fr-paths': 'error' },
      },
    ]);
    expect(out.output).toContain('/fr/category/');
  });
});
