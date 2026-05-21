import { NextResponse, type NextRequest } from 'next/server';
import { LOCALES } from '@tukio/i18n-client/config';
import { decideComingSoon } from './coming-soon-gate-decision';

/**
 * Story 0.15 AC3 — pre-launch gate (seller variant). Translates the pure
 * `decideComingSoon` result into a NextResponse. The decision logic and
 * its unit tests live in `./coming-soon-gate-decision.ts` so vitest doesn't
 * need to transform `next/server`.
 *
 * Defence in depth: when the flag is off, the function returns undefined
 * and the standard middleware chain (pendingAdminReview → i18n →
 * acquisitionCookie) runs unchanged.
 *
 * Toggle = container restart (the const below is evaluated at module-load
 * time; `NEXT_PUBLIC_*` inlining is a CLIENT-bundle rule, not a
 * server-middleware rule). See `docs/runbook/pre-launch-toggle.md`.
 */
const IS_FLAG_ON = process.env.NEXT_PUBLIC_COMING_SOON_MODE === 'true';

export function comingSoonGateMiddleware(request: NextRequest): NextResponse | undefined {
  const decision = decideComingSoon(IS_FLAG_ON, request.nextUrl.pathname, LOCALES);
  if (decision.kind === 'pass') return undefined;
  // Propagate locale via REQUEST headers — see apex variant for the rationale.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-next-intl-locale', decision.locale);
  const rewriteUrl = new URL(decision.target, request.url);
  return NextResponse.rewrite(rewriteUrl, { request: { headers: requestHeaders } });
}
