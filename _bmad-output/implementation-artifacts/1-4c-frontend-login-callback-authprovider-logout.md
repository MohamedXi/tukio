# Story 1.4c: frontend login page + callback route handler + `AuthProvider` wiring ×3 apps + `LogoutButton` ×3

Status: ready-for-dev

> ℹ️ **Sub-story de [[1-4-login-flow-keycloak-authorization-code-pkce]]** — split via `/bmad-correct-course` 2026-05-17-bis
> (cf. `_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-17-bis.md`).
> Cette sub-story finalise le **tunnel login utilisateur côté UI**.
> Consomme les 5 endpoints gateway-api livrés en Story 1.4b.
>
> 🔑 **Architecture dual-portal (révision 2026-05-17 17h)** — voir mémoire
> `project_signup_dual_portal_2026_05_17.md`. Backend Customer-first unique
> (`POST /v1/auth/customer/register` → role=client systématique), mais **2 portails
> UX distincts** : apex `tukio.one` (Customer) + `seller.tukio.one` (Pro).
> Conséquences pour cette sub-story :
> - La page login customer `tukio.one/{locale}/auth/login` propose **uniquement**
>   `<Link href="/{locale}/auth/sign-up">Pas de compte ? S'inscrire</Link>` (Customer générique).
> - **ZÉRO** lien "S'inscrire en tant que Pro" sur cette page, **ZÉRO** param `?role=pro`.
> - Le **CTA "Devenir pro"** est livré séparément par **Story 1.11** dans le
>   **header global apex** (`apps/public/src/components/Header.tsx`), visible sur
>   toutes les pages publiques + authentifiées Customer. Pas dans la page login.
> - La page login seller (`seller.tukio.one/{locale}/auth/login`) est livrée par Story 1.11.

## Story

**As a** dev frontend qui finalise le tunnel login utilisateur,
**I want** poser dans `apps/public` la **page login** `[locale]/auth/login/page.tsx`
(Server Component layout + `<LoginCta>` client component qui appelle JS `handleSignIn()`
→ `window.location.assign('/v1/auth/login?next=...&clientId=tukio-web&locale=...')`),
le **callback Next.js route handler** `[locale]/auth/callback/route.ts` qui forward
le `?code/state/error` à gateway-api `GET /v1/auth/callback`, le **`AuthProvider` Story 0.8**
wiré dans `app/[locale]/layout.tsx` des **3 apps** (public + seller + admin) qui fetch
`/v1/auth/whoami` au mount pour hydrater le React Context, et le **`LogoutButton`**
dans le header de chaque app (3 implémentations) qui appelle `useLogout()`
→ `POST /v1/auth/logout` avec X-CSRF-Token header → `window.location.assign('/{locale}/')`,
**so that** un user peut effectivement se connecter end-to-end via l'UI Tukio
(page login → Keycloak redirect → callback → cookies set → dashboard rendered)
et se déconnecter, avec **zéro mention de signup Pro sur la page login customer apex**
(le CTA "Devenir pro" est dans le header global apex, livré par Story 1.11 — voir
mémoire `project_signup_dual_portal_2026_05_17.md`).

## Acceptance Criteria

