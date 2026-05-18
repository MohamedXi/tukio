/**
 * E2E spec — `POST /v1/auth/pro/register` (Story 1.3c).
 *
 * Mirrors `auth-customer-register.e2e-spec.ts` but exercises the multipart
 * pro registration path. The downstream `IIdentitySvcClient` is mocked
 * in-process — no identity-svc / Postgres / Keycloak / Redis / INSEE / R2
 * required. The throttler runs in-memory so the 4th call in the same window
 * exercises the 3/min cap.
 *
 * Cases :
 *   1. Valid multipart (idCard + rib + payload)        → 201 SuccessEnvelope
 *   2. Invalid SIRET (Luhn fails)                       → 422 VALIDATION-FAILED-001
 *   3. Downstream conflict (SIRET dup)                  → 409 IDENTITY-CONFLICT-002
 *   4. Downstream INSEE inactive (422)                  → 422 IDENTITY-VALIDATION-003 forwarded
 *   5. Downstream INSEE down (502)                      → 502 forwarded as ExternalServiceException
 *   6. 4th call in window                                → 429 RATE-LIMIT-EXCEEDED-001 + Retry-After
 *   7. tk_acq cookie wins over body acquisition         → first-touch attribution forwarded
 *   8. Disallowed MIME type (text/plain idCard)         → 400 BadRequest from parser
 *   9. Oversized file (> 5 MB idCard)                   → 413 from @fastify/multipart limits
 *  10. Missing rib file                                 → 400 BadRequest from parser
 *  11. Inbound X-Tukio-Correlation-Id propagated        → mock receives same id
 *
 * Run with: `pnpm --filter=gateway-api test:e2e auth-pro-register`.
 */
import { randomUUID } from 'node:crypto';
import {
  type CanActivate,
  type DynamicModule,
  type ExecutionContext,
  Module,
  VersioningType,
} from '@nestjs/common';
import { NestFactory, APP_GUARD } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TukioAuthModule } from '@tukio/auth/module';
import type { BackendActor } from '@tukio/auth/types';
import { ZodValidationPipe } from 'nestjs-zod';
import { correlationMiddleware } from '@tukio/messaging/correlation/middleware';
import fastifyCookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import FormData from 'form-data';
import { CorrelationContextModule } from '@tukio/messaging/correlation';

import { ConfigurationModule } from '../src/infrastructure/config/config.module.js';
import { LoggerModule } from '../src/infrastructure/logger/logger.module.js';
import { HttpModule } from '../src/infrastructure/http/http.module.js';
import { UseCaseProxy } from '../src/infrastructure/usecases-proxy/usecases-proxy.js';
import {
  HANDLE_CALLBACK_USECASES_PROXY,
  INITIATE_LOGIN_USECASES_PROXY,
  LOGOUT_USECASES_PROXY,
  REFRESH_TOKEN_USECASES_PROXY,
  REGISTER_CUSTOMER_FORWARDER,
  REGISTER_PRO_FORWARDER,
  WHOAMI_USECASES_PROXY,
  type RegisterCustomerForwarderProxy,
  type RegisterProForwarderProxy,
} from '../src/infrastructure/usecases-proxy/usecases-proxy.module.js';
import { RegisterCustomerForwarder } from '../src/usecases/register-customer.forwarder.js';
import { RegisterProForwarder } from '../src/usecases/register-pro.forwarder.js';
import { InitiateLoginUseCase } from '../src/usecases/auth/initiate-login.usecase.js';
import { HandleCallbackUseCase } from '../src/usecases/auth/handle-callback.usecase.js';
import { RefreshTokenUseCase } from '../src/usecases/auth/refresh-token.usecase.js';
import { LogoutUseCase } from '../src/usecases/auth/logout.usecase.js';
import { WhoamiUseCase } from '../src/usecases/auth/whoami.usecase.js';
import { KeycloakOAuthClient } from '../src/infrastructure/external/keycloak/keycloak-oauth.client.js';
import { NoopLoginAuditEventPublisher } from '../src/infrastructure/external/login-audit/noop-login-audit-event-publisher.js';
import { IDENTITY_SVC_CLIENT } from '../src/domain/ports/tokens.js';
import type {
  ForwardRegisterProInput,
  IIdentitySvcClient,
} from '../src/domain/ports/identity-svc.port.js';
import {
  IdentitySvcConflictError,
  IdentitySvcUnreachableError,
  IdentitySvcValidationError,
} from '../src/domain/ports/identity-svc.errors.js';
import { EnvelopeExceptionFilter } from '../src/infrastructure/http/filters/envelope-exception.filter.js';
import { ResponseEnvelopeInterceptor } from '../src/infrastructure/http/interceptors/response-envelope.interceptor.js';

