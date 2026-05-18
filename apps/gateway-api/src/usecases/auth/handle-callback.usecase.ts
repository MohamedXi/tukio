import { randomBytes } from 'node:crypto';
import { decodeJwt } from 'jose';
import { Logger } from '@nestjs/common';
import type { Locale } from '@tukio/contracts';
import type {
  UserLoggedInRole,
  UserLoggedInV1Payload,
} from '@tukio/contracts/events/identity/user-logged-in.v1';
import { AuthInvalidStateException } from '../../domain/exception/auth-invalid-state.exception.js';
import type { ILoginAuditEventPublisher } from '../../domain/ports/login-audit-event-publisher.port.js';
import { decodeState } from '../../infrastructure/http/utils/state-jwt.js';
import {
  COOKIE_NAMES,
  buildSessionCookies,
  readPkceStateCookie,
  type CookieDeployment,
} from '../../infrastructure/http/utils/cookie-helpers.js';
import {
  resolvePostLoginRedirect,
  type DecodedJwtClaims,
  type ZoneBaseUrls,
} from '../../infrastructure/http/utils/redirect-resolver.js';
import { KeycloakOAuthClient } from '../../infrastructure/external/keycloak/keycloak-oauth.client.js';

const KNOWN_ROLES: readonly UserLoggedInRole[] = [
  'client',
  'pro',
  'admin-support',
  'admin-modo',
  'admin-super',
];

export interface HandleCallbackInput {
  code: string;
  state: string;
  locale: Locale;
  pkceCookie: string | undefined;
  ipHash: string;
  userAgentHash: string;
}

export interface HandleCallbackOutput {
  redirectUrl: string;
  sessionCookies: string[];
  clearPkceCookie: string;
}

export interface HandleCallbackDependencies {
  oauthClient: KeycloakOAuthClient;
  auditPublisher: ILoginAuditEventPublisher;
  stateJwtSecret: string;
  pkceCookieSecret: string;
  cookieDeployment: CookieDeployment;
  zoneBaseUrls: ZoneBaseUrls;
  isDev: boolean;
}

/**
 * Story 1.4b AC2 — second leg of the OAuth Authorization Code + PKCE flow.
 *
 * 1. Decrypt the pkce-state cookie → extract verifier + originalState.
 * 2. Decode the inbound `state` JWT and assert it matches originalState (anti
 *    state-fixation). TTL is validated inside `decodeState` (10 min hard).
 * 3. Exchange code for tokens at Keycloak using the verifier.
 * 4. Decode the access token (no signature check here — KeycloakJwtGuard does
 *    that on subsequent calls) to extract roles + tukio status for the
 *    post-login redirect.
 * 5. Build the 4 session cookies (access HttpOnly + refresh HttpOnly+Strict +
 *    session-active JS-readable + csrf JS-readable+Strict).
 * 6. Fire-and-forget audit event `identity.user.logged-in.v1` — failure to
 *    publish does NOT fail the HTTP response (callback must succeed).
 */
export class HandleCallbackUseCase {
  private readonly logger = new Logger(HandleCallbackUseCase.name);

  constructor(private readonly deps: HandleCallbackDependencies) {}

