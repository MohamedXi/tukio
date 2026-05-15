import type { NextRequest } from 'next/server';
import { acquisitionCookieMiddleware } from './middleware/acquisition-cookie.js';

// Story 0.13 — acquisition cookie runs on admin requests (admin users can also be tracked).
// Story 0.8 placeholder — replace with Keycloak auth middleware in Story Epic 1+:
//   import { createKeycloakAuthMiddleware } from '@tukio/auth-client/middleware';
//   export default createKeycloakAuthMiddleware({
//     protectedPaths: ['/'],
//     loginRedirectUri: 'https://auth.tukio.one/realms/tukio/protocol/openid-connect/auth',
//   });
export default function middleware(request: NextRequest) {
  return acquisitionCookieMiddleware(request);
}

export const config = {
  matcher: ['/((?!_next|api|.*\\..*).*)'],
};
