/**
 * E2E spec — `GET /v1/auth/whoami` (Story 1.4b AC10 whoami).
 *
 * Describe block 1 — guard rejection (real KeycloakJwtGuard):
 *   1. No JWT → 401 AUTH-NOT-AUTHENTICATED
 *   2. Malformed Bearer token → 401
 *
 * Describe block 2 — happy paths (P7 review patch, mock guard):
 *   3. Customer JWT → 200 WhoamiResponseDto role=client
 *   4. Pro JWT → 200 role contains pro
 *   5. Admin JWT with TOTP → 200 mfaEnabled=true
 *
 * The happy paths use a `MockActorGuard` that reads a pre-encoded actor from
 * `x-p7-actor` header — matches the auth-pro-register.e2e-spec.ts pattern and
 * avoids needing a running Keycloak / JWKS server for basic projection tests.
 */
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
import { KeycloakJwtGuard } from '@tukio/auth/guards';
import type { BackendActor } from '@tukio/auth/types';
import { ZodValidationPipe } from 'nestjs-zod';
import fastifyCookie from '@fastify/cookie';
import { correlationMiddleware } from '@tukio/messaging/correlation/middleware';
import { CorrelationContextModule } from '@tukio/messaging/correlation';

import { ConfigurationModule } from '../../src/infrastructure/config/config.module.js';
import { LoggerModule } from '../../src/infrastructure/logger/logger.module.js';
import { HttpModule } from '../../src/infrastructure/http/http.module.js';
import { UseCaseProxy } from '../../src/infrastructure/usecases-proxy/usecases-proxy.js';
import {
  HANDLE_CALLBACK_USECASES_PROXY,
  INITIATE_LOGIN_USECASES_PROXY,
  LOGOUT_USECASES_PROXY,
  REFRESH_TOKEN_USECASES_PROXY,
  REGISTER_CUSTOMER_FORWARDER,
  REGISTER_PRO_FORWARDER,
  WHOAMI_USECASES_PROXY,
} from '../../src/infrastructure/usecases-proxy/usecases-proxy.module.js';
import { InitiateLoginUseCase } from '../../src/usecases/auth/initiate-login.usecase.js';
import { HandleCallbackUseCase } from '../../src/usecases/auth/handle-callback.usecase.js';
import { RefreshTokenUseCase } from '../../src/usecases/auth/refresh-token.usecase.js';
import { LogoutUseCase } from '../../src/usecases/auth/logout.usecase.js';
import { WhoamiUseCase } from '../../src/usecases/auth/whoami.usecase.js';
import { RegisterCustomerForwarder } from '../../src/usecases/register-customer.forwarder.js';
import { RegisterProForwarder } from '../../src/usecases/register-pro.forwarder.js';
import {
  IDENTITY_SVC_CLIENT,
  KEYCLOAK_OAUTH_CLIENT,
  LOGIN_AUDIT_EVENT_PUBLISHER,
} from '../../src/domain/ports/tokens.js';
import type { IIdentitySvcClient } from '../../src/domain/ports/identity-svc.port.js';
import { KeycloakOAuthClient } from '../../src/infrastructure/external/keycloak/keycloak-oauth.client.js';
import { NoopLoginAuditEventPublisher } from '../../src/infrastructure/external/login-audit/noop-login-audit-event-publisher.js';
import { EnvelopeExceptionFilter } from '../../src/infrastructure/http/filters/envelope-exception.filter.js';
import { ResponseEnvelopeInterceptor } from '../../src/infrastructure/http/interceptors/response-envelope.interceptor.js';

const KEYCLOAK_URL = 'http://localhost:9999';
const PUBLIC_BASE = 'http://localhost:3000';
const SELLER_BASE = 'http://localhost:3002';
const ADMIN_BASE = 'http://localhost:3003';
const STATE_SECRET = 'e2e-state-jwt-secret-32-bytes-min!';
const PKCE_SECRET = 'e2e-pkce-cookie-secret-32-bytes!!';

function setTestEnv(): void {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    SERVICE_NAME: 'gateway-api',
    PORT: '4000',
    KEYCLOAK_URL,
    KEYCLOAK_REALM: 'tukio',
    KEYCLOAK_CLIENT_ID: 'tukio-api',
    KEYCLOAK_AUDIENCE: 'tukio-api',
    IDENTITY_SVC_URL: 'http://identity.invalid',
    IDENTITY_SVC_TIMEOUT_MS: '1000',
    IDENTITY_SVC_RETRIES: '0',
    REDIS_URL: 'redis://localhost:6379',
    TUKIO_INTERNAL_SERVICE_SECRET: 'e2e-internal-svc-secret-32-bytes!!',
    PUBLIC_BASE_URL: PUBLIC_BASE,
    THROTTLER_DEFAULT_LIMIT: '60',
    THROTTLER_DEFAULT_TTL_MS: '60000',
    STATE_JWT_HMAC_SECRET: STATE_SECRET,
    PKCE_COOKIE_HMAC_SECRET: PKCE_SECRET,
    ZONE_BASE_URL_PUBLIC: PUBLIC_BASE,
    ZONE_BASE_URL_SELLER: SELLER_BASE,
    ZONE_BASE_URL_ADMIN: ADMIN_BASE,
    KEYCLOAK_OAUTH_CLIENT_WEB_ID: 'tukio-web',
    KEYCLOAK_OAUTH_CLIENT_ADMIN_ID: 'tukio-admin',
  });
}

