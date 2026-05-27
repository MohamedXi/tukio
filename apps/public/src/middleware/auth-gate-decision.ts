// Story 1.4d AC1 — pure auth-gate decision for the apex (apps/public).
//
// No `next/server` import so it unit-tests in vitest without pulling the Edge
// runtime module into the sandbox. The NextResponse wrapper lives in
// `./auth-gate.ts`.
//
// Responsibilities:
//   1. Session gate: unauthenticated visitors on an authenticated route →
//      redirect to /{locale}/auth/login?next=…
//   2. Role cross-zone redirect: a Pro or Admin who lands in the apex
//      authenticated zone is bounced to their own zone (seller./admin.).
//   3. Email-verified gate (FR17): unverified customers on transactional
//      routes → /{locale}/auth/verify-email-required.
//
// The middleware does NOT verify the JWT signature (Edge perf + no crypto);
// it decodes the access-token cookie for routing hints only. The gateway JWT
// guard remains the authority. When the session marker is present but the
// access token is missing/expired/unreadable, we let the request through and
// rely on the api-client 401→refresh interceptor (AC9) rather than signalling
// a refresh from middleware (documented simplification of AC1's optional
// `X-Auth-Required: refresh` header).
import { LOCALES } from '@tukio/i18n-client/config';
import { tryDecodeJwt, isJwtExpired } from '@tukio/auth-client/middleware/decode-jwt';

const localeAlternation = [...LOCALES].join('|');

// Authenticated-only areas of the apex (ADR-016 unified tunnel).
const AUTH_GATED = new RegExp(
  `^/(${localeAlternation})/(account|bookings|favorites|messages)(/|$)`,
);

// Transactional paths that additionally require a verified email (FR17).
const EMAIL_VERIFY_REQUIRED = new RegExp(
  `^/(${localeAlternation})/(cart|account/bookings/checkout|account/messages)(/|$)`,
);

export type AuthGateDecision = { kind: 'next' } | { kind: 'redirect'; url: string };

export interface AuthGateInput {
  pathname: string;
  search: string;
  /** `tukio-session-active` cookie value. */
  sessionMarker: string | undefined;
  /** `tukio-access-token` cookie value (HttpOnly, decoded for routing only). */
  accessToken: string | undefined;
  /** Cross-zone base URLs, e.g. `https://seller.tukio.one`. */
  sellerBaseUrl: string;
  adminBaseUrl: string;
}

function safeLocale(pathname: string): string {
  const candidate = pathname.split('/')[1];
  return candidate && (LOCALES as readonly string[]).includes(candidate) ? candidate : 'en';
}

export function decideAuthGate(input: AuthGateInput): AuthGateDecision {
  const { pathname, search, sessionMarker, accessToken } = input;
  const needsAuth = AUTH_GATED.test(pathname);
  const needsEmailVerified = EMAIL_VERIFY_REQUIRED.test(pathname);

  if (!needsAuth && !needsEmailVerified) return { kind: 'next' };

  const locale = safeLocale(pathname);

  // 1. Session gate — applied first so an unauthenticated visitor reaches
  //    login before any email-verify evaluation (review patch P7, Story 1.2d).
  if (sessionMarker !== '1') {
    const next = encodeURIComponent(pathname + search);
    return { kind: 'redirect', url: `/${locale}/auth/login?next=${next}` };
  }

  // 2. Role cross-zone redirects — a Pro/Admin in the apex authenticated zone
  //    belongs in their own subdomain. Only trust role claims when the token is
  //    still valid; an expired token falls through to `next` so the api-client
  //    401→refresh interceptor (AC9) re-authenticates the user in-band,
  //    avoiding a double-redirect (apex → seller → apex login) on expiry.
  const claims = tryDecodeJwt(accessToken);
  const roles = !claims || isJwtExpired(claims) ? [] : claims.realm_access.roles;
  if (roles.includes('pro')) {
    return { kind: 'redirect', url: `${input.sellerBaseUrl}/${locale}/seller/dashboard` };
  }
  if (roles.some((r) => r.startsWith('admin-'))) {
    return { kind: 'redirect', url: `${input.adminBaseUrl}/${locale}/admin/dashboard` };
  }

  // 3. Email-verified gate (FR17) — block transactional paths for unverified
  //    customers. `next` is intentionally omitted (the verify-email-required
  //    page does not consume it yet; Story 1.6 adds validated redirect-back).
  if (needsEmailVerified && !(claims?.email_verified ?? false)) {
    return { kind: 'redirect', url: `/${locale}/auth/verify-email-required` };
  }

  return { kind: 'next' };
}
