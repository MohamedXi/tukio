/**
 * E2E spec — `POST /v1/auth/customer/register` (Story 1.2c Task 5).
 *
 * Exercises the public gateway-api endpoint against a `Test.createTestingModule`
 * app where the downstream `IIdentitySvcClient` is replaced with a Jest mock.
 * No identity-svc / Postgres / Keycloak / Redis required — the throttler uses
 * the in-memory storage (default when `storage` is omitted) so the 6th call
 * blocks within a single test process.
 *
 * Cases :
 *   1. Valid body                → 201 SuccessEnvelope { userId, requiresEmailVerification:true }
 *   2. Invalid body (short pwd)  → 422 VALIDATION-FAILED-001 + issues[]
 *   3. Conflict downstream       → 409 IDENTITY-CONFLICT-001
 *   4. 6th call same IP / min    → 429 RATE-LIMIT-EXCEEDED-001 + Retry-After header
 *   5. Correlation propagation   → mock receives X-Tukio-Correlation-Id from inbound header
 *   6. Cookie+body merge         → tk_acq cookie wins over body (first-touch)
 *
 * Run with: `pnpm --filter=gateway-api test:e2e`.
 */
import { randomUUID } from 'node:crypto';
import { type DynamicModule, Module, VersioningType } from '@nestjs/common';
import { NestFactory, APP_GUARD } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TukioAuthModule } from '@tukio/auth/module';
import { KeycloakJwtGuard } from '@tukio/auth/guards';
import { ZodValidationPipe } from 'nestjs-zod';
import { correlationMiddleware } from '@tukio/messaging/correlation/middleware';
import fastifyCookie from '@fastify/cookie';
import { CorrelationContextModule } from '@tukio/messaging/correlation';

import { ConfigurationModule } from '../src/infrastructure/config/config.module.js';
import { LoggerModule } from '../src/infrastructure/logger/logger.module.js';
import { HttpModule } from '../src/infrastructure/http/http.module.js';
import { UseCaseProxy } from '../src/infrastructure/usecases-proxy/usecases-proxy.js';
import {
  REGISTER_CUSTOMER_FORWARDER,
  REGISTER_PRO_FORWARDER,
  type RegisterCustomerForwarderProxy,
  type RegisterProForwarderProxy,
} from '../src/infrastructure/usecases-proxy/usecases-proxy.module.js';
import { RegisterCustomerForwarder } from '../src/usecases/register-customer.forwarder.js';
import { RegisterProForwarder } from '../src/usecases/register-pro.forwarder.js';
import { IDENTITY_SVC_CLIENT } from '../src/domain/ports/tokens.js';
import type {
  ForwardRegisterCustomerInput,
  IIdentitySvcClient,
} from '../src/domain/ports/identity-svc.port.js';
import { IdentitySvcConflictError } from '../src/domain/ports/identity-svc.errors.js';
import { EnvelopeExceptionFilter } from '../src/infrastructure/http/filters/envelope-exception.filter.js';
import { ResponseEnvelopeInterceptor } from '../src/infrastructure/http/interceptors/response-envelope.interceptor.js';

// ─── Test config ─────────────────────────────────────────────────────────────

const TEST_INTERNAL_SECRET = 'unit-test-internal-secret-32-bytes!';

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
  });
}

// ─── Mock IIdentitySvcClient ─────────────────────────────────────────────────

interface MockBehavior {
  calls: ForwardRegisterCustomerInput[];
  next?: (input: ForwardRegisterCustomerInput) => unknown;
}

class MockIdentitySvcClient implements IIdentitySvcClient {
  constructor(private readonly behavior: MockBehavior) {}

  registerCustomer(
    input: ForwardRegisterCustomerInput,
  ): Promise<{ userId: string; requiresEmailVerification: true }> {
    this.behavior.calls.push(input);
    const handler = this.behavior.next;
    if (handler) {
      const result = handler(input);
      if (result instanceof Error) return Promise.reject(result);
      if (result && typeof result === 'object' && 'userId' in result) {
        return Promise.resolve(
          result as { userId: string; requiresEmailVerification: true },
        );
      }
    }
    return Promise.resolve({
      userId: '11111111-1111-1111-1111-111111111111',
      requiresEmailVerification: true,
    });
  }

  // Story 1.3c — pro register is not exercised here; throw if called.
  registerPro(): Promise<never> {
    return Promise.reject(
      new Error('registerPro not exercised in customer-register e2e'),
    );
  }
}

// ─── Test app builder ────────────────────────────────────────────────────────

// Global wiring module — REGISTER_CUSTOMER_FORWARDER must be exported globally
// so the AuthCustomerController in HttpModule can inject it without explicit
// import (mirrors UseCasesProxyModule.register() in production AppModule).
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
        // AuthProController (Story 1.3c) is wired into HttpModule and needs
        // REGISTER_PRO_FORWARDER at boot — provide a stub so Nest can build
        // the test app even though pro-register is not exercised here.
        {
          inject: [IDENTITY_SVC_CLIENT],
          provide: REGISTER_PRO_FORWARDER,
          useFactory: (client: IIdentitySvcClient): RegisterProForwarderProxy =>
            new UseCaseProxy(new RegisterProForwarder(client)),
        },
      ],
      exports: [
        IDENTITY_SVC_CLIENT,
        REGISTER_CUSTOMER_FORWARDER,
        REGISTER_PRO_FORWARDER,
      ],
    };
  }
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
        { provide: APP_GUARD, useClass: KeycloakJwtGuard },
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