class NoopIdentityClient implements IIdentitySvcClient {
  registerCustomer(): Promise<{
    userId: string;
    requiresEmailVerification: true;
  }> {
    return Promise.reject(new Error('not exercised'));
  }
  registerPro(): Promise<never> {
    return Promise.reject(new Error('not exercised'));
  }
}

function buildForwarderProviders(oauthClient: KeycloakOAuthClient) {
  const cookieDeployment = { domain: null, secure: false };
  const zoneBaseUrls = {
    public: PUBLIC_BASE,
    seller: SELLER_BASE,
    admin: ADMIN_BASE,
  };
  const audit = new NoopLoginAuditEventPublisher();
  return [
    { provide: IDENTITY_SVC_CLIENT, useValue: new NoopIdentityClient() },
    { provide: KEYCLOAK_OAUTH_CLIENT, useValue: oauthClient },
    { provide: LOGIN_AUDIT_EVENT_PUBLISHER, useValue: audit },
    {
      inject: [IDENTITY_SVC_CLIENT],
      provide: REGISTER_CUSTOMER_FORWARDER,
      useFactory: (c: IIdentitySvcClient) =>
        new UseCaseProxy(new RegisterCustomerForwarder(c)),
    },
    {
      inject: [IDENTITY_SVC_CLIENT],
      provide: REGISTER_PRO_FORWARDER,
      useFactory: (c: IIdentitySvcClient) =>
        new UseCaseProxy(new RegisterProForwarder(c)),
    },
    {
      provide: INITIATE_LOGIN_USECASES_PROXY,
      useValue: new UseCaseProxy(
        new InitiateLoginUseCase({
          oauthClient,
          stateJwtSecret: STATE_SECRET,
          pkceCookieSecret: PKCE_SECRET,
          cookieDeployment,
          isDev: false,
        }),
      ),
    },
    {
      provide: HANDLE_CALLBACK_USECASES_PROXY,
      useValue: new UseCaseProxy(
        new HandleCallbackUseCase({
          oauthClient,
          auditPublisher: audit,
          stateJwtSecret: STATE_SECRET,
          pkceCookieSecret: PKCE_SECRET,
          cookieDeployment,
          zoneBaseUrls,
          isDev: false,
        }),
      ),
    },
    {
      provide: REFRESH_TOKEN_USECASES_PROXY,
      useValue: new UseCaseProxy(
        new RefreshTokenUseCase({ oauthClient, cookieDeployment }),
      ),
    },
    {
      provide: LOGOUT_USECASES_PROXY,
      useValue: new UseCaseProxy(
        new LogoutUseCase({ oauthClient, cookieDeployment }),
      ),
    },
    {
      provide: WHOAMI_USECASES_PROXY,
      useValue: new UseCaseProxy(new WhoamiUseCase()),
    },
  ];
}

const EXPORT_TOKENS = [
  IDENTITY_SVC_CLIENT,
  KEYCLOAK_OAUTH_CLIENT,
  LOGIN_AUDIT_EVENT_PUBLISHER,
  REGISTER_CUSTOMER_FORWARDER,
  REGISTER_PRO_FORWARDER,
  INITIATE_LOGIN_USECASES_PROXY,
  HANDLE_CALLBACK_USECASES_PROXY,
  REFRESH_TOKEN_USECASES_PROXY,
  LOGOUT_USECASES_PROXY,
  WHOAMI_USECASES_PROXY,
];

@Module({})
class RealGuardForwarderModule {
  static register(): DynamicModule {
    const oauthClient = new KeycloakOAuthClient({
      url: KEYCLOAK_URL,
      realm: 'tukio',
      publicBaseUrl: PUBLIC_BASE,
    });
    return {
      module: RealGuardForwarderModule,
      global: true,
      providers: buildForwarderProviders(oauthClient),
      exports: EXPORT_TOKENS,
    };
  }
}

