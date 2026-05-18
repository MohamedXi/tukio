import type { Locale } from '@tukio/contracts';

export interface ZoneBaseUrls {
  public: string;
  seller: string;
  admin: string;
}

/**
 * Subset of decoded Keycloak ID/access token claims used by the
 * post-login redirect logic. Matches the realm/client claim mappers configured
 * in Story 1.1 (`realm_access.roles` + custom `tukio:status` + `amr`).
 */
export interface DecodedJwtClaims {
  realmAccess: { roles: string[] };
  // P9: full domain status union — suspended/deleted should be blocked at
  // Keycloak account level but are modelled here for defensive completeness.
  tukioStatus?:
    | 'active'
    | 'pending_email_verification'
    | 'pending_admin_review'
    | 'rejected'
    | 'suspended'
    | 'deleted';
  amr?: string[];
}

const ADMIN_ROLE_PREFIX = 'admin-';
const ALLOWED_HOSTNAME_SUFFIX = '.tukio.one';
const ALLOWED_LOCALHOST_HOSTNAMES = new Set(['localhost', '127.0.0.1']);

function hasAdminRole(claims: DecodedJwtClaims): boolean {
  return claims.realmAccess.roles.some((r) => r.startsWith(ADMIN_ROLE_PREFIX));
}

function hasRole(claims: DecodedJwtClaims, role: string): boolean {
  return claims.realmAccess.roles.includes(role);
}

function hasTotp(claims: DecodedJwtClaims): boolean {
  return Array.isArray(claims.amr) && claims.amr.includes('totp');
}

function defaultRedirect(
  claims: DecodedJwtClaims,
  locale: Locale,
  zones: ZoneBaseUrls,
): string {
  if (hasAdminRole(claims)) {
    return hasTotp(claims)
      ? `${zones.admin}/${locale}/admin/dashboard`
      : `${zones.admin}/${locale}/auth/totp-setup`;
  }
  if (hasRole(claims, 'pro')) {
    switch (claims.tukioStatus) {
      case 'pending_admin_review':
        return `${zones.seller}/${locale}/seller/onboarding/pending`;
      case 'rejected':
        return `${zones.seller}/${locale}/seller/onboarding/rejected`;
      // P9: suspended/deleted accounts should be blocked at KC, but redirect
      // to a generic error page if a token somehow arrives for these states.
      case 'suspended':
      case 'deleted':
        return `${zones.public}/${locale}/auth/login?error=account_suspended`;
      case 'active':
      default:
        return `${zones.seller}/${locale}/seller/dashboard`;
    }
  }
  return `${zones.public}/${locale}/account/dashboard`;
}

/**
 * Whitelist a `?next=` redirect target. Accepts:
 * - `https://` URLs on `tukio.one` or `*.tukio.one` (production-safe)
 * - `http://` or `https://` on `localhost`/`127.0.0.1` when `isDev = true`
 *
 * Returns `null` for open-redirect / XSS / data: URIs / plain `http://` on
 * production hosts. Always parse and validate the hostname — never trust `next`
 * blindly (OWASP A10).
 *
 * P2: http:// rejected for non-localhost hosts (HTTPS-only in production).
 * P3: localhost only allowed when `isDev = true` (prevents internal-service
 *     redirect in containerised production environments).
 */
export function sanitizeNextUrl(
  next: string | null | undefined,
  isDev = false,
): string | null {
  if (typeof next !== 'string' || next.length === 0) return null;
  let parsed: URL;
  try {
    parsed = new URL(next);
  } catch {
    return null;
  }

  const hostname = parsed.hostname.toLowerCase();

  // Localhost — only permitted in dev/test environments
  if (ALLOWED_LOCALHOST_HOSTNAMES.has(hostname)) {
    return isDev ? parsed.toString() : null;
  }

  // Tukio.one domains — must use HTTPS (P2: http:// downgrade rejected)
  if (hostname === 'tukio.one' || hostname.endsWith(ALLOWED_HOSTNAME_SUFFIX)) {
    return parsed.protocol === 'https:' ? parsed.toString() : null;
  }

  // Everything else (external domains, javascript:, data:, etc.) — rejected
  return null;
}

export function resolvePostLoginRedirect(input: {
  claims: DecodedJwtClaims;
  locale: Locale;
  next: string | null | undefined;
  zones: ZoneBaseUrls;
  isDev?: boolean;
}): string {
  const sanitized = sanitizeNextUrl(input.next, input.isDev ?? false);
  if (sanitized) return sanitized;
  return defaultRedirect(input.claims, input.locale, input.zones);
}
