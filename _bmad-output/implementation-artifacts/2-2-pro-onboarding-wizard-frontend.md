# Story 2.2: Pro onboarding wizard frontend (4 steps : Profil + Stripe + KYC + 1ère fiche)

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

**As a** Pro `pending_admin_review` (sortant Story 1.3 + 2.1 partiel),
**I want** un wizard onboarding 4 steps **orchestrateur frontend** sur `apps/seller/{locale}/seller/onboarding/*` qui guide visuellement l'avancement (Profil ✅ → Stripe Connect → Validation Tukio → 1ère fiche) avec `<StepIndicator>` Story 0.5 toujours visible top-page, redirect intelligent middleware Pro `pending_admin_review` qui arrive sur `/seller/` → calcule la `currentStep` selon `useMe()` Story 1.8 checklist (`profile-complete = true` toujours post-register Story 1.3, `stripe-submitted = stripeStatus === 'submitted'`, `kyc-validated = kycStatus === 'approved'`, `first-listing-published = first listing exists Story 3.5`) → redirect 302 `/seller/onboarding/{currentStep}` ; **chaque step est une page wrapper** qui réutilise les features existantes/futures : Step 1 Profil = view-only Story 1.3 data + CTA "Continuer" ; Step 2 Stripe Connect = embed Story 2.1 page (réutilise `<StripeStatusCard>`) ; Step 3 Validation Tukio = display state machine kyc_status (`pending_review` → en attente Admin Story 2.5 ; `under_review` → Admin examine ; `approved` → ✅ + auto-advance step 4 ; `rejected` → ❌ + raison + CTA "Corriger") ; Step 4 1ère fiche = redirect vers `/seller/listings/new` Story 3.3 avec banner "C'est votre 1ère fiche !" ; **completion detection** : quand 4 steps OK (`first listing published` event consume Story 3.5), identity-svc use case `CompleteOnboardingUseCase` set `pro_profiles.onboarding_completed_at = NOW()` + `user_profiles.tukio_status = 'verified'` + Keycloak attribute sync + publish `identity.pro.onboarded.v1` + frontend force-refresh JWT (Story 1.6 utility) → redirect `/seller/dashboard` avec modale `<Modal>"Bienvenue chez Tukio !"` + checklist V1+ next steps (portfolio, certifs, sécuriser comptes) ; **Save & resume** : à chaque step, CTA secondaire "Sauvegarder et reprendre plus tard" → state persisté côté DB (déjà — chaque step a sa propre persistence Stories 1.3/2.1/2.5/3.3) → user peut quitter et revenir, le middleware re-calcule current step + reprend, **NFR48** UX onboarding < 30 min cumulatif (hors attente Admin), **NFR47** motion `prefers-reduced-motion` respecté sur transitions step + animations brand,
**so that** un Pro fraîchement registered Story 1.3 a un **chemin clair et visuellement ancré** vers `verified` (vs deviner ce qu'il manque), les Stories 2.5 (admin acceptation/rejet → unblocks step 3) + 3.5 (listing publish → unblocks step 4) ont leur consumer naturel d'event onboarding-progress, et le **pattern complet "wizard orchestrator multi-step avec state derived from API"** devient template Story 9.x V1 (B2B Customer billing settings wizard 3 steps), Stories Epic 6 V1 (admin onboarding new admin wizard).

> **Outcome attendu** : à la fin de cette story, un Pro fraîchement registered Story 1.3 + verified email Story 1.6 se connecte → atterrit `/seller/` → middleware redirect `/seller/onboarding/stripe` (currentStep calculé : profile ✅ déjà fait Story 1.3, stripe non-fait) → render `<OnboardingLayout>` avec `<StepIndicator>` 4 steps + step 2 active highlighted + content embed Stripe page Story 2.1 ; après Stripe submitted, click "Continuer" → redirect `/seller/onboarding/kyc` → render state machine display `kyc_status='pending_review'` "Votre dossier est en cours de vérification par l'équipe Tukio. Délai estimé : 24h." + bouton "Refaire des modifications" disabled (KYC docs Story 1.3 sont locked post-submit, modifications via support only) ; quand Admin Story 2.5 valide → notification-svc Story 5.4 envoie email "Compte validé !" + Pro reçoit aussi (V1 Story 11.1 in-app notif) → Pro refresh page → step 3 ✅ + auto-advance vers step 4 → redirect `/seller/listings/new` (Story 3.3) avec banner ; après publish 1ère fiche, event `catalog.listing.published.v1` (Story 3.5) consommé par identity-svc CompleteOnboardingUseCase → `tukio_status='verified'` + Keycloak sync + force-refresh JWT côté frontend → redirect `/seller/dashboard` + modale "Bienvenue !" ; un Pro qui sauvegarde et revient 3 jours plus tard se reconnecte → middleware re-calcule current step (e.g., kyc still pending) → reprend où il en était ; un test `pnpm playwright test --grep "pro onboarding wizard"` passe en FR/EN, axe-core 0 violations, perf < 30 min p90 (hors attente Admin) ; un test cron simulation kyc approval → JWT refresh → tukio_status='verified' → dashboard redirect.

## Acceptance Criteria

1. **AC1 — Middleware redirect intelligent `/seller/` → `/seller/onboarding/{currentStep}`** : Given un Pro `pending_admin_review`, When il navigue `seller.tukio.one/{locale}/seller/`, Then :
   - **Update `apps/seller/src/middleware.ts`** (Story 1.4) : étendre logique pending_admin_review redirect (déjà fait Story 1.3) avec calcul `currentStep` :
     ```ts
     // Pseudo-code middleware
     if (jwt.tukio_status === 'pending_admin_review') {
       const me = await fetchInternal('/v1/me'); // Edge runtime fetch with cookies
       const currentStep = calculateCurrentStep(me.prosFields);
       if (request.pathname === `/${locale}/seller` || request.pathname === `/${locale}/seller/`) {
         return NextResponse.redirect(new URL(`/${locale}/seller/onboarding/${currentStep}`, request.url));
       }
       // Allow whitelist : /seller/onboarding/*, /seller/profile (read-only), /seller/help
       const ALLOWED = ['/seller/onboarding', '/seller/profile', '/seller/help', '/seller/settings'];
       if (!ALLOWED.some(p => request.pathname.startsWith(`/${locale}${p}`))) {
         return NextResponse.redirect(new URL(`/${locale}/seller/onboarding/${currentStep}`, request.url));
       }
     }
     ```
   - **Helper `calculateCurrentStep(prosFields)`** :
     - Step 1 `profile` if `companyName == null || siret == null` (Story 1.3 not done — should never happen post-register)
     - Step 2 `stripe` if `stripe_status !== 'submitted'`
     - Step 3 `kyc` if `kyc_status !== 'approved'`
     - Step 4 `first-listing` if `firstListingPublishedAt == null`
     - Else `dashboard` (all done — onboarding complete)
   - **NB** : middleware Edge runtime n'a pas accès direct DB. Solution : (a) appeler `GET /v1/me` Story 1.8 internally with cookies forwarded — coût latence ~50ms acceptable seulement pour redirect logic ; (b) alternative caching cookie `tukio-onboarding-step` set côté backend après mise à jour status — éviter call API à chaque navigation. **Décision MVP** : (a) call `/v1/me` chaque navigation sous `/seller/` (only protected paths) — surface mineure, simpler code.
   - **Tests E2E middleware** : Pro arrive sur `/seller/` avec stripe_status='not_started' → redirect `/seller/onboarding/stripe`. Pro avec kyc_status='approved' navigue `/seller/` → redirect `/seller/onboarding/first-listing`. Pro complete (`first listing exists` + `tukio_status='verified'`) → middleware n'intercepte plus → autorise `/seller/dashboard`.

2. **AC2 — Layout `apps/seller/[locale]/seller/onboarding/layout.tsx` + `<StepIndicator>` 4 steps** : Given Stories 0.5 a posé `<StepIndicator>` pattern, When je consulte `apps/seller/src/app/[locale]/seller/onboarding/layout.tsx` (NEW), Then :
   - **Layout** (Server Component) : fetch `GET /v1/me` côté server, render :
     ```tsx
     export default async function OnboardingLayout({ children, params }: { children: ReactNode; params: { locale: string } }) {
       const me = await fetchMe(); // Server Component fetch helper
       const checklist = computeChecklist(me.prosFields);
       const currentStep = checklist.currentStep;
       
       return (
         <div className="onboarding-container">
           <StepIndicator
             steps={[
               { key: 'profile', label: t('steps.profile'), status: checklist.profile ? 'completed' : 'active' },
               { key: 'stripe', label: t('steps.stripe'), status: checklist.profile && !checklist.stripe ? 'active' : checklist.stripe ? 'completed' : 'pending' },
               { key: 'kyc', label: t('steps.kyc'), status: checklist.stripe && !checklist.kyc ? 'active' : checklist.kyc ? 'completed' : 'pending' },
               { key: 'first-listing', label: t('steps.firstListing'), status: checklist.kyc && !checklist.firstListing ? 'active' : checklist.firstListing ? 'completed' : 'pending' },
             ]}
             current={currentStep}
             completedAtFinal={me.prosFields?.onboardingCompletedAt}
           />
           <main>{children}</main>
         </div>
       );
     }
     ```
   - **i18n** : namespace `seller.onboarding.steps.*` (4 keys) + general `seller.onboarding.layout.*`
   - **Variants `<StepIndicator>`** (Story 0.5 atomic — vérifier exists) : `pending` (gris), `active` (terracotta accent), `completed` (vert check icon), `error` (rouge X) for kyc rejected
   - **Mobile responsive** : sur mobile <768px, `<StepIndicator>` collapse en barre horizontale "Step 2 of 4: Stripe Connect" + bouton "View all steps" qui ouvre modal full list
   - **Accessibility** : `aria-label` "Onboarding progress, step X of 4" + landmark `<nav>` step indicator

3. **AC3 — 4 sub-pages onboarding** : Given AC2 layout, When je consulte les 4 sub-pages, Then :
   - **`apps/seller/src/app/[locale]/seller/onboarding/profile/page.tsx`** (NEW) :
     - Read-only display Story 1.3 data : firstName, lastName, email, companyName, SIRET
     - `<EmptyState variant="success">` "Profil complet ✓" (toujours, post-register Story 1.3)
     - CTA primary "Continuer vers Stripe →" → `/seller/onboarding/stripe`
     - Lien `<Link>` "Modifier mes infos personnelles" → `/seller/profile` Story 1.8
   - **`apps/seller/src/app/[locale]/seller/onboarding/stripe/page.tsx`** (UPDATE Story 2.1 ou move file) :
     - **Décision** : Story 2.1 a livré la page Stripe. Story 2.2 wrap-it dans `<OnboardingLayout>` automatiquement (folder hierarchy Next.js). Pas de modification fonctionnelle, juste architecture path = `/seller/onboarding/stripe` cohérent avec wizard.
     - CTA secondaire "Sauvegarder et reprendre plus tard" → redirect `/seller/dashboard` (qui re-redirige via middleware vers la même step si pas avancé — cohérent UX)
     - Post-Stripe submitted, page render success view (Story 2.1 AC6) + auto-CTA "Continuer vers Validation Tukio →" `/seller/onboarding/kyc`
   - **`apps/seller/src/app/[locale]/seller/onboarding/kyc/page.tsx`** (NEW) — display state machine kyc_status :
     - `pending_review` (post-Story 1.3 register, default) → `<EmptyState variant="info">` icon clock terracotta + "Votre dossier est en cours de vérification" + description "L'équipe Tukio examine vos documents (KYC docs Story 1.3). Délai estimé : 24h ouvrées." + bouton disabled "Refaire des modifications" (KYC docs locked post-submit MVP) + lien `<Link>` "Pourquoi cette étape ?" → `/help/kyc-validation` (placeholder Story 6.x)
     - `under_review` (Admin a commencé Story 2.4) → idem `pending_review` mais texte "L'équipe Tukio examine actuellement votre dossier"
     - `approved` → `<EmptyState variant="success">` icon check vert "Compte validé ✓" + auto-redirect 2s vers `/seller/onboarding/first-listing`
     - `rejected` (Story 2.5) → `<EmptyState variant="error">` icon X rouge "Dossier non validé" + display `kyc_decision_reason` field (set Story 2.5 admin reject reason) + CTA primary "Corriger mon dossier" → re-direct vers `/seller/profile` ou flow re-upload (Story 1.8 V1 — placeholder lien support@tukio.one MVP)
   - **`apps/seller/src/app/[locale]/seller/onboarding/first-listing/page.tsx`** (NEW) — redirect vers Story 3.3 listing creation :
     - Render briefly `<EmptyState variant="info">` "Publier votre 1ère fiche" + CTA primary "Créer ma 1ère fiche →" → redirect `/seller/listings/new?firstListing=true` (Story 3.3 reads `?firstListing=true` query param + render banner "C'est votre 1ère fiche, une fois publiée votre compte sera totalement actif")
     - **Note** : Story 3.5 listing publish flow détecte `firstListingPublishedAt == null` + publish event `catalog.first-listing.published.v1` consommé par identity-svc Story 2.2 use case (AC4)

4. **AC4 — identity-svc use case `CompleteOnboardingUseCase` (event consumer)** : Given AC3 step 4 complete via Story 3.5, When `catalog.first-listing.published.v1` event arrive sur identity-svc inbox, Then :
   - **NEW use case `CompleteOnboardingUseCase`** :
     ```ts
     async execute(input: { proProfileId: string; firstListingId: string; publishedAt: string }): Promise<void> {
       const proProfile = await this.proProfileRepo.findById(input.proProfileId);
       const userProfile = await this.userProfileRepo.findById(proProfile.userProfileId);
       
       // Idempotent : si déjà completed, skip
       if (proProfile.onboardingCompletedAt) return;
       
       // Domain methods
       proProfile.completeOnboarding({ firstListingId: input.firstListingId, completedAt: new Date(input.publishedAt) });
       userProfile.changeTukioStatus('verified'); // domain method NEW Story 2.2 — extends Story 1.8 changeName etc.
       
       // Persist + Keycloak sync + publish event (atomic)
       await this.userProfileRepo.runInTransaction(async (txn) => {
         await txn.userProfileRepo.save(userProfile);
         await txn.proProfileRepo.save(proProfile);
         
         await txn.eventPublisher.publish({
           eventType: 'identity.pro.onboarded',
           eventVersion: 'v1',
           aggregate: { type: 'ProProfile', id: proProfile.id },
           actor: { userId: userProfile.id, role: 'pro' },
           payload: {
             userProfileId: userProfile.id,
             proProfileId: proProfile.id,
             firstListingId: input.firstListingId,
             onboardingCompletedAt: proProfile.onboardingCompletedAt!.toISOString(),
             onboardingDurationDays: differenceInDays(proProfile.onboardingCompletedAt!, proProfile.createdAt),
           },
         });
         
         // Email notification "Bienvenue !" via Resend Story 5.4
         await txn.eventPublisher.publish({
           eventType: 'notification.email.send',
           eventVersion: 'v1',
           aggregate: { type: 'ProProfile', id: proProfile.id },
           actor: { userId: 'system', role: 'system' },
           payload: {
             templateId: 'pro-onboarded-welcome',
             locale: userProfile.locale,
             to: { email: userProfile.email.value, userId: userProfile.id, name: `${userProfile.firstName} ${userProfile.lastName}` },
             params: { firstName: userProfile.firstName, dashboardUrl: `${this.config.getSellerBaseUrl()}/${userProfile.locale}/seller/dashboard` },
           },
         });
       });
       
       // Sync Keycloak attributes (non-fatal)
       try {
         await this.keycloakAdmin.updateUser({ keycloakUserId: userProfile.keycloakUserId, updates: { attributes: { status: ['active'] } } });
       } catch (e) { /* drift R8 reconciliation Story 1.10 */ }
     }
     ```
   - **NEW NATS consumer** `apps/identity-svc/src/infrastructure/messaging/nats/first-listing-published.consumer.ts` — subscribe `catalog.first-listing.published.v1` (Story 3.5 emits) + idempotence inbox + call use case
   - **Domain method** `UserProfile.changeTukioStatus(newStatus)` (NEW Story 2.2 — extension Story 1.8 self-service edit)
   - **Domain method** `ProProfile.completeOnboarding({...})` (NEW Story 2.2)
   - **Migration** `1715280000000-AddOnboardingCompletedAtToProProfiles.ts` : ajouter colonne `onboarding_completed_at TIMESTAMPTZ NULL` + `first_listing_id UUID NULL`
   - Tests unit ≥ 90 % use case (idempotent, transaction, Keycloak sync non-fatal, event published)

5. **AC5 — Frontend completion detection + force-refresh JWT + welcome modal** : Given AC4 backend, When le Pro complète step 4, Then :
   - **Polling state** : la page `/seller/onboarding/first-listing` ou `/seller/dashboard` post-listing-publish polls `GET /v1/me` toutes les 5s jusqu'à ce que `tukioStatus === 'verified'` (~max 30s — délai NATS event consume + Keycloak sync) — alternative WebSocket Story V1 Epic 11 in-app notif. **Décision MVP** : polling simple TanStack Query refetchInterval 5s.
   - **Détection completion** : quand `me.tukioStatus === 'verified'` + `me.prosFields.onboardingCompletedAt != null` :
     1. Trigger force-refresh JWT (Story 1.6 utility) — propage nouveau claim `tukio:status='active'`
     2. Affichage modale `<Modal>` blocker avec `<EmptyState variant="success" size="large">` "🎉 Bienvenue chez Tukio !" + description "Votre compte est maintenant actif. Vous pouvez recevoir des réservations." + CTA "Accéder à mon dashboard" → `/seller/dashboard`
     3. Modale fermée → redirect `/seller/dashboard` (middleware déjà autorise car `tukio_status='active'`)
     4. Dashboard render checklist V1+ next steps (`<Card>` "Optimisez votre profil" placeholder Stories Epic 11 portfolio, certifs, sécurité)
   - **i18n** : namespace `seller.onboarding.welcome.*`

6. **AC6 — Save & resume + checklist progress visualization** : Given chaque step a sa propre persistence backend (Stripe Story 2.1, KYC Story 1.3 immutable submitted, listing Story 3.3 draft autosave), When un Pro clique "Sauvegarder et reprendre plus tard", Then :
   - **CTA secondaire** `<Button variant="ghost">Sauvegarder et reprendre plus tard</Button>` sur chaque step page → simple `<Link href="/seller/dashboard">` (qui re-redirige via middleware vers la même step si pas avancé)
   - **State persisté server-side** : aucun localStorage frontend — toute la state est côté DB (Story 1.3 register, Story 2.1 stripe, Story 1.3 kyc submission, Story 3.3 listing draft autosave V1+)
   - **Resume** : middleware AC1 re-calcule `currentStep` à chaque navigation `/seller/`
   - **Tests** : test scenarios "Pro stop after step 2 → 3 days later → resume on step 3" (mock time + DB state)

7. **AC7 — Email template `pro-onboarded-welcome` + audit event** : Given AC4 publishes events, When notification-svc Story 5.4 consume + audit consumer Story 1.10 consume, Then :
   - **Template `pro-onboarded-welcome.{fr,en}.tsx`** (Story 5.4 livre — Story 2.2 fournit contract) :
     - Subject FR : `"Bienvenue chez Tukio - Votre compte est actif !"` / EN : `"Welcome to Tukio - Your account is now active!"`
     - Body : greeting + Pro firstName + intro + CTA primary "Accéder à mon dashboard" + small print "Vous pouvez maintenant recevoir des réservations"
   - **Event `identity.pro.onboarded.v1`** consume Story 1.10 audit_log + analytics V1 (funnel onboarding completion durée moyenne)

8. **AC8 — Tests Playwright e2e + axe-core + perf NFR48** : 8 tests `apps/seller/e2e/onboarding/wizard.spec.ts` :
   - Test 1 (happy path FR end-to-end) : Pro fixture `pending_admin_review` → login → middleware redirect `/fr/seller/onboarding/stripe` (step 2) → vérifier `<StepIndicator>` 4 steps + step 1 ✅ + step 2 active → simuler Stripe submitted → click "Continuer" → step 3 kyc display "en attente" → trigger Admin approve via testcontainer DB direct → page polling → step 3 ✅ → auto-redirect step 4 → click "Créer ma 1ère fiche" → mock listing publish event → polling detect verified → force-refresh JWT → modal "Bienvenue !" → dashboard
   - Test 2 (happy path EN) : idem `/en/`
   - Test 3 (mid-step abandon + resume) : Pro abandonne à step 2 → 1 jour plus tard se reconnecte → middleware re-calcule current step = stripe → resume où il en était
   - Test 4 (kyc rejected flow) : trigger Admin reject via testcontainer → page step 3 render error EmptyState avec `kyc_decision_reason` + CTA "Corriger mon dossier"
   - Test 5 (mobile responsive) : viewport 375px → vérifier `<StepIndicator>` collapse en barre horizontale + modale full-list works
   - Test 6 (axe-core) : 0 violations sur 4 sub-pages + layout
   - Test 7 (perf NFR48) : mesurer durée totale Pro typique (skip Admin wait via testcontainer fast-track) → assert < 30 min p90
   - Test 8 (idempotent CompleteOnboardingUseCase) : trigger 2x event listing.published → vérifier 1 seul event `pro.onboarded.v1` + 1 seul email
   - Coverage ≥ 80 % wizard frontend + 90 % CompleteOnboardingUseCase

9. **AC9 — `@tukio/contracts` extensions + onboarding-checklist DTO + welcome template** :
   - NEW event `identity/pro-onboarded.v1.{schema.json,ts}`
   - NEW DTO `dtos/seller/onboarding-checklist.dto.ts` (computed checklist: `{ profile: bool, stripe: bool, kyc: KycStatus, firstListing: bool, currentStep: enum, onboardingCompletedAt: string | null }`)
   - Update email-templates.ts : add `'pro-onboarded-welcome'`
   - Update `me.dto.ts` (Story 1.8) : extends `prosFields` avec `onboardingCompletedAt` + `firstListingId` fields

10. **AC10 — Documentation runbook** :
    - `docs/runbook/pro-onboarding-wizard-debug.md` (~40 lignes) : flow 4 steps + troubleshooting (middleware redirect loop, polling stuck, Keycloak attribute drift, JWT refresh failure, listing publish event not consumed)
    - Métriques Prom : `tukio_pro_onboarding_step_visits_total{step}`, `tukio_pro_onboarding_completion_duration_days` (histogram), `tukio_pro_onboarding_abandon_per_step_total{step}`
    - Dashboard Grafana : 4 panels (funnel completion, p50/p90 duration, abandon rate per step, daily completions)

## Tasks / Subtasks

- [ ] **Task 1 — `@tukio/contracts` extensions + email template contract** (AC: #9)
- [ ] **Task 2 — identity-svc migration onboarding_completed_at + first_listing_id** (AC: #4)
- [ ] **Task 3 — identity-svc CompleteOnboardingUseCase + NATS consumer + UserProfile/ProProfile domain methods** (AC: #4) — coverage ≥ 90 %
- [ ] **Task 4 — Frontend layout `<OnboardingLayout>` + `<StepIndicator>` integration** (AC: #2)
- [ ] **Task 5 — Frontend 4 sub-pages (profile, stripe wrap, kyc, first-listing)** (AC: #3)
- [ ] **Task 6 — Frontend completion detection polling + welcome modal + force-refresh JWT** (AC: #5)
- [ ] **Task 7 — Update middleware seller — currentStep redirect logic** (AC: #1)
- [ ] **Task 8 — Update `useMe()` hook + i18n namespaces FR/EN** (AC: #2, #3, #5)
- [ ] **Task 9 — Tests Playwright e2e (8 cases) + axe-core + perf NFR48** (AC: #8)
- [ ] **Task 10 — Documentation runbook + observability + commit** (AC: #10)

## Dev Notes

### Pourquoi Story 2.2 = orchestration UX onboarding Pro

Story 2.2 ne livre **pas de nouvelle feature backend** majeure (sauf `CompleteOnboardingUseCase` event consumer). C'est principalement une story **frontend orchestration** qui glue les Stories 1.3 (register) + 2.1 (Stripe) + 2.5 (admin KYC) + 3.3-3.5 (first listing) en un wizard cohérent.

Pattern réutilisable :
- Story 9.x V1 (B2B Customer billing settings wizard 3 steps)
- Story 6.x V1 (admin onboarding new admin)
- Stories Epic 12 V1+ (devis personnalisés multi-step)

### Décisions techniques majeures actées

1. **Middleware re-calcule currentStep à chaque navigation** (vs cookie cache) — simpler, no cache invalidation issues, latency ~50ms acceptable
2. **Polling state 5s** (vs WebSocket) pour completion detection MVP — Story V1 Epic 11 in-app notif moves to push
3. **Save & resume = state server-side seulement** (no localStorage) — cohérent avec stateless middleware redirect
4. **Wizard layout shared** Next.js folder hierarchy automatically — `app/[locale]/seller/onboarding/layout.tsx` wraps children
5. **Step 2 Stripe page UPDATE Story 2.1** : pas de move file, juste folder hierarchy makes it auto-wrapped in OnboardingLayout
6. **CompleteOnboardingUseCase event-driven** (vs sync API call) — listing-svc publish event Story 3.5 → identity-svc consume → status update
7. **`tukio_status='active'` (vs 'verified')** — alignement avec Stories 1.x enum (`active | pending_admin_review | rejected | suspended`). Le label UI "Validé" ≠ DB enum "active".
8. **EN strict + i18n strict** memories réutilisés

### Versions à utiliser

(Réutilisés Stories 1.x + 2.1 — no new deps)

### Project Structure cible

```
apps/seller/src/
├─ middleware.ts                                                # UPDATE Story 1.4 — currentStep redirect logic
├─ app/[locale]/seller/onboarding/
│  ├─ layout.tsx                                                # NEW Story 2.2 — wizard layout
│  ├─ page.tsx                                                  # NEW — redirect logic to currentStep
│  ├─ profile/page.tsx                                          # NEW Story 2.2 — read-only display
│  ├─ stripe/page.tsx                                           # MOVED Story 2.1 (or just exists in this path)
│  ├─ kyc/page.tsx                                              # NEW Story 2.2 — state machine display
│  └─ first-listing/page.tsx                                    # NEW — redirect to listings/new
└─ features/seller/onboarding/components/
   ├─ KycStatusView.tsx                                         # NEW — pending/under_review/approved/rejected
   ├─ FirstListingRedirect.tsx                                  # NEW
   ├─ OnboardingWelcomeModal.tsx                                # NEW (post-completion)
   └─ OnboardingChecklistHeader.tsx                             # NEW (alternative <StepIndicator> mobile)

apps/identity-svc/src/
├─ domain/model/{user-profile,pro-profile}.aggregate.ts         # UPDATE — changeTukioStatus + completeOnboarding methods
├─ usecases/complete-onboarding.usecase.ts                      # NEW + spec
├─ infrastructure/messaging/nats/first-listing-published.consumer.ts  # NEW
└─ infrastructure/persistence/typeorm/migrations/1715280000000-AddOnboardingCompletedAtToProProfiles.ts  # NEW

packages/contracts/src/
├─ events/identity/pro-onboarded.v1.{schema.json,ts}            # NEW
├─ dtos/seller/onboarding-checklist.dto.ts                      # NEW
└─ types/email-templates.ts                                     # UPDATE

packages/api-client/src/hooks/seller/use-onboarding-checklist.ts  # NEW (computed from useMe Story 1.8)

apps/seller/messages/{fr,en}.json                               # UPDATE — namespaces

infra/k8s/grafana-dashboards/pro-onboarding-funnel.json         # NEW
docs/runbook/pro-onboarding-wizard-debug.md                     # NEW

# Estimation total fichiers : ~30 nouveaux + ~10 updates = ~40 fichiers
```

### Critical Architecture Constraints

> Cf. Stories 1.x + 2.1 + memories.

1. **Pretre + Symbol DI tokens + Envelope ADR-014** (réutilisés)
2. **Outbox transactional + inbox idempotency** (Stories 0.7 + 1.10)
3. **EN strict + i18n strict + RGAA AA** (memories)
4. **NFR47 motion** : `prefers-reduced-motion` respecté sur transitions
5. **NFR48** : < 30 min p90 onboarding cumulatif

### Previous Story Intelligence

**Story 1.3** : ProProfile aggregate (Story 2.2 ajoute `completeOnboarding` method + `onboarding_completed_at` field).

**Story 1.6** : `force-refresh.ts` utility (Story 2.2 réutilise post-completion).

**Story 1.8** : `useMe()` hook (Story 2.2 extend response DTO + ajoute `useOnboardingChecklist()` derived hook).

**Story 2.1** : Stripe Connect page (Story 2.2 wrap dans wizard layout via folder hierarchy).

**Story 2.5** (à venir) : admin KYC accept/reject → publish event consume Story 2.2 frontend polling.

**Story 3.3 + 3.5** (à venir) : first listing publish → publish `catalog.first-listing.published.v1` event consume Story 2.2 backend (CompleteOnboardingUseCase).

### What this story does NOT do (out of scope)

- ❌ Admin KYC validation flow → Story 2.5
- ❌ First listing creation → Stories 3.3, 3.5
- ❌ V1+ portfolio + équipe + certifs (FR11) → V1
- ❌ V1 in-app notif (replace polling) → Epic 11
- ❌ Stripe Identity KYC complet (FR12) → V1

### Testing Standards

- Coverage ≥ 80 % wizard frontend + 90 % CompleteOnboardingUseCase backend
- Tests E2E Playwright FR/EN axe-core (8 cases AC8)
- Performance NFR48 ≤ 30 min p90 (testcontainer fast-track Admin approve)

### Project Structure Notes

✅ Aligné architecture, PRD §FR3 + NFR48, epics, Stories 1.3/1.6/1.8/2.1, memories.

⚠️ Décision : middleware Edge runtime fetch `/v1/me` à chaque navigation `/seller/` (acceptable latence ~50ms).

⚠️ Décision : polling 5s pour completion detection MVP (V1 WebSocket).

⚠️ Note : Story 2.5 (admin reject reason) doit être implémentée avant que `kyc_status='rejected'` UI Story 2.2 puisse afficher la raison.

### References

- [Source: epics.md#Epic-2-Story-2.2 — Lines 1270-1286]
- [Source: prd.md#FR3, #NFR47, #NFR48, #UX-DR9]
- [Source: Stories 1.3 (ProProfile + KYC docs), 1.4 (middleware seller), 1.6 (force-refresh), 1.8 (useMe), 2.1 (Stripe wrap)]
- [Source: Story 0.5 atomic `<StepIndicator>`]
- [Memory: feedback_clean_architecture_explicit.md, feedback_api_envelope_response.md, feedback_tech_layer_english.md, feedback_i18n_frontend.md]

## Dev Agent Record

(à remplir)

---

## Story Completion Status

- **Story Status** : `ready-for-dev`
- **Created** : 2026-05-09
- **Created by** : `bmad-create-story` workflow
- **Epic** : Epic 2 — Pro Onboarding & Admin Verification (MVP)
- **Sprint cible** : Sprint 3 (2ᵉ story Epic 2)
- **Estimation effort** : 3-5 jours (1 dev fullstack — story orchestration UX, ~40 fichiers)
- **Dépendances upstream** :
  - Story 0.5 atomic `<StepIndicator>`
  - Story 1.3 ProProfile aggregate
  - Story 1.4 middleware seller
  - Story 1.6 force-refresh utility
  - Story 1.8 useMe hook
  - Story 2.1 Stripe page (wrap dans wizard)
- **Dépendances downstream** :
  - Story 2.5 admin accept/reject (Story 2.2 consume event for KYC status change UI)
  - Story 3.3 first listing creation (Story 2.2 redirect step 4)
  - Story 3.5 listing publish event (Story 2.2 backend consume CompleteOnboardingUseCase)
  - Story 5.4 notification-svc consume `pro-onboarded-welcome` template
  - Story 1.10 audit_log consume `identity.pro.onboarded.v1`
- **FRs covered** :
  - **FR3 partial** ✅ KYC validation flow visualization
  - **FR23 partial** ✅ onboarding crée la 1ère fiche (orchestration step 4)
- **NFRs touchés** :
  - **NFR47** ✅ motion prefers-reduced-motion
  - **NFR48** ✅ UX < 30 min cumulatif
  - **NFR71** ✅ coverage thresholds

> **Prochaine story → Story 2.3** (Admin verification queue `GET /v1/admin/verifications`)

---

**Dev agent next steps :**
1. Lire ce file
2. Vérifier upstream Stories 0.5, 1.3, 1.4, 1.6, 1.8, 2.1 implémentées
3. Implémenter Tasks 1-10
4. Lancer `pnpm playwright test --grep "pro onboarding wizard"` après chaque jalon
5. Commit Story 2.2 quand : 8/8 e2e + coverage thresholds + axe-core 0 + perf NFR48 OK
6. Update sprint-status : `2-2-...: review` puis `done`
