import type { NextRequest } from 'next/server';
import { createTukioI18nMiddleware } from '@tukio/i18n-client/middleware';
import { adminAccessMiddleware } from './middleware/admin-access';
import { acquisitionCookieMiddleware } from './middleware/acquisition-cookie';

const i18nMiddleware = createTukioI18nMiddleware();

// Middleware chain (left = first executed):
// 1. adminAccessMiddleware — Story 1.4d AC3: requires an `admin-*` realm role +
//    `totp` in amr on /{locale}/admin/*. Missing/expired JWT → cross-zone apex
//    login (clientId=tukio-admin); non-admin → apex home; admin sans TOTP →
//    /{locale}/auth/totp-setup (Story 1.7).
// 2. i18n middleware — locale routing/redirect (Story 1.4c).
// 3. acquisitionCookieMiddleware — sets tukio-acquisition cookie (Story 0.13).
export default async function middleware(request: NextRequest) {
  const accessRedirect = adminAccessMiddleware(request);
  if (accessRedirect) return accessRedirect;

  const i18nResponse = await i18nMiddleware(
    request as unknown as Parameters<typeof i18nMiddleware>[0],
  );
  if (i18nResponse) return i18nResponse;

  return acquisitionCookieMiddleware(request);
}

export const config = {
  // `\w+` (unbounded) is intentional: `\w{2,4}` silently let 5-char extensions
  // like `.woff2` through. An unbounded `\w+` correctly excludes all static
  // asset extensions. Aligned with the public app's matcher (Story 1.4d).
  matcher: ['/((?!_next|api|.*\\.\\w+$).*)'],
};
