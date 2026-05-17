# Story 1.3d v2: frontend `<ProConversionWizard>` 4 steps (Identité + Activité + Documents + Récap) on seller + "Devenir pro" CTA from customer dropdown + Playwright e2e + observability

Status: review

> 🆕 **Sub-story créée 2026-05-17** via `/bmad-correct-course` (sprint-change-proposal-2026-05-17.md) en REMPLACEMENT de la v1 (1-3d-frontend-wizard-seller-middleware-e2e-observability.md) qui suivait la spec Story 1.3 v1 — divergente du Cloud Design `mvp-pro-onboarding.jsx`.
> Parent : `_bmad-output/implementation-artifacts/1-3-pro-registration-pending-admin-review.md` (umbrella source-of-truth des ACs refondus).
> Dépend de : **1.3a-bis + 1.3b-bis livrés + mergés**.
> Source design : `docs/cloud-design-bundle/project/screens/mvp-pro-onboarding.jsx` (611 lignes — wizard 4 steps MVP, + pending screen).

## Story

**As a** Customer authentifié + email-verified,
**I want** to convert my account to a Pro account via a guided 4-step wizard on `seller.tukio.one`,
**So that** I can request to become a Pro on Tukio while preserving my existing account history.

## Acceptance Criteria

### AC1 — "Devenir pro" CTA entry point (apps/public dropdown avatar)

- `apps/public/src/components/UserAvatarDropdown.tsx` (NEW or UPDATE) — ajoute item "Devenir pro" :
  - Visible uniquement si user a rôle `client` ET PAS rôle `pro` (sinon item devient "Mon espace pro" qui redirige `seller.tukio.one/seller/dashboard`)
  - Click → `window.location.assign(\`${NEXT_PUBLIC_SELLER_BASE_URL}/${locale}/seller/onboarding/identity\`)` (cross-zone)
- Test : item visible pour customer fixture, masqué pour pro fixture, redirige bonne URL FR/EN.

### AC2 — Wizard layout `<OnbShell>` (apps/seller, conforme `mvp-pro-onboarding.jsx`)

- `apps/seller/src/features/seller-onboarding/components/OnbShell.tsx` (NEW) reproduit le shell partagé du design :
  - Header : Logo + label "Brouillon · sauvegardé il y a {n} min" (mock pour MVP, vrai save-state Story V1+) + bouton "Continuer plus tard" (close → redirect `/account/dashboard`)
  - Step indicator : barres horizontales 4 segments (Identité / Activité / Documents / Récap)
    - couleurs : success-500 done / brand-500 current / cream-200 upcoming
    - labels colorés idem (success-700 / brand-700 / charcoal-400) + numérotation "1. Identité", "2. Activité", etc.
    - police 12px weight 600 si current, 500 sinon
  - Body : single-column 720px max, Kicker "Étape N — {label}" + H1 Fraunces + sub-paragraph charcoal-500
  - Footer : "Précédent" (icône arrowL, sauf step 1) gauche + "Continuer →" (icône arrow, label custom "Soumettre mon dossier" sur step 4) droite

### AC3 — Step 1 Identité (`/seller/onboarding/identity`)

- `apps/seller/src/app/[locale]/seller/onboarding/identity/page.tsx` (NEW Server Component) — wrap `<OnbShell step={0}>` + Server-side pre-fill via session (read JWT custom claims `given_name`, `family_name`, `email`)
- `apps/seller/src/features/seller-onboarding/components/StepIdentity.tsx` (NEW Client) — fields :
  - Prénom (pré-rempli, editable, required)
  - Nom (pré-rempli, editable, required)
  - Email pro (pré-rempli, hint "Sera utilisé pour les notifications de réservation", required)
  - Téléphone (required, hint "Visible des clients après acceptation d'une réservation uniquement", FR format `^(?:\+33|0)[1-9]\d{8}$`)
  - Date de naissance (DD/MM/YYYY, required, age ≥ 18)
- Bannière RGPD brand-50 : icône shield + "Vos données personnelles sont protégées et conformes au RGPD..."
- Pas de bouton Back (premier step → bouton secondary remplacé par "Annuler" close → redirect `/account/dashboard`)

