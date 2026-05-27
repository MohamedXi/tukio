// Story 1.4d AC2 — pure seller-zone access decision (apps/seller).
//
// Supersedes Story 1.3d's pending-only `decidePendingRedirect` with full
// `tukio:status` enforcement. No `next/server` import — the NextResponse
// wrapper lives in `./seller-access.ts`.
//
// Status matrix for any `/{locale}/seller/...` path:
//   - missing / expired JWT      → cross-zone redirect to apex /auth/login
//   - active                     → allow (no-op)
//   - pending_admin_review       → allow onboarding/profile/messaging,
//                                  else redirect to /seller/onboarding/pending
//   - rejected                   → redirect to /seller/onboarding/rejected
//   - suspended / deleted / other→ cross-zone redirect to apex /auth/login
//
// Decode-only (no signature verify): the gateway JWT guard remains the
// authority; this is an Edge routing hint.
import { tryDecodeJwt, isJwtExpired } from '@tukio/auth-client/middleware/decode-jwt';
import { TUKIO_ACCESS_TOKEN_COOKIE_NAME } from '@tukio/auth-client/tokens';

export { TUKIO_ACCESS_TOKEN_COOKIE_NAME as ACCESS_TOKEN_COOKIE };

const SELLER_PATH = /^\/([a-z]{2})\/seller(\/|$)/u;
const ALLOWED_WHILE_PENDING: readonly RegExp[] = [
  /^\/[a-z]{2}\/seller\/onboarding(\/|$)/u,
  /^\/[a-z]{2}\/seller\/profile(\/|$)/u,
  /^\/[a-z]{2}\/seller\/messaging(\/|$)/u,
];
const DEFAULT_LOCALE = 'en';

function isAllowedWhilePending(pathname: string): boolean {
  return ALLOWED_WHILE_PENDING.some((p) => p.test(pathname));
}

export type SellerAccessDecision =
  | { kind: 'next' }
  | { kind: 'redirect-internal'; path: string }
  | { kind: 'redirect-login'; nextUrl: string };

export interface SellerAccessInput {
  pathname: string;
  /** `tukio-access-token` cookie value. */
  accessToken: string | undefined;
  /** Absolute seller origin, e.g. `https://seller.tukio.one` — used to build the cross-zone `next`. */
  sellerBaseUrl: string;
}

export function decideSellerAccess(input: SellerAccessInput): SellerAccessDecision {
  const match = SELLER_PATH.exec(input.pathname);
  if (!match) return { kind: 'next' };
  const locale = match[1] ?? DEFAULT_LOCALE;

  const claims = tryDecodeJwt(input.accessToken);
  if (!claims || isJwtExpired(claims)) {
    return { kind: 'redirect-login', nextUrl: `${input.sellerBaseUrl}${input.pathname}` };
  }

  const status = claims['tukio:status'];

  if (status === 'active') return { kind: 'next' };

  if (status === 'pending_admin_review') {
    if (isAllowedWhilePending(input.pathname)) return { kind: 'next' };
    return { kind: 'redirect-internal', path: `/${locale}/seller/onboarding/pending` };
  }

  if (status === 'rejected') {
    return { kind: 'redirect-internal', path: `/${locale}/seller/onboarding/rejected` };
  }

  // suspended / deleted / unknown → force re-auth at the apex login.
  return { kind: 'redirect-login', nextUrl: `${input.sellerBaseUrl}${input.pathname}` };
}
