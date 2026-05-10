'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { AuthState, KeycloakConfig } from '../types/auth-state.js';
import { KeycloakClient } from '../keycloak/keycloak-client.js';
import { RefreshTokenRotationManager } from '../refresh/refresh-token-rotation.js';

interface AuthContextValue {
  state: AuthState;
  keycloakClient: KeycloakClient | null;
}

export const AuthContext = createContext<AuthContextValue>({
  state: { user: null, role: null, locale: 'fr', isAuthenticated: false, isLoading: true },
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
  const [state, setState] = useState<AuthState>({
    user: null,
    role: null,
    locale: 'fr',
    isAuthenticated: false,
    isLoading: true,
  });
  const [client, setClient] = useState<KeycloakClient | null>(null);

  useEffect(() => {
    const kc = new KeycloakClient(config);
    kc.init()
      .then((authenticated) => {
        if (authenticated) {
          setState({
            user: kc.getUser(),
            role: kc.getRole(),
            locale: kc.getLocale(),
            isAuthenticated: true,
            isLoading: false,
          });
          new RefreshTokenRotationManager(kc).start();
        } else {
          setState((s) => ({ ...s, isAuthenticated: false, isLoading: false }));
        }
      })
      .catch(() => {
        setState((s) => ({ ...s, isAuthenticated: false, isLoading: false }));
      });
    setClient(kc);
  }, []);

  return (
    <AuthContext.Provider value={{ state, keycloakClient: client }}>
      {children}
    </AuthContext.Provider>
  );
}
