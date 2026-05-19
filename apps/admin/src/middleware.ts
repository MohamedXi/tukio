import type { NextRequest } from 'next/server';
import { createTukioI18nMiddleware } from '@tukio/i18n-client/middleware';
import { acquisitionCookieMiddleware } from './middleware/acquisition-cookie';

const i18nMiddleware = createTukioI18nMiddleware();

// Middleware chain:
// 1. i18n middleware — locale routing/redirect (Story 1.4c).
// 2. acquisitionCookieMiddleware — sets tukio-acquisition cookie (Story 0.13).
export default async function middleware(request: NextRequest) {
  const i18nResponse = await i18nMiddleware(
    request as unknown as Parameters<typeof i18nMiddleware>[0],
  );
  if (i18nResponse) return i18nResponse;

  return acquisitionCookieMiddleware(request);
}

export const config = {
  matcher: ['/((?!_next|api|.*\\.\\w{2,4}$).*)'],
};
