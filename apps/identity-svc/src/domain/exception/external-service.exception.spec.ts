import { IdentityErrorCodes } from '@tukio/contracts/types/error-codes';
import { ExternalServiceException } from './external-service.exception.js';

describe('ExternalServiceException', () => {
  it('accepts EXTERNAL_KEYCLOAK_DOWN code', () => {
    const ex = new ExternalServiceException(
      IdentityErrorCodes.EXTERNAL_KEYCLOAK_DOWN,
      'Keycloak unreachable',
    );
    expect(ex.tukioCode).toBe('IDENTITY-EXTERNAL-001');
    expect(ex.httpStatus).toBe(502);
    expect(ex.title).toBe('External service unavailable');
  });

  it('accepts EXTERNAL_INSEE_DOWN code', () => {
    expect(
      () =>
        new ExternalServiceException(
          IdentityErrorCodes.EXTERNAL_INSEE_DOWN,
          'INSEE down',
        ),
    ).not.toThrow();
  });

  it('rejects a non-external identity code (guard error)', () => {
    expect(
      () =>
        new ExternalServiceException(
          IdentityErrorCodes.CONFLICT_EMAIL_EXISTS,
          'wrong category',
        ),
    ).toThrow(/not a registered external code/);
  });
});
