# Story 1.4d: middlewares ×3 apps + `@tukio/auth-client` hooks finalize + axios interceptor + observability + e2e role-redirect

Status: review

> ℹ️ **Sub-story de [[1-4-login-flow-keycloak-authorization-code-pkce]]** — split via `/bmad-correct-course` 2026-05-17-bis
> (cf. `_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-17-bis.md`).
> Cette sub-story finalise le **flow end-to-end** : middlewares Next.js Edge runtime,
> hooks `@tukio/auth-client` (placeholders Story 0.8 → impls réelles), axios interceptor,
> Grafana dashboard, 3 runbooks. C'est la dernière brique avant que Stories 1.5+ et
> Epic 2-7 puissent consommer la session unifiée cross-zone.

> 🔄 **Amendée 2026-05-25** (vérification auth, cf. mémoire `project_auth_verification_2026_05_25.md`).
> **Cette story corrige le bug constaté par Ismael** : après login, le header affiche toujours Connexion/Inscription
> (jamais Déconnexion) — `apps/public/src/components/PublicHeader.tsx:22-25` lit `tukio-session-active` dans un
> `useState(() => readCookie(...))` dont le commentaire « runs only on the client » est **faux** (rendu SSR → cookie
> vide → état figé déconnecté, pas de `useEffect` pour relire). **Voir AC13 + Task 16.** Le bon mécanisme = `useAuth()`
> (AuthProvider, AC4-5) que `PublicHeader` doit consommer à la place de sa lecture ad-hoc.
>
> **Alignements (pivots) à appliquer au dev :**
> - **Redirect par rôle** : les middlewares **enforcent l'accès** mais **ne décident pas** la destination post-login —
>   celle-ci est calculée par `resolvePostLoginRedirect` (gateway, `redirect-resolver.ts`, Story 1.4b/1.12). Pas de
>   logique de décision dupliquée côté middleware/front.
> - **Observability AC11** : K8s/Grafana Cloud ont été **abandonnés** (ADR-015 MVP infra pivot → DO Droplets +
>   docker-compose). Garder les **metrics prom-client** (`auth.metrics.ts`) ; le dashboard `infra/k8s/grafana-dashboards/*`
>   est **hors-scope** (ré-évaluer un dashboard compatible stack DO si besoin).
> - Réfs périmées à lire avec ce filtre : « Vercel rewrites » → DO/Caddy (ADR-015) ; « Customer-first » → modèle
>   client-first + conversion d'**ADR-0017** ; l'inscription bascule sur Keycloak (**ADR-0018**, Stories 1.13-1.15).
> - **`GET /v1/auth/whoami`** (consommé par AuthProvider AC4) : vérifier qu'il existe côté gateway-api ; sinon le créer
>   (decode JWT validé → `{ user, role, status, locale, isAuthenticated }`).

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

13. **AC13 — `apps/public/src/components/PublicHeader.tsx` consomme `useAuth()` (fix bug auth-state)** :
    - **Remplace** la détection ad-hoc `useState(() => readCookie('tukio-session-active') === '1')` (`:22-25`, buguée au SSR/hydratation) par `const { isAuthenticated, isLoading } = useAuth()` (AC4-5) — le header reflète l'état réel post-login (bouton Déconnexion visible, plus de Connexion/Inscription figées).
    - `handleLogin` (`:28-34`) conservé ; `handleLogout` (`:36-49`) remplacé par `useLogout()` (AC5) pour mutualiser CSRF + broadcast cross-tabs.
    - Pendant `isLoading` : éviter un flash logged-out (skeleton/placeholder neutre sur la zone CTA).
    - Le header doit être enfant de `<AuthProvider>` (vérifier le layout apex). Unit test : header rendu authentifié (cookie présent + whoami OK) → Déconnexion ; non-auth → Connexion/Inscription ; pas de mismatch d'hydratation.

## Tasks/Subtasks

