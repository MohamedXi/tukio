import { IdentityErrorCodes } from '@tukio/contracts/types/error-codes';
import { IdentityConflictException } from './identity-conflict.exception.js';

describe('IdentityConflictException', () => {
  it('accepts CONFLICT_EMAIL_EXISTS code', () => {
    const ex = new IdentityConflictException(
      IdentityErrorCodes.CONFLICT_EMAIL_EXISTS,
      'Email taken',
    );
    expect(ex.tukioCode).toBe('IDENTITY-CONFLICT-001');
    expect(ex.httpStatus).toBe(409);
    expect(ex.title).toBe('Identity conflict');
    expect(ex.message).toBe('Email taken');
  });

  it('accepts CONFLICT_SIRET_EXISTS and CONFLICT_ACTIVE_BOOKINGS codes', () => {
    expect(
      () =>
        new IdentityConflictException(
          IdentityErrorCodes.CONFLICT_SIRET_EXISTS,
          'SIRET taken',
        ),
    ).not.toThrow();
    expect(
      () =>
        new IdentityConflictException(
          IdentityErrorCodes.CONFLICT_ACTIVE_BOOKINGS,
          'Active bookings exist',
        ),
    ).not.toThrow();
  });

  it('rejects a non-conflict identity code (guard error)', () => {
    expect(
      () =>
        new IdentityConflictException(
          IdentityErrorCodes.EXTERNAL_KEYCLOAK_DOWN,
          'wrong code',
        ),
    ).toThrow(/not a registered conflict code/);
  });
});