const TEST_INTERNAL_SECRET = 'unit-test-internal-secret-32-bytes!';
// Keycloak userId injected by the mock guard so controller can extract it.
const TEST_ACTOR_USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

/**
 * Stub guard that replaces `KeycloakJwtGuard` in the e2e test module.
 * Sets a pre-defined actor on `request.actor` so the controller can call
 * `@CurrentActor()` without a real Keycloak token (Story 1.3b-bis: endpoint
 * is no longer `@Public()`).
 */
class MockKeycloakJwtGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ actor: BackendActor }>();
    request.actor = {
      userId: TEST_ACTOR_USER_ID,
      role: 'client',
      roles: ['client'],
      locale: 'fr',
      email: 'test@example.com',
      emailVerified: true,
      amr: [],
    };
    return true;
  }
}

function setTestEnv(): void {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    SERVICE_NAME: 'gateway-api',
    PORT: '4000',
    KEYCLOAK_URL: 'http://kc.invalid',
    KEYCLOAK_REALM: 'tukio',
    KEYCLOAK_CLIENT_ID: 'tukio-api',
    KEYCLOAK_AUDIENCE: 'tukio-api',
    IDENTITY_SVC_URL: 'http://identity.invalid',
    IDENTITY_SVC_TIMEOUT_MS: '1000',
    IDENTITY_SVC_RETRIES: '0',
    REDIS_URL: 'redis://localhost:6379',
    TUKIO_INTERNAL_SERVICE_SECRET: TEST_INTERNAL_SECRET,
    PUBLIC_BASE_URL: 'http://localhost:3000',
    THROTTLER_DEFAULT_LIMIT: '60',
    THROTTLER_DEFAULT_TTL_MS: '60000',
    THROTTLER_SENSITIVE_LIMIT: '5',
    THROTTLER_SENSITIVE_TTL_MS: '60000',
    THROTTLER_PRO_REGISTER_LIMIT: '3',
    THROTTLER_PRO_REGISTER_TTL_MS: '60000',
  });
}

interface MockBehavior {
  proCalls: ForwardRegisterProInput[];
  proNext?: (input: ForwardRegisterProInput) => unknown;
}

class MockIdentitySvcClient implements IIdentitySvcClient {
  constructor(private readonly behavior: MockBehavior) {}

  registerCustomer(): Promise<never> {
    return Promise.reject(
      new Error('registerCustomer not exercised in pro-register e2e'),
    );
  }

  registerPro(input: ForwardRegisterProInput): Promise<{
    userId: string;
    proProfileId: string;
    requiresAdminReview: true;
    requiresEmailVerification: false;
  }> {
    this.behavior.proCalls.push(input);
    const handler = this.behavior.proNext;
    if (handler) {
      const result = handler(input);
      if (result instanceof Error) return Promise.reject(result);
      if (result && typeof result === 'object' && 'userId' in result) {
        return Promise.resolve(
          result as {
            userId: string;
            proProfileId: string;
            requiresAdminReview: true;
            requiresEmailVerification: false;
          },
        );
      }
    }
    return Promise.resolve({
      userId: '11111111-1111-1111-1111-111111111111',
      proProfileId: '22222222-2222-2222-2222-222222222222',
      requiresAdminReview: true,
      requiresEmailVerification: false,
    });
  }
}

