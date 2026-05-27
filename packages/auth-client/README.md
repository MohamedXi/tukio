# @tukio/auth-client

Frontend auth for Tukio Next.js apps — **cookie/whoami-based** session state,
hooks, silent refresh rotation, and Edge-runtime middleware helpers.

> **Story 1.4d** reworked this package off the Keycloak.js adapter. The MVP auth
> flow is fully cookie-based (Story 1.4a/b): the gateway sets HttpOnly
> access/refresh cookies + a readable `tukio-session-active` marker + a
> `tukio-csrf-token`. The frontend never holds the JWT in JS — it derives state
> from `GET /v1/auth/whoami` and rotates the token via `POST /v1/auth/refresh`.

## Login flow integration

```
Browser
  │  PublicHeader "Connexion" → window.location.assign(gateway /v1/auth/login)
  ▼
gateway-api ──302──► Keycloak (PKCE) ──302──► /{locale}/auth/callback (Next.js)
  │                                              │ server relay → gateway /v1/auth/callback
  │                                              ▼ Set-Cookie ×4 + 302 to post-login dest
  ▼
AuthProvider (mount)
  │  if tukio-session-active=1 → GET /v1/auth/whoami → hydrate { user, role, status, locale }
  │  start RefreshTokenRotationManager → POST /v1/auth/refresh ~60s before expiry
  ▼
useAuth() / useRole() / useRequireRole() / useLogout()  ← read the context
```

The api-client (`@tukio/api-client`) wires a **401 interceptor** to
`RefreshTokenRotationManager.refreshNow()` via its `refreshAuth` config so an
expired access token is transparently refreshed and the request retried once.

## Quick-start: AuthProvider

```tsx
// apps/public/src/app/[locale]/layout.tsx
import { AuthProvider } from '@tukio/auth-client/provider';

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL ?? 'http://localhost:4000';
const COOKIE_DOMAIN = process.env.NODE_ENV === 'production' ? '.tukio.one' : undefined;

export default function Layout({ children }) {
  return (
    <AuthProvider config={{ gatewayBaseUrl: GATEWAY, cookieDomain: COOKIE_DOMAIN }}>
      {children}
    </AuthProvider>
  );
}
```

On mount the provider checks the `tukio-session-active` marker; if present it
fetches `/v1/auth/whoami` (credentialed) and starts silent refresh rotation.
No marker → it short-circuits to logged-out (no needless network call).

## Hooks

```ts
// Full reactive state from the whoami projection.
const { user, role, status, locale, isAuthenticated, isLoading, error } = useAuth();

// Coarse role bucket for UI branching: 'customer' | 'pro' | 'admin' | null.
const coarse = useRole();

// Component-level guard (defense in depth — middleware does primary enforcement).
// Throws RoleRequirementError (→ Error Boundary) when insufficient; no-op while loading.
useRequireRole('admin');
useRequireRole(['pro', 'admin']);

// Logout action: POST /v1/auth/logout (CSRF) + clear local cookies + broadcast
// loggedOut to other tabs.
//
// REDIRECT CONTRACT: useLogout() is intentionally side-effect-focused and does
// NOT redirect the same-tab. The caller is responsible for the same-tab redirect:
//   const logout = useLogout();
//   const handleLogout = async () => {
//     await logout();
//     window.location.assign('/' + locale + '/'); // ← caller's responsibility
//   };
//
// Cross-tab redirect: the RefreshTokenRotationManager's onLoggedOut callback
// (passed via AuthProvider) handles state cleanup (clearSession + setState) for
// other tabs. If you need a hard redirect on cross-tab logout, wire it in the
// AuthProvider's onLoggedOut callback or via a useEffect watching isAuthenticated.
const logout = useLogout();
await logout();
```

## Edge middleware: JWT decode

```ts
import { decodeJwt, isJwtExpired, tryDecodeJwt } from '@tukio/auth-client/middleware/decode-jwt';

// Decode-only (NO signature verify — that's the gateway JWT guard's job).
const claims = tryDecodeJwt(req.cookies.get('tukio-access-token')?.value);
const isPro = claims?.realm_access.roles.includes('pro');
const verified = claims?.email_verified ?? false;
```

Apps build pure decision functions on top of this (`auth-gate-decision.ts`,
`seller-access-decision.ts`, `admin-access-decision.ts`) and wrap them in a thin
`NextResponse` adapter — keeping the decision unit-testable without `next/server`.

## Cookies

`CookieManager` reads the client-visible markers:

```ts
import { cookieManager } from '@tukio/auth-client/cookies';
cookieManager.isAuthenticated(); // tukio-session-active === '1'
cookieManager.getCsrfToken(); // tukio-csrf-token
cookieManager.addCsrfHeader(headers); // X-CSRF-Token on Headers | Record
cookieManager.clearSession(); // clears the marker locally
```

See the runbooks for the full picture:

- `docs/runbook/login-flow-debug.md`
- `docs/runbook/cookie-architecture.md`
- `docs/runbook/refresh-token-rotation.md`
