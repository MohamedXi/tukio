import { Module } from '@nestjs/common';
import { KEYCLOAK_SYNC } from '../../../domain/ports/tokens.js';
import { LoggerModule } from '../../logger/logger.module.js';
import { KeycloakService } from './keycloak.service.js';

@Module({
  imports: [LoggerModule],
  providers: [
    {
      provide: KEYCLOAK_SYNC,
      useClass: KeycloakService,
    },
  ],
  exports: [KEYCLOAK_SYNC],
})
export class KeycloakModule {}
