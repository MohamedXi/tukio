/**
 * Pure-function decision for the Story 0.15 pre-launch gate. Lives in its own
 * file (no `next/server` import) so it can be unit-tested in vitest without
 * pulling Next.js's edge-runtime module into the Vite sandbox.
 *
 * The HTTP-layer wrapper that translates the decision into a NextResponse
 * lives in `./coming-soon-gate.ts`. Pattern strictly mirrors Story 1.3d
 * `pending-admin-review-decision.ts`.
 */

// Routes that REMAIN ACCESSIBLE while NEXT_PUBLIC_COMING_SOON_MODE=true.
// Locale-prefixed routes follow the next-intl `localePrefix: 'always'`
// convention from @tukio/i18n-client (so `/fr/about` and `/en/about`
// both match — the regex captures any 2-letter locale segment).
const PUBLIC_WHITELIST: readonly RegExp[] = [
  /^\/[a-z]{2}\/coming-soon(\/|$)/u,
  /^\/[a-z]{2}\/become-pro(\/|$)/u,
  /^\/[a-z]{2}\/about(\/|$)/u,
  /^\/[a-z]{2}\/privacy(\/|$)/u,
  /^\/[a-z]{2}\/legal(\/|$)/u,
  /^\/[a-z]{2}\/contact(\/|$)/u,
];

// Tech routes that bypass the gate regardless of locale prefix. The Next.js
// `matcher` config already excludes `_next/*` and `api/*`; this list is a
// defence in depth for cases where the matcher config drifts.
const TECH_BYPASS: readonly RegExp[] = [
  /^\/_next\//u,
  /^\/api\//u,
  /^\/robots\.txt$/u,
  /^\/sitemap\.xml$/u,
  /^\/favicon\.ico$/u,
  /^\/\.well-known\//u,
  /^\/assets\//u,
  /^\/og\//u,
];

export type ComingSoonDecision =
  | { kind: 'pass' }
  | { kind: 'rewrite'; locale: string; target: string };

const DEFAULT_LOCALE = 'en';

export function safeLocaleFromPath(pathname: string, locales: readonly string[]): string {
  const candidate = pathname.split('/')[1];
  return candidate && locales.includes(candidate) ? candidate : DEFAULT_LOCALE;
}

/**
 * Pure function: given the env flag, the request pathname, and the set of
 * supported locales, returns the rewrite decision. No side effects — safe
 * to unit-test under vitest without `next/server`.
 */
export function decideComingSoon(
  isFlagOn: boolean,
  pathname: string,
  locales: readonly string[],
): ComingSoonDecision {
  if (!isFlagOn) return { kind: 'pass' };
  if (TECH_BYPASS.some((p) => p.test(pathname))) return { kind: 'pass' };
  if (PUBLIC_WHITELIST.some((p) => p.test(pathname))) return { kind: 'pass' };
  const locale = safeLocaleFromPath(pathname, locales);
  return { kind: 'rewrite', locale, target: `/${locale}/coming-soon` };
}
