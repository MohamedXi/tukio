import { type NextRequest, NextResponse } from 'next/server';
import { LOCALES } from '@tukio/i18n-client/config';
import { TUKIO_SESSION_MARKER_COOKIE } from '@tukio/auth-client/tokens';

// Routes that require an authenticated session. Locale-prefixed (`/fr/...`,
// `/en/...`) per next-intl `localePrefix: 'always'` (i18n-client default).
// Locale pattern derived from LOCALES (single source of truth) so adding a
// new locale to @tukio/i18n-client automatically extends the gate.
// Story Epic 1+ landing routes — gate is installed now (Story 0.14) so the
// behaviour is in place before the routes themselves are wired up.
const AUTH_GATED = new RegExp(
  `^/(${[...LOCALES].join('|')})/(account|bookings|favorites|messages)(/|$)`,
);

// Transactional paths that require email verification (FR17 — Story 1.2d).
// Matches locale-prefixed paths. Only routes where an unverified email poses a
// real risk (cart, checkout, messages) are gated; browsing/profile is not.
const EMAIL_VERIFY_REQUIRED = new RegExp(
  `^/(${[...LOCALES].join('|')})/(cart|account/bookings/checkout|account/messages)(/|$)`,
);

// The Next.js middleware cannot decode a full JWT (crypto in Edge is limited).
// A `tukio-email-verified` cookie (httpOnly=true, written server-side by
// `/api/auth/sync-email-verified` after JWT signature verification — Story 1.2d
// review patch P32) carries the boolean signal. Backend still enforces the
// real `email_verified` claim via the gateway JWT guard.
const EMAIL_VERIFIED_COOKIE = 'tukio-email-verified';

function safeLocale(pathname: string): string {
  const candidate = pathname.split('/')[1];
  return candidate && (LOCALES as readonly string[]).includes(candidate) ? candidate : 'fr';
}

export function authGateMiddleware(request: NextRequest): NextResponse | undefined {
  const pathname = request.nextUrl.pathname;
  const needsAuth = AUTH_GATED.test(pathname);
  const needsEmailVerified = EMAIL_VERIFY_REQUIRED.test(pathname);

  // 1. Session gate — applied FIRST. An unauthenticated visitor hitting a
  // transactional path (e.g. /cart) must reach login before email-verify can
  // even be evaluated; otherwise they get redirected to /auth/verify-email-required
  // while not logged in (review patch P7).
  if (needsAuth || needsEmailVerified) {
    const sessionMarker = request.cookies.get(TUKIO_SESSION_MARKER_COOKIE);
    if (sessionMarker?.value !== '1') {
      const locale = safeLocale(pathname);
      const callback = encodeURIComponent(pathname + request.nextUrl.search);
      return NextResponse.redirect(new URL(`/${locale}/login?callback=${callback}`, request.url));
    }
  }

  // 2. Email-verified gate (FR17) — block transactional paths for unverified
  // users. `next` redirect-back param is intentionally omitted here: the
  // placeholder verify-email-required page (Story 1.2d) does not yet consume
  // it, and shipping it now would invite an open-redirect bug. Story 1.6 will
  // re-introduce it with same-origin + path-allowlist validation.
  if (needsEmailVerified) {
    const emailVerified = request.cookies.get(EMAIL_VERIFIED_COOKIE);
    if (emailVerified?.value !== '1') {
      const locale = safeLocale(pathname);
      return NextResponse.redirect(new URL(`/${locale}/auth/verify-email-required`, request.url));
    }
  }

  return undefined;
}
