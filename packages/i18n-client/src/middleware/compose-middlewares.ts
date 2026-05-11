import { type NextFetchEvent, type NextRequest, NextResponse } from 'next/server';

export type NextMiddleware = (
  request: NextRequest,
  event: NextFetchEvent,
) => Promise<NextResponse | undefined> | NextResponse | undefined;

// Headers set by Next.js middleware/proxy to control routing. Their presence
// on a `NextResponse` means the middleware has actively decided how the
// request should be served — composition must preserve that decision rather
// than discarding it via a generic `NextResponse.next()`.
const ROUTING_HEADERS = ['x-middleware-rewrite', 'x-middleware-redirect', 'location'] as const;

function hasRoutingDecision(res: NextResponse): boolean {
  return ROUTING_HEADERS.some((h) => res.headers.has(h));
}

// Compose multiple middlewares left-to-right. A middleware "claims" the
// response by returning a `NextResponse` that EITHER has non-200 status
// (redirect / error) OR carries routing headers (`x-middleware-rewrite`,
// `location`, …). next-intl's createMiddleware returns 200 + rewrite headers
// on every locale-prefixed path — checking status alone discarded its
// rewrite decision silently. Now we honour any routing-headers response too.
//
// Each middleware is wrapped in try/catch so an exception in one (e.g.
// transient Keycloak failure in auth middleware) does not cascade into a
// blank 500 with zero diagnostics.
export function composeMiddlewares(...middlewares: NextMiddleware[]): NextMiddleware {
  return async (request, event) => {
    for (const mw of middlewares) {
      let result: NextResponse | undefined;
      try {
        result = (await mw(request, event)) ?? undefined;
      } catch (e) {
        if (typeof console !== 'undefined' && console.error) {
          console.error('[composeMiddlewares] middleware threw', e);
        }
        throw e;
      }
      if (result instanceof NextResponse) {
        if (result.status !== 200 || hasRoutingDecision(result)) {
          return result;
        }
      }
    }
    return NextResponse.next();
  };
}
