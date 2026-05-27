import type { Role } from './actor.js';

export interface KeycloakUser {
  userId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  /** JWT claim `email_verified` — false until the user clicks the verification link (FR8/FR17). */
  emailVerified: boolean;
}

export interface AuthError {
  code: 'INIT_FAILED' | 'NETWORK' | 'CONFIG_INVALID';
  message: string;
}

/** Tukio account lifecycle status — mirrors the gateway `WhoamiResponseDto.status`. */
export type UserStatus =
  | 'active'
  | 'pending_email_verification'
  | 'pending_admin_review'
  | 'rejected'
  | 'suspended'
  | 'deleted';

export interface AuthState {
  user: KeycloakUser | null;
  role: Role | null;
  /** Story 1.4d AC4 — account status from `/v1/auth/whoami`. */
  status: UserStatus | null;
  locale: 'fr' | 'en';
  isAuthenticated: boolean;
  isLoading: boolean;
  error: AuthError | null;
}

/**
 * @deprecated Story 1.4d — the AuthProvider is now cookie/whoami-based (no
 * Keycloak.js adapter). Kept only for the legacy KeycloakClient wrapper export.
 */
export interface KeycloakConfig {
  url: string;
  realm: string;
  clientId: string;
}

/** Story 1.4d AC4 — config consumed by the cookie/whoami-based AuthProvider. */
export interface AuthProviderConfig {
  /** gateway-api origin, e.g. `https://api.tukio.one` (no trailing slash). */
  gatewayBaseUrl: string;
  /** Cookie `Domain` attribute for clearing the session marker (prod: `.tukio.one`). */
  cookieDomain?: string;
  /** Injection seam for tests. */
  fetchImpl?: typeof fetch;
}
