# Runbook — Cookie Architecture

Story 1.4 (1.4a–1.4d) · Epic 1 — Identity & Authentication Backbone

The login flow uses **four cookies**. Two are HttpOnly (server-only secrets);
two are readable by client JS (UI signals). All are scoped `Domain=.tukio.one`
in production so they are shared across the apex + `seller.` + `admin.` zones.

## The four cookies

| Cookie | HttpOnly | Purpose | Set by | Read by |
|---|---|---|---|---|
| `tukio-access-token` | ✅ | Keycloak access JWT (short-lived ~5 min). Sent automatically on credentialed requests; **also decoded (no verify) by the Edge middlewares** for routing hints (role, status, email_verified). | gateway callback/refresh | gateway guards; middlewares (decode-only) |
| `tukio-refresh-token` | ✅ | Keycloak refresh token (longer-lived). Used only by `POST /v1/auth/refresh`. | gateway callback/refresh | gateway refresh endpoint |
| `tukio-session-active` | ❌ | `=1` marker: "a session exists". Cheap client check without exposing the JWT. | gateway callback | `CookieManager.isAuthenticated()`, middleware session gate, PublicHeader |
| `tukio-csrf-token` | ❌ | Double-submit CSRF token. Echoed as `X-CSRF-Token` on POST refresh/logout. | gateway callback | `CookieManager.getCsrfToken()` / `addCsrfHeader` |

> A transient fifth cookie, `tukio-pkce-state` (HttpOnly, JWE), carries the PKCE
> verifier + state between `/login` and `/callback`. It is cleared on callback.

## Attributes

```
Set-Cookie: tukio-access-token=…;   HttpOnly; Secure; SameSite=Lax; Domain=.tukio.one; Path=/; Max-Age=300
Set-Cookie: tukio-refresh-token=…;  HttpOnly; Secure; SameSite=Lax; Domain=.tukio.one; Path=/; Max-Age=1800
Set-Cookie: tukio-session-active=1;          Secure; SameSite=Lax; Domain=.tukio.one; Path=/; Max-Age=1800
Set-Cookie: tukio-csrf-token=…;              Secure; SameSite=Lax; Domain=.tukio.one; Path=/; Max-Age=1800
```

- **Dev** (`localhost`): `Secure` is dropped and `Domain` omitted (host-only) unless `DEV_INSECURE_COOKIES=1`. Cross-port (`:3000`↔`:4000`) relies on the server-side callback relay (Story 1.4c) because SameSite=Lax does not forward on a cross-port redirect.
- **Why `SameSite=Lax`** — login is a top-level navigation (Keycloak → callback), so Lax forwards the cookie while still blocking CSRF on cross-site POSTs.

## Lifecycle

1. **Login callback** → all four cookies set.
2. **Refresh** (`POST /v1/auth/refresh`) → rotates access + refresh + session + csrf.
3. **Logout** (`POST /v1/auth/logout`) → all cleared server-side (`Max-Age=0`); `CookieManager.clearSession()` also clears the client-readable marker locally for an instant UI update.

## email_verified note (Story 1.4d)

Story 1.2d introduced a `tukio-email-verified` HttpOnly cookie because the
middleware could not decode a JWT. Story 1.4d added an Edge-safe decoder
(`@tukio/auth-client/middleware/decode-jwt`), so the apex auth-gate now reads
`email_verified` **directly from the access-token JWT** — the single source of
truth. The `tukio-email-verified` cookie + its `/api/auth/sync-email-verified`
route are now vestigial (cleared on logout only) and can be removed in a
follow-up.

## Debug checklist

- Cookies missing after login → callback failed (see [login-flow-debug.md](./login-flow-debug.md)).
- `tukio-csrf-token` missing → POST refresh/logout will 403 (CsrfGuard). Re-login.
- Cross-zone session not shared → confirm `Domain=.tukio.one` (not host-only) in prod Set-Cookie.
