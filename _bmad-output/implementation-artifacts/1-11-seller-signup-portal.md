# Story 1.11: Seller signup portal — `seller.tukio.one` sign-up + login pages + CTA "Devenir pro" header apex + flag intent Pro

Status: ready-for-dev

> ℹ️ **Story NEW** créée 2026-05-17 suite à la décision dual-portal (révision 17h) actée par Ismael.
> Voir mémoires `project_signup_dual_portal_2026_05_17.md` (architecture finale) +
> `story_1_11_seller_signup_portal_planned.md` (spec planning) +
> `_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-17-bis.md` (addendum révision 17h).
>
> 🔑 **Architecture dual-portal acté 2026-05-17 17h** : 2 portails UX distincts (apex Customer +
> seller Pro) avec **1 backend Customer-first unique**. Cette story implémente :
> - Le **portail Pro frontend** sur `seller.tukio.one` (sign-up + login pages, branding/storytelling Pro)
> - Le **CTA "Devenir pro"** dans le header global apex `tukio.one` (visible toutes pages publiques + authentifiées Customer)
> - Le **mécanisme flag intent Pro** côté backend (DB column `user_profile.signup_intent` + cookie 24h)
> - Le **middleware seller** pour gérer Customer auth visitant racine seller (proposition wizard conversion)
>
> Le **compte créé** par le sign-up seller portal est TOUJOURS `role=client` Keycloak (backend
> Customer-first préservé). Le rôle Pro effectif s'obtient via le wizard conversion Story 1.3 v2 ✅.

## Story

**As a** Pro prospect arrivant sur Tukio (visiteur non authentifié OU Customer existant souhaitant devenir Pro),
**I want** un portail signup/login dédié sur `seller.tukio.one` avec branding/storytelling Pro orienté
gestion de vitrine + réception de bookings, accessible depuis un **CTA "Devenir pro"** visible dans le
header global apex `tukio.one`, et un mécanisme de **redirect intelligent post-email-verify** vers le
wizard conversion Pro,
**so that** :
- Un visiteur Pro a un point d'entrée visuel clair (CTA header apex) et un parcours signup brandé Pro
  (storytelling, hero, copy adaptés sur `seller.tukio.one/{locale}/auth/sign-up`).
- Un Customer authentifié visitant `seller.tukio.one` voit une proposition "Devenir pro ?" qui le mène
  directement au wizard conversion (Story 1.3 v2 livré).
- Le **backend reste Customer-first** (1 seul `POST /v1/auth/customer/register`, 1 seul flow), pas
  de duplication code identity-svc/gateway-api.
- L'**intent Pro est persisté** (DB column `user_profile.signup_intent='pro'` + cookie 24h
  `tukio-signup-intent=pro` Domain=.tukio.one) pour que Story 1.6 (email-verify) sache rediriger
  vers le wizard conversion plutôt que vers le dashboard Customer générique, même si le cookie a
  expiré ou si l'utilisateur clique l'email depuis un autre device.
- Le **rôle Pro effectif** reste obtenu via la conversion post-auth Story 1.3 v2 (wizard 4 steps :
  identity + activity + documents + review). Cette story 1.11 ne crée AUCUN nouveau path "pro account".

## Acceptance Criteria

1. **AC1 — CTA "Devenir pro" header global apex** (`apps/public/src/components/Header.tsx` UPDATE) :
   - Placement dans le header global `apps/public` : visible 100 % du temps (visiteurs + Customer authentifiés)
   - Position secondaire à côté du CTA "Se connecter" (`<Button variant="secondary" size="md">`)
   - Click → `window.location.assign(\`${process.env.NEXT_PUBLIC_SELLER_URL}/${locale}/auth/sign-up\`)`
   - i18n strict next-intl : namespace `header.becomePro` (FR "Devenir professionnel" / EN "Become a pro")
   - Accessibilité RGAA AA : `<Link>` + `aria-label`, focus visible, navigation Tab/Enter, axe-core 0 violations
   - Variante mobile : dans le menu drawer (≤768px breakpoint Tailwind v4), avec icon `<Briefcase>` lucide-react
   - **Précision** : si un Customer authentifié clique le CTA, redirect cross-zone vers `seller.tukio.one/{locale}` (pas directement signup) — le middleware seller (AC8) le routera vers le wizard conversion

