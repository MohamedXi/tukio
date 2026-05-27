import { useCallback } from 'react';
import { useAuthContext } from '../providers/auth-provider.js';
import { cookieManager } from '../cookies/cookie-manager.js';
import { broadcastLoggedOut } from '../refresh/refresh-token-rotation.js';

// Story 1.2d review patch P32 — keep the middleware's httpOnly
// `tukio-email-verified` cookie aligned with auth state by clearing it on
// logout. The actual delete happens server-side in the Next.js route handler.
const EMAIL_VERIFIED_SYNC_ENDPOINT = '/api/auth/sync-email-verified';

async function clearEmailVerifiedCookie(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await fetch(EMAIL_VERIFIED_SYNC_ENDPOINT, { method: 'DELETE', credentials: 'include' });
  } catch {
    // Non-fatal: cookie expires on its own (30 day MAX-AGE) or is overwritten
    // by the next post-login sync.
  }
}

/**
 * Story 1.4d AC5 — logout action hook.
 *
 * POSTs `/v1/auth/logout` (CsrfGuard) with the CSRF header, then clears local
 * cookie state and broadcasts `loggedOut` so other tabs redirect. The same-tab
 * redirect is the caller's responsibility (the LogoutButton does
 * `window.location.assign('/{locale}/')`), keeping this hook side-effect-focused.
 *
 * Context-independent: reads the gateway base URL from AuthContext when present
 * and falls back to `NEXT_PUBLIC_GATEWAY_URL`, so it works in apps that have not
 * mounted an AuthProvider (seller/admin LogoutButton).
 */
export function useLogout(): () => Promise<void> {
  const { gatewayBaseUrl } = useAuthContext();

  return useCallback(async () => {
    const headers = new Headers({ 'Content-Type': 'application/json' });
    cookieManager.addCsrfHeader(headers);
    try {
      await fetch(`${gatewayBaseUrl}/v1/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers,
      });
    } catch {
      // Non-fatal: even if the revoke call fails, clear local state so the UI
      // reflects logout. The HttpOnly cookies will expire server-side.
    }
    cookieManager.clearSession();
    cookieManager.clearLocalSessionCache();
    await clearEmailVerifiedCookie();
    broadcastLoggedOut();
  }, [gatewayBaseUrl]);
}