@Module({})
class TestForwarderModule {
  static register(behavior: MockBehavior): DynamicModule {
    return {
      module: TestForwarderModule,
      global: true,
      providers: [
        {
          provide: IDENTITY_SVC_CLIENT,
          useValue: new MockIdentitySvcClient(behavior),
        },
        {
          inject: [IDENTITY_SVC_CLIENT],
          provide: REGISTER_CUSTOMER_FORWARDER,
          useFactory: (
            client: IIdentitySvcClient,
          ): RegisterCustomerForwarderProxy =>
            new UseCaseProxy(new RegisterCustomerForwarder(client)),
        },
        {
          inject: [IDENTITY_SVC_CLIENT],
          provide: REGISTER_PRO_FORWARDER,
          useFactory: (client: IIdentitySvcClient): RegisterProForwarderProxy =>
            new UseCaseProxy(new RegisterProForwarder(client)),
        },
        // Story 1.4b — stub the 5 auth login proxies so AuthLoginController wires up.
        ...buildAuthLoginStubs(),
      ],
      exports: [
        IDENTITY_SVC_CLIENT,
        REGISTER_CUSTOMER_FORWARDER,
        REGISTER_PRO_FORWARDER,
        INITIATE_LOGIN_USECASES_PROXY,
        HANDLE_CALLBACK_USECASES_PROXY,
        REFRESH_TOKEN_USECASES_PROXY,
        LOGOUT_USECASES_PROXY,
        WHOAMI_USECASES_PROXY,
      ],
    };
  }
}

function buildAuthLoginStubs(): {
  provide: string;
  useFactory: () => UseCaseProxy<unknown>;
}[] {
  const oauthClient = new KeycloakOAuthClient({
    url: 'http://kc.invalid',
    realm: 'tukio',
    publicBaseUrl: 'http://localhost:3000',
  });
  const cookieDeployment = { domain: null, secure: false };
  const zoneBaseUrls = {
    public: 'http://localhost:3000',
    seller: 'http://localhost:3002',
    admin: 'http://localhost:3003',
  };
  const audit = new NoopLoginAuditEventPublisher();
  return [
    {
      provide: INITIATE_LOGIN_USECASES_PROXY,
      useFactory: () =>
        new UseCaseProxy(
          new InitiateLoginUseCase({
            oauthClient,
            stateJwtSecret: 'stub-state-jwt-secret-32-bytes-min!',
            pkceCookieSecret: 'stub-pkce-cookie-secret-32-bytes!!',
            cookieDeployment,
            isDev: false,
          }),
        ),
    },
    {
      provide: HANDLE_CALLBACK_USECASES_PROXY,
      useFactory: () =>
        new UseCaseProxy(
          new HandleCallbackUseCase({
            oauthClient,
            auditPublisher: audit,
            stateJwtSecret: 'stub-state-jwt-secret-32-bytes-min!',
            pkceCookieSecret: 'stub-pkce-cookie-secret-32-bytes!!',
            cookieDeployment,
            zoneBaseUrls,
            isDev: false,
          }),
        ),
    },
    {
      provide: REFRESH_TOKEN_USECASES_PROXY,
      useFactory: () =>
        new UseCaseProxy(
          new RefreshTokenUseCase({ oauthClient, cookieDeployment }),
        ),
    },
    {
      provide: LOGOUT_USECASES_PROXY,
      useFactory: () =>
        new UseCaseProxy(new LogoutUseCase({ oauthClient, cookieDeployment })),
    },
    {
      provide: WHOAMI_USECASES_PROXY,
      useFactory: () => new UseCaseProxy(new WhoamiUseCase()),
    },
  ];
}

@Module({})
class TestAppModule {
  static register(behavior: MockBehavior): DynamicModule {
    return {
      module: TestAppModule,
      imports: [
        ConfigurationModule,
        LoggerModule,
        CorrelationContextModule,
        TukioAuthModule.forRoot({
          keycloakUrl: 'http://kc.invalid',
          realm: 'tukio',
          clientId: 'tukio-api',
          audience: 'tukio-api',
          jwksRefreshIntervalMs: 60_000_000,
        }),
        ThrottlerModule.forRoot({
          throttlers: [{ name: 'default', limit: 60, ttl: 60_000 }],
        }),
        TestForwarderModule.register(behavior),
        HttpModule,
      ],
      providers: [
        // Stub the JWT guard — the endpoint is authenticated (Story 1.3b-bis
        // removes @Public()) but the e2e test doesn't have a real Keycloak.
        { provide: APP_GUARD, useClass: MockKeycloakJwtGuard },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
      ],
    };
  }
}

