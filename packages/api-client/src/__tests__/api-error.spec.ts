import { describe, it, expect } from 'vitest';
import { ApiError } from '../types/api-error.js';

describe('ApiError', () => {
  it('builds a typed error with all fields', () => {
    const err = new ApiError(
      'AUTH-NOT-AUTHENTICATED-002',
      401,
      'Authentication required',
      'Missing JWT token',
      undefined,
      'corr-id-1',
      '/v1/users/abc',
    );
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.tukioCode).toBe('AUTH-NOT-AUTHENTICATED-002');
    expect(err.httpStatus).toBe(401);
    expect(err.title).toBe('Authentication required');
    expect(err.detail).toBe('Missing JWT token');
    expect(err.correlationId).toBe('corr-id-1');
    expect(err.instance).toBe('/v1/users/abc');
    expect(err.message).toContain('AUTH-NOT-AUTHENTICATED-002');
  });

  it('isValidationError matches VALIDATION-FAILED-001', () => {
    const err = new ApiError('VALIDATION-FAILED-001', 422, 'Validation failed', '...');
    expect(err.isValidationError()).toBe(true);
  });

  it('isValidationError matches 422 even without VALIDATION-FAILED-001', () => {
    const err = new ApiError('CUSTOM-422', 422, 'Custom validation failed', '...');
    expect(err.isValidationError()).toBe(true);
  });

  it('isNotFound matches 404', () => {
    const err = new ApiError('USER-NOT-FOUND-001', 404, '...', '...');
    expect(err.isNotFound()).toBe(true);
    expect(err.isUnauthorized()).toBe(false);
  });

  it('isUnauthorized matches 401', () => {
    const err = new ApiError('AUTH-001', 401, '...', '...');
    expect(err.isUnauthorized()).toBe(true);
  });

  it('isForbidden matches 403', () => {
    const err = new ApiError('AUTH-FORBIDDEN-001', 403, '...', '...');
    expect(err.isForbidden()).toBe(true);
  });

  it('isConflict matches 409', () => {
    const err = new ApiError('BOOKING-CONFLICT-001', 409, '...', '...');
    expect(err.isConflict()).toBe(true);
  });

  it('isRateLimited matches 429', () => {
    const err = new ApiError('RATE-LIMITED', 429, '...', '...');
    expect(err.isRateLimited()).toBe(true);
  });

  it('isServerError matches >= 500', () => {
    const err500 = new ApiError('INTERNAL', 500, '...', '...');
    const err503 = new ApiError('SERVICE-UNAVAILABLE', 503, '...', '...');
    expect(err500.isServerError()).toBe(true);
    expect(err503.isServerError()).toBe(true);
  });

  it('preserves issues array for validation errors', () => {
    const err = new ApiError('VALIDATION-FAILED-001', 422, 'Validation failed', '...', [
      { path: 'email', code: 'invalid_string', message: 'Invalid email' },
    ]);
    expect(err.issues).toHaveLength(1);
    expect(err.issues?.[0]?.path).toBe('email');
  });

  it('falls back to readable message when title/detail are empty (no `[X] undefined: undefined`)', () => {
    const err = new ApiError('UNKNOWN-001', 500, '', '');
    expect(err.message).not.toContain('undefined');
    expect(err.message).toContain('API error');
    expect(err.message).toContain('<no detail>');
  });
});
