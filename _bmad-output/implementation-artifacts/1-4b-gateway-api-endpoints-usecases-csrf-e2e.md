# Story 1.4b: gateway-api 5 login endpoints + 5 use cases (Pretre) + `CsrfGuard` + e2e Keycloak testcontainer

Status: ready-for-dev

> ℹ️ **Sub-story de [[1-4-login-flow-keycloak-authorization-code-pkce]]** — split via `/bmad-correct-course` 2026-05-17-bis
> (cf. `_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-17-bis.md`).
> Cette sub-story finalise le **backend login complet** côté gateway-api.
> Consomme les 4 utils + KeycloakOAuthClient + contracts de Story 1.4a.

## Story

**As a** dev backend qui finalise le login flow côté gateway-api,
**I want** wirer les **5 endpoints HTTP** (`GET /v1/auth/login` initiate, `GET /v1/auth/callback`
exchange, `POST /v1/auth/refresh` rotation, `POST /v1/auth/logout` revoke, `GET /v1/auth/whoami`
session info) dans `AuthLoginController`, avec **5 use cases Pretre** (`InitiateLoginUseCase`,
`HandleCallbackUseCase`, `RefreshTokenUseCase`, `LogoutUseCase`, `WhoamiUseCase`) consommant
les utils + KeycloakOAuthClient Story 1.4a via `UseCasesProxyModule`, **`CsrfGuard`** appliqué
aux 2 POST (refresh + logout) en double-submit pattern, **rate limiting** ThrottlerModule
(login 10/min/IP, refresh 30/min/IP), **envelope ADR-014** pour les endpoints JSON
(refresh + logout + whoami), **redirect 302** pour login + callback,
**so that** le backend login est complet, testé end-to-end avec Keycloak testcontainer
réel (Story 0.9 + bootstrap-realm Story 1.1), et prêt à être consommé par le frontend Story 1.4c.

## Acceptance Criteria

1. **AC1 — `InitiateLoginUseCase`** (NEW `apps/gateway-api/src/usecases/auth/initiate-login.usecase.ts`) :
   - Input : `{ next: string | undefined, clientId: 'tukio-web' | 'tukio-admin', locale: 'fr' | 'en' }`
   - Génère PKCE materials (Story 1.4a `pkce.ts`) → `{ verifier, challenge }`
   - Encode state JWT (Story 1.4a `state-jwt.ts`) avec `{ next: sanitizedNext, requestId: uuid, issuedAt: ISO }`
   - Build pkce state cookie value (JWE-encrypted `{ verifier, originalState }`) via `cookie-helpers.ts`
   - Appelle `KeycloakOAuthClient.buildAuthorizeUrl({ clientId, locale, challenge, state })`
   - Return : `{ redirectUrl: string, pkceCookie: { name: 'tukio-pkce-state', value, opts } }`
   - Unit tests : 8 cases (happy Customer + clientId admin + next whitelisted `*.tukio.one` + next non-whitelisted sanitized null + locale fr + locale en + missing next + missing clientId default tukio-web)

