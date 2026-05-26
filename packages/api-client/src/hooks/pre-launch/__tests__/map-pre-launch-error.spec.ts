import { describe, it, expect } from 'vitest';
import { mapPreLaunchError, PreLaunchApiError } from '../map-pre-launch-error.js';

function makeHeaders(init: Record<string, string> = {}): Headers {
  return new Headers(init);
}

describe('mapPreLaunchError', () => {
  it('maps 429 with Retry-After header', () => {
    const err = mapPreLaunchError(429, {}, makeHeaders({ 'retry-after': '45' }));
    expect(err).toBeInstanceOf(PreLaunchApiError);
    expect(err.status).toBe(429);
    expect(err.retryAfterSeconds).toBe(45);
  });

  it('maps 429 without Retry-After header (defaults to 60)', () => {
    const err = mapPreLaunchError(429, {}, makeHeaders());
    expect(err.retryAfterSeconds).toBe(60);
  });

  it('clamps negative Retry-After to 1', () => {
    const err = mapPreLaunchError(429, {}, makeHeaders({ 'retry-after': '-5' }));
    expect(err.retryAfterSeconds).toBe(1);
  });

  it('clamps oversized Retry-After to 3600', () => {
    const err = mapPreLaunchError(429, {}, makeHeaders({ 'retry-after': '999999' }));
    expect(err.retryAfterSeconds).toBe(3600);
  });

  it('falls back to 60 when Retry-After is non-numeric (HTTP-date)', () => {
    const err = mapPreLaunchError(
      429,
      {},
      makeHeaders({ 'retry-after': 'Wed, 21 Oct 2026 07:28:00 GMT' }),
    );
    expect(err.retryAfterSeconds).toBe(60);
  });

  it('maps 422 to PRE-LAUNCH-VALIDATION-001', () => {
    const err = mapPreLaunchError(422, {}, makeHeaders());
    expect(err.status).toBe(422);
    expect(err.message).toContain('PRE-LAUNCH-VALIDATION-001');
  });

  it('maps 5xx to PRE-LAUNCH-EXTERNAL-001', () => {
    const err = mapPreLaunchError(503, {}, makeHeaders());
    expect(err.status).toBe(503);
    expect(err.message).toContain('PRE-LAUNCH-EXTERNAL-001');
  });

  it('maps other 4xx with tukioCode from body', () => {
    const err = mapPreLaunchError(
      403,
      { ok: false, error: { tukioCode: 'PRE-LAUNCH-FORBIDDEN-001' } },
      makeHeaders(),
    );
    expect(err.status).toBe(403);
    expect(err.message).toContain('PRE-LAUNCH-FORBIDDEN-001');
  });

  it('maps other 4xx without tukioCode to PRE-LAUNCH-UNKNOWN', () => {
    const err = mapPreLaunchError(404, {}, makeHeaders());
    expect(err.message).toContain('PRE-LAUNCH-UNKNOWN');
  });

  it('handles body with malformed error field (not an object)', () => {
    const err = mapPreLaunchError(400, { error: 'string-not-object' }, makeHeaders());
    expect(err.message).toContain('PRE-LAUNCH-UNKNOWN');
  });

  it('handles null body gracefully', () => {
    const err = mapPreLaunchError(400, null, makeHeaders());
    expect(err.message).toContain('PRE-LAUNCH-UNKNOWN');
  });

  it('handles body with non-string tukioCode', () => {
    const err = mapPreLaunchError(400, { error: { tukioCode: 42 } }, makeHeaders());
    expect(err.message).toContain('PRE-LAUNCH-UNKNOWN');
  });

  it('PreLaunchApiError message contains [status] prefix', () => {
    const err = mapPreLaunchError(422, {}, makeHeaders());
    expect(err.message).toMatch(/^\[422\]/);
  });

  it('PreLaunchApiError message contains retry-after segment when 429', () => {
    const err = mapPreLaunchError(429, {}, makeHeaders({ 'retry-after': '30' }));
    expect(err.message).toContain('retry-after: 30');
  });
});
