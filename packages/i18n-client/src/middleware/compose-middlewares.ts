import { type NextFetchEvent, type NextRequest, NextResponse } from 'next/server';

export type NextMiddleware = (
  request: NextRequest,
  event: NextFetchEvent,
) => Promise<NextResponse | undefined> | NextResponse | undefined;

// Compose multiple middlewares left-to-right. Returns early if a middleware
// produced a redirect or non-200 response. Used to chain i18n + auth:
//
//   export default composeMiddlewares(
//     createTukioI18nMiddleware(),
//     createKeycloakAuthMiddleware({ ... }),
//   );
export function composeMiddlewares(...middlewares: NextMiddleware[]): NextMiddleware {
  return async (request, event) => {
    for (const mw of middlewares) {
      const result = await mw(request, event);
      if (result instanceof NextResponse) {
        // Non-200 (redirect / rewrite / error) means a middleware decided the
        // response — short-circuit to preserve its decision.
        if (result.status !== 200) return result;
      }
    }
    return NextResponse.next();
  };
}
