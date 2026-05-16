import { useCallback } from 'react';
import { useAuthContext } from '../providers/auth-provider.js';
import { cookieManager } from '../cookies/cookie-manager.js';

const EMAIL_VERIFIED_SYNC_ENDPOINT = '/api/auth/sync-email-verified';

async function clearEmailVerifiedCookie(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await fetch(EMAIL_VERIFIED_SYNC_ENDPOINT, { method: 'DELETE', credentials: 'include' });
  } catch {
    // Non-fatal: Keycloak logout still proceeds; the cookie will expire on its
    // own (30 day MAX-AGE) or be overwritten by the next sync after login.
  }
}

export function useLogout(): () => Promise<void> {
  const { keycloakClient } = useAuthContext();

  return useCallback(async () => {
    cookieManager.clearSession();
    await clearEmailVerifiedCookie();
    if (keycloakClient) {
      await keycloakClient.logout();
    }
  }, [keycloakClient]);
}
