import { useCallback } from 'react';
import { useAuthContext } from '../providers/auth-provider.js';
import { cookieManager } from '../cookies/cookie-manager.js';

export function useLogout(): () => Promise<void> {
  const { keycloakClient } = useAuthContext();

  return useCallback(async () => {
    cookieManager.clearSession();
    if (keycloakClient) {
      await keycloakClient.logout();
    }
  }, [keycloakClient]);
}
