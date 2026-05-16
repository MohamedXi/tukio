# Story 1.3d: frontend `<ProSignUpWizard>` 3 steps + apps/seller middleware redirect + Playwright e2e + observability

Status: ready-for-dev

> 🧩 **Sub-story 4/4 de Story 1.3** (décomposée 2026-05-16 via `/bmad-correct-course`).
> Parent : `_bmad-output/implementation-artifacts/1-3-pro-registration-pending-admin-review.md` (umbrella source-of-truth des ACs/Dev Notes complets).
> Proposal : `_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-16.md`.
> Dépend de : **1.3a + 1.3b + 1.3c livrés + mergés + staging deploy vert**.

## Story

**As a** dev frontend qui implémente Epic 1 Story 1.3,
**I want** que `apps/public` expose `/{locale}/auth/sign-up?role=pro` rendant un wizard 3 steps (`<StepIndicator>` Story 0.5 + `<StepAccount>` réutilisant les champs Customer Story 1.2 + `<StepCompany>` 6 `<FormField>` Société + `<StepDocuments>` 3 `<FileUpload>` Story 0.5) avec validation immédiate Zod (réutilise `RegisterProInputSchema` Story 1.3a), state local via `useReducer` au niveau wizard, navigation back/forward préservant les données, i18n FR/EN strict (~40 keys sous namespace `auth.signupPro.*`), acquisition tracking `useAcquisitionTracking()` hook Story 1.2d réutilisé ; submit final via `useRegisterPro` hook (TanStack Query mutation multipart FormData) qui POST `/v1/auth/pro/register` (gateway-api 1.3c) ; loading state pendant ~10-15s (INSEE + R2 uploads), redirect post-success cross-zone vers `seller.tukio.one/{locale}/seller/onboarding/pending` (Vercel rewrites Story 0.13 ADR-013) ; mapping erreurs `IDENTITY-CONFLICT-002` (SIRET utilisé) → message inline champ SIRET, `IDENTITY-VALIDATION-003` (SIRET inactif INSEE) → message champ SIRET, `RATE-LIMIT-EXCEEDED-001` → message global, `EXTERNAL-002/003` (INSEE/R2 down) → message générique 5xx. **And** `apps/seller/src/middleware.ts` intercepte les requêtes vers les paths transactionnels (`/seller/listings/*`, `/seller/bookings/*`, `/seller/payouts/*`, `/seller/transactions/*`) ; si JWT claim `tukio:status === 'pending_admin_review'` → 302 redirect vers `/seller/onboarding/pending`, sauf paths whitelist (`/seller/onboarding/*`, `/seller/profile/*`, `/seller/messaging/*`, `/api/*`). Page placeholder `apps/seller/src/app/[locale]/seller/onboarding/pending/page.tsx` finalisée Story 2.x avec track avancement KYC. **And** Playwright e2e 11 tests : wizard FR + EN, upload 3 files, submit, vérifier redirect + toast + axe-core 0 violations critical/serious + perf NFR48 ≤ 5 min p90 (10 runs). **And** observability : métriques Prom gateway-api `tukio_register_pro_*` + identity-svc `tukio_insee_calls_total` + `tukio_r2_kyc_uploads_total`, Grafana dashboard `pro-registration.json` 5 panels, 3 runbooks (`pro-registration-debug.md`, `kyc-docs-retention.md`, `insee-sirene-integration.md` documentant la deviation apiKey vs OAuth2),
**so that** un Pro peut soumettre son dossier en moins de 5 min (NFR48), les paths transactionnels sont gated (FR17), et l'admin peut traiter la file `pending_admin_review` via Stories 2.3-2.4.

> **Outcome attendu** : à la fin de 1.3d, un Visitor sur `tukio.one/fr/auth/sign-up?role=pro` voit le wizard 3 steps stylé Tailwind v4 + tokens design system Story 0.3 ; complète Step 1 (Compte) → "Continuer →" → Step 2 (Société, SIRET validé Luhn côté client) → "Continuer →" → Step 3 (Documents, 3 `<FileUpload>` accept .jpg/.png/.pdf max 5 MB) → "Soumettre mon dossier" → spinner 10-15s → redirect `seller.tukio.one/fr/seller/onboarding/pending` + toast succès `"Dossier soumis. Validation sous 24h."`. Un Pro qui se logge (Story 1.4) puis tape `seller.tukio.one/seller/listings/new` → 302 redirect vers `/seller/onboarding/pending`. `pnpm --filter=apps/public test:e2e --project=chromium-fr --project=chromium-en --grep "pro register"` passe 11/11 + axe-core 0 violations + perf p90 ≤ 5 min. Grafana dashboard `pro-registration.json` shippé visible quand Prometheus déployé (Story 1.10).

