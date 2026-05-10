import { NextResponse } from 'next/server';

// Story 0.8 placeholder — wired for real in Stories Epic 1+ when Keycloak is provisioned (Story 1.1)
// Replace with:
//   import { createKeycloakAuthMiddleware } from '@tukio/auth-client/middleware';
//   export default createKeycloakAuthMiddleware({
//     protectedPaths: ['/account', '/cart'],
//     loginRedirectUri: 'https://auth.tukio.one/realms/tukio/protocol/openid-connect/auth',
//   });
export function proxy() {
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|api|.*\\..*).*)'],
};
