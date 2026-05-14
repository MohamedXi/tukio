import { describe, it, expect } from 'vitest';
import { Linter } from 'eslint';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
const rule = require('../src/rules/require-correlation-id.js') as import('eslint').Rule.RuleModule;

const linter = new Linter({ configType: 'flat' });

function verify(code: string): import('eslint').Linter.LintMessage[] {
  return linter.verify(code, [
    {
      languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
      plugins: { tukio: { rules: { 'require-correlation-id': rule } } },
      rules: { 'tukio/require-correlation-id': 'warn' },
    },
  ]);
}

describe('tukio/require-correlation-id — valid', () => {
  it('allows inline event with correlationId', () => {
    expect(
      verify("outboxPublisher.publish({ eventType: 'x.y.z.v1', payload: {}, correlationId: id });"),
    ).toHaveLength(0);
  });
  it('ignores non-publisher calls', () => {
    expect(verify("logger.info({ msg: 'hello' });")).toHaveLength(0);
  });
  it('ignores publish() when arg is not an inline object', () => {
    expect(verify('outboxPublisher.publish(event);')).toHaveLength(0);
  });
});

describe('tukio/require-correlation-id — invalid (warn)', () => {
  it('warns when inline event lacks correlationId', () => {
    const msgs = verify("outboxPublisher.publish({ eventType: 'x.y.z.v1', payload: {} });");
    expect(msgs.length).toBeGreaterThanOrEqual(1);
    expect(msgs[0]?.messageId).toBe('missingCorrelation');
  });
});
