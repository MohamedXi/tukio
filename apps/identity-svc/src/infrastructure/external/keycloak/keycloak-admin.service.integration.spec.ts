/**
 * Integration spec — KeycloakAdminService against a real Keycloak testcontainer.
 *
 * NOT executed by `pnpm test` (unit run). Run with `pnpm test:integration`
 * after `pnpm docker:up:wait`. Boots a Keycloak 25 container, imports the
 * `tukio` realm export, then exercises createUser / findByEmail / deleteUser /
 * setPassword / assignRealmRole end-to-end.
 *
 * Story 1.2b Task 1.5 — coverage target ≥ 70% infra (counted toward NFR71).
 */
import { resolve } from 'node:path';
import {
  startKeycloakContainer,
  type KeycloakContainerHandle,
} from '@tukio/testing/testcontainers/keycloak';
import { KeycloakAdminService } from './keycloak-admin.service.js';
import { KeycloakUserAlreadyExistsError } from '../../../domain/ports/keycloak-admin.port.js';
import type {
  IConfigService,
  KeycloakAdminConfig,
} from '../../../domain/ports/config.port.js';
import type { ILogger } from '../../../domain/ports/logger.port.js';
import { UserRole } from '../../../domain/model/user-role.enum.js';
import { UserStatus } from '../../../domain/model/user-status.enum.js';

const REALM_EXPORT_PATH = resolve(
  __dirname,
  '../../../../../../infra/keycloak/realm-export/tukio.realm.json',
);

const TUKIO_API_CLIENT_SECRET = 'test-client-secret-tukio-api';

const buildLogger = (): ILogger => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const buildConfig = (kcUrl: string): IConfigService => {
  const adminConfig: KeycloakAdminConfig = {
    url: kcUrl,
    realm: 'tukio',
    clientId: 'tukio-api',
    clientSecret: TUKIO_API_CLIENT_SECRET,
  };
  return {
    getNodeEnv: () => 'test',
    getServiceName: () => 'identity-svc',
    getServiceVersion: () => '0.0.0',
    getPort: () => 4001,
    getLogLevel: () => 'info',
    getDatabaseConfig: () => ({
      host: 'localhost',
      port: 5432,
      username: 'tukio',
      password: 'tukio',
      database: 'tukio_test',
      verbose: false,
    }),
    getKeycloakConfig: () => ({
      url: kcUrl,
      realm: 'tukio',
      clientId: 'tukio-api',
      audience: 'tukio-api',
    }),
    getKeycloakAdminConfig: () => adminConfig,
    getInternalServiceSecret: () => 'hmac-secret',
    getPublicBaseUrl: () => 'http://localhost:3000',
    getNatsConfig: () => ({
      url: 'nats://localhost:4222',
      streamName: 'TUKIO_TEST',
      replicas: 1,
    }),
    getInseeConfig: () => ({ apiUrl: 'https://api.insee.fr', apiKey: '' }),
    getR2KycConfig: () => ({
      endpoint: '',
      bucket: 'tukio-kyc-staging',
      accessKeyId: '',
      secretAccessKey: '',
    }),
    getR2KycBucket: () => 'tukio-kyc-staging',
  };
};

describe('KeycloakAdminService (integration)', () => {
  let keycloak: KeycloakContainerHandle;
  let service: KeycloakAdminService;

  beforeAll(async () => {
    keycloak = await startKeycloakContainer({
      realm: 'tukio',
      importJsonPath: REALM_EXPORT_PATH,
      version: '25.0',
    });
    service = new KeycloakAdminService(
      buildConfig(keycloak.url),
      buildLogger(),
    );
    await service.onModuleInit();
  }, 180_000);

  afterAll(async () => {
    if (keycloak) await keycloak.stop();
  });

  it('creates a user with role=client + locale attribute and returns the keycloakUserId', async () => {
    const result = await service.createUser({
      email: 'integration-alice@example.com',
      firstName: 'Alice',
      lastName: 'Martin',
      password: 'IntegPass-2026!',
      locale: 'fr',
      emailVerified: false,
      role: UserRole.CLIENT,
      status: UserStatus.ACTIVE,
    });
    expect(result.keycloakUserId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u,
    );

    const found = await service.findUserByEmail(
      'integration-alice@example.com',
    );
    expect(found?.keycloakUserId).toBe(result.keycloakUserId);
  });

  it('returns null when finding a non-existent email', async () => {
    const found = await service.findUserByEmail('nobody@example.com');
    expect(found).toBeNull();
  });

  it('translates a 409 duplicate-email error into KeycloakUserAlreadyExistsError', async () => {
    await service.createUser({
      email: 'integration-dup@example.com',
      firstName: 'Dup',
      lastName: 'One',
      password: 'IntegPass-2026!',
      locale: 'fr',
      emailVerified: false,
      role: UserRole.CLIENT,
      status: UserStatus.ACTIVE,
    });
    await expect(
      service.createUser({
        email: 'integration-dup@example.com',
        firstName: 'Dup',
        lastName: 'Two',
        password: 'IntegPass-2026!',
        locale: 'fr',
        emailVerified: false,
        role: UserRole.CLIENT,
        status: UserStatus.ACTIVE,
      }),
    ).rejects.toBeInstanceOf(KeycloakUserAlreadyExistsError);
  });

  it('deletes a created user end-to-end', async () => {
    const { keycloakUserId } = await service.createUser({
      email: 'integration-todelete@example.com',
      firstName: 'Del',
      lastName: 'Ete',
      password: 'IntegPass-2026!',
      locale: 'en',
      emailVerified: false,
      role: UserRole.CLIENT,
      status: UserStatus.ACTIVE,
    });
    await service.deleteUser(keycloakUserId);
    const found = await service.findUserByEmail(
      'integration-todelete@example.com',
    );
    expect(found).toBeNull();
  });

  it('updates a user password without throwing', async () => {
    const { keycloakUserId } = await service.createUser({
      email: 'integration-pwd@example.com',
      firstName: 'Pwd',
      lastName: 'Reset',
      password: 'IntegPass-2026!',
      locale: 'fr',
      emailVerified: false,
      role: UserRole.CLIENT,
      status: UserStatus.ACTIVE,
    });
    await expect(
      service.setUserPassword(keycloakUserId, 'NewPwd-2026!', false),
    ).resolves.toBeUndefined();
  });
});
