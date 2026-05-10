import { type DynamicModule, Module, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
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

// RSA key pair generated synchronously (CJS compatible — no jose dependency in E2E tests).
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

function pemToJwk(pemPublicKey: string): Record<string, unknown> {
  const keyObj = crypto.createPublicKey(pemPublicKey);
  const jwk = keyObj.export({ format: 'jwk' }) as Record<string, unknown>;
  return { ...jwk, kid: TEST_KID, use: 'sig', alg: 'RS256' };
}

export function generateTestJwt(
  overrides: {
    sub?: string;
    roles?: string[];
    exp?: number;
    amr?: string[];
  } = {},
): string {
  return jwt.sign(
    {
      sub: overrides.sub ?? 'test-user-uuid',
      email: 'test@tukio.one',
      email_verified: true,
      realm_access: { roles: overrides.roles ?? ['client'] },
      amr: overrides.amr ?? [],
      locale: 'fr',
    },
    privateKey,
    {
      algorithm: 'RS256',
      keyid: TEST_KID,
      issuer: `${TEST_KEYCLOAK_URL}/realms/${TEST_REALM}`,
      audience: TEST_CLIENT_ID,
      expiresIn: overrides.exp
        ? overrides.exp - Math.floor(Date.now() / 1000)
        : 3600,
    },
  );
}

export function setupJwksMock(): void {
  const jwk = pemToJwk(publicKey);
  nock(TEST_KEYCLOAK_URL)
    .get(JWKS_PATH)
    .reply(200, { keys: [jwk] })
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