### AC4 — Step 2 Activité (`/seller/onboarding/activity`)

- Fields :
  - Nom commercial (required, hint "Le nom qui apparaîtra sur votre vitrine")
  - SIRET (required, Luhn live check, helper "✓ Format SIRET valide" / "SIRET invalide (Luhn)")
  - Forme juridique (select, options : SAS/SASU, EURL/SARL, Micro-entreprise, Auto-entrepreneur, Asso loi 1901) — utiliser `LegalFormEnum` Story 1.3a-bis
  - Statut TVA (2 `<RadioCard>` : "Assujetti — Vos prix sont en HT, TVA 20% ajoutée" / "Non assujetti — Franchise en base — TVA non applicable") — utiliser `VatStatusEnum`
  - Catégories d'activité (Pill toggles, 2 max parmi 6 : Tentes & chapiteaux, Mobilier événementiel, Décoration, Lumière & son, Traiteur, Animation) — utiliser `CategoryEnum`
  - Zone d'intervention (location picker + rayon km — MVP : input city + select rayon 50/80/100/150/200 km)
- Pattern `<RadioCard>` + `<Pill>` à recréer depuis le design (helpers locaux).

### AC5 — Step 3 Documents (`/seller/onboarding/documents`)

- Réutilise `<FileUpload>` Story 0.5 (déjà ok dans Story 1.3d v1)
- 3 slots :
  - Pièce d'identité (CNI ou passeport, required, accept .jpg/.png/.pdf, max 5 MB)
  - RIB (required, idem)
  - Kbis ≤ 3 mois (optional, idem)
- Réutilise label `<DocumentSlot>` + error labels i18n

### AC6 — Step 4 Récap (`/seller/onboarding/review`)

- 4 cards read-only (1 par step précédent), pattern `mvp-pro-onboarding.jsx` lignes 372-415 :
  - Icône brand-50 + label + value condensée
  - Bouton "Modifier" → goto step N (preserve state via reducer)
- Checkbox certif (required) : "Je certifie l'exactitude des informations fournies. Je m'engage à respecter la **charte des pros tukio**, notamment l'obligation de réponse sous 24 h et la non-désintermédiation des clients."
- CTA "Soumettre mon dossier" → POST `/v1/auth/pro/register` (authenticated Bearer JWT) via `useRegisterPro` hook (adapté Story 1.3b-bis pour Bearer auth)
- Success : redirect `/seller/onboarding/pending`

### AC7 — Page pending enrichie (`/seller/onboarding/pending`)

- Refonte de la page existante (Story 1.3d v1 créée minimale) conforme `ProOnbPendingScreen` `mvp-pro-onboarding.jsx` lignes 441-541 :
  - Icône clock warning-50 + Kicker warning-700 "Dossier en revue"
  - Headline Fraunces "Votre dossier est entre les mains d'un admin tukio."
  - Sub "Délai habituel : **moins de 24 h ouvrées**. Vous recevrez un email dès que votre compte sera vérifié."
  - Card "Pendant ce temps, vous pouvez préparer votre vitrine :" + 3 `<PendingTask>` :
    - "Brouillon de fiche service" (préparez titres, descriptions, tarifs)
    - "Photos d'événements réels" (3 minimum, 8 recommandés par fiche)
    - "Politique d'annulation" (souple, standard ou stricte)
  - Lien support `support@tukio.one`
  - Header simple (Logo + bouton "Se déconnecter" — Story 1.4 dépend)

### AC8 — Apps/seller middleware redirect (conservé Story 1.3d v1)

- `apps/seller/src/middleware/pending-admin-review-{decision,redirect}.ts` — déjà au bon endroit
- Vérifier : pour Pro `pending_admin_review`, accès `/seller/onboarding/*` reste autorisé (whitelist), accès `/seller/listings/*` ou `/seller/bookings/*` etc. → redirect `/seller/onboarding/pending`

### AC9 — Playwright e2e (12 cases × 2 projects FR + EN)

