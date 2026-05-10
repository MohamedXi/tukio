import { type DynamicModule, Module } from '@nestjs/common';
import type { IUserProfileRepository } from '../../domain/ports/user-profile.repository.port.js';
import { USER_PROFILE_REPOSITORY } from '../../domain/ports/tokens.js';
import { GetUserProfileByIdUseCase } from '../../usecases/get-user-profile.usecase.js';
import { ConfigurationModule } from '../config/config.module.js';
import { KeycloakModule } from '../external/keycloak/keycloak.module.js';
import { LoggerModule } from '../logger/logger.module.js';
import { NatsPublisherModule } from '../messaging/nats/nats-publisher.module.js';
import { TypeormRepositoriesModule } from '../persistence/typeorm/typeorm-repositories.module.js';
import { UseCaseProxy } from './usecases-proxy.js';

// Pattern Pretre — central wiring of ports → implementations.
// This is the ONLY place in the service where the domain meets the infrastructure.
// `global: true` lets AppModule register this once; controllers in HttpModule can
// inject the exported tokens without HttpModule importing this module directly.
@Module({})
export class UseCasesProxyModule {
  static GET_USER_PROFILE_USECASES_PROXY = 'GET_USER_PROFILE_USECASES_PROXY';

  static register(): DynamicModule {
    return {
      global: true,
      module: UseCasesProxyModule,
      imports: [
        ConfigurationModule,
        LoggerModule,
        TypeormRepositoriesModule,
        NatsPublisherModule,
        KeycloakModule,
      ],
      providers: [
        {
          inject: [USER_PROFILE_REPOSITORY],
          provide: UseCasesProxyModule.GET_USER_PROFILE_USECASES_PROXY,
          useFactory: (userProfileRepo: IUserProfileRepository) =>
            new UseCaseProxy(new GetUserProfileByIdUseCase(userProfileRepo)),
        },
      ],
      exports: [UseCasesProxyModule.GET_USER_PROFILE_USECASES_PROXY],
    };
  }
}
