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

// Story 1.2d review patch P32 (D1) — keep middleware's `tukio-email-verified`
// httpOnly cookie aligned with the JWT claim. The actual cookie write happens
// server-side in `/api/auth/sync-email-verified` so JS in the browser cannot
// tamper with it (see route handler for the trust-model discussion).
const EMAIL_VERIFIED_SYNC_ENDPOINT = '/api/auth/sync-email-verified';

async function syncEmailVerifiedCookie(emailVerified: boolean): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await fetch(EMAIL_VERIFIED_SYNC_ENDPOINT, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailVerified }),
    });
  } catch {
    // Non-fatal: middleware will redirect to verify-email-required if the cookie
    // never lands. The gateway-api JWT guard remains the source of truth.
  }
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
          const user = kc.getUser();
          setState({
            user,
            role: kc.getRole(),
            locale: kc.getLocale(),
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
          if (user) void syncEmailVerifiedCookie(user.emailVerified);
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
