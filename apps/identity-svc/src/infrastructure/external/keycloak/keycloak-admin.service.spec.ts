import { KeycloakAdminService } from './keycloak-admin.service.js';
import {
  KeycloakUserAlreadyExistsError,
  KeycloakUnreachableError,
} from '../../../domain/ports/keycloak-admin.port.js';
import type {
  IConfigService,
  KeycloakAdminConfig,
} from '../../../domain/ports/config.port.js';
import type { ILogger } from '../../../domain/ports/logger.port.js';
import { UserRole } from '../../../domain/model/user-role.enum.js';
import { UserStatus } from '../../../domain/model/user-status.enum.js';

// Mock the library wholesale — tests target the translation/wiring logic, not
// the underlying HTTP behavior (that's covered by the testcontainers
// integration spec which is shipped alongside but executed manually with
// `docker:up`).
const kcMockInstance = {
  accessToken: undefined as string | undefined,
  auth: jest.fn(),
  users: {
    create: jest.fn(),
    find: jest.fn(),
    del: jest.fn(),
    resetPassword: jest.fn(),
    addRealmRoleMappings: jest.fn(),
    update: jest.fn(),
  },
  roles: {
    findOneByName: jest.fn(),
  },
};

jest.mock('@keycloak/keycloak-admin-client', () => {
  return jest.fn().mockImplementation(() => kcMockInstance);
});

const adminConfig: KeycloakAdminConfig = {
  url: 'http://keycloak.test:8080',
  realm: 'tukio',
  clientId: 'tukio-api',
  clientSecret: 'super-secret',
};

const buildConfigMock = (): IConfigService => ({
  getNodeEnv: jest.fn().mockReturnValue('test'),
  getServiceName: jest.fn().mockReturnValue('identity-svc'),
  getServiceVersion: jest.fn().mockReturnValue('0.0.0'),
  getPort: jest.fn().mockReturnValue(4001),
  getLogLevel: jest.fn().mockReturnValue('info'),
  getDatabaseConfig: jest.fn(),
  getKeycloakConfig: jest.fn(),
  getKeycloakAdminConfig: jest.fn().mockReturnValue(adminConfig),
  getInternalServiceSecret: jest.fn().mockReturnValue('hmac-secret'),
  getPublicBaseUrl: jest.fn().mockReturnValue('http://localhost:3000'),
  getNatsConfig: jest.fn(),
});