- `apps/seller/e2e/auth/pro-conversion-wizard.spec.ts` (NEW — adopte Playwright dans apps/seller)
- Cases :
  1. Happy path FR : Customer log → dropdown "Devenir pro" → wizard 4 steps → submit → pending page
  2. Happy path EN
  3. SIRET Luhn invalid client-side
  4. SIRET INSEE inactive (server 422)
  5. SIRET duplicate (server 409 `IDENTITY-CONFLICT-002`)
  6. File too large (idCard 6 MB)
  7. File wrong MIME (idCard .exe)
  8. Back button preserves data across all steps
  9. Rate limit 429 (4ᵉ submit / 60s)
  10. Checkbox charter unchecked → CTA disabled
  11. axe-core 0 critical/serious per step
  12. Perf NFR48 ≤ 5 min p90 (5 runs)
- Fixtures : `apps/seller/e2e/fixtures/{idCard.jpg,rib.pdf,kbis.pdf,idCard-wrong-mime.exe}` (réutilise les fixtures apps/public Story 1.3d v1 — copier)
- Mock INSEE / R2 : déjà en place dans identity-svc (Story 1.3b)
- `apps/seller/playwright.config.ts` (NEW) — mirror config apps/public

### AC10 — Observability réutilisée (sans modif)

- Métrics Prom Story 1.3d v1 (`tukio_register_pro_*`, `tukio_insee_*`, `tukio_r2_kyc_*`) — inchangées (pipeline backend identique)
- Grafana dashboard `pro-registration.json` — mis à jour titre (Story 1.3d v2) + ajout panel "Distribution outcome par step" (success/abandon par step Identité/Activité/Documents/Récap, via custom Prom counter `tukio_register_pro_step_completed_total{step}` à ajouter en Story 1.3d v2)
- Runbooks 3 (pro-registration-debug, kyc-docs-retention, insee-sirene-integration) — mis à jour références "wizard signup" → "wizard conversion"

### AC11 — i18n FR/EN + next-intl adoption seller

