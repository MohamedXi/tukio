# Runbook — Login Flow Debug

Story 1.4 (1.4a–1.4d) · Epic 1 — Identity & Authentication Backbone

Layered triage for the Authorization-Code + PKCE login flow. Work top-down:
frontend → gateway-api → Keycloak → cookies.

## Flow Overview

```
Browser (tukio.one / seller. / admin.)
  → GET  /v1/auth/login?client_id=&locale=&next=   (gateway-api :4000, @Public, @Throttle 10/min)
       └─ 302 → Keycloak /authorize (PKCE S256, state+verifier in tukio-pkce-state JWE cookie)
  → Keycloak login page (theme `tukio`)
  → 302 → apps/public /{locale}/auth/callback        (Next.js Route Handler)
       └─ server-side relay → GET /v1/auth/callback?code=&state=&locale=
            ├─ exchange code → tokens (Keycloak /token)
            ├─ Set-Cookie ×4: tukio-access-token (HttpOnly), tukio-refresh-token (HttpOnly),
            │                  tukio-session-active=1, tukio-csrf-token
            └─ 302 → resolvePostLoginRedirect(role,status,next)
  → AuthProvider mount → GET /v1/auth/whoami → hydrate { user, role, status, locale }
  → RefreshTokenRotationManager.start() → POST /v1/auth/refresh ~60s before expiry
```

**correlation-id** — `X-Tukio-Correlation-Id` propagates browser → gateway. Every log line includes it.

## Prometheus signals (Story 1.4d AC11)

| Metric | Meaning |
|---|---|
| `tukio_auth_login_total{outcome}` | initiate / success / error counts |
| `tukio_auth_callback_duration_seconds` | code→token exchange latency (p50/p95/p99) |
| `tukio_auth_refresh_total{outcome}` | success / reused / expired / failed |
| `tukio_auth_logout_total` | revoke calls |
| `tukio_auth_whoami_total{outcome}` | session hydration calls |
| `tukio_auth_errors_total{code}` | AUTH-* error breakdown |

## Symptom → triage

### "After login the header still shows Connexion/Inscription"

1. Confirm `tukio-session-active=1` cookie is set (DevTools → Application → Cookies). If absent → callback never completed; see callback section.
2. Confirm `GET /v1/auth/whoami` returns 200 with a body (Network tab). 401 → access token cookie missing/expired.
3. Confirm `<AuthProvider>` wraps the header (apex layout). `useAuth()` reads its context; without the provider the header is stuck logged-out. (Story 1.4d AC13 wired the apex layout.)

### Login redirect loops / `?error=` on the login page

- `error=invalid_request` on `/auth/login` → callback hit without `code`/`state` (user cancelled, or the `tukio-pkce-state` cookie was dropped). Check the cookie survives the Keycloak round-trip (SameSite=Lax, top-level navigation).
- `tukio_auth_errors_total{code="AUTH-INVALID-STATE-…"}` rising → PKCE state mismatch; verify `PKCE_COOKIE_HMAC_SECRET` and `JWE` secret are consistent across gateway replicas.

### whoami 401 even though session-active is set

- Access token expired and refresh hasn't run yet → the api-client 401 interceptor (AC9) should refresh-then-retry. Confirm `refreshAuth` is wired into `createTukioApiClient`.
- If refresh also 401s → refresh token expired/reused → expected logout. Check `tukio_auth_refresh_total{outcome="reused"|"expired"}`.

### Cross-zone redirect wrong (Pro lands on apex, Admin on seller, …)

- Middleware decodes the access-token JWT for routing. Verify the `realm_access.roles` + `tukio:status` claims are present (decode the token at jwt.io). Missing `tukio:status` → check the `tukio-locale-scope` protocol mapper is attached to the client.

## See also

- [cookie-architecture.md](./cookie-architecture.md) — the 4-cookie model.
- [refresh-token-rotation.md](./refresh-token-rotation.md) — rotation + cross-tab.