## Acceptance Criteria (héritées de Story 1.3)

Cette story couvre **AC1** (frontend wizard) + **AC7** (seller middleware) + **AC9** (Playwright e2e) + **AC10** (observability) intégralement.

### AC1 (1.3d) — Frontend wizard `<ProSignUpWizard>` 3 steps

Voir parent ligne 17-43 pour le détail UI/UX + parent ligne 1067-1126 pour le squelette annoté.

**Layout switch** :
- `apps/public/src/app/[locale]/auth/sign-up/page.tsx` (UPDATE Story 1.2d) — detect `?role=pro` query param :
  - Si `role !== 'pro'` → rend `<SignUpForm>` Story 1.2d (Customer, défaut)
  - Si `role === 'pro'` → rend `<ProSignUpWizard>` (NEW Story 1.3d)
- Pattern : Server Component layout réutilisé (`<AuthShell side="right">` Story 1.2d), seul le children change

**Composants** (sous `apps/public/src/features/auth/sign-up-pro/`) :
- `components/ProSignUpWizard.tsx` (NEW Client Component, 'use client') — state machine via `useReducer<WizardState, WizardAction>` :
  ```tsx
  type WizardState = {
    currentStep: 1 | 2 | 3;
    account: AccountFormData | null;
    company: CompanyFormData | null;
    documents: { idCard: File | null, rib: File | null, kbisOrInsee: File | null };
  };
  ```
- `components/StepAccount.tsx` (NEW) — réutilise champs de `<SignUpForm>` Story 1.2d (email, password, firstName, lastName, locale, acceptTerms, acceptMarketing) ; sub-component partagé via `@tukio/ui/patterns` future refactor
- `components/StepCompany.tsx` (NEW) — 6 `<FormField>` Society (companyName, siret, vatNumber?, address (street, postalCode, city, country=FR), contactPhone) + validation Zod sur blur (réutilise `RegisterProInputSchema` 1.3a) + SIRET Luhn check immédiat avec helper text « ✓ SIRET valide » ou « SIRET invalide (Luhn check failed) »
- `components/StepDocuments.tsx` (NEW) — 3 `<FileUpload>` Story 0.5 (idCard required .jpg/.png/.pdf max 5 MB + rib required + kbisOrInsee optional + preview thumbnail si image, icône PDF si PDF)
- `components/SignUpProProviders.tsx` (NEW) — wrap `QueryProvider` + `ApiClientProvider` (pattern Story 1.2d `SignUpProviders`)
- `services/sign-up-pro.service.ts` (NEW) — fonction `submitProRegistration({ account, company, documents }): Promise<RegisterProResponse>` qui construit FormData :
  ```ts
  const fd = new FormData();
  fd.append('data', JSON.stringify({ ...account, ...company, acquisition }));
  fd.append('idCard', documents.idCard);
  fd.append('rib', documents.rib);
  if (documents.kbisOrInsee) fd.append('kbisOrInsee', documents.kbisOrInsee);
  return apiClient.post('/v1/auth/pro/register', fd, { headers: { /* no Content-Type, let browser set boundary */ } });
  ```

**Hook** :
- `packages/api-client/src/hooks/identity/use-register-pro.ts` (NEW) — TanStack Query `useMutation` consumming `apiClient.post` multipart FormData ; types `RegisterProInput` + `RegisterProResponse` depuis `@tukio/contracts/dtos/identity/register-pro` ; onSuccess redirect via Next.js `useRouter().push` cross-zone vers `https://seller.tukio.one/{locale}/seller/onboarding/pending` (en local : `http://localhost:3002/...`)
- `packages/api-client/src/hooks/index.ts` (UPDATE) — barrel exporte `useRegisterPro`

