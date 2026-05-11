import { describe, it, expect } from 'vitest';
import type { ErrorEnvelope, SuccessEnvelope } from '@tukio/contracts/envelope';
import {
  isErrorEnvelope,
  throwApiErrorFromEnvelope,
  unwrapSuccessEnvelope,
} from '../client/envelope-handler.js';
import { ApiError } from '../types/api-error.js';

const successEnvelope: SuccessEnvelope<{ id: string }> = {
  method: 'GET',
  code: 200,
  data: { id: 'abc' },
  meta: {
    timestamp: '2026-05-10T10:00:00Z',
    correlationId: 'corr-1',
    locale: 'fr',
  },
};

const errorEnvelope: ErrorEnvelope = {
  method: 'GET',
  code: 404,
  error: {
    type: 'https://tukio.one/errors/user-not-found',
    title: 'User profile not found',
    detail: 'No user with id abc',
    instance: '/v1/users/abc',
    tukioCode: 'USER-NOT-FOUND-001',
  },
  meta: {
    timestamp: '2026-05-10T10:00:00Z',
    correlationId: 'corr-1',
    locale: 'fr',
  },
};

describe('unwrapSuccessEnvelope', () => {
  it('returns the data field', () => {
    expect(unwrapSuccessEnvelope(successEnvelope)).toEqual({ id: 'abc' });
  });

  it('returns null when data is null', () => {
    const env: SuccessEnvelope<{ id: string }> = { ...successEnvelope, data: null };
    expect(unwrapSuccessEnvelope(env)).toBeNull();
  });

  it('returns array when data is a list', () => {
    const env: SuccessEnvelope<{ id: string }> = {
      ...successEnvelope,
      data: [{ id: 'a' }, { id: 'b' }],
    };
    expect(unwrapSuccessEnvelope(env)).toEqual([{ id: 'a' }, { id: 'b' }]);
  });
});

describe('throwApiErrorFromEnvelope', () => {
  it('throws an ApiError with envelope fields propagated', () => {
    expect(() => throwApiErrorFromEnvelope(errorEnvelope)).toThrow(ApiError);
    try {
      throwApiErrorFromEnvelope(errorEnvelope);
    } catch (e) {
      const err = e as ApiError;
      expect(err.tukioCode).toBe('USER-NOT-FOUND-001');
      expect(err.httpStatus).toBe(404);
      expect(err.title).toBe('User profile not found');
      expect(err.detail).toBe('No user with id abc');
      expect(err.instance).toBe('/v1/users/abc');
      expect(err.correlationId).toBe('corr-1');
    }
  });

  it('uses caller-supplied correlationId when provided', () => {
    try {
      throwApiErrorFromEnvelope(errorEnvelope, 'override-corr-id');
    } catch (e) {
      const err = e as ApiError;
      expect(err.correlationId).toBe('override-corr-id');
    }
  });
});

describe('isErrorEnvelope', () => {
  it('matches ErrorEnvelope shape', () => {
    expect(isErrorEnvelope(errorEnvelope)).toBe(true);
  });

  it('rejects SuccessEnvelope', () => {
    expect(isErrorEnvelope(successEnvelope)).toBe(false);
  });

  it('rejects null/undefined/primitives', () => {
    expect(isErrorEnvelope(null)).toBe(false);
    expect(isErrorEnvelope(undefined)).toBe(false);
    expect(isErrorEnvelope('error')).toBe(false);
    expect(isErrorEnvelope(42)).toBe(false);
  });

  it('rejects objects with `error` but no `tukioCode`', () => {
    expect(isErrorEnvelope({ error: { title: 'x' } })).toBe(false);
  });

  it('rejects envelope missing `method` (incomplete shape)', () => {
    expect(isErrorEnvelope({ code: 404, error: { tukioCode: 'X' }, meta: {} })).toBe(false);
  });

  it('rejects envelope missing `meta`', () => {
    expect(isErrorEnvelope({ method: 'GET', code: 404, error: { tukioCode: 'X' } })).toBe(false);
  });

  it('rejects envelope where `error` is null', () => {
    expect(isErrorEnvelope({ method: 'GET', code: 404, error: null, meta: {} })).toBe(false);
  });
});

describe('throwApiErrorFromEnvelope (defensive)', () => {
  it('falls back to UNKNOWN-ERROR-001 + API error when fields are missing', () => {
    const malformed = {
      method: 'GET',
      code: 500,
      error: {} as never,
      meta: {} as never,
    };
    try {
      throwApiErrorFromEnvelope(malformed as never);
    } catch (e) {
      const err = e as ApiError;
      expect(err.tukioCode).toBe('UNKNOWN-ERROR-001');
      expect(err.title).toBe('API error');
      expect(err.detail).toBe('');
    }
  });

  it('does not crash when meta is undefined', () => {
    const malformed = {
      method: 'GET',
      code: 500,
      error: { tukioCode: 'X', title: 'T', detail: 'D' },
      // meta intentionally missing
    } as unknown as ErrorEnvelope;
    expect(() => throwApiErrorFromEnvelope(malformed)).toThrow(ApiError);
  });
});
