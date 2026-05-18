/**
 * Shared test app builder for the Story 1.4b auth e2e suite.
 *
 * Wires the production HttpModule with mocked downstream dependencies:
 *   - `IDENTITY_SVC_CLIENT` → never called (auth e2e covers login flow only)
 *   - `KEYCLOAK_OAUTH_CLIENT` → real instance pointing at a placeholder URL
 *     (overridden per-test when a Keycloak testcontainer is in play)
 *   - `LOGIN_AUDIT_EVENT_PUBLISHER` → no-op pino logger
 *
 * Re-used by `auth-login`, `auth-whoami`, `auth-callback`, `auth-refresh`,
 * and `auth-logout` specs so each test file remains <250 lines.
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

export const TEST_KEYCLOAK_URL = 'http://localhost:9999';
export const TEST_PUBLIC_BASE = 'http://localhost:3000';
export const TEST_SELLER_BASE = 'http://localhost:3002';
export const TEST_ADMIN_BASE = 'http://localhost:3003';
export const TEST_STATE_SECRET = 'e2e-state-jwt-secret-32-bytes-min!';
export const TEST_PKCE_SECRET = 'e2e-pkce-cookie-secret-32-bytes!!';

export function setTestEnv(): void {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    SERVICE_NAME: 'gateway-api',
    PORT: '4000',
    KEYCLOAK_URL: TEST_KEYCLOAK_URL,
    KEYCLOAK_REALM: 'tukio',
    KEYCLOAK_CLIENT_ID: 'tukio-api',
    KEYCLOAK_AUDIENCE: 'tukio-api',
    IDENTITY_SVC_URL: 'http://identity.invalid',
    IDENTITY_SVC_TIMEOUT_MS: '1000',
    IDENTITY_SVC_RETRIES: '0',
    REDIS_URL: 'redis://localhost:6379',
    TUKIO_INTERNAL_SERVICE_SECRET: 'e2e-internal-svc-secret-32-bytes!!',
    PUBLIC_BASE_URL: TEST_PUBLIC_BASE,
    THROTTLER_DEFAULT_LIMIT: '60',
    THROTTLER_DEFAULT_TTL_MS: '60000',
    STATE_JWT_HMAC_SECRET: TEST_STATE_SECRET,
    PKCE_COOKIE_HMAC_SECRET: TEST_PKCE_SECRET,
    ZONE_BASE_URL_PUBLIC: TEST_PUBLIC_BASE,
    ZONE_BASE_URL_SELLER: TEST_SELLER_BASE,
    ZONE_BASE_URL_ADMIN: TEST_ADMIN_BASE,
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
      url: TEST_KEYCLOAK_URL,
      realm: 'tukio',
      publicBaseUrl: TEST_PUBLIC_BASE,
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
              stateJwtSecret: TEST_STATE_SECRET,
              pkceCookieSecret: TEST_PKCE_SECRET,
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
              stateJwtSecret: TEST_STATE_SECRET,
              pkceCookieSecret: TEST_PKCE_SECRET,
              cookieDeployment,
              zoneBaseUrls: {
                public: TEST_PUBLIC_BASE,
                seller: TEST_SELLER_BASE,
                admin: TEST_ADMIN_BASE,
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
          keycloakUrl: TEST_KEYCLOAK_URL,
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

export async function buildTestApp(): Promise<NestFastifyApplication> {
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
