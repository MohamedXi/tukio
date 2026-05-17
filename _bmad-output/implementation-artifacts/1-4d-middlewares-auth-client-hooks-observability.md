# Story 1.4d: middlewares ×3 apps + `@tukio/auth-client` hooks finalize + axios interceptor + observability + e2e role-redirect

Status: ready-for-dev

> ℹ️ **Sub-story de [[1-4-login-flow-keycloak-authorization-code-pkce]]** — split via `/bmad-correct-course` 2026-05-17-bis
> (cf. `_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-17-bis.md`).
> Cette sub-story finalise le **flow end-to-end** : middlewares Next.js Edge runtime,
> hooks `@tukio/auth-client` (placeholders Story 0.8 → impls réelles), axios interceptor,
> Grafana dashboard, 3 runbooks. C'est la dernière brique avant que Stories 1.5+ et
> Epic 2-7 puissent consommer la session unifiée cross-zone.

## Story

**As a** dev fullstack qui finalise le login flow end-to-end,
**I want** finaliser les **3 middlewares** Next.js Edge runtime (apps/public unifié
gating auth-zones `/(authenticated)/...` + decode JWT cookie + role/status enforcement ;
apps/seller wiring complet decision logic Story 1.3 `pending_admin_review` + `active`
status checks ; apps/admin nouveau middleware role `admin-*` + TOTP `amr.totp` requirement
+ redirect `/auth/totp-setup` Story 1.7), finaliser les **hooks `@tukio/auth-client`**
(placeholders Story 0.8 → impls réelles : `useAuth`, `useLogout`, `useRole`, `useRequireRole`,
`RefreshTokenRotationManager` avec `BroadcastChannel` anti-thundering-herd cross-tabs,
`CookieManager` avec `getCsrfToken`/`addCsrfHeader` helpers), wirer l'**axios interceptor 401 → refresh**
dans `@tukio/api-client`, et poser l'**observability** (Grafana dashboard `auth-flow.json`
+ 3 runbooks login-flow-debug, cookie-architecture, refresh-token-rotation),
**so that** le login flow est complet, instrumenté, debuggable en prod, avec **session
unifiée cross-zone** (`Domain=.tukio.one`) opérationnelle pour Stories 1.5-1.9 et Epic 2-7.

## Acceptance Criteria

1. **AC1 — `apps/public/src/middleware.ts`** (UPDATE Story 0.14 + 1.2d) :
   - Conserve i18n (next-intl) + acquisition cookie Story 0.13/1.2d
   - **Ajoute auth gate** : requests sur `/(authenticated)/...` → check cookie `tukio-session-active=1` ; si absent → `NextResponse.redirect(new URL('/' + locale + '/auth/login?next=' + encodeURIComponent(originalUrl), req.url))`
   - **Decode JWT** access_token cookie via Story 1.4d helper `decode-jwt.ts` (`@tukio/auth-client/middleware`) → extract `realm_access.roles`, `tukio:status`, `email_verified`
   - Si JWT manquant (expired) malgré session-active → redirect refresh endpoint via header `X-Auth-Required: refresh` (frontend axios interceptor le voit et déclenche refresh) OU si force-reauth → redirect login
   - Si Customer accédant auth-zone sans `email_verified=true` → redirect `/{locale}/auth/verify-email-required` (placeholder Story 1.6)
   - Si role Pro accédant `apps/public/(authenticated)/...` → redirect `seller.tukio.one/{locale}/seller/dashboard` (cross-zone)
   - Si role Admin accédant `apps/public/(authenticated)/...` → redirect `admin.tukio.one/{locale}/admin/dashboard`
   - 12 unit tests vitest (auth-gate, JWT decode malformed, role mismatch, expired token, missing email_verified, etc.)

2. **AC2 — `apps/seller/src/middleware.ts`** (UPDATE Story 1.3d v2) :
   - Wiring complet `decidePendingRedirect` Story 1.3 + `tukio:status` strict enforcement
   - `pending_admin_review` → whitelist `/seller/onboarding/*` + `/seller/profile/*` + `/seller/messaging/*`, sinon redirect `/{locale}/seller/onboarding/pending`
   - `active` → no-op (toutes routes seller autorisées)
   - `rejected` → redirect `/{locale}/seller/onboarding/rejected` (placeholder Story 2.5)
   - Missing/expired JWT → redirect cross-zone `tukio.one/{locale}/auth/login?next=https://seller.tukio.one/{locale}/seller/...`
   - Réutilise les 11 unit tests existants Story 1.3d (à compléter si besoin)

