import { RegisterProForwarder } from './register-pro.forwarder.js';
import type {
  ForwardRegisterProInput,
  IIdentitySvcClient,
} from '../domain/ports/identity-svc.port.js';
import {
  IdentitySvcConflictError,
  IdentitySvcUnreachableError,
  IdentitySvcValidationError,
} from '../domain/ports/identity-svc.errors.js';
import {
  ExternalServiceException,
  IdentityConflictException,
  ValidationFailedException,
} from '../domain/exception/index.js';

const baseInput: ForwardRegisterProInput = {
  email: 'pro@example.com',
  password: 'StrongPass-2026!',
  firstName: 'Jean',
  lastName: 'Dupont',
  locale: 'fr',
  acceptTerms: true,
  acceptMarketing: false,
  companyName: 'Pro SAS',
  siret: '73282932000074',
  address: {
    street: '1 rue de la République',
    postalCode: '44000',
    city: 'Nantes',
    country: 'FR',
  },
  contactPhone: '+33612345678',
  correlationId: 'corr-pro-1',
  files: {
    idCard: {
      buffer: Buffer.from('idcard'),
      contentType: 'image/jpeg',
      originalName: 'id.jpg',
    },
    rib: {
      buffer: Buffer.from('rib'),
      contentType: 'application/pdf',
      originalName: 'rib.pdf',
    },
  },
};

const successResponse = {
  userId: '11111111-1111-1111-1111-111111111111',
  proProfileId: '22222222-2222-2222-2222-222222222222',
  requiresAdminReview: true as const,
  requiresEmailVerification: true as const,
};

const buildClient = (
  impl: Partial<IIdentitySvcClient> = {},
): IIdentitySvcClient => ({
  registerCustomer: jest
    .fn()
    .mockRejectedValue(new Error('not stubbed in pro spec')),
  registerPro: jest.fn().mockResolvedValue(successResponse),
  ...impl,
});

describe('RegisterProForwarder', () => {
  it('returns the identity-svc response on success', async () => {
    const client = buildClient();
    const forwarder = new RegisterProForwarder(client);

    const result = await forwarder.execute(baseInput);

    expect(result).toEqual(successResponse);
    expect(client.registerPro).toHaveBeenCalledWith(baseInput);
  });

  it('maps IdentitySvcConflictError → IdentityConflictException with propagated tukioCode', async () => {
    const client = buildClient({
      registerPro: jest
        .fn()
        .mockRejectedValue(
          new IdentitySvcConflictError(
            'IDENTITY-CONFLICT-002',
            'SIRET already registered',
          ),
        ),
    });
    const forwarder = new RegisterProForwarder(client);

    await expect(forwarder.execute(baseInput)).rejects.toMatchObject({
      constructor: IdentityConflictException,
      tukioCode: 'IDENTITY-CONFLICT-002',
    });
  });

  it('maps IdentitySvcValidationError → ValidationFailedException carrying the issues', async () => {
    const client = buildClient({
      registerPro: jest.fn().mockRejectedValue(
        new IdentitySvcValidationError(
          'IDENTITY-VALIDATION-003',
          'SIRET inactive',
          [
            {
              path: 'siret',
              code: 'insee_inactive',
              message: 'SIRET ceased on 2024-01-01',
            },
          ],
        ),
      ),
    });
    const forwarder = new RegisterProForwarder(client);

    const error = await forwarder.execute(baseInput).catch((e) => e);
    expect(error).toBeInstanceOf(ValidationFailedException);
    expect((error as ValidationFailedException).issues).toEqual([
      {
        path: 'siret',
        code: 'insee_inactive',
        message: 'SIRET ceased on 2024-01-01',
      },
    ]);
  });

  it('maps IdentitySvcUnreachableError → ExternalServiceException (502 to caller)', async () => {
    const client = buildClient({
      registerPro: jest
        .fn()
        .mockRejectedValue(
          new IdentitySvcUnreachableError('INSEE 503 after retries'),
        ),
    });
    const forwarder = new RegisterProForwarder(client);

    await expect(forwarder.execute(baseInput)).rejects.toBeInstanceOf(
      ExternalServiceException,
    );
  });

  it('re-throws unknown Error instances unchanged (no double wrap)', async () => {
    const sentinel = new TypeError('boom');
    const client = buildClient({
      registerPro: jest.fn().mockRejectedValue(sentinel),
    });
    const forwarder = new RegisterProForwarder(client);

    await expect(forwarder.execute(baseInput)).rejects.toBe(sentinel);
  });
});
