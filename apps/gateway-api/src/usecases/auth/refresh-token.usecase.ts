import { Logger } from '@nestjs/common';
import {
  buildSessionCookies,
  type CookieDeployment,
} from '../../infrastructure/http/utils/cookie-helpers.js';
import { KeycloakOAuthClient } from '../../infrastructure/external/keycloak/keycloak-oauth.client.js';
import { KeycloakRefreshReusedError } from '../../domain/exception/keycloak-oauth.exception.js';

export interface RefreshTokenInput {
  refreshToken: string;
  csrfToken: string;
  clientId: string;
}

export interface RefreshTokenOutput {
  sessionCookies: string[];
  expiresIn: number;
  refreshExpiresIn: number;
}

export interface RefreshTokenDependencies {
  oauthClient: KeycloakOAuthClient;
  cookieDeployment: CookieDeployment;
}

/**
 * Story 1.4b AC3 — refresh access + refresh tokens via Keycloak rotation.
 *
 * Keycloak realm policy `attributes.refresh.token.max.reuse: 0` (Story 1.1)
 * means a refresh token can be consumed exactly once. Re-use is detected by
 * Keycloak which returns `invalid_grant` with a description containing "stale"
 * — the OAuth client maps that to `KeycloakRefreshReusedError`. We log a
 * security warning (pino warn) and re-throw so the controller clears cookies.
 *
 * The existing CSRF token (read from the request cookie) is preserved across
 * the rotation — only access + refresh tokens are rotated.
 */
export class RefreshTokenUseCase {
  private readonly logger = new Logger(RefreshTokenUseCase.name);

  constructor(private readonly deps: RefreshTokenDependencies) {}

  async execute(input: RefreshTokenInput): Promise<RefreshTokenOutput> {
    try {
      const tokens = await this.deps.oauthClient.refreshTokens({
        refreshToken: input.refreshToken,
        clientId: input.clientId,
      });
      const sessionCookies = buildSessionCookies(
        {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          csrfToken: input.csrfToken,
        },
        this.deps.cookieDeployment,
      );
      return {
        sessionCookies,
        expiresIn: tokens.expiresIn,
        refreshExpiresIn: tokens.refreshExpiresIn,
      };
    } catch (err) {
      if (err instanceof KeycloakRefreshReusedError) {
        this.logger.warn(
          { err: err.message },
          'Refresh token re-use detected — possible token theft (NFR13 security alert)',
        );
      }
      throw err;
    }
  }
}
