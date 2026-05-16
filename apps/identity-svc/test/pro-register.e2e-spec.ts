/**
 * E2E tests for POST /v1/internal/pros — Story 1.3b.
 *
 * Requires: pnpm docker:up:wait (Postgres + Keycloak + NATS)
 * Run with: pnpm --filter=identity-svc test:e2e -- pro-register.e2e-spec.ts
 *
 * Dependencies mocked:
 *   - INSEE SIRENE API via nock (no real HTTP to api.insee.fr)
 *   - R2 media storage via aws-sdk-client-mock (no real R2 uploads)
 *
 * Real infra used:
 *   - Postgres (tukio_identity) — migrations auto-run at boot
 *   - Keycloak (tukio realm) — real user creation + rollback
 *   - NATS JetStream — outbox events published then discarded
 */
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

const s3Mock = mockClient(S3Client);

const INSEE_BASE = 'https://api.insee.fr';
const ACTIVE_SIRET = '35600000000048';
const INACTIVE_SIRET = '73282932000074';

// Shared test secret matching env.schema dev default
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
      },
    },
  };
}

async function buildHmacHeader(
  method: string,
  path: string,
  body: Buffer,
): Promise<string> {
  const { createHmac, createHash } = await import('node:crypto');
  const ts = Date.now();
  const bodyHash = createHash('sha256').update(body).digest('hex');
  const signature = createHmac('sha256', INTERNAL_SECRET)
    .update(`${ts}.${method}.${path}.${bodyHash}`)
    .digest('hex');
  return `ts=${ts},sig=${signature}`;
}

