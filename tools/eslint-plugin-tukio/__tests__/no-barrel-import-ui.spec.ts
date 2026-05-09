import { describe, it, expect } from 'vitest';
import { Linter } from 'eslint';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
const rule = require('../src/rules/no-barrel-import-ui.js') as import('eslint').Rule.RuleModule;

const linter = new Linter({ configType: 'flat' });

function verify(code: string): import('eslint').Linter.LintMessage[] {
  return linter.verify(code, [
    {
      languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
      plugins: { tukio: { rules: { 'no-barrel-import-ui': rule } } },
      rules: { 'tukio/no-barrel-import-ui': 'warn' },
    },
  ]);
}

describe('tukio/no-barrel-import-ui — valid cases (no warning)', () => {
  it('allows CSS subpath side-effect import', () => {
    expect(verify("import '@tukio/ui/styles/globals.css';")).toHaveLength(0);
  });

  it('allows tokens subpath import', () => {
    expect(verify("import { colors } from '@tukio/ui/tokens/colors';")).toHaveLength(0);
  });

  it('allows themes subpath import', () => {
    expect(
      verify("import { stripeElementsTheme } from '@tukio/ui/themes/stripe-elements';"),
    ).toHaveLength(0);
  });

  it('allows side-effect import of barrel (no specifiers)', () => {
    expect(verify("import '@tukio/ui';")).toHaveLength(0);
  });
});

describe('tukio/no-barrel-import-ui — invalid cases (warns)', () => {
  it('warns on named barrel import (component)', () => {
    const msgs = verify("import { Button } from '@tukio/ui';");
    expect(msgs.length).toBeGreaterThanOrEqual(1);
    expect(msgs[0]?.messageId).toBe('barrelImport');
  });

  it('warns on named barrel import (tokens)', () => {
    const msgs = verify("import { colors, spacing } from '@tukio/ui';");
    expect(msgs.length).toBeGreaterThanOrEqual(1);
  });

  it('warns on namespace import from barrel', () => {
    const msgs = verify("import * as Tukio from '@tukio/ui';");
    expect(msgs.length).toBeGreaterThanOrEqual(1);
  });

  it('warns on default import from barrel', () => {
    const msgs = verify("import Tukio from '@tukio/ui';");
    expect(msgs.length).toBeGreaterThanOrEqual(1);
  });

  it('warns on re-export from barrel', () => {
    const msgs = verify("export { colors } from '@tukio/ui';");
    expect(msgs.length).toBeGreaterThanOrEqual(1);
    expect(msgs[0]?.messageId).toBe('barrelImport');
  });

  it('warns on dynamic import() of barrel', () => {
    const msgs = verify("const ui = await import('@tukio/ui');");
    expect(msgs.length).toBeGreaterThanOrEqual(1);
  });
});
