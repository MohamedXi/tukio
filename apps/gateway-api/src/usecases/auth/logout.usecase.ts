import { Logger } from '@nestjs/common';
import {
  buildClearCookies,
  type CookieDeployment,
} from '../../infrastructure/http/utils/cookie-helpers.js';
import { KeycloakOAuthClient } from '../../infrastructure/external/keycloak/keycloak-oauth.client.js';

export interface LogoutInput {
  refreshToken: string | undefined;
  clientId: string;
}

export interface LogoutOutput {
  clearCookies: string[];
}

export interface LogoutDependencies {
  oauthClient: KeycloakOAuthClient;
  cookieDeployment: CookieDeployment;
}

/**
 * Story 1.4b AC4 — revoke Keycloak session + clear local cookies.
 *
 * Idempotent UX: cookies are cleared even if Keycloak is unreachable or the
 * refresh token is absent. Logout MUST succeed from the user's perspective.
 */
export class LogoutUseCase {
  private readonly logger = new Logger(LogoutUseCase.name);

  constructor(private readonly deps: LogoutDependencies) {}

  async execute(input: LogoutInput): Promise<LogoutOutput> {
    if (input.refreshToken) {
      try {
        await this.deps.oauthClient.revokeSession({
          refreshToken: input.refreshToken,
          clientId: input.clientId,
        });
      } catch (err) {
        this.logger.warn(
          { err: err instanceof Error ? err.message : String(err) },
          'Keycloak revokeSession failed — clearing cookies anyway (idempotent UX)',
        );
      }
    }
    return { clearCookies: buildClearCookies(this.deps.cookieDeployment) };
  }
}