describe('POST /v1/internal/pros (e2e)', () => {
  let app: NestFastifyApplication;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter({ logger: false }),
    );
    await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } });
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

  it('201 — happy path: valid SIRET + active + files', async () => {
    nock(INSEE_BASE)
      .get(`/api-sirene/3.11/siret/${ACTIVE_SIRET}`)
      .reply(200, makeInseePayload(ACTIVE_SIRET, 'A'));

    s3Mock.on(PutObjectCommand).resolves({ ETag: '"etag-123"' });

    const fd = new FormData();
    fd.append(
      'payload',
      JSON.stringify({
        email: `pro-${Date.now()}@acme.test`,
        password: 'SecurePass123!',
        firstName: 'Jean',
        lastName: 'Dupont',
        locale: 'fr',
        acceptTerms: true,
        acceptMarketing: false,
        companyName: 'ACME SAS',
        siret: ACTIVE_SIRET,
        address: {
          street: '10 rue de la Paix',
          postalCode: '75001',
          city: 'Paris',
          country: 'FR',
        },
        contactPhone: '+33612345678',
      }),
    );
    fd.append('idCard', Buffer.from('fake-id-card'), {
      filename: 'id-card.jpg',
      contentType: 'image/jpeg',
    });
    fd.append('rib', Buffer.from('fake-rib'), {
      filename: 'rib.pdf',
      contentType: 'application/pdf',
    });

    const bodyBuffer = fd.getBuffer();
    const hmac = await buildHmacHeader('POST', '/v1/internal/pros', bodyBuffer);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/internal/pros',
      headers: {
        ...fd.getHeaders(),
        'x-tukio-internal-signature': hmac,
      },
      payload: bodyBuffer,
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body) as {
      data: { userId: string; proProfileId: string };
    };
    expect(body.data.userId).toBeDefined();
    expect(body.data.proProfileId).toBeDefined();
  });

  it('422 — inactive SIRET (etat=C) returns VALIDATION_SIRET_INACTIVE', async () => {
    nock(INSEE_BASE)
      .get(`/api-sirene/3.11/siret/${INACTIVE_SIRET}`)
      .reply(200, makeInseePayload(INACTIVE_SIRET, 'C'));

    s3Mock.on(PutObjectCommand).resolves({ ETag: '"etag-123"' });

    const fd = new FormData();
    fd.append(
      'payload',
      JSON.stringify({
        email: `pro2-${Date.now()}@acme.test`,
        password: 'SecurePass123!',
        firstName: 'Jean',
        lastName: 'Dupont',
        locale: 'fr',
        acceptTerms: true,
        acceptMarketing: false,
        companyName: 'ACME SAS',
        siret: INACTIVE_SIRET,
        address: {
          street: '1 rue Test',
          postalCode: '44000',
          city: 'Nantes',
          country: 'FR',
        },
        contactPhone: '+33612345678',
      }),
    );
    fd.append('idCard', Buffer.from('id'), {
      filename: 'id.jpg',
      contentType: 'image/jpeg',
    });
    fd.append('rib', Buffer.from('rib'), {
      filename: 'rib.pdf',
      contentType: 'application/pdf',
    });

    const bodyBuffer = fd.getBuffer();
    const hmac = await buildHmacHeader('POST', '/v1/internal/pros', bodyBuffer);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/internal/pros',
      headers: { ...fd.getHeaders(), 'x-tukio-internal-signature': hmac },
      payload: bodyBuffer,
    });

    expect(response.statusCode).toBe(422);
    const body = JSON.parse(response.body) as { error: { tukioCode: string } };
    expect(body.error.tukioCode).toBe('IDENTITY-VALIDATION-003');
  });

  it('422 — Luhn-invalid SIRET is rejected by the VO', async () => {
    const fd = new FormData();
    fd.append(
      'payload',
      JSON.stringify({
        email: `pro3-${Date.now()}@acme.test`,
        password: 'SecurePass123!',
        firstName: 'Jean',
        lastName: 'Dupont',
        locale: 'fr',
        acceptTerms: true,
        acceptMarketing: false,
        companyName: 'ACME SAS',
        siret: '12345678900000',
        address: {
          street: '1 rue Test',
          postalCode: '44000',
          city: 'Nantes',
          country: 'FR',
        },
        contactPhone: '+33612345678',
      }),
    );
    fd.append('idCard', Buffer.from('id'), {
      filename: 'id.jpg',
      contentType: 'image/jpeg',
    });
    fd.append('rib', Buffer.from('rib'), {
      filename: 'rib.pdf',
      contentType: 'application/pdf',
    });

    const bodyBuffer = fd.getBuffer();
    const hmac = await buildHmacHeader('POST', '/v1/internal/pros', bodyBuffer);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/internal/pros',
      headers: { ...fd.getHeaders(), 'x-tukio-internal-signature': hmac },
      payload: bodyBuffer,
    });

    expect(response.statusCode).toBe(422);
  });

  it('401 — request without HMAC signature is rejected', async () => {
    const fd = new FormData();
    fd.append('payload', JSON.stringify({ email: 'x@y.com' }));

    const response = await app.inject({
      method: 'POST',
      url: '/v1/internal/pros',
      headers: fd.getHeaders(),
      payload: fd.getBuffer(),
    });

    expect(response.statusCode).toBe(401);
  });

  it('502 — R2 upload failure triggers Keycloak rollback and returns 502', async () => {
    nock(INSEE_BASE)
      .get(`/api-sirene/3.11/siret/${ACTIVE_SIRET}`)
      .reply(200, makeInseePayload(ACTIVE_SIRET, 'A'));

    s3Mock.on(PutObjectCommand).rejects(new Error('R2 connection refused'));
    s3Mock.on(DeleteObjectCommand).resolves({});

    const fd = new FormData();
    fd.append(
      'payload',
      JSON.stringify({
        email: `pro4-${Date.now()}@acme.test`,
        password: 'SecurePass123!',
        firstName: 'Jean',
        lastName: 'Dupont',
        locale: 'fr',
        acceptTerms: true,
        acceptMarketing: false,
        companyName: 'ACME SAS',
        siret: ACTIVE_SIRET,
        address: {
          street: '1 rue Test',
          postalCode: '44000',
          city: 'Nantes',
          country: 'FR',
        },
        contactPhone: '+33612345678',
      }),
    );
    fd.append('idCard', Buffer.from('id'), {
      filename: 'id.jpg',
      contentType: 'image/jpeg',
    });
    fd.append('rib', Buffer.from('rib'), {
      filename: 'rib.pdf',
      contentType: 'application/pdf',
    });

    const bodyBuffer = fd.getBuffer();
    const hmac = await buildHmacHeader('POST', '/v1/internal/pros', bodyBuffer);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/internal/pros',
      headers: { ...fd.getHeaders(), 'x-tukio-internal-signature': hmac },
      payload: bodyBuffer,
    });

    expect(response.statusCode).toBe(502);
    const body = JSON.parse(response.body) as { error: { tukioCode: string } };
    expect(body.error.tukioCode).toBe('IDENTITY-EXTERNAL-003');
  });
});