2. **AC2 — `apps/seller/src/app/[locale]/auth/sign-up/page.tsx`** (NEW) — Page sign-up Pro brandée :
   - Server Component layout réutilisant pattern Story 1.2d Customer signup (`<PublicHeader>` + form + footer)
   - **Branding/storytelling Pro** :
     - Hero `<h1>` Fraunces 500 charcoal-800 (i18n FR "Créez votre compte professionnel" / EN "Create your professional account")
     - Subtitle Pro-focused (FR "Gérez votre vitrine, recevez des demandes de booking, encaissez en toute sérénité" / EN "Manage your storefront, receive booking requests, get paid with peace of mind")
     - 3 cards "bénéfices Pro" (commission transparente / paiements sécurisés Stripe / support dédié) — reuse `<Card>` atom
   - **Form fields IDENTIQUES au signup Customer Story 1.2d** : email + password + confirmPassword + firstName + lastName + acceptTerms (CGU) + acceptMarketing (optional)
   - **Aucun field Pro spécifique** sur cette page (SIRET, etc.) — collectés plus tard via wizard conversion Story 1.3 v2
   - Submit → `POST /v1/auth/customer/register` (Story 1.2c, **MÊME endpoint backend**) avec body field additionnel `signupOrigin: 'pro_portal'` (AC5)
   - i18n strict via next-intl, namespace `seller.auth.signup.*` (~25 keys) dans `apps/seller/messages/{fr,en}.json`
   - Accessibilité RGAA AA : labels via `htmlFor`, focus visible, navigation Tab/Enter, errors via `role="alert"`, axe-core 0 violations
   - Reuse `useRegisterCustomer` hook Story 1.2d via `@tukio/api-client/hooks/auth` (avec extension AC5)

3. **AC3 — `apps/seller/src/app/[locale]/auth/login/page.tsx`** (NEW) — Page login Pro brandée :
   - Server Component layout (réutilise pattern Story 1.4c login customer, **adapté Pro**)
   - Hero `<h1>` (FR "Connectez-vous à votre espace pro" / EN "Sign in to your pro workspace")
   - `<LoginCta>` client component (reuse pattern Story 1.4c) qui appelle `window.location.assign(\`${process.env.NEXT_PUBLIC_GATEWAY_URL}/v1/auth/login?clientId=tukio-web&locale=${locale}\`)`
   - **PAS de lien "S'inscrire en tant que Customer"** — focus 100% Pro sur cette page
   - **PAS de propagation `?role=...`** — `clientId=tukio-web` identique customer (le rôle effectif vient du JWT post-auth)
   - `<Link href="/{locale}/auth/password-reset">Mot de passe oublié ?</Link>` (Story 1.5 placeholder)
   - `<Link href="/{locale}/auth/sign-up">Pas encore de compte pro ? Créez-en un</Link>` (mène vers AC2)
   - i18n strict via next-intl, namespace `seller.auth.login.*` (~12 keys)
   - Accessibilité RGAA AA + axe-core 0 violations

4. **AC4 — Migration TypeORM identity-svc `AddSignupIntentToUserProfile`** (NEW) :
   - `ALTER TABLE user_profiles ADD COLUMN signup_intent VARCHAR(20) NULL`
   - Valeurs autorisées (validation Zod côté domain VO) : `'pro'` | `NULL` (default)
   - **NFR83 backward-compatible** : NULL default, anciennes rows non impactées
   - Index partiel pour le cron Story 1.6 si besoin de query : `CREATE INDEX idx_user_profiles_signup_intent_pending ON user_profiles(signup_intent) WHERE signup_intent IS NOT NULL` (économique vu cardinality faible attendue)
   - Mapper TypeORM `apps/identity-svc/src/infrastructure/typeorm/mappers/user-profile.mapper.ts` UPDATE : map `signupIntent` ↔ `signup_intent`
   - Aggregate `UserProfile` (`apps/identity-svc/src/domain/model/user-profile.aggregate.ts`) UPDATE :
     - Constructor reçoit `signupIntent?: 'pro' | null`
     - Méthode `clearSignupIntent()` (appelée par `ConvertCustomerToProUseCase` Story 1.3b-bis lors de la conversion réussie OU rejet explicite)

