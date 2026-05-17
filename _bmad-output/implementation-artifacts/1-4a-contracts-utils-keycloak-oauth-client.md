# Story 1.4a: `@tukio/contracts` (events + DTO + error codes) + gateway-api utils (pkce, state-jwt, cookie-helpers, redirect-resolver) + `KeycloakOAuthClient`

Status: ready-for-dev

> ℹ️ **Sub-story de [[1-4-login-flow-keycloak-authorization-code-pkce]]** — split via `/bmad-correct-course` 2026-05-17-bis
> (cf. `_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-17-bis.md`).
> Cette sub-story pose les **fondations contracts + utils + client externe** consommés par 1.4b/c/d.
> Zéro endpoint HTTP, zéro frontend.

## Story

**As a** dev backend qui prépare le login flow,
**I want** poser dans `@tukio/contracts` les schemas NATS events + DTO + error codes
nécessaires au login, et dans `apps/gateway-api/src/infrastructure/http/utils/` les
4 utils pure (PKCE materials gen, state JWT-signed encode/decode, cookie attribute
builders, post-login redirect resolver) + dans `apps/gateway-api/src/infrastructure/external/keycloak/`
le wrapper HTTP Keycloak OAuth (initiate redirect URL builder + code↔token exchange
+ refresh + logout via axios + axios-retry),
**so that** Stories 1.4b/c/d consomment des building blocks testés unitairement
sans risquer de re-coder du crypto / cookie attrs / redirect rules dans 5 endroits ;
et le pattern "infra layer pure logic isolated from controllers/use cases" reste
strictement aligné Pretre / Clean Architecture (cf. memory `feedback_clean_architecture_explicit.md`).

## Acceptance Criteria

1. **AC1 — `@tukio/contracts/events/identity/`** (NEW) :
   - `user-logged-in.v1.ts` (Zod schema strict) + `user-logged-in.v1.schema.json` (JSON Schema 2020-12 sync) : payload `{ userId, locale, role[], ipHash, userAgentHash, correlationId, occurredAt }`
   - Subject NATS : `identity.user.logged-in.v1`
   - Export via barrel `packages/contracts/src/index.ts` (subpath `@tukio/contracts/events/identity/user-logged-in.v1`)
   - 8 unit tests : parse OK + 6 invalid cases (missing fields / type mismatch / role enum invalide) + JSON schema sync check

2. **AC2 — `@tukio/contracts/dtos/identity/whoami-response.dto.ts`** (NEW) :
   - `WhoamiResponseSchema` Zod : `{ userId: UUID, email: string, role: UserRole[], status: UserStatus, locale: Locale, emailVerified: boolean, mfaEnabled: boolean }`
   - Export via index.ts subpath `@tukio/contracts/dtos/identity/whoami-response.dto`
   - 6 unit tests (happy + 5 invalid)

3. **AC3 — `@tukio/contracts/types/error-codes.ts`** (UPDATE Stories 1.2/1.3) — ajout 7 codes AUTH-* :
   - `AUTH-INVALID-STATE-001` (state JWT invalid/expired/tampered)
   - `AUTH-INVALID-CODE-001` (authorization code invalid/expired)
   - `AUTH-CSRF-MISMATCH-001` (X-CSRF-Token header ≠ cookie)
   - `AUTH-REFRESH-INVALID-001` (refresh token malformé)
   - `AUTH-REFRESH-EXPIRED-001` (refresh token expiré)
   - `AUTH-REFRESH-REUSED-001` (refresh token déjà utilisé — security alert)
   - `AUTH-EXTERNAL-001` (Keycloak DOWN / unreachable)
   - Tests : enum membership + i18n key existence (FR + EN dans `apps/public/messages/{fr,en}.json` namespace `errors.auth.*`)

4. **AC4 — `apps/gateway-api/src/infrastructure/http/utils/pkce.ts`** (NEW) :
   - `generatePkceMaterials()` → `{ verifier: string, challenge: string }`
   - `verifier` : 32 bytes random base64url (`crypto.randomBytes(32).toString('base64url')`)
   - `challenge` : `base64url(sha256(verifier))` via `crypto.createHash('sha256').update(verifier).digest('base64url')`
   - Unit tests : (a) determinism check `sha256(verifier) === decoded(challenge)`, (b) entropy check ≥32 bytes, (c) RFC 7636 char-set conformance (only `[A-Za-z0-9-_]`), (d) length verifier ≥ 43 chars