2. **AC2 — `HandleCallbackUseCase`** (NEW `apps/gateway-api/src/usecases/auth/handle-callback.usecase.ts`) :
   - Input : `{ code: string, state: string, locale: 'fr' | 'en', pkceCookie: string }`
   - Decrypt pkceCookie → `{ verifier, originalState }` ; si fail → throws `AuthInvalidStateException(AUTH-INVALID-STATE-001)`
   - Decode state JWT (`state-jwt.ts`) → `{ next, requestId, issuedAt }` ; check `originalState === state` strict ; check TTL ≤ 10 min ; sinon throws
   - `KeycloakOAuthClient.exchangeCodeForTokens({ code, verifier, locale, clientId: tukio-web })` → tokens
   - Decode access_token (jose `decodeJwt`) → claims `{ sub, email, realm_access.roles, tukio:locale, tukio:status, email_verified, amr }`
   - `resolvePostLoginRedirect(jwt, next, zoneBaseUrls)` → URL string (Story 1.4a `redirect-resolver.ts`)
   - `buildSessionCookies({ accessToken, refreshToken, csrfToken: crypto.randomBytes(32) })` (Story 1.4a) → 4 cookies
   - Emit `identity.user.logged-in.v1` NATS event (fire-and-forget MVP, pas d'outbox côté gateway-api — documenté ADR-014)
   - Return : `{ redirectUrl, cookies: SessionCookies[], clearPkceCookie: ClearCookie }`
   - Unit tests : 16 cases (Customer + Pro pending + Pro active + Pro rejected + Admin + next override + 6 error paths : invalid state / expired state / tampered state / invalid code / Keycloak DOWN / refresh reused detection during initial exchange)

3. **AC3 — `RefreshTokenUseCase`** (NEW `apps/gateway-api/src/usecases/auth/refresh-token.usecase.ts`) :
   - Input : `{ refreshToken: string }`
   - `KeycloakOAuthClient.refreshTokens({ refreshToken, clientId: tukio-web })` → tokens
   - Si `KeycloakRefreshReusedError` → throws `AuthRefreshReusedException(AUTH-REFRESH-REUSED-001)` + log security alert (Pino warn level)
   - Si `KeycloakInvalidGrantError` → throws `AuthRefreshExpiredException(AUTH-REFRESH-EXPIRED-001)`
   - Si `KeycloakUnreachableError` → throws `AuthExternalException(AUTH-EXTERNAL-001)`
   - `buildSessionCookies({ accessToken, refreshToken: newRefresh, csrfToken: existing })` → 4 cookies
   - Return : `{ cookies, expiresIn, refreshExpiresIn }`
   - Unit tests : 9 cases (happy + expired + reused detection + Keycloak DOWN + race concurrent + missing refresh + malformed refresh + rotation reuse-once + token TTL boundary)

4. **AC4 — `LogoutUseCase`** (NEW `apps/gateway-api/src/usecases/auth/logout.usecase.ts`) :
   - Input : `{ refreshToken: string | undefined }`
   - Si refreshToken présent → `KeycloakOAuthClient.revokeSession({ refreshToken, clientId: tukio-web })`
   - Si Keycloak DOWN → log warn mais ne fail PAS (idempotent UX — cookies clear coté frontend même si Keycloak n'a pas pu invalider)
   - Return : `{ cookies: ClearCookies[] }`
   - Unit tests : 4 cases (happy + no refresh idempotent + Keycloak DOWN graceful + revoke success but cookies still cleared)

5. **AC5 — `WhoamiUseCase`** (NEW `apps/gateway-api/src/usecases/auth/whoami.usecase.ts`) :
   - Input : `{ actor: Actor }` (injecté via `@CurrentActor()` après `KeycloakJwtGuard` Story 0.8)
   - Mappe `Actor` → `WhoamiResponse` DTO (Story 1.4a `whoami-response.dto.ts`)
   - Pas d'appel Keycloak Admin (info dans JWT uniquement, MVP — Story 1.10 ajoutera reconciliation si nécessaire)
   - Return : `WhoamiResponse`
   - Unit tests : 5 cases (Customer + Pro + Admin + actor without role + actor with multiple roles)

6. **AC6 — `AuthLoginController`** (NEW `apps/gateway-api/src/infrastructure/http/controllers/auth-login.controller.ts`) :
   - Squelette spec parent ligne 545-622 réutilisé
   - 5 endpoints wirés via UseCaseProxy tokens
   - Decorators :
     - `@Get('login')` + `@Public()` + `@Throttle({ default: { limit: 10, ttl: 60_000 } })`
     - `@Get('callback')` + `@Public()`
     - `@Post('refresh')` + `@Public()` + `@UseGuards(CsrfGuard)` + `@Throttle({ default: { limit: 30, ttl: 60_000 } })` + `@HttpCode(200)`
     - `@Post('logout')` + `@Public()` + `@UseGuards(CsrfGuard)` + `@HttpCode(200)`
     - `@Get('whoami')` + `@UseGuards(KeycloakJwtGuard)` (Story 0.8)
   - JSON responses (refresh/logout/whoami) wrapped envelope ADR-014 via `EnvelopeExceptionFilter` Story 0.6
   - 302 redirects (login/callback) : `res.redirect(302, redirectUrl)` après `res.cookie(...)` calls

7. **AC7 — `CsrfGuard`** (NEW `apps/gateway-api/src/infrastructure/http/guards/csrf.guard.ts`) :
   - Implements `CanActivate`
   - Read header `X-CSRF-Token` + cookie `tukio-csrf-token`
   - Si mismatch (ou absent l'un OR l'autre) → throws `AuthCsrfMismatchException(AUTH-CSRF-MISMATCH-001)` (ForbiddenException 403 wrapped envelope)
   - Constant-time comparison via `crypto.timingSafeEqual` (anti-timing-attack)
   - Unit tests : 6 cases (match OK + header missing + cookie missing + mismatch + tampered cookie + timing-safe verification)

8. **AC8 — `EnvironmentConfigService`** (UPDATE Story 1.4a) :
   - Validations Zod env.schema.ts pour 5 nouveaux vars : `KEYCLOAK_OAUTH_CLIENT_WEB_ID=tukio-web` (default), `KEYCLOAK_OAUTH_CLIENT_ADMIN_ID=tukio-admin` (default), `STATE_JWT_HMAC_SECRET` (req prod, min 32 chars), `ZONE_BASE_URL_PUBLIC` + `ZONE_BASE_URL_SELLER` + `ZONE_BASE_URL_ADMIN`
   - Méthodes : `getKeycloakOAuthConfig()`, `getStateJwtSecret()`, `getZoneBaseUrls()`, `getCsrfTimingSafe()` returns `boolean`

9. **AC9 — `app.module.ts`** (UPDATE Story 1.2c) :
   - Wire `AuthLoginController`
   - Import `ThrottlerModule.forFeature` scopes login (10/60s) + refresh (30/60s)
   - Wire 5 use cases dans `UseCasesProxyModule` (5 PROXY tokens : `INITIATE_LOGIN`, `HANDLE_CALLBACK`, `REFRESH_TOKEN`, `LOGOUT`, `WHOAMI`)
   - Wire `KeycloakOAuthClient` module + `CsrfGuard` provider

10. **AC10 — Tests E2E `apps/gateway-api/test/auth/`** (5 spec files NEW) :
    - `auth-login.e2e-spec.ts` : 5 cases
      - 302 redirect vers `auth.tukio.one/realms/tukio/.../auth?...&code_challenge=...&code_challenge_method=S256&state=...` + cookie `tukio-pkce-state` set
      - `clientId=tukio-admin` → query `client_id=tukio-admin`
      - `next=https://customer.tukio.one/...` → propagé dans state JWT
      - `next=https://evil.com/` → sanitized to null
      - `code_challenge` vérifié = base64url(sha256(verifier extracted from pkce cookie))
    - `auth-callback.e2e-spec.ts` : 9 cases avec testcontainer Keycloak réel (Story 0.9 helper + bootstrap-realm Story 1.1)
      - Customer success → 302 redirect `tukio.one/{locale}/account/dashboard` + 4 cookies set + pkce cookie cleared
      - Pro `pending_admin_review` → redirect `seller.tukio.one/{locale}/seller/onboarding/pending`
      - Pro `active` → redirect `seller.tukio.one/{locale}/seller/dashboard`
      - Pro `rejected` → redirect `seller.tukio.one/{locale}/seller/onboarding/rejected`
      - Admin TOTP → redirect `admin.tukio.one/{locale}/admin/dashboard`
      - `next=https://customer.tukio.one/account/messages` whitelisted → redirect vers next
      - Invalid code → 400 + redirect login `?error=invalid_grant`
      - Invalid state (tampered) → 400 + redirect login
      - Keycloak DOWN (mock) → 502 + redirect login `?error=service_unavailable`
    - `auth-refresh.e2e-spec.ts` : 6 cases
      - Valid refresh + CSRF OK → 200 + 2 new cookies set (access + refresh rotated)
      - Invalid CSRF (mismatch) → 403 `AUTH-CSRF-MISMATCH-001`
      - Expired refresh → 401 `AUTH-REFRESH-EXPIRED-001` + cookies cleared
      - Reused refresh (rotation detected) → 401 `AUTH-REFRESH-REUSED-001` + cookies cleared + warn logged
      - Concurrent refresh race → 1 success, 1 401 reuse
      - Keycloak DOWN → 502
    - `auth-logout.e2e-spec.ts` : 4 cases
      - Logout authenticated → 200 + cookies cleared + Keycloak session count decreased
      - Logout already-logged-out (no cookies) → 200 idempotent
      - Logout sans CSRF → 403
      - Logout with Keycloak DOWN → 200 + cookies cleared (UX idempotent)
    - `auth-whoami.e2e-spec.ts` : 5 cases
      - Customer JWT → 200 envelope with WhoamiResponse
      - Pro JWT → 200 with role=['pro']
      - Admin JWT → 200 with role=['admin-super']
      - No JWT → 401
      - Expired JWT → 401

11. **AC11 — Coverage NFR71** : use cases ≥ 90 %, controller + guards ≥ 85 %, e2e specs all pass

## Tasks/Subtasks

- [ ] **Task 1** — Scaffold 5 use cases dans `apps/gateway-api/src/usecases/auth/` + colocated .spec.ts
- [ ] **Task 2** — Implement `InitiateLoginUseCase` + tests (AC1)
- [ ] **Task 3** — Implement `HandleCallbackUseCase` + tests (AC2)
- [ ] **Task 4** — Implement `RefreshTokenUseCase` + tests (AC3)
- [ ] **Task 5** — Implement `LogoutUseCase` + tests (AC4)
- [ ] **Task 6** — Implement `WhoamiUseCase` + tests (AC5)
- [ ] **Task 7** — Implement `CsrfGuard` + tests (AC7)
- [ ] **Task 8** — Implement `AuthLoginController` (AC6)
- [ ] **Task 9** — Wire `app.module.ts` + `UseCasesProxyModule` + `ThrottlerModule.forFeature` (AC9) + EnvironmentConfigService (AC8)
- [ ] **Task 10** — Setup testcontainer Keycloak fixture (réutilise Story 0.9 helper + bootstrap-realm Story 1.1) — créer `test/auth/keycloak-testcontainer.fixture.ts`
- [ ] **Task 11** — Implement 5 e2e spec files (AC10) — 29 cases totale
- [ ] **Task 12** — Run `pnpm lint && pnpm typecheck && pnpm test:cov --filter=gateway-api` + verify coverage thresholds (AC11)
- [ ] **Task 13** — Smoke test local : `pnpm docker:up:wait && pnpm docker:bootstrap` puis curl `GET /v1/auth/login` doit redirect Keycloak

## Dev Notes

### Project Structure

```
apps/gateway-api/src/
├─ usecases/auth/
│  ├─ initiate-login.usecase.{ts,spec.ts}                  # NEW
│  ├─ handle-callback.usecase.{ts,spec.ts}                 # NEW
│  ├─ refresh-token.usecase.{ts,spec.ts}                   # NEW
│  ├─ logout.usecase.{ts,spec.ts}                          # NEW
│  └─ whoami.usecase.{ts,spec.ts}                          # NEW
├─ infrastructure/
│  ├─ http/
│  │  ├─ controllers/auth-login.controller.ts              # NEW
│  │  └─ guards/csrf.guard.{ts,spec.ts}                    # NEW
│  ├─ usecases-proxy/usecases-proxy.module.ts              # UPDATE — 5 PROXY tokens
│  └─ config/environment-config.service.ts                 # UPDATE — methods AC8
└─ test/auth/
   ├─ keycloak-testcontainer.fixture.ts                    # NEW (réutilise @tukio/testing Story 0.9)
   ├─ auth-login.e2e-spec.ts                               # NEW
   ├─ auth-callback.e2e-spec.ts                            # NEW
   ├─ auth-refresh.e2e-spec.ts                             # NEW
   ├─ auth-logout.e2e-spec.ts                              # NEW
   └─ auth-whoami.e2e-spec.ts                              # NEW
```

### Critical Architecture Constraints

- **Pretre / Clean Architecture** : 5 use cases dans `usecases/auth/` consomment exclusivement via ports (KeycloakOAuthClient, utils via DI). Pas d'import direct depuis controller.
- **UseCaseProxy pattern** (Story 0.6 baseline) : tokens `INITIATE_LOGIN_USECASES_PROXY`, etc. — symmetry parfaite avec Stories 1.2/1.3
- **CSRF double-submit** (NFR13 + Architecture lignes 681-686) : `tukio-csrf-token` cookie (non-HttpOnly) lu côté JS frontend → mis dans header X-CSRF-Token sur POST/PUT/PATCH/DELETE → backend compare via constant-time
- **Refresh token rotation native Keycloak** (Story 1.1 realm config `attributes.refresh.token.max.reuse: 0`) : toute réutilisation détectée → Keycloak 400 invalid_grant → traduit `KeycloakRefreshReusedError` → `AuthRefreshReusedException`
- **Anti-thundering-herd refresh cross-tabs** : Story 1.4d wirera côté client (BroadcastChannel) — Story 1.4b backend ne fait pas de lock distribué
- **NATS audit event** : `identity.user.logged-in.v1` fire-and-forget (pas d'outbox côté gateway-api MVP). Si NATS down → log warn mais HTTP response success (callback ne doit pas fail pour un audit event)
- **Rate limiting** : ThrottlerModule Redis (Story 1.2c baseline) — scopes spécifiques login/refresh ; logout pas de scope (peu fréquent + besoin idempotency)

### Previous Story Intelligence

- **Story 1.2c** : pattern gateway-api Pretre + ThrottlerModule Redis + envelope + EnvelopeExceptionFilter — réutilisé tel quel. Pattern `IdentitySvcClient` HMAC = template pour `KeycloakOAuthClient` (Story 1.4a)
- **Story 1.3c** : pattern Public + Throttle + Forwarder réutilisé
- **Story 0.6** : Pattern Pretre canonical reference identity-svc (UseCaseProxy module + envelope)
- **Story 0.8** : `KeycloakJwtGuard` + `@CurrentActor()` decorator pour whoami endpoint
- **Story 0.9** : `@tukio/testing` testcontainer Keycloak helper (à valider disponible — sinon dépendance bloquante à clarifier en début de Task 10)
- **Story 1.1** : bootstrap-realm CLI pour spin Keycloak réel dans testcontainer ; 4 OIDC clients (`tukio-web`, `tukio-admin`)

### What this story does NOT do

- ❌ Frontend page login + callback route handler → Story 1.4c
- ❌ AuthProvider wiring + hooks finalize → Story 1.4d
- ❌ Middlewares apps/{public,seller,admin} → Story 1.4d
- ❌ Grafana dashboard + runbooks → Story 1.4d
- ❌ Stories 1.5/1.6/1.7/1.8/1.9 (cf. liste spec parent)

### References

- [Source: 1-4-login-flow-keycloak-authorization-code-pkce.md AC2-5 (endpoints) + Tasks 3-6 (use cases)]
- [Source: 1-4a-contracts-utils-keycloak-oauth-client.md (consume utils + client)]
- [Source: architecture.md#Authentication-Flow — Lines 1731-1738]
- [Source: architecture.md#CSRF — Lines 681-686]
- [Source: architecture.md#API-Security — Lines 699-708 (rate limiting)]
- [External: https://www.keycloak.org/docs/26.0/securing_apps/]

## Story Completion Status

- **Story Status** : `ready-for-dev`
- **Created** : 2026-05-17 (via /bmad-correct-course sprint-change-proposal-2026-05-17-bis.md)
- **Parent umbrella** : Story 1.4 (`split-umbrella`)
- **Estimation effort** : 2j
- **Dépendances upstream** :
  - **Story 1.4a** (contracts + utils + KeycloakOAuthClient) — 🔴 blocking
  - Story 0.8 (KeycloakJwtGuard + @CurrentActor)
  - Story 0.9 (@tukio/testing Keycloak helper)
  - Story 1.1 (Keycloak realm + bootstrap CLI)
  - Story 1.2c (gateway-api scaffolding)
- **Dépendances downstream** :
  - **Story 1.4c** consomme : 5 endpoints opérationnels
  - **Story 1.4d** consomme : metrics hooks + audit event published
- **Prochaine sub-story** : Story 1.4c