5. **AC5 — Extension DTO `RegisterCustomerInputSchema`** (`packages/contracts/src/dtos/identity/register-customer.dto.ts`) :
   - Ajout field optionnel `signupOrigin?: 'customer_portal' | 'pro_portal'`
   - Default `'customer_portal'` si absent (backward-compat avec apps/public Customer signup Story 1.2d)
   - Validation Zod `z.enum(['customer_portal', 'pro_portal']).optional()`
   - Type exporté `SignupOrigin = z.infer<typeof SignupOriginSchema>` (re-export via `index.ts`)
   - **Hook `useRegisterCustomer`** (`@tukio/api-client/hooks/auth`) UPDATE : accepte optional `signupOrigin` dans input
   - **`RegisterCustomerUseCase`** identity-svc (Story 1.2b) UPDATE : si `signupOrigin === 'pro_portal'`, appelle `userProfile.setSignupIntent('pro')` avant persistance

6. **AC6 — Cookie `tukio-signup-intent=pro`** (gateway-api `RegisterCustomerController` Story 1.2c UPDATE) :
   - Posé par gateway-api après `POST /v1/auth/customer/register` réussi (201) si `signupOrigin === 'pro_portal'` dans request body
   - Attributs cookie : `HttpOnly`, `Secure`, `SameSite=Lax`, `Domain=.tukio.one`, `Max-Age=86400` (24h), `Path=/`
   - Value : `'pro'` (chaîne simple, pas de payload structuré — flag binaire seulement)
   - Helper réutilise `cookie-helpers.ts` Story 1.4a (`setSignupIntentCookie(reply, value, options)`)
   - Lu par Story 1.6 (email-verify post-redirect) pour décider la destination (cookie d'abord, DB column en fallback)

7. **AC7 — Story 1.6 (email-verify) extension AC** (UPDATE — coordination cross-story) :
   - Cette story 1.11 **n'implémente PAS** Story 1.6 (déjà ready-for-dev), mais **ajoute un AC** que Story 1.6 doit consommer.
   - L'AC ajouté dans Story 1.6 (à amender via update de epics.md + fichier story 1.6 lors du dev) :
     > **Given** un user vient de cliquer le lien email-verify, **When** le flow réussit, **Then** le redirect intelligent lit (1) cookie `tukio-signup-intent=pro` d'abord, puis (2) DB column `user_profile.signup_intent` en fallback. Si `'pro'` détecté → redirect cross-zone `seller.tukio.one/{locale}/seller/onboarding/identity` (wizard step 1 Story 1.3 v2). Sinon → redirect `tukio.one/{locale}/account/dashboard`. Clear le cookie après usage (mais pas la DB column — sera cleared par `ConvertCustomerToProUseCase` à la conversion).
   - **Précision scope** : cette story 1.11 documente l'AC ; l'implémentation effective dans `redirect-after-verify.usecase.ts` (Story 1.6) sera faite lors du dev de Story 1.6.

8. **AC8 — `apps/seller/src/middleware.ts`** (UPDATE) — Gestion atterrissage Customer auth sur racine seller :
   - **Précondition** : middleware seller existant Story 1.4d (basique : check JWT + role) sera étendu ici.
   - Si user atterrit sur `seller.tukio.one/{locale}` (racine) :
     - **Cas 1** : pas authentifié → redirect vers `seller.tukio.one/{locale}/auth/sign-up` (AC2)
     - **Cas 2** : authentifié `role=client` (Customer, status=active) sans role `pro` → afficher page conversion proposée (AC9)
     - **Cas 3** : authentifié `role=pro` (status=`pending_admin_review` OU `active`) → redirect dashboard seller (Story 2.x)
     - **Cas 4** : authentifié `role=client` (Customer) mais email NON vérifié → redirect `seller.tukio.one/{locale}/auth/verify-email-required` (Story 1.6 placeholder)
   - JWT décode pour récupérer `realm_access.roles` + `email_verified` + custom claim `tukio:status`
   - Test vitest pure unit (pattern Story 1.3d v2 `decidePendingRedirect`)

9. **AC9 — `apps/seller/src/app/[locale]/page.tsx`** (UPDATE/NEW) — Page racine seller (Customer auth conversion proposée) :
   - Si rendered (AC8 cas 2), affiche layout simple :
     - Hero `<h1>` (FR "Vous êtes connecté en tant que client. Devenir pro ?" / EN "You're signed in as a client. Become a pro?")
     - Card explicative bénéfices Pro
     - CTA principal `<Button>` (FR "Démarrer ma demande" / EN "Start my application") → click → `window.location.assign(\`/${locale}/seller/onboarding/identity\`)` (wizard step 1 Story 1.3 v2)
     - Lien secondaire "Retour à mon compte" → `tukio.one/{locale}/account/dashboard`
   - i18n namespace `seller.conversion.welcome.*` (~10 keys)
   - axe-core 0 violations

10. **AC10 — Playwright e2e `apps/seller/e2e/auth/signup-pro-portal.spec.ts`** (NEW — 14 cases) :
    - 2 projects FR + EN
    - Header CTA apex visible sur `tukio.one/{locale}` (1 case — vérifie via cross-zone fetch ou stub)
    - Click CTA apex → redirect `seller.tukio.one/{locale}/auth/sign-up` (1 case)
    - axe-core 0 violations sur sign-up + login + page conversion (3 cases × 2 locales = 6 cases)
    - Submit signup Pro happy path → vérifier `POST /v1/auth/customer/register` body contient `signupOrigin: 'pro_portal'` + cookie `tukio-signup-intent=pro` set + DB column `signup_intent='pro'` (mock identity-svc via fixture) (2 cases — FR + EN)
    - Customer auth visite `seller.tukio.one` → vérifier page conversion proposée affichée (CTA "Démarrer ma demande" cible `/seller/onboarding/identity`) (2 cases — FR + EN)
    - Pas auth visite `seller.tukio.one` → vérifier redirect sign-up Pro (1 case)
    - Email NON vérifié visite `seller.tukio.one` → vérifier redirect `auth/verify-email-required` (1 case)

11. **AC11 — Observability** :
    - Métrique Prometheus gateway-api : `tukio_register_customer_total{signupOrigin=customer_portal|pro_portal}` counter (extension Story 1.2c métriques existantes)
    - Métrique Prometheus identity-svc : `tukio_signup_intent_set_total` counter incrémenté à chaque `setSignupIntent('pro')`
    - Métrique Prometheus identity-svc : `tukio_signup_intent_cleared_total{reason=conversion_succeeded|conversion_rejected|manual_admin}` counter
    - Pas de Grafana dashboard dédié pour cette story (intégré au dashboard auth-flow Story 1.4d)

12. **AC12 — Documentation** :
    - Runbook NEW `docs/runbook/dual-portal-signup-flow.md` (~80 lignes) : flow 9 étapes complet + diagram + diagnostic flag intent + dépannage cookie expiré
    - ADR-018 (NEW) `docs/adr/0018-dual-portal-signup-customer-first-backend.md` (~60 lignes) : décision architecturale dual-portal UX + 1 backend Customer-first, rationale, alternatives considérées (Customer-first pure rejetée pour UX Pro, dual-backend rejetée pour code duplication)
    - Update `AGENTS.md` section Hard Rules : ajouter mention dual-portal pattern
    - Update mémoire `MEMORY.md` si necessary (déjà fait via [[project-signup-dual-portal-2026-05-17]])

## Tasks/Subtasks

- [ ] **Task 1** — AC5 : Extension `@tukio/contracts/dtos/identity/register-customer.dto.ts` + tests vitest (~6 cases : signupOrigin optional + default + enum strict + backward-compat sans field + Zod parse OK + type re-export)
- [ ] **Task 2** — AC4 : Migration TypeORM identity-svc `AddSignupIntentToUserProfile` + index partiel + tests integration testcontainer Postgres (apply + rollback + insert with NULL + insert with 'pro') + mapper update + aggregate `UserProfile.setSignupIntent()` + `.clearSignupIntent()` + tests unit jest (~8 cases)
- [ ] **Task 3** — AC5 : `RegisterCustomerUseCase` identity-svc UPDATE pour propagate `signupOrigin` → `userProfile.setSignupIntent('pro')` si `'pro_portal'` + tests unit jest (~4 cases)
- [ ] **Task 4** — AC6 : `RegisterCustomerController` gateway-api UPDATE pour poser cookie `tukio-signup-intent=pro` si body.signupOrigin === 'pro_portal' + helper `cookie-helpers.ts` extension + tests e2e (~4 cases : pro_portal pose cookie, customer_portal ne pose pas, attributs cookie corrects, expires 24h)
- [ ] **Task 5** — AC1 : `apps/public/src/components/Header.tsx` UPDATE CTA "Devenir pro" + i18n FR/EN + variant mobile drawer + tests vitest + axe-core (~6 cases)
- [ ] **Task 6** — AC2 : `apps/seller/src/app/[locale]/auth/sign-up/page.tsx` NEW + `SellerSignupForm.tsx` component (reuse pattern Story 1.2d) + 3 cards bénéfices + i18n namespace `seller.auth.signup.*` (~25 keys × 2 locales) + tests vitest unit
- [ ] **Task 7** — AC3 : `apps/seller/src/app/[locale]/auth/login/page.tsx` NEW + `SellerLoginCta.tsx` (reuse Story 1.4c LoginCta pattern) + i18n namespace `seller.auth.login.*` (~12 keys × 2 locales)
- [ ] **Task 8** — AC8 : `apps/seller/src/middleware.ts` UPDATE (4 cas atterrissage racine) + tests vitest pure unit (~10 cases : not authenticated, customer pending verify, customer active, pro pending_admin_review, pro active, locale resolve, malformed JWT, expired JWT, etc.)
- [ ] **Task 9** — AC9 : `apps/seller/src/app/[locale]/page.tsx` UPDATE/NEW page conversion proposée + i18n namespace `seller.conversion.welcome.*` (~10 keys × 2 locales) + tests vitest
- [ ] **Task 10** — AC10 : Playwright e2e `apps/seller/e2e/auth/signup-pro-portal.spec.ts` 14 cases × 2 projects + fixtures + smoke local via `pnpm docker:up`
- [ ] **Task 11** — AC11 : Métriques prom-client (3 nouvelles métriques) module-level + tests unit + ajout panels Grafana auth-flow dashboard Story 1.4d
- [ ] **Task 12** — AC12 : Runbook `dual-portal-signup-flow.md` + ADR-018 + AGENTS.md hard rules update + memory check
- [ ] **Task 13** — Validation finale : `pnpm lint && pnpm typecheck && pnpm test:cov` per workspace impacté (@tukio/contracts + @tukio/api-client + identity-svc + gateway-api + apps/public + apps/seller) + Playwright run

## Dev Notes

### Project Structure

```
packages/contracts/src/dtos/identity/
└─ register-customer.dto.ts                                     # UPDATE — ajout signupOrigin optional + Zod + re-export type

packages/api-client/src/hooks/auth/
└─ use-register-customer.ts                                     # UPDATE — accepte signupOrigin dans input

apps/identity-svc/src/
├─ domain/model/user-profile.aggregate.ts                       # UPDATE — ajout signupIntent + setSignupIntent + clearSignupIntent
├─ domain/model/user-profile.types.ts                           # UPDATE — type SignupIntent
├─ infrastructure/typeorm/entities/user-profile.entity.ts       # UPDATE — column signup_intent
├─ infrastructure/typeorm/mappers/user-profile.mapper.ts        # UPDATE — map signupIntent ↔ signup_intent
├─ infrastructure/typeorm/migrations/<timestamp>-AddSignupIntent.ts  # NEW migration
├─ usecases/register-customer/register-customer.usecase.ts      # UPDATE — set intent si pro_portal
└─ infrastructure/observability/signup-intent.metrics.ts        # NEW prom-client metrics

apps/gateway-api/src/
├─ infrastructure/http/controllers/register-customer.controller.ts  # UPDATE — set cookie si pro_portal body
├─ infrastructure/http/cookies/cookie-helpers.ts                # UPDATE — setSignupIntentCookie helper (réutilise Story 1.4a)
├─ infrastructure/observability/signup.metrics.ts               # UPDATE — label signupOrigin
└─ test/auth/register-customer-pro-portal.e2e-spec.ts           # NEW e2e 4 cases

apps/public/src/
├─ components/Header.tsx                                        # UPDATE — CTA "Devenir pro" desktop + drawer mobile
├─ components/Header.spec.tsx                                   # NEW vitest + axe
└─ messages/{fr,en}.json                                        # UPDATE — namespace header.becomePro

apps/seller/src/
├─ app/[locale]/auth/
│  ├─ sign-up/page.tsx                                          # NEW
│  └─ login/page.tsx                                            # NEW
├─ app/[locale]/page.tsx                                        # NEW/UPDATE — page racine conversion proposée
├─ features/auth/
│  ├─ components/SellerSignupForm.tsx                           # NEW (reuse pattern Story 1.2d SignUpForm)
│  ├─ components/SellerSignupForm.spec.tsx                      # NEW vitest
│  ├─ components/SellerLoginCta.tsx                             # NEW (reuse Story 1.4c LoginCta)
│  └─ index.ts                                                  # NEW
├─ features/conversion/
│  └─ components/ConversionProposalLayout.tsx                   # NEW
├─ middleware.ts                                                # UPDATE — Story 1.4d extension (4 cas racine)
├─ middleware.spec.ts                                           # UPDATE — +10 cases dual-portal
├─ messages/{fr,en}.json                                        # UPDATE — namespaces seller.auth.signup.*, seller.auth.login.*, seller.conversion.welcome.*
└─ e2e/auth/signup-pro-portal.spec.ts                           # NEW Playwright 14 cases

docs/
├─ adr/0018-dual-portal-signup-customer-first-backend.md        # NEW ADR
└─ runbook/dual-portal-signup-flow.md                           # NEW runbook
```

### Critical Architecture Constraints

- **Backend Customer-first unique** : 1 seul endpoint `POST /v1/auth/customer/register` (Story 1.2c). PAS de duplication. Le portail seller use le même endpoint avec un param body `signupOrigin: 'pro_portal'` qui déclenche set DB column intent. C'est l'invariant à protéger.
- **Le rôle Keycloak créé est TOUJOURS `client`** au signup, même via portail seller. Le rôle `pro` s'obtient via `ConvertCustomerToProUseCase` (Story 1.3b-bis livré) qui assign le realm role + set status `pending_admin_review`. C'est cohérent avec l'invariant "Pro = ex-Customer ayant converti".
- **Flag intent hybride DB+cookie** : la DB column est l'**état source de vérité** (persistant cross-device, cross-session). Le cookie 24h est un **happy-path** pour éviter une query DB sur le redirect post-email-verify dans le cas le plus fréquent (signup → click email immédiat). Robuste multi-device via fallback DB column.
- **Cross-zone session sharing** : grâce aux cookies `Domain=.tukio.one` (Story 1.4a `cookie-helpers.ts`), un Customer connecté sur `tukio.one` qui clique le CTA "Devenir pro" et atterrit sur `seller.tukio.one` est **automatiquement reconnu authentifié** — le middleware AC8 le route vers la page conversion proposée AC9 sans re-login.
- **next-intl strict** (memory `feedback_i18n_frontend.md`) : zéro hardcoded UI string ; tout via namespaces `header.becomePro`, `seller.auth.signup.*`, `seller.auth.login.*`, `seller.conversion.welcome.*` (FR + EN).
- **Code 100% English** (memory `feedback_tech_layer_english.md`) : variable names, comments, JSDoc, schemas, identifiers — tout en EN. Les **strings UI** sont les seules dans messages/{fr,en}.json.
- **RGPD** : la DB column `signup_intent` ne contient aucune PII (juste 'pro' | NULL). Pas de traitement particulier RGPD nécessaire au-delà de l'anonymisation au `delete-customer` Story 1.9.

### Previous Story Intelligence

- **Story 1.2a** : pattern Zod DTO + re-export type via `index.ts` ; extension `RegisterCustomerInputSchema` doit suivre ce pattern.
- **Story 1.2b** : pattern domain aggregate + VO + factory + usecase ; `UserProfile.setSignupIntent()` doit suivre ce pattern (méthode aggregate, pas setter direct).
- **Story 1.2c** : pattern gateway-api Pretre BFF replication + cookie helpers + Throttler scope — `setSignupIntentCookie` doit suivre ce pattern.
- **Story 1.2d** : pattern `SignUpForm.tsx` apps/public — réutiliser pour `SellerSignupForm.tsx` (reuse RHF + Zod resolver + acquisition tracking + a11y) ; SEULES différences sont branding + i18n namespace + `signupOrigin: 'pro_portal'` injecté.
- **Story 1.3d v2** : pattern wizard conversion + middleware seller `decidePendingRedirect` — réutiliser pour middleware extension AC8.
- **Story 1.4a** : `cookie-helpers.ts` utils (déjà ready-for-dev) — étendre avec `setSignupIntentCookie`.
- **Story 1.4b** : 5 endpoints gateway-api opérationnels — Story 1.11 ne touche AUCUN endpoint OAuth, juste le `RegisterCustomerController` Story 1.2c.
- **Story 1.4c** : pattern login page apex + `LoginCta` — réutiliser pour `SellerLoginCta`.
- **Story 1.4d** : middleware seller existant (basique) à étendre AC8 ; AuthProvider wiring déjà fait par 1.4c.

### What this story does NOT do

- ❌ Ne crée AUCUN nouveau path "pro account" backend — le rôle `pro` s'obtient toujours via Story 1.3b-bis (wizard conversion).
- ❌ N'implémente PAS le redirect post-email-verify (c'est Story 1.6) — juste documente l'AC additionnel à consommer.
- ❌ Ne modifie PAS le flow Customer signup standard apex (`apps/public/[locale]/auth/sign-up`) — Story 1.2d intacte.
- ❌ N'ajoute PAS de field Pro spécifique (SIRET, etc.) à la page sign-up — collectés via wizard conversion Story 1.3 v2.
- ❌ Ne crée PAS de nouveau Keycloak realm/client — utilise `tukio-web` standard (le branding/storytelling vit côté frontend uniquement).

