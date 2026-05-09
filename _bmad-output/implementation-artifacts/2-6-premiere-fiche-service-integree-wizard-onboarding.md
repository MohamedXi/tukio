# Story 2.6: 1ère fiche service intégrée dans le wizard onboarding (cron rappel J+7/14/21 + welcome modal + banner partagé)

Status: ready-for-dev

## Story

**As a** Pro fraîchement KYC `approved` Story 2.5 (sortant Story 2.2 wizard step 3 → step 4),
**I want** publier ma **1ère fiche service** directement depuis le wizard onboarding via redirect `/seller/listings/new?onboarding=true` avec banner contextuel "Dernière étape ! Publiez votre 1ère fiche pour activer votre compte" + tracking automatique de la complétion (Story 2.2 `CompleteOnboardingUseCase` déjà livré ; Story 2.6 finalise la **boucle complète**) :
- (a) **refinement consumer** identity-svc qui subscribe désormais `catalog.listing.published.v1` (event générique publié par Story 3.5 — vs le `catalog.first-listing.published.v1` initialement sketché Story 2.2) + détecte la 1ʳᵉ fiche via `proProfile.firstListingPublishedAt == null` condition (idempotence stricte — re-publish d'une fiche déjà existante ne re-déclenche pas l'onboarding completion) ;
- (b) **`<OnboardingFirstListingBanner>`** pattern shared dans `packages/ui/src/patterns/` (NEW Story 2.6 — forward-dep Story 3.3 qui l'intégrera dans `apps/seller/src/app/[locale]/seller/listings/new/page.tsx` quand le query param `?onboarding=true` est présent) ;
- (c) **`<OnboardingWelcomeModal>` UI complète** sur `/seller/dashboard` (Story 2.2 a livré le skeleton, Story 2.6 livre l'implémentation complète : detection flag persistant DB `pro_profiles.welcome_modal_seen_at` + endpoint `POST /v1/me/welcome-modal/seen` qui stamp le flag + auto-trigger animation entrée + checklist V1+ "compléter portfolio, équipe, certifications" + 2 CTAs "Commencer à recevoir des résa" `/seller/dashboard` et "Compléter mon profil" `/seller/profile/edit`) ;
- (d) **cron `pro-onboarding-reminder.task.ts`** (NEW Story 2.6 — `@nestjs/schedule` `@Cron('0 9 * * *')` quotidien 9am UTC heure légale Paris — pattern Story 1.9 purge-tokens réutilisé) qui détecte les Pros `kyc_status='approved' AND first_listing_published_at IS NULL AND onboarding_completed_at IS NULL` ET dont `(NOW() - kyc_decision_at) >= INTERVAL` matché aux trois jalons J+7, J+14, J+21 (avec déduplication via `last_onboarding_reminder_sent_at` ≥ 6.5j et `onboarding_reminders_sent_count < 3`) → publie outbox event `identity.pro.onboarding-reminder-sent.v1` (NEW Story 2.6 — payload `{ proProfileId, userProfileId, userEmail, userLocale, reminderSequence: 1|2|3, daysSinceKycApproval, kycDecisionAt }`) consumed par notification-svc Story 5.4 future (template `pro-first-listing-reminder.{fr,en}.tsx`) + audit_log Story 1.10 + métrique Prom `tukio_pro_onboarding_reminders_sent_total{sequence}` ; le cron stamp ensuite `pro_profiles.last_onboarding_reminder_sent_at = NOW()` + `onboarding_reminders_sent_count = onboarding_reminders_sent_count + 1` ; **après le 3ᵉ rappel J+21**, le cron arrête de relancer ce Pro spécifique (Story 2.8 future ajoute auto-rejection 30j inactivity comme dernier filet) ;
- (e) **migration DB** Story 2.6 `1715292000000-AddOnboardingTrackingFieldsToProProfiles.ts` :
```sql
ALTER TABLE pro_profiles ADD COLUMN last_onboarding_reminder_sent_at TIMESTAMPTZ NULL;
ALTER TABLE pro_profiles ADD COLUMN onboarding_reminders_sent_count INT NOT NULL DEFAULT 0 CHECK (onboarding_reminders_sent_count BETWEEN 0 AND 10);
ALTER TABLE pro_profiles ADD COLUMN welcome_modal_seen_at TIMESTAMPTZ NULL;
-- Defensive: ensure first_listing_published_at exists (Story 2.2 should have added it; safe-add via DO block)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pro_profiles' AND column_name='first_listing_published_at') THEN
    ALTER TABLE pro_profiles ADD COLUMN first_listing_published_at TIMESTAMPTZ NULL;
  END IF;
END $$;
-- Index partial pour cron query performance
CREATE INDEX idx_pro_profiles_kyc_approved_pending_first_listing ON pro_profiles (kyc_decision_at)
  WHERE kyc_status = 'approved' AND first_listing_published_at IS NULL AND onboarding_completed_at IS NULL AND deleted_at IS NULL;
```
- (f) **`/v1/me` extension** : Story 1.8 + Story 2.2 retournent déjà `prosFields.onboardingCompletedAt` + `firstListingPublishedAt` ; Story 2.6 ajoute `welcomeModalSeenAt` + `onboardingRemindersSentCount` + `lastOnboardingReminderSentAt` à la shape `me.dto.ts` ;
- (g) **endpoint `POST /v1/me/welcome-modal/seen`** (NEW gateway-api Story 2.6 — RBAC `pro` only — body vide — stamp `welcome_modal_seen_at = NOW()` idempotent — 2nd call retourne 200 idem) ;
- (h) **NFR48 SLA Prometheus alert onboarding** : NEW alert rule `infra/k8s/prometheus-rules/identity-onboarding-sla.yaml` track les Pros KYC approved depuis > 7j sans 1ère fiche (`tukio_pro_kyc_approved_no_listing_age_hours_max > 168` for 1h → warning Slack `#tukio-alerts-ops`, > 504 = J+21 → severity error) — pattern Story 2.5 réutilisé,

**so that** Marc le loueur de tentes (P1 persona Tukio J3 happy path) qui vient d'être validé par Léa Story 2.5 click directement "Créer ma 1ère fiche" depuis le wizard step 4 (Story 2.2) → atterrit `/seller/listings/new?onboarding=true` avec banner brand contextuel "Dernière étape !" qui le motive à publier (UX onboarding < 30 min cumulatif NFR48) ; après publish, voit la modale "Bienvenue chez Tukio !" avec checklist V1+ engageante (vs page froide dashboard vide) ; un Pro qui s'est arrêté après KYC validé sans publier sa 1ère fiche reçoit 3 emails rappels gradués J+7/14/21 (relance progressive non-aggressive) ; les Stories Epic 4 (booking saga) consument un Pro pleinement onboardé (`tukio_status='active'` + 1 listing visible search Story 3.7) ; et le **pattern complet "cron multi-jalons rappel + welcome modal first-time + banner contextuel onboarding"** devient template Stories 8.x V1 (B2B account onboarding wizard 3 steps), Stories 11.x V1 (PWA install prompts gradués), Stories 12.x V1 (review request relance).

> **Outcome attendu** : à la fin de cette story, Marc fraîchement KYC `approved` (Story 2.5 décision Léa) revient sur seller.tukio.one → middleware seller (Story 2.2) calcule currentStep=4 (`first-listing` car `kyc_status='approved' && first_listing_published_at == null`) → redirect `/fr/seller/onboarding/first-listing` → page render `<EmptyState variant="info">` "Publier votre 1ère fiche" + CTA "Créer ma 1ère fiche →" → click → redirect `/fr/seller/listings/new?onboarding=true` → **page Story 3.3 future** render avec `<OnboardingFirstListingBanner variant="info">` (pattern @tukio/ui Story 2.6) "Dernière étape ! Publiez votre 1ère fiche pour activer votre compte" en haut de page → Marc complète le wizard de création listing Story 3.3 (15-20 min) + click "Publier" → catalog-svc Story 3.5 publie `catalog.listing.published.v1` → identity-svc consumer (refined Story 2.6 — subscribe `catalog.listing.published.v1` générique) check `proProfile.firstListingPublishedAt == null` → first listing detected → `CompleteOnboardingUseCase` (Story 2.2) execute en transaction : `proProfile.completeOnboarding({firstListingId, completedAt})` + `userProfile.changeTukioStatus('active')` (Story 2.5 enum confirmed `active`) + Keycloak claim sync `tukio:status='active'` + outbox publish `identity.pro.onboarded.v1` (Story 2.2 event) → frontend force-refresh JWT (Story 1.6 utility) → redirect `/fr/seller/dashboard?welcome=true` → **`<OnboardingWelcomeModal>`** auto-open (detection : `me.prosFields.welcomeModalSeenAt == null && me.prosFields.onboardingCompletedAt != null`) avec modale "Bienvenue chez Tukio, Marc !" + checklist V1+ animée + 2 CTAs → click "Commencer à recevoir des résa" → POST `/v1/me/welcome-modal/seen` (idempotent stamp DB) → modale ferme → user lands sur `/fr/seller/dashboard` ; un Pro test fixture KYC approved 8 jours sans 1ère fiche → cron quotidien 9am UTC tourne → query partiel index match → publie `identity.pro.onboarding-reminder-sent.v1` séquence 1 → notification-svc Story 5.4 future consume → email "Publiez votre 1ère fiche" envoyé en FR/EN selon `userProfile.locale` ; même fixture J+15 → cron tourne → séquence 2 (déduplication via last_onboarding_reminder_sent_at >= 6.5j check) ; J+22 → séquence 3 → puis cron skip ce Pro (count=3 max) ; un Pro qui ferme la welcome modale puis revient le lendemain → modale ne s'ouvre PAS (welcome_modal_seen_at != null) — UX clean ; un test Prometheus alert simulation > 168h KYC approved no listing → fire warning Slack `#tukio-alerts-ops` ; un test `pnpm playwright test --grep "pro onboarding completion + welcome modal"` passe FR/EN axe-core 0 violations 12 scénarios (happy path complete onboarding FR/EN, welcome modal show/dismiss, cron J+7 fire, cron J+14 fire, cron J+21 fire then stop, banner render with `?onboarding=true` query, banner hidden without query, welcome modal already seen does not re-open, Pro with second listing publish does not re-trigger CompleteOnboarding, idempotent welcome modal seen endpoint, NFR48 SLA alert > 168h fired) ; coverage ≥ 90 % cron + 80 % gateway + 80 % frontend.

## Acceptance Criteria

1. **AC1 — DB migration extension `pro_profiles` + index partiel cron-friendly** : Given Stories 1.3/2.2/2.5 baseline, When je consulte `apps/identity-svc/src/infrastructure/persistence/typeorm/migrations/1715292000000-AddOnboardingTrackingFieldsToProProfiles.ts`, Then :
   - **NEW columns** + **partial index** + defensive first_listing_published_at (cf. story body)
   - **`down()` migration** : reverse drops + DROP INDEX
   - Tests integration : INSERT/UPDATE happy + check constraint count=11 → fail + EXPLAIN ANALYZE partial index < 100ms with 100k pro_profiles fixture

2. **AC2 — Refinement consumer `catalog.listing.published.v1` + first-listing detection** : Given Story 2.2 a livré `first-listing-published.consumer.ts` initialement subscribe `catalog.first-listing.published.v1` (event abandonné), Story 3.5 epic ligne 1468 publishes `catalog.listing.published.v1` (générique). When Story 2.6 reconcile, Then :
   - **UPDATE consumer** `apps/identity-svc/src/infrastructure/messaging/nats/listing-published.consumer.ts` (rename — généric vs first-listing-specific) :
     ```ts
     @NatsConsumer({ subject: 'catalog.listing.published.v1', durable: 'identity-svc-listing-published', inboxTable: 'inbox' })
     export class ListingPublishedConsumer {
       @Handler()
       async handle(event: NatsEvent<CatalogListingPublishedV1Payload>): Promise<void> {
         const { proProfileId, listingId, publishedAt } = event.payload;
         const proProfile = await this.proProfileRepo.findById(proProfileId);
         if (!proProfile) { this.logger.warn({ proProfileId }, 'pro_profile not found — skip'); return; }
         // First-listing detection — Story 2.6 invariant
         if (proProfile.firstListingPublishedAt !== null) {
           this.logger.debug({ proProfileId }, 'not first listing — skip CompleteOnboarding');
           return;
         }
         await this.completeOnboarding.getInstance().execute({ proProfileId, firstListingId: listingId, publishedAt });
       }
     }
     ```
   - **DELETE old consumer** `first-listing-published.consumer.ts` Story 2.2 (subscribe abandoned event)
   - **NEW event schema** `@tukio/contracts/events/catalog/listing-published.v1.{schema.json,ts}` (Story 2.6 ajoute le schéma — Story 3.5 future utilisera) avec payload `{ listingId, proProfileId, title: { fr, en? }, categorySlug, subcategorySlug?, city, publishedAt, isAutoPublished }`
   - Tests unit consumer : 4 cases (first listing → CompleteOnboarding called, second listing → skip, ProProfile not found → log warn no throw, idempotency via inbox already-processed → skip)

3. **AC3 — Cron `pro-onboarding-reminder.task.ts` + 3 jalons J+7/14/21** : Given pattern cron Stories 1.9/2.5 réutilisé, When je consulte `apps/identity-svc/src/infrastructure/tasks/pro-onboarding-reminder.task.ts`, Then :
   - **NEW task** `@Cron('0 9 * * *', { timeZone: 'UTC' })` qui :
     1. Query `findOnboardingReminderCandidates({ now })` — partial index AC1
     2. For each candidate : `txnManager.runInTransaction(...)` → `candidate.trackOnboardingReminderSent(now)` (domain method AC4) → `proProfileRepo.save` → outbox publish `identity.pro.onboarding-reminder-sent.v1` (payload sequence + daysSinceKycApproval + kycDecisionAt)
     3. Métriques Prom counter `tukio_pro_onboarding_reminders_sent_total{sequence='1'|'2'|'3'}` + counter failed
   - **NEW repo method** `IProProfileRepository.findOnboardingReminderCandidates({ now })` SQL :
     ```sql
     SELECT * FROM pro_profiles
     WHERE kyc_status = 'approved' AND first_listing_published_at IS NULL AND onboarding_completed_at IS NULL AND deleted_at IS NULL
       AND onboarding_reminders_sent_count < 3
       AND (last_onboarding_reminder_sent_at IS NULL OR last_onboarding_reminder_sent_at < $now - INTERVAL '6.5 days')
       AND (
         ($now - kyc_decision_at) BETWEEN INTERVAL '6 days 12 hours' AND INTERVAL '7 days 12 hours' -- J+7
         OR ($now - kyc_decision_at) BETWEEN INTERVAL '13 days 12 hours' AND INTERVAL '14 days 12 hours' -- J+14
         OR ($now - kyc_decision_at) BETWEEN INTERVAL '20 days 12 hours' AND INTERVAL '21 days 12 hours' -- J+21
       )
     ORDER BY kyc_decision_at ASC LIMIT 500;
     ```
   - Tests integration testcontainer 6 cases : no candidates, J+7 fires, J+14 fires count=1, J+21 fires count=2 then stop, dedupe < 6.5 days skip, count=3 skip not in candidates

4. **AC4 — Domain methods `trackOnboardingReminderSent` + `markWelcomeModalSeen` + invariants** : Given AC3, When je consulte `apps/identity-svc/src/domain/model/pro-profile.aggregate.ts`, Then :
   - **UPDATE aggregate** Story 1.3 baseline :
     ```ts
     trackOnboardingReminderSent(now: Date): void {
       if (this.kycStatus !== 'approved') throw new OnboardingReminderInvariantError({ field: 'kycStatus', expected: 'approved', actual: this.kycStatus });
       if (this.firstListingPublishedAt !== null) throw new OnboardingReminderInvariantError({ field: 'firstListingPublishedAt', expected: 'null', actual: 'set' });
       if (this.onboardingCompletedAt !== null) throw new OnboardingReminderInvariantError({ field: 'onboardingCompletedAt', expected: 'null', actual: 'set' });
       if (this.onboardingRemindersSentCount >= 3) throw new OnboardingReminderInvariantError({ field: 'onboardingRemindersSentCount', expected: '< 3', actual: String(this.onboardingRemindersSentCount) });
       this.lastOnboardingReminderSentAt = now;
       this.onboardingRemindersSentCount += 1;
       this.touch();
     }

     markWelcomeModalSeen(now: Date): void {
       if (this.welcomeModalSeenAt !== null) return; // idempotent — already seen, no-op
       if (this.onboardingCompletedAt === null) throw new WelcomeModalNotAvailableError(this.id);
       this.welcomeModalSeenAt = now;
       this.touch();
     }
     ```
   - **NEW exceptions** `onboarding-reminder-invariant.error.ts` + `welcome-modal-not-available.error.ts`
   - Tests aggregate ≥ 95 % : 4 invariants + idempotent + edge cases

5. **AC5 — `MarkWelcomeModalSeenUseCase` + endpoint `POST /v1/me/welcome-modal/seen`** : Given AC4, When :
   - **NEW use case** `mark-welcome-modal-seen.usecase.ts` : fetch ProProfile via `findByUserProfileId(userId)` → call `markWelcomeModalSeen(now)` → save → return `{ welcomeModalSeenAt: ISO }`
   - **NEW gateway endpoint** `POST /v1/me/welcome-modal/seen` :
     ```ts
     @Post('/v1/me/welcome-modal/seen')
     @UseGuards(KeycloakJwtGuard, RolesGuard)
     @Roles('pro')
     @HttpCode(200)
     async markWelcomeModalSeen(@CurrentActor() actor: Actor): Promise<{ welcomeModalSeenAt: string }> {
       return this.welcomeModalSeenForwarder.getInstance().mark({ userProfileId: actor.userId });
     }
     ```
   - **Forwarder** appelle identity-svc internal `POST /internal/pros/by-user-id/:userId/welcome-modal/seen` (NEW)
   - **Idempotent** : 2nd call → 200 unchanged
   - **Throttle** : 10/min/user
   - **Errors** : 409 `IDENTITY-CONFLICT-006` si onboarding pas terminé
   - Tests E2E : happy + idempotent + onboarding not complete error

6. **AC6 — `<OnboardingFirstListingBanner>` pattern @tukio/ui (forward-dep Story 3.3)** : Given Story 3.3 future intégrera, When je consulte `packages/ui/src/patterns/`, Then :
   - **NEW pattern** `OnboardingFirstListingBanner.tsx` :
     ```tsx
     export interface OnboardingFirstListingBannerProps {
       title: string; description: string; ctaLabel?: string; onCtaClick?: () => void; variant?: 'info' | 'success';
     }
     export const OnboardingFirstListingBanner: FC<OnboardingFirstListingBannerProps> = ({ title, description, ctaLabel, onCtaClick, variant = 'info' }) => (
       <Alert variant={variant} role="status" aria-live="polite">
         <Alert.Title>{title}</Alert.Title>
         <Alert.Description>{description}</Alert.Description>
         {ctaLabel && onCtaClick && <Button variant="primary" size="sm" onClick={onCtaClick}>{ctaLabel}</Button>}
       </Alert>
     );
     ```
   - Wraps `<Alert>` Story 0.4 atomic + `<Button>` Story 0.4 — pas de logique business (présentation pure — i18n résolu par parent app)
   - **Storybook** : 3 stories (info default, with CTA, success variant) + axe-core
   - Tests `@testing-library/react` : render OK + button click handler
   - **Forward-dep documentation** : Story 3.3 doit importer ce pattern + render conditional sur `useSearchParams().get('onboarding') === 'true'` + i18n keys depuis namespace `seller.listings.new.onboardingBanner.{title,description,ctaLabel}`
   - **i18n keys MVP** définis Story 2.6 dans `apps/seller/src/messages/{fr,en}.json` (placés dès maintenant) :
     - `seller.listings.new.onboardingBanner.title` : "Dernière étape !" / "Last step!"
     - `seller.listings.new.onboardingBanner.description` : "Publiez votre 1ère fiche pour activer votre compte" / "Publish your first listing to activate your account"
     - `seller.listings.new.onboardingBanner.ctaLabel` : "Continuer" / "Continue"

7. **AC7 — `<OnboardingWelcomeModal>` UI complète + integration `/seller/dashboard`** : Given Story 2.2 sketched skeleton, When Story 2.6 finalise, Then :
   - **UPDATE component** `apps/seller/src/features/seller/onboarding/components/OnboardingWelcomeModal.tsx` :
     ```tsx
     'use client';
     export const OnboardingWelcomeModal: FC = () => {
       const { data: me } = useMe();
       const markSeen = useMarkWelcomeModalSeen();
       const t = useTranslations('seller.onboarding.welcome');
       const shouldOpen = me?.prosFields?.onboardingCompletedAt != null && me?.prosFields?.welcomeModalSeenAt == null;
       if (!shouldOpen) return null;

       const handleClose = (cta: 'dashboard' | 'profile' | 'dismiss') => {
         markSeen.mutate(undefined, {
           onSuccess: () => { if (cta === 'profile') router.push('/seller/profile/edit'); }
         });
       };

       return (
         <Modal open onClose={() => handleClose('dismiss')} aria-labelledby="welcome-modal-title">
           <ConfettiAnimation duration={3000} reducedMotion />
           <h2 id="welcome-modal-title">{t('title', { firstName: me.firstName })}</h2>
           <p>{t('subtitle', { companyName: me.prosFields.companyName })}</p>
           <ul>
             <li>{t('checklist.portfolio')}</li>
             <li>{t('checklist.team')}</li>
             <li>{t('checklist.security2fa')}</li>
           </ul>
           <Modal.Footer>
             <Button variant="ghost" onClick={() => handleClose('profile')}>{t('cta.editProfile')}</Button>
             <Button variant="primary" onClick={() => handleClose('dashboard')}>{t('cta.startReceivingBookings')}</Button>
           </Modal.Footer>
         </Modal>
       );
     };
     ```
   - **NEW hook** `packages/api-client/src/hooks/seller/use-mark-welcome-modal-seen.ts` : `useMutation` POST + invalidate `/v1/me`
   - **NEW atomic** `<ConfettiAnimation>` `packages/ui/src/components/ConfettiAnimation/` (CSS-only ~2KB lightweight + `prefers-reduced-motion` respect NFR47)
   - **i18n** namespace `seller.onboarding.welcome.*` (~10 keys × 2 locales) — title, subtitle, checklist.{portfolio,team,security2fa}, cta.{startReceivingBookings, editProfile}
   - **Integration** : `apps/seller/src/app/[locale]/seller/dashboard/page.tsx` Server Component render `<OnboardingWelcomeModal />` (client component)
   - **Accessibility RGAA AA** : focus trap (Story 2.4 `focus-trap-react`) + Esc to close (= dismiss = mark seen) + `aria-labelledby` + `aria-modal="true"` + `prefers-reduced-motion`
   - Tests E2E : (cf. AC10)

8. **AC8 — NATS event schemas + DTOs `@tukio/contracts`** : Given AC2-3-5, When je consulte `packages/contracts/src/`, Then :
   - **NEW event schemas** :
     - `events/identity/pro-onboarding-reminder-sent.v1.{schema.json,ts}` — payload `{ proProfileId, userProfileId, userEmail, userLocale, companyName, reminderSequence: 1|2|3, daysSinceKycApproval, kycDecisionAt }`
     - `events/catalog/listing-published.v1.{schema.json,ts}` (forward Story 3.5 — Story 2.6 publie le contrat)
   - **NEW DTO** `dtos/seller/welcome-modal.dto.ts` — `MarkWelcomeModalSeenResponse` Zod schema
   - **UPDATE DTO** Story 1.8/2.2 `me.dto.ts` `prosFields` extend : `welcomeModalSeenAt: string | null`, `onboardingRemindersSentCount: number`, `lastOnboardingReminderSentAt: string | null`
   - Tests ajv + Zod

9. **AC9 — Prometheus alert NFR48 SLA + métriques + dashboard** :
   - **Prometheus rule NEW** `infra/k8s/prometheus-rules/identity-onboarding-sla.yaml` :
     ```yaml
     groups:
     - name: identity-onboarding-sla
       rules:
       - alert: ProOnboardingStuckWarning
         expr: tukio_pro_kyc_approved_no_listing_age_hours_max > 168 # 7 days
         for: 1h
         labels: { severity: warning, team: ops }
       - alert: ProOnboardingStuckCritical
         expr: tukio_pro_kyc_approved_no_listing_age_hours_max > 504 # 21 days = 3rd reminder threshold
         for: 1h
         labels: { severity: error, team: ops }
     ```
   - **Cron métric scraper** `apps/identity-svc/src/infrastructure/tasks/scrape-onboarding-stuck.task.ts` `@Cron('*/10 * * * *')` — query `maxAgeHoursOfKycApprovedWithoutListing()` → set gauge `tukio_pro_kyc_approved_no_listing_age_hours_max` + count gauge
   - **Métriques additionnelles** : `tukio_pro_onboarding_completions_total{outcome=completed|abandoned}`, `tukio_pro_onboarding_duration_hours_bucket` (histogram), `tukio_pro_onboarding_reminder_candidates_count`, `tukio_pro_onboarding_reminders_sent_total{sequence}`, `tukio_pro_onboarding_reminders_failed_total`, `tukio_welcome_modal_seen_total`
   - **Dashboard Grafana** `infra/k8s/grafana-dashboards/pro-onboarding.json` (~6 panels) : completion funnel KYC→listing, reminders sent rate, average onboarding duration histogram, stuck count gauge, welcome modal CTA distribution V1+
   - **Slack routing** : `SLACK_ALERTS_OPS_WEBHOOK` Doppler

10. **AC10 — Tests Playwright e2e + perf + axe-core** : 12 tests dans 2 files :
    - **`apps/seller/e2e/onboarding/completion.spec.ts`** (8 tests) :
      - T1 happy path complete onboarding FR → simulate listing publish event NATS → consumer triggers CompleteOnboarding → Pro refresh JWT → naviguer `/fr/seller/dashboard` → welcome modal auto-opens → click "Commencer" → POST seen → modale ferme → reload → modale ne re-open pas
      - T2 idem `/en/`
      - T3 welcome modal Esc dismiss → mark seen + close
      - T4 welcome modal CTA "Compléter profil" → mark seen + redirect `/seller/profile/edit`
      - T5 welcome modal already seen (welcomeModalSeenAt set) → modale ne s'ouvre pas
      - T6 banner pattern render via storybook + integration mock Story 3.3 page render `<OnboardingFirstListingBanner>` avec `?onboarding=true`
      - T7 banner hidden without query param
      - T8 second listing publish event → consumer skip (firstListingPublishedAt != null) → no re-trigger CompleteOnboarding (verified 0 new `identity.pro.onboarded.v1` event)
    - **`apps/identity-svc/test/cron/onboarding-reminder.spec.ts`** (4 integration testcontainer) :
      - T9 cron J+7 fires → event seq=1 + DB count=1
      - T10 cron J+14 fires + count=1 + last_sent=7d ago → event seq=2 + count=2
      - T11 cron J+21 fires + count=2 → seq=3 + count=3. Run cron next day → no event (count >= 3)
      - T12 dedupe < 6.5j since last → no event
    - **Test Prometheus alert** : fixture > 168h KYC approved no listing → wait 11 min (cron tick) → Slack webhook called
    - **Test axe-core** : 0 violations sur welcome modal + banner storybook
    - **Test perf** : welcome modal first paint < 300ms p90, cron query < 100ms p90 with 10k pro_profiles fixture
    - Coverage ≥ 90 % cron + 95 % aggregate + 80 % gateway/frontend

## Tasks / Subtasks

- [ ] **Task 1 — `@tukio/contracts` event schemas + DTOs** (AC: #8)
  - [ ] 1.1 — Event schema `identity/pro-onboarding-reminder-sent.v1.{schema.json,ts}`
  - [ ] 1.2 — Event schema `catalog/listing-published.v1.{schema.json,ts}` (forward Story 3.5)
  - [ ] 1.3 — DTO `seller/welcome-modal.dto.ts`
  - [ ] 1.4 — UPDATE `me.dto.ts` extend prosFields
  - [ ] 1.5 — Tests ajv + Zod
- [ ] **Task 2 — DB migration + entity + repository** (AC: #1)
  - [ ] 2.1 — Migration `1715292000000-AddOnboardingTrackingFieldsToProProfiles.ts`
  - [ ] 2.2 — `ProProfileEntity` UPDATE 3 nouveaux fields
  - [ ] 2.3 — Repository methods `findOnboardingReminderCandidates`, `maxAgeHoursOfKycApprovedWithoutListing`, `findByUserProfileId` extends
  - [ ] 2.4 — Tests integration repo + EXPLAIN ANALYZE partial index
- [ ] **Task 3 — Domain methods + exceptions** (AC: #4) — coverage ≥ 95 %
  - [ ] 3.1 — `ProProfile.trackOnboardingReminderSent` + 4 invariants
  - [ ] 3.2 — `ProProfile.markWelcomeModalSeen` (idempotent + invariant)
  - [ ] 3.3 — Exceptions
  - [ ] 3.4 — Tests aggregate exhaustifs
- [ ] **Task 4 — Refinement consumer `catalog.listing.published.v1`** (AC: #2) — coverage ≥ 90 %
  - [ ] 4.1 — UPDATE consumer rename `listing-published.consumer.ts`
  - [ ] 4.2 — DELETE old consumer Story 2.2
  - [ ] 4.3 — Add first-listing detection guard
  - [ ] 4.4 — Tests unit consumer 4 cases
- [ ] **Task 5 — Cron `pro-onboarding-reminder.task.ts` + métric scraper** (AC: #3, #9) — coverage ≥ 90 %
  - [ ] 5.1 — Task `pro-onboarding-reminder.task.ts` (`@Cron 0 9 * * *`)
  - [ ] 5.2 — Task `scrape-onboarding-stuck.task.ts` (every 10 min)
  - [ ] 5.3 — 6 nouvelles métriques Prom
  - [ ] 5.4 — Tests integration testcontainer 4 cron scenarios
- [ ] **Task 6 — `MarkWelcomeModalSeenUseCase` + endpoints** (AC: #5)
  - [ ] 6.1 — Use case
  - [ ] 6.2 — internal controller
  - [ ] 6.3 — gateway controller `POST /v1/me/welcome-modal/seen` + forwarder + RBAC pro
  - [ ] 6.4 — Tests E2E
- [ ] **Task 7 — `<OnboardingFirstListingBanner>` pattern @tukio/ui** (AC: #6)
  - [ ] 7.1 — Pattern + spec + stories
  - [ ] 7.2 — i18n keys
  - [ ] 7.3 — Storybook + axe-core
  - [ ] 7.4 — README forward-dep doc
- [ ] **Task 8 — `<OnboardingWelcomeModal>` UI complète + `<ConfettiAnimation>` atomic** (AC: #7)
  - [ ] 8.1 — UPDATE component
  - [ ] 8.2 — `useMarkWelcomeModalSeen` hook
  - [ ] 8.3 — i18n namespace
  - [ ] 8.4 — `<ConfettiAnimation>` atomic CSS-only + prefers-reduced-motion
  - [ ] 8.5 — Integration dashboard page
  - [ ] 8.6 — A11y RGAA AA tests
- [ ] **Task 9 — Tests Playwright e2e + perf** (AC: #10) — 12 tests
- [ ] **Task 10 — Observability + dashboard + runbook + commit** (AC: #9)
  - [ ] 10.1 — Prometheus rule + Slack webhook
  - [ ] 10.2 — Dashboard Grafana 6 panels
  - [ ] 10.3 — Runbook `pro-onboarding-stuck-debug.md` (~40 lignes)
  - [ ] 10.4 — Commit `feat(identity,seller): Story 2.6 first listing onboarding integration + cron rappel J+7/14/21 + welcome modal complete + banner pattern + onboarding SLA Prometheus alert`

## Dev Notes

### Pourquoi Story 2.6 ferme l'onboarding loop Epic 2

Story 2.2 a livré le **squelette** (CompleteOnboardingUseCase + consumer + welcome modal stub). Story 2.5 a livré la **décision admin** (validate/reject KYC). Story 2.6 livre la **boucle complète** : 1ère fiche → completion auto-detected → welcome modal première fois → cron rappel si Pro inactif. Pattern **state-driven onboarding completion + multi-stage reminder cron + first-time welcome flow** réutilisé Stories 8.x V1, 11.x V1 PWA prompts, 12.x V1 review request relance.

### Décisions techniques majeures actées

1. **Subscribe `catalog.listing.published.v1` générique + first-listing detection in consumer** (vs `catalog.first-listing.published.v1` spécifique abandonné Story 2.2) — DRY : Story 3.5 publie un seul event, identity-svc filtre. Idempotence via `firstListingPublishedAt == null`.
2. **Cron 9am UTC quotidien** (vs hourly) — emails heures ouvrées Paris. Volume daily acceptable.
3. **Dédup `last_sent >= 6.5j` + `count < 3`** — protège contre cron crash + retry.
4. **3 jalons fixed J+7/14/21** (vs config) — MVP simple. V1+ paramétrer per-tier.
5. **`welcome_modal_seen_at` persistent backend** (vs localStorage) — multi-device + RGPD clean.
6. **`<OnboardingFirstListingBanner>` shared @tukio/ui** — forward-dep Story 3.3.
7. **Confetti CSS-only respect prefers-reduced-motion** (NFR47).
8. **Welcome modal idempotent SHOW + SEEN** — robustness refresh / multi-tab.
9. **Métrique scraper séparée du cron rappel** (10 min vs daily) — separation concerns.
10. **Story 2.6 ne livre PAS auto-rejection 30j** → Story 2.8.
11. **EN strict + i18n strict + RGAA AA** memories.

### Versions à utiliser

(Pas de nouvelle dépendance — réutilise Stories 1.x/2.x : `@nestjs/schedule`, TypeORM, focus-trap-react Story 2.4, Sonner Story 0.4 + lightweight CSS confetti pas de lib externe.)

### Project Structure cible

```
packages/contracts/src/events/
├─ identity/pro-onboarding-reminder-sent.v1.{schema.json,ts}     # NEW Story 2.6
└─ catalog/listing-published.v1.{schema.json,ts}                 # NEW Story 2.6 (forward Story 3.5)

packages/contracts/src/dtos/
├─ seller/welcome-modal.dto.ts                                   # NEW
└─ user/me.dto.ts                                                # UPDATE (extends prosFields)

packages/api-client/src/hooks/seller/
└─ use-mark-welcome-modal-seen.ts                                # NEW

packages/ui/src/patterns/
└─ OnboardingFirstListingBanner/                                 # NEW Story 2.6 (forward Story 3.3)
   ├─ OnboardingFirstListingBanner.tsx + spec + stories + index

packages/ui/src/components/
└─ ConfettiAnimation/                                            # NEW Story 2.6 (lightweight CSS-only)
   └─ ConfettiAnimation.tsx + spec + stories + index

apps/identity-svc/src/
├─ domain/
│  ├─ model/pro-profile.aggregate.ts                             # UPDATE — trackOnboardingReminderSent + markWelcomeModalSeen
│  └─ exception/
│     ├─ onboarding-reminder-invariant.error.ts                  # NEW
│     └─ welcome-modal-not-available.error.ts                    # NEW
├─ usecases/
│  └─ mark-welcome-modal-seen.usecase.ts + spec                  # NEW
├─ usecases-proxy/usecases-proxy.module.ts                       # UPDATE — wire new use case
├─ infrastructure/
│  ├─ http/controllers/seller-me.controller.ts                   # UPDATE Story 1.8 — add welcome-modal/seen endpoint
│  ├─ persistence/typeorm/
│  │  ├─ entities/pro-profile.entity.ts                          # UPDATE — 3 new fields
│  │  ├─ repositories/pro-profile.typeorm.repository.ts          # UPDATE — findOnboardingReminderCandidates + maxAgeHours + findByUserProfileId
│  │  └─ migrations/1715292000000-AddOnboardingTrackingFieldsToProProfiles.ts  # NEW
│  ├─ messaging/nats/
│  │  └─ listing-published.consumer.ts                           # UPDATE Story 2.2 (rename + refine)
│  └─ tasks/
│     ├─ pro-onboarding-reminder.task.ts                         # NEW
│     └─ scrape-onboarding-stuck.task.ts                         # NEW

apps/gateway-api/src/
├─ usecases/seller/welcome-modal-seen.forwarder.ts               # NEW
├─ infrastructure/http/controllers/seller-me.controller.ts       # UPDATE Story 1.8
└─ infrastructure/external/identity-svc/identity-svc.client.ts   # UPDATE — markWelcomeModalSeen

apps/seller/src/
├─ app/[locale]/seller/dashboard/page.tsx                        # UPDATE — render <OnboardingWelcomeModal>
├─ features/seller/onboarding/components/OnboardingWelcomeModal.tsx  # UPDATE Story 2.2 stub → complete
└─ messages/{fr,en}.json                                         # UPDATE — seller.onboarding.welcome.* + seller.listings.new.onboardingBanner.*

apps/seller/e2e/onboarding/completion.spec.ts                    # NEW Story 2.6
apps/identity-svc/test/cron/onboarding-reminder.spec.ts          # NEW Story 2.6 testcontainer

infra/k8s/prometheus-rules/identity-onboarding-sla.yaml          # NEW
infra/k8s/grafana-dashboards/pro-onboarding.json                 # NEW
docs/runbook/pro-onboarding-stuck-debug.md                       # NEW

# Estimation : ~30 nouveaux + ~10 updates = ~40 fichiers
```

### Critical Architecture Constraints

> Cf. Stories 0.5/0.7 (atomics, outbox), 0.6 (Pretre), 1.2 (gateway-api), 1.3 (ProProfile + kyc_status), 1.7 (admin layout), 1.8 (`/v1/me`), 1.9 (cron `@nestjs/schedule`), 1.10 (audit_log + AuditLogConsumer), 2.1 (outbox patterns), 2.2 (CompleteOnboardingUseCase + welcome modal stub + first-listing-published consumer to refine + onboarding_completed_at + first_listing_published_at fields), 2.5 (kyc_decision_at field + tukio_status='active' enum confirmed) + memories.

1. **Pretre architecture stricte** — domain methods invariants in aggregate, use cases orchestrate ports, infra dans `infrastructure/`. Eslint-plugin-boundaries.
2. **Transactional outbox ADR-007** — cron task + outbox event publish dans single transaction TypeORM.
3. **API responses envelope ADR-014** — `POST /v1/me/welcome-modal/seen` returns `{ method, code, data, meta }`.
4. **EN strict couche tech + i18n FR/EN + RGAA AA** memories.
5. **NFR48 SLA onboarding** : Prometheus alert > 7d KYC approved no listing → Slack `#tukio-alerts-ops`.
6. **NFR82 audit immutable** — events `identity.pro.onboarding-reminder-sent.v1` consumed AuditLogConsumer Story 1.10.
7. **NFR47 motion** — confetti animation respects `prefers-reduced-motion`.
8. **Idempotence via inbox table** Story 0.7 — listing-published.consumer.ts + cron task.
9. **Latest stable versions** memory.

### Previous Story Intelligence

**Story 1.3 (Pro registration)** : ProProfile aggregate baseline + kyc_status. Story 2.6 ajoute 3 fields tracking onboarding (reminders + welcome modal).

**Story 1.8 (profile management)** : `/v1/me` endpoint expose `prosFields`. Story 2.6 étend avec `welcomeModalSeenAt`, `onboardingRemindersSentCount`, `lastOnboardingReminderSentAt`.

**Story 1.9 (account deletion)** : pattern `@nestjs/schedule` cron + `purge-tokens.task.ts`. Story 2.6 réutilise pattern.

**Story 1.10 (Pretre consolidation)** : audit_log + AuditLogConsumer subscribe `identity.*` events. Story 2.6 publie event consumed automatiquement → audit trail.

**Story 2.2 (wizard onboarding frontend)** : a livré (a) `CompleteOnboardingUseCase` + `ProProfile.completeOnboarding` + `pro_profiles.onboarding_completed_at` + `first_listing_published_at` fields, (b) consumer initialement subscribe `catalog.first-listing.published.v1` (event abandonné — Story 2.6 refine), (c) `OnboardingWelcomeModal.tsx` stub. Story 2.6 **REFINE** Story 2.2 (rename consumer + complete welcome modal) sans casser le contrat — `CompleteOnboardingUseCase` reste signature stable.

**Story 2.5 (admin accept/reject)** : a livré state machine `kyc_status` + transition `tukio_status='active'` (vs 'verified' typo Story 2.2 — Story 2.5 confirme enum). Story 2.6 utilise `kyc_decision_at` (Story 2.5 field) pour cron query.

### What this story does NOT do

- ❌ **Story 3.3 wire `<OnboardingFirstListingBanner>` dans page listings/new** — forward-dep, Story 3.3 future intégrera.
- ❌ **Story 3.5 publish `catalog.listing.published.v1` event** — Story 2.6 publie le **schema** dans @tukio/contracts (forward Story 3.5 utilisera). La logique de publication est Story 3.5.
- ❌ **Story 5.4 notification-svc consume `identity.pro.onboarding-reminder-sent.v1`** + email template `pro-first-listing-reminder.{fr,en}.tsx` → Story 5.4 future.
- ❌ **Story 2.8 auto-rejection 30j** — Story 2.6 envoie 3 rappels gradués + stop. Story 2.8 picks up.
- ❌ **Welcome modal personnalisée per Pro tier** — V1+.
- ❌ **Animation confetti complexe (lottie/lib)** — MVP CSS-only lightweight (~2KB). V1+ peut upgrade.
- ❌ **Cron paramétrable per Pro** → V1+ admin tools.
- ❌ **In-app notification feed** Story 11.1 V1.

### Files to UPDATE vs CREATE

(Cf. Project Structure cible — annoté UPDATE/NEW)

### Testing Standards

- Coverage ≥ 95 % aggregate methods (state machine critical) — NFR71 strict
- Coverage ≥ 90 % cron tasks + use cases + consumer
- Coverage ≥ 80 % gateway endpoints + frontend
- E2E Playwright FR/EN axe-core 0 violations 12 tests AC10
- Tests integration testcontainer cron : 4 scenarios stamps DB + outbox event published
- Perf : welcome modal first paint < 300ms p90, cron query < 100ms p90 with 10k pro_profiles fixture (partial index validation EXPLAIN ANALYZE)
- Tests Prometheus alert simulation > 168h KYC approved no listing → Slack webhook called

### Project Structure Notes

✅ **Aligné architecture, PRD §FR3 (KYC validation flow), §FR23 partiel (1ère fiche dans onboarding), §NFR48 (UX < 30 min onboarding hors attente Admin), §NFR82 (audit immutable), §NFR47 (motion + RGAA AA), Stories 1.3/1.8/1.9/1.10/2.1/2.2/2.5, memories.**

⚠️ **Décision** : Refinement consumer Story 2.2 — subscribe `catalog.listing.published.v1` générique. DRY + idempotent via firstListingPublishedAt == null check.

⚠️ **Décision** : `welcome_modal_seen_at` persistent DB (vs localStorage) — multi-device support + RGPD clean.

⚠️ **Décision** : Cron 9am UTC daily (vs hourly) — emails heures ouvrées + volume acceptable.

⚠️ **Décision** : 3 jalons fixed J+7/14/21 (vs config) — MVP simple. V1+ paramétrer per-tier.

⚠️ **Décision** : Forward-dep `<OnboardingFirstListingBanner>` pattern @tukio/ui — Story 3.3 intégrera plus tard sans doublon UX.

⚠️ **Décision** : Confetti CSS-only (vs lottie lib) — MVP lightweight + prefers-reduced-motion respect.

⚠️ **Décision** : Story 2.2 stub `OnboardingWelcomeModal.tsx` UPDATE par Story 2.6 (vs duplicate component) — éviter dette tech.

### References

- [Source: epics.md#Epic-2-Story-2.6 — Lines 1336-1349]
- [Source: prd.md#FR3, #FR23 (1ère fiche dans onboarding), #NFR48 (SLA UX < 30 min onboarding), #NFR82 (audit immutable), #NFR47 (motion)]
- [Source: ux-design-specification.md — UX-DR9 admin verification queue context, banner Alert pattern UX]
- [Source: architecture.md — ADR-007 transactional outbox, ADR-014 envelope, Pretre boundaries lines 2120-2164]
- [Source: Stories 1.3 (ProProfile), 1.8 (`/v1/me`), 1.9 (cron pattern), 1.10 (audit_log), 2.1 (outbox), 2.2 (CompleteOnboardingUseCase + welcome modal stub + first-listing-published consumer to refine), 2.5 (kyc_decision_at + tukio_status='active' confirmed)]
- [Memory: feedback_clean_architecture_explicit.md, feedback_api_envelope_response.md, feedback_tech_layer_english.md, feedback_i18n_frontend.md, feedback_latest_versions.md]

## Dev Agent Record

### Agent Model Used

(à remplir par dev agent : modèle + version)

### Debug Log References

### Completion Notes List

(à remplir à la fin — résumé décisions, déviations vs Dev Notes avec justification, points d'attention pour Story 2.7 (audit trail UI — consume `audit_log` qui contient désormais events Story 2.5/2.6), Story 2.8 (auto-rejection 30j — pattern cron Story 2.6 réutilisé), Story 3.3 (Pro create listing wizard — wire `<OnboardingFirstListingBanner>` Story 2.6 quand `?onboarding=true`), Story 3.5 (Listing publish workflow — publish `catalog.listing.published.v1` event consumed Story 2.6 refined consumer), Story 5.4 (notification-svc — consume `identity.pro.onboarding-reminder-sent.v1` Story 2.6 + Stories 2.5 events))

### File List

(à remplir au fil de l'implémentation par le dev agent)

---

## Story Completion Status

- **Story Status** : `ready-for-dev`
- **Created** : 2026-05-09
- **Created by** : `bmad-create-story` workflow
- **Epic** : Epic 2 — Pro Onboarding & Admin Verification (MVP)
- **Sprint cible** : Sprint 3 (6ᵉ story Epic 2 après 2.1, 2.2, 2.3, 2.4, 2.5)
- **Estimation effort** : 3-4 jours (1 dev fullstack — story complexité moyenne : 1 cron + refinement consumer + welcome modal complete + banner pattern + métriques + DB extension, ~40 fichiers)
- **Dépendances upstream** : Stories 0.5 (atomics), 0.6 (Pretre), 0.7 (outbox), 1.2 (gateway-api), 1.3 (ProProfile baseline), 1.8 (`/v1/me`), 1.9 (cron `@nestjs/schedule` pattern), 1.10 (audit_log + AuditLogConsumer), 2.1 (outbox patterns), 2.2 (CompleteOnboardingUseCase + welcome modal stub + first-listing-published consumer to refine + onboarding_completed_at + first_listing_published_at fields), 2.5 (kyc_decision_at field + tukio_status='active' confirmed)
- **Dépendances downstream** :
  - Story 2.7 (audit trail UI) — consulte `audit_log` contenant désormais events Story 2.5/2.6
  - Story 2.8 (auto-rejection 30j inactivity) — pattern cron Story 2.6 réutilisé + reasonCode='other' message inactivity (réutilise `RejectVerificationUseCase` Story 2.5)
  - Story 3.3 (Pro create listing wizard) — wire `<OnboardingFirstListingBanner>` quand `?onboarding=true` query param
  - Story 3.5 (Listing publish) — publish `catalog.listing.published.v1` event consumed par consumer refined Story 2.6
  - Story 5.4 (notification-svc) — consume `identity.pro.onboarding-reminder-sent.v1` Story 2.6 + email template `pro-first-listing-reminder.{fr,en}.tsx`
  - Stories Epic 8 V1 (B2B onboarding) — réutilisent pattern multi-stage reminder cron + welcome modal
- **FRs covered** :
  - **FR23 partial** ✅ 1ère fiche service dans onboarding wizard (Story 2.6 livre cron + completion detection refinement)
- **NFRs touchés** :
  - **NFR48** ✅ SLA onboarding < 30 min (Prometheus alert > 7d KYC approved no listing)
  - **NFR71** ✅ coverage ≥ 90 % cron + 95 % aggregate methods
  - **NFR82** ✅ audit immutable via events Story 2.6
  - **NFR47** ✅ motion + RGAA AA (welcome modal focus trap + confetti prefers-reduced-motion)

> **Prochaine story → Story 2.7** (Audit trail toutes actions admin — UI consultation `audit_log` table contenant désormais Stories 2.4 viewed + 2.5 accept/reject + 2.6 reminders events)

---

**Dev agent next steps :**
1. Lire ce file complètement
2. Vérifier upstream Stories 0.5, 0.6, 0.7, 1.2, 1.3, 1.8, 1.9, 1.10, 2.1, 2.2, 2.5 implémentées
3. Implémenter Tasks 1-10 dans l'ordre (DTOs/events Task 1 → DB Task 2 → domain Task 3 → consumer refinement Task 4 → cron Task 5 → endpoint Task 6 → patterns @tukio/ui Task 7-8 → tests Task 9 → observability Task 10)
4. Lancer `pnpm playwright test --grep "pro onboarding completion"` + `pnpm vitest --filter=identity-svc cron/onboarding` après chaque jalon
5. Commit Story 2.6 quand : 12/12 e2e + coverage thresholds NFR71 + axe-core 0 + perf cibles + Prometheus alert testé + cron 4 scenarios testés + welcome modal idempotent vérifié + partial index EXPLAIN ANALYZE validé + i18n FR/EN namespaces complets
6. Update sprint-status : `2-6-...: review` puis `done`
