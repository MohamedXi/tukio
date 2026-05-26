import { createTukioI18nMiddleware } from '@tukio/i18n-client/middleware';
import type { NextRequest } from 'next/server';
import { acquisitionCookieMiddleware } from './middleware/acquisition-cookie';
import { authGateMiddleware } from './middleware/auth-gate';
import { comingSoonGateMiddleware } from './middleware/coming-soon-gate';

const i18nMiddleware = createTukioI18nMiddleware();

// Middleware chain (left = first executed):
// 0. comingSoonGateMiddleware — rewrites non-whitelisted routes to
//    /${locale}/coming-soon when NEXT_PUBLIC_COMING_SOON_MODE=true (Story 0.15).
//    When the flag is off, this is a no-op and the chain runs unchanged.
//    The rewrite carries `x-next-intl-locale` on the downstream request so
//    next-intl's `requestLocale` (used by getMessages) resolves correctly
//    on the rewritten target (without this, App Router 404s the rewrite).
// 1. acquisitionCookieMiddleware — sets tukio-acquisition cookie from UTM params (Story 0.13)
// 2. authGateMiddleware — redirects unauthenticated requests on /(authenticated)/* (Story 0.14, ADR-016)
// 3. i18n middleware — locale routing/redirect
export default async function middleware(request: NextRequest) {
  const comingSoonResponse = comingSoonGateMiddleware(request);
  if (comingSoonResponse) return comingSoonResponse;

  const acqResponse = acquisitionCookieMiddleware(request);

  const authResponse = authGateMiddleware(request);
  if (authResponse) {
    acqResponse.cookies.getAll().forEach((cookie) => authResponse.cookies.set(cookie));
    return authResponse;
  }

  // Cast bridges Next.js 15 (i18n-client peer) vs 16 (app) NextRequest mismatch.
  // Runtime type is compatible; the [Internal] symbol differs only in TS type declarations.
  // TODO @ismael: upgrade @tukio/i18n-client peer to next@16 when all apps are on 16.
  const i18nResponse = await i18nMiddleware(request as any);
  if (i18nResponse) {
    acqResponse.cookies.getAll().forEach((cookie) => i18nResponse.cookies.set(cookie));
    return i18nResponse;
  }

  return acqResponse;
}

// Matcher excludes Next.js internals (_next/*, api/*) and static assets
// (anything ending in a file extension). The `$`-anchored `\.\w+$` only
// matches a trailing extension, so mid-path dots like `/v1.0/docs` still hit
// the middleware (they are pages, not assets). The length is unbounded on
// purpose: a `\w{2,4}` cap silently let `/fonts/*.woff2` (5-char extension)
// through, so the OG route's same-origin font fetch resolved to the rewritten
// coming-soon HTML and crashed satori ("Unsupported OpenType signature").
export const config = {
  matcher: ['/((?!_next|api|.*\\.\\w+$).*)'],
};