**i18n FR/EN** :
- `apps/public/messages/{fr,en}.json` (UPDATE) — ajouter namespace `auth.signupPro.*` (~40 keys) :
  - `auth.signupPro.title` / `subtitle` / `kicker`
  - `auth.signupPro.steps.{account,company,documents}` (labels StepIndicator)
  - `auth.signupPro.account.{email,password,firstName,lastName,locale,acceptTerms,acceptMarketing}.{label,placeholder,helper,error.*}`
  - `auth.signupPro.company.{companyName,siret,vatNumber,address.{street,postalCode,city,country},contactPhone}.{label,placeholder,helper,error.*}`
  - `auth.signupPro.documents.{idCard,rib,kbisOrInsee}.{label,helper,error.*}`
  - `auth.signupPro.cta.{continue,back,submit,submitting}`
  - `auth.signupPro.success.toast`
  - `auth.signupPro.errors.{conflictSiret,inactiveInsee,rateLimit,external,generic}`
  - `auth.signupPro.editorial.{kicker,quote,author.{name,role}}` (réutilise structure 1.2d AuthShell)

### AC2 (1.3d) — Apps/seller middleware redirect + page placeholder

Voir parent ligne 674-703.

- `apps/seller/src/middleware.ts` (NEW or UPDATE) — intercepter requests + check JWT claim :
  ```ts
  // Whitelist paths qui doivent rester accessibles pour pending
  const PENDING_ALLOWED_PATTERNS = [
    /^\/[a-z]{2}\/seller\/onboarding(\/|$)/,
    /^\/[a-z]{2}\/seller\/profile(\/|$)/,
    /^\/[a-z]{2}\/seller\/messaging(\/|$)/,
    /^\/api(\/|$)/,
  ];
  if (pathname matches /^\/[a-z]{2}\/seller(\/|$)/ && !PENDING_ALLOWED_PATTERNS.match(pathname)) {
    const jwt = decodeJwtFromCookie(req);
    if (jwt?.['tukio:status'] === 'pending_admin_review') {
      return NextResponse.redirect(new URL(`/${locale}/seller/onboarding/pending`, req.url));
    }
  }
  ```
- `apps/seller/src/app/[locale]/seller/onboarding/pending/page.tsx` (NEW) — placeholder Server Component avec : Logo + headline "Dossier en cours de validation" + body "Votre dossier sera traité sous 24h." + back-to-home + footer copyright (réutilise `<AuthShell side="left">` Story 1.2d pattern — peut être copié dans apps/seller features)
- `apps/seller/messages/{fr,en}.json` (UPDATE) — ajouter namespace `seller.onboarding.pending.*`
- `apps/seller/e2e/middleware/pending-redirect.spec.ts` (NEW) — 4 tests Playwright : (1) JWT pending + `/seller/listings/new` → redirect, (2) JWT pending + `/seller/onboarding/profile` → no redirect, (3) JWT active + `/seller/listings/new` → no redirect, (4) no JWT → redirect to login (Story 1.4 future)

### AC3 (1.3d) — Tests Playwright e2e wizard FR + EN + axe-core + perf NFR48

Voir parent ligne 714-727.

- `apps/public/e2e/auth/pro-register.spec.ts` (NEW) — 11 tests dans 2 projects (`chromium-fr` + `chromium-en`) :
  1. Wizard happy path FR : step 1 → 2 → 3 → submit → redirect + toast (testid `pro-signup-success-toast`)
  2. Wizard happy path EN
  3. SIRET Luhn invalid client-side : helper text « SIRET invalide »
  4. SIRET valid format mais 422 INSEE inactive (mock identity-svc) : message inline
  5. SIRET duplicate 409 : message inline « SIRET déjà associé... »
  6. File too large (idCard 6 MB fixture) : FileUpload reject message
  7. File wrong MIME (idCard .exe fixture) : reject
  8. Back button préserve les données step 2 → step 1 → step 2 (state restored)
  9. Rate limit 429 : 4ᵉ submit dans 60s → message global « Trop de tentatives »
  10. axe-core scan sur chaque step : 0 violations critical/serious
  11. Perf NFR48 ≤ 5 min p90 (5 runs measured)
- `apps/public/e2e/fixtures/{idCard.jpg,rib.pdf,kbis.pdf,idCard-too-large.jpg,idCard-wrong-mime.exe}` (NEW) — fixtures binaires (~1-2 MB chacune sauf too-large 6 MB)
- Mock INSEE setup : nock au niveau identity-svc test (testcontainer + apiKey header X-INSEE-Api-Key-Integration fixture) ; SIRETs fixtures actif `'35600000000048'`, inactif `'00000000000000'`
- Mock R2 setup : `aws-sdk-client-mock` au niveau identity-svc test (Story 1.3b) — sufficient pour wizard e2e
- `.github/workflows/e2e.yml` (UPDATE Story 1.2d) — ajouter `pnpm --filter=apps/public test:e2e --project=chromium-fr --project=chromium-en --grep "pro register"` au job e2e backend

