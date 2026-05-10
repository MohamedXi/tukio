import { Inject, Injectable } from '@nestjs/common';
import type { IKeycloakSync } from '../../../domain/ports/keycloak-sync.port.js';
import type { ILogger } from '../../../domain/ports/logger.port.js';
import { LOGGER } from '../../../domain/ports/tokens.js';

// Placeholder Keycloak service — Story 1.1 (Provision Keycloak realm) will replace
// this with real Keycloak Admin API calls (sync user attributes, roles, locale).
@Injectable()
export class KeycloakService implements IKeycloakSync {
  constructor(@Inject(LOGGER) private readonly logger: ILogger) {}

  async syncUserFromKeycloak(keycloakUserId: string): Promise<void> {
    this.logger.info(
      '[KeycloakService placeholder] would sync user from Keycloak',
      {
        keycloakUserId,
      },
    );
    return Promise.resolve();
  }
}
