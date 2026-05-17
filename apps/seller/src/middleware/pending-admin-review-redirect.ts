import { type NextRequest, NextResponse } from 'next/server';
import { ACCESS_TOKEN_COOKIE, decidePendingRedirect } from './pending-admin-review-decision';

/**
 * Story 1.3d AC2 — middleware wrapper that runs the pure
 * `decidePendingRedirect` against the incoming NextRequest and translates
 * the result into a NextResponse. The decision logic and its unit tests
 * live in `./pending-admin-review-decision.ts` so vitest doesn't need to
 * transform `next/server`.
 */
export function pendingAdminReviewRedirect(request: NextRequest): NextResponse | undefined {
  const decision = decidePendingRedirect(
    request.nextUrl.pathname,
    request.cookies.get(ACCESS_TOKEN_COOKIE)?.value,
  );
  if (!decision.redirect) return undefined;
  const target = new URL(`/${decision.locale}/seller/onboarding/pending`, request.url);
  return NextResponse.redirect(target);
}