### References

- [Source: epics.md Story 1.4 ligne 1141 (commentaire dual-portal)]
- [Source: 1-4-login-flow-keycloak-authorization-code-pkce.md (parent umbrella warning révisé)]
- [Source: sprint-change-proposal-2026-05-17-bis.md addendum 17h]
- [Source: 1-2c-gateway-api-pretre-forwarder.md (endpoint `POST /v1/auth/customer/register` à étendre)]
- [Source: 1-3-pro-registration-pending-admin-review.md (wizard conversion Story 1.3 v2 livré)]
- [Source: 1-3b-bis-identity-svc-convert-customer-to-pro-handler.md (`ConvertCustomerToProUseCase`)]
- [Source: 1-4a-contracts-utils-keycloak-oauth-client.md (`cookie-helpers.ts` à étendre)]
- [Source: 1-4c-frontend-login-callback-authprovider-logout.md (pattern `LoginCta` + `AuthProvider` wiring)]
- [Source: 1-4d-middlewares-auth-client-hooks-observability.md (middleware seller base à étendre AC8)]
- [Memory: project_signup_dual_portal_2026_05_17.md (architecture finale dual-portal — supersedes Customer-first matinale)]
- [Memory: story_1_11_seller_signup_portal_planned.md (spec planning détaillée)]
- [Memory: story_1_4_split.md (note révision Story 1.4 + lien Story 1.11)]
- [Memory: story_0_14_apex_merge_2026_05_15.md (ADR-016 apex unifié)]
- [Memory: feedback_i18n_frontend.md (next-intl strict)]
- [Memory: feedback_tech_layer_english.md (code 100% EN)]

