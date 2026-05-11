import { createTukioI18nMiddleware } from '@tukio/i18n-client/middleware';

// Wired Story 0.9. Routes /fr and /en, redirects / → /fr (default locale per
// LOCALES config). Compose with createKeycloakAuthMiddleware (Story 0.8) here
// once auth flow lands in Stories Epic 1+.
export default createTukioI18nMiddleware();

// Matcher excludes Next.js internals (_next/*, api/*) and static assets
// (anything ending in a known extension). Previously the pattern
// `/((?!_next|api|.*\\..*).*) `excluded ANY URL containing a dot, which would
// break legitimate routes like `/v1.0/docs` or hashed slugs. The new pattern
// restricts the file-extension exclusion to a trailing `.\w{2,4}$` suffix.
export const config = {
  matcher: ['/((?!_next|api|.*\\.\\w{2,4}$).*)'],
};
