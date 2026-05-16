import { createHash, createHmac } from 'node:crypto';
import { InternalServiceGuard } from './internal-service.guard.js';
import { AuthForbiddenException } from '@tukio/auth/exceptions';
import type { IConfigService } from '../../../domain/ports/config.port.js';
import type { ExecutionContext } from '@nestjs/common';

const SECRET = 'dev-internal-svc-secret-32-bytes!!';

const buildConfigMock = (): IConfigService =>
  ({
    getInternalServiceSecret: jest.fn().mockReturnValue(SECRET),
  }) as unknown as IConfigService;

const sha256Hex = (input: string | Buffer): string =>
  createHash('sha256').update(input).digest('hex');

const sign = (
  timestamp: number,
  method: string,
  path: string,
  bodyHash: string,
): string =>
  createHmac('sha256', SECRET)
    .update(`${timestamp}.${method.toUpperCase()}.${path}.${bodyHash}`)
    .digest('hex');

const buildContext = (req: {
  headers: Record<string, string | string[] | undefined>;
  method?: string;
  url?: string;
  body?: unknown;
  rawBody?: Buffer | string;
}): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({
        headers: req.headers,
        method: req.method ?? 'POST',
        url: req.url ?? '/internal/customers',
        body: req.body,
        rawBody: req.rawBody,
      }),
    }),
  }) as unknown as ExecutionContext;

