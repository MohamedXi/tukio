# Runbook — Refresh Token Rotation

Story 1.4 (1.4a–1.4d) · Epic 1 — Identity & Authentication Backbone

Silent access-token rotation, anti-thundering-herd across tabs, and reuse
detection. Frontend manager: `@tukio/auth-client/refresh/refresh-token-rotation`.
Backend endpoint: `POST /v1/auth/refresh` (CsrfGuard).

## How it works

```
AuthProvider mount (session present)
  → RefreshTokenRotationManager.start(expiresIn=300)
      → setTimeout((expiresIn - 60)s)  // refresh ~60s before expiry
          → refreshNow():
               POST /v1/auth/refresh  (X-CSRF-Token, credentials:include)
               ├─ 200 → read expiresIn → reschedule → broadcast {tokenRefreshed, at, expiresIn}
               ├─ 401/403 → broadcast {loggedOut} → onLoggedOut() (clear session, redirect)
               └─ 5xx / network → reschedule short retry (~15s), no logout
```

The api-client **401 interceptor** (AC9) also calls `refreshNow()` reactively:
any request that 401s with `AUTH-NOT-AUTHENTICATED-002` triggers one refresh
then retries the original request exactly once.

## Keycloak rotation (reuse = 0)

Keycloak is configured with **refresh token rotation**: each refresh issues a
new refresh token and invalidates the previous one. Re-presenting an old
refresh token (token **reuse** — e.g. a stolen token replayed) is rejected →
`tukio_auth_refresh_total{outcome="reused"}`. Treat a non-zero reuse rate as a
**security signal** (possible token theft), not routine churn.

## Anti-thundering-herd (cross-tab)

`BroadcastChannel('tukio-auth')` coordinates tabs:

- The tab that refreshes broadcasts `{tokenRefreshed, at, expiresIn}`.
- Other tabs record `at`; when their own timer fires within
  `RECENT_REFRESH_SKIP_MS` (60s) of `at`, they **skip** their refresh and
  resync their timer to the broadcast `expiresIn`.
- A `{loggedOut}` broadcast makes every tab tear down + redirect.

Within a single tab, concurrent callers (rotation timer + 401 interceptor)
share one **in-flight promise** so only one network refresh happens.

> Deviation from the AC6 "sessionStorage lock": sessionStorage is per-tab and
> cannot coordinate across tabs — the BroadcastChannel skip window is the real
> cross-tab guard; the in-flight promise is the intra-tab guard.

## Symptom → triage

| Symptom | Likely cause | Action |
|---|---|---|
| Users logged out every ~5 min | refresh not scheduled / failing | Check `tukio_auth_refresh_total`; confirm `refreshAuth` wired in `createTukioApiClient` and `AuthProvider` started the manager |
| `reused` outcome spiking | token theft OR a tab replaying an old token | Investigate as a security incident; check for shared cookies across untrusted contexts |
| Multiple simultaneous refreshes (load spike at expiry) | BroadcastChannel unavailable (old browser) | Acceptable degradation — single-tab fallback; each tab refreshes independently |
| Refresh 403 (not 401) | CSRF cookie missing/stale | Re-login to reset `tukio-csrf-token`; see [cookie-architecture.md](./cookie-architecture.md) |

## Tuning constants (`refresh-token-rotation.ts`)

| Constant | Default | Meaning |
|---|---|---|
| `REFRESH_BUFFER_S` | 60 | refresh this many seconds before expiry |
| `DEFAULT_EXPIRES_IN_S` | 300 | assumed access-token lifetime before the first refresh response |
| `RECENT_REFRESH_SKIP_MS` | 60 000 | cross-tab skip window |
| `TRANSIENT_RETRY_MS` | 15 000 | backoff after 5xx/network failure |
| `MIN_DELAY_MS` | 5 000 | timer floor (avoid busy-loop on near-expired tokens) |
