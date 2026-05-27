import { type NextRequest, NextResponse } from 'next/server';
import { ACCESS_TOKEN_COOKIE, decideAdminAccess } from './admin-access-decision';

const APEX_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://tukio.one';
const ADMIN_BASE_URL = process.env.NEXT_PUBLIC_ADMIN_BASE_URL ?? 'https://admin.tukio.one';
const ADMIN_CLIENT_ID = 'tukio-admin';

/**
 * Story 1.4d AC3 — NextResponse wrapper around {@link decideAdminAccess}.
 * Builds: cross-zone apex login (clientId=tukio-admin + absolute next),
 * cross-zone apex home for non-admins, or same-zone TOTP-setup redirect.
 */
export function adminAccessMiddleware(request: NextRequest): NextResponse | undefined {
  const decision = decideAdminAccess({
    pathname: request.nextUrl.pathname,
    accessToken: request.cookies.get(ACCESS_TOKEN_COOKIE)?.value,
    adminBaseUrl: ADMIN_BASE_URL,
  });

  switch (decision.kind) {
    case 'next':
      return undefined;
    case 'redirect-apex':
      return NextResponse.redirect(new URL(`${APEX_BASE_URL}/${decision.locale}/`));
    case 'redirect-totp':
      return NextResponse.redirect(new URL(`/${decision.locale}/auth/totp-setup`, request.url));
    case 'redirect-login': {
      const loginUrl = new URL(`${APEX_BASE_URL}/${decision.locale}/auth/login`);
      loginUrl.searchParams.set('client_id', ADMIN_CLIENT_ID);
      loginUrl.searchParams.set('next', decision.nextUrl);
      return NextResponse.redirect(loginUrl);
    }
  }
}
