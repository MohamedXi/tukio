/**
 * Pure-function decision for the Story 0.15 pre-launch gate (seller variant).
 * Lives in its own file (no `next/server` import) so it can be unit-tested in
 * vitest without pulling Next.js's edge-runtime module into the Vite sandbox.
 *
 * The HTTP-layer wrapper that translates the decision into a NextResponse
 * lives in `./coming-soon-gate.ts`. Pattern strictly mirrors Story 1.3d
 * `pending-admin-review-decision.ts`.
 */

const SELLER_WHITELIST: readonly RegExp[] = [/^\/[a-z]{2}\/seller-coming-soon(\/|$)/u];

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
  if (SELLER_WHITELIST.some((p) => p.test(pathname))) return { kind: 'pass' };
  const locale = safeLocaleFromPath(pathname, locales);
  return { kind: 'rewrite', locale, target: `/${locale}/seller-coming-soon` };
}
