// Story 1.4d AC3 — pure admin-zone access decision (apps/admin).
//
// No `next/server` import — the NextResponse wrapper lives in `./admin-access.ts`.
//
// Rules for any `/{locale}/admin/...` path:
//   - missing / expired JWT          → cross-zone apex login (clientId=tukio-admin)
//   - no `admin-*` realm role         → cross-zone redirect to apex home (customer-first)
//   - admin role but no `totp` in amr → redirect to /{locale}/auth/totp-setup (Story 1.7)
//   - admin role + totp               → allow
//
// Decode-only (no signature verify): the gateway JWT guard + AdminMfaGuard
// remain the authority; this is an Edge routing hint.
import { tryDecodeJwt, isJwtExpired } from '@tukio/auth-client/middleware/decode-jwt';
import { TUKIO_ACCESS_TOKEN_COOKIE_NAME } from '@tukio/auth-client/tokens';

export { TUKIO_ACCESS_TOKEN_COOKIE_NAME as ACCESS_TOKEN_COOKIE };

const ADMIN_PATH = /^\/([a-z]{2})\/admin(\/|$)/u;
const DEFAULT_LOCALE = 'en';

export type AdminAccessDecision =
  | { kind: 'next' }
  | { kind: 'redirect-apex'; locale: string }
  | { kind: 'redirect-totp'; locale: string }
  | { kind: 'redirect-login'; locale: string; nextUrl: string };

export interface AdminAccessInput {
  pathname: string;
  /** `tukio-access-token` cookie value. */
  accessToken: string | undefined;
  /** Absolute admin origin, e.g. `https://admin.tukio.one` — used to build the cross-zone `next`. */
  adminBaseUrl: string;
}

export function decideAdminAccess(input: AdminAccessInput): AdminAccessDecision {
  const match = ADMIN_PATH.exec(input.pathname);
  if (!match) return { kind: 'next' };
  const locale = match[1] ?? DEFAULT_LOCALE;

  const claims = tryDecodeJwt(input.accessToken);
  if (!claims || isJwtExpired(claims)) {
    return { kind: 'redirect-login', locale, nextUrl: `${input.adminBaseUrl}${input.pathname}` };
  }

  const isAdmin = claims.realm_access.roles.some((r) => r.startsWith('admin-'));
  if (!isAdmin) {
    // A non-admin (customer/pro) has nothing to do here → apex home.
    return { kind: 'redirect-apex', locale };
  }

  if (!claims.amr.includes('totp')) {
    return { kind: 'redirect-totp', locale };
  }

  return { kind: 'next' };
}
