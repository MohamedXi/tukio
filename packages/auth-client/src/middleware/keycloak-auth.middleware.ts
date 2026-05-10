import { type NextRequest, NextResponse } from 'next/server.js';
import { TUKIO_SESSION_MARKER_COOKIE } from '../tokens.js';

export type NextMiddleware = (request: NextRequest) => NextResponse | Promise<NextResponse>;

export interface KeycloakAuthMiddlewareConfig {
  protectedPaths: string[];
  loginRedirectUri: string;
}

// Factory that returns a Next.js middleware function.
// Checks for the session marker cookie — if absent on a protected path, redirects to Keycloak.
// Note: Next.js middleware runs in Edge runtime — no Node.js APIs (fs, Buffer, etc.).
export function createKeycloakAuthMiddleware(config: KeycloakAuthMiddlewareConfig): NextMiddleware {
  return (request: NextRequest) => {
    const isProtected = config.protectedPaths.some((p) => request.nextUrl.pathname.startsWith(p));
    if (!isProtected) return NextResponse.next();

    const sessionMarker = request.cookies.get(TUKIO_SESSION_MARKER_COOKIE);
    if (!sessionMarker) {
      const loginUrl = new URL(config.loginRedirectUri);
      loginUrl.searchParams.set('redirect_uri', request.nextUrl.toString());
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
  };
}