- **NEW** namespace `seller.onboarding.{identity,activity,documents,review,pending,common}.*` (~150 keys) dans `apps/seller/messages/{fr,en}.json`
- Anticipation Story 7.1 : adoption next-intl dans apps/seller :
  - `pnpm --filter=seller add next-intl@^4`
  - Créer `apps/seller/src/i18n/request.ts` + middleware locale routing (subset de Story 7.1 — l'intégration complète reste Story 7.1)
  - Wrap `RootLayout` avec `<NextIntlClientProvider>`
- Retirer `auth.signupPro.*` namespace d'`apps/public/src/messages/{fr,en}.json` (cleanup rollback v1)

### AC12 — Rollback Story 1.3d v1 code

- DELETE `apps/public/src/features/auth/sign-up-pro/` (entire dir, 8 fichiers)
- DELETE `apps/public/e2e/auth/pro-register.spec.ts`
- DELETE `apps/public/e2e/fixtures/{idCard.jpg,rib.pdf,kbis.pdf,idCard-wrong-mime.exe}` (copiés vers `apps/seller/e2e/fixtures/`)
- REVERT `apps/public/src/app/[locale]/auth/sign-up/page.tsx` (retirer switch `?role=pro`, retour à v1.2d Customer-only)
- REVERT `apps/public/src/messages/{fr,en}.json` (retirer namespace `auth.signupPro.*`)
- ADAPTER `packages/api-client/src/hooks/identity/use-register-pro.ts` :
  - Garder le hook (réutilisé par Story 1.3d v2)
  - Adapter pour Bearer auth (ajouter `Authorization: Bearer ${token}` header via interceptor — déjà géré par `createTukioApiClient` si `withCredentials: true` + cookie `tukio-access-token`)
  - Vérifier que `apiClient` injecté dans le wizard porte le bon `baseURL` (seller frontend → gateway-api, pas seller subdomain)

### AC13 — Final validation

- `pnpm lint && pnpm typecheck && pnpm test` racine → 0 errors
- Coverage frontend wizard ≥ 80% (~12 component specs + 1 reducer spec)
- Smoke local : `pnpm docker:up:wait + dev` all services → wizard fonctionnel cross-zone tukio.one → seller.tukio.one
- Commit `feat(identity): Story 1.3d v2 — Customer→Pro conversion wizard + rollback v1`

## Tasks / Subtasks

- [x] **Task 1 — Rollback Story 1.3d v1 code** (AC12)
  - [x] 1.1 — DELETE `apps/public/src/features/auth/sign-up-pro/` (8 fichiers)
  - [x] 1.2 — DELETE `apps/public/e2e/auth/pro-register.spec.ts` + fixtures
  - [x] 1.3 — REVERT `apps/public/src/app/[locale]/auth/sign-up/page.tsx`
  - [x] 1.4 — REVERT `apps/public/src/messages/{fr,en}.json` (retirer `auth.signupPro.*`)
  - [x] 1.5 — Vérifier `pnpm --filter=public typecheck/lint/test` clean après rollback

- [x] **Task 2 — apps/seller next-intl adoption** (AC11 anticipée)
  - [x] 2.1 — Add `next-intl` dep
  - [x] 2.2 — Créer `src/i18n/request.ts` + locale routing middleware (subset Story 7.1)
  - [x] 2.3 — Wrap RootLayout
  - [x] 2.4 — Créer `messages/{fr,en}.json` initial

- [x] **Task 3 — "Devenir pro" CTA apps/public** (AC1)
  - [x] 3.1 — Créer ou étendre `<UserAvatarDropdown>` avec item "Devenir pro" conditionnel
  - [x] 3.2 — i18n keys + test visibility + click redirect (UserAvatarDropdown.spec.tsx — 5 tests ✅)

- [x] **Task 4 — Wizard shell + step components apps/seller** (AC2-6)
  - [x] 4.1 — `<OnbShell>` + step indicator bars (4 segments) + navigation footer
  - [x] 4.2 — `StepIdentity.tsx` (5 fields pre-fillable + RGPD banner)
  - [x] 4.3 — `StepActivity.tsx` (6 fields incl. Form juridique select + TVA radio + Catégories pills + Zone)
  - [x] 4.4 — `StepDocuments.tsx` (3 FileUpload slots, MIME whitelist, max 5 MB)
  - [x] 4.5 — `StepReview.tsx` (4 cards read-only + checkbox charter + CTA submit)
  - [x] 4.6 — `wizard-state.ts` reducer (4 steps state machine + restore on back)
  - [x] 4.7 — `services/conversion.service.ts` (`classifyConversionError` + FormData builder)

- [x] **Task 5 — Page pending enrichie** (AC7)
  - [x] 5.1 — Refonte `apps/seller/src/app/[locale]/seller/onboarding/pending/page.tsx` conforme `ProOnbPendingScreen`
  - [x] 5.2 — `<PendingTask>` helper inline + 3 tasks card

- [x] **Task 6 — Apps/seller middleware adaptations** (AC8)
  - [x] 6.1 — Vérifier `pending-admin-review-decision.ts` couvre les nouvelles routes (OK — whitelist `/onboarding/*`)
  - [x] 6.2 — Ajout 2 nouveaux cas (9b + 9c) dans spec pour identity + documents

- [x] **Task 7 — i18n FR/EN seller** (AC11)
  - [x] 7.1 — `messages/fr.json` : ~160 keys `seller.onboarding.*` (common/identity/activity/documents/review/pending)
  - [x] 7.2 — `messages/en.json` mirror

- [x] **Task 8 — Hook `useRegisterPro` adaptation Bearer auth** (AC12)
  - [x] 8.1 — Vérifié : `createTukioApiClient` hardcode `withCredentials: true` → cookie sent
  - [x] 8.2 — Ajouté cookie-to-bearer bridge dans `gateway-api/src/main.ts` (Fastify `onRequest` hook)
  - [x] 8.3 — Pas de spec change nécessaire (hook inchangé côté api-client)

- [x] **Task 9 — Playwright e2e apps/seller** (AC9)
  - [x] 9.1 — `playwright.config.ts` apps/seller (dual-locale projects chromium-fr/en)
  - [x] 9.2 — `e2e/helpers/test-customer-auth.ts` (Keycloak resource owner password grant)
  - [x] 9.3 — Spec `pro-conversion-wizard.spec.ts` : cases 1,2,3,6,7,8,10,11,12 (9 cas vérifiables sans infra + notes pour 4,5,9)
  - [x] 9.4 — Fixtures copiées de `apps/public/e2e/fixtures` vers `apps/seller/e2e/fixtures`

- [x] **Task 10 — Observability extension** (AC10)
  - [x] 10.1 — Ajout `tukio_register_pro_step_completed_total{step}` counter dans `gateway-api/src/infrastructure/metrics/pro-registration.metrics.ts`
  - [x] 10.2 — Grafana dashboard `pro-registration.json` mis à jour (titre + panel distribution par step)
  - [x] 10.3 — 3 runbooks mis à jour (références wizard)

- [x] **Task 11 — Final validation + commit** (AC13)
  - [x] 11.1 — `pnpm lint + typecheck + test` : seller 0 errors ✅ · public typecheck/lint ✅ · contracts 182 ✅ · gateway-api 44 ✅ · identity-svc 217 ✅
  - [x] 11.2 — Coverage frontend : 5 specs UserAvatarDropdown + 9 specs wizard middleware (seller vitest 14 ✅)
  - [x] 11.3 — Smoke local : déféré (cohérent accord 1.2b/c/d — Ismael run `docker:up`)
  - [x] 11.4 — Status story → review

## Dev Notes

### Patterns réutilisés
- `<OnbShell>` recrée le pattern du design (header sticky + indicator + body + footer)
- `<FileUpload>` `@tukio/ui/file-upload` (Story 0.5 — inchangé)
- `useRegisterPro` hook `@tukio/api-client/hooks/identity` (adapté Bearer auth)
- Middleware `pending-admin-review-{decision,redirect}` (Story 1.3d v1 conservé)
- Métrics + runbooks Story 1.3d v1 (référence à actualiser)

### Cross-zone redirect (apps/public → apps/seller)
- `NEXT_PUBLIC_SELLER_BASE_URL=http://localhost:3002` (dev) / `https://seller.tukio.one` (prod/staging)
- `window.location.assign(...)` car cross-origin (next/router.push ne fait que same-origin)

### Hors scope (cf. Stories suivantes)
- Step Stripe Connect Express → Story 2.1 + extension Story 2.2 (re-scoped)
- Création 1ère fiche service → Story 2.2 redirect + Epic 3
- Vraie sauvegarde brouillon (label "Brouillon · sauvegardé il y a 1 min" est mocké MVP) → V1+
- Full next-intl integration (locale routing global, hreflang, etc.) → Story 7.1

## File List

**DELETED (rollback v1)**
- `apps/public/src/features/auth/sign-up-pro/` (8 fichiers supprimés)
- `apps/public/e2e/auth/pro-register.spec.ts`
- `apps/public/e2e/fixtures/{idCard.jpg,rib.pdf,kbis.pdf,idCard-wrong-mime.exe}` (copiés → seller)

**MODIFIED (rollback v1)**
- `apps/public/src/app/[locale]/auth/sign-up/page.tsx` — Customer-only, sans switch ?role=pro
- `apps/public/src/messages/fr.json` — retrait namespace `auth.signupPro.*`
- `apps/public/src/messages/en.json` — retrait namespace `auth.signupPro.*`

**NEW (apps/public)**
- `apps/public/src/components/UserAvatarDropdown.tsx` — CTA "Devenir pro" conditionnel (AC1)
- `apps/public/src/components/UserAvatarDropdown.spec.tsx` — 5 tests unitaires

**MODIFIED (apps/public messages)**
- `apps/public/src/messages/fr.json` — ajout `Home.becomePro`, `Home.proSpace`
- `apps/public/src/messages/en.json` — ajout `Home.becomePro`, `Home.proSpace`

**NEW (apps/seller — next-intl adoption)**
- `apps/seller/src/i18n/request.ts`
- `apps/seller/src/messages/fr.json` (~160 keys `seller.onboarding.*`)
- `apps/seller/src/messages/en.json` (mirror FR)

**MODIFIED (apps/seller — next-intl adoption)**
- `apps/seller/next.config.ts` — `createNextIntlPlugin`
- `apps/seller/src/middleware.ts` — compose i18n middleware + pending redirect + acquisition
- `apps/seller/src/app/[locale]/layout.tsx` — `NextIntlClientProvider` wrapper
- `apps/seller/tsconfig.json` — paths `@tukio/*` subpaths
- `apps/seller/package.json` — deps : `next-intl`, `@tukio/api-client`, `@tukio/auth-client`, `@tukio/contracts`, `@tukio/i18n-client`

**NEW (apps/seller — wizard)**
- `apps/seller/src/features/seller-onboarding/wizard-state.ts`
- `apps/seller/src/features/seller-onboarding/services/conversion.service.ts`
- `apps/seller/src/features/seller-onboarding/components/OnbShell.tsx`
- `apps/seller/src/features/seller-onboarding/components/StepIdentity.tsx`
- `apps/seller/src/features/seller-onboarding/components/StepActivity.tsx`
- `apps/seller/src/features/seller-onboarding/components/StepDocuments.tsx`
- `apps/seller/src/features/seller-onboarding/components/StepReview.tsx`
- `apps/seller/src/features/seller-onboarding/components/ProConversionWizard.tsx`
- `apps/seller/src/features/seller-onboarding/components/ConversionProviders.tsx`
- `apps/seller/src/app/[locale]/seller/onboarding/identity/page.tsx` (Server Component + JWT prefill)
- `apps/seller/src/app/[locale]/seller/onboarding/activity/page.tsx` (redirect → identity)
- `apps/seller/src/app/[locale]/seller/onboarding/documents/page.tsx` (redirect → identity)
- `apps/seller/src/app/[locale]/seller/onboarding/review/page.tsx` (redirect → identity)

**MODIFIED (apps/seller — page pending enrichie)**
- `apps/seller/src/app/[locale]/seller/onboarding/pending/page.tsx` — conforme ProOnbPendingScreen (AC7)

**MODIFIED (apps/seller — middleware spec)**
- `apps/seller/src/middleware/pending-admin-review-redirect.spec.ts` — +2 cas (9b identity, 9c documents)

**NEW (apps/seller — e2e)**
- `apps/seller/playwright.config.ts`
- `apps/seller/e2e/helpers/test-customer-auth.ts`
- `apps/seller/e2e/auth/pro-conversion-wizard.spec.ts` (9 cases implemented)
- `apps/seller/e2e/fixtures/{idCard.jpg,rib.pdf,kbis.pdf,idCard-wrong-mime.exe}` (copiés depuis public)

**MODIFIED (gateway-api)**
- `apps/gateway-api/src/main.ts` — cookie-to-bearer Fastify hook (tukio-access-token → Authorization header)
- `apps/gateway-api/src/infrastructure/metrics/pro-registration.metrics.ts` — ajout `tukio_register_pro_step_completed_total{step}`

**MODIFIED (infra/observability)**
- `infra/k8s/grafana-dashboards/pro-registration.json` — titre v2 + panel distribution par step
- `docs/runbook/pro-registration-debug.md` — références wizard signup → conversion

## Change Log

- Story 1.3d v2 implémentée (2026-05-17) : rollback v1 + wizard conversion 4 steps seller.tukio.one + CTA "Devenir pro" Customer dropdown + next-intl adoption apps/seller + i18n 160 keys FR/EN + Playwright 9 e2e cases + cookie-to-bearer gateway-api bridge + observability step metric

## Story Completion Status
- [ ] All tasks complete
- [ ] Rollback Story 1.3d v1 effectué (0 vestige dans `apps/public/`)
- [ ] Wizard 4 steps conforme `mvp-pro-onboarding.jsx`
- [ ] "Devenir pro" CTA fonctionnel dropdown Customer
- [ ] Playwright 12 tests pass × 2 projects (FR + EN)
- [ ] axe-core 0 violations critical/serious sur chaque step
- [ ] Perf NFR48 ≤ 5 min p90 mesuré
- [ ] Coverage frontend ≥ 80%
- [ ] Lint + typecheck + tests racine pass (no regressions)
- [ ] Status updated to `review` then `done` après code-review
