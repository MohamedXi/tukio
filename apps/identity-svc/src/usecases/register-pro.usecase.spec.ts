import {
  RegisterProUseCase,
  type RegisterProUseCaseInput,
  type RegisterProFile,
} from './register-pro.usecase.js';
import { UserProfile } from '../domain/model/user-profile.aggregate.js';
import { ProProfile } from '../domain/model/pro-profile.aggregate.js';
import { Email } from '../domain/model/email.value-object.js';
import { Siret } from '../domain/model/siret.value-object.js';
import { Address } from '../domain/model/address.value-object.js';
import { PhoneNumber } from '../domain/model/phone-number.value-object.js';
import { UserRole } from '../domain/model/user-role.enum.js';
import { KycStatus } from '../domain/model/kyc-status.enum.js';
import type { IUserProfileRepository } from '../domain/ports/user-profile.repository.port.js';
import type {
  IProProfileRepository,
  ProTransactionContext,
} from '../domain/ports/pro-profile.repository.port.js';
import type { ILogger } from '../domain/ports/logger.port.js';
import {
  type IKeycloakAdmin,
  KeycloakUserAlreadyExistsError,
  KeycloakUnreachableError,
} from '../domain/ports/keycloak-admin.port.js';
import {
  type IInseeSiretValidator,
  type InseeSiretSnapshot,
  type InseeAdministrativeStatus,
  InseeSiretNotFoundError,
  InseeRateLimitError,
  InseeUnreachableError,
} from '../domain/ports/insee-siret-validator.port.js';
import {
  type IMediaStorage,
  MediaStorageUploadError,
} from '../domain/ports/media-storage.port.js';
import { IdentityConflictException } from '../domain/exception/identity-conflict.exception.js';
import { IdentityValidationException } from '../domain/exception/identity-validation.exception.js';
import { ExternalServiceException } from '../domain/exception/external-service.exception.js';

const KYC_BUCKET = 'tukio-kyc-test';
const FIXED_NOW = new Date('2026-05-16T12:00:00.000Z');
const KC_USER_ID = '22222222-2222-4222-8222-222222222222';
const FIXED_USER_ID = '11111111-1111-4111-8111-111111111111';
const FIXED_PRO_ID = '33333333-3333-4333-8333-333333333333';
const FIXED_REGISTERED_EVENT_ID = '99999999-9999-4999-8999-999999999999';
const FIXED_EMAIL_EVENT_ID = '88888888-8888-4888-8888-888888888888';
const FIXED_CORRELATION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const VALID_INSEE: InseeSiretSnapshot = {
  administrativeStatus: 'active',
  legalName: 'LA POSTE',
  incorporationDate: '1991-01-01',
  legalCategory: '5510',
};

const mkFile = (filename: string, contentType: string): RegisterProFile => ({
  buffer: Buffer.from('fake-bytes'),
  contentType,
  originalName: filename,
});

const baseInput = (
  overrides: Partial<RegisterProUseCaseInput> = {},
): RegisterProUseCaseInput => ({
  email: 'contact@acme.fr',
  password: 'SecurePass1234!',
  firstName: 'Alice',
  lastName: 'Martin',
  locale: 'fr',
  acceptTerms: true,
  acceptMarketing: false,
  companyName: 'Acme SAS',
  siret: '35600000000048',
  address: {
    street: '9 rue du Colonel Pierre Avia',
    postalCode: '75015',
    city: 'Paris',
    country: 'FR',
  },
  contactPhone: '+33612345678',
  files: {
    idCard: mkFile('id.jpg', 'image/jpeg'),
    rib: mkFile('rib.pdf', 'application/pdf'),
    kbisOrInsee: mkFile('kbis.pdf', 'application/pdf'),
  },
  correlationId: FIXED_CORRELATION_ID,
  ...overrides,
});

const existingPro = (): ProProfile =>
  ProProfile.register({
    userProfileId: 'existing-up',
    companyName: 'Existing SAS',
    siret: Siret.create('35600000000048'),
    address: Address.create({
      street: 'rue X',
      postalCode: '75001',
      city: 'Paris',
      country: 'FR',
    }),
    contactPhone: PhoneNumber.create('+33611111111'),
    kyc: { idCardR2Key: 'k1', ribR2Key: 'k2', kbisR2Key: null },
    inseeAdministrativeStatus: 'active',
    insee: { legalName: null, incorporationDate: null, legalCategory: null },
  });

