import { describe, it, expect } from 'vitest';
import { Linter } from 'eslint';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
const rule = require('../src/rules/no-buyer.js') as import('eslint').Rule.RuleModule;

const linter = new Linter({ configType: 'flat' });

function verify(
  code: string,
  filename = 'apps/customer/src/lib/foo.ts',
): import('eslint').Linter.LintMessage[] {
  return linter.verify(
    code,
    [
      {
        files: ['**/*.ts', '**/*.tsx'],
        languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
        plugins: { tukio: { rules: { 'no-buyer': rule } } },
        rules: { 'tukio/no-buyer': 'error' },
      },
    ],
    filename,
  );
}

describe('tukio/no-buyer — valid', () => {
  it('allows customer identifier', () => {
    expect(verify('const customer = { id: 1 };')).toHaveLength(0);
  });
  it('allows third-party API strings (Stripe Connect buyer_email)', () => {
    expect(verify("const field = 'buyer_email';")).toHaveLength(0);
  });
  it('skips test fixtures (no rule activation in __tests__)', () => {
    expect(verify('const buyer = 1;', 'apps/customer/__tests__/fixture.ts')).toHaveLength(0);
  });
  it('skips message JSON files', () => {
    expect(
      verify('const t = { buyerGuide: "..." };', 'apps/public/src/messages/en.ts'),
    ).toHaveLength(0);
  });
});

describe('tukio/no-buyer — invalid', () => {
  it('rejects buyer identifier', () => {
    const msgs = verify('const buyer = { id: 1 };');
    expect(msgs.length).toBeGreaterThanOrEqual(1);
    expect(msgs[0]?.messageId).toBe('forbiddenIdentifier');
  });
  it('rejects BuyerProfile type', () => {
    const msgs = verify('interface BuyerProfile { id: string; }');
    expect(msgs.length).toBeGreaterThanOrEqual(1);
  });
  it('rejects file basename containing "buyer-"', () => {
    const msgs = verify('export const ok = true;', 'apps/customer/src/buyer-profile.ts');
    expect(msgs.some((m) => m.messageId === 'forbiddenFilename')).toBe(true);
  });
});
