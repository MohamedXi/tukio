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

export function authGateMiddleware(request: NextRequest): NextResponse | undefined {
  if (!AUTH_GATED.test(request.nextUrl.pathname)) {
    return undefined;
  }

  const sessionMarker = request.cookies.get(TUKIO_SESSION_MARKER_COOKIE);
  if (sessionMarker?.value === '1') {
    return undefined;
  }

  // Locale segment is the second path part (matcher above guarantees it).
  const locale = request.nextUrl.pathname.split('/')[1] ?? 'fr';
  const callback = encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(new URL(`/${locale}/login?callback=${callback}`, request.url));
}
