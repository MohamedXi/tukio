// Story 1.4d AC8 — Edge-runtime-safe JWT *decoder* (no signature verification).
//
// Next.js middlewares run on the Edge runtime where Node crypto is unavailable
// and bundle size matters. This helper decodes the access-token cookie to read
// the claims that drive redirect logic (role, status, email_verified). It does
// NOT verify the signature — that is the gateway-api / downstream services'
// job via `KeycloakJwtGuard` (JWKS, Story 0.8). A middleware decode is only a
// best-effort routing hint; the backend remains the authority.
//
// Implementation note (deviation from AC8's "jose.decodeJwt" suggestion): we
// use a dependency-free base64url decoder — the same proven pattern as
// `apps/seller` `pending-admin-review-decision.ts` — to avoid adding `jose` to
// `@tukio/auth-client`'s dependency surface. The requirement (Edge-safe
// decode-only + typed claims + throw-on-malformed) is fully met.

/** Thrown when a token is structurally invalid (not 3 segments, bad base64url, non-JSON payload). */
export class JwtMalformedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JwtMalformedError';
  }
}

/**
 * Tukio access-token claims relevant to middleware routing. Mirrors the realm
 * protocol mappers (`tukio-locale-scope`): `tukio:locale` + `tukio:status` are
 * Tukio custom claims; `realm_access`, `amr`, `email_verified` are standard.
 */
export interface TukioJwtClaims {
  sub: string;
  email: string;
  realm_access: { roles: string[] };
  'tukio:locale': 'fr' | 'en';
  'tukio:status': string;
  email_verified: boolean;
  amr: string[];
  exp: number;
  iat: number;
}

// Guard against pathological inputs — a 8 KB segment is already far larger than
// any real Keycloak access token payload.
const MAX_SEGMENT_LENGTH = 8192;

function base64UrlDecode(segment: string): string {
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  const b64 = normalized + pad;
  try {
    if (typeof atob === 'function') {
      const binary = atob(b64);
      // Re-decode as UTF-8 so accented names (`Crémant`, `Müller`) survive.
      const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    }
    // Node fallback (non-Edge contexts: unit tests under Node without `atob`).
    // Guard against Edge runtimes where `Buffer` is not available — throw a
    // typed error rather than a ReferenceError so callers can handle it.
    if (typeof Buffer === 'undefined') {
      throw new JwtMalformedError('JWT payload is not valid base64url');
    }
    return Buffer.from(b64, 'base64').toString('utf8');
  } catch (err) {
    if (err instanceof JwtMalformedError) throw err;
    throw new JwtMalformedError('JWT payload is not valid base64url');
  }
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * Decode (without verifying) a compact JWS access token into its Tukio claims.
 * Missing optional claims are normalised to safe defaults (`roles: []`,
 * `amr: []`, `tukio:locale: 'fr'`). Throws {@link JwtMalformedError} when the
 * token is structurally invalid.
 */
export function decodeJwt(token: string): TukioJwtClaims {
  if (typeof token !== 'string' || token.length === 0) {
    throw new JwtMalformedError('JWT is empty');
  }
  const segments = token.split('.');
  if (segments.length !== 3) {
    throw new JwtMalformedError(`JWT must have 3 segments, got ${segments.length}`);
  }
  const payloadSegment = segments[1];
  if (!payloadSegment || payloadSegment.length > MAX_SEGMENT_LENGTH) {
    throw new JwtMalformedError('JWT payload segment is missing or too large');
  }

  const json = base64UrlDecode(payloadSegment);
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new JwtMalformedError('JWT payload is not valid JSON');
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new JwtMalformedError('JWT payload is not an object');
  }

  const claims = parsed as Record<string, unknown>;
  const realmAccess = claims['realm_access'];
  const roles =
    typeof realmAccess === 'object' && realmAccess !== null
      ? asStringArray((realmAccess as Record<string, unknown>)['roles'])
      : [];
  const locale = asString(claims['tukio:locale']) === 'en' ? 'en' : 'fr';

  return {
    sub: asString(claims['sub']),
    email: asString(claims['email']),
    realm_access: { roles },
    'tukio:locale': locale,
    'tukio:status': asString(claims['tukio:status']),
    email_verified: claims['email_verified'] === true,
    amr: asStringArray(claims['amr']),
    exp: asNumber(claims['exp']),
    iat: asNumber(claims['iat']),
  };
}

/**
 * True when the token's `exp` claim is in the past (seconds → ms comparison).
 *
 * Edge cases:
 * - `exp: 0` is the sentinel value produced by `decodeJwt` when the token has
 *   no `exp` claim (Keycloak always includes one, but offline tokens may not).
 *   Treated as "never expires" rather than "expired in 1970" to avoid silently
 *   blocking valid tokens.
 * - Uses strict `<` (not `<=`) per RFC 7519 §4.1.4: reject only when the current
 *   time is *after* the expiry moment, not at it.
 * - This is a routing hint only; the gateway (`KeycloakJwtGuard`) is authoritative.
 */
export function isJwtExpired(
  claims: Pick<TukioJwtClaims, 'exp'>,
  nowMs: number = Date.now(),
): boolean {
  // exp: 0 → no exp claim present → treat as non-expired.
  if (!claims.exp) return false;
  return claims.exp * 1000 < nowMs;
}

/** Safe wrapper: returns decoded claims or `null` instead of throwing. */
export function tryDecodeJwt(token: string | undefined | null): TukioJwtClaims | null {
  if (!token) return null;
  try {
    return decodeJwt(token);
  } catch {
    return null;
  }
}
