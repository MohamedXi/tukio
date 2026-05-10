import { type DynamicModule, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ConfigurationModule } from '../../src/infrastructure/config/config.module.js';
import { LoggerModule } from '../../src/infrastructure/logger/logger.module.js';
import { KeycloakModule } from '../../src/infrastructure/external/keycloak/keycloak.module.js';
import { HealthController } from '../../src/infrastructure/http/controllers/health.controller.js';
import { UserController } from '../../src/infrastructure/http/controllers/user.controller.js';
import { EnvelopeExceptionFilter } from '../../src/infrastructure/http/filters/envelope-exception.filter.js';
import { ResponseEnvelopeInterceptor } from '../../src/infrastructure/http/interceptors/response-envelope.interceptor.js';
// Import only the generic UseCaseProxy class — not UseCasesProxyModule (which transitively loads
// NatsPublisherModule → @tukio/messaging ESM, incompatible with ts-jest CJS transform).
import { UseCaseProxy } from '../../src/infrastructure/usecases-proxy/usecases-proxy.js';
import { GetUserProfileByIdUseCase } from '../../src/usecases/get-user-profile.usecase.js';
import type { IUserProfileRepository } from '../../src/domain/ports/user-profile.repository.port.js';
import { USER_PROFILE_REPOSITORY } from '../../src/domain/ports/tokens.js';

// String constant from UseCasesProxyModule — inlined to avoid loading the module at test time.
const GET_USER_PROFILE_USECASES_PROXY = 'GET_USER_PROFILE_USECASES_PROXY';

// E2E test module — mirrors AppModule but without TypeORM (no Postgres needed)
// and lets specs override USER_PROFILE_REPOSITORY at construction time.
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
        // NatsPublisherModule excluded — E2E tests do not emit events.
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
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}