describe('InternalServiceGuard', () => {
  let guard: InternalServiceGuard;

  beforeEach(() => {
    guard = new InternalServiceGuard(buildConfigMock());
  });

  it('accepts a valid HMAC signature with matching body hash inside the clock-skew window', () => {
    const ts = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({ email: 'a@b.com' });
    const bodyHash = sha256Hex(body);
    const token = sign(ts, 'POST', '/internal/customers', bodyHash);
    const ctx = buildContext({
      headers: {
        'x-internal-service-token': token,
        'x-internal-service-timestamp': String(ts),
        'x-internal-service-body-sha256': bodyHash,
      },
      body: { email: 'a@b.com' },
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('uses the raw body buffer when available (Fastify rawBody pattern)', () => {
    const ts = Math.floor(Date.now() / 1000);
    const rawBody = Buffer.from('{"email":"a@b.com"}');
    const bodyHash = sha256Hex(rawBody);
    const token = sign(ts, 'POST', '/internal/customers', bodyHash);
    const ctx = buildContext({
      headers: {
        'x-internal-service-token': token,
        'x-internal-service-timestamp': String(ts),
        'x-internal-service-body-sha256': bodyHash,
      },
      rawBody,
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('rejects when the token header is missing', () => {
    const ts = Math.floor(Date.now() / 1000);
    const bodyHash = sha256Hex('');
    expect(() =>
      guard.canActivate(
        buildContext({
          headers: {
            'x-internal-service-timestamp': String(ts),
            'x-internal-service-body-sha256': bodyHash,
          },
        }),
      ),
    ).toThrow(AuthForbiddenException);
  });

  it('rejects when the timestamp header is missing', () => {
    expect(() =>
      guard.canActivate(
        buildContext({
          headers: {
            'x-internal-service-token': 'whatever',
            'x-internal-service-body-sha256': sha256Hex(''),
          },
        }),
      ),
    ).toThrow(AuthForbiddenException);
  });

  it('rejects when the body hash header is missing (review patch B1)', () => {
    const ts = Math.floor(Date.now() / 1000);
    expect(() =>
      guard.canActivate(
        buildContext({
          headers: {
            'x-internal-service-token': 'whatever',
            'x-internal-service-timestamp': String(ts),
          },
        }),
      ),
    ).toThrow(AuthForbiddenException);
  });

  it('rejects a non-hex token (review patch E9)', () => {
    const ts = Math.floor(Date.now() / 1000);
    expect(() =>
      guard.canActivate(
        buildContext({
          headers: {
            'x-internal-service-token': 'zzzz-not-hex',
            'x-internal-service-timestamp': String(ts),
            'x-internal-service-body-sha256': sha256Hex(''),
          },
        }),
      ),
    ).toThrow(/Invalid internal service token format/);
  });

  it('rejects a non-hex body hash (review patch E9)', () => {
    const ts = Math.floor(Date.now() / 1000);
    expect(() =>
      guard.canActivate(
        buildContext({
          headers: {
            'x-internal-service-token': 'abcd'.repeat(16),
            'x-internal-service-timestamp': String(ts),
            'x-internal-service-body-sha256': 'zzz',
          },
        }),
      ),
    ).toThrow(/Invalid internal service body hash format/);
  });

  it('rejects a millisecond timestamp with a diagnostic message (review patch E8)', () => {
    const tsMs = Date.now();
    const bodyHash = sha256Hex('');
    const token = sign(tsMs, 'POST', '/internal/customers', bodyHash);
    expect(() =>
      guard.canActivate(
        buildContext({
          headers: {
            'x-internal-service-token': token,
            'x-internal-service-timestamp': String(tsMs),
            'x-internal-service-body-sha256': bodyHash,
          },
        }),
      ),
    ).toThrow(/Unix seconds, not milliseconds/);
  });

  it('rejects when the timestamp is more than 5 minutes off (replay protection)', () => {
    const ts = Math.floor(Date.now() / 1000) - 600;
    const bodyHash = sha256Hex('');
    const token = sign(ts, 'POST', '/internal/customers', bodyHash);
    expect(() =>
      guard.canActivate(
        buildContext({
          headers: {
            'x-internal-service-token': token,
            'x-internal-service-timestamp': String(ts),
            'x-internal-service-body-sha256': bodyHash,
          },
        }),
      ),
    ).toThrow(/timestamp out of window/);
  });

  it('rejects when the token does not match the method', () => {
    const ts = Math.floor(Date.now() / 1000);
    const bodyHash = sha256Hex('');
    const token = sign(ts, 'POST', '/internal/customers', bodyHash);
    expect(() =>
      guard.canActivate(
        buildContext({
          headers: {
            'x-internal-service-token': token,
            'x-internal-service-timestamp': String(ts),
            'x-internal-service-body-sha256': bodyHash,
          },
          method: 'GET',
        }),
      ),
    ).toThrow(AuthForbiddenException);
  });

  it('rejects when the token does not match the path', () => {
    const ts = Math.floor(Date.now() / 1000);
    const bodyHash = sha256Hex('');
    const token = sign(ts, 'POST', '/internal/customers', bodyHash);
    expect(() =>
      guard.canActivate(
        buildContext({
          headers: {
            'x-internal-service-token': token,
            'x-internal-service-timestamp': String(ts),
            'x-internal-service-body-sha256': bodyHash,
          },
          url: '/internal/admin-only',
        }),
      ),
    ).toThrow(AuthForbiddenException);
  });

  it('rejects when the body hash claims something different from the actual body (review patch B1)', () => {
    const ts = Math.floor(Date.now() / 1000);
    const claimedBody = '{"email":"victim@b.com"}';
    const claimedHash = sha256Hex(claimedBody);
    const token = sign(ts, 'POST', '/internal/customers', claimedHash);
    expect(() =>
      guard.canActivate(
        buildContext({
          headers: {
            'x-internal-service-token': token,
            'x-internal-service-timestamp': String(ts),
            'x-internal-service-body-sha256': claimedHash,
          },
          body: { email: 'attacker@b.com' }, // Actual body differs from claim
        }),
      ),
    ).toThrow(/Body hash mismatch/);
  });

  it('strips the query string and trailing slash before computing canonical path (review patch E10)', () => {
    const ts = Math.floor(Date.now() / 1000);
    const bodyHash = sha256Hex('');
    const token = sign(ts, 'POST', '/internal/customers', bodyHash);
    const ctx = buildContext({
      headers: {
        'x-internal-service-token': token,
        'x-internal-service-timestamp': String(ts),
        'x-internal-service-body-sha256': bodyHash,
      },
      url: '/internal/customers/?debug=true',
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('handles array-valued headers (Node parser quirk)', () => {
    const ts = Math.floor(Date.now() / 1000);
    const bodyHash = sha256Hex('');
    const token = sign(ts, 'POST', '/internal/customers', bodyHash);
    const ctx = buildContext({
      headers: {
        'x-internal-service-token': [token, 'duplicate'],
        'x-internal-service-timestamp': [String(ts), 'duplicate'],
        'x-internal-service-body-sha256': [bodyHash, 'duplicate'],
      },
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('GET request without body verifies against the empty-string hash', () => {
    const ts = Math.floor(Date.now() / 1000);
    const bodyHash = sha256Hex('');
    const token = sign(ts, 'GET', '/internal/customers', bodyHash);
    const ctx = buildContext({
      headers: {
        'x-internal-service-token': token,
        'x-internal-service-timestamp': String(ts),
        'x-internal-service-body-sha256': bodyHash,
      },
      method: 'GET',
      body: undefined,
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
