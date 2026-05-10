import { type DynamicModule, Module, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import * as crypto from 'crypto';
import nock from 'nock';
import { ConfigurationModule } from '../../src/infrastructure/config/config.module.js';
import { LoggerModule } from '../../src/infrastructure/logger/logger.module.js';
import { KeycloakModule } from '../../src/infrastructure/external/keycloak/keycloak.module.js';
import { HealthController } from '../../src/infrastructure/http/controllers/health.controller.js';
import { UserController } from '../../src/infrastructure/http/controllers/user.controller.js';
import { EnvelopeExceptionFilter } from '../../src/infrastructure/http/filters/envelope-exception.filter.js';
import { ResponseEnvelopeInterceptor } from '../../src/infrastructure/http/interceptors/response-envelope.interceptor.js';
import { UseCaseProxy } from '../../src/infrastructure/usecases-proxy/usecases-proxy.js';
import { GetUserProfileByIdUseCase } from '../../src/usecases/get-user-profile.usecase.js';
import type { IUserProfileRepository } from '../../src/domain/ports/user-profile.repository.port.js';
import { USER_PROFILE_REPOSITORY } from '../../src/domain/ports/tokens.js';
import { TukioAuthModule } from '@tukio/auth/module';

const GET_USER_PROFILE_USECASES_PROXY = 'GET_USER_PROFILE_USECASES_PROXY';

export const TEST_KEYCLOAK_URL = 'http://test-keycloak.local';
export const TEST_REALM = 'tukio';
export const TEST_CLIENT_ID = 'tukio-api';
const JWKS_PATH = `/realms/${TEST_REALM}/protocol/openid-connect/certs`;
const TEST_KID = 'e2e-test-kid';

// RSA key pair generated synchronously via Node crypto. JWTs are signed with
// the native crypto API (not jose) because jose v6 ships ESM-only and Jest +
// ts-jest under CommonJS cannot consume ESM-only packages without test-time
// build complexity. The runtime path uses jose; this helper proves real JWTs
// validate against jose's verifier in production tests.
const { privateKey: privatePem, publicKey: publicPem } =
  crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
const privateKeyObj = crypto.createPrivateKey(privatePem);
const publicKeyObj = crypto.createPublicKey(publicPem);

function publicJwk(): Record<string, unknown> {
  const jwk = publicKeyObj.export({ format: 'jwk' });
  return { ...jwk, kid: TEST_KID, use: 'sig', alg: 'RS256' };
}

function base64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input;
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export interface TestJwtOverrides {
  sub?: string;
  roles?: string[];
  exp?: number;
  amr?: string[];
  acr?: string;
  email?: string;
  email_verified?: boolean;
  locale?: string;
}

// Sign a Keycloak-shaped JWT with the test RSA key. Returns synchronously —
// jose's async API is not used in tests for the reason explained above.
export function generateTestJwt(overrides: TestJwtOverrides = {}): string {
  const now = Math.floor(Date.now() / 1000);
  const exp = overrides.exp ?? now + 3600;
  const header = { alg: 'RS256', typ: 'JWT', kid: TEST_KID };
  const payload: Record<string, unknown> = {
    sub: overrides.sub ?? '11111111-1111-1111-1111-111111111111',
    iss: `${TEST_KEYCLOAK_URL}/realms/${TEST_REALM}`,
    aud: TEST_CLIENT_ID,
    iat: now,
    exp,
    email: overrides.email ?? 'test@tukio.one',
    email_verified: overrides.email_verified ?? true,
    realm_access: { roles: overrides.roles ?? ['client'] },
    amr: overrides.amr ?? [],
    locale: overrides.locale ?? 'fr',
  };
  if (overrides.acr) payload.acr = overrides.acr;
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = crypto.sign(
    'RSA-SHA256',
    Buffer.from(signingInput),
    privateKeyObj,
  );
  return `${signingInput}.${base64url(signature)}`;
}

export function setupJwksMock(): void {
  nock(TEST_KEYCLOAK_URL)
    .get(JWKS_PATH)
    .reply(200, { keys: [publicJwk()] })
    .persist();
}

export interface TestAppOptions {
  userProfileRepo: IUserProfileRepository;
}

@Module({})
class MockRepoModule {
  static register(repo: IUserProfileRepository): DynamicModule {
    return {
      module: MockRepoModule,
      global: true,
      providers: [{ provide: USER_PROFILE_REPOSITORY, useValue: repo }],
      exports: [USER_PROFILE_REPOSITORY],
    };
  }
}

@Module({})
class TestUseCasesProxyModule {
  static register(): DynamicModule {
    return {
      module: TestUseCasesProxyModule,
      providers: [
        {
          inject: [USER_PROFILE_REPOSITORY],
          provide: GET_USER_PROFILE_USECASES_PROXY,
          useFactory: (repo: IUserProfileRepository) =>
            new UseCaseProxy(new GetUserProfileByIdUseCase(repo)),
        },
      ],
      exports: [GET_USER_PROFILE_USECASES_PROXY],
    };
  }
}

@Module({})
class TestAppModule {
  static register(opts: TestAppOptions): DynamicModule {
    return {
      module: TestAppModule,
      imports: [
        ConfigurationModule,
        LoggerModule,
        KeycloakModule,
        // TukioAuthModule with test Keycloak config — JWKS served by nock mock.
        TukioAuthModule.forRoot({
          keycloakUrl: TEST_KEYCLOAK_URL,
          realm: TEST_REALM,
          clientId: TEST_CLIENT_ID,
          audience: TEST_CLIENT_ID,
          jwksRefreshIntervalMs: 60_000_000,
        }),
        MockRepoModule.register(opts.userProfileRepo),
        TestUseCasesProxyModule.register(),
      ],
      controllers: [HealthController, UserController],
    };
  }
}

export async function buildTestApp(
  opts: TestAppOptions,
): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(
    TestAppModule.register(opts),
    new FastifyAdapter({ logger: false }),
  );
  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
  app.useGlobalFilters(new EnvelopeExceptionFilter());
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}
