import { describe, it, expect } from 'vitest';
import { classifyPreLaunchError } from './classify-pre-launch-error.js';

describe('classifyPreLaunchError', () => {
  it('returns generic for unknown error', () => {
    expect(classifyPreLaunchError(new Error('unknown'))).toEqual({ kind: 'generic' });
  });

  it('returns network for TypeError fetch failure', () => {
    const e = new TypeError('Failed to fetch');
    expect(classifyPreLaunchError(e)).toEqual({ kind: 'network' });
  });

  it('returns network for AbortError', () => {
    const e = Object.assign(new Error('aborted'), { name: 'AbortError' });
    expect(classifyPreLaunchError(e)).toEqual({ kind: 'network' });
  });

  it('returns rate_limited with retryAfterSeconds from status 429 error', () => {
    const e = Object.assign(new Error('Too Many Requests'), { status: 429, retryAfterSeconds: 30 });
    const result = classifyPreLaunchError(e);
    expect(result.kind).toBe('rate_limited');
    if (result.kind === 'rate_limited') expect(result.retryAfterSeconds).toBe(30);
  });

  it('returns rate_limited with fallback 60s when retryAfterSeconds absent', () => {
    const e = Object.assign(new Error('Too Many Requests'), { status: 429 });
    const result = classifyPreLaunchError(e);
    expect(result.kind).toBe('rate_limited');
    if (result.kind === 'rate_limited') expect(result.retryAfterSeconds).toBe(60);
  });

  it('returns generic for non-fetch error object', () => {
    expect(classifyPreLaunchError({ code: 'UNKNOWN' })).toEqual({ kind: 'generic' });
  });
});
