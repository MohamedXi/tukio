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
  tukioStatus?:
    | 'active'
    | 'pending_email_verification'
    | 'pending_admin_review'
    | 'rejected';
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
      case 'active':
      default:
        return `${zones.seller}/${locale}/seller/dashboard`;
    }
  }
  return `${zones.public}/${locale}/account/dashboard`;
}

/**
 * Whitelist a `?next=` redirect target. Allows only canonical Tukio hostnames
 * (`*.tukio.one`) or localhost (dev). Returns `null` for anything else
 * (open-redirect / XSS / data-URI / malformed input). Per OWASP — never trust
 * `next` blindly; always parse and validate the hostname.
 */
export function sanitizeNextUrl(
  next: string | null | undefined,
): string | null {
  if (typeof next !== 'string' || next.length === 0) return null;
  let parsed: URL;
  try {
    parsed = new URL(next);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return null;
  }
  const hostname = parsed.hostname.toLowerCase();
  if (hostname === 'tukio.one' || hostname.endsWith(ALLOWED_HOSTNAME_SUFFIX)) {
    return parsed.toString();
  }
  if (ALLOWED_LOCALHOST_HOSTNAMES.has(hostname)) {
    return parsed.toString();
  }
  return null;
}

export function resolvePostLoginRedirect(input: {
  claims: DecodedJwtClaims;
  locale: Locale;
  next: string | null | undefined;
  zones: ZoneBaseUrls;
}): string {
  const sanitized = sanitizeNextUrl(input.next);
  if (sanitized) return sanitized;
  return defaultRedirect(input.claims, input.locale, input.zones);
}
