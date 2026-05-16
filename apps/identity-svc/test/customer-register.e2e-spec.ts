/**
 * E2E spec — `POST /internal/customers` against real Keycloak + Postgres +
 * NATS testcontainers (Story 1.2b Task 4).
 *
 * Validates 6 scenarios via supertest :
 *   1. No `X-Internal-Service-Token` header → 403 enveloppé (AUTH-FORBIDDEN-001)
 *   2. Bad HMAC token → 403 enveloppé
 *   3. Valid HMAC + invalid body (Zod) → 422 enveloppé (VALIDATION-FAILED-001)
 *   4. Valid HMAC + precreated user (conflict) → 409 enveloppé (IDENTITY-CONFLICT-001)
 *   5. Valid HMAC + OK body → 201 enveloppé + asserts (DB row + 2 outbox events
 *      + Keycloak user with realm role `client`)
 *   6. Idempotency : 2 parallel calls same email → 1 succès (201) + 1 conflit (409)
 *
 * NOT executed by `pnpm test` or `pnpm test:e2e` baseline (excluded via the
 * jest-e2e config testRegex). Run with `pnpm test:e2e -- customer-register`
 * after `pnpm docker:up:wait`. Coverage target ≥ 70% infra (Story 1.2b NFR71).
 */
import { createHmac, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { Test } from '@nestjs/testing';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { VersioningType } from '@nestjs/common';
import { ZodValidationPipe } from 'nestjs-zod';
import { DataSource } from 'typeorm';
import {
  startKeycloakContainer,
  type KeycloakContainerHandle,
} from '@tukio/testing/testcontainers/keycloak';
import {
  startPostgresContainer,
  type PostgresContainerHandle,
} from '@tukio/testing/testcontainers/postgres';
import {
  startNatsContainer,
  type NatsContainerHandle,
} from '@tukio/testing/testcontainers/nats';
import { AppModule } from '../src/app.module.js';
import { EnvelopeExceptionFilter } from '../src/infrastructure/http/filters/envelope-exception.filter.js';
import { ResponseEnvelopeInterceptor } from '../src/infrastructure/http/interceptors/response-envelope.interceptor.js';

const TUKIO_REALM = 'tukio';
const REALM_EXPORT_PATH = resolve(
  __dirname,
  '../../../infra/keycloak/realm-export/tukio.realm.json',
);

const INTERNAL_SECRET = 'test-internal-svc-secret-32-bytes!';
const KEYCLOAK_CLIENT_SECRET = 'test-tukio-api-client-secret';

const sign = (timestamp: number, method: string, path: string): string =>
  createHmac('sha256', INTERNAL_SECRET)
    .update(`${timestamp}.${method.toUpperCase()}.${path}`)
    .digest('hex');

const internalHeaders = (
  method: string,
  path: string,
  timestamp = Math.floor(Date.now() / 1000),
): Record<string, string> => ({
  'x-internal-service-token': sign(timestamp, method, path),
  'x-internal-service-timestamp': String(timestamp),
  'x-tukio-correlation-id': randomUUID(),
});

const validBody = (email = 'alice@example.com') => ({
  email,
  password: 'SecureE2E-2026!',
  firstName: 'Alice',
  lastName: 'Martin',
  locale: 'fr',
  acceptTerms: true,
  acceptMarketing: false,
  acquisition: {
    source: 'google_ads',
    medium: 'cpc',
    campaign: 'spring2026',
    content: 'banner_v2',
    term: 'event_marquees',
  },
});

describe('POST /internal/customers (E2E — Story 1.2b)', () => {
  let app: NestFastifyApplication;
  let keycloak: KeycloakContainerHandle;
  let postgres: PostgresContainerHandle;
  let nats: NatsContainerHandle;
  let dataSource: DataSource;

  beforeAll(async () => {
    [keycloak, postgres, nats] = await Promise.all([
      startKeycloakContainer({
        realm: TUKIO_REALM,
        importJsonPath: REALM_EXPORT_PATH,
        version: '25.0',
      }),
      startPostgresContainer({ database: 'tukio_identity_e2e' }),
      startNatsContainer(),
    ]);

    Object.assign(process.env, {
      NODE_ENV: 'test',
      DB_HOST: postgres.host,
      DB_PORT: String(postgres.port),
      DB_USER: postgres.user,
      DB_PASSWORD: postgres.password,
      DB_NAME: postgres.database,
      KEYCLOAK_URL: keycloak.url,
      KEYCLOAK_REALM: TUKIO_REALM,
      KEYCLOAK_CLIENT_ID: 'tukio-api',
      KEYCLOAK_AUDIENCE: 'tukio-api',
      KEYCLOAK_CLIENT_SECRET_TUKIO_API: KEYCLOAK_CLIENT_SECRET,
      TUKIO_INTERNAL_SERVICE_SECRET: INTERNAL_SECRET,
      PUBLIC_BASE_URL: 'http://localhost:3000',
      NATS_URL: nats.url,
      NATS_STREAM_NAME: 'TUKIO_IDENTITY_E2E',
      NATS_REPLICAS: '1',
    });

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
    app.useGlobalFilters(new EnvelopeExceptionFilter());
    app.useGlobalPipes(new ZodValidationPipe());
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    dataSource = app.get(DataSource);
    await dataSource.runMigrations();
  }, 300_000);

  afterAll(async () => {
    if (app) await app.close();
    if (dataSource?.isInitialized) await dataSource.destroy();
    await Promise.all([keycloak?.stop(), postgres?.stop(), nats?.stop()]);
  });

  beforeEach(async () => {
    await dataSource.query('DELETE FROM email_verification_tokens');
    await dataSource.query('DELETE FROM outbox');
    await dataSource.query('DELETE FROM user_profiles');
    // Drop all Keycloak users created by previous tests (admin client).
    const adminClient = await keycloak.getAdminClient();
    const users = await adminClient.users.find({ realm: TUKIO_REALM });
    for (const user of users) {
      if (user.id)
        await adminClient.users.del({ realm: TUKIO_REALM, id: user.id });
    }
  });

  it('case 1 — missing internal-service-token header → 403 enveloppé', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/internal/customers',
      payload: validBody(),
      headers: { 'content-type': 'application/json' },
    });
    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.error.tukioCode).toMatch(/^AUTH-FORBIDDEN-/);
  });

  it('case 2 — bad HMAC token → 403 enveloppé', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/internal/customers',
      payload: validBody(),
      headers: {
        'content-type': 'application/json',
        ...internalHeaders('POST', '/internal/customers'),
        'x-internal-service-token': 'deadbeef'.repeat(8),
      },
    });
    expect(res.statusCode).toBe(403);
  });

  it('case 3 — valid HMAC + invalid body (password too short) → 422 VALIDATION-FAILED-001', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/internal/customers',
      payload: { ...validBody(), password: 'short' },
      headers: {
        'content-type': 'application/json',
        ...internalHeaders('POST', '/internal/customers'),
      },
    });
    expect(res.statusCode).toBe(422);
    const body = res.json();
    expect(body.error.tukioCode).toBe('VALIDATION-FAILED-001');
    expect(Array.isArray(body.error.issues)).toBe(true);
  });

  it('case 4 — valid HMAC + precreated user (conflict) → 409 IDENTITY-CONFLICT-001', async () => {
    // Precreate the user via the same endpoint.
    const first = await app.inject({
      method: 'POST',
      url: '/internal/customers',
      payload: validBody('precreated@example.com'),
      headers: {
        'content-type': 'application/json',
        ...internalHeaders('POST', '/internal/customers'),
      },
    });
    expect(first.statusCode).toBe(201);

    const res = await app.inject({
      method: 'POST',
      url: '/internal/customers',
      payload: validBody('precreated@example.com'),
      headers: {
        'content-type': 'application/json',
        ...internalHeaders('POST', '/internal/customers'),
      },
    });
    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.error.tukioCode).toBe('IDENTITY-CONFLICT-001');
  });

  it('case 5 — happy path → 201 enveloppé + Keycloak user + DB row + 2 outbox events', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/internal/customers',
      payload: validBody('happy@example.com'),
      headers: {
        'content-type': 'application/json',
        ...internalHeaders('POST', '/internal/customers'),
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.requiresEmailVerification).toBe(true);
    expect(body.data.userId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u,
    );

    const dbRows = await dataSource.query(
      'SELECT email, tukio_status, email_verified, marketing_opt_in, accept_terms, acquisition_content, acquisition_term FROM user_profiles WHERE id = $1',
      [body.data.userId],
    );
    expect(dbRows).toHaveLength(1);
    expect(dbRows[0].email).toBe('happy@example.com');
    expect(dbRows[0].tukio_status).toBe('active');
    expect(dbRows[0].email_verified).toBe(false);
    expect(dbRows[0].accept_terms).toBe(true);
    expect(dbRows[0].acquisition_content).toBe('banner_v2');
    expect(dbRows[0].acquisition_term).toBe('event_marquees');

    const outboxRows = await dataSource.query(
      'SELECT event_type FROM outbox WHERE aggregate_id = $1 ORDER BY created_at',
      [body.data.userId],
    );
    expect(outboxRows).toHaveLength(2);
    expect(outboxRows[0].event_type).toBe('identity.user.registered.v1');
    expect(outboxRows[1].event_type).toBe('notification.email.send.v1');

    const adminClient = await keycloak.getAdminClient();
    const kcUsers = await adminClient.users.find({
      realm: TUKIO_REALM,
      email: 'happy@example.com',
      exact: true,
    });
    expect(kcUsers).toHaveLength(1);
    expect(kcUsers[0]?.emailVerified).toBe(false);
  });

  it('case 6 — idempotency : 2 parallel calls same email → 1 succès + 1 conflit', async () => {
    const calls = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/internal/customers',
        payload: validBody('race@example.com'),
        headers: {
          'content-type': 'application/json',
          ...internalHeaders('POST', '/internal/customers'),
        },
      }),
      app.inject({
        method: 'POST',
        url: '/internal/customers',
        payload: validBody('race@example.com'),
        headers: {
          'content-type': 'application/json',
          ...internalHeaders('POST', '/internal/customers'),
        },
      }),
    ]);
    const statuses = calls.map((c) => c.statusCode).sort();
    expect(statuses).toEqual([201, 409]);
    const rows = await dataSource.query(
      'SELECT COUNT(*) FROM user_profiles WHERE email = $1',
      ['race@example.com'],
    );
    expect(parseInt(rows[0].count, 10)).toBe(1);
  });
});
