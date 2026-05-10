'use client';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { AuthState, KeycloakConfig } from '../types/auth-state.js';
import { KeycloakClient } from '../keycloak/keycloak-client.js';
import { RefreshTokenRotationManager } from '../refresh/refresh-token-rotation.js';

interface AuthContextValue {
  state: AuthState;
  keycloakClient: KeycloakClient | null;
}

const INITIAL_STATE: AuthState = {
  user: null,
  role: null,
  locale: 'fr',
  isAuthenticated: false,
  isLoading: true,
  error: null,
};

export const AuthContext = createContext<AuthContextValue>({
  state: INITIAL_STATE,
  keycloakClient: null,
});

export function useAuthContext(): AuthContextValue {
  return useContext(AuthContext);
}

export function AuthProvider({
  config,
  children,
}: {
  config: KeycloakConfig;
  children: ReactNode;
}) {
  const [state, setState] = useState<AuthState>(INITIAL_STATE);
  const [client, setClient] = useState<KeycloakClient | null>(null);
  // Refs survive StrictMode double-mount and let the cleanup function reach
  // the live instance even after the effect re-runs.
  const refreshManagerRef = useRef<RefreshTokenRotationManager | null>(null);

  useEffect(() => {
    let cancelled = false;
    const kc = new KeycloakClient(config);

    kc.init()
      .then((authenticated) => {
        if (cancelled) return;
        if (authenticated) {
          setState({
            user: kc.getUser(),
            role: kc.getRole(),
            locale: kc.getLocale(),
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
          const manager = new RefreshTokenRotationManager(kc);
          refreshManagerRef.current = manager;
          manager.start();
        } else {
          setState({ ...INITIAL_STATE, isLoading: false });
        }
        // setClient AFTER init resolves — children calling logout/login before
        // this point would otherwise hit an uninitialized Keycloak instance.
        setClient(kc);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setState({
          ...INITIAL_STATE,
          isLoading: false,
          error: {
            code: 'INIT_FAILED',
            message: e instanceof Error ? e.message : String(e),
          },
        });
        setClient(kc);
      });

    return () => {
      cancelled = true;
      refreshManagerRef.current?.stop();
      refreshManagerRef.current = null;
    };
    // Config is treated as immutable post-mount (multi-tenant config swaps are
    // out of MVP scope). Consumers must remount AuthProvider to switch realms.
  }, [config]);

  return (
    <AuthContext.Provider value={{ state, keycloakClient: client }}>
      {children}
    </AuthContext.Provider>
  );
}
