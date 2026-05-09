# Story 2.8: Pro verification reminder + auto-rejection après 30 jours d'inactivité (clôture Epic 2)

Status: ready-for-dev

## Story

**As a** product owner Tukio (gardien de la qualité de la file admin + de la conversion onboarding),
**I want** **clore le wizard onboarding** : (a) **cron `pro-stuck-onboarding.task.ts`** quotidien 9am UTC (combiné Story 2.6 — même horaire daily reminder slot pour cohérence ops + amorti single cron run admin queue lookup) qui détecte les Pros **bloqués sur Stripe** (`tukio_status = 'pending_admin_review' AND stripe_status IN ('not_started', 'pending', 'requires_action') AND deleted_at IS NULL`) et applique 2 actions selon `daysSinceRegistration` (`= NOW() - user_profiles.created_at`) :
- **J+7 reminder** : `daysSinceRegistration BETWEEN 6.5 AND 7.5` AND `stuck_reminders_sent_count = 0` → publie outbox event `identity.pro.stripe-reminder-sent.v1` (NEW Story 2.8 — payload `{ proProfileId, userProfileId, userEmail, userLocale, companyName, currentStripeStatus, daysSinceRegistration, daysUntilAutoRejection: 23 }`) consumed Story 5.4 future notification-svc → email `pro-stripe-stuck-reminder.{fr,en}.tsx` "Complétez votre dossier sous 23 jours ou il sera fermé" + lien `/seller/onboarding/stripe` + DB stamp `last_stuck_reminder_sent_at = NOW()` + `stuck_reminders_sent_count = 1` ;
- **J+30 auto-rejection** : `daysSinceRegistration >= 30 AND stripe_status IN ('not_started', 'pending', 'requires_action')` → exécute `AutoRejectVerificationUseCase` (NEW Story 2.8 — pattern Story 2.5 `RejectVerificationUseCase` réutilisé mais avec actor=system) qui :
  - (1) `proProfile.autoRejectKyc()` (NEW domain method Story 2.8 — invariants : `kyc_status ∈ {pending_review, under_review}` + `tukio_status === 'pending_admin_review'` SINON `KycStatusInvalidTransitionError` 409 ; sets `kyc_status = 'rejected'`, `kyc_decision_at = NOW()`, `kyc_decision_by = NULL` (system marker — no admin), `kyc_decision_reason_code = 'inactivity'` (NEW reasonCode Story 2.8 — extension enum Story 2.5), `kyc_decision_message = 'Votre dossier a été automatiquement fermé après 30 jours sans complétion de la configuration Stripe Connect.'` (template hardcoded — i18n côté frontend pour user-display, DB stocke FR par défaut) ;
  - (2) `userProfile.changeTukioStatus('rejected')` (Story 2.5 méthode réutilisée — transition allowed `pending_admin_review → rejected`) ;
  - (3) `IKeycloakClient.updateUserAttribute(userProfile.keycloakUserId, 'tukio_status', 'rejected')` best-effort + drift event si fail (Story 2.5 pattern réutilisé) ;
  - (4) outbox publish `identity.pro.auto-rejected.v1` (NEW Story 2.8 — payload `{ proProfileId, userProfileId, userEmail, userLocale, companyName, kycDecisionAt, reasonCode: 'inactivity', message, daysSinceRegistration, lastStripeStatus }`) consumed (a) AuditLogConsumer Story 2.7 → INSERT `audit_log` row avec `actor_id = NULL` + `actor_role = 'system'` + `action_type = 'identity.pro.auto-rejected'` (cohérent NFR82 traçabilité même actions automatiques), (b) Story 5.4 future notification-svc → email `pro-auto-rejected.{fr,en}.tsx` "Votre dossier a été fermé pour inactivité. Vous pouvez le rouvrir à tout moment" + CTA "Recréer mon compte" qui redirige vers `/seller/onboarding/rejected` (Story 2.5 page réutilisée, comportement adapté reasonCode='inactivity' cf. AC4) ;
  - (5) métrique `tukio_pro_auto_rejections_total{reason='inactivity'}` (counter) incremented ;

**migration DB** Story 2.8 `1715294000000-AddStuckRemindersTrackingAndInactivityReasonCode.ts` :
```sql
-- Tracking des rappels J+7 (séparé Story 2.6 onboarding_reminders fields qui couvrent le scope KYC approved + no listing)
ALTER TABLE pro_profiles ADD COLUMN last_stuck_reminder_sent_at TIMESTAMPTZ NULL;
ALTER TABLE pro_profiles ADD COLUMN stuck_reminders_sent_count INT NOT NULL DEFAULT 0 CHECK (stuck_reminders_sent_count BETWEEN 0 AND 5);

-- Extend Story 2.5 reasonCode check constraint with 'inactivity' value
ALTER TABLE pro_profiles DROP CONSTRAINT pro_profiles_kyc_decision_reason_code_check;
ALTER TABLE pro_profiles ADD CONSTRAINT pro_profiles_kyc_decision_reason_code_check CHECK (
  kyc_decision_reason_code IS NULL OR kyc_decision_reason_code IN (
    'siret_invalid', 'kyc_doc_unreadable', 'kyc_doc_missing', 'company_not_found_insee', 'duplicate_siret', 'other', 'inactivity'
  )
);

-- Partial index pour cron query performance (similaire pattern Story 2.6)
CREATE INDEX idx_pro_profiles_stuck_onboarding ON pro_profiles (created_at, stripe_status)
  WHERE kyc_status IN ('pending_review', 'under_review')
    AND stripe_status IN ('not_started', 'pending', 'requires_action')
    AND deleted_at IS NULL;
```

**Frontend seller** : Story 2.8 **adapte la page rejected Story 2.5** pour différencier le case `reasonCode === 'inactivity'` :
- (a) Page `/seller/onboarding/rejected/page.tsx` UPDATE Story 2.5 : conditional rendering basé sur `me.prosFields.kycDecisionReasonCode` :
  - Si `reasonCode === 'inactivity'` → title "Votre dossier a été fermé pour inactivité" + description "Vous pouvez le rouvrir à tout moment et reprendre où vous en étiez" + CTA primary `<Button>Rouvrir mon dossier</Button>` (au lieu de "Refaire mon dossier") qui call `POST /v1/seller/kyc/restart` (Story 2.5 endpoint réutilisé — restart logic identique : reset state + tukio_status='pending_admin_review')
  - Si `reasonCode !== 'inactivity'` → behavior Story 2.5 inchangé (title "Votre dossier n'a pas été validé" + CTA "Refaire mon dossier")
- (b) i18n keys **NEW** ajoutées au namespace `seller.onboarding.rejected.*` (Story 2.5 baseline) :
  - `seller.onboarding.rejected.reasons.inactivity` : "Inactivité prolongée" / "Prolonged inactivity"
  - `seller.onboarding.rejected.inactivityTitle` : "Votre dossier a été fermé pour inactivité" / "Your application was closed due to inactivity"
  - `seller.onboarding.rejected.inactivityDescription` : "Vous pouvez le rouvrir à tout moment et reprendre où vous en étiez" / "You can reopen it anytime and resume where you left off"
  - `seller.onboarding.rejected.inactivityRestartCta` : "Rouvrir mon dossier" / "Reopen my application"

**Frontend admin** : Story 2.8 **étend la queue admin Story 2.3** pour distinguer les rejets manuels vs auto-rejections quand l'admin filtre `status='rejected'` (V1 Epic 6 — MVP : Story 2.8 expose le data, l'UI Stories 6.x exploitera) :
- (a) Story 2.3 endpoint `GET /v1/admin/verifications` retourne déjà `kycStatus` — Story 2.8 UPDATE response shape pour inclure `kycDecisionBy` (NULL = system, non-NULL = admin) + `kycDecisionReasonCode` (Story 2.5 baseline) — déjà inclus shape Story 2.4 detail mais Story 2.3 queue minimal shape étendu Story 2.8
- (b) UI badge **forward-dep Story 6.x** : si `kycDecisionBy === null && kycDecisionReasonCode === 'inactivity'` → badge `<Badge variant="muted">Auto-rejeté (inactivité)</Badge>` (vs `<Badge variant="warning">Rejeté</Badge>` pour manuel). Story 2.8 livre la donnée exposée, Story 6.x V1 wire le badge UI

