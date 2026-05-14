import { describe, it, expect } from 'vitest';
import { Linter } from 'eslint';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
const rule = require('../src/rules/error-code-format.js') as import('eslint').Rule.RuleModule;

const linter = new Linter({ configType: 'flat' });

function verify(code: string): import('eslint').Linter.LintMessage[] {
  return linter.verify(code, [
    {
      languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
      plugins: { tukio: { rules: { 'error-code-format': rule } } },
      rules: { 'tukio/error-code-format': 'error' },
    },
  ]);
}

describe('tukio/error-code-format — valid', () => {
  it('accepts AUTH-NOT-AUTHENTICATED-002', () => {
    expect(verify("const x = { tukioCode: 'AUTH-NOT-AUTHENTICATED-002' };")).toHaveLength(0);
  });
  it('accepts BOOKING-CONFLICT-001', () => {
    expect(verify("const x = { tukioCode: 'BOOKING-CONFLICT-001' };")).toHaveLength(0);
  });
  it('accepts CATALOG-LISTING-NOT-FOUND-014', () => {
    expect(verify("const x = { tukioCode: 'CATALOG-LISTING-NOT-FOUND-014' };")).toHaveLength(0);
  });
});

describe('tukio/error-code-format — invalid', () => {
  it('rejects lowercase code', () => {
    const msgs = verify("const x = { tukioCode: 'booking_conflict' };");
    expect(msgs.length).toBeGreaterThanOrEqual(1);
    expect(msgs[0]?.messageId).toBe('invalidCode');
  });
  it('rejects missing 3-digit suffix', () => {
    const msgs = verify("const x = { tukioCode: 'BOOKING-CONFLICT' };");
    expect(msgs.length).toBeGreaterThanOrEqual(1);
  });
  it('rejects PascalCase code', () => {
    const msgs = verify("const x = { tukioCode: 'BookingConflict001' };");
    expect(msgs.length).toBeGreaterThanOrEqual(1);
  });
});
