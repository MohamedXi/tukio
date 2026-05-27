import { type NextRequest, NextResponse } from 'next/server';
import {
  TUKIO_SESSION_MARKER_COOKIE,
  TUKIO_ACCESS_TOKEN_COOKIE_NAME,
} from '@tukio/auth-client/tokens';
import { decideAuthGate } from './auth-gate-decision';

const SELLER_BASE_URL = process.env.NEXT_PUBLIC_SELLER_BASE_URL ?? 'https://seller.tukio.one';
const ADMIN_BASE_URL = process.env.NEXT_PUBLIC_ADMIN_BASE_URL ?? 'https://admin.tukio.one';

/**
 * Story 1.4d AC1 — thin NextResponse wrapper around the pure
 * {@link decideAuthGate} decision. Reads the session marker + access-token
 * cookies, delegates the decision, and translates a `redirect` result into a
 * `NextResponse.redirect`. Returns `undefined` to let the chain continue.
 */
export function authGateMiddleware(request: NextRequest): NextResponse | undefined {
  const decision = decideAuthGate({
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    sessionMarker: request.cookies.get(TUKIO_SESSION_MARKER_COOKIE)?.value,
    accessToken: request.cookies.get(TUKIO_ACCESS_TOKEN_COOKIE_NAME)?.value,
    sellerBaseUrl: SELLER_BASE_URL,
    adminBaseUrl: ADMIN_BASE_URL,
  });

  if (decision.kind === 'next') return undefined;
  // `new URL(url, base)` returns `url` verbatim when it is already absolute
  // (cross-zone redirects) and resolves it against the request origin otherwise.
  return NextResponse.redirect(new URL(decision.url, request.url));
}
