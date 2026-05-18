import { Module } from '@nestjs/common';
import { ConfigurationModule } from '../../config/config.module.js';
import { EnvironmentConfigService } from '../../config/environment-config.service.js';
import { KEYCLOAK_OAUTH_CLIENT } from '../../../domain/ports/tokens.js';
import { KeycloakOAuthClient } from './keycloak-oauth.client.js';

/**
 * Story 1.4b — provides the `KeycloakOAuthClient` (axios + retry) singleton
 * via the `KEYCLOAK_OAUTH_CLIENT` token consumed by the login use cases.
 *
 * `publicBaseUrl` resolves to `ZONE_BASE_URL_PUBLIC` so the OAuth callback
 * URI (`<publicBaseUrl>/<locale>/auth/callback`) targets the customer apex.
 */
@Module({
  imports: [ConfigurationModule],
  providers: [
    {
      provide: KEYCLOAK_OAUTH_CLIENT,
      inject: [EnvironmentConfigService],
      useFactory: (config: EnvironmentConfigService): KeycloakOAuthClient => {
        const kc = config.getKeycloakConfig();
        const zones = config.getZoneBaseUrls();
        return new KeycloakOAuthClient({
          url: kc.url,
          realm: kc.realm,
          publicBaseUrl: zones.public,
        });
      },
    },
  ],
  exports: [KEYCLOAK_OAUTH_CLIENT],
})
export class KeycloakOAuthModule {}
