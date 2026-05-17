import {
  RegisterCustomerUseCase,
  type RegisterCustomerUseCaseInput,
} from './register-customer.usecase.js';
import { UserProfile } from '../domain/model/user-profile.aggregate.js';
import { Email } from '../domain/model/email.value-object.js';
import { UserRole } from '../domain/model/user-role.enum.js';
import type {
  IUserProfileRepository,
  TransactionContext,
} from '../domain/ports/user-profile.repository.port.js';
import type { IEventPublisher } from '../domain/ports/event-publisher.port.js';
import type { IEmailVerificationTokenRepository } from '../domain/ports/email-verification-token-repository.port.js';
import type { ILogger } from '../domain/ports/logger.port.js';
import {
  type IKeycloakAdmin,
  KeycloakUserAlreadyExistsError,
  KeycloakUnreachableError,
} from '../domain/ports/keycloak-admin.port.js';
import { IdentityConflictException } from '../domain/exception/identity-conflict.exception.js';
import { ExternalServiceException } from '../domain/exception/external-service.exception.js';
import { SYSTEM_ACTOR_USER_ID } from '@tukio/contracts/types/Actor';

const PUBLIC_BASE_URL = 'http://localhost:3000';
const FIXED_NOW = new Date('2026-05-15T12:00:00.000Z');
const KC_USER_ID = '22222222-2222-4222-8222-222222222222';
const FIXED_USER_ID = '11111111-1111-4111-8111-111111111111';
const FIXED_VERIFY_TOKEN = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const FIXED_REGISTERED_EVENT_ID = '99999999-9999-4999-8999-999999999999';
const FIXED_EMAIL_EVENT_ID = '88888888-8888-4888-8888-888888888888';
const FIXED_GENERATED_CORRELATION_ID = '77777777-7777-4777-8777-777777777777';
const FIXED_CORRELATION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

type MockRepo = {
  findById: jest.Mock;
  findByKeycloakUserId: jest.Mock;
  findByEmail: jest.Mock<Promise<UserProfile | null>, [string], unknown>;
  save: jest.Mock<Promise<void>, [UserProfile], unknown>;
  runInTransaction: jest.Mock;
} & IUserProfileRepository;

interface MockKeycloak extends IKeycloakAdmin {
  createUser: jest.Mock;
  findUserByEmail: jest.Mock;
  deleteUser: jest.Mock;
  setUserPassword: jest.Mock;
  assignRealmRole: jest.Mock;
  setUserAttributes: jest.Mock;
}

interface MockEventPublisher extends IEventPublisher {
  publish: jest.Mock;
}

interface MockTokenRepo extends IEmailVerificationTokenRepository {
  save: jest.Mock;
  findByToken: jest.Mock;
  markUsed: jest.Mock;
}

interface MockLogger extends ILogger {
  debug: jest.Mock;
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
}

const baseInput = (
  overrides: Partial<RegisterCustomerUseCaseInput> = {},
): RegisterCustomerUseCaseInput => ({
  email: 'alice@example.com',
  password: 'SecurePass1234!',
  firstName: 'Alice',
  lastName: 'Martin',
  locale: 'fr',
  acceptTerms: true,
  acceptMarketing: false,
  correlationId: FIXED_CORRELATION_ID,
  ...overrides,
});

const buildExistingProfile = (email: string): UserProfile =>
  UserProfile.create({
    id: 'existing-id',
    keycloakUserId: 'existing-kc',
    email: Email.create(email),
    firstName: 'Existing',
    lastName: 'User',
    role: UserRole.CLIENT,
    locale: 'fr',
    acquisition: UserProfile.defaultAcquisition(),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    deletedAt: null,
  });