async function buildTestApp(
  behavior: MockBehavior,
): Promise<NestFastifyApplication> {
  setTestEnv();
  const app = await NestFactory.create<NestFastifyApplication>(
    TestAppModule.register(behavior),
    new FastifyAdapter({ logger: false }),
    { logger: ['error', 'warn'], abortOnError: false },
  );
  const fastify = app.getHttpAdapter().getInstance();
  await fastify.register(fastifyCookie);
  await fastify.register(multipart, {
    throwFileSizeLimit: true,
    limits: {
      fileSize: 5 * 1024 * 1024,
      files: 3,
      parts: 5,
      fieldSize: 1 * 1024 * 1024,
    },
  });
  fastify.addHook('onRequest', (req, reply, done) => {
    correlationMiddleware(req, reply, (err) =>
      done(err instanceof Error ? err : undefined),
    );
  });
  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
  app.useGlobalFilters(new EnvelopeExceptionFilter());
  app.useGlobalPipes(new ZodValidationPipe());
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  await app.init();
  await fastify.ready();
  return app;
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

// Story 1.3b-bis: DTO now uses conversion wizard fields (no password/acceptTerms)
const validPayload = (email = 'pro@example.com') => ({
  email,
  firstName: 'Jean',
  lastName: 'Dupont',
  locale: 'fr' as const,
  dateOfBirth: '1990-06-15',
  acceptMarketing: false,
  companyName: 'Pro SAS',
  // Luhn-passing SIRET — same canonical fixture as identity-svc 1.3b.
  siret: '73282932000074',
  vatStatus: 'vat_registered',
  legalForm: 'SAS_SASU',
  categories: ['tents_marquees'],
  serviceZone: { city: 'Nantes', radiusKm: 80 },
  address: {
    street: '1 rue de la République',
    postalCode: '44000',
    city: 'Nantes',
    country: 'FR' as const,
  },
  contactPhone: '+33612345678',
  acceptCharter: true as const,
});

interface MultipartParts {
  payload?: string;
  idCard?: { buffer: Buffer; mimetype: string; filename: string };
  rib?: { buffer: Buffer; mimetype: string; filename: string };
  kbisOrInsee?: { buffer: Buffer; mimetype: string; filename: string };
}

function buildMultipartBody(parts: MultipartParts): {
  body: Buffer;
  headers: Record<string, string>;
} {
  const form = new FormData();
  if (parts.payload !== undefined) {
    // Do NOT set contentType: 'application/json' — @fastify/multipart would
    // auto-parse it and break the server-side `JSON.parse(payloadJson)` step.
    form.append('payload', parts.payload);
  }
  if (parts.idCard) {
    form.append('idCard', parts.idCard.buffer, {
      filename: parts.idCard.filename,
      contentType: parts.idCard.mimetype,
    });
  }
  if (parts.rib) {
    form.append('rib', parts.rib.buffer, {
      filename: parts.rib.filename,
      contentType: parts.rib.mimetype,
    });
  }
  if (parts.kbisOrInsee) {
    form.append('kbisOrInsee', parts.kbisOrInsee.buffer, {
      filename: parts.kbisOrInsee.filename,
      contentType: parts.kbisOrInsee.mimetype,
    });
  }
  return { body: form.getBuffer(), headers: form.getHeaders() };
}

const defaultMultipart = (payloadOverride?: object) =>
  buildMultipartBody({
    payload: JSON.stringify({ ...validPayload(), ...payloadOverride }),
    idCard: {
      buffer: Buffer.from('idcard-bytes'),
      mimetype: 'image/jpeg',
      filename: 'id.jpg',
    },
    rib: {
      buffer: Buffer.from('rib-bytes'),
      mimetype: 'application/pdf',
      filename: 'rib.pdf',
    },
  });

const encodeAcquisitionCookie = (value: Record<string, unknown>): string =>
  Buffer.from(JSON.stringify(value)).toString('base64url');

// ─── Specs ───────────────────────────────────────────────────────────────────

describe('POST /v1/auth/pro/register (E2E — Story 1.3c)', () => {
  jest.setTimeout(30_000);
  let app: NestFastifyApplication;
  let behavior: MockBehavior;

  beforeEach(async () => {
    behavior = { proCalls: [] };
    app = await buildTestApp(behavior);
  });

  afterEach(async () => {
    await app.close();
  });

  it('case 1 — valid multipart → 201 SuccessEnvelope', async () => {
    const { body, headers } = defaultMultipart();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/pro/register',
      payload: body,
      headers,
    });

    expect(res.statusCode).toBe(201);
    const env = res.json();
    expect(env.code).toBe(201);
    expect(env.data.userId).toMatch(/^[0-9a-f-]{36}$/u);
    expect(env.data.proProfileId).toMatch(/^[0-9a-f-]{36}$/u);
    expect(env.data.requiresAdminReview).toBe(true);
    expect(env.data.requiresEmailVerification).toBe(false);
    expect(behavior.proCalls).toHaveLength(1);
    expect(behavior.proCalls[0]?.siret).toBe('73282932000074');
    expect(behavior.proCalls[0]?.files.idCard.contentType).toBe('image/jpeg');
    expect(behavior.proCalls[0]?.files.rib.contentType).toBe('application/pdf');
  });

  it('case 2 — invalid SIRET (Luhn fails) → 422 VALIDATION-FAILED-001', async () => {
    const { body, headers } = defaultMultipart({ siret: '12345678901235' });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/pro/register',
      payload: body,
      headers,
    });

    expect(res.statusCode).toBe(422);
    const env = res.json();
    expect(env.error.tukioCode).toBe('VALIDATION-FAILED-001');
    expect(Array.isArray(env.error.issues)).toBe(true);
    expect(
      env.error.issues.some((i: { path: string }) => i.path === 'siret'),
    ).toBe(true);
    expect(behavior.proCalls).toHaveLength(0);
  });

  it('case 3 — downstream IDENTITY-CONFLICT-002 → 409 forwarded', async () => {
    behavior.proNext = () =>
      new IdentitySvcConflictError(
        'IDENTITY-CONFLICT-002',
        'SIRET already registered',
      );
    const { body, headers } = defaultMultipart();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/pro/register',
      payload: body,
      headers,
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error.tukioCode).toBe('IDENTITY-CONFLICT-002');
    expect(behavior.proCalls).toHaveLength(1);
  });

  it('case 4 — downstream IDENTITY-VALIDATION-003 (INSEE inactive) → 422 forwarded with issues', async () => {
    behavior.proNext = () =>
      new IdentitySvcValidationError(
        'IDENTITY-VALIDATION-003',
        'SIRET inactive',
        [
          {
            path: 'siret',
            code: 'insee_inactive',
            message: 'SIRET ceased',
          },
        ],
      );
    const { body, headers } = defaultMultipart();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/pro/register',
      payload: body,
      headers,
    });

    expect(res.statusCode).toBe(422);
    const env = res.json();
    expect(env.error.tukioCode).toBe('VALIDATION-FAILED-001');
    expect(env.error.issues).toEqual([
      { path: 'siret', code: 'insee_inactive', message: 'SIRET ceased' },
    ]);
  });

  it('case 5 — downstream INSEE down (Unreachable) → 502 external service', async () => {
    behavior.proNext = () =>
      new IdentitySvcUnreachableError('INSEE responded 503');
    const { body, headers } = defaultMultipart();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/pro/register',
      payload: body,
      headers,
    });

    expect(res.statusCode).toBe(502);
    const env = res.json();
    expect(env.error.tukioCode).toBe('IDENTITY-EXTERNAL-001');
  });

  it('case 6 — 4th register in the same window → 429 RATE-LIMIT-EXCEEDED-001 + Retry-After', async () => {
    for (let i = 0; i < 3; i++) {
      const { body, headers } = defaultMultipart({
        email: `pro${i}@example.com`,
      });
      const r = await app.inject({
        method: 'POST',
        url: '/v1/auth/pro/register',
        payload: body,
        headers,
      });
      expect(r.statusCode).toBe(201);
    }
    const { body, headers } = defaultMultipart({
      email: 'overflow@example.com',
    });
    const blocked = await app.inject({
      method: 'POST',
      url: '/v1/auth/pro/register',
      payload: body,
      headers,
    });

    expect(blocked.statusCode).toBe(429);
    expect(blocked.json().error.tukioCode).toBe('RATE-LIMIT-EXCEEDED-001');
    const retryHeader = blocked.headers['retry-after'];
    const retryAfter = Number(
      Array.isArray(retryHeader) ? retryHeader[0] : retryHeader,
    );
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(60);
  });

  it('case 7 — tk_acq cookie wins over body acquisition (first-touch)', async () => {
    const cookieAttribution = {
      source: 'google_ads',
      medium: 'cpc',
      campaign: 'first-touch-2026',
    };
    const bodyAttribution = {
      source: 'meta_ads',
      medium: 'social',
    };
    const { body, headers } = defaultMultipart({
      acquisition: bodyAttribution,
    });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/pro/register',
      payload: body,
      headers: {
        ...headers,
        cookie: `tk_acq=${encodeAcquisitionCookie(cookieAttribution)}`,
      },
    });

    expect(res.statusCode).toBe(201);
    expect(behavior.proCalls).toHaveLength(1);
    expect(behavior.proCalls[0]?.acquisition).toEqual(cookieAttribution);
  });

  it('case 8 — idCard with disallowed MIME (text/plain) → 400 from parser', async () => {
    const { body, headers } = buildMultipartBody({
      payload: JSON.stringify(validPayload()),
      idCard: {
        buffer: Buffer.from('not an image'),
        mimetype: 'text/plain',
        filename: 'id.txt',
      },
      rib: {
        buffer: Buffer.from('rib'),
        mimetype: 'application/pdf',
        filename: 'rib.pdf',
      },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/pro/register',
      payload: body,
      headers,
    });

    expect(res.statusCode).toBe(400);
    expect(behavior.proCalls).toHaveLength(0);
  });

  it('case 9 — oversized idCard (> 5 MB) → 413 PayloadTooLarge from parser', async () => {
    const oversize = Buffer.alloc(5 * 1024 * 1024 + 1, 'A');
    const { body, headers } = buildMultipartBody({
      payload: JSON.stringify(validPayload()),
      idCard: {
        buffer: oversize,
        mimetype: 'image/jpeg',
        filename: 'big.jpg',
      },
      rib: {
        buffer: Buffer.from('rib'),
        mimetype: 'application/pdf',
        filename: 'rib.pdf',
      },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/pro/register',
      payload: body,
      headers,
    });

    expect(res.statusCode).toBe(413);
    expect(behavior.proCalls).toHaveLength(0);
  });

  it('case 10 — missing rib file → 400 from parser', async () => {
    const { body, headers } = buildMultipartBody({
      payload: JSON.stringify(validPayload()),
      idCard: {
        buffer: Buffer.from('idcard'),
        mimetype: 'image/jpeg',
        filename: 'id.jpg',
      },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/pro/register',
      payload: body,
      headers,
    });

    expect(res.statusCode).toBe(400);
    expect(behavior.proCalls).toHaveLength(0);
  });

  it('case 11 — propagates inbound X-Tukio-Correlation-Id to the forwarder', async () => {
    const corr = randomUUID();
    const { body, headers } = defaultMultipart();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/pro/register',
      payload: body,
      headers: { ...headers, 'x-tukio-correlation-id': corr },
    });

    expect(res.statusCode).toBe(201);
    expect(behavior.proCalls[0]?.correlationId).toBe(corr);
  });
});
