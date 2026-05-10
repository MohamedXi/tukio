import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { buildTestApp } from './helpers/build-test-app.js';
import { Email } from '../src/domain/model/email.value-object.js';
import { UserProfile } from '../src/domain/model/user-profile.aggregate.js';
import { UserRole } from '../src/domain/model/user-role.enum.js';
import type { IUserProfileRepository } from '../src/domain/ports/user-profile.repository.port.js';

const FOUND_ID = '11111111-1111-1111-1111-111111111111';
const MISSING_ID = '00000000-0000-0000-0000-000000000000';

const sampleProfile = UserProfile.create({
  id: FOUND_ID,
  keycloakUserId: '22222222-2222-2222-2222-222222222222',
  email: Email.create('jane@tukio.one'),
  firstName: 'Jane',
  lastName: 'Doe',
  role: UserRole.CLIENT,
  locale: 'fr',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  deletedAt: null,
});

describe('User E2E', () => {
  let app: NestFastifyApplication;
  let repo: jest.Mocked<IUserProfileRepository>;

  beforeAll(async () => {
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
  });

  it('GET /v1/users/:id → 200 with UserProfile DTO when found', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/users/${FOUND_ID}`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({
      method: 'GET',
      code: 200,
      data: {
        id: FOUND_ID,
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

  it('GET /v1/users/:id → 404 wrapped in ErrorEnvelope when not found', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/users/${MISSING_ID}`,
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
      meta: { locale: 'fr', correlationId: expect.any(String) },
    });
  });

  it('honours X-Tukio-Locale=en in meta', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/users/${MISSING_ID}`,
      headers: { 'x-tukio-locale': 'en' },
    });
    expect(res.json().meta.locale).toBe('en');
  });
});
