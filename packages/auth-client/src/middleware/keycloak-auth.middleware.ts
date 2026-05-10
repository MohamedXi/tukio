import { type NextRequest, NextResponse } from 'next/server.js';
import { TUKIO_SESSION_MARKER_COOKIE } from '../tokens.js';

export type NextMiddleware = (request: NextRequest) => NextResponse | Promise<NextResponse>;

export interface KeycloakAuthMiddlewareConfig {
  protectedPaths: string[];
  loginRedirectUri: string;
}

// Factory that returns a Next.js proxy/middleware function (Next.js 16 calls
// it `proxy`, Next.js 15 called it `middleware` — the function shape is the
// same). Checks for the session marker cookie — if absent on a protected path,
// redirects to Keycloak.
//
// Note: Next.js Edge runtime — no Node.js APIs (fs, Buffer, etc.).
export function createKeycloakAuthMiddleware(config: KeycloakAuthMiddlewareConfig): NextMiddleware {
  return (request: NextRequest) => {
    const isProtected = config.protectedPaths.some((p) => request.nextUrl.pathname.startsWith(p));
    if (!isProtected) return NextResponse.next();

    const sessionMarker = request.cookies.get(TUKIO_SESSION_MARKER_COOKIE);
    // Strict equality with `1` — empty/`0` is not a session.
    if (!sessionMarker || sessionMarker.value !== '1') {
      const loginUrl = new URL(config.loginRedirectUri);
      // Build a clean redirect_uri with origin + pathname only — drop any
      // query string. Round-tripping arbitrary user-supplied query through
      // Keycloak `redirect_uri` is an open-redirect vector against weakly
      // configured Valid Redirect URIs allowlists.
      const cleanReturnUrl = `${request.nextUrl.origin}${request.nextUrl.pathname}`;
      loginUrl.searchParams.set('redirect_uri', cleanReturnUrl);
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
  };
}