describe('RegisterCustomerUseCase', () => {
  let repo: MockRepo;
  let keycloak: MockKeycloak;
  let eventPublisher: MockEventPublisher;
  let tokenRepo: MockTokenRepo;
  let logger: MockLogger;
  let useCase: RegisterCustomerUseCase;
  let nowCalls: number;

  let txnCalls: {
    saved: UserProfile[];
    tokens: { token: string; userId: string; expiresAt: Date }[];
    publishedEvents: unknown[];
  };

  beforeEach(() => {
    txnCalls = { saved: [], tokens: [], publishedEvents: [] };
    nowCalls = 0;

    repo = {
      findById: jest.fn(),
      findByKeycloakUserId: jest.fn(),
      findByEmail: jest.fn().mockResolvedValue(null),
      save: jest.fn(),
      runInTransaction: jest
        .fn()
        .mockImplementation(
          async (cb: (txn: TransactionContext) => Promise<unknown>) => {
            const txnPublisher: IEventPublisher = {
              publish: <P>(
                event: import('@tukio/contracts/types/DomainEvent').DomainEvent<P>,
              ) => {
                txnCalls.publishedEvents.push(event);
                return Promise.resolve();
              },
            };
            const txnUserProfileRepo = {
              save: (profile: UserProfile) => {
                txnCalls.saved.push(profile);
                return Promise.resolve();
              },
            };
            const txnTokenRepo: IEmailVerificationTokenRepository = {
              save: (record) => {
                txnCalls.tokens.push(record);
                return Promise.resolve();
              },
              findByToken: jest.fn(),
              markUsed: jest.fn(),
            };
            return cb({
              userProfileRepo: txnUserProfileRepo,
              tokenRepo: txnTokenRepo,
              eventPublisher: txnPublisher,
            });
          },
        ),
    };

    keycloak = {
      createUser: jest.fn().mockResolvedValue({ keycloakUserId: KC_USER_ID }),
      findUserByEmail: jest.fn(),
      findUserById: jest.fn(),
      hasRealmRole: jest.fn(),
      deleteUser: jest.fn().mockResolvedValue(undefined),
      setUserPassword: jest.fn(),
      assignRealmRole: jest.fn(),
      setUserAttributes: jest.fn(),
    };

    eventPublisher = { publish: jest.fn() };
    tokenRepo = {
      save: jest.fn(),
      findByToken: jest.fn(),
      markUsed: jest.fn(),
    };

    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Deterministic uuid queue. Order of consumption when correlationId is
    // provided : (1) userProfile.id, (2) verifyToken, (3) userRegistered
    // eventId, (4) emailSend eventId. When correlationId is omitted, an extra
    // newUuid() is consumed first for the generated correlationId.
    // Review patch P14 — fallback throws instead of returning a fixed value,
    // so a future code change that adds a 5th call surfaces immediately
    // instead of silently colliding ids.
    const uuidQueueProvidedCorrelation = [
      FIXED_USER_ID,
      FIXED_VERIFY_TOKEN,
      FIXED_REGISTERED_EVENT_ID,
      FIXED_EMAIL_EVENT_ID,
    ];
    const queue = [...uuidQueueProvidedCorrelation];
    const newUuid = jest.fn(() => {
      const next = queue.shift();
      if (next === undefined) {
        throw new Error('uuid queue underflow — test fixture exhausted');
      }
      return next;
    });

    useCase = new RegisterCustomerUseCase(
      repo,
      keycloak,
      logger,
      PUBLIC_BASE_URL,
      () => {
        nowCalls += 1;
        return FIXED_NOW;
      },
      newUuid,
    );

    // Silence unused-vars warnings on test-only fixtures wired for clarity.
    void eventPublisher;
    void tokenRepo;
  });

  it('happy path → creates Keycloak user, persists aggregate + token, publishes 2 events, returns userId', async () => {
    const result = await useCase.execute(baseInput());

    expect(result).toEqual({
      userId: FIXED_USER_ID,
      requiresEmailVerification: true,
    });

    expect(repo.findByEmail).toHaveBeenCalledWith('alice@example.com');
    expect(keycloak.createUser).toHaveBeenCalledWith({
      email: 'alice@example.com',
      firstName: 'Alice',
      lastName: 'Martin',
      password: 'SecurePass1234!',
      locale: 'fr',
      emailVerified: false,
      role: 'client',
      status: 'active',
    });

    expect(txnCalls.saved).toHaveLength(1);
    expect(txnCalls.saved[0]?.keycloakUserId).toBe(KC_USER_ID);
    expect(txnCalls.saved[0]?.id).toBe(FIXED_USER_ID);

    expect(txnCalls.tokens).toHaveLength(1);
    expect(txnCalls.tokens[0]?.token).toBe(FIXED_VERIFY_TOKEN);
    expect(txnCalls.tokens[0]?.userId).toBe(FIXED_USER_ID);
    expect(txnCalls.tokens[0]?.expiresAt.getTime()).toBe(
      FIXED_NOW.getTime() + 7 * 24 * 60 * 60 * 1000,
    );

    expect(txnCalls.publishedEvents).toHaveLength(2);
    const [registered, emailSend] = txnCalls.publishedEvents as Array<
      Record<string, unknown>
    >;
    expect(registered?.eventType).toBe('identity.user.registered.v1');
    expect((registered?.payload as Record<string, unknown>).userId).toBe(
      FIXED_USER_ID,
    );
    expect(
      (registered?.payload as Record<string, unknown>).acquisitionSource,
    ).toBe('unknown');
    expect(
      (registered?.payload as Record<string, unknown>).marketingOptIn,
    ).toBe(false);
    expect(registered?.correlationId).toBe(FIXED_CORRELATION_ID);

    expect(emailSend?.eventType).toBe('notification.email.send.v1');
    expect((emailSend?.payload as Record<string, unknown>).templateId).toBe(
      'email-verify',
    );
    const params = (emailSend?.payload as Record<string, unknown>)
      .params as Record<string, unknown>;
    expect(params.verifyUrl).toBe(
      `${PUBLIC_BASE_URL}/fr/auth/email/verify?token=${FIXED_VERIFY_TOKEN}`,
    );
  });

  it('email already in DB → throws IdentityConflictException (IDENTITY-CONFLICT-001) without calling Keycloak', async () => {
    repo.findByEmail.mockResolvedValue(
      buildExistingProfile('alice@example.com'),
    );

    await expect(useCase.execute(baseInput())).rejects.toMatchObject({
      tukioCode: 'IDENTITY-CONFLICT-001',
      httpStatus: 409,
    });
    await expect(useCase.execute(baseInput())).rejects.toBeInstanceOf(
      IdentityConflictException,
    );

    expect(keycloak.createUser).not.toHaveBeenCalled();
    expect(keycloak.deleteUser).not.toHaveBeenCalled();
  });

  it('Keycloak race conflict → throws IdentityConflictException (IDENTITY-CONFLICT-001) without DB save', async () => {
    keycloak.createUser.mockRejectedValue(
      new KeycloakUserAlreadyExistsError('alice@example.com'),
    );

    await expect(useCase.execute(baseInput())).rejects.toMatchObject({
      tukioCode: 'IDENTITY-CONFLICT-001',
    });
    expect(repo.runInTransaction).not.toHaveBeenCalled();
    expect(keycloak.deleteUser).not.toHaveBeenCalled();
  });

  it('Keycloak DOWN → throws ExternalServiceException (IDENTITY-EXTERNAL-001) without DB save and without compensation', async () => {
    keycloak.createUser.mockRejectedValue(
      new KeycloakUnreachableError('timeout connecting to Keycloak'),
    );

    await expect(useCase.execute(baseInput())).rejects.toBeInstanceOf(
      ExternalServiceException,
    );
    await expect(useCase.execute(baseInput())).rejects.toMatchObject({
      tukioCode: 'IDENTITY-EXTERNAL-001',
      httpStatus: 502,
    });
    expect(repo.runInTransaction).not.toHaveBeenCalled();
    expect(keycloak.deleteUser).not.toHaveBeenCalled();
  });

  it('unexpected Keycloak error → rethrows verbatim (no domain wrapping) without compensation', async () => {
    const unknownError = new TypeError('boom');
    keycloak.createUser.mockRejectedValue(unknownError);

    await expect(useCase.execute(baseInput())).rejects.toBe(unknownError);
    expect(keycloak.deleteUser).not.toHaveBeenCalled();
  });

  it('DB transaction fails after Keycloak created → calls keycloakAdmin.deleteUser (compensation) and rethrows', async () => {
    const dbError = new Error('connection lost');
    repo.runInTransaction.mockRejectedValue(dbError);

    await expect(useCase.execute(baseInput())).rejects.toBe(dbError);
    expect(keycloak.deleteUser).toHaveBeenCalledWith(KC_USER_ID);
    expect(keycloak.deleteUser).toHaveBeenCalledTimes(1);
  });

  it('compensation deleteUser fails → logger.warn invoked with orphan context (review patch P2)', async () => {
    repo.runInTransaction.mockRejectedValue(new Error('db down'));
    keycloak.deleteUser.mockRejectedValue(new Error('keycloak refused delete'));

    await expect(useCase.execute(baseInput())).rejects.toThrow('db down');

    expect(logger.warn).toHaveBeenCalledTimes(1);
    const [message, meta] = logger.warn.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(message).toMatch(/compensation failed/i);
    expect(meta.keycloakUserId).toBe(KC_USER_ID);
    expect(meta.correlationId).toBe(FIXED_CORRELATION_ID);
    expect(meta.drift).toBe('R8');
    expect(meta.compensationError).toBe('keycloak refused delete');
  });

  it('compensation deleteUser hangs → times out within 5 s and logger.warn captures timeout (review patch P3)', async () => {
    jest.useFakeTimers();
    repo.runInTransaction.mockRejectedValue(new Error('db down'));
    // Controllable promise — we resolve it AFTER the assertions so Jest can
    // exit cleanly without "open handles" warnings.
    let resolveDeleteUser!: () => void;
    keycloak.deleteUser.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveDeleteUser = resolve;
      }),
    );

    const exec = useCase.execute(baseInput()).catch((err: unknown) => err);

    // Fast-forward past the 5 s compensation timeout.
    await jest.advanceTimersByTimeAsync(5_000);
    const result = await exec;
    expect((result as Error).message).toBe('db down');

    expect(logger.warn).toHaveBeenCalledTimes(1);
    const [, meta] = logger.warn.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(String(meta.compensationError)).toMatch(/timed out/i);

    resolveDeleteUser();
    jest.useRealTimers();
  });

  it('Postgres unique-violation (code 23505) inside txn → translates to IDENTITY-CONFLICT-001 + still compensates (review patch P6)', async () => {
    const pgError = Object.assign(new Error('duplicate key violation'), {
      code: '23505',
    });
    repo.runInTransaction.mockRejectedValue(pgError);

    await expect(useCase.execute(baseInput())).rejects.toMatchObject({
      tukioCode: 'IDENTITY-CONFLICT-001',
      httpStatus: 409,
    });
    expect(keycloak.deleteUser).toHaveBeenCalledWith(KC_USER_ID);
  });

  it('inner txn callback throws → no partial side-effects leak outside the captured txn (review patch P8)', async () => {
    repo.runInTransaction.mockImplementationOnce(
      async (cb: (txn: TransactionContext) => Promise<unknown>) => {
        const inMemorySaved: UserProfile[] = [];
        const inMemoryEvents: unknown[] = [];
        try {
          await cb({
            userProfileRepo: {
              save: (p: UserProfile) => {
                inMemorySaved.push(p);
                return Promise.resolve();
              },
            },
            tokenRepo: {
              save: () =>
                Promise.reject(new Error('token save failed mid-txn')),
              findByToken: jest.fn(),
              markUsed: jest.fn(),
            },
            eventPublisher: {
              publish: (e) => {
                inMemoryEvents.push(e);
                return Promise.resolve();
              },
            },
          });
        } catch (innerErr) {
          // Simulate the real impl's rollback : discard captured side-effects.
          inMemorySaved.length = 0;
          inMemoryEvents.length = 0;
          throw innerErr;
        }
      },
    );

    await expect(useCase.execute(baseInput())).rejects.toThrow(
      'token save failed mid-txn',
    );
    expect(txnCalls.saved).toHaveLength(0);
    expect(txnCalls.publishedEvents).toHaveLength(0);
    expect(keycloak.deleteUser).toHaveBeenCalledWith(KC_USER_ID);
  });

  it('marketingOptIn = true → persisted on aggregate and propagated in identity.user.registered.v1', async () => {
    await useCase.execute(baseInput({ acceptMarketing: true }));
    expect(txnCalls.saved[0]?.marketingOptIn).toBe(true);
    const registered = txnCalls.publishedEvents[0] as Record<string, unknown>;
    expect((registered.payload as Record<string, unknown>).marketingOptIn).toBe(
      true,
    );
  });

  it('acquisition fields → persisted on aggregate and propagated in event payload (incl. content + term — review patch E3)', async () => {
    await useCase.execute(
      baseInput({
        acquisition: {
          source: 'google_ads',
          medium: 'cpc',
          campaign: 'spring2026',
          content: 'banner_v2',
          term: 'event_marquees',
          referralId: '33333333-3333-4333-8333-333333333333',
        },
      }),
    );

    expect(txnCalls.saved[0]?.acquisition.source).toBe('google_ads');
    expect(txnCalls.saved[0]?.acquisition.medium).toBe('cpc');
    expect(txnCalls.saved[0]?.acquisition.campaign).toBe('spring2026');
    expect(txnCalls.saved[0]?.acquisition.content).toBe('banner_v2');
    expect(txnCalls.saved[0]?.acquisition.term).toBe('event_marquees');
    expect(txnCalls.saved[0]?.acquisition.referralId).toBe(
      '33333333-3333-4333-8333-333333333333',
    );

    const registered = txnCalls.publishedEvents[0] as Record<string, unknown>;
    const payload = registered.payload as Record<string, unknown>;
    expect(payload.acquisitionSource).toBe('google_ads');
    expect(payload.acquisitionMedium).toBe('cpc');
    expect(payload.acquisitionCampaign).toBe('spring2026');
    expect(payload.acquisitionContent).toBe('banner_v2');
    expect(payload.acquisitionTerm).toBe('event_marquees');
    expect(payload.acquisitionReferralId).toBe(
      '33333333-3333-4333-8333-333333333333',
    );
  });

  it('acquisition omitted → defaults to source=unknown with null medium/campaign/content/term/referralId in event', async () => {
    await useCase.execute(baseInput());
    const registered = txnCalls.publishedEvents[0] as Record<string, unknown>;
    const payload = registered.payload as Record<string, unknown>;
    expect(payload.acquisitionSource).toBe('unknown');
    expect(payload.acquisitionMedium).toBeNull();
    expect(payload.acquisitionCampaign).toBeNull();
    expect(payload.acquisitionContent).toBeNull();
    expect(payload.acquisitionTerm).toBeNull();
    expect(payload.acquisitionReferralId).toBeNull();
  });

  it('locale=en → verifyUrl built with /en/ prefix and event locale = en', async () => {
    await useCase.execute(baseInput({ locale: 'en' }));
    const emailSend = txnCalls.publishedEvents[1] as Record<string, unknown>;
    const params = (emailSend.payload as Record<string, unknown>)
      .params as Record<string, unknown>;
    expect(params.verifyUrl).toBe(
      `${PUBLIC_BASE_URL}/en/auth/email/verify?token=${FIXED_VERIFY_TOKEN}`,
    );
    expect((emailSend.payload as Record<string, unknown>).locale).toBe('en');
  });

  it('publicBaseUrl with trailing slash → no double-slash artifact (review patch P15)', async () => {
    useCase = new RegisterCustomerUseCase(
      repo,
      keycloak,
      logger,
      `${PUBLIC_BASE_URL}/`,
      () => FIXED_NOW,
      jest
        .fn()
        .mockReturnValueOnce(FIXED_USER_ID)
        .mockReturnValueOnce(FIXED_VERIFY_TOKEN)
        .mockReturnValueOnce(FIXED_REGISTERED_EVENT_ID)
        .mockReturnValueOnce(FIXED_EMAIL_EVENT_ID),
    );
    await useCase.execute(baseInput());
    const emailSend = txnCalls.publishedEvents[1] as Record<string, unknown>;
    const params = (emailSend.payload as Record<string, unknown>)
      .params as Record<string, unknown>;
    expect(params.verifyUrl).toBe(
      `${PUBLIC_BASE_URL}/fr/auth/email/verify?token=${FIXED_VERIFY_TOKEN}`,
    );
  });

  it('email-send.v1 event uses SYSTEM_ACTOR_USER_ID sentinel (review patch P1)', async () => {
    await useCase.execute(baseInput());
    const emailSend = txnCalls.publishedEvents[1] as Record<string, unknown>;
    const actor = emailSend.actor as Record<string, unknown>;
    expect(actor.userId).toBe(SYSTEM_ACTOR_USER_ID);
    expect(actor.role).toBe('system');
  });

  it('correlationId omitted → generates one (uses queue) and propagates to both events', async () => {
    // Extend the queue by 1 because this scenario consumes an extra uuid for
    // the generated correlationId.
    const localQueue = [
      FIXED_GENERATED_CORRELATION_ID,
      FIXED_USER_ID,
      FIXED_VERIFY_TOKEN,
      FIXED_REGISTERED_EVENT_ID,
      FIXED_EMAIL_EVENT_ID,
    ];
    useCase = new RegisterCustomerUseCase(
      repo,
      keycloak,
      logger,
      PUBLIC_BASE_URL,
      () => FIXED_NOW,
      jest.fn(() => {
        const v = localQueue.shift();
        if (v === undefined) throw new Error('queue underflow');
        return v;
      }),
    );

    const fullInput = baseInput();
    const inputWithoutCorr: RegisterCustomerUseCaseInput = {
      email: fullInput.email,
      password: fullInput.password,
      firstName: fullInput.firstName,
      lastName: fullInput.lastName,
      locale: fullInput.locale,
      acceptTerms: fullInput.acceptTerms,
      acceptMarketing: fullInput.acceptMarketing,
    };
    await useCase.execute(inputWithoutCorr);
    const [registered, emailSend] = txnCalls.publishedEvents as Array<
      Record<string, unknown>
    >;
    expect(registered?.correlationId).toBe(FIXED_GENERATED_CORRELATION_ID);
    expect(emailSend?.correlationId).toBe(FIXED_GENERATED_CORRELATION_ID);
  });

  it('aggregate.createdAt, event.occurredAt and tokenExpiresAt base all derive from a SINGLE now() (review patch P5)', async () => {
    await useCase.execute(baseInput());
    expect(nowCalls).toBe(1);
    const registered = txnCalls.publishedEvents[0] as Record<string, unknown>;
    const emailSend = txnCalls.publishedEvents[1] as Record<string, unknown>;
    expect(registered.occurredAt).toBe(FIXED_NOW.toISOString());
    expect(emailSend.occurredAt).toBe(FIXED_NOW.toISOString());
    expect(txnCalls.saved[0]?.createdAt.getTime()).toBe(FIXED_NOW.getTime());
    expect(txnCalls.tokens[0]?.expiresAt.getTime()).toBe(
      FIXED_NOW.getTime() + 7 * 24 * 60 * 60 * 1000,
    );
  });

  it('uuid queue underflow throws in tests (review patch P14)', async () => {
    // A queue with a single entry triggers underflow on the 2nd call. The
    // helper throws instead of returning undefined / a fixed fallback so a
    // future code change that adds a new newUuid() call surfaces immediately.
    const localQueue = ['only-one'];
    useCase = new RegisterCustomerUseCase(
      repo,
      keycloak,
      logger,
      PUBLIC_BASE_URL,
      () => FIXED_NOW,
      jest.fn(() => {
        const next = localQueue.shift();
        if (next === undefined) {
          throw new Error('queue underflow — test fixture exhausted');
        }
        return next;
      }),
    );
    await expect(useCase.execute(baseInput())).rejects.toThrow(
      /queue underflow/,
    );
  });
});