3. **AC3 — `apps/admin/src/middleware.ts`** (NEW) :
   - Role enforcement : JWT `realm_access.roles` doit contenir `admin-*` (admin-super OR admin-modo) ; sinon → redirect `tukio.one/{locale}/` (Customer-first par default — l'admin sans rôle n'a rien à faire ici)
   - TOTP enforcement : JWT `amr` doit contenir `totp` ; sinon → redirect `/{locale}/auth/totp-setup` (placeholder Story 1.7)
   - Missing/expired JWT → redirect cross-zone `tukio.one/{locale}/auth/login?clientId=tukio-admin&next=https://admin.tukio.one/{locale}/admin/...`
   - 10 unit tests vitest

4. **AC4 — `packages/auth-client/src/providers/auth-provider.tsx`** (Story 0.8 finalize) :
   - Fetch `/v1/auth/whoami` au mount via `@tukio/api-client` (cookie auto-sent)
   - Hydrate React Context : `{ user, role, status, locale, isAuthenticated, isLoading, error }`
   - Auto-rotate access_token via `RefreshTokenRotationManager` AC6 (interval 60s avant expiration)
   - 14 unit tests vitest + @testing-library/react (Provider mount happy + fetch error + refresh trigger + logout broadcast + unmount cleanup + etc.)

