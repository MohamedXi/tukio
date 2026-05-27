import { createTukioI18nMiddleware } from '@tukio/i18n-client/middleware';
import type { NextRequest } from 'next/server';
import { sellerAccessMiddleware } from './middleware/seller-access';
import { acquisitionCookieMiddleware } from './middleware/acquisition-cookie';
import { comingSoonGateMiddleware } from './middleware/coming-soon-gate';

const i18nMiddleware = createTukioI18nMiddleware();

// Middleware chain (left = first executed):
// 0. comingSoonGateMiddleware — rewrites non-whitelisted routes to
//    /${locale}/seller-coming-soon when NEXT_PUBLIC_COMING_SOON_MODE=true
//    (Story 0.15). When the flag is off, this is a no-op.
// 1. sellerAccessMiddleware — full tukio:status enforcement (Story 1.4d AC2):
//    missing/expired JWT → cross-zone apex login; pending_admin_review →
//    onboarding/profile/messaging whitelist else /seller/onboarding/pending;
//    rejected → /seller/onboarding/rejected; active → no-op.
// 2. i18n middleware — locale routing/redirect (Story 1.3d v2).
//    Always returned when defined: carries x-next-intl-locale header that the App
//    Router needs to resolve the [locale] dynamic segment. Without this the router
//    can't fill [locale] and returns 404 on all locale-prefixed routes.
// 3. acquisitionCookieMiddleware — sets tukio-acquisition cookie (Story 0.13).
export default async function middleware(request: NextRequest) {
  const comingSoonResponse = comingSoonGateMiddleware(request);
  if (comingSoonResponse) return comingSoonResponse;

  const accessRedirect = sellerAccessMiddleware(request);
  if (accessRedirect) return accessRedirect;

  // Cast bridges Next.js 16 (app) vs @tukio/i18n-client peer (next@15) type mismatch.
  // Runtime type is compatible; the [Internal] symbol differs only in TS declarations.
  // TODO @ismael: upgrade @tukio/i18n-client peer to next@16 when all apps are on 16.
  const i18nResponse = await i18nMiddleware(
    request as unknown as Parameters<typeof i18nMiddleware>[0],
  );
  if (i18nResponse) return i18nResponse;

  return acquisitionCookieMiddleware(request);
}

// Unbounded extension length on purpose: a `\w{2,4}` cap let `/fonts/*.woff2`
// (5-char extension) through to the middleware, breaking the OG route's
// same-origin font fetch. The `$` anchor keeps mid-path dots (e.g. `/v1.0/x`)
// routed as pages.
export const config = {
  matcher: ['/((?!_next|api|.*\\.\\w+$).*)'],
};