1. **AC1 — `apps/public/src/app/[locale]/auth/login/page.tsx`** (NEW) :
   - Server Component layout réutilise pattern Story 1.2d (`<PublicHeader>` + form + footer)
   - Hero `<h1>` Fraunces 500 charcoal-800 (i18n FR "Se connecter à Tukio" / EN "Sign in to Tukio")
   - `<FormField label="Email" type="email" required>` + `<FormField label="Mot de passe" type="password" required>` (Story 0.4 atomics) — labels rappel UX uniquement, **PAS de validation côté frontend** (le bouton CTA redirige directement vers Keycloak qui gère l'auth)
   - `<Button variant="primary" size="lg">` → délègue à `<LoginCta>` client component (AC2)
   - `<Link href="/{locale}/auth/password-reset">Mot de passe oublié ?</Link>` (Story 1.5 placeholder)
   - **`<Link href="/{locale}/auth/sign-up">Pas de compte ? S'inscrire</Link>`** — **Customer générique uniquement** :
     - ❌ PAS de propagation `?role=pro`
     - ❌ PAS de switch label "S'inscrire en tant que Pro"
     - ❌ PAS de lien vers `seller.tukio.one` (le CTA Pro vit dans le header global apex — Story 1.11)
     - ✅ Texte générique unique FR "Pas de compte ? S'inscrire" / EN "No account? Sign up"
   - Param `?next=<encoded-url>` propagé tel quel au CTA (forwarded à gateway-api Story 1.4b qui le sanitize via redirect-resolver Story 1.4a)
   - Param `?error=<keycloak-error>` : si présent, affiche `<Alert variant="error" role="alert">` avec message générique anti-énumération FR "Email ou mot de passe incorrect" / EN "Invalid email or password" (NFR9)
   - i18n strict via next-intl, namespace `auth.login.*` (~15 keys) dans `apps/public/messages/{fr,en}.json`
   - Accessibilité RGAA AA : labels via `htmlFor`, focus visible, navigation Tab/Enter, errors via `role="alert"`, axe-core 0 violations

2. **AC2 — `apps/public/src/features/auth/login/components/LoginCta.tsx`** (NEW) :
   - `'use client'` component (interactivité bouton)
   - `handleSignIn()` :
     ```ts
     const next = new URLSearchParams(window.location.search).get('next');
     const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL;
     const url = new URL(`${gatewayUrl}/v1/auth/login`);
     url.searchParams.set('clientId', 'tukio-web');
     url.searchParams.set('locale', locale);
     if (next) url.searchParams.set('next', next);
     window.location.assign(url.toString());
     ```
   - `aria-busy=true` + `disabled` durant la redirection (~100ms perceptible)
   - PAS de fetch — c'est un redirect 302 navigateur natif (cookie pkce posé côté gateway-api en Story 1.4b)
   - Unit tests (vitest + @testing-library/react) : 5 cases (happy + next forwarded + missing next + aria-busy state + disabled state)

3. **AC3 — `apps/public/src/app/[locale]/auth/callback/route.ts`** (NEW) — Next.js 15 Route Handler :
   ```ts
   export async function GET(req: NextRequest, { params }: { params: Promise<{ locale: string }> }) {
     const { locale } = await params;
     const url = new URL(req.url);
     const code = url.searchParams.get('code');
     const state = url.searchParams.get('state');
     const error = url.searchParams.get('error');
     if (error) return NextResponse.redirect(new URL(`/${locale}/auth/login?error=${error}`, req.url));
     const gatewayCallbackUrl = new URL(`${process.env.NEXT_PUBLIC_GATEWAY_URL}/v1/auth/callback`);
     gatewayCallbackUrl.searchParams.set('code', code!);
     gatewayCallbackUrl.searchParams.set('state', state!);
     gatewayCallbackUrl.searchParams.set('locale', locale);
     return NextResponse.redirect(gatewayCallbackUrl);
   }
   ```
   - Node runtime (pas Edge — cross-zone HTTP)
   - Le forwarder simple ; gateway-api fait tout le decoding + cookie setting + redirect logic (Story 1.4b AC2)
   - PAS de logic JWT décode côté Next.js

4. **AC4 — `apps/public/src/lib/redirect-url.ts`** (NEW) :
   - `sanitizeNextUrl(rawNext: string | null, allowedDomains: string[]): string | null`
   - Whitelist `*.tukio.one` only : parse via URL constructor, check `hostname` ends with `.tukio.one` strict
   - Bloque : `javascript:`, `data:`, externe non-tukio, relatif sans `https://`
   - 12 unit tests vitest

5. **AC5 — `AuthProvider` wiring 3 apps** :
   - `apps/public/src/app/[locale]/layout.tsx` (UPDATE) : wrap `<AuthProvider>` Story 0.8 autour `{children}`
   - `apps/seller/src/app/[locale]/layout.tsx` (UPDATE) : idem
   - `apps/admin/src/app/[locale]/layout.tsx` (NEW — placeholder Story 0.8 finalisé) : idem
   - Provider fetch `/v1/auth/whoami` au mount → hydrate React Context (user, role, locale, status, isAuthenticated, isLoading)
   - Loading state pendant fetch (skeleton ou null safe — pas de flash UI)
   - **Précision** : la finalisation de l'implémentation `<AuthProvider>` (fetch whoami + interval refresh + BroadcastChannel) est en Story 1.4d ; 1.4c se contente de **wirer** le composant dans les layouts

6. **AC6 — `LogoutButton` ×3 apps** :
   - `apps/public/src/components/LogoutButton.tsx` (NEW) — placement header zone authenticated
   - `apps/seller/src/components/LogoutButton.tsx` (NEW) — seller header
   - `apps/admin/src/components/LogoutButton.tsx` (NEW) — admin header
   - Tous appellent `useLogout()` Story 0.8 → `POST /v1/auth/logout` avec `X-CSRF-Token` header (via `addCsrfHeader()` Story 0.8) + cookie auto-sent → redirect `window.location.assign('/' + locale + '/')`
   - Disabled + aria-busy durant logout in-flight
   - i18n FR "Se déconnecter" / EN "Sign out"
   - **Précision** : `useLogout` hook finalize en Story 1.4d (mutation + cookie clear logic) ; 1.4c se contente de wirer le composant

7. **AC7 — Playwright e2e `apps/public/e2e/auth/login.spec.ts`** (NEW — 13 cases) :
   - Naviguer `/fr/auth/login` + `/en/auth/login` (2 projects FR/EN)
   - axe-core 0 violations chaque locale (2 cases)
   - Vérifier `<Link href="/{locale}/auth/sign-up">` cible générique (pas de `?role=pro` dans href, pas de cross-zone vers seller) (2 cases — 1 par locale)
   - Vérifier absence du lien "S'inscrire en tant que Pro" + absence de tout lien vers `seller.tukio.one` depuis la page login (2 cases — 1 par locale)
   - Click CTA "Se connecter" → vérifier `window.location.assign` cible `auth.tukio.one/realms/tukio/.../auth?...&code_challenge=...&code_challenge_method=S256&state=...` (1 case)
   - 4 scénarios login end-to-end via testcontainer Keycloak Story 0.9 (Customer + Pro pending + Pro active + Admin TOTP) — chacun → vérifier redirect dashboard correct
   - Param `?next=https://customer.tukio.one/...` propagé et respecté post-callback (1 case)
   - Param `?next=https://evil.com/` sanitized par gateway-api → redirect default dashboard (1 case)
   - Param `?error=invalid_grant` → affiche `<Alert>` message générique (1 case)
   - Performance NFR48 : ≤ 3s p90 entre clic CTA et dashboard rendered (10 runs)
   - Logout button visible authenticated → click → cookies cleared + redirect `/{locale}/` (1 case)

## Tasks/Subtasks

- [ ] **Task 1** — `apps/public/src/app/[locale]/auth/login/page.tsx` Server Component layout + i18n keys (AC1)
- [ ] **Task 2** — `apps/public/src/features/auth/login/components/LoginCta.tsx` client component + unit tests (AC2)
- [ ] **Task 3** — `apps/public/src/app/[locale]/auth/callback/route.ts` Next.js 15 Route Handler (AC3)
- [ ] **Task 4** — `apps/public/src/lib/redirect-url.ts` + spec (AC4)
- [ ] **Task 5** — Wire `<AuthProvider>` dans 3 layouts (AC5)
- [ ] **Task 6** — `apps/{public,seller,admin}/src/components/LogoutButton.tsx` ×3 + i18n labels (AC6)
- [ ] **Task 7** — Playwright e2e `apps/public/e2e/auth/login.spec.ts` 13 cases (AC7)
- [ ] **Task 8** — `pnpm lint && pnpm typecheck && pnpm test:cov` per workspace + Playwright run (smoke local via docker:up)

## Dev Notes

### Project Structure

```
apps/public/src/
├─ app/[locale]/auth/
│  ├─ login/page.tsx                                       # NEW
│  └─ callback/route.ts                                    # NEW
├─ features/auth/login/
│  ├─ components/LoginCta.tsx                              # NEW (+ .spec.tsx)
│  └─ index.ts                                             # NEW
├─ lib/redirect-url.ts                                     # NEW (+ .spec.ts)
├─ components/LogoutButton.tsx                             # NEW
├─ app/[locale]/layout.tsx                                 # UPDATE — wrap AuthProvider
├─ messages/{fr,en}.json                                   # UPDATE — namespace auth.login.* + logout label
└─ e2e/auth/login.spec.ts                                  # NEW — 13 cases

apps/seller/src/
├─ app/[locale]/layout.tsx                                 # UPDATE — wrap AuthProvider
├─ components/LogoutButton.tsx                             # NEW
└─ messages/{fr,en}.json                                   # UPDATE — logout label

apps/admin/src/
├─ app/[locale]/layout.tsx                                 # NEW — wrap AuthProvider
├─ components/LogoutButton.tsx                             # NEW
└─ messages/{fr,en}.json                                   # NEW — namespace logout + minimal i18n
```

### Critical Architecture Constraints

- **Dual-portal architecture** (révision 2026-05-17 17h, mémoire `project_signup_dual_portal_2026_05_17.md`) : 2 portails UX distincts (apex Customer + seller Pro), 1 backend Customer-first unique. Conséquences UI pour cette sub-story : la page login customer apex ne propose **aucun** lien Pro (ni signup, ni cross-zone seller). Le **CTA "Devenir pro"** est placé dans le **header global apex** par **Story 1.11** (visible toutes pages publiques + authentifiées Customer). La page login seller (`seller.tukio.one/{locale}/auth/login`) est aussi livrée par Story 1.11. Le rôle Pro effectif s'obtient toujours via conversion post-auth Story 1.3 v2 (wizard 4 steps).
- **Anti-énumération NFR9** : les error messages côté UI sont toujours génériques même si le `tukioCode` côté backend est précis. Mapping `?error=invalid_grant` / `?error=invalid_state` / `?error=service_unavailable` → tous → même message UI "Email ou mot de passe incorrect" (sauf service_unavailable qui peut être plus explicite "Service temporairement indisponible").
- **Cross-zone session sharing** : grâce à `Domain=.tukio.one` sur les cookies (Story 1.4a `cookie-helpers.ts`), un Customer connecté sur `tukio.one` reste authentifié sur `seller.tukio.one` automatiquement.
- **AuthProvider implementation finalization → Story 1.4d** : 1.4c se contente de wirer le composant dans les layouts ; les implémentations réelles des hooks `useAuth`/`useLogout`/etc. sont finalisées en 1.4d
- **next-intl strict** (memory `feedback_i18n_frontend.md`) : zéro hardcoded UI string ; tout via namespace `auth.login.*` FR+EN
- **apps/admin layout NEW** : Story 0.8 avait un placeholder ; 1.4c finalise (wrap AuthProvider) + 1.4d finalise (middleware role + TOTP enforcement)

### Previous Story Intelligence

- **Story 1.2d** : pattern `apps/public/src/features/auth/sign-up/` + `apps/public/src/app/[locale]/auth/sign-up/page.tsx` — Story 1.4c suit le même pattern pour login
- **Story 1.3d v2** : pattern Logo + WizardShell — pas directement réutilisé ici mais le pattern de composant client `'use client'` co-located + i18n keys est identique
- **Story 0.8** : `<AuthProvider>` + `useAuth`/`useLogout`/`useRole` placeholders à wire (finalize implementations Story 1.4d)
- **Story 0.4** : atomics `<Button>`, `<FormField>`, `<Alert>`, `<Link>` via `@tukio/ui/components/*`
- **Story 0.13** : Next.js multi-zones rewrites cross-zone — `NEXT_PUBLIC_GATEWAY_URL` env var pour pointer gateway-api

### What this story does NOT do

- ❌ Middlewares finalize (apps/public auth-gate + seller status + admin role/TOTP) → Story 1.4d
- ❌ AuthProvider implementation (fetch whoami + interval refresh + BroadcastChannel) → Story 1.4d
- ❌ Hooks finalize (`useAuth`/`useLogout`/`useRole`/`RefreshTokenRotation`/`CookieManager`) → Story 1.4d
- ❌ Axios interceptor 401 → refresh → Story 1.4d
- ❌ Observability (Grafana + runbooks) → Story 1.4d
- ❌ Page `/auth/verify-email-required` (placeholder) → Story 1.6
- ❌ Page `/auth/totp-setup` (placeholder) → Story 1.7

### References

- [Source: 1-4-login-flow-keycloak-authorization-code-pkce.md AC1 (frontend) + AC6 (callback) + AC9 (e2e)]
- [Source: 1-4b-gateway-api-endpoints-usecases-csrf-e2e.md (5 endpoints consommés)]
- [Source: ux-design-specification.md UX-DR9 (sign-up funnel — login pattern similar)]
- [Source: epics.md Story 1.4 ligne 1149-1156]
- [Memory: project_signup_dual_portal_2026_05_17.md (dual-portal acté 2026-05-17 17h, supersedes Customer-first matinale)]
- [Memory: story_1_11_seller_signup_portal_planned.md (Story 1.11 NEW seller portal — livre CTA Pro header + pages auth seller)]
- [Memory: feedback_i18n_frontend.md]

## Story Completion Status

- **Story Status** : `ready-for-dev`
- **Created** : 2026-05-17 (via /bmad-correct-course sprint-change-proposal-2026-05-17-bis.md)
- **Parent umbrella** : Story 1.4 (`split-umbrella`)
- **Estimation effort** : 2-2.5j
- **Dépendances upstream** :
  - **Story 1.4b** (5 endpoints gateway-api opérationnels) — 🔴 blocking
  - Story 0.4 (atomics)
  - Story 0.8 (`<AuthProvider>` + hooks placeholders à wire)
  - Story 0.13 (rewrites cross-zone, env var GATEWAY_URL)
  - Story 1.2d (pattern auth pages apps/public)
- **Dépendances downstream** :
  - **Story 1.4d** finalise les hooks + middlewares + observability
  - **Story 1.11** (seller signup portal) consomme l'`AuthProvider` wiré ici dans `apps/seller/src/app/[locale]/layout.tsx`
- **Prochaine sub-story** : Story 1.4d
