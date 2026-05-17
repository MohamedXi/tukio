import { type DynamicModule, Module } from '@nestjs/common';
import type { IConfigService } from '../../domain/ports/config.port.js';
import type { IKeycloakAdmin } from '../../domain/ports/keycloak-admin.port.js';
import type { ILogger } from '../../domain/ports/logger.port.js';
import type { IUserProfileRepository } from '../../domain/ports/user-profile.repository.port.js';
import type { IProProfileRepository } from '../../domain/ports/pro-profile.repository.port.js';
import type { IInseeSiretValidator } from '../../domain/ports/insee-siret-validator.port.js';
import type { IMediaStorage } from '../../domain/ports/media-storage.port.js';
import {
  CONFIG_SERVICE,
  INSEE_SIRET_VALIDATOR,
  KEYCLOAK_ADMIN,
  LOGGER,
  MEDIA_STORAGE,
  PRO_PROFILE_REPOSITORY,
  USER_PROFILE_REPOSITORY,
} from '../../domain/ports/tokens.js';
import { GetUserProfileByIdUseCase } from '../../usecases/get-user-profile.usecase.js';
import { RegisterCustomerUseCase } from '../../usecases/register-customer.usecase.js';
import { ConvertCustomerToProUseCase } from '../../usecases/convert-customer-to-pro.usecase.js';
import { ConfigurationModule } from '../config/config.module.js';
import { KeycloakAdminModule } from '../external/keycloak/keycloak-admin.module.js';
import { KeycloakModule } from '../external/keycloak/keycloak.module.js';
import { InseeModule } from '../external/insee/insee.module.js';
import { R2Module } from '../external/r2/r2.module.js';
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
  static REGISTER_CUSTOMER_USECASES_PROXY = 'REGISTER_CUSTOMER_USECASES_PROXY';
  static CONVERT_CUSTOMER_TO_PRO_USECASES_PROXY =
    'CONVERT_CUSTOMER_TO_PRO_USECASES_PROXY';

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
        KeycloakAdminModule,
        InseeModule,
        R2Module,
      ],
      providers: [
        {
          inject: [USER_PROFILE_REPOSITORY],
          provide: UseCasesProxyModule.GET_USER_PROFILE_USECASES_PROXY,
          useFactory: (userProfileRepo: IUserProfileRepository) =>
            new UseCaseProxy(new GetUserProfileByIdUseCase(userProfileRepo)),
        },
        {
          inject: [
            USER_PROFILE_REPOSITORY,
            KEYCLOAK_ADMIN,
            LOGGER,
            CONFIG_SERVICE,
          ],
          provide: UseCasesProxyModule.REGISTER_CUSTOMER_USECASES_PROXY,
          useFactory: (
            userProfileRepo: IUserProfileRepository,
            keycloakAdmin: IKeycloakAdmin,
            logger: ILogger,
            config: IConfigService,
          ) =>
            new UseCaseProxy(
              new RegisterCustomerUseCase(
                userProfileRepo,
                keycloakAdmin,
                logger,
                config.getPublicBaseUrl(),
              ),
            ),
        },
        {
          inject: [
            USER_PROFILE_REPOSITORY,
            PRO_PROFILE_REPOSITORY,
            KEYCLOAK_ADMIN,
            INSEE_SIRET_VALIDATOR,
            MEDIA_STORAGE,
            LOGGER,
            CONFIG_SERVICE,
          ],
          provide: UseCasesProxyModule.CONVERT_CUSTOMER_TO_PRO_USECASES_PROXY,
          useFactory: (
            userProfileRepo: IUserProfileRepository,
            proProfileRepo: IProProfileRepository,
            keycloakAdmin: IKeycloakAdmin,
            inseeValidator: IInseeSiretValidator,
            mediaStorage: IMediaStorage,
            logger: ILogger,
            config: IConfigService,
          ) =>
            new UseCaseProxy(
              new ConvertCustomerToProUseCase(
                userProfileRepo,
                proProfileRepo,
                keycloakAdmin,
                inseeValidator,
                mediaStorage,
                logger,
                config.getR2KycBucket(),
              ),
            ),
        },
      ],
      exports: [
        UseCasesProxyModule.GET_USER_PROFILE_USECASES_PROXY,
        UseCasesProxyModule.REGISTER_CUSTOMER_USECASES_PROXY,
        UseCasesProxyModule.CONVERT_CUSTOMER_TO_PRO_USECASES_PROXY,
      ],
    };
  }
}
