import { Module } from '@nestjs/common';
import { KEYCLOAK_ADMIN } from '../../../domain/ports/tokens.js';
import { ConfigurationModule } from '../../config/config.module.js';
import { LoggerModule } from '../../logger/logger.module.js';
import { KeycloakAdminService } from './keycloak-admin.service.js';

/**
 * Pretre wiring for the Keycloak Admin API port (Story 1.2b).
 * The KeycloakAdminService is exported via the `KEYCLOAK_ADMIN` Symbol token
 * so use cases inject the port interface, never the concrete service.
 */
@Module({
  imports: [ConfigurationModule, LoggerModule],
  providers: [
    {
      provide: KEYCLOAK_ADMIN,
      useClass: KeycloakAdminService,
    },
  ],
  exports: [KEYCLOAK_ADMIN],
})
export class KeycloakAdminModule {}