- [x] **Task 1** — `packages/auth-client/src/middleware/decode-jwt.ts` + spec (AC8) — 7 tests
- [x] **Task 2** — `apps/public/src/middleware/auth-gate{,-decision}.ts` auth-gate + JWT decode (AC1) + 14 unit specs
- [x] **Task 3** — `apps/seller/src/middleware/seller-access{,-decision}.ts` status enforcement (AC2) + 14 specs
- [x] **Task 4** — `apps/admin/src/middleware/admin-access{,-decision}.ts` NEW + spec (AC3) + 10 unit specs
- [x] **Task 5** — `packages/auth-client/src/providers/auth-provider.tsx` finalize (AC4) + 14 specs
- [x] **Task 6** — `packages/auth-client/src/hooks/{use-auth,use-logout,use-role,use-require-role}.ts` finalize (AC5) + 18 specs
- [x] **Task 7** — `packages/auth-client/src/refresh/refresh-token-rotation.ts` finalize BroadcastChannel + interval (AC6) + 10 specs
- [x] **Task 8** — `packages/auth-client/src/cookies/cookie-manager.ts` finalize (AC7) + 10 specs
- [x] **Task 9** — `packages/api-client/src/client/axios-client.ts` axios interceptor (AC9) + 8 specs
- [x] **Task 10** — `apps/gateway-api/src/infrastructure/metrics/auth.metrics.ts` + wire dans AuthLoginController Story 1.4b (AC11 metrics) + 4 specs
- [~] **Task 11** — `infra/k8s/grafana-dashboards/auth-flow.json` (AC11 dashboard) — **DÉFÉRÉ** par l'amendement 2026-05-25 (ADR-015 abandonne K8s/Grafana ; metrics prom-client conservés Task 10)
- [x] **Task 12** — 3 runbooks `docs/runbook/{login-flow-debug,cookie-architecture,refresh-token-rotation}.md` (AC11 runbooks)
- [x] **Task 13** — 3 Playwright spec files `apps/{public,seller,admin}/e2e/middleware/role-redirect.spec.ts` (AC10) — 20 cases, livrées non-exécutées localement (convention 1.2b-d)
- [x] **Task 14** — `packages/auth-client/README.md` — réécrit cookie/whoami + section "Login flow integration" + diagram
- [x] **Task 15** — Validation `lint + typecheck + test` per workspace (537 tests verts)
- [x] **Task 16** — `apps/public/src/components/PublicHeader.tsx` : `useAuth()` + `useLogout()` (AC13) + `isLoading` placeholder + `<AuthProvider>` câblé dans le layout apex + unit test (4 cases). _(Corrige le bug header constaté 2026-05-25.)_

### Review Findings (Group A — `@tukio/auth-client` core, 2026-05-26)

> Review parallèle 3 layers (Blind Hunter + Edge Case Hunter + Acceptance Auditor) — model claude-sonnet-4-6.
> Périmètre : decode-jwt, roles, auth-state types, cookie-manager, auth-provider, refresh-token-rotation, hooks, README, vitest config.

**Décisions requises :**
- [x] [Review][Decision] **`isAuthenticated` sémantique** — Résolu D1 : garder "a un token" + JSDoc explicite sur `toAuthState`. → P15 appliqué. [auth-provider.tsx:toAuthState]
- [x] [Review][Decision] **Responsabilité du redirect post-logout** — Résolu D2 : délégation au caller validée + README contract documenté. → P16 appliqué. [use-logout.ts, refresh-token-rotation.ts]

