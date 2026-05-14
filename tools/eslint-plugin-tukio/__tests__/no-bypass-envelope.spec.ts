import { describe, it, expect } from 'vitest';
import { Linter } from 'eslint';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
const rule = require('../src/rules/no-bypass-envelope.js') as import('eslint').Rule.RuleModule;

const linter = new Linter({ configType: 'flat' });

function verify(
  code: string,
  filename = 'apps/identity-svc/src/infrastructure/http/foo.controller.ts',
): import('eslint').Linter.LintMessage[] {
  return linter.verify(
    code,
    [
      {
        files: ['**/*.ts', '**/*.tsx'],
        languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
        plugins: { tukio: { rules: { 'no-bypass-envelope': rule } } },
        rules: { 'tukio/no-bypass-envelope': 'error' },
      },
    ],
    filename,
  );
}

describe('tukio/no-bypass-envelope — valid', () => {
  it('allows returning DTO directly inside controller', () => {
    expect(verify('function get() { return { ok: true }; }')).toHaveLength(0);
  });
  it('ignores response.json outside controller scope', () => {
    expect(
      verify('function h(response) { response.json({}); }', 'apps/customer/src/page.tsx'),
    ).toHaveLength(0);
  });
  it('allows JSON.stringify / non-response calls', () => {
    expect(verify('const x = JSON.stringify({ a: 1 });')).toHaveLength(0);
  });
});

describe('tukio/no-bypass-envelope — invalid', () => {
  it('rejects response.json() in controller', () => {
    const msgs = verify('function h(response) { response.json({ ok: true }); }');
    expect(msgs.length).toBeGreaterThanOrEqual(1);
    expect(msgs[0]?.messageId).toBe('bypass');
  });
  it('rejects res.send() in controller', () => {
    const msgs = verify('function h(res) { res.send("hi"); }');
    expect(msgs.length).toBeGreaterThanOrEqual(1);
  });
  it('rejects reply.send() in controller (Fastify)', () => {
    const msgs = verify('function h(reply) { reply.send({}); }');
    expect(msgs.length).toBeGreaterThanOrEqual(1);
  });
});
