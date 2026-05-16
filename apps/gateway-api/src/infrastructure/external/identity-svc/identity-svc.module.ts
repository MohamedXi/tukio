import { Module } from '@nestjs/common';
import { ConfigurationModule } from '../../config/config.module.js';
import { IDENTITY_SVC_CLIENT } from '../../../domain/ports/tokens.js';
import { IdentitySvcClient } from './identity-svc.client.js';

/**
 * Wires the identity-svc HTTP client behind its domain port symbol
 * (`IDENTITY_SVC_CLIENT`). Story 1.2c — gateway-api BFF Pretre.
 */
@Module({
  imports: [ConfigurationModule],
  providers: [
    {
      provide: IDENTITY_SVC_CLIENT,
      useClass: IdentitySvcClient,
    },
  ],
  exports: [IDENTITY_SVC_CLIENT],
})
export class IdentitySvcModule {}
