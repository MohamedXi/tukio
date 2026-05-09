import { describe, it, expect } from 'vitest';
import { Linter } from 'eslint';

// CJS-from-ESM import
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
const rule = require('../src/rules/event-naming.js') as import('eslint').Rule.RuleModule;

const linter = new Linter({ configType: 'flat' });

function verify(code: string): import('eslint').Linter.LintMessage[] {
  return linter.verify(code, [
    {
      languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
      plugins: { tukio: { rules: { 'event-naming': rule } } },
      rules: { 'tukio/event-naming': 'error' },
    },
  ]);
}

describe('tukio/event-naming — valid cases (no errors)', () => {
  it('accepts catalog.listing.published.v1', () => {
    expect(verify("const x = { eventType: 'catalog.listing.published.v1' };")).toHaveLength(0);
  });

  it('accepts booking.requested.v1 (collapsed service.aggregate)', () => {
    expect(verify("const x = { eventType: 'booking.requested.v1' };")).toHaveLength(0);
  });

  it('accepts admin.action.pro-verified.v1 (dashes in token)', () => {
    expect(verify("const x = { eventType: 'admin.action.pro-verified.v1' };")).toHaveLength(0);
  });
});

describe('tukio/event-naming — invalid cases (reports error)', () => {
  it('rejects PascalCase BookingCreated', () => {
    const msgs = verify("const x = { eventType: 'BookingCreated' };");
    expect(msgs.length).toBeGreaterThanOrEqual(1);
    expect(msgs[0]?.messageId).toBe('invalidEventType');
  });

  it('rejects snake_case booking_created_v1', () => {
    const msgs = verify("const x = { eventType: 'booking_created_v1' };");
    expect(msgs.length).toBeGreaterThanOrEqual(1);
  });

  it('rejects missing version booking.created (no .v1)', () => {
    const msgs = verify("const x = { eventType: 'booking.created' };");
    expect(msgs.length).toBeGreaterThanOrEqual(1);
  });
});