5. **AC5 — `apps/gateway-api/src/infrastructure/http/utils/state-jwt.ts`** (NEW) :
   - `encodeState({ next, requestId, issuedAt })` → JWT HS256 signed avec `STATE_JWT_HMAC_SECRET` (env var, ≥32 chars enforced)
   - `decodeState(token)` → payload `{ next, requestId, issuedAt }` OR throws `AuthInvalidStateException(AUTH-INVALID-STATE-001)`
   - TTL 10 min enforced via `exp` claim
   - Library : `jose` (déjà dep via Story 0.8 `@tukio/auth-client`)
   - Unit tests : roundtrip (8 cases) + expired (1) + wrong secret (1) + tampered payload (1) + missing required field (3)

6. **AC6 — `apps/gateway-api/src/infrastructure/http/utils/cookie-helpers.ts`** (NEW) :
   - `buildSessionCookies({ accessToken, refreshToken, csrfToken })` → 4 `Set-Cookie` strings
   - Attributs canoniques (cohérent spec parent AC3) :
     ```
     tukio-access-token   : HttpOnly; Secure; SameSite=Lax;    Domain=.tukio.one; Max-Age=300;     Path=/
     tukio-refresh-token  : HttpOnly; Secure; SameSite=Strict; Domain=.tukio.one; Max-Age=2592000; Path=/v1/auth
     tukio-session-active : HttpOnly:false; Secure; SameSite=Lax;    Domain=.tukio.one; Max-Age=2592000; Path=/
     tukio-csrf-token     : HttpOnly:false; Secure; SameSite=Strict; Domain=.tukio.one; Max-Age=2592000; Path=/
     ```
   - `buildClearCookies()` → 4 `Set-Cookie` Max-Age=0 (same names/Domain/Path)
   - `buildPkceStateCookie({ verifier, originalState })` → `Set-Cookie` HttpOnly+Secure+SameSite=Lax, Max-Age=600, value JWE-encrypted via `STATE_JWT_HMAC_SECRET`
   - Dev override : si `NODE_ENV=development` ET `TUKIO_DEV_INSECURE_COOKIES=1` → drop `Secure` flag (testcontainer + localhost)
   - Unit tests : 12 cases attribute matrix (4 cookies × 3 dimensions : prod / dev-secure / dev-insecure)

7. **AC7 — `apps/gateway-api/src/infrastructure/http/utils/redirect-resolver.ts`** (NEW) :
   - `resolvePostLoginRedirect(jwt, next, zoneBaseUrls)` → URL string
   - Decision matrix :
     | Condition JWT | Redirect |
     |---|---|
     | `realm_access.roles` contient `admin-*` && `amr` contient `totp` | `${ADMIN_URL}/{locale}/admin/dashboard` |
     | `realm_access.roles` contient `admin-*` && `amr` NE contient PAS `totp` | `${ADMIN_URL}/{locale}/auth/totp-setup` (placeholder Story 1.7) |
     | `realm_access.roles` contient `pro` && `tukio:status === 'pending_admin_review'` | `${SELLER_URL}/{locale}/seller/onboarding/pending` (FR17) |
     | `realm_access.roles` contient `pro` && `tukio:status === 'active'` | `${SELLER_URL}/{locale}/seller/dashboard` |
     | `realm_access.roles` contient `pro` && `tukio:status === 'rejected'` | `${SELLER_URL}/{locale}/seller/onboarding/rejected` (placeholder Story 2.5) |
     | `realm_access.roles` contient `client` | `${PUBLIC_URL}/{locale}/account/dashboard` (apex unifié ADR-016) |
   - Override : si `next` est whitelisted (`*.tukio.one` parsed via URL constructor, hostname check `endsWith('.tukio.one')` strict) → redirect vers `next` au lieu du default
   - `apps/customer/...` → `apps/public/...` apex unifié (ADR-016 — Customer-first signup acté 2026-05-17 : pas de logique special-case Pro signup, le rôle Pro est obtenu via conversion post-auth, cf. Story 1.3 v2)
   - Unit tests : 14 cases couvrant tous les rôles × locales × next-param (whitelist OK / XSS `javascript:` / open-redirect `evil.com` / data: URI / null)