@Module({})
class RealGuardAppModule {
  static register(): DynamicModule {
    return {
      module: RealGuardAppModule,
      imports: [
        ConfigurationModule,
        LoggerModule,
        CorrelationContextModule,
        TukioAuthModule.forRoot({
          keycloakUrl: KEYCLOAK_URL,
          realm: 'tukio',
          clientId: 'tukio-api',
          audience: 'tukio-api',
          jwksRefreshIntervalMs: 60_000_000,
        }),
        ThrottlerModule.forRoot({
          throttlers: [{ name: 'default', limit: 60, ttl: 60_000 }],
        }),
        RealGuardForwarderModule.register(),
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
  useRealGuard: boolean,
): Promise<NestFastifyApplication> {
  setTestEnv();
  const AppMod = useRealGuard ? RealGuardAppModule : MockGuardAppModule;
  const app = await NestFactory.create<NestFastifyApplication>(
    AppMod.register(),
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

// ─── P7: mock guard accepts any request with x-p7-actor header ────────────────

class MockActorGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      actor?: BackendActor;
    }>();
    const raw = req.headers['x-p7-actor'];
    if (!raw) return false;
    req.actor = JSON.parse(raw) as BackendActor;
    return true;
  }
}

@Module({})
class MockGuardForwarderModule {
  static register(): DynamicModule {
    const oauthClient = new KeycloakOAuthClient({
      url: KEYCLOAK_URL,
      realm: 'tukio',
      publicBaseUrl: PUBLIC_BASE,
    });
    return {
      module: MockGuardForwarderModule,
      global: true,
      providers: buildForwarderProviders(oauthClient),
      exports: EXPORT_TOKENS,
    };
  }
}

@Module({})
class MockGuardAppModule {
  static register(): DynamicModule {
    return {
      module: MockGuardAppModule,
      imports: [
        ConfigurationModule,
        LoggerModule,
        CorrelationContextModule,
        TukioAuthModule.forRoot({
          keycloakUrl: KEYCLOAK_URL,
          realm: 'tukio',
          clientId: 'tukio-api',
          audience: 'tukio-api',
          jwksRefreshIntervalMs: 60_000_000,
        }),
        ThrottlerModule.forRoot({
          throttlers: [{ name: 'default', limit: 60, ttl: 60_000 }],
        }),
        MockGuardForwarderModule.register(),
        HttpModule,
      ],
      providers: [
        { provide: APP_GUARD, useClass: MockActorGuard },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
      ],
    };
  }
}

const baseActor: BackendActor = {
  userId: '11111111-1111-1111-1111-111111111111',
  role: 'client',
  roles: ['client'],
  locale: 'fr',
  email: 'test@example.com',
  emailVerified: true,
  amr: ['pwd'],
};

// ─── Guard rejection suite ─────────────────────────────────────────────────────

describe('GET /v1/auth/whoami (E2E — guard rejection)', () => {
  jest.setTimeout(30_000);
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await buildTestApp(true);
  });

  afterAll(async () => {
    await app.close();
  });

  it('case 1 — no JWT → 401 AUTH-NOT-AUTHENTICATED', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/auth/whoami' });
    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.error.tukioCode).toMatch(/^AUTH-NOT-AUTHENTICATED-/u);
  });

  it('case 2 — malformed Bearer token → 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/auth/whoami',
      headers: { authorization: 'Bearer not-a-jwt' },
    });
    expect(res.statusCode).toBe(401);
  });
});

// ─── P7 happy path suite ──────────────────────────────────────────────────────

describe('GET /v1/auth/whoami happy paths — P7 (mock guard)', () => {
  jest.setTimeout(30_000);
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await buildTestApp(false);
  });

  afterAll(async () => {
    await app.close();
  });

  it('case 3 — Customer JWT → 200 WhoamiResponseDto role=client', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/auth/whoami',
      headers: { 'x-p7-actor': JSON.stringify(baseActor) },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.code).toBe(200);
    expect(body.data.userId).toBe(baseActor.userId);
    expect(body.data.role).toEqual(['client']);
    expect(body.data.status).toBe('active');
    expect(body.data.emailVerified).toBe(true);
  });

  it('case 4 — Pro JWT → 200 role contains pro', async () => {
    const actor: BackendActor = {
      ...baseActor,
      role: 'pro',
      roles: ['client', 'pro'],
      email: 'pro@example.com',
    };
    const res = await app.inject({
      method: 'GET',
      url: '/v1/auth/whoami',
      headers: { 'x-p7-actor': JSON.stringify(actor) },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.role).toContain('pro');
  });

  it('case 5 — Admin JWT with TOTP → 200 mfaEnabled=true', async () => {
    const actor: BackendActor = {
      ...baseActor,
      role: 'admin-super',
      roles: ['admin-super'],
      amr: ['pwd', 'totp'],
      email: 'admin@example.com',
    };
    const res = await app.inject({
      method: 'GET',
      url: '/v1/auth/whoami',
      headers: { 'x-p7-actor': JSON.stringify(actor) },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.role).toEqual(['admin-super']);
    expect(body.data.mfaEnabled).toBe(true);
  });
});
