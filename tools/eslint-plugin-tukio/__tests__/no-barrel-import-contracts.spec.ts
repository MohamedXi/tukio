import { describe, it, expect } from 'vitest';
import { Linter } from 'eslint';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
const rule =
  require('../src/rules/no-barrel-import-contracts.js') as import('eslint').Rule.RuleModule;

const linter = new Linter({ configType: 'flat' });

function verify(code: string): import('eslint').Linter.LintMessage[] {
  return linter.verify(code, [
    {
      languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
      plugins: { tukio: { rules: { 'no-barrel-import-contracts': rule } } },
      rules: { 'tukio/no-barrel-import-contracts': 'warn' },
    },
  ]);
}

describe('tukio/no-barrel-import-contracts — valid cases (no warning)', () => {
  it('allows subpath import from envelope', () => {
    expect(verify("import { SuccessEnvelope } from '@tukio/contracts/envelope';")).toHaveLength(0);
  });

  it('allows subpath import from dtos/booking', () => {
    expect(
      verify("import { CreateBookingSchema } from '@tukio/contracts/dtos/booking';"),
    ).toHaveLength(0);
  });

  it('allows subpath import from types', () => {
    expect(verify("import { Actor } from '@tukio/contracts/types';")).toHaveLength(0);
  });

  it('allows side-effect import (no specifiers)', () => {
    // Side-effect imports have no specifiers — not a barrel import
    expect(verify("import '@tukio/contracts/events/catalog/listing-published.v1';")).toHaveLength(
      0,
    );
  });

  it('allows re-export from a subpath', () => {
    expect(verify("export { Money } from '@tukio/contracts/types';")).toHaveLength(0);
  });
});

describe('tukio/no-barrel-import-contracts — invalid cases (warns)', () => {
  it('warns on named barrel import', () => {
    const msgs = verify("import { SuccessEnvelope } from '@tukio/contracts';");
    expect(msgs.length).toBeGreaterThanOrEqual(1);
    expect(msgs[0]?.messageId).toBe('barrelImport');
  });

  it('warns on multiple named imports from barrel', () => {
    const msgs = verify("import { Actor, Money } from '@tukio/contracts';");
    expect(msgs.length).toBeGreaterThanOrEqual(1);
  });

  it('warns on namespace import (import * as)', () => {
    const msgs = verify("import * as Tukio from '@tukio/contracts';");
    expect(msgs.length).toBeGreaterThanOrEqual(1);
    expect(msgs[0]?.messageId).toBe('barrelImport');
  });

  it('warns on default import from barrel', () => {
    const msgs = verify("import Contracts from '@tukio/contracts';");
    expect(msgs.length).toBeGreaterThanOrEqual(1);
  });

  it('warns on re-export from barrel', () => {
    const msgs = verify("export { Money } from '@tukio/contracts';");
    expect(msgs.length).toBeGreaterThanOrEqual(1);
    expect(msgs[0]?.messageId).toBe('barrelImport');
  });

  it('warns on export * from barrel', () => {
    const msgs = verify("export * from '@tukio/contracts';");
    expect(msgs.length).toBeGreaterThanOrEqual(1);
  });

  it('warns on dynamic import() of barrel', () => {
    const msgs = verify("const c = await import('@tukio/contracts');");
    expect(msgs.length).toBeGreaterThanOrEqual(1);
  });
});
