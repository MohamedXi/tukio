import { describe, it, expect } from 'vitest';
import { Linter } from 'eslint';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
const rule = require('../src/rules/no-direct-event-publish.js') as import('eslint').Rule.RuleModule;

const linter = new Linter({ configType: 'flat' });

function verify(code: string): import('eslint').Linter.LintMessage[] {
  return linter.verify(code, [
    {
      languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
      plugins: { tukio: { rules: { 'no-direct-event-publish': rule } } },
      rules: { 'tukio/no-direct-event-publish': 'warn' },
    },
  ]);
}

describe('tukio/no-direct-event-publish — valid cases (no warning)', () => {
  it('allows this.outboxPublisher.publish(event)', () => {
    expect(verify('this.outboxPublisher.publish(event);')).toHaveLength(0);
  });

  it('allows outboxPublisher.publish(event) without this', () => {
    expect(verify('outboxPublisher.publish(event);')).toHaveLength(0);
  });

  it('allows unrelated method calls on known identifiers', () => {
    expect(verify('this.natsClient.subscribe("subject", handler);')).toHaveLength(0);
  });

  it('allows publish on unknown identifiers not in the deny-list', () => {
    expect(verify('this.myCustomService.publish(event);')).toHaveLength(0);
  });
});

describe('tukio/no-direct-event-publish — invalid cases (warns)', () => {
  it('warns on this.natsClient.publish()', () => {
    const msgs = verify('this.natsClient.publish("subject", event);');
    expect(msgs.length).toBeGreaterThanOrEqual(1);
    expect(msgs[0]?.messageId).toBe('directPublish');
  });

  it('warns on this.jsClient.publish()', () => {
    const msgs = verify('this.jsClient.publish("subject", event);');
    expect(msgs.length).toBeGreaterThanOrEqual(1);
    expect(msgs[0]?.messageId).toBe('directPublish');
  });

  it('warns on nats.publish() (standalone identifier)', () => {
    const msgs = verify('nats.publish("subject", event);');
    expect(msgs.length).toBeGreaterThanOrEqual(1);
    expect(msgs[0]?.messageId).toBe('directPublish');
  });

  it('warns on this.nc.publish()', () => {
    const msgs = verify('this.nc.publish("subject", event);');
    expect(msgs.length).toBeGreaterThanOrEqual(1);
    expect(msgs[0]?.messageId).toBe('directPublish');
  });
});
