/**
 * E2E spec — `GET /v1/auth/whoami` (Story 1.4b AC10 whoami).
 *
 * Validates that the real `KeycloakJwtGuard` (Story 0.8) refuses unauthenticated
 * traffic on `/v1/auth/whoami` with the canonical 401 envelope. The happy
 * path (200 envelope + WhoamiResponseDto for a real JWT) is covered by:
 *   - `whoami.usecase.spec.ts` — pure projection from BackendActor
 *   - The Keycloak-backed manual smoke test (see Task 13 in the story file).
 *
 * Running the JWT-authenticated path here would require a full Keycloak
 * testcontainer + a signed access token; deferred to Story 1.4d observability
 * scope which already runs the heavy fixtures.
 */
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

@Module({})
class TestForwarderModule {
  static register(): DynamicModule {
    const oauthClient = new KeycloakOAuthClient({
      url: KEYCLOAK_URL,
      realm: 'tukio',
      publicBaseUrl: PUBLIC_BASE,
    });
    const cookieDeployment = { domain: null, secure: false };
    return {
      module: TestForwarderModule,
      global: true,
      providers: [
        { provide: IDENTITY_SVC_CLIENT, useValue: new NoopIdentityClient() },
        { provide: KEYCLOAK_OAUTH_CLIENT, useValue: oauthClient },
        {
          provide: LOGIN_AUDIT_EVENT_PUBLISHER,
          useValue: new NoopLoginAuditEventPublisher(),
        },
        {
          inject: [IDENTITY_SVC_CLIENT],
          provide: REGISTER_CUSTOMER_FORWARDER,
          useFactory: (client: IIdentitySvcClient) =>
            new UseCaseProxy(new RegisterCustomerForwarder(client)),
        },
        {
          inject: [IDENTITY_SVC_CLIENT],
          provide: REGISTER_PRO_FORWARDER,
          useFactory: (client: IIdentitySvcClient) =>
            new UseCaseProxy(new RegisterProForwarder(client)),
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
              auditPublisher: new NoopLoginAuditEventPublisher(),
              stateJwtSecret: STATE_SECRET,
              pkceCookieSecret: PKCE_SECRET,
              cookieDeployment,
              zoneBaseUrls: {
                public: PUBLIC_BASE,
                seller: SELLER_BASE,
                admin: ADMIN_BASE,
              },
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
      ],
      exports: [
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
      ],
    };
  }
}

@Module({})
class TestAppModule {
  static register(): DynamicModule {
    return {
      module: TestAppModule,
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
        TestForwarderModule.register(),
        HttpModule,
      ],
      providers: [
        { provide: APP_GUARD, useClass: KeycloakJwtGuard },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
      ],
    };
  }
}

async function buildTestApp(): Promise<NestFastifyApplication> {
  setTestEnv();
  const app = await NestFactory.create<NestFastifyApplication>(
    TestAppModule.register(),
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

describe('GET /v1/auth/whoami (E2E — Story 1.4b AC10)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await buildTestApp();
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