const validBody = (email = 'alice@example.com') => ({
  email,
  password: 'StrongPass-2026!',
  firstName: 'Alice',
  lastName: 'Martin',
  locale: 'fr' as const,
  acceptTerms: true,
  acceptMarketing: false,
});

const encodeAcquisitionCookie = (value: Record<string, unknown>): string =>
  Buffer.from(JSON.stringify(value)).toString('base64url');

// ─── Specs ───────────────────────────────────────────────────────────────────

describe('POST /v1/auth/customer/register (E2E — Story 1.2c)', () => {
  let app: NestFastifyApplication;
  let behavior: MockBehavior;

  beforeEach(async () => {
    behavior = { calls: [] };
    app = await buildTestApp(behavior);
  });

  afterEach(async () => {
    await app.close();
  });

  it('case 1 — valid body → 201 SuccessEnvelope', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/customer/register',
      payload: validBody(),
      headers: { 'content-type': 'application/json' },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.code).toBe(201);
    expect(body.method).toBe('POST');
    expect(body.data.userId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u,
    );
    expect(body.data.requiresEmailVerification).toBe(true);
    expect(body.meta.correlationId).toBeDefined();
    expect(body.meta.locale).toBe('fr');
    expect(behavior.calls).toHaveLength(1);
  });

  it('case 2 — invalid body (short password) → 422 VALIDATION-FAILED-001 + issues', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/customer/register',
      payload: { ...validBody(), password: 'short' },
      headers: { 'content-type': 'application/json' },
    });

    expect(res.statusCode).toBe(422);
    const body = res.json();
    expect(body.error.tukioCode).toBe('VALIDATION-FAILED-001');
    expect(Array.isArray(body.error.issues)).toBe(true);
    expect(body.error.issues.length).toBeGreaterThan(0);
    expect(behavior.calls).toHaveLength(0);
  });

  it('case 3 — downstream conflict → 409 IDENTITY-CONFLICT-001', async () => {
    behavior.next = () =>
      new IdentitySvcConflictError(
        'IDENTITY-CONFLICT-001',
        'Email already registered',
      );

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/customer/register',
      payload: validBody('taken@example.com'),
      headers: { 'content-type': 'application/json' },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.error.tukioCode).toBe('IDENTITY-CONFLICT-001');
    expect(behavior.calls).toHaveLength(1);
  });

  it('case 4 — 6th register from same IP within window → 429 RATE-LIMIT-EXCEEDED-001 + Retry-After header', async () => {
    // The decorator on `register` overrides the default scope to limit=5,
    // ttl=60s. Issue 5 requests (all should pass — different emails so no
    // downstream conflict) then the 6th must be blocked.
    for (let i = 0; i < 5; i++) {
      const r = await app.inject({
        method: 'POST',
        url: '/v1/auth/customer/register',
        payload: validBody(`user${i}@example.com`),
        headers: { 'content-type': 'application/json' },
      });
      expect(r.statusCode).toBe(201);
    }
    const blocked = await app.inject({
      method: 'POST',
      url: '/v1/auth/customer/register',
      payload: validBody('user-overflow@example.com'),
      headers: { 'content-type': 'application/json' },
    });

    expect(blocked.statusCode).toBe(429);
    const body = blocked.json();
    expect(body.error.tukioCode).toBe('RATE-LIMIT-EXCEEDED-001');
    const retryAfterHeader = blocked.headers['retry-after'];
    expect(retryAfterHeader).toBeDefined();
    const retryAfter = Number(
      Array.isArray(retryAfterHeader) ? retryAfterHeader[0] : retryAfterHeader,
    );
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(60);
  });

  it('case 5 — propagates inbound X-Tukio-Correlation-Id to the identity-svc client', async () => {
    const inboundCorrId = randomUUID();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/customer/register',
      payload: validBody('corr@example.com'),
      headers: {
        'content-type': 'application/json',
        'x-tukio-correlation-id': inboundCorrId,
      },
    });

    expect(res.statusCode).toBe(201);
    expect(behavior.calls).toHaveLength(1);
    expect(behavior.calls[0]?.correlationId).toBe(inboundCorrId);
  });

  it('case 6 — `tk_acq` cookie wins over body acquisition (first-touch attribution)', async () => {
    const cookieAttribution = {
      source: 'google_ads',
      medium: 'cpc',
      campaign: 'first-touch-2026',
    };
    const bodyAttribution = {
      source: 'meta_ads',
      medium: 'social',
    };
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/customer/register',
      payload: {
        ...validBody('acq@example.com'),
        acquisition: bodyAttribution,
      },
      headers: {
        'content-type': 'application/json',
        cookie: `tk_acq=${encodeAcquisitionCookie(cookieAttribution)}`,
      },
    });

    expect(res.statusCode).toBe(201);
    expect(behavior.calls).toHaveLength(1);
    expect(behavior.calls[0]?.acquisition).toEqual(cookieAttribution);
  });
});
