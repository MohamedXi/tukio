/**
 * Pure-function decision for the Story 1.3d AC2 middleware. Lives in its own
 * file (no `next/server` import) so it can be unit-tested in vitest without
 * pulling Next.js's edge-runtime module into the Vite sandbox.
 *
 * The HTTP-layer wrapper that translates the decision into a NextResponse
 * lives in `./pending-admin-review-redirect.ts`.
 */

const SELLER_PATH = /^\/([a-z]{2})\/seller(\/|$)/u;
const ALLOWED_WHILE_PENDING: readonly RegExp[] = [
  /^\/[a-z]{2}\/seller\/onboarding(\/|$)/u,
  /^\/[a-z]{2}\/seller\/profile(\/|$)/u,
  /^\/[a-z]{2}\/seller\/messaging(\/|$)/u,
  /^\/api(\/|$)/u,
];
export const ACCESS_TOKEN_COOKIE = 'tukio-access-token';
export const PENDING_STATUS = 'pending_admin_review';
const DEFAULT_LOCALE = 'en';

function isAllowedWhilePending(pathname: string): boolean {
  return ALLOWED_WHILE_PENDING.some((p) => p.test(pathname));
}

interface JwtClaims {
  'tukio:status'?: unknown;
  exp?: unknown;
}

function decodeJwtPayload(token: string): JwtClaims | undefined {
  const segments = token.split('.');
  if (segments.length !== 3) return undefined;
  const payloadSegment = segments[1];
  if (!payloadSegment) return undefined;
  try {
    const normalised = payloadSegment.replace(/-/gu, '+').replace(/_/gu, '/');
    const padded = normalised.padEnd(normalised.length + ((4 - (normalised.length % 4)) % 4), '=');
    if (padded.length > 2048) return undefined;
    const json =
      typeof atob === 'function' ? atob(padded) : Buffer.from(padded, 'base64').toString('utf8');
    return JSON.parse(json) as JwtClaims;
  } catch {
    return undefined;
  }
}

function readStatusClaim(token: string | undefined): string | undefined {
  if (!token) return undefined;
  const claims = decodeJwtPayload(token);
  if (!claims) return undefined;
  if (typeof claims.exp === 'number' && claims.exp * 1000 < Date.now()) return undefined;
  const status = claims['tukio:status'];
  return typeof status === 'string' ? status : undefined;
}

export type PendingRedirectDecision = { redirect: false } | { redirect: true; locale: string };

/**
 * Returns `{ redirect: true, locale }` when the request must be sent to the
 * pending page, `{ redirect: false }` otherwise.
 */
export function decidePendingRedirect(
  pathname: string,
  cookieToken: string | undefined,
): PendingRedirectDecision {
  const match = SELLER_PATH.exec(pathname);
  if (!match) return { redirect: false };
  if (isAllowedWhilePending(pathname)) return { redirect: false };
  const status = readStatusClaim(cookieToken);
  if (status !== PENDING_STATUS) return { redirect: false };
  const locale = match[1] ?? DEFAULT_LOCALE;
  return { redirect: true, locale };
}