8. **AC8 — `apps/gateway-api/src/infrastructure/external/keycloak/keycloak-oauth.client.ts`** (NEW) :
   - `KeycloakOAuthClient.buildAuthorizeUrl({ clientId, locale, challenge, state })` → string URL
     - Construit `${KEYCLOAK_URL}/realms/tukio/protocol/openid-connect/auth?response_type=code&client_id={clientId}&redirect_uri={PUBLIC_URL}/{locale}/auth/callback&code_challenge={challenge}&code_challenge_method=S256&state={state}&kc_locale={locale}&scope=openid profile email tukio-locale-scope`
   - `KeycloakOAuthClient.exchangeCodeForTokens({ code, verifier, locale, clientId })` → `{ accessToken, refreshToken, idToken, expiresIn, refreshExpiresIn, sessionState }` ou throws
   - `KeycloakOAuthClient.refreshTokens({ refreshToken, clientId })` → `{ accessToken, refreshToken, expiresIn, refreshExpiresIn }` ou throws
   - `KeycloakOAuthClient.revokeSession({ refreshToken, clientId })` → void
   - HTTP lib : axios + axios-retry exp [1s, 3s, 9s] sur 5xx + network errors
   - Errors translated to typed `KeycloakOAuthError` subclasses :
     - `KeycloakUnreachableError` → maps to `AUTH-EXTERNAL-001`
     - `KeycloakInvalidGrantError` → maps to `AUTH-INVALID-CODE-001` (callback) ou `AUTH-REFRESH-EXPIRED-001` (refresh)
     - `KeycloakRefreshReusedError` → maps to `AUTH-REFRESH-REUSED-001` (security alert event)
   - Unit tests : 18 cases (mock-nock pour les 4 méthodes happy + error paths : 400 invalid_grant + 401 unauthorized + 502 unreachable + 503 + timeout + 429)

9. **AC9 — Documentation + env vars** :
   - README `apps/gateway-api/src/infrastructure/http/utils/README.md` (NEW) : pattern d'usage des 4 utils
   - `apps/gateway-api/.env.example` (UPDATE) : `STATE_JWT_HMAC_SECRET` (req prod, validation length ≥32) + `ZONE_BASE_URL_PUBLIC` + `ZONE_BASE_URL_SELLER` + `ZONE_BASE_URL_ADMIN` + `KEYCLOAK_OAUTH_CLIENT_WEB_ID=tukio-web` + `KEYCLOAK_OAUTH_CLIENT_ADMIN_ID=tukio-admin`
   - `EnvironmentConfigService` (UPDATE) : `getStateJwtSecret()`, `getZoneBaseUrls() → { public, seller, admin }`, `getKeycloakOAuthConfig() → { url, realm, clientWebId, clientAdminId }`
   - `env.schema.ts` (UPDATE) : Zod validation des nouvelles vars (STATE_JWT_HMAC_SECRET min 32 chars, ZONE_BASE_URL_* must parse as URL with hostname `*.tukio.one` OR localhost in dev)
   - Coverage NFR71 : utils ≥ 90 %, client externe ≥ 85 %

## Tasks/Subtasks

- [ ] **Task 1** — `@tukio/contracts/events/identity/user-logged-in.v1.{ts,schema.json}` + barrel + 8 specs (AC1)
- [ ] **Task 2** — `@tukio/contracts/dtos/identity/whoami-response.dto.ts` + barrel + 6 specs (AC2)
- [ ] **Task 3** — `@tukio/contracts/types/error-codes.ts` extension 7 codes AUTH-* + i18n FR/EN keys (AC3)
- [ ] **Task 4** — `apps/gateway-api/.../utils/pkce.ts` + spec (AC4)
- [ ] **Task 5** — `apps/gateway-api/.../utils/state-jwt.ts` + spec (AC5)
- [ ] **Task 6** — `apps/gateway-api/.../utils/cookie-helpers.ts` + spec (AC6)
- [ ] **Task 7** — `apps/gateway-api/.../utils/redirect-resolver.ts` + spec (AC7)
- [ ] **Task 8** — `apps/gateway-api/.../external/keycloak/keycloak-oauth.client.ts` + spec (AC8)
- [ ] **Task 9** — README + .env.example + EnvironmentConfigService + env.schema.ts (AC9)
- [ ] **Task 10** — `pnpm lint && pnpm typecheck && pnpm test --filter=@tukio/contracts --filter=gateway-api` + coverage report

## Dev Notes

### Project Structure