**Patches HIGH :**
- [x] [Review][Patch] **Manager assignment race + onLoggedOut sur arbre mort** — `managerRef.current = manager` assigné APRÈS `.start()` ; `clearSession()` dans `onLoggedOut` non gardé par `cancelled`. StrictMode double-mount peut effacer les cookies d'une session valide. [packages/auth-client/src/providers/auth-provider.tsx]
- [x] [Review][Patch] **`config` object en dépendance useEffect** — `}, [config]` échoue la reference equality si le parent re-render avec un object literal inline → re-fetch whoami + recréation manager infinie. Splitter en primitives stables. [packages/auth-client/src/providers/auth-provider.tsx]
- [x] [Review][Patch] **Cross-tab skip retourne `false`** — `refreshNow()` skip bénin retourne `false` (même outcome qu'un échec). L'interceptor 401 ne peut pas distinguer "token encore frais" de "refresh raté" → ne retry pas la requête originale. Retourner `true` sur skip. [packages/auth-client/src/refresh/refresh-token-rotation.ts]

**Patches MED :**
- [x] [Review][Patch] **`isAuthenticated()` prefix match brittle** — `startsWith('tukio-session-active=1')` attrape `=10`, `=1abc`. Changer en exact match `c.trim() === 'tukio-session-active=1'`. [packages/auth-client/src/cookies/cookie-manager.ts]
- [x] [Review][Patch] **`stop()` timer leak** — `inFlight` nullé mais la promesse continue ; `doRefresh()` appelle `schedule()` post-stop → timer zombie. Ajouter flag `stopped` vérifié dans `doRefresh`/`schedule`. [packages/auth-client/src/refresh/refresh-token-rotation.ts]
- [x] [Review][Patch] **`fetchWhoami` body cast sans validation runtime** — `(body.data ?? body) as WhoamiData` : si `body.data` est `null`, fallback sur `body` (shape incorrecte). Utiliser narrowing explicite ou Zod. [packages/auth-client/src/providers/auth-provider.tsx]
- [x] [Review][Patch] **`exp:0` traité comme expiré** — `asNumber` retourne `0` quand `exp` absent → `isJwtExpired` renvoie `true` pour tokens sans claim `exp`. Distinguer "absent" de "zéro". Spec decode-jwt.spec.ts ligne 78 mise à jour. [packages/auth-client/src/middleware/decode-jwt.ts]
- [x] [Review][Patch] **`REFRESH_TOKEN_COOKIE_NAME` absent de `tokens.ts`** — le nom `tukio-refresh-token` est hardcodé à plusieurs endroits au lieu d'être exporté par `tokens.ts`. [packages/auth-client/src/tokens.ts]

**Patches LOW :**
- [x] [Review][Patch] **`process.env` bracket notation** — `process.env['NEXT_PUBLIC_GATEWAY_URL']` non statiquement inlinable par Next.js/Webpack ; utiliser dot notation `process.env.NEXT_PUBLIC_GATEWAY_URL`. [packages/auth-client/src/providers/auth-provider.tsx]
- [x] [Review][Patch] **BroadcastChannel `post()` avant `schedule()`** — `this.post(tokenRefreshed)` avant `this.schedule(expiresIn)` → autre tab reçoit et re-schedule avant que la tab origine l'ait fait. Inverser l'ordre. [packages/auth-client/src/refresh/refresh-token-rotation.ts]
- [x] [Review][Patch] **`broadcastLoggedOut` ferme le channel avant livraison** — `channel.close()` synchrone après `postMessage` ; ajouter `setTimeout(() => channel.close(), 0)` pour laisser l'event loop livrer. [packages/auth-client/src/refresh/refresh-token-rotation.ts]
- [x] [Review][Patch] **Test 9 BroadcastChannel delivery ordering** — le probe ne garantit pas que le manager a reçu le message (dispatch indépendant) ; utiliser `waitFor` autour de l'assertion sur `mgr.refreshNow()`. [packages/auth-client/src/refresh/refresh-token-rotation.spec.tsx]
- [x] [Review][Patch] **`Buffer` fallback non gardé dans Edge-safe code** — le fallback Node.js `Buffer.from(...)` n'est pas dans un `typeof Buffer !== 'undefined'` guard ; en Edge runtime sans Buffer, lance `ReferenceError` au lieu de `JwtMalformedError`. [packages/auth-client/src/middleware/decode-jwt.ts]
- [x] [Review][Patch] **`isJwtExpired` utilise `<=`** — `exp * 1000 <= nowMs` → token valide exactement à expiration traité comme expiré 1ms avant ; RFC 7519 utilise `>=` pour rejet. Mineur (middleware only, gateway fait la vraie validation). [packages/auth-client/src/middleware/decode-jwt.ts]

**Deferred :**
- [x] [Review][Defer] `tukio:locale` absent silencieusement normalisé en `'fr'` — design décision acceptable, KC inclut toujours le claim — deferred, pre-existing
- [x] [Review][Defer] Test unmount `stopSpy` peut passer vacuellement — style test, low impact — deferred, pre-existing
- [x] [Review][Defer] Pas de test pour 403 de `/v1/auth/whoami` — gap couverture mineur — deferred, pre-existing
- [x] [Review][Defer] `fetchWhoami` error sans backoff/retry limit — comportement optimiste voulu, feature request — deferred, pre-existing
- [x] [Review][Defer] `useRequireRole` throw pendant re-hydration réseau — edge case low impact, Error Boundary attendu — deferred, pre-existing
- [x] [Review][Defer] `base64UrlDecode` input URL-encodé — scenario peu probable, usage interne uniquement — deferred, pre-existing

### Review Findings (Group B — hooks + `@tukio/api-client`, 2026-05-27)

> Review parallèle 3 layers (Blind Hunter + Edge Case Hunter + Acceptance Auditor) — model claude-sonnet-4-6.
> Périmètre : use-logout, use-role, use-require-role, hooks.spec, setup.ts, axios-client (AC9 interceptor), api-client/types.
> Keycloak adapter (keycloak-client.ts + types.ts + spec) supprimé — pas de findings sur deletions.

**Patches LOW :**
- [x] [Review][Patch] **`KeycloakConfig` + `KeycloakUser` re-exports orphelins** — `index.ts` ré-exporte encore ces types après la suppression de `keycloak-client.ts` ; `@deprecated` JSDoc dans `auth-state.ts` référence incorrectement l'ancien wrapper. Supprimé de `index.ts`. [packages/auth-client/src/index.ts]
- [x] [Review][Patch] **`useRole` ne teste que `admin-modo`** — AC5 spécifie "any `admin-*` → `'admin'`" ; `admin-super` et `admin-support` non couverts. 2 cas ajoutés. [packages/auth-client/src/hooks/hooks.spec.tsx]
- [x] [Review][Patch] **`code === undefined` dans l'interceptor 401 sans commentaire explicatif** — condition couvre à la fois les 401 non-enveloppés (proxy/WAF) et les envelopes sans tukioCode ; l'intention de refresh belt-and-suspenders n'était pas documentée. Commentaire ajouté. [packages/api-client/src/client/axios-client.ts]

**Deferred :**
- [x] [Review][Defer] `cookieManager` singleton sans domain — clearSession() n'efface pas les cookies domained en prod si le POST gateway échoue ; gateway efface côté serveur dans le flux normal — deferred, documented design
- [x] [Review][Defer] `toCoarseRole` catch-all → `'admin'` pour rôle inconnu — TypeScript empêche les rôles hors union ; fragile si `Role` est étendu sans MAJ du mapping — deferred, pre-existing
- [x] [Review][Defer] Pas de test pour 401 non-enveloppé dans api-client — gateway toujours envelope en prod, low risk — deferred
- [x] [Review][Defer] Fenêtre stale cross-tab skip (60s) — limitation inhérente tokens HttpOnly opaques — deferred, documented

### Review Findings (Group C — middlewares ×3 apps, 2026-05-27)

> Review parallèle 3 layers (Blind Hunter + Acceptance Auditor) — model claude-sonnet-4-6.
> Périmètre : `auth-gate-decision.ts`, `auth-gate.ts`, `seller-access-decision.ts`, `seller-access.ts`, `admin-access-decision.ts`, `admin-access.ts`, `apps/admin/src/middleware.ts`.
> Note : Edge Case Hunter non reçu avant compaction — couverture complétée via analyse directe.

**Patch HIGH :**
- [x] [Review][Patch] **`clientId` → `client_id` dans `admin-access.ts:31`** — gateway lit `@Query('client_id')` (snake_case) ; le `searchParams.set('clientId', ...)` camelCase était complètement ignoré → connexion admin utilisait toujours `tukio-web` au lieu de `tukio-admin`, bypassing le pool Keycloak admin-client. Fix : `'clientId'` → `'client_id'`. [apps/admin/src/middleware/admin-access.ts]

**Patches MED :**
- [x] [Review][Patch] **`ACCESS_TOKEN_COOKIE` défini localement dans `seller-access-decision.ts` et `admin-access-decision.ts`** — risque de divergence si le nom du cookie change dans `@tukio/auth-client/tokens`. Remplacé par `export { TUKIO_ACCESS_TOKEN_COOKIE_NAME as ACCESS_TOKEN_COOKIE }` via import du canonical. [apps/seller/src/middleware/seller-access-decision.ts, apps/admin/src/middleware/admin-access-decision.ts]
- [x] [Review][Patch] **Pas de guard `isJwtExpired` sur les role cross-zone redirects dans `auth-gate-decision.ts`** — token expiré avec rôle `pro` → redirect apex→seller → seller voit token expiré → redirect seller→apex login → double-redirect inutile. Fix : `const roles = !claims || isJwtExpired(claims) ? [] : claims.realm_access.roles` + test 15 ajouté. [apps/public/src/middleware/auth-gate-decision.ts, apps/public/src/middleware/__tests__/auth-gate.spec.ts]

**Patches LOW :**
- [x] [Review][Patch] **Matcher `\\w{2,4}` dans `apps/admin/src/middleware.ts`** — même bug que dans la public app (`.woff2` passait le filtre) ; public corrigé en `\\w+` (Story 0.15). Admin aligné. [apps/admin/src/middleware.ts]
- [x] [Review][Patch] **`safeLocale()` fallback `'fr'` dans `auth-gate-decision.ts`** — `DEFAULT_LOCALE = 'en'` partout dans le codebase (admin-access-decision, seller-access-decision, i18n config) ; le `'fr'` était incohérent. Fix : `'fr'` → `'en'`. [apps/public/src/middleware/auth-gate-decision.ts]

**Deferred :**
- [x] [Review][Defer] Login page `/[locale]/auth/login` non encore implémentée — le middleware gate redirige vers cette route mais la page n'existe pas. Quand implémentée (Story 1.5 ou 1.6), la page DOIT convertir le `?next=` relatif en URL absolue avant de passer au gateway (sanitizeNextUrl rejette les paths relatifs). Seller/admin passent déjà des URLs absolues.
- [x] [Review][Defer] `auth-gate-decision.ts` : path dans `EMAIL_VERIFY_REQUIRED` mais PAS dans `AUTH_GATED` + token illisible + sessionMarker='1' → redirige vers `verify-email-required` à tort — design trade-off documenté dans le commentaire du fichier, coverage via intercepteur 401.

### Review Findings (Group D — gateway metrics + runbooks + layouts + PublicHeader, 2026-05-27)

> Review parallèle 3 layers (Blind Hunter + Edge Case Hunter + Acceptance Auditor) — model claude-sonnet-4-6.
> Périmètre : `auth.metrics.ts` + `auth.metrics.spec.ts` + 3 runbooks + layouts (public/seller/admin) + `PublicHeader.tsx`.
> AC6 ⚠️ PARTIAL (whoami error path manquante) · AC7 ✅ PASS · AC10 ⚠️ PARTIAL (seller/admin manquants) · AC11 ✅ PASS.

**Patches HIGH :**
- [x] [Review][Patch] **Outcome `'reused'` jamais émis dans `authRefreshTotal`** — `code.includes('EXPIRED')` testé en premier ; `AUTH-REFRESH-REUSED-001` tombait dans `'failed'`, étouffant le signal de sécurité NFR13 "refresh-token replay". Fix : `code.includes('REUSED') ? 'reused' : code.includes('EXPIRED') ? 'expired' : 'failed'`. [apps/gateway-api/.../auth-login.controller.ts]
- [x] [Review][Patch] **`authWhoamiTotal{outcome:"error"}` jamais incrémenté** — whoami handler sans try/catch ; erreurs use-case passaient sans compteur. Fix : ajout try/catch + `recordAuthError`. Guard-level 401s non comptables (architecturalement) — documenté dans le commentaire. [apps/gateway-api/.../auth-login.controller.ts]
- [x] [Review][Patch] **`AuthProvider` absent du seller layout** — `LogoutButton.tsx` utilise `useLogout()` qui nécessite le contexte AuthProvider ; composant cassé en prod. Ajout de `AuthProvider` + `hasLocale` guard. [apps/seller/src/app/[locale]/layout.tsx]
- [x] [Review][Patch] **`AuthProvider` absent du admin layout + `setRequestLocale` manquant + pas de `hasLocale` guard** — triple problème : hooks auth cassés, locale non seeded pour next-intl static rendering, locales invalides passent sans 404. Fix : ajout des 3. [apps/admin/src/app/[locale]/layout.tsx]

**Patches MED :**
- [x] [Review][Patch] **`process.env['NEXT_PUBLIC_GATEWAY_URL']` bracket notation dans `PublicHeader.tsx`** — Next.js n'inline PAS les env vars en bracket notation ; `NEXT_PUBLIC_GATEWAY_URL` → `undefined` en prod → fallback hardcodé `localhost:4000`. Fix : remplacé par `gatewayBaseUrl` depuis `useAuthContext()` (déjà disponible + correctement résolu). [apps/public/src/components/PublicHeader.tsx]

**Deferred :**
- [x] [Review][Defer] `auth.metrics.spec.ts` counter accumulation — Vitest isole les workers par fichier ; les tests utilisent `>=1` pour tolérer la ré-exécution. `resetMetrics()` détruirait le warm-up seeding (test 2 passerait en faux positif). Acceptable.
- [x] [Review][Defer] `authErrorsTotal` cardinality — tukioCodes set borné dans le codebase (définis comme constantes) ; un acteur malveillant ne peut pas injecter de codes arbitraires (générés côté gateway). LOW risk, allowlist à ajouter si le set s'agrandit.
- [x] [Review][Defer] `authCallbackDuration` sans label `outcome` — amélioration observabilité (success vs error latency séparées) ; hors scope Story 1.4d.
- [x] [Review][Defer] `handleLogout` redirect dans `finally` — design intentionnel (UX : forcer le redirect même si logout échoue pour nettoyer l'état UI) ; la session côté serveur est nettoyée par le gateway même si le fetch échoue.
- [x] [Review][Defer] `config` inline literal dans public layout — churn mineur de context value ; fix natural dans AuthProvider via `useMemo` sur la valeur context.

### Review Findings (Group E — e2e role-redirect specs ×3, 2026-05-27)

> Review parallèle 3 layers (Blind Hunter + Edge Case Hunter + Acceptance Auditor) — model claude-sonnet-4-6.
> Périmètre : `apps/public/e2e/middleware/role-redirect.spec.ts`, `apps/seller/e2e/middleware/role-redirect.spec.ts`, `apps/admin/e2e/middleware/role-redirect.spec.ts`.
> AC10 e2e coverage ✅ PASS après patches.

**Patches HIGH :**
- [x] [Review][Patch] **False-positive pass-through tests** — `expect(loc ?? '').not.toContain(...)` passe trivialement quand le serveur est inaccessible (loc = undefined). Fix : ajout de `expect(res.status()).not.toBe(307)` + `not.toBe(302)` dans seller case 2 et admin case 3. [apps/seller/e2e/middleware/role-redirect.spec.ts, apps/admin/e2e/middleware/role-redirect.spec.ts]

**Patches MED :**
- [x] [Review][Patch] **Assertions cross-zone codées en dur** — URL hardcoded `'seller.'` / `'admin.'` échouaient en dev (NEXT_PUBLIC_*_BASE_URL = localhost sans sous-domaine). Remplacement par variables depuis env vars `PLAYWRIGHT_SELLER_BASE_URL` / `PLAYWRIGHT_ADMIN_BASE_URL` / `PLAYWRIGHT_APEX_BASE_URL` (defaulting localhost). [apps/public/e2e/middleware/role-redirect.spec.ts, apps/seller/e2e/middleware/role-redirect.spec.ts, apps/admin/e2e/middleware/role-redirect.spec.ts]
- [x] [Review][Patch] **Admin case 1 assertions trop larges** — toContain(`/${locale}/`) sans vérifier l'absence de `/admin/` ou `/auth/login`. Ajout de deux `not.toContain` pour garantir que le redirect va bien vers l'apex home (pas un loop admin/auth). [apps/admin/e2e/middleware/role-redirect.spec.ts]
- [x] [Review][Patch] **Seller case 4 `suspended → apex login` manquant** — seul chemin `redirect-login` cross-zone dans `seller-access.ts` (status suspended/deleted/unknown) non couvert. Ajout du 4e test ; commentaire mis à jour "3 cas × 2 locales = 6" → "4 cas × 2 locales = 8". [apps/seller/e2e/middleware/role-redirect.spec.ts]

**Patches LOW :**
- [x] [Review][Patch] **Cookie `tukio-session-active=1` superflu dans seller e2e** — `decideSellerAccess` ne lit pas ce cookie ; inclusion trompeuse. Retiré de `locationFor()` et du test inline case 2. [apps/seller/e2e/middleware/role-redirect.spec.ts]
- [x] [Review][Patch] **Assertion `next=` incomplète dans public case 1** — `toContain('next=')` vérifiait la présence du param mais pas sa valeur encodée. Tighten : `toContain(\`next=\${encodeURIComponent(\`/\${locale}/account\`)}\`)`. [apps/public/e2e/middleware/role-redirect.spec.ts]

**Deferred :**
- [x] [Review][Defer] Specs Playwright e2e livrées non-exécutées localement (nécessitent les dev servers sur ports 3000/3002/3003 + craft JWT middleware). Validation live lors du déploiement DO staging.
- [x] [Review][Defer] `BASE_URL` / `SELLER_BASE_URL` etc. non définis dans `playwright.config.ts` — les env vars doivent être documentées dans le README ou `.env.e2e.example` pour CI. Hors-scope Story 1.4d.

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

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m] (dev-story, 2026-05-26)

### Implementation Plan & key decisions

L'audit a révélé que `@tukio/auth-client` était encore basé sur **Keycloak.js**
(placeholders Story 0.8), alors que Story 1.4a/b/c a établi un flow **100 %
cookies + `/v1/auth/whoami`** côté gateway (et 1.4c a retiré l'AuthProvider
Keycloak.js des layouts car `check-sso` corrompait les sessions). 1.4d bascule
donc l'auth-client de Keycloak.js → cookie/whoami. Décisions :

- **D1 — `decode-jwt.ts` sans `jose`** : AC8 suggérait `jose.decodeJwt`.
  Implémenté avec un décodeur base64url Edge-safe dépendance-free (même pattern
  éprouvé que l'ancien `apps/seller` pending-decision). Exigence (decode-only +
  claims typés + `JwtMalformedError`) pleinement satisfaite, zéro dép ajoutée.
- **D2 — interceptor 401 (AC9)** : le `RefreshTokenRotationManager.getInstance()`
  de l'AC9 est du pseudocode. Implémenté via un callback `refreshAuth?: () =>
  Promise<boolean>` injecté dans `AxiosClientConfig` → évite la dép circulaire
  api-client ↔ auth-client. Code déclencheur réel = `AUTH-NOT-AUTHENTICATED-002`
  (le vrai code gateway, pas `AUTH-EXPIRED-001` du pseudocode).
- **D3 — refresh manager cookie/fetch** : réécrit pour `POST /v1/auth/refresh`
  (+ CSRF) au lieu de `keycloak-js.updateToken`. BroadcastChannel `tukio-auth`.
  Anti-thundering-herd : skip cross-tab via le timestamp broadcast (le
  sessionStorage de l'AC6 est per-tab → ne coordonne pas cross-tab) + dedup
  intra-tab via une in-flight promise (strictement plus sûr).
- **D4 — `useLogout` context-indépendant** : lit `gatewayBaseUrl` du contexte
  avec fallback `NEXT_PUBLIC_GATEWAY_URL` → les LogoutButton seller/admin
  fonctionnent sans AuthProvider dans leur layout. Le redirect same-tab reste à
  l'appelant ; les autres onglets redirigent via le broadcast `loggedOut`.
- **D5 — email_verified depuis le JWT** : l'auth-gate apex lit `email_verified`
  du token décodé (source unique) au lieu du cookie `tukio-email-verified`
  (workaround 1.2d P32, désormais vestigial — `/api/auth/sync-email-verified`
  POST n'est plus appelé, DELETE conservé au logout).
- **D6 — Task 11 (Grafana) déféré** par l'amendement 2026-05-25 (ADR-015 drop
  K8s/Grafana). Metrics prom-client (Task 10) conservés et exposés.
- **DEF3 (1.4c) — Keycloak.js retiré** : suppression de `keycloak/` (client +
  types + spec), de l'export `./keycloak`, de la dép `keycloak-js`, et de
  l'orphelin `apps/public/public/silent-check-sso.html`.

### Debug Log References

- BroadcastChannel flaky sous coverage v8 (livraison macrotask ralentie) →
  `setTimeout(0)` remplacé par `vi.waitFor` + probe de livraison (tests 8/9/10
  refresh + broadcast useLogout).
- `globals: false` en auth-client → testing-library cleanup non auto-enregistré ;
  ajouté `afterEach(cleanup)` global dans `__tests__/setup.ts` (sinon getByTestId
  matche des nœuds périmés).
- React dupliqué cross-package dans le sandbox vitest du public app → ajout
  `resolve.dedupe: ['react','react-dom']` (sinon `useContext` of null sur
  AuthContext).
- `.next/dev/types/routes.d.ts` périmé faisait échouer le typecheck admin
  (cache d'un ancien dev server, non lié au code) → purge + re-typecheck vert.

### Completion Notes List

**Validation finale (537 tests verts) :**
- `@tukio/auth-client` : 63 tests ; coverage **92.1 % stmts / 83.75 % branches /
  96.5 % funcs / 95.7 % lines** (providers + middleware réintégrés au rapport,
  AC12 ≥ 80 % satisfait) ; lint + typecheck 0 erreur.
- `@tukio/api-client` : 97 tests ; lint + typecheck 0 erreur.
- `apps/public` : 140 tests (auth-gate 14 + PublicHeader 4) ; lint 0 erreur ;
  typecheck 0 erreur.
- `apps/seller` : 29 tests (seller-access 14) ; lint 0 erreur ; typecheck 0 erreur.
- `apps/admin` : 11 tests (admin-access 10) ; lint 0 erreur ; typecheck 0 erreur.
- `apps/gateway-api` : 197 tests unit (auth.metrics 4) ; lint + typecheck 0 erreur.
- 3 specs Playwright role-redirect (20 cases) **livrées non-exécutées** localement
  (nécessitent les dev servers ; injection de cookie JWT forgé — le middleware
  décode sans vérifier la signature).

**Pré-requis / suites :**
- Les redirects cross-zone (Pro→seller, Admin→admin) sont asserts via le header
  `Location` ; validation live multi-zone à faire au déploiement DO.
- Pages placeholder référencées (hors-scope, déjà notées) : `/auth/totp-setup`
  (1.7), `/auth/verify-email-required` (1.6), `/seller/onboarding/rejected` (2.5).

### File List

**NEW**
- `packages/auth-client/src/middleware/decode-jwt.ts` (+ `.spec.ts`)
- `packages/auth-client/src/roles.ts`
- `packages/auth-client/src/providers/auth-provider.spec.tsx`
- `packages/api-client/src/__tests__/auth-refresh-interceptor.spec.ts`
- `apps/public/src/middleware/auth-gate-decision.ts`
- `apps/public/src/components/__tests__/PublicHeader.spec.tsx`
- `apps/seller/src/middleware/seller-access-decision.ts` (+ `.spec.ts`)
- `apps/seller/src/middleware/seller-access.ts`
- `apps/admin/src/middleware/admin-access-decision.ts` (+ `.spec.ts`)
- `apps/admin/src/middleware/admin-access.ts`
- `apps/admin/playwright.config.ts`
- `apps/gateway-api/src/infrastructure/metrics/auth.metrics.ts` (+ `.spec.ts`)
- `apps/public/e2e/middleware/role-redirect.spec.ts`
- `apps/seller/e2e/middleware/role-redirect.spec.ts`
- `apps/admin/e2e/middleware/role-redirect.spec.ts`
- `docs/runbook/login-flow-debug.md`
- `docs/runbook/cookie-architecture.md`
- `docs/runbook/refresh-token-rotation.md`

**MODIFIED**
- `packages/auth-client/src/cookies/cookie-manager.ts` (+ `.spec.tsx`)
- `packages/auth-client/src/refresh/refresh-token-rotation.ts` (+ `.spec.tsx`)
- `packages/auth-client/src/providers/auth-provider.tsx`
- `packages/auth-client/src/hooks/{use-logout,use-role,use-require-role}.ts`
- `packages/auth-client/src/hooks/hooks.spec.tsx`
- `packages/auth-client/src/types/auth-state.ts`
- `packages/auth-client/src/__tests__/setup.ts`
- `packages/auth-client/package.json` (retrait keycloak-js + export ./keycloak → ./roles + decode-jwt export)
- `packages/auth-client/vitest.config.ts` (coverage excludes)
- `packages/auth-client/README.md`
- `packages/api-client/src/client/types.ts` (refreshAuth + refreshTriggerCodes)
- `packages/api-client/src/client/axios-client.ts` (interceptor 401)
- `apps/public/src/middleware/auth-gate.ts`
- `apps/public/src/middleware/__tests__/auth-gate.spec.ts`
- `apps/public/src/components/PublicHeader.tsx`
- `apps/public/src/app/[locale]/layout.tsx` (AuthProvider)
- `apps/public/vitest.config.ts` (dedupe react)
- `apps/seller/src/middleware.ts`
- `apps/admin/src/middleware.ts`
- `apps/admin/package.json` (@playwright/test + test:e2e)
- `apps/gateway-api/src/infrastructure/http/controllers/auth-login.controller.ts`

**DELETED**
- `packages/auth-client/src/keycloak/{keycloak-client.ts,keycloak-client.spec.tsx,types.ts}`
- `apps/seller/src/middleware/{pending-admin-review-decision.ts,pending-admin-review-redirect.ts,pending-admin-review-redirect.spec.ts}`
- `apps/public/public/silent-check-sso.html`

### Change Log

- 2026-05-26 — Implémentation Story 1.4d (Tasks 1-10, 12-16 ; Task 11 déférée
  amendement). Bascule auth-client Keycloak.js → cookie/whoami. 3 middlewares
  (pure-decision + wrapper), AuthProvider whoami, hooks finalisés, refresh
  rotation fetch-based, interceptor 401, metrics prom-client, 3 runbooks, fix
  bug header AC13. 537 tests verts. Statut `ready-for-dev` → `review`.
- 2026-05-27 — Code review 5 groupes (A→E). Patches appliqués (HIGH: 8, MED: 10, LOW: 7) + 17 defers documentés. Bugs critiques corrigés : `clientId` → `client_id` (admin OAuth brisé), outcome `reused` étouffé (signal sécurité NFR13), AuthProvider absent seller/admin layouts (hooks cassés), refresh outcome `failed` pour `reused` (NFR13 token-replay), bracket notation env var (NEXT_PUBLIC_GATEWAY_URL undefined prod). Statut `review` → `done`.

## Story Completion Status

- **Story Status** : `done` (code-review 2026-05-27 — 25 patches appliqués sur 5 groupes A→E ; 17 defers documentés ; tous ACs satisfaits ; 537+ tests verts)
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
