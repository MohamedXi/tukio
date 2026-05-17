/**
 * E2E tests for POST /v1/internal/pros — Story 1.3b.
 *
 * Requires: pnpm docker:up:wait (Postgres + Keycloak + NATS)
 * Run with: pnpm --filter=identity-svc test:e2e:testcontainers (excluded from
 * the default e2e run because it needs the full docker stack).
 *
 * Dependencies mocked:
 *   - INSEE SIRENE API via nock (no real HTTP to api.insee.fr)
 *   - R2 media storage via aws-sdk-client-mock (no real R2 uploads)
 *
 * Real infra used:
 *   - Postgres (tukio_identity) — migrations auto-run at boot
 *   - Keycloak (tukio realm) — real user creation + rollback
 *   - NATS JetStream — outbox events published then discarded
 *
 * HMAC contract (Story 1.2b InternalServiceGuard, extended by 1.3b D1):
 *   - 3 headers: x-internal-service-token, x-internal-service-timestamp,
 *     x-internal-service-body-sha256
 *   - Canonical: `${unixSeconds}.${METHOD}.${path}.${bodyHashOrMultipartSentinel}`
 *   - For multipart bodies, body-hash is the fixed MULTIPART_BODY_HASH_SENTINEL
 *     (Fastify cannot expose raw multipart bytes to the guard).
 */
import { createHash, createHmac } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import {
  type NestFastifyApplication,
  FastifyAdapter,
} from '@nestjs/platform-fastify';
import { VersioningType } from '@nestjs/common';
import nock from 'nock';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';
import { ZodValidationPipe } from 'nestjs-zod';
import multipart from '@fastify/multipart';
import FormData from 'form-data';
import { AppModule } from '../src/app.module.js';
import { EnvelopeExceptionFilter } from '../src/infrastructure/http/filters/envelope-exception.filter.js';
import { ResponseEnvelopeInterceptor } from '../src/infrastructure/http/interceptors/response-envelope.interceptor.js';
import { MULTIPART_BODY_HASH_SENTINEL } from '../src/infrastructure/http/guards/internal-service.guard.js';

const s3Mock = mockClient(S3Client);

const INSEE_BASE = 'https://api.insee.fr';
const ACTIVE_SIRET = '35600000000048';
const INACTIVE_SIRET = '73282932000074';

// Matches env.schema dev fallback. The e2e test sets it explicitly via
// process.env so it doesn't silently inherit a different value from .env.
const INTERNAL_SECRET = 'dev-internal-svc-secret-32-bytes!!';

function makeInseePayload(siret: string, etat: 'A' | 'C' = 'A') {
  return {
    etablissement: {
      siret,
      uniteLegale: {
        etatAdministratifUniteLegale: etat,
        denominationUniteLegale: 'ACME SAS',
        dateCreationUniteLegale: '2020-01-01',
        categorieJuridiqueUniteLegale: '5710',
        activitePrincipaleUniteLegale: '5310Z',
      },
    },
  };
}

/**
 * Builds the 3 HMAC headers expected by InternalServiceGuard. For multipart
 * bodies, the body-hash is the fixed MULTIPART_BODY_HASH_SENTINEL (Story
 * 1.3b D1). For JSON bodies, it is the sha256 of the raw body bytes.
 */
function buildInternalHeaders(
  method: string,
  path: string,
  body: Buffer | string,
  isMultipart: boolean,
): Record<string, string> {
  const ts = Math.floor(Date.now() / 1000);
  const bodyHash = isMultipart
    ? MULTIPART_BODY_HASH_SENTINEL
    : createHash('sha256').update(body).digest('hex');
  const canonical = `${ts}.${method.toUpperCase()}.${path}.${bodyHash}`;
  const token = createHmac('sha256', INTERNAL_SECRET)
    .update(canonical)
    .digest('hex');
  return {
    'x-internal-service-token': token,
    'x-internal-service-timestamp': String(ts),
    'x-internal-service-body-sha256': bodyHash,
  };
}

function makePayloadFields(
  siret: string,
  emailLocal = `pro-${Date.now()}`,
): Record<string, unknown> {
  return {
    email: `${emailLocal}@acme.test`,
    password: 'SecurePass123!',
    firstName: 'Jean',
    lastName: 'Dupont',
    locale: 'fr',
    acceptTerms: true,
    acceptMarketing: false,
    companyName: 'ACME SAS',
    siret,
    address: {
      street: '10 rue de la Paix',
      postalCode: '75001',
      city: 'Paris',
      country: 'FR',
    },
    contactPhone: '+33612345678',
  };
}

