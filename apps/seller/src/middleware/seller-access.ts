import { type NextRequest, NextResponse } from 'next/server';
import { ACCESS_TOKEN_COOKIE, decideSellerAccess } from './seller-access-decision';

const APEX_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://tukio.one';
const SELLER_BASE_URL = process.env.NEXT_PUBLIC_SELLER_BASE_URL ?? 'https://seller.tukio.one';

function localeOf(pathname: string): string {
  const seg = pathname.split('/')[1];
  return seg && /^[a-z]{2}$/.test(seg) ? seg : 'en';
}

/**
 * Story 1.4d AC2 — NextResponse wrapper around {@link decideSellerAccess}.
 * Translates the decision into same-zone redirects (pending / rejected) or a
 * cross-zone redirect to the apex login carrying an absolute `next` back to the
 * originally requested seller URL.
 */
export function sellerAccessMiddleware(request: NextRequest): NextResponse | undefined {
  const decision = decideSellerAccess({
    pathname: request.nextUrl.pathname,
    accessToken: request.cookies.get(ACCESS_TOKEN_COOKIE)?.value,
    sellerBaseUrl: SELLER_BASE_URL,
  });

  if (decision.kind === 'next') return undefined;

  if (decision.kind === 'redirect-internal') {
    return NextResponse.redirect(new URL(decision.path, request.url));
  }

  // cross-zone login at the apex, with next=<absolute seller URL>
  const locale = localeOf(request.nextUrl.pathname);
  const loginUrl = new URL(`${APEX_BASE_URL}/${locale}/auth/login`);
  loginUrl.searchParams.set('next', decision.nextUrl);
  return NextResponse.redirect(loginUrl);
}
