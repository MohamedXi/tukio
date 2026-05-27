'use client';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { AuthProviderConfig, AuthState, UserStatus } from '../types/auth-state.js';
import type { Role } from '../types/actor.js';
import { extractPrimaryRole } from '../roles.js';
import { CookieManager } from '../cookies/cookie-manager.js';
import { RefreshTokenRotationManager } from '../refresh/refresh-token-rotation.js';

interface AuthContextValue {
  state: AuthState;
  /** gateway-api origin — consumed by useLogout to POST /v1/auth/logout. */
  gatewayBaseUrl: string;
}

const INITIAL_STATE: AuthState = {
  user: null,
  role: null,
  status: null,
  locale: 'fr',
  isAuthenticated: false,
  isLoading: true,
  error: null,
};

const LOGGED_OUT_STATE: AuthState = { ...INITIAL_STATE, isLoading: false };

// Fallback for hooks used outside an AuthProvider (e.g. seller/admin
// LogoutButton): the NEXT_PUBLIC_ env is inlined into the client bundle.
// Use dot-notation so Next.js/Webpack can statically replace it at build time.
const DEFAULT_GATEWAY_BASE_URL = process.env.NEXT_PUBLIC_GATEWAY_URL ?? 'http://localhost:4000';

export const AuthContext = createContext<AuthContextValue>({
  state: INITIAL_STATE,
  gatewayBaseUrl: DEFAULT_GATEWAY_BASE_URL,
});

export function useAuthContext(): AuthContextValue {
  return useContext(AuthContext);
}

// Shape returned by GET /v1/auth/whoami (WhoamiResponseDto), wrapped by the
// gateway REST envelope `{ method, code, data, meta }`.
interface WhoamiData {
  userId: string;
  email: string;
  role: string[];
  status: UserStatus;
  locale: 'fr' | 'en';
  emailVerified: boolean;
  mfaEnabled: boolean;
}

async function fetchWhoami(
  gatewayBaseUrl: string,
  fetchImpl: typeof fetch,
): Promise<WhoamiData | null> {
  const res = await fetchImpl(`${gatewayBaseUrl}/v1/auth/whoami`, {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  // 401 = no/expired session — not an error, just unauthenticated.
  if (res.status === 401 || res.status === 403) return null;
  if (!res.ok) throw new Error(`whoami responded ${res.status}`);

  // Runtime-narrow the parsed body instead of casting with `as`. Tolerates both
  // enveloped `{ data: { userId, ... } }` (gateway REST envelope) and a flat body.
  const body = (await res.json()) as Record<string, unknown>;
  const dataField = body['data'];
  const data: Record<string, unknown> =
    typeof dataField === 'object' && dataField !== null && !Array.isArray(dataField)
      ? (dataField as Record<string, unknown>)
      : body;
  if (typeof data['userId'] !== 'string') return null;
  return data as unknown as WhoamiData;
}

/**
 * Build React context state from a successful `/v1/auth/whoami` response.
 *
 * `isAuthenticated` is `true` for **any** account with a valid session token,
 * including `suspended` and `deleted` accounts. It means "the browser has a
 * valid access token", not "the account is fully usable". UI components that
 * gate access to protected content must also check `status === 'active'` (or
 * at minimum `status !== 'suspended' && status !== 'deleted'`). The middleware
 * enforces the primary role/status access rules before the React tree renders.
 */
function toAuthState(who: WhoamiData): AuthState {
  const role: Role | null = extractPrimaryRole(who.role);
  return {
    user: {
      userId: who.userId,
      email: who.email,
      emailVerified: who.emailVerified,
    },
    role,
    status: who.status,
    locale: who.locale === 'en' ? 'en' : 'fr',
    isAuthenticated: true,
    isLoading: false,
    error: null,
  };
}

/**
 * Story 1.4d AC4 — cookie/whoami-based auth context.
 *
 * On mount: if the non-HttpOnly `tukio-session-active` marker is present, fetch
 * `/v1/auth/whoami` (credentialed) to hydrate `{ user, role, status, locale,
 * isAuthenticated }` and start the silent refresh-rotation manager. Without the
 * marker we short-circuit to logged-out (no needless network call on every
 * anonymous page view).
 *
 * Replaces the Story 0.8 Keycloak.js placeholder — `check-sso` produced
 * corrupted AUTH_SESSION state that blocked login (see Story 1.4c notes).
 */
export function AuthProvider({
  config,
  children,
}: {
  config: AuthProviderConfig;
  children: ReactNode;
}) {
  const [state, setState] = useState<AuthState>(INITIAL_STATE);
  // Refs survive StrictMode double-mount; cleanup reaches the live manager.
  const managerRef = useRef<RefreshTokenRotationManager | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchImpl = config.fetchImpl ?? globalThis.fetch.bind(globalThis);
    const cookies = new CookieManager({ domain: config.cookieDomain });

    if (!cookies.isAuthenticated()) {
      setState(LOGGED_OUT_STATE);
      return;
    }

    fetchWhoami(config.gatewayBaseUrl, fetchImpl)
      .then((who) => {
        if (cancelled) return;
        if (!who) {
          cookies.clearSession();
          setState(LOGGED_OUT_STATE);
          return;
        }
        setState(toAuthState(who));

        const manager = new RefreshTokenRotationManager({
          gatewayBaseUrl: config.gatewayBaseUrl,
          getCsrfToken: () => cookies.getCsrfToken(),
          fetchImpl,
          onLoggedOut: () => {
            // Guard both cookie clear and state update on `cancelled` so that
            // an orphaned manager instance (from StrictMode double-mount) cannot
            // clear cookies or update state on a component that has already
            // torn down its cleanup (managerRef.current set to null).
            if (!cancelled) {
              cookies.clearSession();
              setState(LOGGED_OUT_STATE);
            }
          },
        });
        // Assign the ref BEFORE calling start() so that the cleanup function's
        // `managerRef.current?.stop()` always reaches this specific instance even
        // if the StrictMode teardown runs synchronously before start() returns.
        managerRef.current = manager;
        manager.start();
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        // Network failure reaching whoami — surface as error but stop loading.
        setState({
          ...LOGGED_OUT_STATE,
          error: { code: 'NETWORK', message: e instanceof Error ? e.message : String(e) },
        });
      });

    return () => {
      cancelled = true;
      managerRef.current?.stop();
      managerRef.current = null;
    };
    // Use individual primitive config fields as dependencies (not the config object
    // itself) so the effect is stable even when the parent re-renders with a new
    // object literal. The config object's reference changes on every render of any
    // parent that inlines `config={{ gatewayBaseUrl: X }}`.
  }, [config.gatewayBaseUrl, config.cookieDomain, config.fetchImpl]);

  return (
    <AuthContext.Provider value={{ state, gatewayBaseUrl: config.gatewayBaseUrl }}>
      {children}
    </AuthContext.Provider>
  );
}