function buildMultipartBody(
  payload: Record<string, unknown>,
  options: {
    idCard?: Buffer;
    rib?: Buffer;
    kbisOrInsee?: Buffer;
    idCardMime?: string;
  } = {},
): { buffer: Buffer; headers: Record<string, string> } {
  const fd = new FormData();
  fd.append('payload', JSON.stringify(payload));
  if (options.idCard ?? true) {
    fd.append('idCard', options.idCard ?? Buffer.from('fake-id-card'), {
      filename: 'id-card.jpg',
      contentType: options.idCardMime ?? 'image/jpeg',
    });
  }
  if (options.rib ?? true) {
    fd.append('rib', options.rib ?? Buffer.from('fake-rib'), {
      filename: 'rib.pdf',
      contentType: 'application/pdf',
    });
  }
  if (options.kbisOrInsee) {
    fd.append('kbisOrInsee', options.kbisOrInsee, {
      filename: 'kbis.pdf',
      contentType: 'application/pdf',
    });
  }
  return { buffer: fd.getBuffer(), headers: fd.getHeaders() };
}

describe('POST /v1/internal/pros (e2e)', () => {
  let app: NestFastifyApplication;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    // P23 — set the HMAC secret explicitly so the test doesn't depend on
    // .env loading. Must match INTERNAL_SECRET used by buildInternalHeaders.
    process.env['TUKIO_INTERNAL_SERVICE_SECRET'] = INTERNAL_SECRET;

    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter({ logger: false }),
    );
    await app.register(multipart, {
      throwFileSizeLimit: true,
      limits: { fileSize: 5 * 1024 * 1024, files: 3, parts: 5 },
    });
    app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
    app.useGlobalFilters(new EnvelopeExceptionFilter());
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ZodValidationPipe());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    nock.cleanAll();
    s3Mock.restore();
    await app.close();
  });

  beforeEach(() => {
    s3Mock.reset();
    nock.cleanAll();
  });

  it('201 — happy path with active SIRET, all files', async () => {
    nock(INSEE_BASE)
      .get(`/api-sirene/3.11/siret/${ACTIVE_SIRET}`)
      .reply(200, makeInseePayload(ACTIVE_SIRET, 'A'));
    s3Mock.on(PutObjectCommand).resolves({ ETag: '"etag"' });

    const { buffer, headers } = buildMultipartBody(
      makePayloadFields(ACTIVE_SIRET),
    );
    const auth = buildInternalHeaders(
      'POST',
      '/v1/internal/pros',
      buffer,
      true,
    );

    const response = await app.inject({
      method: 'POST',
      url: '/v1/internal/pros',
      headers: { ...headers, ...auth },
      payload: buffer,
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body) as {
      data: { userId: string; proProfileId: string };
    };
    expect(body.data.userId).toBeDefined();
    expect(body.data.proProfileId).toBeDefined();
  });

  it('422 — inactive SIRET (etat=C) returns IDENTITY-VALIDATION-003', async () => {
    nock(INSEE_BASE)
      .get(`/api-sirene/3.11/siret/${INACTIVE_SIRET}`)
      .reply(200, makeInseePayload(INACTIVE_SIRET, 'C'));
    s3Mock.on(PutObjectCommand).resolves({ ETag: '"e"' });

    const { buffer, headers } = buildMultipartBody(
      makePayloadFields(INACTIVE_SIRET),
    );
    const auth = buildInternalHeaders(
      'POST',
      '/v1/internal/pros',
      buffer,
      true,
    );

    const response = await app.inject({
      method: 'POST',
      url: '/v1/internal/pros',
      headers: { ...headers, ...auth },
      payload: buffer,
    });

    expect(response.statusCode).toBe(422);
    const body = JSON.parse(response.body) as { error: { tukioCode: string } };
    expect(body.error.tukioCode).toBe('IDENTITY-VALIDATION-003');
  });

  it('422 — Luhn-invalid SIRET rejected by the VO', async () => {
    const { buffer, headers } = buildMultipartBody({
      ...makePayloadFields('12345678900000'),
    });
    const auth = buildInternalHeaders(
      'POST',
      '/v1/internal/pros',
      buffer,
      true,
    );

    const response = await app.inject({
      method: 'POST',
      url: '/v1/internal/pros',
      headers: { ...headers, ...auth },
      payload: buffer,
    });

    expect(response.statusCode).toBe(422);
  });

  // P10 — missing case: 409 SIRET already active in DB
  it('409 — SIRET already registered to an active Pro returns IDENTITY-CONFLICT-002', async () => {
    // First call: happy registration
    nock(INSEE_BASE)
      .get(`/api-sirene/3.11/siret/${ACTIVE_SIRET}`)
      .twice()
      .reply(200, makeInseePayload(ACTIVE_SIRET, 'A'));
    s3Mock.on(PutObjectCommand).resolves({ ETag: '"e"' });

    const payload1 = buildMultipartBody(
      makePayloadFields(ACTIVE_SIRET, 'first-pro'),
    );
    await app.inject({
      method: 'POST',
      url: '/v1/internal/pros',
      headers: {
        ...payload1.headers,
        ...buildInternalHeaders(
          'POST',
          '/v1/internal/pros',
          payload1.buffer,
          true,
        ),
      },
      payload: payload1.buffer,
    });

    // Second call with same SIRET (different email) → 409
    const payload2 = buildMultipartBody(
      makePayloadFields(ACTIVE_SIRET, 'second-pro'),
    );
    const response = await app.inject({
      method: 'POST',
      url: '/v1/internal/pros',
      headers: {
        ...payload2.headers,
        ...buildInternalHeaders(
          'POST',
          '/v1/internal/pros',
          payload2.buffer,
          true,
        ),
      },
      payload: payload2.buffer,
    });

    expect(response.statusCode).toBe(409);
    const body = JSON.parse(response.body) as { error: { tukioCode: string } };
    expect(body.error.tukioCode).toBe('IDENTITY-CONFLICT-002');
  });

  // P10 — missing case: 502 INSEE 5xx returns IDENTITY-EXTERNAL-002
  it('502 — INSEE 5xx returns IDENTITY-EXTERNAL-002', async () => {
    nock(INSEE_BASE)
      .get(`/api-sirene/3.11/siret/${ACTIVE_SIRET}`)
      .reply(503, { message: 'Service Unavailable' });

    const { buffer, headers } = buildMultipartBody(
      makePayloadFields(ACTIVE_SIRET, 'insee-down'),
    );
    const auth = buildInternalHeaders(
      'POST',
      '/v1/internal/pros',
      buffer,
      true,
    );

    const response = await app.inject({
      method: 'POST',
      url: '/v1/internal/pros',
      headers: { ...headers, ...auth },
      payload: buffer,
    });

    expect(response.statusCode).toBe(502);
    const body = JSON.parse(response.body) as { error: { tukioCode: string } };
    expect(body.error.tukioCode).toBe('IDENTITY-EXTERNAL-002');
  });

  // P10 + P5 — INSEE 401 (auth failed) returns the dedicated tukioCode
  it('502 — INSEE 401 returns IDENTITY-EXTERNAL-004 (auth failed)', async () => {
    nock(INSEE_BASE)
      .get(`/api-sirene/3.11/siret/${ACTIVE_SIRET}`)
      .reply(401, { message: 'Unauthorized' });

    const { buffer, headers } = buildMultipartBody(
      makePayloadFields(ACTIVE_SIRET, 'insee-auth'),
    );
    const auth = buildInternalHeaders(
      'POST',
      '/v1/internal/pros',
      buffer,
      true,
    );

    const response = await app.inject({
      method: 'POST',
      url: '/v1/internal/pros',
      headers: { ...headers, ...auth },
      payload: buffer,
    });

    expect(response.statusCode).toBe(502);
    const body = JSON.parse(response.body) as { error: { tukioCode: string } };
    expect(body.error.tukioCode).toBe('IDENTITY-EXTERNAL-004');
  });

  it('403 — request without HMAC headers is rejected', async () => {
    const { buffer, headers } = buildMultipartBody(
      makePayloadFields(ACTIVE_SIRET),
    );
    const response = await app.inject({
      method: 'POST',
      url: '/v1/internal/pros',
      headers,
      payload: buffer,
    });

    expect(response.statusCode).toBe(403);
  });

  it('502 — R2 upload failure triggers Keycloak rollback and returns IDENTITY-EXTERNAL-003', async () => {
    nock(INSEE_BASE)
      .get(`/api-sirene/3.11/siret/${ACTIVE_SIRET}`)
      .reply(200, makeInseePayload(ACTIVE_SIRET, 'A'));
    s3Mock.on(PutObjectCommand).rejects(new Error('R2 connection refused'));
    s3Mock.on(DeleteObjectCommand).resolves({});

    const { buffer, headers } = buildMultipartBody(
      makePayloadFields(ACTIVE_SIRET, 'r2-fail'),
    );
    const auth = buildInternalHeaders(
      'POST',
      '/v1/internal/pros',
      buffer,
      true,
    );

    const response = await app.inject({
      method: 'POST',
      url: '/v1/internal/pros',
      headers: { ...headers, ...auth },
      payload: buffer,
    });

    expect(response.statusCode).toBe(502);
    const body = JSON.parse(response.body) as { error: { tukioCode: string } };
    expect(body.error.tukioCode).toBe('IDENTITY-EXTERNAL-003');
  });
});
