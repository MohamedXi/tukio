import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import nock from 'nock';
import {
  buildTestApp,
  generateTestJwt,
  setupJwksMock,
} from './helpers/build-test-app.js';
import { Email } from '../src/domain/model/email.value-object.js';
import { UserProfile } from '../src/domain/model/user-profile.aggregate.js';
import { UserRole } from '../src/domain/model/user-role.enum.js';
import type { IUserProfileRepository } from '../src/domain/ports/user-profile.repository.port.js';

const FOUND_ID = '11111111-1111-1111-1111-111111111111';
const KEYCLOAK_USER_ID = '22222222-2222-2222-2222-222222222222';
const MISSING_ID = '00000000-0000-0000-0000-000000000000';
const ADMIN_KEYCLOAK_ID = '33333333-3333-3333-3333-333333333333';
const OTHER_CLIENT_KEYCLOAK_ID = '44444444-4444-4444-4444-444444444444';

const sampleProfile = UserProfile.create({
  id: FOUND_ID,
  keycloakUserId: KEYCLOAK_USER_ID,
  email: Email.create('jane@tukio.one'),
  firstName: 'Jane',
  lastName: 'Doe',
  role: UserRole.CLIENT,
  locale: 'fr',
  acquisition: UserProfile.defaultAcquisition(),
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  deletedAt: null,
});

describe('User E2E', () => {
  let app: NestFastifyApplication;
  let repo: jest.Mocked<IUserProfileRepository>;

  beforeAll(async () => {
    nock.cleanAll();
    setupJwksMock();
    repo = {
      findById: jest.fn((id: string) =>
        Promise.resolve(id === FOUND_ID ? sampleProfile : null),
      ),
      findByKeycloakUserId: jest.fn(),
      save: jest.fn(),
    };
    app = await buildTestApp({ userProfileRepo: repo });
  });

  afterAll(async () => {
    await app.close();
    nock.cleanAll();
  });

  it('GET /v1/users/:id → 200 when client accesses own profile (sub matches keycloakUserId)', async () => {
    const token = generateTestJwt({ sub: KEYCLOAK_USER_ID, roles: ['client'] });
    const res = await app.inject({
      method: 'GET',
      url: `/v1/users/${FOUND_ID}`,
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({
      method: 'GET',
      code: 200,
      data: {
        id: FOUND_ID,
        keycloakUserId: KEYCLOAK_USER_ID,
        email: 'jane@tukio.one',
        firstName: 'Jane',
        lastName: 'Doe',
        role: 'client',
        locale: 'fr',
        deletedAt: null,
      },
      meta: { locale: 'fr', correlationId: expect.any(String) },
    });
  });

  it('GET /v1/users/:id → 200 when admin accesses any profile', async () => {
    const adminJwt = generateTestJwt({
      sub: ADMIN_KEYCLOAK_ID,
      roles: ['admin-super'],
      amr: ['totp'],
    });
    const res = await app.inject({
      method: 'GET',
      url: `/v1/users/${FOUND_ID}`,
      headers: { Authorization: `Bearer ${adminJwt}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it('GET /v1/users/:id → 401 when no JWT provided', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/users/${FOUND_ID}`,
    });
    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.error?.tukioCode).toBe('AUTH-NOT-AUTHENTICATED-002');
  });

  it('GET /v1/users/:id → 403 when client accesses another user profile', async () => {
    const otherJwt = generateTestJwt({
      sub: OTHER_CLIENT_KEYCLOAK_ID,
      roles: ['client'],
    });
    const res = await app.inject({
      method: 'GET',
      url: `/v1/users/${FOUND_ID}`,
      headers: { Authorization: `Bearer ${otherJwt}` },
    });
    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.error?.tukioCode).toBe('AUTH-FORBIDDEN-001');
  });

  it('GET /v1/users/:id → 403 when pro accesses another user profile (not own)', async () => {
    const proJwt = generateTestJwt({
      sub: OTHER_CLIENT_KEYCLOAK_ID,
      roles: ['pro'],
    });
    const res = await app.inject({
      method: 'GET',
      url: `/v1/users/${FOUND_ID}`,
      headers: { Authorization: `Bearer ${proJwt}` },
    });
    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.error?.tukioCode).toBe('AUTH-FORBIDDEN-001');
  });

  it('GET /v1/users/:id → 404 wrapped in ErrorEnvelope when not found (admin)', async () => {
    const adminJwt = generateTestJwt({
      sub: ADMIN_KEYCLOAK_ID,
      roles: ['admin-super'],
      amr: ['totp'],
    });
    const res = await app.inject({
      method: 'GET',
      url: `/v1/users/${MISSING_ID}`,
      headers: { Authorization: `Bearer ${adminJwt}` },
    });
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body).toMatchObject({
      method: 'GET',
      code: 404,
      error: {
        tukioCode: 'USER-NOT-FOUND-001',
        title: 'User profile not found',
        instance: `/v1/users/${MISSING_ID}`,
        type: 'https://tukio.one/errors/user-not-found-001',
      },
    });
  });

  it('GET /v1/health → 200 (public endpoint, no JWT needed)', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/health' });
    expect(res.statusCode).toBe(200);
  });

  it('honours X-Tukio-Locale=en in meta', async () => {
    const adminJwt = generateTestJwt({
      sub: ADMIN_KEYCLOAK_ID,
      roles: ['admin-super'],
      amr: ['totp'],
    });
    const res = await app.inject({
      method: 'GET',
      url: `/v1/users/${MISSING_ID}`,
      headers: { Authorization: `Bearer ${adminJwt}`, 'x-tukio-locale': 'en' },
    });
    expect(res.json().meta.locale).toBe('en');
  });
});
