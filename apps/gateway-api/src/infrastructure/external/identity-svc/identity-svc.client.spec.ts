import { createHash, createHmac } from 'node:crypto';
import nock from 'nock';
import type {
  IConfigService,
  IdentitySvcConfig,
} from '../../../domain/ports/config.port.js';
import {
  IdentitySvcConflictError,
  IdentitySvcUnreachableError,
  IdentitySvcValidationError,
} from '../../../domain/ports/identity-svc.errors.js';
import type { ForwardRegisterProInput } from '../../../domain/ports/identity-svc.port.js';
import { IdentitySvcClient } from './identity-svc.client.js';

const IDENTITY_SVC_URL = 'http://identity.test';
const INTERNAL_SECRET = 'unit-test-internal-secret-32-bytes!';

const buildConfig = (
  overrides: Partial<IdentitySvcConfig> = {},
): IConfigService =>
  ({
    getIdentitySvcConfig: () => ({
      url: IDENTITY_SVC_URL,
      timeoutMs: 1_000,
      retries: 0,
      ...overrides,
    }),
    getInternalServiceSecret: () => INTERNAL_SECRET,
    // The remaining IConfigService methods aren't exercised by the client.
  }) as unknown as IConfigService;

const baseInput = {
  email: 'alice@example.com',
  password: 'StrongPass-2026!',
  firstName: 'Alice',
  lastName: 'Martin',
  locale: 'fr' as const,
  acceptTerms: true as const,
  acceptMarketing: false,
  correlationId: 'corr-spec-1',
};

