import { NextResponse, type NextRequest } from 'next/server';
import { LOCALES } from '@tukio/i18n-client/config';
import { decideComingSoon } from './coming-soon-gate-decision';

/**
 * Story 0.15 AC3 — pre-launch gate. Translates the pure
 * `decideComingSoon` result into a NextResponse. The decision logic and
 * its unit tests live in `./coming-soon-gate-decision.ts` so vitest doesn't
 * need to transform `next/server`.
 *
 * Defence in depth: when the flag is off, the function returns undefined
 * and the standard middleware chain (acquisitionCookie → authGate → i18n)
 * runs unchanged — the dev experience on Epic 1+ branches is preserved.
 *
 * Toggle requires a container restart: the const below is evaluated at
 * module-load time when the standalone Next.js server boots. Restart =
 * re-evaluation = new flag value. The "`NEXT_PUBLIC_*` inlined at build
 * time" rule applies only to the CLIENT bundle (browser JS) — server-side
 * middleware reads `process.env` at runtime. See
 * `docs/runbook/pre-launch-toggle.md` for the operational workflow.
 */
const IS_FLAG_ON = process.env.NEXT_PUBLIC_COMING_SOON_MODE === 'true';

export function comingSoonGateMiddleware(request: NextRequest): NextResponse | undefined {
  const decision = decideComingSoon(IS_FLAG_ON, request.nextUrl.pathname, LOCALES);
  if (decision.kind === 'pass') return undefined;
  // Rewrite (NOT redirect) — the browser URL stays at the visited path so
  // analytics + bookmarks make sense. SSR renders the coming-soon page.
  //
  // Pass `x-next-intl-locale` as a REQUEST header so next-intl's
  // `requestLocale` (consumed by `getRequestConfig` in `src/i18n/request.ts`)
  // resolves to the rewrite target's locale. Without this, App Router's
  // `[locale]` segment resolution short-circuits and the rewrite renders
  // a 404. Propagation via `NextResponse.rewrite(url, { request: { headers }})`
  // is the canonical Next.js mechanism for downstream-visible headers.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-next-intl-locale', decision.locale);
  const rewriteUrl = new URL(decision.target, request.url);
  return NextResponse.rewrite(rewriteUrl, { request: { headers: requestHeaders } });
}