5. **AC5 — `packages/auth-client/src/hooks/*.ts`** (Story 0.8 finalize) :
   - `useAuth()` → reads React Context, returns `{ user, role, status, locale, isAuthenticated, isLoading }`
   - `useLogout()` → mutation `POST /v1/auth/logout` avec `addCsrfHeader()` (AC7) ; on success → broadcast `loggedOut` + redirect `window.location.assign('/' + locale + '/')`
   - `useRole()` → `'customer' | 'pro' | 'admin' | null` (extract from JWT role[])
   - `useRequireRole(role)` → throws Component-level error if role insufficient (defense in depth — middleware fait l'enforcement primaire)
   - 18 unit tests vitest

6. **AC6 — `packages/auth-client/src/refresh/refresh-token-rotation.ts`** (Story 0.8 finalize) :
   - `RefreshTokenRotationManager` class :
     - `start()` : setTimeout 60s avant access_token expiration (5 min - 60s = 4 min)
     - `refreshNow()` : POST `/v1/auth/refresh` avec `addCsrfHeader()` ; on success → reschedule + broadcast `tokenRefreshed` ; on fail (401 REUSED/EXPIRED) → broadcast `loggedOut` + clear interval
     - `stop()` : clearTimeout + close BroadcastChannel
   - BroadcastChannel `'tukio-auth'` cross-tabs :
     - Listener `tokenRefreshed` → cancel own timer + reschedule depuis new expiration (sync with refresher tab)
     - Listener `loggedOut` → redirect login
   - Anti-thundering-herd : 1 seul tab refresh à la fois (premier tab à atteindre l'interval acquire un lock via BroadcastChannel + sessionStorage `auth-refresh-lock-{timestamp}`)
   - 10 unit tests vitest avec fake timers + BroadcastChannel mock

7. **AC7 — `packages/auth-client/src/cookies/cookie-manager.ts`** (Story 0.8 finalize) :
   - `getCsrfToken()` → lit cookie `tukio-csrf-token` (non-HttpOnly) via `js-cookie` ; returns string | null
   - `addCsrfHeader(headers: Headers | Record<string, string>)` → add `X-CSRF-Token: <token>` si présent
   - `isAuthenticated()` → lit cookie `tukio-session-active` ; returns boolean
   - `clearLocalSessionCache()` → no-op MVP (cookies cleared par backend logout endpoint)
   - 8 unit tests vitest avec js-cookie mock

8. **AC8 — `packages/auth-client/src/middleware/decode-jwt.ts`** (NEW) :
   - Helper Edge-runtime safe pour `decodeJwt(token: string)` via `jose.decodeJwt` (no signature verify — gateway-api/services downstream font la vérif via JWKS Story 0.8)
   - Throws `JwtMalformedError` si invalide
   - Returns `{ sub, email, realm_access: { roles: string[] }, 'tukio:locale': string, 'tukio:status': string, email_verified: boolean, amr: string[], exp: number, iat: number }`
   - 6 unit tests vitest (happy + malformed + missing claims + expired + invalid base64 + tampered)

9. **AC9 — `packages/api-client/src/client.ts`** (UPDATE Story 0.9) :
   - axios response interceptor :
     ```ts
     if (error.response?.status === 401 && error.response?.data?.error?.tukioCode === 'AUTH-EXPIRED-001') {
       try {
         await RefreshTokenRotationManager.getInstance().refreshNow();
         return axios.request(error.config); // retry original request
       } catch (refreshError) {
         BroadcastChannel.postMessage('loggedOut');
         throw refreshError;
       }
     }
     ```
   - Retry max 1x (sinon infinite loop)
   - 8 unit tests vitest avec axios-mock-adapter

10. **AC10 — Playwright e2e `apps/{public,seller,admin}/e2e/middleware/role-redirect.spec.ts`** (3 files NEW) :
    - `apps/public/e2e/middleware/role-redirect.spec.ts` (4 cases × 2 locales) :
      - Customer auth-zone sans JWT → redirect login
      - Customer auth-zone sans email_verified → redirect verify-email-required
      - Pro accédant `/account/...` → redirect `seller.tukio.one/{locale}/seller/dashboard`
      - Admin accédant `/account/...` → redirect `admin.tukio.one`
    - `apps/seller/e2e/middleware/role-redirect.spec.ts` (3 cases × 2 locales) :
      - Pro `pending_admin_review` accédant `/seller/dashboard` → redirect onboarding/pending
      - Pro `active` → no-op (200 dashboard rendered)
      - Pro `rejected` → redirect onboarding/rejected
    - `apps/admin/e2e/middleware/role-redirect.spec.ts` (3 cases × 2 locales) :
      - Customer accédant `/admin/...` → redirect `tukio.one`
      - Admin sans TOTP → redirect TOTP setup
      - Admin avec TOTP → no-op (200 dashboard rendered)
    - Total : 20 cases (10 × 2 locales)

11. **AC11 — Observability** :
    - `infra/k8s/grafana-dashboards/auth-flow.json` (NEW) — 6 panels :
      - Login rate by outcome (initiate / success / error / error-by-tukioCode)
      - Callback latency p50 / p95 / p99
      - Refresh rate + reuse-detected rate (security alert)
      - Logout rate
      - Whoami latency
      - Errors AUTH-* breakdown by code
    - prom-client metrics gateway-api `apps/gateway-api/src/infrastructure/metrics/auth.metrics.ts` (NEW) :
      - `tukio_auth_login_total{outcome=initiate|success|error}` counter
      - `tukio_auth_callback_duration_seconds` histogram (buckets [0.05, 0.1, 0.5, 1, 3, 5, 10])
      - `tukio_auth_refresh_total{outcome=success|reused|expired|failed}` counter
      - `tukio_auth_logout_total` counter
      - `tukio_auth_whoami_total{outcome=success|error}` counter
      - `tukio_auth_errors_total{code=AUTH-*}` counter
    - Wired dans `AuthLoginController` Story 1.4b (via metrics.startTimer / metrics.observe pattern Story 0.6)
    - 3 runbooks `docs/runbook/` (NEW) :
      - `login-flow-debug.md` — triage layered frontend / gateway / Keycloak / cookies
      - `cookie-architecture.md` — pattern 4 cookies (purpose, attrs, lifecycle, debug)
      - `refresh-token-rotation.md` — Keycloak rotation reuse=0, anti-thundering-herd cross-tabs, security alerts

12. **AC12 — Coverage NFR71** :
    - gateway-api 5 use cases auth: ≥ 90 % (validé Story 1.4b)
    - frontend hooks `useAuth`/`useLogout`/`useRole`/`useRequireRole`: ≥ 80 %
    - `AuthProvider` + `RefreshTokenRotation` + `CookieManager`: ≥ 80 %
    - middlewares 3 apps: ≥ 85 %

## Tasks/Subtasks

- [ ] **Task 1** — `packages/auth-client/src/middleware/decode-jwt.ts` + spec (AC8)
- [ ] **Task 2** — `apps/public/src/middleware.ts` extension auth-gate + JWT decode (AC1) + 12 unit specs
- [ ] **Task 3** — `apps/seller/src/middleware.ts` finalize status enforcement (AC2) + tests
- [ ] **Task 4** — `apps/admin/src/middleware.ts` NEW + spec (AC3) + 10 unit specs
- [ ] **Task 5** — `packages/auth-client/src/providers/auth-provider.tsx` finalize (AC4) + 14 specs
- [ ] **Task 6** — `packages/auth-client/src/hooks/{use-auth,use-logout,use-role,use-require-role}.ts` finalize (AC5) + 18 specs
- [ ] **Task 7** — `packages/auth-client/src/refresh/refresh-token-rotation.ts` finalize BroadcastChannel + interval (AC6) + 10 specs
- [ ] **Task 8** — `packages/auth-client/src/cookies/cookie-manager.ts` finalize (AC7) + 8 specs
- [ ] **Task 9** — `packages/api-client/src/client.ts` axios interceptor (AC9) + 8 specs
- [ ] **Task 10** — `apps/gateway-api/src/infrastructure/metrics/auth.metrics.ts` + wire dans AuthLoginController Story 1.4b (AC11 metrics)
- [ ] **Task 11** — `infra/k8s/grafana-dashboards/auth-flow.json` (AC11 dashboard)
- [ ] **Task 12** — 3 runbooks `docs/runbook/{login-flow-debug,cookie-architecture,refresh-token-rotation}.md` (AC11 runbooks)
- [ ] **Task 13** — 3 Playwright spec files `apps/{public,seller,admin}/e2e/middleware/role-redirect.spec.ts` (AC10)
- [ ] **Task 14** — `packages/auth-client/README.md` (UPDATE Story 0.8) — section "Login flow integration" + diagram
- [ ] **Task 15** — Validation `pnpm lint && pnpm typecheck && pnpm test:cov` per workspace + Playwright local docker:up

## Dev Notes

### Project Structure

```
packages/auth-client/src/
├─ middleware/decode-jwt.ts                                # NEW (+ .spec.ts)
├─ providers/auth-provider.tsx                             # UPDATE — finalize fetch whoami + context
├─ hooks/
│  ├─ use-auth.ts                                          # UPDATE — finalize
│  ├─ use-logout.ts                                        # UPDATE — finalize
│  ├─ use-role.ts                                          # UPDATE — finalize
│  └─ use-require-role.ts                                  # UPDATE — finalize
├─ refresh/refresh-token-rotation.ts                       # UPDATE — finalize BroadcastChannel + interval
├─ cookies/cookie-manager.ts                               # UPDATE — finalize CSRF helpers
└─ README.md                                               # UPDATE — section Login flow

packages/api-client/src/
└─ client.ts                                               # UPDATE — axios interceptor 401 → refresh (+ .spec.ts)

apps/public/src/
├─ middleware.ts                                           # UPDATE — auth gate + JWT decode + 12 unit specs
└─ e2e/middleware/role-redirect.spec.ts                    # NEW

apps/seller/src/
├─ middleware.ts                                           # UPDATE — status enforcement finalize
└─ e2e/middleware/role-redirect.spec.ts                    # NEW

apps/admin/src/
├─ middleware.ts                                           # NEW + 10 unit specs
└─ e2e/middleware/role-redirect.spec.ts                    # NEW

apps/gateway-api/src/infrastructure/metrics/
└─ auth.metrics.ts                                         # NEW

infra/k8s/grafana-dashboards/
└─ auth-flow.json                                          # NEW

docs/runbook/
├─ login-flow-debug.md                                     # NEW
├─ cookie-architecture.md                                  # NEW
└─ refresh-token-rotation.md                               # NEW
```

### Critical Architecture Constraints

- **Edge runtime compat** : `decode-jwt.ts` via `jose.decodeJwt` Edge-runtime safe (pas `jsonwebtoken` qui require Node). Middlewares Next.js doivent rester Edge-runtime.
- **BroadcastChannel API** : Chrome 54+, Firefox 38+, Safari 15.4+ — fallback feature-detect `if (typeof BroadcastChannel !== 'undefined')` ; sinon no-op single-tab refresh (V1 fallback acceptable MVP)
- **Anti-thundering-herd** : pattern documenté Story 0.8 — 1 tab acquière un lock via `sessionStorage` timestamp + broadcast `tokenRefreshed` quand done
- **Cookies cross-zone** : `Domain=.tukio.one` (gateway-api Story 1.4a/b setting) → automatiquement readable par middlewares 3 apps (Edge runtime peut lire cookies via `req.cookies`)
- **CSRF double-submit** : `tukio-csrf-token` (non-HttpOnly) lu via `getCsrfToken()` → ajouté header `X-CSRF-Token` sur POST refresh/logout (AC7 cookie-manager)
- **JWT signature verify** : middlewares ne vérifient PAS la signature (Edge runtime + perf) — services downstream le font via `KeycloakJwtGuard` (Story 0.8). Middlewares font juste un decode pour extraire claims pour redirect logic.
- **Customer-first** : middleware `apps/public` ne special-case pas role Pro signup ; toute logique Pro conversion vit dans Story 1.3 v2 (déjà livré).

### Previous Story Intelligence

- **Story 0.8** : 🔴 **TOUTE LA BASE** : `@tukio/auth-client` placeholders posés Story 0.8, finalisés ici. KeycloakJwtGuard + JWKS validation déjà opérationnelle backend.
- **Story 0.9** : `@tukio/testing` + Playwright config pattern utilisé pour les 3 e2e role-redirect specs
- **Story 0.13** : Next.js multi-zones rewrites + acquisition cookie middleware pattern (apps/public) — étendu auth-gate
- **Story 1.2d** : Pattern middleware apps/public (i18n + acquisition cookie) — auth-gate ajouté sans casser l'existant
- **Story 1.3d v2** : Middleware apps/seller `decidePendingRedirect` Story 1.3 partiel ; Story 1.4d finalize avec status enforcement complet (active / rejected)

### What this story does NOT do

- ❌ Page `/auth/totp-setup` (placeholder) → Story 1.7
- ❌ Page `/auth/verify-email-required` (placeholder) → Story 1.6
- ❌ Page `/seller/onboarding/rejected` (placeholder) → Story 2.5
- ❌ Audit log consume `identity.user.logged-in.v1` → Story 1.10 + Story 2.7
- ❌ Notification feed in-app (V1+ Epic 11)
- ❌ Social login Google/Apple (V1+ FR5)

### References

- [Source: 1-4-login-flow-keycloak-authorization-code-pkce.md AC7-9 + Décisions techniques §5-6-7]
- [Source: 1-4a/b/c (consume tout l'enchaînement)]
- [Source: architecture.md#CSRF — Lines 681-686]
- [Source: architecture.md#Authentication-Flow — Lines 1731-1738]
- [Source: 0-8-setup-tukio-auth-backend-frontend.md (placeholders à finalize)]
- [Memory: project_signup_flow_customer_first.md]

## Story Completion Status

- **Story Status** : `ready-for-dev`
- **Created** : 2026-05-17 (via /bmad-correct-course sprint-change-proposal-2026-05-17-bis.md)
- **Parent umbrella** : Story 1.4 (`split-umbrella`)
- **Estimation effort** : 2-2.5j
- **Dépendances upstream** :
  - **Story 1.4a + 1.4b + 1.4c** (tout le flow opérationnel) — 🔴 blocking
  - Story 0.8 (`@tukio/auth-client` placeholders)
  - Story 0.13 (Vercel rewrites cross-zone)
- **Dépendances downstream** :
  - **Stories 1.5/1.6/1.7/1.8/1.9** + Epic 2-7 (toutes pages authentifiées consomment AuthProvider + middlewares Story 1.4d)
- **Prochaine umbrella** : Story 1.5 (password reset flow) — à recadrer également via /bmad-correct-course (Customer-first + apps/public refs à auditer)
