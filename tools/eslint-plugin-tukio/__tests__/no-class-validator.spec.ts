import { describe, it, expect } from 'vitest';
import { Linter } from 'eslint';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
const rule = require('../src/rules/no-class-validator.js') as import('eslint').Rule.RuleModule;

const linter = new Linter({ configType: 'flat' });

function verify(code: string): import('eslint').Linter.LintMessage[] {
  return linter.verify(code, [
    {
      languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
      plugins: { tukio: { rules: { 'no-class-validator': rule } } },
      rules: { 'tukio/no-class-validator': 'error' },
    },
  ]);
}

describe('tukio/no-class-validator — valid', () => {
  it('allows Zod import', () => {
    expect(verify("import { z } from 'zod';")).toHaveLength(0);
  });
  it('allows @tukio/contracts/dtos import', () => {
    expect(
      verify("import { CreateListingSchema } from '@tukio/contracts/dtos/catalog';"),
    ).toHaveLength(0);
  });
  it('allows nestjs imports', () => {
    expect(verify("import { Module } from '@nestjs/common';")).toHaveLength(0);
  });
  // Type-only imports (`import type { X } from 'class-validator'`) are TS
  // syntax. The rule honours `node.importKind === 'type'`, but testing that
  // here requires a TS parser; covered in integration via the root
  // `eslint.config.mjs` which uses `@typescript-eslint/parser`.
});

describe('tukio/no-class-validator — invalid', () => {
  it('rejects class-validator value import', () => {
    const msgs = verify("import { IsString } from 'class-validator';");
    expect(msgs.length).toBeGreaterThanOrEqual(1);
    expect(msgs[0]?.messageId).toBe('forbiddenImport');
  });
  it('rejects class-transformer import', () => {
    const msgs = verify("import { plainToClass } from 'class-transformer';");
    expect(msgs.length).toBeGreaterThanOrEqual(1);
  });
  it('rejects require("class-validator")', () => {
    const msgs = verify("const cv = require('class-validator');");
    expect(msgs.length).toBeGreaterThanOrEqual(1);
  });
});