```
packages/contracts/src/
├─ events/identity/user-logged-in.v1.{ts,schema.json}     # NEW
├─ dtos/identity/whoami-response.dto.ts                    # NEW
├─ types/error-codes.ts                                    # UPDATE — 7 AUTH-* codes
└─ index.ts                                                # UPDATE — barrels

apps/gateway-api/src/
├─ infrastructure/
│  ├─ external/keycloak/keycloak-oauth.client.ts           # NEW (+ .spec.ts)
│  ├─ http/utils/
│  │  ├─ pkce.ts                                           # NEW (+ .spec.ts)
│  │  ├─ state-jwt.ts                                      # NEW (+ .spec.ts)
│  │  ├─ cookie-helpers.ts                                 # NEW (+ .spec.ts)
│  │  ├─ redirect-resolver.ts                              # NEW (+ .spec.ts)
│  │  └─ README.md                                         # NEW
│  └─ config/
│     ├─ env.schema.ts                                     # UPDATE
│     └─ environment-config.service.ts                     # UPDATE
└─ .env.example                                            # UPDATE
```

### Critical Architecture Constraints

- **Pretre / Clean Architecture** : utils pure dans `infrastructure/http/utils/` — pas d'import depuis `domain/` ou `usecases/`. Le KeycloakOAuthClient est un adapter externe — pas d'usage direct dans use cases (les use cases Story 1.4b consommeront via UseCaseProxy module).
- **`jose` library** : déjà dep Story 0.8 (`@tukio/auth-client`), réutiliser. Si pas encore wiré côté gateway-api, ajouter dans `apps/gateway-api/package.json`.
- **Anti-énumération NFR9** : tous les error messages côté UI sont génériques. Les `tukioCode` AUTH-* sont logguées server-side mais le frontend affiche un message neutre via `auth.login.errors.generic` i18n key.
- **STATE_JWT_HMAC_SECRET** : généré une fois par environnement via `openssl rand -base64 32`. NEVER committed. Stocké dans droplet secrets (Story 0.12 pattern).
- **Pas de logique HTTP/controllers ici** — Story 1.4b consomme ces building blocks.

### Previous Story Intelligence

- **Story 1.2c** : pattern gateway-api scaffolding (Pretre légère + envelope + ThrottlerModule + Redis + HMAC signing) réutilisé Story 1.4b ; KeycloakOAuthClient suit le pattern axios + axios-retry de `IdentitySvcClient`.
- **Story 0.8** : `@tukio/auth-client` placeholders + `jose` lib + cookie patterns documentés ; Story 1.4a apporte les implémentations server-side gateway-api correspondantes.
- **Story 1.1** : 4 OIDC clients Keycloak + claim mappers (`tukio:locale`, `tukio:status`, `realm_access.roles`, `amr`) consommés par redirect-resolver (AC7).

### References

- [Source: _bmad-output/implementation-artifacts/1-4-login-flow-keycloak-authorization-code-pkce.md — Décisions techniques §§1-8]
- [Source: _bmad-output/planning-artifacts/architecture.md#CSRF — Lines 681-686 (double-submit pattern)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Authentication-Flow — Lines 1731-1738]
- [External: https://datatracker.ietf.org/doc/html/rfc7636 — PKCE OAuth 2.0]
- [External: https://datatracker.ietf.org/doc/html/rfc7519 — JWT (state-jwt utility)]
- [External: https://www.keycloak.org/docs/26.0/securing_apps/ — Keycloak OAuth endpoints]
- [Memory: feedback_clean_architecture_explicit.md]
- [Memory: feedback_tech_layer_english.md]

## Story Completion Status

- **Story Status** : `ready-for-dev`
- **Created** : 2026-05-17 (via /bmad-correct-course sprint-change-proposal-2026-05-17-bis.md)
- **Parent umbrella** : Story 1.4 (`split-umbrella`)
- **Estimation effort** : 1-1.5j
- **Dépendances upstream** :
  - Story 1.1 (Keycloak clients + claim mappers)
  - Story 1.2c (gateway-api scaffolding réutilisé)
  - Story 0.8 (`jose` lib via auth-client)
- **Dépendances downstream** :
  - **Story 1.4b** consomme : 4 utils + KeycloakOAuthClient + contracts (events/DTO/error-codes)
  - **Story 1.4c** consomme : error-codes (i18n keys), DTO whoami-response
  - **Story 1.4d** consomme : event `identity.user.logged-in.v1` (observability metrics)
- **Prochaine sub-story** : Story 1.4b