describe('IdentitySvcClient.registerCustomer', () => {
  afterEach(() => {
    nock.cleanAll();
  });

  afterAll(() => {
    nock.restore();
  });

  it('signs the request with HMAC-SHA256 and forwards the correlation id', async () => {
    let capturedHeaders: Record<string, string | string[] | undefined> = {};
    let capturedBody: unknown = null;

    nock(IDENTITY_SVC_URL)
      .post('/v1/internal/customers')
      .reply(function reply(_uri: string, requestBody: unknown) {
        capturedBody = requestBody;
        capturedHeaders = this.req.headers;
        return [
          201,
          {
            method: 'POST',
            code: 201,
            data: {
              userId: '11111111-1111-1111-1111-111111111111',
              requiresEmailVerification: true,
            },
            meta: {
              timestamp: '2026-05-16T00:00:00Z',
              correlationId: 'corr-spec-1',
              locale: 'fr',
            },
          },
        ];
      });

    const client = new IdentitySvcClient(buildConfig());
    const result = await client.registerCustomer(baseInput);

    expect(result).toEqual({
      userId: '11111111-1111-1111-1111-111111111111',
      requiresEmailVerification: true,
    });

    expect(capturedHeaders['x-tukio-correlation-id']).toBe('corr-spec-1');
    const token = capturedHeaders['x-internal-service-token'];
    const ts = capturedHeaders['x-internal-service-timestamp'];
    const bodyHash = capturedHeaders['x-internal-service-body-sha256'];
    expect(typeof token).toBe('string');
    expect(typeof ts).toBe('string');
    expect(typeof bodyHash).toBe('string');

    // Verify the canonical signature matches what the InternalServiceGuard
    // (Story 1.2b) re-computes server-side. capturedBody is the raw stringified
    // payload (axios uses our exact JSON.stringify since we pass it as string).
    const rawBody =
      typeof capturedBody === 'string'
        ? capturedBody
        : JSON.stringify(capturedBody);
    const expectedBodyHash = createHash('sha256').update(rawBody).digest('hex');
    expect(bodyHash).toBe(expectedBodyHash);

    const canonical = `${String(ts)}.POST./v1/internal/customers.${expectedBodyHash}`;
    const expectedToken = createHmac('sha256', INTERNAL_SECRET)
      .update(canonical)
      .digest('hex');
    expect(token).toBe(expectedToken);
  });

  it('throws IdentitySvcConflictError on 409 with the tukioCode propagated', async () => {
    nock(IDENTITY_SVC_URL)
      .post('/v1/internal/customers')
      .reply(409, {
        method: 'POST',
        code: 409,
        error: {
          type: 'https://tukio.one/errors/identity-conflict-001',
          title: 'Identity conflict',
          detail: 'Email already registered',
          instance: '/v1/internal/customers',
          tukioCode: 'IDENTITY-CONFLICT-001',
        },
        meta: { timestamp: '...', correlationId: 'corr', locale: 'fr' },
      });

    const client = new IdentitySvcClient(buildConfig());
    await expect(client.registerCustomer(baseInput)).rejects.toMatchObject({
      constructor: IdentitySvcConflictError,
      tukioCode: 'IDENTITY-CONFLICT-001',
      detail: 'Email already registered',
    });
  });

  it('throws IdentitySvcValidationError on 422 carrying the issues array', async () => {
    nock(IDENTITY_SVC_URL)
      .post('/v1/internal/customers')
      .reply(422, {
        method: 'POST',
        code: 422,
        error: {
          type: 'https://tukio.one/errors/validation-failed',
          title: 'Validation failed',
          detail: 'Request payload failed validation.',
          instance: '/v1/internal/customers',
          tukioCode: 'VALIDATION-FAILED-001',
          issues: [
            { path: 'password', code: 'too_small', message: 'Min 12 chars' },
          ],
        },
        meta: { timestamp: '...', correlationId: 'corr', locale: 'fr' },
      });

    const client = new IdentitySvcClient(buildConfig());
    await expect(client.registerCustomer(baseInput)).rejects.toMatchObject({
      constructor: IdentitySvcValidationError,
      tukioCode: 'VALIDATION-FAILED-001',
      issues: [
        { path: 'password', code: 'too_small', message: 'Min 12 chars' },
      ],
    });
  });

  it('throws IdentitySvcUnreachableError on network failure', async () => {
    nock(IDENTITY_SVC_URL)
      .post('/v1/internal/customers')
      .replyWithError({ code: 'ECONNREFUSED', message: 'Connection refused' });

    const client = new IdentitySvcClient(buildConfig());
    await expect(client.registerCustomer(baseInput)).rejects.toMatchObject({
      constructor: IdentitySvcUnreachableError,
    });
  });

  it('retries 5xx responses up to the configured count then surfaces unreachable', async () => {
    const scope = nock(IDENTITY_SVC_URL)
      .post('/v1/internal/customers')
      .times(2)
      .reply(503, {
        method: 'POST',
        code: 503,
        error: {
          type: '',
          title: 'Service unavailable',
          detail: 'identity-svc is down',
          instance: '/v1/internal/customers',
          tukioCode: 'INTERNAL-SERVER-ERROR-001',
        },
        meta: { timestamp: '', correlationId: '', locale: 'fr' },
      });

    const client = new IdentitySvcClient(buildConfig({ retries: 1 }));
    await expect(client.registerCustomer(baseInput)).rejects.toBeInstanceOf(
      IdentitySvcUnreachableError,
    );
    expect(scope.isDone()).toBe(true);
  });

  it('flags a malformed success envelope as unreachable (defensive shape check)', async () => {
    nock(IDENTITY_SVC_URL)
      .post('/v1/internal/customers')
      .reply(201, {
        method: 'POST',
        code: 201,
        // `data` missing the expected fields → client refuses to consume.
        data: { userId: 42, requiresEmailVerification: false },
        meta: { timestamp: '', correlationId: '', locale: 'fr' },
      });

    const client = new IdentitySvcClient(buildConfig());
    await expect(client.registerCustomer(baseInput)).rejects.toBeInstanceOf(
      IdentitySvcUnreachableError,
    );
  });
});

// ─── registerPro (Story 1.3c) ──────────────────────────────────────────────

const MULTIPART_BODY_HASH_SENTINEL = createHash('sha256')
  .update('TUKIO_MULTIPART_NO_BODY_HASH')
  .digest('hex');