const existingUser = (): UserProfile =>
  UserProfile.create({
    id: 'existing-id',
    keycloakUserId: 'existing-kc',
    email: Email.create('contact@acme.fr'),
    firstName: 'Existing',
    lastName: 'User',
    role: UserRole.PRO,
    locale: 'fr',
    acquisition: UserProfile.defaultAcquisition(),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    deletedAt: null,
  });

type Mocks = {
  userProfileRepo: jest.Mocked<IUserProfileRepository>;
  proProfileRepo: jest.Mocked<IProProfileRepository>;
  keycloak: jest.Mocked<IKeycloakAdmin>;
  insee: jest.Mocked<IInseeSiretValidator>;
  media: jest.Mocked<IMediaStorage>;
  logger: jest.Mocked<ILogger>;
  publishedEvents: unknown[];
  savedUserProfiles: UserProfile[];
  savedProProfiles: ProProfile[];
};

const buildUseCase = (mocks: Mocks): RegisterProUseCase => {
  const uuidQueue = [
    FIXED_USER_ID,
    FIXED_PRO_ID,
    FIXED_REGISTERED_EVENT_ID,
    FIXED_EMAIL_EVENT_ID,
  ];
  const queue = [...uuidQueue];
  const newUuid = jest.fn(() => {
    const next = queue.shift();
    if (next === undefined) {
      throw new Error('uuid queue underflow — test fixture exhausted');
    }
    return next;
  });
  return new RegisterProUseCase(
    mocks.userProfileRepo,
    mocks.proProfileRepo,
    mocks.keycloak,
    mocks.insee,
    mocks.media,
    mocks.logger,
    KYC_BUCKET,
    () => FIXED_NOW,
    newUuid,
  );
};

const buildMocks = (): Mocks => {
  const savedUserProfiles: UserProfile[] = [];
  const savedProProfiles: ProProfile[] = [];
  const publishedEvents: unknown[] = [];

  const userProfileRepo: jest.Mocked<IUserProfileRepository> = {
    findById: jest.fn(),
    findByKeycloakUserId: jest.fn(),
    findByEmail: jest.fn().mockResolvedValue(null),
    save: jest.fn(),
    runInTransaction: jest.fn(),
  };

  const proProfileRepo: jest.Mocked<IProProfileRepository> = {
    findBySiret: jest.fn().mockResolvedValue(null),
    findById: jest.fn(),
    save: jest.fn(),
    runInTransaction: jest
      .fn()
      .mockImplementation(
        async (cb: (txn: ProTransactionContext) => Promise<unknown>) => {
          const txn: ProTransactionContext = {
            userProfileRepo: {
              save: (profile: UserProfile) => {
                savedUserProfiles.push(profile);
                return Promise.resolve();
              },
            },
            proProfileRepo: {
              save: (profile: ProProfile) => {
                savedProProfiles.push(profile);
                return Promise.resolve();
              },
            },
            tokenRepo: {
              save: jest.fn(),
              findByToken: jest.fn(),
              markUsed: jest.fn(),
            },
            eventPublisher: {
              publish: (event) => {
                publishedEvents.push(event);
                return Promise.resolve();
              },
            },
          };
          return cb(txn);
        },
      ),
  };

  const keycloak: jest.Mocked<IKeycloakAdmin> = {
    createUser: jest.fn().mockResolvedValue({ keycloakUserId: KC_USER_ID }),
    findUserByEmail: jest.fn(),
    deleteUser: jest.fn().mockResolvedValue(undefined),
    setUserPassword: jest.fn(),
    assignRealmRole: jest.fn(),
    setUserAttributes: jest.fn(),
  };

  const insee: jest.Mocked<IInseeSiretValidator> = {
    validate: jest.fn().mockResolvedValue(VALID_INSEE),
  };

  const media: jest.Mocked<IMediaStorage> = {
    upload: jest
      .fn()
      .mockImplementation(({ key }: { key: string }) =>
        Promise.resolve({ key, etag: 'etag-fake' }),
      ),
    getSignedUrl: jest.fn(),
    delete: jest.fn().mockResolvedValue(undefined),
  };

  const logger: jest.Mocked<ILogger> = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  return {
    userProfileRepo,
    proProfileRepo,
    keycloak,
    insee,
    media,
    logger,
    publishedEvents,
    savedUserProfiles,
    savedProProfiles,
  };
};