  async execute(input: HandleCallbackInput): Promise<HandleCallbackOutput> {
    if (!input.pkceCookie || input.pkceCookie.length === 0) {
      throw new AuthInvalidStateException('pkce-state cookie missing');
    }

    const { verifier, originalState, clientId } = await readPkceStateCookie(
      input.pkceCookie,
      this.deps.pkceCookieSecret,
    );

    if (originalState !== input.state) {
      throw new AuthInvalidStateException(
        'state JWT does not match pkce cookie',
      );
    }

    const statePayload = await decodeState(
      input.state,
      this.deps.stateJwtSecret,
    );

    const tokens = await this.deps.oauthClient.exchangeCodeForTokens({
      code: input.code,
      verifier,
      locale: input.locale,
      clientId,
    });

    const claims = extractJwtClaims(tokens.accessToken);
    const redirectUrl = resolvePostLoginRedirect({
      claims,
      locale: input.locale,
      next: statePayload.next,
      zones: this.deps.zoneBaseUrls,
      isDev: this.deps.isDev,
    });

    const csrfToken = randomBytes(32).toString('base64url');
    const sessionCookies = buildSessionCookies(
      {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        csrfToken,
      },
      this.deps.cookieDeployment,
    );

    const clearPkceCookie = buildClearPkceStateCookie(
      this.deps.cookieDeployment,
    );

    this.fireLoggedInEvent(claims, input);
    void statePayload.requestId; // reserved for D1 nonce store (Story 1.4b deferred)

    return { redirectUrl, sessionCookies, clearPkceCookie };
  }

  private fireLoggedInEvent(
    claims: DecodedJwtClaims & { sub: string; locale: Locale },
    input: HandleCallbackInput,
  ): void {
    const payload: UserLoggedInV1Payload = {
      userId: claims.sub,
      locale: claims.locale,
      role: filterKnownRoles(claims.realmAccess.roles),
      ipHash: input.ipHash,
      userAgentHash: input.userAgentHash,
      loggedInAt: new Date().toISOString(),
    };
    void this.deps.auditPublisher
      .publishLoggedIn(payload)
      .catch((err: unknown) => {
        this.logger.warn(
          { err: errMessage(err), userId: payload.userId },
          'user-logged-in.v1 audit event publish failed (non-fatal)',
        );
      });
  }
}

function filterKnownRoles(roles: string[]): UserLoggedInRole[] {
  const filtered = roles.filter((r): r is UserLoggedInRole =>
    (KNOWN_ROLES as readonly string[]).includes(r),
  );
  return filtered.length > 0 ? filtered : ['client'];
}

function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

interface KeycloakAccessTokenClaims {
  sub?: string;
  realm_access?: { roles?: unknown };
  'tukio:locale'?: unknown;
  'tukio:status'?: unknown;
  amr?: unknown;
}

function extractJwtClaims(
  accessToken: string,
): DecodedJwtClaims & { sub: string; locale: Locale } {
  let raw: KeycloakAccessTokenClaims;
  try {
    raw = decodeJwt(accessToken);
  } catch {
    throw new AuthInvalidStateException('Access token claims unparseable');
  }
  if (typeof raw.sub !== 'string' || raw.sub.length === 0) {
    throw new AuthInvalidStateException('Access token missing sub claim');
  }
  const rolesRaw = (raw.realm_access?.roles ?? []) as unknown;
  const roles = Array.isArray(rolesRaw)
    ? rolesRaw.filter((r): r is string => typeof r === 'string')
    : [];
  const localeClaim = raw['tukio:locale'];
  const locale: Locale = localeClaim === 'en' ? 'en' : 'fr';
  const status = raw['tukio:status'];
  const amrRaw = raw.amr;
  const amr = Array.isArray(amrRaw)
    ? amrRaw.filter((v): v is string => typeof v === 'string')
    : undefined;

  return {
    sub: raw.sub,
    locale,
    realmAccess: { roles },
    ...(typeof status === 'string'
      ? { tukioStatus: status as DecodedJwtClaims['tukioStatus'] }
      : {}),
    ...(amr ? { amr } : {}),
  };
}

function buildClearPkceStateCookie(deployment: CookieDeployment): string {
  // P4 review patch: use COOKIE_NAMES.PKCE_STATE constant so a rename propagates here.
  const parts: string[] = [
    `${COOKIE_NAMES.PKCE_STATE}=`,
    'Path=/',
    'Max-Age=0',
    'SameSite=Lax',
    'HttpOnly',
  ];
  if (deployment.secure) parts.push('Secure');
  if (deployment.domain) parts.push(`Domain=${deployment.domain}`);
  return parts.join('; ');
}
