import { createTukioI18nMiddleware } from '@tukio/i18n-client/middleware';
import type { NextRequest } from 'next/server';
import { acquisitionCookieMiddleware } from './middleware/acquisition-cookie.js';

const i18nMiddleware = createTukioI18nMiddleware();

// Middleware chain (left = first executed):
// 1. acquisitionCookieMiddleware — sets tukio-acquisition cookie from UTM params (Story 0.13)
// 2. i18n middleware — locale routing/redirect
// Compose with createKeycloakAuthMiddleware (Story 0.8) in Story Epic 1+.
export default async function middleware(request: NextRequest) {
  // Step 1: evaluate acquisition cookie (always runs, never blocks routing).
  const acqResponse = acquisitionCookieMiddleware(request);

  // Step 2: run i18n middleware (may redirect to locale-prefixed URL).
  // Cast bridges Next.js 15 (i18n-client peer) vs 16 (app) NextRequest mismatch.
  // Runtime type is compatible; the [Internal] symbol differs only in TS type declarations.
  // Track: upgrade @tukio/i18n-client peer to next@16 when all apps are on 16.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const i18nResponse = await i18nMiddleware(request as any);
  if (i18nResponse) {
    // Transfer any acquisition cookie mutations to the i18n response.
    acqResponse.cookies.getAll().forEach((cookie) => i18nResponse.cookies.set(cookie));
    return i18nResponse;
  }

  return acqResponse;
}

// Matcher excludes Next.js internals (_next/*, api/*) and static assets
// (anything ending in a known extension). Previously the pattern
// `/((?!_next|api|.*\\..*).*) `excluded ANY URL containing a dot, which would
// break legitimate routes like `/v1.0/docs` or hashed slugs. The new pattern
// restricts the file-extension exclusion to a trailing `.\w{2,4}$` suffix.
export const config = {
  matcher: ['/((?!_next|api|.*\\.\\w{2,4}$).*)'],
};