### AC4 (1.3d) — Observability + runbooks

Voir parent ligne 728-739.

- gateway-api métriques Prom (`apps/gateway-api/src/infrastructure/metrics/pro-registration.metrics.ts` NEW) :
  - `tukio_register_pro_total{outcome}` counter (success / conflict / validation_failed / external_unreachable / throttled)
  - `tukio_register_pro_duration_seconds{outcome}` histogram (latence end-to-end)
- identity-svc métriques Prom :
  - `tukio_insee_calls_total{outcome}` (success_active / success_inactive / not_found / rate_limited / unreachable)
  - `tukio_insee_duration_seconds` histogram
  - `tukio_r2_kyc_uploads_total{outcome}` (success / fail)
  - `tukio_r2_kyc_signed_urls_total` counter
- `infra/k8s/grafana-dashboards/pro-registration.json` (NEW) — 5 panels : (1) Register Pro rate by outcome, (2) Register Pro p50/p95/p99 latency, (3) INSEE calls rate + INSEE latency, (4) R2 KYC uploads rate + R2 signed URLs, (5) Throttle 429 rate
- `docs/runbook/pro-registration-debug.md` (NEW ~80 lignes) — sections : symptômes, vérifications gateway, vérifications identity-svc, vérifications INSEE (apiKey valid? rate limit consumed?), vérifications R2 (bucket accessible? credentials? quotas?)
- `docs/runbook/kyc-docs-retention.md` (NEW ~40 lignes) — RGPD : 90j rétention post-décision admin, cron delete planifié post-Story 1.10
- `docs/runbook/insee-sirene-integration.md` (NEW ~50 lignes) — documenter deviation apiKey vs OAuth2 (auth model 2024+), endpoints clés, rate limits 30/min, fallback strategy en cas INSEE down

### AC5 (1.3d) — Commit + done

- `packages/contracts/README.md` (UPDATE Story 1.2d) — section "Identity events" ajouter `identity.pro.registered.v1`
- Lint + typecheck + tests : `pnpm lint && pnpm typecheck && pnpm test` racine → tous passent
- Coverage : ≥ 90% use case identity-svc (déjà 1.3a), ≥ 80% gateway-api endpoint (1.3c), ≥ 80% frontend wizard (1.3d) — NFR71
- Commit `feat(identity): Story 1.3d — pro registration frontend wizard + seller middleware + e2e + observability`

## Tasks / Subtasks

