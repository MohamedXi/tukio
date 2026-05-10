import createMiddleware from 'next-intl/middleware';
import { LOCALES, DEFAULT_LOCALE } from '../config/locales.js';

export interface CreateI18nMiddlewareOptions {
  // 'always' = every URL is prefixed (`/fr/...`, `/en/...`); 'as-needed' = only
  // non-default locales are prefixed (`/...`, `/en/...`). Default 'always' for
  // SEO clarity (NFR58 hreflang requires explicit canonical per locale).
  localePrefix?: 'always' | 'as-needed';
}

// Factory returning a Next.js middleware/proxy function. Thin wrapper around
// next-intl's createMiddleware with Tukio's locale config baked in.
export function createTukioI18nMiddleware(options: CreateI18nMiddlewareOptions = {}) {
  return createMiddleware({
    locales: [...LOCALES],
    defaultLocale: DEFAULT_LOCALE,
    localePrefix: options.localePrefix ?? 'always',
    localeDetection: true,
  });
}

// Re-export composeMiddlewares for backwards compat (callers that import from
// `@tukio/i18n-client/middleware`). New code should use the dedicated subpath
// `@tukio/i18n-client/middleware/compose` if available.
export { composeMiddlewares, type NextMiddleware } from './compose-middlewares.js';