const buildProInput = (): ForwardRegisterProInput => ({
  userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  email: 'pro@example.com',
  firstName: 'Jean',
  lastName: 'Dupont',
  locale: 'fr',
  dateOfBirth: '1990-06-15',
  acceptMarketing: false,
  companyName: 'Pro SAS',
  // Valid Luhn-passing SIRET — same test fixture as identity-svc 1.3b specs.
  siret: '73282932000074',
  vatStatus: 'vat_registered',
  legalForm: 'SAS_SASU',
  categories: ['tents_marquees'],
  serviceZone: { city: 'Nantes', radiusKm: 80 },
  address: {
    street: '1 rue de la République',
    postalCode: '44000',
    city: 'Nantes',
    country: 'FR',
  },
  contactPhone: '+33612345678',
  acceptCharter: true,
  correlationId: 'corr-pro-1',
  files: {
    idCard: {
      buffer: Buffer.from('idcard-bytes'),
      contentType: 'image/jpeg',
      originalName: 'id.jpg',
    },
    rib: {
      buffer: Buffer.from('rib-bytes'),
      contentType: 'application/pdf',
      originalName: 'rib.pdf',
    },
  },
});

describe('IdentitySvcClient.registerPro', () => {
  beforeAll(() => {
    // The customer suite's afterAll calls `nock.restore()` which removes the
    // http override globally. Re-activate so this suite's interceptors fire.
    if (!nock.isActive()) {
      nock.activate();
    }
  });

  afterEach(() => {
    nock.cleanAll();
  });

  afterAll(() => {
    nock.restore();
  });

  it('signs the request with the multipart body-hash sentinel and forwards the correlation id', async () => {
    let capturedHeaders: Record<string, string | string[] | undefined> = {};
    let capturedContentType: string | undefined;

    nock(IDENTITY_SVC_URL)
      .post('/v1/internal/pros')
      .reply(function reply() {
        capturedHeaders = this.req.headers;
        const ct = this.req.headers['content-type'];
        capturedContentType = Array.isArray(ct) ? ct[0] : ct;
        return [
          201,
          {
            method: 'POST',
            code: 201,
            data: {
              userId: '11111111-1111-1111-1111-111111111111',
              proProfileId: '22222222-2222-2222-2222-222222222222',
              requiresAdminReview: true,
              requiresEmailVerification: false,
            },
            meta: {
              timestamp: '2026-05-17T00:00:00Z',
              correlationId: 'corr-pro-1',
              locale: 'fr',
            },
          },
        ];
      });

    const client = new IdentitySvcClient(buildConfig());
    const result = await client.registerPro(buildProInput());

    expect(result).toEqual({
      userId: '11111111-1111-1111-1111-111111111111',
      proProfileId: '22222222-2222-2222-2222-222222222222',
      requiresAdminReview: true,
      requiresEmailVerification: false,
    });

    expect(capturedContentType).toMatch(/^multipart\/form-data; boundary=/);
    expect(capturedHeaders['x-tukio-correlation-id']).toBe('corr-pro-1');

    const token = capturedHeaders['x-internal-service-token'];
    const ts = capturedHeaders['x-internal-service-timestamp'];
    const bodyHash = capturedHeaders['x-internal-service-body-sha256'];
    expect(typeof token).toBe('string');
    expect(typeof ts).toBe('string');
    // CRITICAL — multipart MUST use the sentinel, NOT the real body hash.
    // Identity-svc's InternalServiceGuard rejects multipart requests carrying
    // any other body hash (Story 1.3b D1).
    expect(bodyHash).toBe(MULTIPART_BODY_HASH_SENTINEL);

    const canonical = `${String(ts)}.POST./v1/internal/pros.${MULTIPART_BODY_HASH_SENTINEL}`;
    const expectedToken = createHmac('sha256', INTERNAL_SECRET)
      .update(canonical)
      .digest('hex');
    expect(token).toBe(expectedToken);
  });

  it('includes the optional kbisOrInsee file when provided', async () => {
    let bodyText = '';
    nock(IDENTITY_SVC_URL)
      .post('/v1/internal/pros', (body) => {
        bodyText = typeof body === 'string' ? body : '';
        return true;
      })
      .reply(201, {
        method: 'POST',
        code: 201,
        data: {
          userId: '11111111-1111-1111-1111-111111111111',
          proProfileId: '22222222-2222-2222-2222-222222222222',
          requiresAdminReview: true,
          requiresEmailVerification: false,
        },
        meta: { timestamp: '', correlationId: 'corr-pro-1', locale: 'fr' },
      });

    const client = new IdentitySvcClient(buildConfig());
    const base = buildProInput();
    const input = {
      ...base,
      files: {
        ...base.files,
        kbisOrInsee: {
          buffer: Buffer.from('kbis-bytes'),
          contentType: 'application/pdf',
          originalName: 'kbis.pdf',
        },
      },
    };
    await client.registerPro(input);

    // Multipart bodies sent through nock are stringified — assert all three
    // file fieldnames appear.
    expect(bodyText).toContain('name="idCard"');
    expect(bodyText).toContain('name="rib"');
    expect(bodyText).toContain('name="kbisOrInsee"');
    expect(bodyText).toContain('name="payload"');
  });

  it('throws IdentitySvcConflictError on 409 IDENTITY-CONFLICT-002 (duplicate SIRET)', async () => {
    nock(IDENTITY_SVC_URL)
      .post('/v1/internal/pros')
      .reply(409, {
        method: 'POST',
        code: 409,
        error: {
          type: 'https://tukio.one/errors/identity-conflict-002',
          title: 'Identity conflict',
          detail: 'SIRET already registered',
          instance: '/v1/internal/pros',
          tukioCode: 'IDENTITY-CONFLICT-002',
        },
        meta: { timestamp: '', correlationId: 'corr', locale: 'fr' },
      });

    const client = new IdentitySvcClient(buildConfig());
    await expect(client.registerPro(buildProInput())).rejects.toMatchObject({
      constructor: IdentitySvcConflictError,
      tukioCode: 'IDENTITY-CONFLICT-002',
    });
  });

  it('throws IdentitySvcValidationError on 422 IDENTITY-VALIDATION-003 (INSEE inactive) with issues forwarded', async () => {
    nock(IDENTITY_SVC_URL)
      .post('/v1/internal/pros')
      .reply(422, {
        method: 'POST',
        code: 422,
        error: {
          type: 'https://tukio.one/errors/identity-validation-003',
          title: 'Validation failed',
          detail: 'SIRET reported inactive by INSEE',
          instance: '/v1/internal/pros',
          tukioCode: 'IDENTITY-VALIDATION-003',
          issues: [
            {
              path: 'siret',
              code: 'insee_inactive',
              message: 'SIRET ceased on 2024-01-01',
            },
          ],
        },
        meta: { timestamp: '', correlationId: 'corr', locale: 'fr' },
      });

    const client = new IdentitySvcClient(buildConfig());
    await expect(client.registerPro(buildProInput())).rejects.toMatchObject({
      constructor: IdentitySvcValidationError,
      tukioCode: 'IDENTITY-VALIDATION-003',
      issues: [
        {
          path: 'siret',
          code: 'insee_inactive',
          message: 'SIRET ceased on 2024-01-01',
        },
      ],
    });
  });

  it('throws IdentitySvcUnreachableError on 502 IDENTITY-EXTERNAL-002 (INSEE down)', async () => {
    nock(IDENTITY_SVC_URL)
      .post('/v1/internal/pros')
      .reply(502, {
        method: 'POST',
        code: 502,
        error: {
          type: '',
          title: 'INSEE unreachable',
          detail: 'INSEE SIRENE returned 503',
          instance: '/v1/internal/pros',
          tukioCode: 'IDENTITY-EXTERNAL-002',
        },
        meta: { timestamp: '', correlationId: 'corr', locale: 'fr' },
      });

    const client = new IdentitySvcClient(buildConfig());
    await expect(client.registerPro(buildProInput())).rejects.toBeInstanceOf(
      IdentitySvcUnreachableError,
    );
  });

  it('flags a malformed success envelope (missing proProfileId) as unreachable', async () => {
    nock(IDENTITY_SVC_URL)
      .post('/v1/internal/pros')
      .reply(201, {
        method: 'POST',
        code: 201,
        // `proProfileId` missing → client refuses to consume.
        data: {
          userId: '11111111-1111-1111-1111-111111111111',
          requiresAdminReview: true,
          requiresEmailVerification: false,
        },
        meta: { timestamp: '', correlationId: '', locale: 'fr' },
      });

    const client = new IdentitySvcClient(buildConfig());
    await expect(client.registerPro(buildProInput())).rejects.toBeInstanceOf(
      IdentitySvcUnreachableError,
    );
  });
});