describe('RegisterProUseCase', () => {
  it('happy path → INSEE-validates, creates Keycloak user, uploads 3 KYC files, persists both aggregates, publishes 2 events', async () => {
    const m = buildMocks();
    const uc = buildUseCase(m);

    const result = await uc.execute(baseInput());

    expect(result).toEqual({
      userId: FIXED_USER_ID,
      proProfileId: FIXED_PRO_ID,
      requiresAdminReview: true,
      requiresEmailVerification: true,
    });

    expect(m.proProfileRepo.findBySiret).toHaveBeenCalledTimes(1);
    expect(m.insee.validate).toHaveBeenCalledTimes(1);
    expect(m.userProfileRepo.findByEmail).toHaveBeenCalledWith(
      'contact@acme.fr',
    );
    expect(m.keycloak.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'contact@acme.fr',
        role: 'pro',
        status: 'pending_admin_review',
      }),
    );

    expect(m.media.upload).toHaveBeenCalledTimes(3);
    const uploadedKeys = m.media.upload.mock.calls.map(([call]) => call.key);
    expect(uploadedKeys).toEqual(
      expect.arrayContaining([
        `pro/${FIXED_USER_ID}/id-card.jpg`,
        `pro/${FIXED_USER_ID}/rib.pdf`,
        `pro/${FIXED_USER_ID}/kbis-or-insee.pdf`,
      ]),
    );
    expect(
      m.media.upload.mock.calls.every(([call]) => call.bucket === KYC_BUCKET),
    ).toBe(true);

    expect(m.savedUserProfiles).toHaveLength(1);
    expect(m.savedUserProfiles[0]?.role).toBe(UserRole.PRO);
    expect(m.savedProProfiles).toHaveLength(1);
    expect(m.savedProProfiles[0]?.kycStatus).toBe(KycStatus.PENDING_REVIEW);

    expect(m.publishedEvents).toHaveLength(2);
    const eventTypes = (m.publishedEvents as Array<{ eventType: string }>).map(
      (e) => e.eventType,
    );
    expect(eventTypes).toEqual([
      'identity.pro.registered.v1',
      'notification.email.send.v1',
    ]);
  });

  it('rejects when SIRET is already registered (FR16 anti-doublon) — no Keycloak / R2 / DB writes', async () => {
    const m = buildMocks();
    m.proProfileRepo.findBySiret.mockResolvedValue(existingPro());
    const uc = buildUseCase(m);

    await expect(uc.execute(baseInput())).rejects.toMatchObject({
      tukioCode: 'IDENTITY-CONFLICT-002',
    });
    expect(m.insee.validate).not.toHaveBeenCalled();
    expect(m.keycloak.createUser).not.toHaveBeenCalled();
    expect(m.media.upload).not.toHaveBeenCalled();
  });

  it('rejects when INSEE marks the SIRET as ceased', async () => {
    const m = buildMocks();
    m.insee.validate.mockResolvedValue({
      ...VALID_INSEE,
      administrativeStatus: 'ceased' as InseeAdministrativeStatus,
    });
    const uc = buildUseCase(m);

    await expect(uc.execute(baseInput())).rejects.toBeInstanceOf(
      IdentityValidationException,
    );
    await expect(uc.execute(baseInput())).rejects.toMatchObject({
      tukioCode: 'IDENTITY-VALIDATION-003',
    });
    expect(m.keycloak.createUser).not.toHaveBeenCalled();
  });

  it('rejects when INSEE returns 404 (unknown SIRET)', async () => {
    const m = buildMocks();
    m.insee.validate.mockRejectedValue(
      new InseeSiretNotFoundError('35600000000048'),
    );
    const uc = buildUseCase(m);

    await expect(uc.execute(baseInput())).rejects.toMatchObject({
      tukioCode: 'IDENTITY-VALIDATION-003',
    });
  });

  it('rejects when INSEE is rate-limited', async () => {
    const m = buildMocks();
    m.insee.validate.mockRejectedValue(new InseeRateLimitError(60_000));
    const uc = buildUseCase(m);

    await expect(uc.execute(baseInput())).rejects.toBeInstanceOf(
      ExternalServiceException,
    );
    await expect(uc.execute(baseInput())).rejects.toMatchObject({
      tukioCode: 'IDENTITY-EXTERNAL-002',
    });
  });

  it('rejects when INSEE is unreachable (5xx)', async () => {
    const m = buildMocks();
    m.insee.validate.mockRejectedValue(new InseeUnreachableError('5xx'));
    const uc = buildUseCase(m);

    await expect(uc.execute(baseInput())).rejects.toMatchObject({
      tukioCode: 'IDENTITY-EXTERNAL-002',
    });
  });

  it('rejects when email already exists in DB — anti-enumeration', async () => {
    const m = buildMocks();
    m.userProfileRepo.findByEmail.mockResolvedValue(existingUser());
    const uc = buildUseCase(m);

    await expect(uc.execute(baseInput())).rejects.toMatchObject({
      tukioCode: 'IDENTITY-CONFLICT-001',
    });
    expect(m.keycloak.createUser).not.toHaveBeenCalled();
  });

  it('rejects on Keycloak email-already-exists race', async () => {
    const m = buildMocks();
    m.keycloak.createUser.mockRejectedValue(
      new KeycloakUserAlreadyExistsError('contact@acme.fr'),
    );
    const uc = buildUseCase(m);

    await expect(uc.execute(baseInput())).rejects.toMatchObject({
      tukioCode: 'IDENTITY-CONFLICT-001',
    });
    expect(m.media.upload).not.toHaveBeenCalled();
  });

  it('rethrows an unexpected INSEE error verbatim (defensive)', async () => {
    const m = buildMocks();
    m.insee.validate.mockRejectedValue(new Error('totally unexpected error'));
    const uc = buildUseCase(m);

    await expect(uc.execute(baseInput())).rejects.toThrow(
      'totally unexpected error',
    );
  });

  it('rethrows an unexpected Keycloak error verbatim (defensive)', async () => {
    const m = buildMocks();
    m.keycloak.createUser.mockRejectedValue(new Error('weird keycloak issue'));
    const uc = buildUseCase(m);

    await expect(uc.execute(baseInput())).rejects.toThrow(
      'weird keycloak issue',
    );
  });

  it('falls back to the filename extension when MIME is unknown (allowed extension)', async () => {
    const m = buildMocks();
    const uc = buildUseCase(m);
    const input = baseInput();
    input.files.idCard = {
      buffer: Buffer.from('x'),
      contentType: 'application/octet-stream', // not in the MIME whitelist
      originalName: 'mystery-doc.png', // .png is in the allowed extensions list
    };

    await uc.execute(input);
    const keys = m.media.upload.mock.calls.map(([c]) => c.key);
    expect(keys).toContain(`pro/${FIXED_USER_ID}/id-card.png`);
  });

  it('strips disallowed extensions (e.g. .tiff, .exe) and stores the file with no extension (D4)', async () => {
    const m = buildMocks();
    const uc = buildUseCase(m);
    const input = baseInput();
    input.files.idCard = {
      buffer: Buffer.from('x'),
      contentType: 'application/octet-stream',
      originalName: 'mystery-doc.tiff', // .tiff is NOT in the allowlist
    };

    await uc.execute(input);
    const keys = m.media.upload.mock.calls.map(([c]) => c.key);
    expect(keys).toContain(`pro/${FIXED_USER_ID}/id-card`); // no extension
  });

  it('rejects when Keycloak is unreachable', async () => {
    const m = buildMocks();
    m.keycloak.createUser.mockRejectedValue(
      new KeycloakUnreachableError('down'),
    );
    const uc = buildUseCase(m);

    await expect(uc.execute(baseInput())).rejects.toBeInstanceOf(
      ExternalServiceException,
    );
    await expect(uc.execute(baseInput())).rejects.toMatchObject({
      tukioCode: 'IDENTITY-EXTERNAL-001',
    });
  });

  it('compensates Keycloak when R2 upload fails', async () => {
    const m = buildMocks();
    m.media.upload.mockRejectedValue(new MediaStorageUploadError('r2 down'));
    const uc = buildUseCase(m);

    await expect(uc.execute(baseInput())).rejects.toMatchObject({
      tukioCode: 'IDENTITY-EXTERNAL-003',
    });
    expect(m.keycloak.deleteUser).toHaveBeenCalledWith(KC_USER_ID);
  });

  it('compensates both Keycloak and R2 when DB transaction fails', async () => {
    const m = buildMocks();
    m.proProfileRepo.runInTransaction.mockRejectedValue(
      new Error('DB explodes'),
    );
    const uc = buildUseCase(m);

    await expect(uc.execute(baseInput())).rejects.toThrow('DB explodes');
    expect(m.keycloak.deleteUser).toHaveBeenCalledWith(KC_USER_ID);
    // Three uploads succeeded before the txn failed; all three keys must be deleted.
    expect(m.media.delete).toHaveBeenCalledTimes(3);
  });

  it('translates a Postgres 23505 unique violation on SIRET into CONFLICT_SIRET_EXISTS + compensation', async () => {
    const m = buildMocks();
    const pgError = Object.assign(new Error('unique_violation'), {
      code: '23505',
      constraint: 'uq_pro_profiles_siret',
    });
    m.proProfileRepo.runInTransaction.mockRejectedValue(pgError);
    const uc = buildUseCase(m);

    await expect(uc.execute(baseInput())).rejects.toBeInstanceOf(
      IdentityConflictException,
    );
    await expect(uc.execute(baseInput())).rejects.toMatchObject({
      tukioCode: 'IDENTITY-CONFLICT-002',
    });
    expect(m.keycloak.deleteUser).toHaveBeenCalled();
    expect(m.media.delete).toHaveBeenCalled();
  });

  it('translates a Postgres 23505 on the email column into CONFLICT_EMAIL_EXISTS (race condition)', async () => {
    const m = buildMocks();
    const pgError = Object.assign(new Error('unique_violation'), {
      code: '23505',
      constraint: 'uq_user_profiles_email',
    });
    m.proProfileRepo.runInTransaction.mockRejectedValue(pgError);
    const uc = buildUseCase(m);

    await expect(uc.execute(baseInput())).rejects.toMatchObject({
      tukioCode: 'IDENTITY-CONFLICT-001',
    });
    expect(m.keycloak.deleteUser).toHaveBeenCalled();
  });

  it('accepts the registration when vatNumber is omitted', async () => {
    const m = buildMocks();
    const uc = buildUseCase(m);
    const input = baseInput();
    delete (input as Partial<RegisterProUseCaseInput>).vatNumber;

    await expect(uc.execute(input)).resolves.toMatchObject({
      requiresAdminReview: true,
    });
    expect(m.savedProProfiles[0]?.vatNumber).toBeNull();
  });

  it('accepts the registration when kbisOrInsee file is omitted (only 2 uploads happen)', async () => {
    const m = buildMocks();
    const uc = buildUseCase(m);
    const input = baseInput();
    delete input.files.kbisOrInsee;

    const result = await uc.execute(input);
    expect(result.proProfileId).toBe(FIXED_PRO_ID);
    expect(m.media.upload).toHaveBeenCalledTimes(2);
    expect(m.savedProProfiles[0]?.kyc.kbisR2Key).toBeNull();
  });

  it('compensates R2 when txn fails even when kbisOrInsee was omitted (only 2 deletes)', async () => {
    const m = buildMocks();
    m.proProfileRepo.runInTransaction.mockRejectedValue(
      new Error('DB explodes'),
    );
    const uc = buildUseCase(m);
    const input = baseInput();
    delete input.files.kbisOrInsee;

    await expect(uc.execute(input)).rejects.toThrow('DB explodes');
    expect(m.media.delete).toHaveBeenCalledTimes(2);
  });

  it('logs a warning and does not rethrow when Keycloak compensation deleteUser fails (D4)', async () => {
    const m = buildMocks();
    // deleteUser rejects — exercises the catch+warn branch in compensateKeycloak.
    m.keycloak.deleteUser.mockRejectedValue(
      new Error('Keycloak compensation rejected'),
    );
    m.proProfileRepo.runInTransaction.mockRejectedValue(
      new Error('DB explodes'),
    );
    const uc = buildUseCase(m);

    // The saga re-throws the original DB error, not the compensation error.
    await expect(uc.execute(baseInput())).rejects.toThrow('DB explodes');
    expect(m.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Keycloak rollback compensation failed'),
      expect.objectContaining({ keycloakUserId: KC_USER_ID }),
    );
  });
});