**Prometheus alerts NFR48 SLA** :
- (a) NEW alert `ProStuckOnboardingHigh` : `tukio_pro_stuck_onboarding_count > 50` for 1h → warning Slack `#tukio-alerts-ops` (signal anomalie funnel — too many stuck Pros = problème UX onboarding ou Stripe down)
- (b) NEW alert `ProAutoRejectionRateHigh` : `rate(tukio_pro_auto_rejections_total[7d]) > 5/day` for 1d → warning ops (signal funnel régression)

**audit_log row pattern system actor** (Story 1.10 + 2.7 confirmed support) :
```json
{
  "actor_id": null,
  "actor_role": "system",
  "action_type": "identity.pro.auto-rejected",
  "aggregate_type": "ProProfile",
  "aggregate_id": "uuid-pro",
  "before_state": { "kycStatus": "pending_review", "tukioStatus": "pending_admin_review" },
  "after_state": { "kycStatus": "rejected", "kycDecisionReasonCode": "inactivity", "tukioStatus": "rejected" },
  "reason": "Auto-rejected after 30 days inactivity (no Stripe Connect submission)",
  "at": "2026-06-08T09:00:00Z"
}
```

**so that** la file admin reste propre (pas de Pros zombies depuis 6 mois), les Pros qui hésitent sont relancés à J+7 puis nettoyés à J+30 sans charge admin manuelle (NFR48 ops scalability — Story 2.7 audit_log capture toutes ces actions automatiques pour traçabilité LCEN/RGPD), un Pro auto-rejeté peut **réouvrir son dossier en 1-clic** (vs recréer un compte from scratch — friction réduite UX), et **Epic 2 est officiellement clôturé** : tous les flows Pro onboarding (register Story 1.3 → wizard 4 steps Story 2.2 → Stripe Story 2.1 → admin verify Story 2.3/2.4/2.5 → 1ère fiche Story 2.6 → audit Story 2.7 → cleanup Story 2.8) sont production-ready avec NFR48/82 + RGPD compliance ; le **pattern complet "multi-stage cron lifecycle (reminder + auto-action with system actor + audit trail + reopenable state)"** devient template Stories 4.x Booking expiration auto-cancel (FR42 48h délai), Stories Epic 5 review request auto J+1/J+7 (Story 5.6).