const buildLoggerMock = (): jest.Mocked<ILogger> => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('KeycloakAdminService', () => {
  let service: KeycloakAdminService;
  let logger: jest.Mocked<ILogger>;

  beforeEach(() => {
    jest.clearAllMocks();
    kcMockInstance.accessToken = undefined;
    kcMockInstance.auth.mockResolvedValue({
      accessToken: 'a',
      refreshToken: 'r',
      expiresIn: 60,
      refreshExpiresIn: 600,
    });
    kcMockInstance.roles.findOneByName.mockResolvedValue({
      id: 'role-uuid',
      name: 'client',
    });
    kcMockInstance.users.create.mockResolvedValue({ id: 'kc-user-uuid' });
    kcMockInstance.users.find.mockResolvedValue([]);
    kcMockInstance.users.del.mockResolvedValue(undefined);
    kcMockInstance.users.resetPassword.mockResolvedValue(undefined);
    kcMockInstance.users.addRealmRoleMappings.mockResolvedValue(undefined);
    kcMockInstance.users.update.mockResolvedValue(undefined);

    logger = buildLoggerMock();
    service = new KeycloakAdminService(buildConfigMock(), logger);
  });

  describe('onModuleInit', () => {
    it('authenticates eagerly at boot', async () => {
      await service.onModuleInit();
      expect(kcMockInstance.auth).toHaveBeenCalledWith({
        grantType: 'client_credentials',
        clientId: 'tukio-api',
        clientSecret: 'super-secret',
      });
    });

    it('throws KeycloakUnreachableError after retry exhaustion (review patch P8 — bounded retry)', async () => {
      kcMockInstance.auth.mockRejectedValue({ response: { status: 503 } });
      jest.useFakeTimers();
      const initPromise = service.onModuleInit().catch((err: unknown) => err);
      // Initial attempt fires synchronously; then 3 retries at 1s, 2s, 4s.
      await jest.advanceTimersByTimeAsync(1_000);
      await jest.advanceTimersByTimeAsync(2_000);
      await jest.advanceTimersByTimeAsync(4_000);
      const result = await initPromise;
      expect(result).toBeInstanceOf(KeycloakUnreachableError);
      expect(kcMockInstance.auth).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
      jest.useRealTimers();
    });

    it('returns successfully if auth recovers on a retry attempt', async () => {
      kcMockInstance.auth
        .mockRejectedValueOnce({ response: { status: 503 } })
        .mockResolvedValueOnce({
          accessToken: 'a',
          refreshToken: 'r',
          expiresIn: 60,
          refreshExpiresIn: 600,
        });
      jest.useFakeTimers();
      const initPromise = service.onModuleInit();
      await jest.advanceTimersByTimeAsync(1_000);
      await expect(initPromise).resolves.toBeUndefined();
      expect(kcMockInstance.auth).toHaveBeenCalledTimes(2);
      jest.useRealTimers();
    });
  });

  describe('createUser', () => {
    beforeEach(() => {
      kcMockInstance.accessToken = 'token';
    });

    it('creates a user + assigns the realm role + returns the keycloakUserId', async () => {
      const result = await service.createUser({
        email: 'alice@example.com',
        firstName: 'Alice',
        lastName: 'Martin',
        password: 'SecurePass1234!',
        locale: 'fr',
        emailVerified: false,
        role: UserRole.CLIENT,
        status: UserStatus.ACTIVE,
      });

      expect(result).toEqual({ keycloakUserId: 'kc-user-uuid' });
      expect(kcMockInstance.users.create).toHaveBeenCalledWith(
        expect.objectContaining({
          realm: 'tukio',
          username: 'alice@example.com',
          email: 'alice@example.com',
          firstName: 'Alice',
          lastName: 'Martin',
          enabled: true,
          emailVerified: false,
          attributes: expect.objectContaining({
            locale: ['fr'],
            'tukio:locale': ['fr'],
            'tukio:status': ['active'],
          }),
        }),
      );
      expect(kcMockInstance.users.addRealmRoleMappings).toHaveBeenCalledWith({
        realm: 'tukio',
        id: 'kc-user-uuid',
        roles: [{ id: 'role-uuid', name: 'client' }],
      });
    });

    it('PII redaction : password is passed only as a credential, never logged', async () => {
      await service.createUser({
        email: 'alice@example.com',
        firstName: 'Alice',
        lastName: 'Martin',
        password: 'SecurePass1234!',
        locale: 'fr',
        emailVerified: false,
        role: UserRole.CLIENT,
        status: UserStatus.ACTIVE,
      });
      // Verify the password is NOT a top-level property (only inside the credentials array).
      const call = kcMockInstance.users.create.mock.calls[0]?.[0] as Record<
        string,
        unknown
      >;
      expect(call.password).toBeUndefined();
      // Verify no logger call contains the plaintext password.
      const allLoggerArgs = [
        ...logger.info.mock.calls,
        ...logger.debug.mock.calls,
        ...logger.warn.mock.calls,
        ...logger.error.mock.calls,
      ];
      const serialized = JSON.stringify(allLoggerArgs);
      expect(serialized).not.toContain('SecurePass1234!');
    });

    it('translates HTTP 409 → KeycloakUserAlreadyExistsError with the email', async () => {
      kcMockInstance.users.create.mockRejectedValue({
        response: { status: 409 },
      });
      await expect(
        service.createUser({
          email: 'taken@example.com',
          firstName: 'A',
          lastName: 'B',
          password: 'Whatever1234!',
          locale: 'fr',
          emailVerified: false,
          role: UserRole.CLIENT,
          status: UserStatus.ACTIVE,
        }),
      ).rejects.toBeInstanceOf(KeycloakUserAlreadyExistsError);
    });

    it('translates HTTP 503 → KeycloakUnreachableError', async () => {
      kcMockInstance.users.create.mockRejectedValue({
        response: { status: 503 },
      });
      await expect(
        service.createUser({
          email: 'alice@example.com',
          firstName: 'A',
          lastName: 'B',
          password: 'pwd123456789!A',
          locale: 'fr',
          emailVerified: false,
          role: UserRole.CLIENT,
          status: UserStatus.ACTIVE,
        }),
      ).rejects.toBeInstanceOf(KeycloakUnreachableError);
    });

    it('translates network-style error (no status) → KeycloakUnreachableError', async () => {
      kcMockInstance.users.create.mockRejectedValue(new Error('ECONNREFUSED'));
      await expect(
        service.createUser({
          email: 'alice@example.com',
          firstName: 'A',
          lastName: 'B',
          password: 'pwd123456789!A',
          locale: 'fr',
          emailVerified: false,
          role: UserRole.CLIENT,
          status: UserStatus.ACTIVE,
        }),
      ).rejects.toBeInstanceOf(KeycloakUnreachableError);
    });

    it('translates 401 → KeycloakUnreachableError (auth degraded)', async () => {
      kcMockInstance.users.create.mockRejectedValue({ statusCode: 401 });
      await expect(
        service.createUser({
          email: 'alice@example.com',
          firstName: 'A',
          lastName: 'B',
          password: 'pwd123456789!A',
          locale: 'fr',
          emailVerified: false,
          role: UserRole.CLIENT,
          status: UserStatus.ACTIVE,
        }),
      ).rejects.toBeInstanceOf(KeycloakUnreachableError);
    });

    it('re-throws 4xx non-409 verbatim (programmer error)', async () => {
      const badRequest = Object.assign(new Error('bad request'), {
        response: { status: 422 },
      });
      kcMockInstance.users.create.mockRejectedValue(badRequest);
      await expect(
        service.createUser({
          email: 'alice@example.com',
          firstName: 'A',
          lastName: 'B',
          password: 'pwd123456789!A',
          locale: 'fr',
          emailVerified: false,
          role: UserRole.CLIENT,
          status: UserStatus.ACTIVE,
        }),
      ).rejects.toBe(badRequest);
    });

    it('fails fast when the realm role is missing (Story 1.1 bootstrap drift)', async () => {
      kcMockInstance.roles.findOneByName.mockResolvedValue(null);
      await expect(
        service.createUser({
          email: 'alice@example.com',
          firstName: 'A',
          lastName: 'B',
          password: 'pwd123456789!A',
          locale: 'fr',
          emailVerified: false,
          role: UserRole.CLIENT,
          status: UserStatus.ACTIVE,
        }),
      ).rejects.toBeInstanceOf(KeycloakUnreachableError);
    });
  });

  describe('findUserByEmail', () => {
    beforeEach(() => {
      kcMockInstance.accessToken = 'token';
    });

    it('returns null when no user is found', async () => {
      kcMockInstance.users.find.mockResolvedValue([]);
      const result = await service.findUserByEmail('missing@example.com');
      expect(result).toBeNull();
    });

    it('returns { keycloakUserId } when a user is found', async () => {
      kcMockInstance.users.find.mockResolvedValue([
        { id: 'kc-1', email: 'a@b.com' },
      ]);
      const result = await service.findUserByEmail('a@b.com');
      expect(result).toEqual({ keycloakUserId: 'kc-1' });
    });

    it('uses exact match (no fuzzy search)', async () => {
      await service.findUserByEmail('a@b.com');
      expect(kcMockInstance.users.find).toHaveBeenCalledWith({
        realm: 'tukio',
        email: 'a@b.com',
        exact: true,
      });
    });

    it('returns null when the API returns a row without an id', async () => {
      kcMockInstance.users.find.mockResolvedValue([{ email: 'a@b.com' }]);
      const result = await service.findUserByEmail('a@b.com');
      expect(result).toBeNull();
    });
  });

  describe('deleteUser', () => {
    beforeEach(() => {
      kcMockInstance.accessToken = 'token';
    });

    it('calls Keycloak users.del with the realm and id', async () => {
      await service.deleteUser('kc-uuid');
      expect(kcMockInstance.users.del).toHaveBeenCalledWith({
        realm: 'tukio',
        id: 'kc-uuid',
      });
    });

    it('translates 5xx → KeycloakUnreachableError (used by use case compensation timeout path)', async () => {
      kcMockInstance.users.del.mockRejectedValue({ response: { status: 502 } });
      await expect(service.deleteUser('kc-uuid')).rejects.toBeInstanceOf(
        KeycloakUnreachableError,
      );
    });
  });

  describe('setUserPassword', () => {
    beforeEach(() => {
      kcMockInstance.accessToken = 'token';
    });

    it('calls Keycloak users.resetPassword with the credential payload', async () => {
      await service.setUserPassword('kc-uuid', 'NewSecure-1234!', false);
      expect(kcMockInstance.users.resetPassword).toHaveBeenCalledWith({
        realm: 'tukio',
        id: 'kc-uuid',
        credential: {
          type: 'password',
          value: 'NewSecure-1234!',
          temporary: false,
        },
      });
    });
  });

  describe('assignRealmRole', () => {
    beforeEach(() => {
      kcMockInstance.accessToken = 'token';
    });

    it('caches the role representation across calls', async () => {
      await service.assignRealmRole('kc-1', UserRole.CLIENT);
      await service.assignRealmRole('kc-2', UserRole.CLIENT);
      expect(kcMockInstance.roles.findOneByName).toHaveBeenCalledTimes(1);
    });
  });

  describe('setUserAttributes', () => {
    beforeEach(() => {
      kcMockInstance.accessToken = 'token';
    });

    it('converts readonly arrays to mutable arrays before passing to the library', async () => {
      const readonlyAttrs: Record<string, readonly string[]> = {
        'tukio:status': ['active'],
        'tukio:locale': ['fr'],
      };
      await service.setUserAttributes('kc-uuid', readonlyAttrs);
      expect(kcMockInstance.users.update).toHaveBeenCalledWith(
        { realm: 'tukio', id: 'kc-uuid' },
        { attributes: { 'tukio:status': ['active'], 'tukio:locale': ['fr'] } },
      );
    });
  });
});
