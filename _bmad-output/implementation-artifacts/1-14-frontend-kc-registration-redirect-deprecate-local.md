# Story 1.14: Frontend redirect vers l'inscription Keycloak + dépréciation du formulaire local

Status: backlog

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

> 🆕 **Story créée le 2026-05-25** via `/bmad-create-story` (ADR-0018, cf. `sprint-change-proposal-2026-05-25-adr-0018.md`).
> ⛔ **Dépend de Story 1.13 (realm prêt) ET Story 1.15 (`user_profile` réactif).** Ne PAS couper le formulaire local tant que ces deux-là ne sont pas livrées — sinon une inscription Keycloak ne créerait aucun `user_profile`. Statut `backlog` jusque-là.

## Story

**As a** visiteur de `tukio.one`,
**I want** que « S'inscrire » m'amène sur la page d'inscription Keycloak themée (exactement comme « Se connecter »),
**so that** l'inscription soit cohérente avec l'authentification, 100 % Keycloak, et bénéficie du social login + de la vérification email native.

## Acceptance Criteria

1. **Given** un nouvel endpoint gateway `@Public() @Get('/v1/auth/register')` (**initiate-register**, miroir de `initiate-login`, `auth-login.controller.ts:84-103`), **When** on l'appelle avec `?client_id=tukio-web&locale=…&next=…`, **Then** il génère le matériel PKCE + state (pose le cookie `tukio-pkce-state`) et **302** vers l'URL d'inscription Keycloak (`…/realms/tukio/protocol/openid-connect/registrations?response_type=code&client_id=…&code_challenge=…&state=…&kc_locale=…`).
2. **Given** l'utilisateur termine l'inscription Keycloak (ou via Google/Microsoft), **When** Keycloak redirige vers `…/auth/callback`, **Then** le **même callback existant** (`/v1/auth/callback` + `resolvePostLoginRedirect`) traite l'échange — aucune logique de callback dédiée à l'inscription.
3. **Given** le CTA « S'inscrire » (`PublicHeader.tsx:98-106` + tout lien signup), **When** on clique, **Then** il appelle `GET /v1/auth/register` (via `window.location.assign`, comme `handleLogin` `:28-34`) — **fin de la navigation vers le formulaire local `/auth/sign-up`**.
4. **Given** le trafic confirmé nul sur `POST /v1/auth/customer/register`, **When** on nettoie (déprécation→retrait), **Then** sont **supprimés** : `apps/public/src/features/auth/sign-up/**` (`SignUpForm`, `SignUpProviders`, service), la route `apps/public/src/app/[locale]/auth/sign-up/`, le hook `@tukio/api-client` `useRegisterCustomer`, l'endpoint `POST /v1/auth/customer/register` (`auth-customer.controller.ts`) + sa use case proxy + ses metrics, les DTO/contracts `register-customer` (gateway + identity-svc + `@tukio/contracts`), et les e2e associés (`apps/public/e2e/auth/customer-register.spec.ts`, `apps/gateway-api/test/auth-customer-register.e2e-spec.ts`).
5. **Given** Playwright, **When** les tests tournent, **Then** le happy-path inscription via Keycloak est couvert (clic « S'inscrire » → redirect 302 KC registrations → retour callback → session active + `tukio-session-active` posé) en FR ET EN.
6. **Given** la dépréciation, **When** on retire le dual-write synchrone, **Then** `register-customer.usecase.ts` (identity-svc) est retiré **ou** réduit, la création de `user_profile` passant exclusivement par le flux réactif Story 1.15 (coordination explicite).

## Tasks / Subtasks

- [ ] **Task 1 — Endpoint initiate-register (gateway)** (AC: 1, 2)
  - [ ] `KeycloakOAuthClient` : ajouter `buildRegistrationUrl(input)` (miroir de `buildAuthorizeUrl` `:107`, endpoint `…/registrations` au lieu de `…/auth`, mêmes `response_type/code_challenge/state/kc_locale/scope`).
  - [ ] Use case `InitiateRegisterUseCase` (miroir `InitiateLoginUseCase` : PKCE + state + cookie `tukio-pkce-state`).
  - [ ] `auth-login.controller.ts` (ou nouveau `auth-register.controller.ts`) : `@Public() @Get('register')` → 302 + Set-Cookie pkce.
  - [ ] Réutiliser `ALLOWED_CLIENT_IDS`, `sanitizeNextUrl`, le secret pkce, etc.
- [ ] **Task 2 — Recâbler le CTA « S'inscrire » (frontend)** (AC: 3)
  - [ ] `PublicHeader.tsx` : le bouton signup (`:98-106`) appelle `GET /v1/auth/register` (pattern `handleLogin`), au lieu de `window.location.href = /auth/sign-up`.
  - [ ] Recâbler tout autre lien menant à `/auth/sign-up`.
- [ ] **Task 3 — Déprécier puis retirer le form local** (AC: 4) — _après cutover confirmé_
  - [ ] Étape 1 : rediriger `/auth/sign-up` → `GET /v1/auth/register` (transition douce, pas de 404).
  - [ ] Étape 2 : confirmer trafic nul sur `POST /v1/auth/customer/register`.
  - [ ] Étape 3 : retirer features sign-up + hook + endpoint + proxy + metrics + DTO/contracts `register-customer` + e2e.
- [ ] **Task 4 — Coordination retrait dual-write** (AC: 6)
  - [ ] Avec Story 1.15 : `user_profile` créé uniquement en réactif ; retirer/réduire `register-customer.usecase.ts`.
- [ ] **Task 5 — Tests** (AC: 5)
  - [ ] Playwright happy-path inscription KC (FR/EN) ; retirer/migrer les e2e de l'ancien form.

## Dev Notes

### Contexte réel (lu dans le code)

- **Pattern à mirrorer** : `auth-login.controller.ts:84-103` (`@Public() @Get('login')` → `initiateProxy.execute({next, clientId, locale})` → `{redirectUrl, pkceCookie}` → Set-Cookie + 302). `keycloak-oauth.client.ts:107 buildAuthorizeUrl` (endpoint `/protocol/openid-connect/auth`). **Keycloak expose `/protocol/openid-connect/registrations`** pour l'inscription (mêmes params) → le callback `/v1/auth/callback` (`HandleCallbackUseCase`) traite l'échange sans modif.
- **CTA front** : `PublicHeader.tsx` — `handleLogin` (`:28-34`) fait `window.location.assign(${gateway}/v1/auth/login?...)`. Le bouton signup (`:98-106`) fait `window.location.href = /auth/sign-up` → **à recâbler** vers `/v1/auth/register`.
- **Surface de retrait** (`register-customer`, ~20 fichiers) : `apps/public/src/features/auth/sign-up/**`, `app/[locale]/auth/sign-up/`, `useRegisterCustomer` (`@tukio/api-client`), `auth-customer.controller.ts` + `register-customer.dto.ts` (gateway), `register-customer.dto.ts` + `customer.controller.ts` + `register-customer.usecase.ts` (identity-svc), `register-customer` contracts (`@tukio/contracts`), e2e (`customer-register.spec.ts` ×2, et refs dans `auth-login`/`auth-whoami` e2e à ajuster).
- **Resolver post-login** : `resolvePostLoginRedirect` (`redirect-resolver.ts`) gère déjà la destination après callback — rien à refaire (Story 1.4b/1.12).

### Séquencement & garde-fou

Deprecate-then-remove (ADR-0018). **Bloquant** : 1.13 (realm) + 1.15 (`user_profile` réactif) AVANT le retrait de l'endpoint, sinon inscription KC = aucun `user_profile`. D'où statut `backlog`.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` #Story 1.14]
- [Source: `docs/adr/0018-registration-keycloak-hosted-social-idp.md` #Decision pt.1-2 + Implementation Notes (frontend, migration)]
- [Source: `apps/gateway-api/src/infrastructure/http/controllers/auth-login.controller.ts:84-103`] — pattern initiate.
- [Source: `apps/gateway-api/src/infrastructure/external/keycloak/keycloak-oauth.client.ts:107`] — `buildAuthorizeUrl`.
- [Source: `apps/public/src/components/PublicHeader.tsx:28-34,98-106`] — CTA login/signup.
- Dépendances : Story 1.13, Story 1.15.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
