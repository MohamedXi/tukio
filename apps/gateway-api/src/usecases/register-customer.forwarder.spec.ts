import {
  IdentitySvcConflictError,
  IdentitySvcUnreachableError,
  IdentitySvcValidationError,
} from '../domain/ports/identity-svc.errors.js';
import type { IIdentitySvcClient } from '../domain/ports/identity-svc.port.js';
import {
  ExternalServiceException,
  IdentityConflictException,
  ValidationFailedException,
} from '../domain/exception/index.js';
import { RegisterCustomerForwarder } from './register-customer.forwarder.js';

const baseInput = {
  email: 'alice@example.com',
  password: 'StrongPass-2026!',
  firstName: 'Alice',
  lastName: 'Martin',
  locale: 'fr' as const,
  acceptTerms: true as const,
  acceptMarketing: false,
  correlationId: 'corr-1',
};

const successResponse = {
  userId: '11111111-1111-1111-1111-111111111111',
  requiresEmailVerification: true as const,
};

const buildClient = (
  impl: Partial<IIdentitySvcClient> = {},
): IIdentitySvcClient => ({
  registerCustomer: jest.fn().mockResolvedValue(successResponse),
  ...impl,
});

describe('RegisterCustomerForwarder', () => {
  it('returns the identity-svc response on success', async () => {
    const client = buildClient();
    const forwarder = new RegisterCustomerForwarder(client);

    const result = await forwarder.execute(baseInput);

    expect(result).toEqual(successResponse);
    expect(client.registerCustomer).toHaveBeenCalledWith(baseInput);
  });

  it('maps IdentitySvcConflictError → IdentityConflictException with propagated tukioCode', async () => {
    const client = buildClient({
      registerCustomer: jest
        .fn()
        .mockRejectedValue(
          new IdentitySvcConflictError('IDENTITY-CONFLICT-001', 'Email exists'),
        ),
    });
    const forwarder = new RegisterCustomerForwarder(client);

    await expect(forwarder.execute(baseInput)).rejects.toMatchObject({
      constructor: IdentityConflictException,
      tukioCode: 'IDENTITY-CONFLICT-001',
      httpStatus: 409,
      message: 'Email exists',
    });
  });

  it('maps IdentitySvcValidationError → ValidationFailedException carrying issues', async () => {
    const client = buildClient({
      registerCustomer: jest
        .fn()
        .mockRejectedValue(
          new IdentitySvcValidationError(
            'VALIDATION-FAILED-001',
            'Password too short',
            [{ path: 'password', code: 'too_small', message: 'Min 12 chars' }],
          ),
        ),
    });
    const forwarder = new RegisterCustomerForwarder(client);

    const promise = forwarder.execute(baseInput);
    await expect(promise).rejects.toBeInstanceOf(ValidationFailedException);
    await expect(promise).rejects.toMatchObject({
      tukioCode: 'VALIDATION-FAILED-001',
      httpStatus: 422,
      issues: [
        { path: 'password', code: 'too_small', message: 'Min 12 chars' },
      ],
    });
  });

  it('maps IdentitySvcUnreachableError → ExternalServiceException (502)', async () => {
    const client = buildClient({
      registerCustomer: jest
        .fn()
        .mockRejectedValue(
          new IdentitySvcUnreachableError(
            'identity-svc unreachable: ECONNREFUSED',
          ),
        ),
    });
    const forwarder = new RegisterCustomerForwarder(client);

    await expect(forwarder.execute(baseInput)).rejects.toMatchObject({
      constructor: ExternalServiceException,
      tukioCode: 'IDENTITY-EXTERNAL-001',
      httpStatus: 502,
    });
  });

  it('rethrows unknown errors verbatim (filter handles them as INTERNAL-SERVER-ERROR-001)', async () => {
    const boom = new Error('Boom — unknown failure');
    const client = buildClient({
      registerCustomer: jest.fn().mockRejectedValue(boom),
    });
    const forwarder = new RegisterCustomerForwarder(client);

    await expect(forwarder.execute(baseInput)).rejects.toBe(boom);
  });
});