- [ ] **Task 1 — Hook `useRegisterPro` + page sign-up switch role param** (AC: #1) — Story 1.3 parent Task 7.1-7.2
  - [ ] 1.1 — Créer `packages/api-client/src/hooks/identity/use-register-pro.ts`
  - [ ] 1.2 — Update `packages/api-client/src/hooks/index.ts` (barrel)
  - [ ] 1.3 — Update `apps/public/src/app/[locale]/auth/sign-up/page.tsx` (switch sur `?role=pro`)

- [ ] **Task 2 — Components wizard 3 steps** (AC: #1) — Story 1.3 parent Task 7.3-7.5
  - [ ] 2.1 — Créer `ProSignUpWizard.tsx` (useReducer state machine)
  - [ ] 2.2 — Créer `StepAccount.tsx`
  - [ ] 2.3 — Créer `StepCompany.tsx` (6 FormField + Luhn check immédiat)
  - [ ] 2.4 — Créer `StepDocuments.tsx` (3 FileUpload)
  - [ ] 2.5 — Créer `SignUpProProviders.tsx`
  - [ ] 2.6 — Créer `services/sign-up-pro.service.ts` (FormData construction)

- [ ] **Task 3 — i18n FR/EN** (AC: #1) — Story 1.3 parent Task 7.6
  - [ ] 3.1 — Update `apps/public/messages/fr.json` (~40 keys `auth.signupPro.*`)
  - [ ] 3.2 — Update `apps/public/messages/en.json` (mirror)

- [ ] **Task 4 — Apps/seller middleware + page pending** (AC: #2) — Story 1.3 parent Task 8
  - [ ] 4.1 — Update (ou créer) `apps/seller/src/middleware.ts` (JWT claim check + whitelist)
  - [ ] 4.2 — Créer `apps/seller/src/app/[locale]/seller/onboarding/pending/page.tsx`
  - [ ] 4.3 — Update `apps/seller/messages/{fr,en}.json`
  - [ ] 4.4 — Tests E2E `apps/seller/e2e/middleware/pending-redirect.spec.ts` (4 cases)

- [ ] **Task 5 — Playwright e2e wizard 11 tests** (AC: #3) — Story 1.3 parent Task 9
  - [ ] 5.1 — Créer `apps/public/e2e/auth/pro-register.spec.ts` (11 tests × 2 projects)
  - [ ] 5.2 — Créer fixtures dans `apps/public/e2e/fixtures/`
  - [ ] 5.3 — Setup mock INSEE (testcontainer wiremock OR nock identity-svc avec apiKey fixture)
  - [ ] 5.4 — Setup mock R2 (aws-sdk-client-mock identity-svc — déjà 1.3b)
  - [ ] 5.5 — Update `.github/workflows/e2e.yml` (ajouter grep "pro register")
  - [ ] 5.6 — Run + vérifier 0 axe-core violations critical/serious
  - [ ] 5.7 — Vérifier perf NFR48 ≤ 5 min p90 (5 runs)

- [ ] **Task 6 — Observability + runbooks** (AC: #4) — Story 1.3 parent Task 10
  - [ ] 6.1 — Créer `gateway-api/src/infrastructure/metrics/pro-registration.metrics.ts`
  - [ ] 6.2 — Créer `identity-svc/src/infrastructure/metrics/insee.metrics.ts` + `r2-kyc.metrics.ts`
  - [ ] 6.3 — Créer `infra/k8s/grafana-dashboards/pro-registration.json` (5 panels)
  - [ ] 6.4 — Créer `docs/runbook/pro-registration-debug.md` (~80 lignes)
  - [ ] 6.5 — Créer `docs/runbook/kyc-docs-retention.md` (~40 lignes)
  - [ ] 6.6 — Créer `docs/runbook/insee-sirene-integration.md` (~50 lignes — flag deviation apiKey)
  - [ ] 6.7 — Update `packages/contracts/README.md` (ajouter pro-registered.v1 à la section Identity events)

- [ ] **Task 7 — Final validation + commit** (AC: #5)
  - [ ] 7.1 — `pnpm lint && pnpm typecheck && pnpm test` racine → 0 errors
  - [ ] 7.2 — Coverage frontend wizard ≥ 80%
  - [ ] 7.3 — Smoke local : `pnpm dev` apps/public + apps/seller + gateway-api + identity-svc + docker:up → wizard fonctionnel
  - [ ] 7.4 — Status story → review

## Dev Notes

### Patterns réutilisés Story 1.2d
- `<AuthShell side="right">` pattern split layout (~même column éditoriale terracotta)
- `useAcquisitionTracking()` hook (acquisition cookie tk_acq lecture client-side)
- `<FormField>`, `<Button>`, `<Spinner>` atoms `@tukio/ui/components`
- `<StepIndicator>`, `<FileUpload>` patterns `@tukio/ui/patterns` (Story 0.5 livré)
- Pattern queries cross-zone : Vercel rewrites Story 0.13 ADR-013 propage `seller.tukio.one`

### Cross-zone redirect (apps/public → apps/seller)
- Pattern dev local : `http://localhost:3002` (apps/seller port 3002)
- Pattern staging : `https://seller.tukio.one` (sous-domaine séparé)
- Detection env : `process.env.NEXT_PUBLIC_SELLER_BASE_URL` (à injecter en compose Story 1.3d)
- Update `apps.prod.yml` service public : ajouter `NEXT_PUBLIC_SELLER_BASE_URL=https://seller.tukio.one`

### Hors scope (couvert ailleurs)
- Story 2.x finalise page `/seller/onboarding/pending` (avec track avancement KYC + Stripe Connect status)
- Story 1.4 implémente login → JWT contient le claim `tukio:status` (déjà côté Keycloak realm Story 1.1)
- Story 1.6 implémente flow email verification → flip `tukio:status` à `active` si admin approve

## File List
_(à remplir pendant le dev)_

## Change Log
_(à remplir pendant le dev)_

## Story Completion Status
- [ ] All tasks complete
- [ ] Playwright 11 tests pass × 2 projects (FR + EN)
- [ ] axe-core 0 violations critical/serious sur chaque step
- [ ] Perf NFR48 ≤ 5 min p90 mesuré
- [ ] Coverage frontend ≥ 80%
- [ ] Lint + typecheck + tests racine pass (no regressions Story 1.2 / 1.3a/b/c)
- [ ] Status updated to `review` then `done` après code-review