## Story Completion Status

- **Story Status** : `ready-for-dev`
- **Created** : 2026-05-17 (post-révision dual-portal 17h, via /bmad-correct-course addendum sprint-change-proposal-2026-05-17-bis.md)
- **Epic** : Epic 1 (Identity & Authentication Backbone — MVP)
- **Estimation effort** : 2-3j dev fullstack (~12-15 fichiers NEW + ~8 UPDATES)
- **Dépendances upstream (blocking)** :
  - **Story 1.4a** (cookie-helpers.ts à étendre) — 🔴 blocking
  - **Story 1.4b** (5 endpoints + `RegisterCustomerController` Story 1.2c à étendre) — 🔴 blocking
  - **Story 1.4c** (AuthProvider wiré dans apps/seller layout) — 🔴 blocking
  - **Story 1.4d** (middleware seller base à étendre AC8) — 🔴 blocking
  - Story 1.2a/b/c/d (Customer signup baseline) ✅ livrées
  - Story 1.3 v2 (wizard conversion consommé par AC9 CTA + AC8 cas 3) ✅ livrée
  - Story 0.4 (atomics `<Button>`, `<Card>`, `<FormField>`, `<Link>`) ✅ livrée
  - Story 0.8 (`<AuthProvider>` + hooks) ✅ livrée + finalisation 1.4d
- **Dépendances downstream** :
  - **Story 1.6** (email-verify) consume le flag pour redirect intelligent (AC7 documente l'AC ; implémentation effective dans Story 1.6)
- **Prochaine sub-story** : aucune (Story 1.11 finalise le dual-portal). Suite Epic 1 : Story 1.5 (password-reset), Story 1.6 (email-verify avec consommation flag intent), Story 1.7 (admin TOTP), Story 1.8 (profile mgmt), Story 1.9 (account delete), Story 1.10 (identity-svc Pretre consolidation).
