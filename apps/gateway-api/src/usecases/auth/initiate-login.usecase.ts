import { randomUUID } from 'node:crypto';
import type { Locale } from '@tukio/contracts';
import { generatePkceMaterials } from '../../infrastructure/http/utils/pkce.js';
import { encodeState } from '../../infrastructure/http/utils/state-jwt.js';
import {
  buildPkceStateCookie,
  type CookieDeployment,
} from '../../infrastructure/http/utils/cookie-helpers.js';
import { sanitizeNextUrl } from '../../infrastructure/http/utils/redirect-resolver.js';
import { KeycloakOAuthClient } from '../../infrastructure/external/keycloak/keycloak-oauth.client.js';

export interface InitiateLoginInput {
  next: string | null | undefined;
  clientId: string;
  locale: Locale;
}

export interface InitiateLoginOutput {
  redirectUrl: string;
  pkceCookie: string;
}

export interface InitiateLoginDependencies {
  oauthClient: KeycloakOAuthClient;
  stateJwtSecret: string;
  pkceCookieSecret: string;
  cookieDeployment: CookieDeployment;
  isDev: boolean;
}

/**
 * Story 1.4b AC1 — first leg of the OAuth Authorization Code + PKCE flow.
 *
 * 1. Generate a fresh PKCE verifier/challenge pair (32 bytes random).
 * 2. Encode a state JWT carrying the sanitized `next` URL + a fresh requestId.
 * 3. Wrap the verifier + originalState in an encrypted (JWE A256GCM)
 *    `tukio-pkce-state` cookie — HttpOnly so the browser can't read it.
 * 4. Ask `KeycloakOAuthClient` for the realm's `/auth` URL with the challenge
 *    + state propagated.
 */
export class InitiateLoginUseCase {
  constructor(private readonly deps: InitiateLoginDependencies) {}

  async execute(input: InitiateLoginInput): Promise<InitiateLoginOutput> {
    const sanitizedNext = sanitizeNextUrl(input.next, this.deps.isDev);
    const { verifier, challenge } = generatePkceMaterials();

    const state = await encodeState(
      {
        next: sanitizedNext,
        requestId: randomUUID(),
        issuedAt: new Date().toISOString(),
      },
      this.deps.stateJwtSecret,
    );

    const pkceCookie = await buildPkceStateCookie(
      { verifier, originalState: state, clientId: input.clientId },
      this.deps.pkceCookieSecret,
      this.deps.cookieDeployment,
    );

    const redirectUrl = this.deps.oauthClient.buildAuthorizeUrl({
      clientId: input.clientId,
      locale: input.locale,
      challenge,
      state,
    });

    return { redirectUrl, pkceCookie };
  }
}