> **Outcome attendu** : à la fin de cette story, un Pro Marc fixture registered J-7 sans avoir submit Stripe → cron tourne 9am UTC → publie `identity.pro.stripe-reminder-sent.v1` → Story 5.4 future email reçu en FR (selon `userProfile.locale`) "Complétez votre dossier sous 23 jours ou il sera fermé" + lien `/seller/onboarding/stripe` ; même fixture J-30 sans avoir submit → cron tourne → `AutoRejectVerificationUseCase` execute en transaction (DB update + Keycloak sync + outbox event) → audit_log row INSERT `actor_role='system'` → Marc reconnecte → middleware Story 2.5 redirect `/fr/seller/onboarding/rejected` → page render reasonCode='inactivity' → title "Fermé pour inactivité" + CTA "Rouvrir mon dossier" → click → POST `/v1/seller/kyc/restart` (Story 2.5 endpoint) → state reset → Marc back to `/seller/onboarding/profile` ; un Pro Pierre fixture registered J-31 mais **avec stripe_status='submitted'** → cron skip (filter exclut submitted) → admin Story 2.3/2.4/2.5 prend la décision normale (n'appartient PAS au scope Story 2.8 inactivity) ; un test `pnpm playwright test --grep "pro auto-rejection"` passe FR/EN axe-core 0 violations 9 scénarios (cron J+7 reminder fire + DB stamp + event published, cron J+30 auto-reject happy + audit_log row system + Keycloak sync, Pro restart endpoint after inactivity reopen back to step Stripe, page rejected UI conditional reasonCode='inactivity' FR + EN, admin queue forward shape includes kycDecisionBy=null distinguishable, Pro stripe_status='submitted' skip cron, Pro J-29 not yet auto-rejected, Pro J-30 boundary edge case rejected, Keycloak sync fail drift event published) ; coverage ≥ 95 % aggregate `autoRejectKyc` + 90 % use case + cron + 80 % gateway ; ✅ **Epic 2 sprint-status flip `epic-2: done`** après Story 2.8 done.

## Acceptance Criteria

1. **AC1 — DB migration extension `pro_profiles` + reasonCode 'inactivity' + partial index** : Given Stories 2.5/2.6 baseline, When je consulte `apps/identity-svc/src/infrastructure/persistence/typeorm/migrations/1715294000000-AddStuckRemindersTrackingAndInactivityReasonCode.ts`, Then :
   - **NEW columns** `last_stuck_reminder_sent_at TIMESTAMPTZ NULL` + `stuck_reminders_sent_count INT NOT NULL DEFAULT 0 CHECK BETWEEN 0 AND 5`
   - **Extend reasonCode check constraint** : DROP existing → ADD with `'inactivity'` included (cohérent Story 2.5 enum)
   - **NEW partial index** :
     ```sql
     CREATE INDEX idx_pro_profiles_stuck_onboarding ON pro_profiles (created_at, stripe_status)
       WHERE kyc_status IN ('pending_review', 'under_review')
         AND stripe_status IN ('not_started', 'pending', 'requires_action')
         AND deleted_at IS NULL;
     ```
   - **`down()` migration** : DROP index, DROP columns, DROP/ADD constraint without 'inactivity'
   - Tests integration : INSERT happy path with reasonCode='inactivity' → OK ; INSERT with reasonCode='unknown' → constraint violation ; partial index EXPLAIN ANALYZE on cron query < 100ms with 100k pro_profiles fixture

2. **AC2 — Domain methods `ProProfile.autoRejectKyc` + `trackStuckReminderSent` + extension `KycRejectionReasonCode` enum** : Given Stories 2.5 baseline, When je consulte `apps/identity-svc/src/domain/model/pro-profile.aggregate.ts`, Then :
   - **UPDATE enum** `KYC_REJECTION_REASON_CODES` Story 2.5 : ajouter `'inactivity'` (frozen array source of truth) — cohérent DTOs `@tukio/contracts/dtos/admin/reject-verification.dto.ts` Story 2.5 UPDATE Story 2.8
   - **NEW domain method** `ProProfile.autoRejectKyc()` :
     ```ts
     autoRejectKyc(): void {
       if (!this.canTransitionKycTo('rejected')) {
         throw new KycStatusInvalidTransitionError({ from: this.kycStatus, to: 'rejected', proProfileId: this.id });
       }
       if (this.userProfile && this.userProfile.tukioStatus !== 'pending_admin_review') {
         throw new AutoRejectInvalidStateError({ proProfileId: this.id, tukioStatus: this.userProfile.tukioStatus });
       }
       // Hardcoded message FR — frontend translates user-display via i18n keys (Story 2.8 AC4)
       this.kycStatus = 'rejected';
       this.kycDecisionAt = new Date();
       this.kycDecisionBy = null; // system marker
       this.kycDecisionReasonCode = 'inactivity';
       this.kycDecisionMessage = 'Votre dossier a été automatiquement fermé après 30 jours sans complétion de la configuration Stripe Connect.';
       this.touch();
     }

     trackStuckReminderSent(now: Date): void {
       if (this.kycStatus !== 'pending_review' && this.kycStatus !== 'under_review') {
         throw new StuckReminderInvariantError({ field: 'kycStatus', expected: 'pending_review|under_review', actual: this.kycStatus });
       }
       if (this.stripeStatus === 'submitted') {
         throw new StuckReminderInvariantError({ field: 'stripeStatus', expected: '!= submitted', actual: this.stripeStatus });
       }
       if (this.stuckRemindersSentCount >= 5) {
         throw new StuckReminderInvariantError({ field: 'stuckRemindersSentCount', expected: '< 5', actual: String(this.stuckRemindersSentCount) });
       }
       this.lastStuckReminderSentAt = now;
       this.stuckRemindersSentCount += 1;
       this.touch();
     }
     ```
   - **NEW exceptions** `apps/identity-svc/src/domain/exception/` :
     - `auto-reject-invalid-state.error.ts`
     - `stuck-reminder-invariant.error.ts`
   - **Tests aggregate ≥ 95 %** :
     - `autoRejectKyc` happy + 4 invariant violations (kyc_status not pending, tukio_status not pending_admin_review, transition forbidden) — **strict NFR71 security state machine**
     - `trackStuckReminderSent` happy + 3 invariant violations
     - Tests confirm `kyc_decision_by = null` after autoRejectKyc (system actor distinguishable from manual reject)

3. **AC3 — `AutoRejectVerificationUseCase` + cron `pro-stuck-onboarding.task.ts`** : Given AC2, When je consulte `apps/identity-svc/src/usecases/auto-reject-verification.usecase.ts` + `infrastructure/tasks/pro-stuck-onboarding.task.ts`, Then :
   - **NEW use case** `auto-reject-verification.usecase.ts` (pattern Story 2.5 `RejectVerificationUseCase` adapted for system actor) :
     ```ts
     @Injectable()
     export class AutoRejectVerificationUseCase {
       constructor(
         @Inject(PRO_PROFILE_REPO) private readonly proProfileRepo: IProProfileRepository,
         @Inject(USER_PROFILE_REPO) private readonly userProfileRepo: IUserProfileRepository,
         @Inject(KEYCLOAK_CLIENT) private readonly keycloak: IKeycloakClient,
         @Inject(EVENT_PUBLISHER) private readonly eventPublisher: IEventPublisher,
         @Inject(TRANSACTION_MANAGER) private readonly txnManager: ITransactionManager,
         @Inject(LOGGER) private readonly logger: ILogger,
       ) {}

       async execute(input: { proProfileId: string; correlationId: string }): Promise<{ proProfileId: string; kycDecisionAt: string; daysSinceRegistration: number }> {
         return this.txnManager.runInTransaction(async (txn) => {
           const proProfile = await txn.proProfileRepo.findById(input.proProfileId);
           if (!proProfile) throw new ProProfileNotFoundError(input.proProfileId);

           const userProfile = await txn.userProfileRepo.findById(proProfile.userProfileId);
           const daysSinceRegistration = Math.floor((Date.now() - userProfile.createdAt.getTime()) / (24 * 60 * 60 * 1000));

           // Domain methods — invariants throw if invalid (idempotent — re-run cron skip already rejected)
           proProfile.autoRejectKyc();
           userProfile.changeTukioStatus('rejected');

           await txn.proProfileRepo.save(proProfile);
           await txn.userProfileRepo.save(userProfile);

           // Keycloak sync best-effort (Story 2.5 pattern)
           try {
             await this.keycloak.updateUserAttribute(userProfile.keycloakUserId, 'tukio_status', 'rejected');
           } catch (err) {
             this.logger.warn({ err, userProfileId: userProfile.id }, 'Keycloak sync failed during auto-reject — drift event published');
             await txn.eventPublisher.publish({
               eventType: 'identity.keycloak-sync.failed',
               eventVersion: 'v1',
               aggregate: { type: 'UserProfile', id: userProfile.id },
               actor: { userId: 'system', role: 'system' },
               correlationId: input.correlationId,
               payload: { userProfileId: userProfile.id, attribute: 'tukio_status', expectedValue: 'rejected', failedAt: new Date().toISOString() },
               occurredAt: new Date(),
             });
           }

           await txn.eventPublisher.publish({
             eventType: 'identity.pro.auto-rejected',
             eventVersion: 'v1',
             aggregate: { type: 'ProProfile', id: proProfile.id },
             actor: { userId: 'system', role: 'system' },
             correlationId: input.correlationId,
             payload: {
               proProfileId: proProfile.id,
               userProfileId: userProfile.id,
               userEmail: userProfile.email,
               userLocale: userProfile.locale,
               companyName: proProfile.companyName,
               kycDecisionAt: proProfile.kycDecisionAt!.toISOString(),
               reasonCode: 'inactivity',
               message: proProfile.kycDecisionMessage!,
               daysSinceRegistration,
               lastStripeStatus: proProfile.stripeStatus,
             },
             occurredAt: new Date(),
           });

           return { proProfileId: proProfile.id, kycDecisionAt: proProfile.kycDecisionAt!.toISOString(), daysSinceRegistration };
         });
       }
     }
     ```
   - **NEW task** `pro-stuck-onboarding.task.ts` (pattern Story 2.6 réutilisé) :
     ```ts
     @Injectable()
     export class ProStuckOnboardingTask {
       constructor(
         @Inject(PRO_PROFILE_REPO) private readonly proProfileRepo: IProProfileRepository,
         @Inject(USECASES_PROXY.autoRejectVerification) private readonly autoReject: UseCaseProxy<AutoRejectVerificationUseCase>,
         @Inject(EVENT_PUBLISHER) private readonly eventPublisher: IEventPublisher,
         @Inject(TRANSACTION_MANAGER) private readonly txnManager: ITransactionManager,
         @Inject(METRICS_REGISTRY) private readonly metrics: IMetricsRegistry,
         @Inject(LOGGER) private readonly logger: ILogger,
       ) {}

       @Cron('5 9 * * *', { name: 'pro-stuck-onboarding', timeZone: 'UTC' }) // 9:05 UTC daily — 5 min after Story 2.6 cron to avoid db contention
       async run(): Promise<void> {
         const correlationId = randomUUID();
         const now = new Date();
         this.logger.info({ correlationId }, 'pro-stuck-onboarding.task.ts started');

         // Phase 1: J+7 reminders
         const reminderCandidates = await this.proProfileRepo.findStuckReminderCandidates({ now });
         this.metrics.gauge('tukio_pro_stuck_reminder_candidates_count').set(reminderCandidates.length);

         for (const candidate of reminderCandidates) {
           try {
             await this.txnManager.runInTransaction(async (txn) => {
               const userProfile = await txn.userProfileRepo.findById(candidate.userProfileId);
               const daysSince = Math.floor((now.getTime() - userProfile.createdAt.getTime()) / (24 * 60 * 60 * 1000));

               candidate.trackStuckReminderSent(now); // domain method AC2
               await txn.proProfileRepo.save(candidate);

               await txn.eventPublisher.publish({
                 eventType: 'identity.pro.stripe-reminder-sent',
                 eventVersion: 'v1',
                 aggregate: { type: 'ProProfile', id: candidate.id },
                 actor: { userId: 'system', role: 'system' },
                 correlationId,
                 payload: {
                   proProfileId: candidate.id,
                   userProfileId: userProfile.id,
                   userEmail: userProfile.email,
                   userLocale: userProfile.locale,
                   companyName: candidate.companyName,
                   currentStripeStatus: candidate.stripeStatus,
                   daysSinceRegistration: daysSince,
                   daysUntilAutoRejection: 30 - daysSince,
                 },
                 occurredAt: now,
               });
             });
             this.metrics.counter('tukio_pro_stuck_reminders_sent_total').inc();
           } catch (err) {
             this.logger.error({ err, proProfileId: candidate.id, correlationId }, 'pro-stuck-reminder failed for candidate — skip');
             this.metrics.counter('tukio_pro_stuck_reminders_failed_total').inc();
           }
         }

         // Phase 2: J+30 auto-rejections
         const autoRejectCandidates = await this.proProfileRepo.findAutoRejectCandidates({ now });
         this.metrics.gauge('tukio_pro_auto_rejection_candidates_count').set(autoRejectCandidates.length);

         for (const candidate of autoRejectCandidates) {
           try {
             await this.autoReject.getInstance().execute({ proProfileId: candidate.id, correlationId });
             this.metrics.counter('tukio_pro_auto_rejections_total', { reason: 'inactivity' }).inc();
           } catch (err) {
             this.logger.error({ err, proProfileId: candidate.id, correlationId }, 'pro-auto-rejection failed for candidate — skip');
             this.metrics.counter('tukio_pro_auto_rejections_failed_total').inc();
           }
         }

         // Métric: stuck count gauge (NFR48 alert source)
         const stuckCount = await this.proProfileRepo.countStuckOnboarding();
         this.metrics.gauge('tukio_pro_stuck_onboarding_count').set(stuckCount);

         this.logger.info({ correlationId, reminderCount: reminderCandidates.length, autoRejectCount: autoRejectCandidates.length, stuckCount }, 'pro-stuck-onboarding.task.ts completed');
       }
     }
     ```
   - **NEW repo methods** `IProProfileRepository` :
     ```ts
     findStuckReminderCandidates({ now }): Promise<ProProfile[]>;
     // SQL:
     // SELECT * FROM pro_profiles p
     // JOIN user_profiles u ON p.user_profile_id = u.id
     // WHERE p.kyc_status IN ('pending_review', 'under_review')
     //   AND p.stripe_status IN ('not_started', 'pending', 'requires_action')
     //   AND p.deleted_at IS NULL
     //   AND p.stuck_reminders_sent_count = 0
     //   AND (NOW() - u.created_at) BETWEEN INTERVAL '6 days 12 hours' AND INTERVAL '7 days 12 hours'
     // ORDER BY u.created_at ASC LIMIT 500;

     findAutoRejectCandidates({ now }): Promise<ProProfile[]>;
     // SQL:
     // SELECT * FROM pro_profiles p
     // JOIN user_profiles u ON p.user_profile_id = u.id
     // WHERE p.kyc_status IN ('pending_review', 'under_review')
     //   AND p.stripe_status IN ('not_started', 'pending', 'requires_action')
     //   AND p.deleted_at IS NULL
     //   AND (NOW() - u.created_at) >= INTERVAL '30 days'
     // ORDER BY u.created_at ASC LIMIT 500;

     countStuckOnboarding(): Promise<number>;
     // For NFR48 alert metric — gauge total stuck Pros
     ```
   - Tests integration testcontainer cron : 7 scenarios — happy J+7 reminder, happy J+30 auto-reject, J-29 not yet auto-rejected, J-31 stripe='submitted' skip cron, dedupe stuck_reminders_sent_count > 0 skip reminder, Keycloak sync fail drift event, idempotent re-run cron same day no double-action

4. **AC4 — Frontend seller : Story 2.5 page rejected UPDATE conditional `reasonCode='inactivity'`** : Given Story 2.5 a livré `/seller/onboarding/rejected/page.tsx`, When Story 2.8 étend, Then :
   - **UPDATE** `apps/seller/src/app/[locale]/seller/onboarding/rejected/page.tsx` :
     ```tsx
     export default async function RejectedPage({ params }: { params: { locale: string } }) {
       const me = await fetchMe();
       const t = await getTranslations('seller.onboarding.rejected');
       const isInactivity = me.prosFields.kycDecisionReasonCode === 'inactivity';

       return (
         <EmptyState variant={isInactivity ? 'info' : 'error'} icon={isInactivity ? <ClockIcon /> : <AlertCircleIcon />}>
           <h1>{isInactivity ? t('inactivityTitle') : t('title')}</h1>
           {isInactivity ? (
             <Alert variant="info" title={t('reasons.inactivity')}>
               <p>{t('inactivityDescription')}</p>
               <p className="text-sm text-muted">{t('decisionMeta', { date: formatDate(me.prosFields.kycDecisionAt, params.locale) })}</p>
             </Alert>
           ) : (
             <Alert variant="error" title={t(`reasons.${me.prosFields.kycDecisionReasonCode}`)}>
               <pre className="whitespace-pre-wrap font-sans">{me.prosFields.kycDecisionMessage}</pre>
               <p className="text-sm text-muted">{t('decisionMeta', { date: formatDate(me.prosFields.kycDecisionAt, params.locale) })}</p>
             </Alert>
           )}
           <div className="flex gap-3">
             <RestartKycButton ctaKey={isInactivity ? 'inactivityRestartCta' : 'restartCta'} />
             <Link href="mailto:support@tukio.one?subject=Reprise%20dossier" className="btn-ghost">{t('contactSupport')}</Link>
           </div>
         </EmptyState>
       );
     }
     ```
   - **UPDATE** `RestartKycButton.tsx` Story 2.5 — accept `ctaKey` prop : `'inactivityRestartCta' | 'restartCta'` (default `'restartCta'`)
   - **UPDATE i18n** `apps/seller/src/messages/{fr,en}.json` namespace `seller.onboarding.rejected.*` — ajouter 4 keys cf. story body (`reasons.inactivity`, `inactivityTitle`, `inactivityDescription`, `inactivityRestartCta`)
   - **`/v1/seller/kyc/restart` Story 2.5 endpoint réutilisé tel quel** — restart logic identical (reset state pending_admin_review, no special handling for inactivity vs other reasons — UX is uniform "rouvrir mon dossier" regardless of reasonCode, only label differs)
   - Tests E2E (cf. AC8)

5. **AC5 — `/v1/admin/verifications` Story 2.3 endpoint UPDATE — expose `kycDecisionBy` + `kycDecisionReasonCode` in queue response** : Given Stories 2.3/2.7 baseline, When Story 2.8 étend, Then :
   - **UPDATE** `apps/identity-svc/src/usecases/list-verifications.usecase.ts` Story 2.3 — extend `VerificationListItem` shape :
     ```ts
     interface VerificationListItem {
       // ... Story 2.3 fields
       kycDecisionBy: string | null; // NEW Story 2.8 — null = system auto-reject, non-null = admin manual
       kycDecisionReasonCode: KycRejectionReasonCode | null; // NEW Story 2.8 — exposed for queue badge differentiation
     }
     ```
   - **UPDATE** `@tukio/contracts/dtos/admin/verifications.dto.ts` Story 2.3 — add 2 fields (Zod nullable)
   - **Forward-dep Story 6.x V1** : admin queue UI badge differentiation logic
   - **NB Story 2.3 query Story 2.3 : filter `kyc_status='rejected'` already supported** — Story 2.8 just adds 2 columns to response shape, no SQL query change

6. **AC6 — NATS event schemas + DTOs `@tukio/contracts`** : Given AC3-5, When je consulte `packages/contracts/src/`, Then :
   - **NEW event schemas** `events/identity/` :
     - `pro-stripe-reminder-sent.v1.{schema.json,ts}` — payload `{ proProfileId, userProfileId, userEmail, userLocale, companyName, currentStripeStatus, daysSinceRegistration, daysUntilAutoRejection }`
     - `pro-auto-rejected.v1.{schema.json,ts}` — payload `{ proProfileId, userProfileId, userEmail, userLocale, companyName, kycDecisionAt, reasonCode: 'inactivity', message, daysSinceRegistration, lastStripeStatus }`
   - **UPDATE existing DTOs** :
     - `dtos/admin/reject-verification.dto.ts` Story 2.5 — extend `KycRejectionReasonCodeEnum` Zod with `'inactivity'`
     - `dtos/admin/verifications.dto.ts` Story 2.3 — `VerificationListItemSchema` extend with `kycDecisionBy` + `kycDecisionReasonCode` nullable
   - Tests ajv schema + Zod DTO validate

7. **AC7 — Métriques Prom + alerts** :
   - **Métriques NEW** :
     - `tukio_pro_stuck_reminder_candidates_count` (gauge — cron candidates per run)
     - `tukio_pro_stuck_reminders_sent_total` (counter)
     - `tukio_pro_stuck_reminders_failed_total` (counter)
     - `tukio_pro_auto_rejection_candidates_count` (gauge)
     - `tukio_pro_auto_rejections_total{reason='inactivity'}` (counter — unique reason value MVP, V1+ will add others)
     - `tukio_pro_auto_rejections_failed_total` (counter)
     - `tukio_pro_stuck_onboarding_count` (gauge — total stuck Pros, NFR48 alert source)
   - **NEW Prometheus rules** `infra/k8s/prometheus-rules/identity-pro-stuck.yaml` :
     ```yaml
     groups:
     - name: identity-pro-stuck
       rules:
       - alert: ProStuckOnboardingHigh
         expr: tukio_pro_stuck_onboarding_count > 50
         for: 1h
         labels: { severity: warning, team: ops }
         annotations:
           summary: "{{ $value }} Pros stuck on Stripe onboarding — funnel anomaly"
           runbook: "https://wiki.tukio.one/runbook/pro-stuck-onboarding-high"
       - alert: ProAutoRejectionRateHigh
         expr: increase(tukio_pro_auto_rejections_total[7d]) > 35 # > 5/day average
         for: 1d
         labels: { severity: warning, team: ops }
         annotations:
           summary: "Auto-rejection rate {{ $value }}/week — funnel regression"
       - alert: StuckReminderCronFailed
         expr: time() - max(tukio_pro_stuck_reminder_candidates_count_last_run_at) > 26 * 3600 # > 26h since last run
         for: 30m
         labels: { severity: warning, team: ops }
     ```
   - **Dashboard Grafana** `infra/k8s/grafana-dashboards/pro-stuck-onboarding.json` (NEW ~5 panels) : stuck count gauge (target < 20), reminders sent rate, auto-rejection rate, average stuck duration histogram, conversion funnel (registered → stripe_submitted → kyc_approved → first_listing — Epic 2 success metric)
   - **Slack channels** : `#tukio-alerts-ops` (cohérent Stories 2.5/2.6/2.7)

8. **AC8 — Tests Playwright e2e + integration** : 9 tests dans 2 files :
   - **`apps/identity-svc/test/cron/pro-stuck-onboarding.spec.ts`** (5 tests integration testcontainer) :
     - Test 1 (J+7 reminder happy) : fixture Pro registered J-7 + stripe_status='not_started' → run cron → publish `identity.pro.stripe-reminder-sent.v1` + DB stuck_reminders_sent_count=1 + last_stuck_reminder_sent_at=NOW
     - Test 2 (J+30 auto-reject happy) : fixture Pro registered J-30 + stripe='not_started' + kyc_status='pending_review' → run cron → publish `identity.pro.auto-rejected.v1` + DB kyc_status='rejected' + tukio_status='rejected' + kyc_decision_by=NULL + kyc_decision_reason_code='inactivity' + audit_log row actor_role='system'
     - Test 3 (J-31 stripe='submitted' skip) : fixture Pro J-31 + stripe='submitted' → run cron → no event published (filter excludes submitted) + DB unchanged
     - Test 4 (dedupe reminder count > 0 skip) : fixture J-7 + stuck_reminders_sent_count=1 → run cron → no reminder event (already sent)
     - Test 5 (Keycloak sync fail drift) : mock IKeycloakClient.updateUserAttribute throw → run cron J-30 → DB committed + drift event `identity.keycloak-sync.failed.v1` published (Story 2.5 pattern réutilisé)
   - **`apps/seller/e2e/onboarding/inactivity-rejected.spec.ts`** (4 tests E2E) :
     - Test 6 (page render reasonCode='inactivity' FR) : Pro fixture auto-rejected → login → middleware redirect `/fr/seller/onboarding/rejected` → vérifier title FR "Votre dossier a été fermé pour inactivité" + variant info (clock icon, not error) + CTA "Rouvrir mon dossier"
     - Test 7 (page render EN) : idem `/en/`
     - Test 8 (restart from inactivity) : click "Rouvrir mon dossier" → POST `/v1/seller/kyc/restart` Story 2.5 → 200 → JWT refresh → redirect `/seller/onboarding/profile` → DB state reset (kyc_status='pending_review', tukio_status='pending_admin_review', stuck_reminders_sent_count reset à 0)
     - Test 9 (admin queue distinguishability) : 2 fixtures Pros rejected — 1 manual (kycDecisionBy=adminId) + 1 auto (kycDecisionBy=null) → admin GET `/v1/admin/verifications?status=rejected` → response distinguishable via kycDecisionBy field (null vs UUID) + kycDecisionReasonCode field
   - **Test axe-core** : 0 violations sur page rejected variant inactivity (info banner + CTA)
   - **Test perf** : cron query partial index < 50ms p90 with 100k pro_profiles fixture (EXPLAIN ANALYZE validation)
   - Coverage ≥ 95 % aggregate `autoRejectKyc` + `trackStuckReminderSent` + 90 % cron + use case + 80 % gateway updates

9. **AC9 — Documentation runbook + ADR update + Epic 2 close-out** :
   - **NEW runbook** `docs/runbook/pro-stuck-onboarding-debug.md` (~50 lignes) — flow + troubleshooting (cron query slow → check partial index, reminder dedup logic, J+30 boundary edge case, admin queue distinguish manual vs auto, restart endpoint reset state coherence)
   - **NEW runbook** `docs/runbook/pro-auto-rejection-incident.md` (~30 lignes) — what to do if auto-rejection rate spikes (check Stripe down, check email deliverability via Resend Story 5.4 future, manual rollback procedure for false-positive auto-rejections)
   - **UPDATE `docs/adr/0009-keycloak-identity-svc-split.md`** ADR-009 — section "Auto-rejection workflow Story 2.8" : decision multi-stage cron, system actor pattern, reasonCode='inactivity' extension
   - **UPDATE `docs/project-context.md`** — section "Pro Onboarding Lifecycle Epic 2 (finalized)" : full flow diagram register → wizard 4 steps → admin verify → 1ère fiche → auto-rejection 30j inactivity if stuck Stripe
   - **Sprint-status flip Epic 2 done** : after Story 2.8 done (manual transition by user when 8/8 stories completed) — this story marks the `epic-2-retrospective: optional` ready for run

## Tasks / Subtasks

- [ ] **Task 1 — `@tukio/contracts` event schemas + DTOs extension** (AC: #6)
  - [ ] 1.1 — Event schema `identity/pro-stripe-reminder-sent.v1.{schema.json,ts}`
  - [ ] 1.2 — Event schema `identity/pro-auto-rejected.v1.{schema.json,ts}`
  - [ ] 1.3 — UPDATE Story 2.5 `dtos/admin/reject-verification.dto.ts` — extend Zod enum with `'inactivity'`
  - [ ] 1.4 — UPDATE Story 2.3 `dtos/admin/verifications.dto.ts` — extend `VerificationListItemSchema` with kycDecisionBy + kycDecisionReasonCode
  - [ ] 1.5 — Tests ajv schemas + Zod
- [ ] **Task 2 — DB migration + entity + repository updates** (AC: #1)
  - [ ] 2.1 — Migration `1715294000000-AddStuckRemindersTrackingAndInactivityReasonCode.ts` (2 cols + check constraint extend + partial index)
  - [ ] 2.2 — `ProProfileEntity` UPDATE 2 nouveaux fields
  - [ ] 2.3 — Repository `findStuckReminderCandidates` + `findAutoRejectCandidates` + `countStuckOnboarding` methods
  - [ ] 2.4 — Tests integration repo : INSERT/UPDATE happy + check constraint + partial index EXPLAIN ANALYZE
- [ ] **Task 3 — Domain methods + value object enum extension + exceptions** (AC: #2) — coverage ≥ 95 %
  - [ ] 3.1 — Update `KYC_REJECTION_REASON_CODES` Story 2.5 frozen array with `'inactivity'`
  - [ ] 3.2 — `ProProfile.autoRejectKyc()` + invariants
  - [ ] 3.3 — `ProProfile.trackStuckReminderSent()` + invariants
  - [ ] 3.4 — Exceptions `AutoRejectInvalidStateError`, `StuckReminderInvariantError`
  - [ ] 3.5 — Tests aggregate exhaustifs (12+ cases)
- [ ] **Task 4 — `AutoRejectVerificationUseCase` + cron `pro-stuck-onboarding.task.ts`** (AC: #3) — coverage ≥ 90 %
  - [ ] 4.1 — Use case `auto-reject-verification.usecase.ts` (transactional + outbox + Keycloak best-effort + drift event)
  - [ ] 4.2 — Task `pro-stuck-onboarding.task.ts` (`@Cron 5 9 * * *` — 5 min after Story 2.6 to avoid DB contention)
  - [ ] 4.3 — Wire usecases-proxy module + Symbol DI tokens
  - [ ] 4.4 — Tests integration testcontainer 5 cron scenarios + métric assertions
- [ ] **Task 5 — Frontend seller : page rejected UPDATE conditional reasonCode='inactivity'** (AC: #4)
  - [ ] 5.1 — UPDATE `apps/seller/src/app/[locale]/seller/onboarding/rejected/page.tsx` (Story 2.5)
  - [ ] 5.2 — UPDATE `RestartKycButton.tsx` accept `ctaKey` prop
  - [ ] 5.3 — UPDATE i18n `seller.onboarding.rejected.*` (4 new keys × 2 locales)
  - [ ] 5.4 — Tests E2E 4 scenarios AC8
- [ ] **Task 6 — Story 2.3 endpoint extension + Story 2.7 audit_log validation** (AC: #5)
  - [ ] 6.1 — UPDATE `list-verifications.usecase.ts` Story 2.3 — extend response shape
  - [ ] 6.2 — UPDATE forwarder + integration tests confirm shape
  - [ ] 6.3 — Verify Story 2.7 AuditLogConsumer captures `identity.pro.auto-rejected.v1` (extension `identity.*` already covered Story 2.7 — no change needed) + verify audit_log row has `actor_role='system'` + `actor_id=null`
- [ ] **Task 7 — Métriques Prom + alerts + Grafana** (AC: #7)
  - [ ] 7.1 — 7 nouvelles métriques (cf. AC7)
  - [ ] 7.2 — Prometheus rules `identity-pro-stuck.yaml` (3 alerts)
  - [ ] 7.3 — Dashboard Grafana `pro-stuck-onboarding.json` 5 panels + Epic 2 conversion funnel
  - [ ] 7.4 — Slack routing `#tukio-alerts-ops`
- [ ] **Task 8 — Tests Playwright e2e + axe-core + perf + integration cron** (AC: #8) — 9 tests + coverage thresholds
- [ ] **Task 9 — Documentation runbook + ADR + Epic 2 close-out + commit** (AC: #9)
  - [ ] 9.1 — Runbook `pro-stuck-onboarding-debug.md`
  - [ ] 9.2 — Runbook `pro-auto-rejection-incident.md`
  - [ ] 9.3 — Update ADR-009 + project-context.md (Epic 2 close-out summary)
  - [ ] 9.4 — Commit `feat(identity,seller): Story 2.8 Pro stuck onboarding cron J+7 reminder + J+30 auto-rejection inactivity + reasonCode 'inactivity' + page rejected reopen flow + Prometheus alerts (Epic 2 closed)`

## Dev Notes

### Pourquoi Story 2.8 ferme Epic 2 — clôture lifecycle Pro onboarding

Story 2.8 livre le **dernier filet de sécurité** du funnel onboarding Pro : Pros bloqués sur Stripe sont relancés J+7 puis nettoyés J+30 sans charge admin. Combiné Stories 2.1-2.7, Epic 2 livre un flow Pro onboarding **production-ready** end-to-end : register → wizard → admin verify → 1ère fiche → audit + auto-cleanup. Pattern multi-stage cron lifecycle (`reminder + auto-action with system actor + audit trail + reopenable state`) réutilisé Stories 4.x Booking expiration FR42 (48h délai), Stories 5.6 review request relance auto J+1/J+7, Stories 6.5 V1 sanction graduée (warning → ban gradual).

### Décisions techniques majeures actées

1. **Cron unique daily 9:05 UTC `pro-stuck-onboarding.task.ts`** (5 min décalé Story 2.6 9:00 UTC) — single cron handles both J+7 reminder AND J+30 auto-reject phases (vs 2 separate crons). Operational simplicity + DB query efficient (single connection cycle).
2. **Décalage horaire 5 min** vs Story 2.6 (9:00 UTC) — évite DB contention sur `pro_profiles` partial index queries, opérationnellement clearer logs (Story 2.6 finishes before 2.8 starts).
3. **Single use case `AutoRejectVerificationUseCase`** (vs reusing Story 2.5 `RejectVerificationUseCase` with system adminId) — cleaner separation : (a) different invariants (no `kyc_decision_by` required), (b) different event type (`auto-rejected.v1` vs `rejected.v1`) so consumers can route differently (Story 5.4 different email template), (c) future-proof if auto-rejection logic diverges (e.g., V1+ retry KYC re-upload before final rejection).
4. **`kyc_decision_by = NULL` system marker** (vs special UUID `00000000-...`) — DB constraint allows NULL (Story 1.3 schema), simpler. NULL = system, non-NULL = admin user. Audit_log Story 2.7 captures `actor_role='system'` separately.
5. **`reasonCode='inactivity'` enum extension** (vs free-text reason or new field `auto_rejection_reason`) — DRY single field `kyc_decision_reason_code`, simple Zod enum extension, frontend uniform conditional render.
6. **Hardcoded message FR in domain** (vs i18n-keyed message) — DB stores FR string. Frontend translates **the reasonCode label only** via i18n keys. The free-text `kyc_decision_message` is admin-friendly default — used as-is for `/v1/me/admin-actions` Story 2.7 RGPD endpoint. Trade-off : adequate for MVP single-locale Pro target (PdL FR), V1+ will i18n the message at notification-svc Story 5.4 level (template-based).
7. **Re-use Story 2.5 `/v1/seller/kyc/restart` endpoint** (vs new auto-reject-specific restart) — same logic (reset state to pending_review/pending_admin_review). UX uniform "Rouvrir mon dossier".
8. **Re-use Story 2.5 page `/seller/onboarding/rejected/page.tsx`** with conditional reasonCode='inactivity' — single page, dual-mode rendering. Avoids duplicate route + same i18n namespace.
9. **Single jalon J+7 reminder** (vs Story 2.6 multi-stage J+7/14/21) — Stripe onboarding step fundamentally different from "publish first listing" : stuck Pros need ONE strong reminder before auto-reject, not gentle progressive reminders. Pattern différent intentionally.
10. **5-day cap on `stuck_reminders_sent_count`** — defensive (cron crash + retry should never send > 5). MVP only sends 1 (J+7). V1+ may add J+14/J+21 if needed.
11. **Prometheus alert `ProAutoRejectionRateHigh`** (> 5/day average) — funnel regression signal (Stripe down? Onboarding UX issue?). Helps detect anomalies vs steady-state expected ~1-2/day.
12. **EN strict + i18n strict + RGAA AA + Pretre + envelope ADR-014 + latest stable versions** memories.

### Versions à utiliser

(Pas de nouvelle dépendance — réutilise Stories 1.x/2.x : `@nestjs/schedule`, TypeORM, NestJS, Prom client, focus-trap-react Story 2.4)

### Project Structure cible

```
packages/contracts/src/events/identity/
├─ pro-stripe-reminder-sent.v1.{schema.json,ts}                  # NEW Story 2.8
└─ pro-auto-rejected.v1.{schema.json,ts}                         # NEW Story 2.8

packages/contracts/src/dtos/admin/
├─ reject-verification.dto.ts                                    # UPDATE Story 2.5 — extend reasonCode enum 'inactivity'
└─ verifications.dto.ts                                          # UPDATE Story 2.3 — extend VerificationListItemSchema 2 nullable fields

apps/identity-svc/src/
├─ domain/
│  ├─ model/
│  │  ├─ pro-profile.aggregate.ts                                # UPDATE — autoRejectKyc + trackStuckReminderSent + getters
│  │  └─ value-objects/kyc-rejection-reason-code.value-object.ts # UPDATE Story 2.5 — extend frozen array
│  └─ exception/
│     ├─ auto-reject-invalid-state.error.ts                      # NEW
│     └─ stuck-reminder-invariant.error.ts                       # NEW
├─ usecases/
│  ├─ auto-reject-verification.usecase.ts + spec                 # NEW
│  └─ list-verifications.usecase.ts                              # UPDATE Story 2.3 — extend response shape
├─ usecases-proxy/usecases-proxy.module.ts                       # UPDATE — wire AutoReject use case
├─ infrastructure/
│  ├─ persistence/typeorm/
│  │  ├─ entities/pro-profile.entity.ts                          # UPDATE — 2 new fields + reasonCode enum extend
│  │  ├─ repositories/pro-profile.typeorm.repository.ts          # UPDATE — findStuckReminderCandidates + findAutoRejectCandidates + countStuckOnboarding
│  │  └─ migrations/1715294000000-AddStuckRemindersTrackingAndInactivityReasonCode.ts  # NEW
│  └─ tasks/
│     └─ pro-stuck-onboarding.task.ts                            # NEW (cron @Cron 5 9 * * *)

apps/seller/src/
├─ app/[locale]/seller/onboarding/rejected/page.tsx              # UPDATE Story 2.5 — conditional reasonCode='inactivity'
├─ features/seller/onboarding/components/RestartKycButton.tsx    # UPDATE Story 2.5 — accept ctaKey prop
└─ messages/{fr,en}.json                                         # UPDATE — 4 new keys seller.onboarding.rejected.*

apps/identity-svc/test/cron/pro-stuck-onboarding.spec.ts         # NEW (5 tests integration testcontainer)
apps/seller/e2e/onboarding/inactivity-rejected.spec.ts           # NEW (4 tests E2E)

infra/k8s/prometheus-rules/identity-pro-stuck.yaml               # NEW (3 alerts)
infra/k8s/grafana-dashboards/pro-stuck-onboarding.json           # NEW (5 panels + Epic 2 conversion funnel)

docs/runbook/
├─ pro-stuck-onboarding-debug.md                                 # NEW (~50 lignes)
└─ pro-auto-rejection-incident.md                                # NEW (~30 lignes)

docs/adr/0009-keycloak-identity-svc-split.md                     # UPDATE — section "Auto-rejection Story 2.8"
docs/project-context.md                                          # UPDATE — section "Epic 2 finalized"

# Estimation : ~25 nouveaux + ~10 updates = ~35 fichiers
```

### Critical Architecture Constraints

> Cf. Stories 0.5/0.7 (atomics, outbox), 0.6 (Pretre), 1.2 (gateway-api), 1.3 (ProProfile + kyc_status enum), 1.7 (admin layout), 1.8 (`/v1/me`), 1.9 (cron pattern `@nestjs/schedule`), 1.10 (audit_log + AuditLogConsumer + IKeycloakClient), 2.1 (Stripe stripe_status enum + outbox), 2.2 (UserProfile.changeTukioStatus + middleware seller redirect rejected), 2.3 (admin queue + DataTable + cursor pagination + VerificationListItem shape), 2.4 (admin detail), 2.5 (RejectVerificationUseCase + reasonCode enum + restart endpoint + page rejected baseline + KycStatusInvalidTransitionError + canTransitionKycTo + canTransitionTukioStatusTo), 2.6 (cron pattern + onboarding_reminders fields separate), 2.7 (audit_log subscribe `identity.*` covers `identity.pro.auto-rejected.v1` + actor=system audit row pattern) + memories.

1. **Pretre architecture stricte** — port methods + use cases + cron task + value object extensions.
2. **Transactional outbox ADR-007** — single transaction TypeORM (DB save + outbox event publish atomic).
3. **API responses envelope ADR-014** — Story 2.3 endpoint extension preserves envelope.
4. **EN strict couche tech** — events naming `identity.pro.auto-rejected.v1`, paths `/v1/seller/kyc/restart` réutilisé.
5. **i18n FR/EN** — namespace `seller.onboarding.rejected.*` extension 4 nouvelles keys × 2 locales.
6. **NFR48 SLA** — Prometheus alert `ProStuckOnboardingHigh > 50` warning Slack.
7. **NFR82 audit immutable** — `identity.pro.auto-rejected.v1` consumed AuditLogConsumer Story 1.10/2.7 → audit_log row `actor_role='system'`. Cohérent NFR82 traçabilité même actions automatiques.
8. **NFR1 RGPD** — auto-rejected Pro can re-open dossier (no permanent deletion). Audit_log retains 5 ans (Story 2.7 cron archive).
9. **Cron pattern Story 2.6** réutilisé : `@nestjs/schedule` `@Cron(...)` + DB query partial index + outbox event + métriques Prom.
10. **State machine** Story 2.5 réutilisé : `canTransitionKycTo` (`pending_review|under_review → rejected`) + `canTransitionTukioStatusTo` (`pending_admin_review → rejected`).
11. **Latest stable versions** memory.

### Previous Story Intelligence

**Story 1.3 (Pro registration)** : `pro_profiles.kyc_status` enum + `kyc_decision_by UUID NULL` (NULL supported for system actor). Story 2.8 réutilise schema.

**Story 1.10 (Pretre consolidation)** : `audit_log` table + AuditLogConsumer + `actor_role` field NULL-able for system events. Story 2.8 publishes `identity.pro.auto-rejected.v1` automatiquement consumed → audit_log row `actor_role='system'`.

**Story 2.1 (Stripe Connect)** : `stripe_status` enum `'not_started' | 'pending' | 'requires_action' | 'submitted' | 'restricted'`. Story 2.8 cron filter target `IN ('not_started', 'pending', 'requires_action')`.

**Story 2.5 (admin accept/reject)** : Story 2.8 réutilise massivement :
- `KYC_REJECTION_REASON_CODES` enum (Story 2.8 extends with 'inactivity')
- `RejectVerificationUseCase` pattern (Story 2.8 adapts as `AutoRejectVerificationUseCase`)
- `IKeycloakClient.updateUserAttribute` best-effort + drift event
- `UserProfile.changeTukioStatus('rejected')` (allowed transition)
- `canTransitionKycTo` invariants
- `/v1/seller/kyc/restart` endpoint (réutilisé tel quel pour reopen)
- `/seller/onboarding/rejected/page.tsx` (UPDATE conditional reasonCode='inactivity')

**Story 2.6 (cron pattern)** : `@nestjs/schedule` `@Cron('0 9 * * *')` daily — Story 2.8 décale 5 min `'5 9 * * *'` pour éviter DB contention. DB tracking fields pattern `last_*_sent_at + *_count` + partial index pattern réutilisé.

**Story 2.7 (audit trail finalization)** : AuditLogConsumer subscribe `identity.*` already covers `identity.pro.auto-rejected.v1` — no consumer change needed Story 2.8. Audit_log row format with `actor_id=NULL + actor_role='system'` already supported.

### What this story does NOT do

- ❌ **Email transactionnel `pro-stripe-stuck-reminder.{fr,en}.tsx`** → Story 5.4 (consume `identity.pro.stripe-reminder-sent.v1`)
- ❌ **Email `pro-auto-rejected.{fr,en}.tsx`** → Story 5.4 (consume `identity.pro.auto-rejected.v1`)
- ❌ **Admin queue UI badge "Auto-rejeté"** — Story 6.x V1 wire le badge avec data exposée Story 2.8 (kycDecisionBy=null + reasonCode='inactivity')
- ❌ **In-app notification feed** Story 11.1 V1 (peut consumer reminder events V1)
- ❌ **Multi-jalon reminders J+7/14/21** comme Story 2.6 — MVP single J+7 reminder + J+30 auto-reject. V1+ étend si métriques montrent besoin.
- ❌ **Per-tier auto-rejection delay** (e.g., Pro Premium = 60j tolerance) — V1+
- ❌ **Auto-reject via admin manual trigger button** — V1+ admin tool (Story 6.x). MVP : cron only.
- ❌ **GDPR data deletion post-auto-rejection** — soft-delete only, audit_log retains 5 ans (Story 2.7 archive R2 99 ans). Pro can always re-open.
- ❌ **Notification Slack auto-rejection batch summary** "X Pros auto-rejected today" → V1+ ops automation.

### Files to UPDATE vs CREATE

(Cf. Project Structure cible — annoté UPDATE/NEW)

### Testing Standards

- Coverage ≥ 95 % aggregate methods (`autoRejectKyc`, `trackStuckReminderSent`) — NFR71 strict (state machine critical)
- Coverage ≥ 90 % cron task + use case
- Coverage ≥ 80 % gateway endpoint extensions + frontend page conditional
- E2E Playwright FR/EN axe-core 0 violations 9 tests AC8
- Tests integration testcontainer cron : 5 scenarios (J+7 reminder, J+30 auto-reject, skip submitted, dedupe, Keycloak fail drift)
- Perf : cron query partial index < 50ms p90 with 100k pro_profiles fixture (EXPLAIN ANALYZE validation)
- Tests Prometheus alerts : `ProStuckOnboardingHigh` fired with fixture > 50 stuck Pros
- Audit_log integration test : auto-reject → consumer → audit_log row `actor_role='system'` visible

### Project Structure Notes

✅ **Aligné architecture, PRD §FR3 (KYC validation), §FR17 (rejected redirect), §NFR1 (RGPD audit retention 5y), §NFR48 (SLA admin + ops scale), §NFR82 (audit immutable + system actor support), Stories 1.3/1.7/1.8/1.10/2.1/2.2/2.3/2.5/2.6/2.7, memories.**

⚠️ **Décision** : Cron unique combinant J+7 reminder + J+30 auto-reject (vs 2 crons séparés) — operational simplicity.

⚠️ **Décision** : Décalage cron 9:05 UTC (vs Story 2.6 9:00 UTC) — évite DB contention.

⚠️ **Décision** : Use case dédié `AutoRejectVerificationUseCase` (vs reuse Story 2.5 with system adminId) — cleaner separation + future-proof divergence.

⚠️ **Décision** : `kyc_decision_by = NULL` system marker (vs special UUID) — DB constraint allows NULL, simpler.

⚠️ **Décision** : `reasonCode='inactivity'` enum extension (vs new field) — DRY + Zod enum simple extension.

⚠️ **Décision** : Hardcoded FR message in domain (vs i18n-keyed) — adequate MVP, V1+ template-based at notification-svc.

⚠️ **Décision** : Réutiliser Story 2.5 endpoint `/v1/seller/kyc/restart` + page `/seller/onboarding/rejected` (UPDATE conditional) — pas de duplicate.

⚠️ **Décision** : Single jalon J+7 reminder (vs Story 2.6 multi-stage) — Stripe stuck case fundamentally different.

⚠️ **Épic 2 close-out** : Story 2.8 done → user manual flip `epic-2: done` in sprint-status.yaml + retrospective optional.

### References

- [Source: epics.md#Epic-2-Story-2.8 — Lines 1365-1377]
- [Source: prd.md#FR3, #FR17, #NFR1 (RGPD retention), #NFR48 (SLA + ops scale), #NFR82 (audit immutable system actor support)]
- [Source: architecture.md — ADR-007 transactional outbox, ADR-014 envelope, audit_log immutability]
- [Source: Stories 1.3 (kyc_status enum + kyc_decision_by NULL), 1.10 (audit_log + AuditLogConsumer + actor_role NULL-able), 2.1 (stripe_status enum + outbox), 2.2 (changeTukioStatus + middleware seller rejected), 2.3 (VerificationListItem shape extend), 2.5 (RejectVerificationUseCase pattern + reasonCode enum + restart endpoint + page rejected + state machine), 2.6 (cron pattern + tracking fields), 2.7 (audit_log identity.* subscription covers auto-rejected event)]
- [Memory: feedback_clean_architecture_explicit.md, feedback_api_envelope_response.md, feedback_tech_layer_english.md, feedback_i18n_frontend.md, feedback_latest_versions.md]

## Dev Agent Record

### Agent Model Used

(à remplir par dev agent : modèle + version)

### Debug Log References

### Completion Notes List

(à remplir à la fin — résumé décisions, déviations vs Dev Notes avec justification, points d'attention pour Story 5.4 (notification-svc consume `identity.pro.stripe-reminder-sent.v1` + `identity.pro.auto-rejected.v1` events Story 2.8 + Stories 2.5/2.6 events → 4+ email templates), Stories 6.x V1 (admin queue UI badge differentiation manual vs auto-reject — data exposée Story 2.8), Stories 6.5 V1 sanction graduée (réutilise pattern multi-stage cron + system actor + audit trail Story 2.8))

### File List

(à remplir au fil de l'implémentation par le dev agent)

---

## Story Completion Status

- **Story Status** : `ready-for-dev`
- **Created** : 2026-05-09
- **Created by** : `bmad-create-story` workflow
- **Epic** : Epic 2 — Pro Onboarding & Admin Verification (MVP) — **last story Epic 2**
- **Sprint cible** : Sprint 3 (8ᵉ et dernière story Epic 2)
- **Estimation effort** : 2-3 jours (1 dev fullstack — story complexité moyenne : 1 use case + 1 cron + 2 events + 2 domain methods + 1 page UPDATE + DB migration + métriques, ~35 fichiers — réutilise massivement Stories 2.5/2.6)
- **Dépendances upstream** : Stories 0.5 (atomics), 0.6 (Pretre), 0.7 (outbox), 1.2 (gateway-api), 1.3 (ProProfile + kyc_status + kyc_decision_by NULL-able), 1.7 (admin layout), 1.8 (`/v1/me`), 1.9 (cron `@nestjs/schedule`), 1.10 (audit_log + AuditLogConsumer + IKeycloakClient + actor_role NULL-able), 2.1 (stripe_status enum + outbox), 2.2 (changeTukioStatus + middleware seller rejected), 2.3 (admin queue VerificationListItem shape), 2.5 (RejectVerificationUseCase pattern + reasonCode enum + restart endpoint + rejected page + state machine + canTransitionKycTo/TukioStatus), 2.6 (cron pattern), 2.7 (audit_log identity.* subscription captures auto-rejected event automatiquement)
- **Dépendances downstream** :
  - Story 5.4 (notification-svc) — consume `identity.pro.stripe-reminder-sent.v1` + `identity.pro.auto-rejected.v1` Story 2.8 + Stories 2.5/2.6 events → 4+ email templates `pro-stripe-stuck-reminder.{fr,en}.tsx` + `pro-auto-rejected.{fr,en}.tsx`
  - Stories 6.x V1 (admin queue UI badge + filter manual vs auto-reject) — data exposée Story 2.8 (kycDecisionBy=null + reasonCode='inactivity')
  - Stories 6.5 V1 (sanction graduée) — réutilise pattern multi-stage cron + system actor + audit trail Story 2.8
  - Stories 4.x V1 (Booking expiration FR42 48h) — réutilise pattern cron + system actor
  - Stories 5.6 V1 (auto-request review J+1 + relance J+7) — réutilise pattern multi-stage cron Story 2.6/2.8
- **FRs covered** :
  - **FR3 closure** ✅ KYC validation flow — Epic 2 final story closes loop with auto-rejection cleanup
- **NFRs touchés** :
  - **NFR1** ✅ RGPD audit retention via Story 2.7 + reopenable account (no permanent deletion)
  - **NFR48** ✅ SLA admin queue scalability (auto-cleanup stuck Pros) + Prometheus alert ProStuckOnboardingHigh
  - **NFR71** ✅ coverage ≥ 95 % aggregate + 90 % cron/usecase + 80 % gateway/frontend
  - **NFR82** ✅ audit immutable system actor pattern (audit_log row `actor_role='system'` cohérent NFR82 traçabilité actions automatiques)
- **Epic 2 close-out** : 8/8 stories ready-for-dev. Once Story 2.8 done, manual flip `epic-2: done` in sprint-status.yaml + run optional `epic-2-retrospective` via `/bmad-retrospective`.

> **🎉 Epic 2 closed-out preview** : Pro onboarding lifecycle complète production-ready : register Story 1.3 → wizard 4 steps Story 2.2 → Stripe Story 2.1 → admin verify Stories 2.3/2.4/2.5 → 1ère fiche Story 2.6 → audit Story 2.7 → cleanup Story 2.8.
>
> **Prochaine epic → Epic 3** (Catalog Publication & Discovery — MVP) — démarre Story 3.1 catalog data model + 2 catégories pilotes seed.

---

**Dev agent next steps :**
1. Lire ce file complètement
2. Vérifier upstream Stories 0.5, 0.6, 0.7, 1.2, 1.3, 1.7, 1.8, 1.9, 1.10, 2.1, 2.2, 2.3, 2.5, 2.6, 2.7 implémentées
3. Implémenter Tasks 1-9 dans l'ordre (DTOs/events Task 1 → DB Task 2 → domain Task 3 → use case + cron Task 4 → frontend Task 5 → endpoint extension Task 6 → métriques Task 7 → tests Task 8 → docs + Epic 2 close-out Task 9)
4. Lancer `pnpm vitest --filter=identity-svc cron/pro-stuck` + `pnpm playwright test --grep "pro auto-rejection"` après chaque jalon
5. Commit Story 2.8 quand : 9/9 e2e + 5/5 cron testcontainer + coverage NFR71 + axe-core 0 + perf cible < 50ms p90 cron query + Prometheus alerts testés + Keycloak sync fail drift testé + i18n FR/EN 4 keys + audit_log row system actor verified + state machine transitions tests aggregate exhaustifs
6. Update sprint-status : `2-8-...: review` puis `done` → puis flip manuel `epic-2: done`
7. Lancer `/bmad-retrospective epic-2` (optional) pour review apprentissages Epic 2
