import { createTukioI18nMiddleware } from '@tukio/i18n-client/middleware';
import type { NextRequest } from 'next/server';
import { pendingAdminReviewRedirect } from './middleware/pending-admin-review-redirect';
import { acquisitionCookieMiddleware } from './middleware/acquisition-cookie';

const i18nMiddleware = createTukioI18nMiddleware();

// Middleware chain (left = first executed):
// 1. pendingAdminReviewRedirect — bounces Pros with tukio:status=pending_admin_review
//    to /seller/onboarding/pending for all non-whitelisted /seller paths (Story 1.3d).
// 2. i18n middleware — locale routing/redirect (Story 1.3d v2).
// 3. acquisitionCookieMiddleware — sets tukio-acquisition cookie (Story 0.13).
export default async function middleware(request: NextRequest) {
  const pendingRedirect = pendingAdminReviewRedirect(request);
  if (pendingRedirect) return pendingRedirect;

  // Cast bridges Next.js 16 (app) vs @tukio/i18n-client peer (next@15) type mismatch.
  // Runtime type is compatible; the [Internal] symbol differs only in TS declarations.
  // TODO @ismael: upgrade @tukio/i18n-client peer to next@16 when all apps are on 16.
  const i18nResponse = await i18nMiddleware(
    request as unknown as Parameters<typeof i18nMiddleware>[0],
  );
  if (
    i18nResponse &&
    (i18nResponse.status !== 200 || i18nResponse.headers.has('x-middleware-rewrite'))
  ) {
    return i18nResponse;
  }

  return acquisitionCookieMiddleware(request);
}

export const config = {
  matcher: ['/((?!_next|api|.*\\.\\w{2,4}$).*)'],
};
