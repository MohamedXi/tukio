# Story 2.5: Pro acceptation/rejet workflow + transitions de statut

Status: ready-for-dev

## Story

**As an** Admin (`admin-modo` / `admin-super` minimum — `admin-support` lecture seule via Story 2.4 + note pré-screening uniquement),
**I want** **valider ou rejeter** un dossier KYC Pro depuis la page detail Story 2.4 — exposé via gateway-api `POST /v1/admin/verifications/:proProfileId/accept` (body vide) et `POST /v1/admin/verifications/:proProfileId/reject` (body `{ reasonCode: 'siret_invalid' | 'kyc_doc_unreadable' | 'kyc_doc_missing' | 'company_not_found_insee' | 'duplicate_siret' | 'other', message: string ≥ 20 chars }`) qui forward identity-svc internal endpoints, retournent enveloppe ADR-014 `{ method:'POST', code:200, data: { proProfileId, kycStatus: 'approved' | 'rejected', kycDecisionAt, kycDecisionBy, ...rejectFields? } }` ; **Use case `AcceptVerificationUseCase`** (NEW) côté identity-svc applique transition aggregate `ProProfile.approveKyc(adminId)` (méthode déjà sketchée Story 1.3 — invariants : current `kyc_status ∈ {pending_review, under_review}` SINON `KycStatusInvalidTransitionError` → 409 `IDENTITY-CONFLICT-004` "Pro déjà décidé") + (1) `kyc_status = 'approved'`, `kyc_decision_at = NOW()`, `kyc_decision_by = adminId`, `kyc_decision_reason_code = NULL`, `kyc_decision_message = NULL` ; (2) **PAS de transition `tukio_status`** (reste `pending_admin_review` jusqu'à Story 2.2/2.6 CompleteOnboardingUseCase post-1ère-fiche → `active`) ; (3) PAS de Keycloak sync (claim `tukio:status` reste pending — Story 2.2 sync à la complétion onboarding) ; (4) outbox publish `identity.pro.verified.v1` (payload `{ proProfileId, userProfileId, kycDecisionAt, kycDecisionBy, kycDecisionByName, correlationId }`) consumed par AuditLogConsumer Story 1.10 (→ INSERT `audit_log` action_type=`identity.pro.verified`) + **Story 5.4 future** notification-svc (→ email `pro-verified.{fr,en}.tsx` "Compte validé !") + **Story 2.2 future** wizard polling (page `/seller/onboarding/kyc` re-fetch `/v1/me` → kyc_status='approved' → auto-redirect step 4) ; (5) gateway response 200 enveloppe ; **Use case `RejectVerificationUseCase`** (NEW) côté identity-svc applique transition aggregate `ProProfile.rejectKyc(adminId, reasonCode, message)` (invariants : current `kyc_status ∈ {pending_review, under_review}` + `reasonCode ∈ enum 6 valeurs` + `message.length ≥ 20 chars && ≤ 2000 chars` SINON `KycRejectionInvalidError` → 422 `IDENTITY-VALIDATION-005`) + (1) `kyc_status = 'rejected'`, `kyc_decision_at = NOW()`, `kyc_decision_by = adminId`, `kyc_decision_reason_code = $code`, `kyc_decision_message = $message` ; (2) **transition `userProfile.tukio_status = 'rejected'`** (méthode `UserProfile.changeTukioStatus('rejected')` Story 2.2 réutilisée — étend les transitions allowed `pending_admin_review → rejected`) ; (3) **Keycloak sync** custom claim `tukio:status='rejected'` via `IKeycloakClient.updateUserAttribute(keycloakUserId, 'tukio_status', 'rejected')` (port Story 1.x réutilisé) ; (4) outbox publish `identity.pro.rejected.v1` (payload `{ proProfileId, userProfileId, kycDecisionAt, kycDecisionBy, kycDecisionByName, reasonCode, message, correlationId }`) consumed AuditLogConsumer + Story 5.4 future (→ email `pro-rejected.{fr,en}.tsx` "Dossier non validé" avec `reasonCode` traduit + `message`) + Story 2.2 wizard polling ; (5) gateway response 200 ; **transactional consistency** : pour les 2 use cases, persistence + outbox event publish sont dans une **seule transaction TypeORM** (cohérent ADR-007 Story 0.7) — si DB commit fail, l'event n'est pas envoyé ; si Keycloak sync fail (reject path), use case enregistre un drift event `identity.keycloak-sync.failed.v1` consumed par reconciliation cron Story 1.10 (best-effort sync — DB est source of truth) ; **idempotence** : re-clic "Valider" sur un Pro déjà `approved` → 409 `IDENTITY-CONFLICT-004` (vérification au use case entry — pattern Story 2.4 idempotency). Re-POST avec body identique sur un Pro `rejected` → 409 idem ; **migration DB** Story 2.5 `1715291000000-RenameKycDecisionReasonAndAddMessage.ts` : `ALTER TABLE pro_profiles RENAME COLUMN kyc_decision_reason TO kyc_decision_reason_code` + `ALTER TABLE pro_profiles ADD CONSTRAINT pro_profiles_kyc_decision_reason_code_check CHECK (kyc_decision_reason_code IS NULL OR kyc_decision_reason_code IN ('siret_invalid', 'kyc_doc_unreadable', 'kyc_doc_missing', 'company_not_found_insee', 'duplicate_siret', 'other'))` + `ALTER TABLE pro_profiles ADD COLUMN kyc_decision_message TEXT NULL` ; **Frontend admin** : Story 2.5 ajoute les **2 boutons** + **2 modales** dans le placeholder `data-test="actions-zone"` Story 2.4 (`apps/admin/src/app/[locale]/verifications/[proProfileId]/page.tsx`) :
- (1) `<Button variant="success" onClick={openApproveModal}>Valider le dossier</Button>` (admin-modo+ — disabled+tooltip pour admin-support) → `<ApproveModal>` confirmation simple "Confirmer la validation du dossier de {companyName} ?" + 2 CTAs Annuler/Confirmer → mutation `useAcceptVerification` → toast succès "Dossier validé ✓" + invalidate detail query → page re-render `<Badge variant="success">KYC approuvé</Badge>` + history timeline updates avec nouvelle action
- (2) `<Button variant="danger" onClick={openRejectModal}>Rejeter le dossier</Button>` → `<RejectModal>` `<Select required>` 6 options localisées (FR : "SIRET invalide", "Document KYC illisible", "Document KYC manquant", "Société introuvable INSEE", "SIRET déjà utilisé", "Autre — précisez") + `<Textarea required minLength={20} maxLength={2000}>` "Message au Pro (≥ 20 caractères)" avec compteur live + helper "Ce message sera envoyé au Pro par email + visible dans son espace" + 2 CTAs Annuler/Confirmer (disabled si form invalide) → mutation `useRejectVerification` → toast succès + invalidate detail query → re-render kyc_status='rejected' badge + history timeline updates
- (3) **CTAs hidden** si `kyc_status ∈ {approved, rejected}` (déjà décidé) — remplacé par `<Alert>` "Décision finale : {kycStatus} le {kycDecisionAt} par {kycDecisionByName}" + lien "Voir l'historique" qui scroll vers `<HistoryTimeline>` Story 2.4

**Frontend seller** : Story 2.5 livre la **page de rejet** `/seller/onboarding/rejected/page.tsx` (NEW) qui affiche au Pro `tukio_status='rejected'` :
- `<EmptyState variant="error">` icon X rouge "Votre dossier n'a pas été validé"
- Display structured `kycDecisionReasonCode` (traduit FR/EN via i18n keys `seller.onboarding.rejected.reasons.{code}`) + `kycDecisionMessage` (free text admin in raw, RGAA AA preserved-formatting `<pre className="whitespace-pre-wrap">`)
- 2 CTAs : (a) `<Button variant="primary">Refaire mon dossier</Button>` → POST `/v1/seller/kyc/restart` (NEW endpoint Story 2.5) → reset `kyc_status='pending_review'` + `kyc_decision_*` cleared + `tukio_status='pending_admin_review'` + Keycloak sync revert + outbox publish `identity.pro.kyc-restart-requested.v1` → frontend force-refresh JWT (Story 1.6 utility) → redirect `/seller/onboarding/kyc` (re-uploads via Story 1.8 self-service profile MVP support@tukio.one fallback — Story 2.5 livre uniquement le restart endpoint, le re-upload UX complet est Story 1.8 V1+) ; (b) lien `<Link>` "Contacter le support" → `mailto:support@tukio.one?subject=Reprise dossier {proProfileId}`
- Middleware `apps/seller/src/middleware.ts` UPDATE Story 2.5 : ajouter règle `if (jwt.tukio_status === 'rejected') redirect('/seller/onboarding/rejected')` (sauf whitelist `/seller/onboarding/rejected`, `/seller/help`, `/seller/profile/edit`)

**NFR48 SLA Prometheus alert** : NEW alerting rule `infra/k8s/prometheus-rules/identity-kyc-sla.yaml` (Story 2.5) :
```yaml
- alert: KYCSLABreach
  expr: tukio_pro_pending_admin_review_age_hours_max > 24
  for: 5m
  labels: { severity: warning, team: ops }
  annotations:
    summary: "{{ $value }} h — Pro pending_admin_review > 24h SLA breach"
    runbook: "https://wiki.tukio.one/runbook/kyc-sla-breach"
```
Avec métrique source `tukio_pro_pending_admin_review_age_hours_max` (gauge — exposé par identity-svc cron `/internal/metrics/scrape-pending-pros.task.ts` toutes 5 min, query DB MAX(EXTRACT(EPOCH FROM NOW()-created_at)/3600) WHERE kyc_status IN (pending_review, under_review))
+ Slack webhook integration (Doppler `SLACK_ALERTS_OPS_WEBHOOK`) → channel `#tukio-alerts-ops`,

**so that** Léa (admin-modo persona) prend la décision finale en < 1 min sur la page detail Story 2.4 (déjà examiné le dossier) avec UI claire + structurée + audit trail complet ; le Pro reçoit un email transactionnel (Story 5.4 future) + voit immédiatement la décision dans son wizard onboarding (Story 2.2 page kyc state) ; le **pattern complet "admin decision workflow with structured rejection + audit + Keycloak sync + state machine transitions"** devient template Stories 6.5 (account suspension/ban graduée), Story 6.4 (signalements decision), Story 10.x V1 (dispute decision admin) ; et Stories Epic 2 finalisées (2.6 1ère fiche post-validation, 2.7 audit trail UI, 2.8 auto-rejection 30j) consument les events `identity.pro.verified.v1` / `identity.pro.rejected.v1`.

> **Outcome attendu** : à la fin de cette story, Léa (admin-modo) sur `/fr/verifications/{proId}` Story 2.4 voit les 2 CTAs Valider/Rejeter (RBAC OK), click "Valider" → modale confirmation "Confirmer la validation du dossier de Marc Loueur SARL ?" → click Confirmer → POST `/v1/admin/verifications/{proId}/accept` → identity-svc `AcceptVerificationUseCase` exécute en transaction (DB update + outbox event) en < 200ms → 200 → toast "Dossier validé ✓" + page re-render avec badge "Approuvé" + timeline updates avec action `admin.verification.accepted` ; côté DB, `pro_profiles.kyc_status='approved'`, `kyc_decision_at=NOW()`, `kyc_decision_by={leaAdminId}` ; côté NATS, `identity.pro.verified.v1` published consumed par audit_log INSERT (Story 1.10) ; côté Pro fictif `marc@loueur.fr` qui aurait son tab seller ouvert sur `/seller/onboarding/kyc`, polling auto-refetch `/v1/me` → kyc_status='approved' → auto-redirect step 4 `/seller/onboarding/first-listing` (Story 2.2 page-level effect) ; sur un autre Pro Léa click "Rejeter" → modale `<Select>` "SIRET invalide" + `<Textarea>` "Le SIRET fourni n'est pas reconnu actif au registre INSEE. Vérifiez votre numéro et resoumettez votre dossier avec le bon SIRET." → click Confirmer → POST reject → 200 → toast + re-render rejected badge ; côté Pro, `userProfile.tukio_status='rejected'` + Keycloak claim sync → Pro qui se connecte → middleware redirect `/fr/seller/onboarding/rejected` → render error EmptyState avec raison + message + CTA "Refaire mon dossier" ; click Refaire → POST `/v1/seller/kyc/restart` → reset kyc_status='pending_review' + tukio_status='pending_admin_review' + force-refresh JWT → Pro back to `/seller/onboarding/profile` ; un admin-support qui essaie POST accept directement (curl bypass UI) → 403 RBAC `RolesGuard` (`admin-modo` minimum requis) ; un admin-modo qui double-click "Valider" sur un Pro déjà `approved` (race condition) → 2e POST → 409 `IDENTITY-CONFLICT-004` "Pro déjà décidé" (idempotence applicative DB-level) ; un admin-modo qui submit reject avec message=15 chars → 422 `IDENTITY-VALIDATION-005` inline form error "Message ≥ 20 caractères requis" ; un cron Prometheus détecte un Pro pending depuis 25h → alert KYCSLABreach → Slack `#tukio-alerts-ops` "1h — Pro pending_admin_review > 24h SLA breach" ; un test `pnpm playwright test --grep "admin verification accept reject"` passe FR/EN axe-core 0 violations 12 scénarios (happy path approve FR/EN, happy path reject avec 6 reasonCodes × 2 locales = 12 sous-cas, RBAC admin-support 403 sur accept, double-click 409, message < 20 chars 422, message > 2000 chars 422, kyc déjà rejected 409 sur 2nd accept, Keycloak sync fail → DB committed + drift event published, Pro rejected page render avec raison FR + EN, restart endpoint reset state, middleware seller redirect rejected, Prometheus alert SLA fired in fixture > 24h pending) ; coverage ≥ 90 % use cases + 80 % gateway + 80 % frontend.

## Acceptance Criteria

1. **AC1 — gateway-api endpoints `POST /v1/admin/verifications/:proProfileId/accept` + `/reject`** : Given gateway-api Stories 1.2/2.3/2.4, When un admin-modo+ authentifié appelle, Then :
   - **Endpoints** :
     ```ts
     @Controller('/v1/admin/verifications')
     export class AdminVerificationsController {
       @Post('/:proProfileId/accept')
       @UseGuards(KeycloakJwtGuard, RolesGuard)
       @Roles('admin-modo', 'admin-super') // admin-support 403
       @HttpCode(200)
       async accept(
         @Param('proProfileId', ParseUUIDPipe) proProfileId: string,
         @CurrentActor() actor: Actor,
       ): Promise<AcceptVerificationResponse> {
         return this.adminAcceptVerificationForwarder.getInstance().accept({ proProfileId, actor });
       }

       @Post('/:proProfileId/reject')
       @UseGuards(KeycloakJwtGuard, RolesGuard)
       @Roles('admin-modo', 'admin-super')
       @HttpCode(200)
       async reject(
         @Param('proProfileId', ParseUUIDPipe) proProfileId: string,
         @Body() body: RejectVerificationInput,
         @CurrentActor() actor: Actor,
       ): Promise<RejectVerificationResponse> {
         return this.adminRejectVerificationForwarder.getInstance().reject({ proProfileId, body, actor });
       }
     }
     ```
   - **Validation Zod** :
     - `RejectVerificationInputSchema` :
       ```ts
       z.object({
         reasonCode: z.enum(['siret_invalid', 'kyc_doc_unreadable', 'kyc_doc_missing', 'company_not_found_insee', 'duplicate_siret', 'other']),
         message: z.string().trim().min(20, 'Message ≥ 20 chars').max(2000, 'Message ≤ 2000 chars'),
       });
       ```
     - `accept` : pas de body, juste UUID param
   - **Forwarder** appelle identity-svc `POST /internal/admin/verifications/:proProfileId/accept` (resp. `/reject`) avec `X-Actor-Id`/`X-Actor-Role`/`X-Actor-Name` headers + `X-Internal-Service-Token`
   - **Throttle** : 30/min/user (anti-mass-action — admin réfléchi, pas spam)
   - **Errors mapping** :
     - 403 RolesGuard si admin-support → `IDENTITY-FORBIDDEN-001`
     - 404 ProProfile inexistant → `IDENTITY-NOT-FOUND-002`
     - 409 `kyc_status ∈ {approved, rejected}` (déjà décidé) → `IDENTITY-CONFLICT-004` "Pro déjà décidé"
     - 422 reasonCode invalide / message < 20 / > 2000 → `IDENTITY-VALIDATION-005`
   - **Tests E2E** : 6 scénarios — happy approve admin-modo → 200, happy reject avec 1 reasonCode → 200, admin-support → 403, déjà approved → 409, message 15 chars → 422, ProProfile inexistant → 404.

2. **AC2 — identity-svc `AcceptVerificationUseCase` + `RejectVerificationUseCase` + `RestartKycUseCase`** : Given Pretre architecture, When je consulte `apps/identity-svc/src/usecases/`, Then :
   - **NEW use case** `accept-verification.usecase.ts` :
     ```ts
     @Injectable()
     export class AcceptVerificationUseCase {
       constructor(
         @Inject(PRO_PROFILE_REPO) private readonly proProfileRepo: IProProfileRepository,
         @Inject(USER_PROFILE_REPO) private readonly userProfileRepo: IUserProfileRepository,
         @Inject(EVENT_PUBLISHER) private readonly eventPublisher: IEventPublisher,
         @Inject(TRANSACTION_MANAGER) private readonly txnManager: ITransactionManager,
         @Inject(LOGGER) private readonly logger: ILogger,
       ) {}

       async execute(input: { proProfileId: string; actor: { adminId: string; adminRole: 'admin-modo' | 'admin-super'; adminName: string }; correlationId: string }): Promise<{ proProfileId: string; kycStatus: 'approved'; kycDecisionAt: string; kycDecisionBy: string }> {
         return this.txnManager.runInTransaction(async (txn) => {
           const proProfile = await txn.proProfileRepo.findById(input.proProfileId);
           if (!proProfile) throw new ProProfileNotFoundError(input.proProfileId);

           // Domain method — invariant: kyc_status ∈ {pending_review, under_review} else KycStatusInvalidTransitionError
           proProfile.approveKyc(input.actor.adminId);

           await txn.proProfileRepo.save(proProfile);

           const userProfile = await txn.userProfileRepo.findById(proProfile.userProfileId);
           // NB: userProfile.tukio_status NOT changed here. Final transition to 'active' is in Story 2.2 CompleteOnboardingUseCase

           await txn.eventPublisher.publish({
             eventType: 'identity.pro.verified',
             eventVersion: 'v1',
             aggregate: { type: 'ProProfile', id: proProfile.id },
             actor: { userId: input.actor.adminId, role: input.actor.adminRole },
             correlationId: input.correlationId,
             payload: {
               proProfileId: proProfile.id,
               userProfileId: proProfile.userProfileId,
               userEmail: userProfile.email,
               userLocale: userProfile.locale,
               companyName: proProfile.companyName,
               kycDecisionAt: proProfile.kycDecisionAt!.toISOString(),
               kycDecisionBy: input.actor.adminId,
               kycDecisionByName: input.actor.adminName,
             },
             occurredAt: new Date(),
           });

           return {
             proProfileId: proProfile.id,
             kycStatus: 'approved' as const,
             kycDecisionAt: proProfile.kycDecisionAt!.toISOString(),
             kycDecisionBy: input.actor.adminId,
           };
         });
       }
     }
     ```
   - **NEW use case** `reject-verification.usecase.ts` :
     ```ts
     @Injectable()
     export class RejectVerificationUseCase {
       constructor(
         @Inject(PRO_PROFILE_REPO) private readonly proProfileRepo: IProProfileRepository,
         @Inject(USER_PROFILE_REPO) private readonly userProfileRepo: IUserProfileRepository,
         @Inject(KEYCLOAK_CLIENT) private readonly keycloak: IKeycloakClient,
         @Inject(EVENT_PUBLISHER) private readonly eventPublisher: IEventPublisher,
         @Inject(TRANSACTION_MANAGER) private readonly txnManager: ITransactionManager,
         @Inject(LOGGER) private readonly logger: ILogger,
       ) {}

       async execute(input: { proProfileId: string; reasonCode: KycRejectionReasonCode; message: string; actor: { adminId: string; adminRole: 'admin-modo' | 'admin-super'; adminName: string }; correlationId: string }): Promise<RejectVerificationOutput> {
         return this.txnManager.runInTransaction(async (txn) => {
           const proProfile = await txn.proProfileRepo.findById(input.proProfileId);
           if (!proProfile) throw new ProProfileNotFoundError(input.proProfileId);

           const userProfile = await txn.userProfileRepo.findById(proProfile.userProfileId);

           // Domain methods — invariants throw if invalid
           proProfile.rejectKyc(input.actor.adminId, input.reasonCode, input.message);
           userProfile.changeTukioStatus('rejected'); // Story 2.2 method extends — allowed transition: pending_admin_review → rejected

           await txn.proProfileRepo.save(proProfile);
           await txn.userProfileRepo.save(userProfile);

           // Keycloak sync — best-effort. If fails, drift event published, reconciliation cron Story 1.10 fixes
           try {
             await this.keycloak.updateUserAttribute(userProfile.keycloakUserId, 'tukio_status', 'rejected');
           } catch (err) {
             this.logger.warn({ err, userProfileId: userProfile.id }, 'Keycloak sync failed during reject — drift event published');
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
             eventType: 'identity.pro.rejected',
             eventVersion: 'v1',
             aggregate: { type: 'ProProfile', id: proProfile.id },
             actor: { userId: input.actor.adminId, role: input.actor.adminRole },
             correlationId: input.correlationId,
             payload: {
               proProfileId: proProfile.id,
               userProfileId: proProfile.userProfileId,
               userEmail: userProfile.email,
               userLocale: userProfile.locale,
               companyName: proProfile.companyName,
               kycDecisionAt: proProfile.kycDecisionAt!.toISOString(),
               kycDecisionBy: input.actor.adminId,
               kycDecisionByName: input.actor.adminName,
               reasonCode: input.reasonCode,
               message: input.message,
             },
             occurredAt: new Date(),
           });

           return {
             proProfileId: proProfile.id,
             kycStatus: 'rejected' as const,
             kycDecisionAt: proProfile.kycDecisionAt!.toISOString(),
             kycDecisionBy: input.actor.adminId,
             reasonCode: input.reasonCode,
             message: input.message,
           };
         });
       }
     }
     ```
   - **NEW use case** `restart-kyc.usecase.ts` (consumed by `POST /v1/seller/kyc/restart`) :
     - Invariant : current `kyc_status === 'rejected'` (sinon `KycStatusInvalidTransitionError` 409)
     - Reset : `kyc_status = 'pending_review'`, `kyc_decision_at = NULL`, `kyc_decision_by = NULL`, `kyc_decision_reason_code = NULL`, `kyc_decision_message = NULL`
     - Transition `userProfile.changeTukioStatus('pending_admin_review')` (allowed: rejected → pending_admin_review)
     - Keycloak sync `tukio:status='pending_admin_review'`
     - Outbox publish `identity.pro.kyc-restart-requested.v1` (NEW event Story 2.5 — payload `{ proProfileId, userProfileId, restartedAt }`) — consumed Story 5.4 future email "Dossier réouvert" + Story 2.3 admin queue re-fetch
     - **NB MVP** : ce use case **ne re-cleanup PAS les KYC docs R2** (les anciens docs restent — Story 1.8 V1+ fournira UI re-upload). Pro contacte support pour update docs si nécessaire MVP.
   - Tests unit ≥ 90 % chaque use case (happy + invariant errors + Keycloak fail drift)

3. **AC3 — Domain methods `ProProfile.approveKyc` + `rejectKyc` + `restartKyc` + `UserProfile.changeTukioStatus` extended** : Given Story 1.3 sketched + Story 2.2 added `changeTukioStatus`, When je consulte `apps/identity-svc/src/domain/model/`, Then :
   - **`pro-profile.aggregate.ts` UPDATE** Story 2.5 :
     ```ts
     export class ProProfile {
       // ... Story 1.3 fields + Story 2.1 stripeFields + Story 2.4 inseeSnapshot

       approveKyc(adminId: string): void {
         if (!this.canTransitionKycTo('approved')) {
           throw new KycStatusInvalidTransitionError({ from: this.kycStatus, to: 'approved', proProfileId: this.id });
         }
         this.kycStatus = 'approved';
         this.kycDecisionAt = new Date();
         this.kycDecisionBy = adminId;
         this.kycDecisionReasonCode = null;
         this.kycDecisionMessage = null;
         this.touch(); // updatedAt
       }

       rejectKyc(adminId: string, reasonCode: KycRejectionReasonCode, message: string): void {
         if (!this.canTransitionKycTo('rejected')) {
           throw new KycStatusInvalidTransitionError({ from: this.kycStatus, to: 'rejected', proProfileId: this.id });
         }
         if (!KYC_REJECTION_REASON_CODES.includes(reasonCode)) {
           throw new KycRejectionInvalidError({ field: 'reasonCode', value: reasonCode });
         }
         if (message.trim().length < 20 || message.length > 2000) {
           throw new KycRejectionInvalidError({ field: 'message', value: `length=${message.length}` });
         }
         this.kycStatus = 'rejected';
         this.kycDecisionAt = new Date();
         this.kycDecisionBy = adminId;
         this.kycDecisionReasonCode = reasonCode;
         this.kycDecisionMessage = message.trim();
         this.touch();
       }

       restartKyc(): void {
         if (this.kycStatus !== 'rejected') {
           throw new KycStatusInvalidTransitionError({ from: this.kycStatus, to: 'pending_review', proProfileId: this.id });
         }
         this.kycStatus = 'pending_review';
         this.kycDecisionAt = null;
         this.kycDecisionBy = null;
         this.kycDecisionReasonCode = null;
         this.kycDecisionMessage = null;
         this.touch();
       }

       markUnderReview(adminId: string): void {
         // Story 2.4 hook: when first admin opens detail, transition pending_review → under_review (semaphore that someone is reviewing)
         // Note: Story 2.4 does NOT call this (chose to keep pending_review until decision). Reserved for V1+ if multi-admin races become an issue.
         if (this.kycStatus !== 'pending_review') return; // idempotent
         this.kycStatus = 'under_review';
         this.touch();
       }

       private canTransitionKycTo(target: KycStatus): boolean {
         const allowed: Record<KycStatus, KycStatus[]> = {
           pending_review: ['under_review', 'approved', 'rejected'],
           under_review: ['approved', 'rejected'],
           approved: [], // final
           rejected: ['pending_review'], // restart
         };
         return allowed[this.kycStatus]?.includes(target) ?? false;
       }
     }

     export const KYC_REJECTION_REASON_CODES = ['siret_invalid', 'kyc_doc_unreadable', 'kyc_doc_missing', 'company_not_found_insee', 'duplicate_siret', 'other'] as const;
     export type KycRejectionReasonCode = typeof KYC_REJECTION_REASON_CODES[number];
     export type KycStatus = 'pending_review' | 'under_review' | 'approved' | 'rejected';
     ```
   - **`user-profile.aggregate.ts` UPDATE** Story 2.5 — `changeTukioStatus` allowed transitions extended :
     ```ts
     private canTransitionTukioStatusTo(target: TukioStatus): boolean {
       const allowed: Record<TukioStatus, TukioStatus[]> = {
         pending_admin_review: ['active', 'rejected', 'suspended'], // active = Story 2.2 onboarding complete
         active: ['suspended'],
         rejected: ['pending_admin_review'], // KYC restart Story 2.5
         suspended: ['active'], // unsuspend admin
       };
       return allowed[this.tukioStatus]?.includes(target) ?? false;
     }
     ```
   - **NEW domain exceptions** `apps/identity-svc/src/domain/exception/` :
     - `kyc-status-invalid-transition.error.ts` (with `from`, `to`, `proProfileId` context)
     - `kyc-rejection-invalid.error.ts` (with `field`, `value` context)
   - **NEW value object** `apps/identity-svc/src/domain/model/value-objects/kyc-rejection-reason-code.value-object.ts` (frozen array + type)
   - Tests unit aggregate : 12 cases (each transition allowed/forbidden + invariants reasonCode + message length)

4. **AC4 — DB migration + repository updates** : Given Story 1.3 baseline + Story 2.4 inseeSnapshot, When je consulte `apps/identity-svc/src/infrastructure/persistence/typeorm/migrations/`, Then :
   - **NEW migration** `1715291000000-RenameKycDecisionReasonAndAddMessage.ts` :
     ```sql
     -- Rename existing column for clarity (Story 1.3 had single text field)
     ALTER TABLE pro_profiles RENAME COLUMN kyc_decision_reason TO kyc_decision_reason_code;
     -- Coerce existing data: legacy free-text values would now violate enum check, but no production data yet (dev stage)
     -- If any legacy row has non-NULL kyc_decision_reason_code, set to 'other' as safe fallback (impossible in dev fresh DB)
     UPDATE pro_profiles SET kyc_decision_reason_code = 'other' WHERE kyc_decision_reason_code IS NOT NULL AND kyc_decision_reason_code NOT IN ('siret_invalid', 'kyc_doc_unreadable', 'kyc_doc_missing', 'company_not_found_insee', 'duplicate_siret', 'other');
     ALTER TABLE pro_profiles ADD CONSTRAINT pro_profiles_kyc_decision_reason_code_check CHECK (kyc_decision_reason_code IS NULL OR kyc_decision_reason_code IN ('siret_invalid', 'kyc_doc_unreadable', 'kyc_doc_missing', 'company_not_found_insee', 'duplicate_siret', 'other'));
     ALTER TABLE pro_profiles ADD COLUMN kyc_decision_message TEXT NULL;
     ALTER TABLE pro_profiles ADD CONSTRAINT pro_profiles_kyc_decision_message_length CHECK (kyc_decision_message IS NULL OR (LENGTH(TRIM(kyc_decision_message)) BETWEEN 20 AND 2000));
     ```
   - **`down()` migration** : reverse — drop checks + drop column + rename back (testable cohérent Story 0.6 migration discipline)
   - **`ProProfileEntity` UPDATE** Story 2.5 : ajouter `kycDecisionReasonCode: KycRejectionReasonCode | null`, `kycDecisionMessage: string | null`. Renommer ancien `kycDecisionReason` mapping
   - **`ProProfileTypeOrmRepository` UPDATE** : `findById` retourne entity mappée → aggregate avec nouveaux fields. `save` persiste tous les fields (pas de partial)
   - Tests integration repository : INSERT row avec kyc_decision_reason_code='other' + message=valid 50 chars → OK. Tentative INSERT message=15 chars → DB constraint violation (defense in depth). Update existing row pending_review → approved + verify other fields cleared.

5. **AC5 — payment-svc & seller-side endpoints** : Given Stories 1.x/2.x existantes, When :
   - **NEW gateway-api endpoint** `POST /v1/seller/kyc/restart` :
     ```ts
     @Post('/v1/seller/kyc/restart')
     @UseGuards(KeycloakJwtGuard, RolesGuard)
     @Roles('pro') // any pro can restart their own
     @HttpCode(200)
     async restartKyc(@CurrentActor() actor: Actor): Promise<RestartKycResponse> {
       return this.sellerKycRestartForwarder.getInstance().restart({ userProfileId: actor.userId });
     }
     ```
   - **Forwarder flow** :
     1. Fetch ProProfile via identity-svc internal `GET /internal/pros/by-user-id/:userId` (Story 1.x exists)
     2. Call identity-svc `POST /internal/pros/:proProfileId/restart-kyc` (NEW) → `RestartKycUseCase`
     3. Return success + new tukio_status pour permettre frontend force-refresh JWT
   - **Throttle** : 3/hour/user (anti-abuse — pro ne devrait restart que si admin a rejeté)
   - **Errors** :
     - 409 si current kyc_status ≠ 'rejected' → `IDENTITY-CONFLICT-005` "Cannot restart unless rejected"
     - 404 si proProfile inexistant pour ce userId

6. **AC6 — Frontend admin : `<ApproveModal>` + `<RejectModal>` + 2 boutons + intégration Story 2.4 placeholder** : Given Story 2.4 a livré le placeholder `data-test="actions-zone"`, When Story 2.5 ajoute, Then :
   - **NEW component** `apps/admin/src/features/admin/verifications/components/ActionsZone.tsx` :
     - Affiche `<Alert>` final si `kycStatus ∈ {approved, rejected}` (cf. story body ci-dessus)
     - Sinon affiche 2 boutons + RBAC handling
   - **NEW component** `apps/admin/src/features/admin/verifications/components/ApproveModal.tsx` :
     - `<Modal>` Story 0.4 atomic (ou pattern @tukio/ui si existing)
     - Title : "Confirmer la validation"
     - Body : "Êtes-vous sûr de valider le dossier de **{companyName}** ? Cette action est définitive."
     - Footer : `<Button variant="ghost">Annuler</Button>` + `<Button variant="primary" onClick={confirmApprove}>Confirmer la validation</Button>`
     - Loading state pendant mutation : button disabled + `<Spinner>`
     - Focus trap + Esc to close + click outside to close
   - **NEW component** `RejectModal.tsx` :
     - Title : "Rejeter le dossier"
     - Form fields :
       - `<Select required label="Motif du rejet">` 6 options (i18n keys `admin.verifications.detail.rejectReasons.{code}`)
       - `<Textarea required label="Message au Pro" minLength={20} maxLength={2000}>` avec live counter `{currentLength} / 20-2000` + helper "Ce message sera envoyé au Pro par email + visible dans son espace"
     - Validation Zod côté frontend (mirror backend AC1) — submit disabled si invalid
     - Footer : 2 CTAs (Annuler ghost + Rejeter danger disabled tant que form invalide)
     - Sur submit : mutation `useRejectVerification` → toast succès "Dossier rejeté" + invalidate detail query
   - **NEW hooks** `packages/api-client/src/hooks/admin/` :
     - `use-accept-verification.ts` : `useMutation` → invalide `['admin', 'verification', proProfileId]` + `['admin', 'verifications', 'queue']` (Story 2.3) + toast Sonner
     - `use-reject-verification.ts` : idem
   - **i18n** : étendre namespace `admin.verifications.detail.*` + nouveau `admin.verifications.detail.rejectReasons.{siret_invalid|...|other}` (6 keys × 2 locales = 12)
   - **Accessibility RGAA AA** : modales focus trap + role="dialog" + aria-modal + aria-labelledby + initial focus on Confirm button (or first form field for reject) + Esc to close + body scroll lock
   - **Tests E2E** : (cf. AC9)

7. **AC7 — Frontend seller : page `/seller/onboarding/rejected/page.tsx` + middleware update + restart flow** : Given Story 2.2 wizard, When un Pro `tukio_status='rejected'` se connecte, Then :
   - **NEW page** `apps/seller/src/app/[locale]/seller/onboarding/rejected/page.tsx` (Server Component) :
     ```tsx
     export default async function RejectedPage({ params }: { params: { locale: string } }) {
       const me = await fetchMe(); // /v1/me — includes kycDecisionReasonCode + kycDecisionMessage for own pro profile (Story 1.8 extended Story 2.5)
       const t = await getTranslations('seller.onboarding.rejected');

       return (
         <EmptyState variant="error" icon={<AlertCircleIcon />}>
           <h1>{t('title')}</h1>
           <Alert variant="error" title={t(`reasons.${me.prosFields.kycDecisionReasonCode}`)}>
             <pre className="whitespace-pre-wrap font-sans">{me.prosFields.kycDecisionMessage}</pre>
             <p className="text-sm text-muted">
               {t('decisionMeta', { date: formatDate(me.prosFields.kycDecisionAt, params.locale) })}
             </p>
           </Alert>
           <div className="flex gap-3">
             <RestartKycButton />
             <Link href="mailto:support@tukio.one?subject=Reprise%20dossier" className="btn-ghost">{t('contactSupport')}</Link>
           </div>
         </EmptyState>
       );
     }
     ```
   - **NEW client component** `RestartKycButton.tsx` :
     - `<Button onClick={handleRestart}>Refaire mon dossier</Button>`
     - On click → `useRestartKyc` mutation → POST `/v1/seller/kyc/restart` → on success force-refresh JWT (`refreshAccessToken()` Story 1.6 utility) → `router.push('/seller/onboarding/profile')`
     - Loading state Spinner
   - **UPDATE middleware** `apps/seller/src/middleware.ts` Story 2.2 — extend pending_admin_review redirect logic :
     ```ts
     // After existing pending_admin_review block (Story 2.2):
     if (jwt.tukio_status === 'rejected') {
       const ALLOWED_REJECTED = ['/seller/onboarding/rejected', '/seller/help', '/seller/profile/edit'];
       const isAllowed = ALLOWED_REJECTED.some(p => request.pathname.startsWith(`/${locale}${p}`));
       if (!isAllowed) {
         return NextResponse.redirect(new URL(`/${locale}/seller/onboarding/rejected`, request.url));
       }
     }
     ```
   - **i18n** namespace `seller.onboarding.rejected.*` (~10 keys × 2 locales = 20) :
     - `title` : "Votre dossier n'a pas été validé" / "Your application was not approved"
     - `reasons.siret_invalid` : "SIRET invalide" / "Invalid SIRET"
     - `reasons.kyc_doc_unreadable` : "Document KYC illisible" / "KYC document unreadable"
     - `reasons.kyc_doc_missing` : "Document KYC manquant" / "Missing KYC document"
     - `reasons.company_not_found_insee` : "Société introuvable au registre INSEE" / "Company not found in INSEE registry"
     - `reasons.duplicate_siret` : "SIRET déjà utilisé sur Tukio" / "SIRET already in use on Tukio"
     - `reasons.other` : "Autre" / "Other"
     - `decisionMeta` : "Décision rendue le {date}" / "Decision made on {date}"
     - `contactSupport` : "Contacter le support" / "Contact support"
     - `restartCta` : "Refaire mon dossier" / "Restart my application"
   - **Story 1.8 UPDATE** Story 2.5 minor : `/v1/me` response Pro shape ajoute `kycDecisionReasonCode`, `kycDecisionMessage`, `kycDecisionAt`. Si `kyc_status !== 'rejected'`, ces fields sont absents (pas exposés Pro tant que rejected).
   - Tests E2E : (cf. AC9)

8. **AC8 — NATS event schemas + DTOs `@tukio/contracts`** : Given AC1-2, When je consulte `packages/contracts/src/`, Then :
   - **NEW event schemas** `events/identity/`  (cohérents Story 0.2 envelope) :
     - `pro-verified.v1.{schema.json,ts}` — payload `{ proProfileId, userProfileId, userEmail, userLocale, companyName, kycDecisionAt, kycDecisionBy, kycDecisionByName }`
     - `pro-rejected.v1.{schema.json,ts}` — payload `{ proProfileId, userProfileId, userEmail, userLocale, companyName, kycDecisionAt, kycDecisionBy, kycDecisionByName, reasonCode, message }`
     - `pro-kyc-restart-requested.v1.{schema.json,ts}` — payload `{ proProfileId, userProfileId, userEmail, userLocale, restartedAt }`
     - `keycloak-sync-failed.v1.{schema.json,ts}` — payload `{ userProfileId, attribute, expectedValue, failedAt }` (drift event)
   - **NEW DTOs** `dtos/admin/`  :
     - `accept-verification.dto.ts` — `AcceptVerificationResponse` schema
     - `reject-verification.dto.ts` — `RejectVerificationInputSchema` (Zod) + `RejectVerificationResponse` + `KycRejectionReasonCodeEnum` (single source of truth — re-utilisé frontend `<Select>` + backend Zod)
     - `restart-kyc.dto.ts` — `RestartKycResponse`
   - **Test schemas** : ajv validate happy + edge cases (message exact 20 / 2000 chars, reasonCode enum strict)

9. **AC9 — Tests Playwright e2e + axe-core + perf** : 14 tests dans 2 files :
   - **`apps/admin/e2e/verifications/accept-reject.spec.ts`** (8 tests) :
     - Test 1 (happy approve admin-modo FR) : login → naviguer detail → click Valider → modale → Confirmer → 200 → toast + badge approved + history timeline updated → vérifier event `identity.pro.verified.v1` published (test consumer NATS) + audit_log INSERT
     - Test 2 (happy approve EN) : idem `/en/`
     - Test 3 (happy reject admin-modo FR avec reasonCode='siret_invalid') : modale select + textarea 50 chars → 200 → toast + rejected badge → vérifier event + audit_log + Keycloak claim updated (testcontainer assertion)
     - Test 4 (RBAC admin-support 403) : login admin-support → boutons disabled tooltip + curl POST → 403
     - Test 5 (double-click race condition) : click Valider 2x rapide → 1ʳᵉ POST 200 + 2ᵉ POST 409 + toast erreur "Pro déjà décidé"
     - Test 6 (validation message < 20 chars) : modale reject + textarea 15 chars → submit disabled + inline error + force submit (curl) → 422
     - Test 7 (Keycloak sync fail simulation) : mock Keycloak 503 → POST reject → DB committed + drift event published + UI shows success (best-effort) + Slack alert async (assertion via Slack webhook mock)
     - Test 8 (déjà rejected → 2nd accept) : fixture Pro rejected → POST accept → 409 (transition forbidden)
   - **`apps/seller/e2e/onboarding/rejected.spec.ts`** (6 tests) :
     - Test 9 (rejected page render FR) : Pro fixture `tukio_status='rejected'` + reasonCode='kyc_doc_unreadable' + message → login → middleware redirect `/fr/seller/onboarding/rejected` → vérifier title + reason traduit + message rendered avec preserved newlines
     - Test 10 (rejected page render EN) : idem `/en/`
     - Test 11 (restart flow happy) : click "Refaire mon dossier" → POST restart → 200 → JWT refresh → redirect `/seller/onboarding/profile` → Pro state: tukio_status='pending_admin_review' + kyc_status='pending_review' + decision fields cleared
     - Test 12 (middleware redirect rejected) : Pro rejected navigue `/seller/dashboard` → middleware redirect `/seller/onboarding/rejected`. Pro rejected navigue `/seller/help` → autorisé (whitelist)
     - Test 13 (restart 2nd time blocked if not rejected) : Pro `tukio_status='pending_admin_review'` → curl POST `/v1/seller/kyc/restart` → 409 `IDENTITY-CONFLICT-005`
     - Test 14 (i18n reasons all 6 codes) : 6 fixtures (1 par reasonCode) → render page → vérifier traduction FR + EN OK
   - **Test axe-core** : 0 violations sur (a) `<ApproveModal>` open, (b) `<RejectModal>` open avec form invalid + valid states, (c) `/seller/onboarding/rejected` page
   - **Test perf** : POST accept p90 < 300ms (single transaction). POST reject p90 < 500ms (Keycloak sync + 2 events). Page rejected load p90 < 800ms.
   - **Test Prometheus alert SLA** (1 test) : insert fixture Pro pending_admin_review depuis 25h → wait 6 min (cron tick + alert evaluation) → vérifier Slack webhook called avec body matching alert template
   - Coverage ≥ 90 % use cases + 80 % gateway + 80 % frontend

10. **AC10 — Prometheus alert NFR48 SLA + métriques + runbook** :
    - **NEW Prometheus rule** `infra/k8s/prometheus-rules/identity-kyc-sla.yaml` (cf. story body)
    - **NEW Prometheus metric source** `apps/identity-svc/src/infrastructure/tasks/scrape-pending-pros.task.ts` (NEW — `@nestjs/schedule` toutes 5 min — pattern Story 1.9 réutilisé) :
      ```ts
      @Cron('*/5 * * * *')
      async scrape(): Promise<void> {
        const result = await this.proProfileRepo.maxAgeOfPendingHours(); // SQL: SELECT EXTRACT(EPOCH FROM NOW() - MIN(created_at))/3600 AS max_hours FROM pro_profiles WHERE kyc_status IN ('pending_review', 'under_review') AND deleted_at IS NULL
        this.metricsRegistry.gauge('tukio_pro_pending_admin_review_age_hours_max').set(result?.max_hours ?? 0);
        this.metricsRegistry.gauge('tukio_pro_pending_admin_review_count').set(result?.count ?? 0);
      }
      ```
    - **Métriques Prom additionnelles** :
      - `tukio_admin_verification_decisions_total{decision, reason_code}` (counter — split approved vs rejected × 7 reasonCodes incl. NULL)
      - `tukio_admin_verification_decision_duration_seconds` (histogram — use case execution latency)
      - `tukio_keycloak_sync_failures_total{attribute}` (counter — alert > 5/hour)
      - `tukio_pro_kyc_restart_total` (counter)
    - **Dashboard Grafana** `infra/k8s/grafana-dashboards/admin-kyc-decisions.json` (NEW ~5 panels) : decisions/day approved vs rejected, reasonCodes top 5, SLA gauge max age, Keycloak sync failure rate, restart rate
    - **Runbook** `docs/runbook/admin-kyc-accept-reject-debug.md` (NEW ~60 lignes) : flow + troubleshooting (race condition 409 debug, Keycloak sync drift fix via reconciliation Story 1.10, restart endpoint abuse rate-limit tuning, SLA alert false-positives, message length validation discipline, audit_log immutability test, i18n keys missing)
    - **Slack alert routing** : Doppler `SLACK_ALERTS_OPS_WEBHOOK` envoie sur `#tukio-alerts-ops` (cohérent Story 1.10 `#tukio-alerts`)

## Tasks / Subtasks

- [ ] **Task 1 — `@tukio/contracts` event schemas + DTOs + Zod** (AC: #8)
  - [ ] 1.1 — Event schema `identity/pro-verified.v1.{schema.json,ts}`
  - [ ] 1.2 — Event schema `identity/pro-rejected.v1.{schema.json,ts}`
  - [ ] 1.3 — Event schema `identity/pro-kyc-restart-requested.v1.{schema.json,ts}`
  - [ ] 1.4 — Event schema `identity/keycloak-sync-failed.v1.{schema.json,ts}`
  - [ ] 1.5 — DTOs `admin/{accept,reject,restart}.dto.ts` + KycRejectionReasonCodeEnum (single source of truth)
  - [ ] 1.6 — Tests ajv schema validation (8 cases : happy + edges)
- [ ] **Task 2 — identity-svc domain methods + value objects + exceptions** (AC: #3) — coverage ≥ 95 %
  - [ ] 2.1 — Update `ProProfile.aggregate.ts` : `approveKyc`, `rejectKyc`, `restartKyc`, `markUnderReview`, `canTransitionKycTo` private
  - [ ] 2.2 — Update `UserProfile.aggregate.ts` : `canTransitionTukioStatusTo` allows `pending_admin_review → rejected` + `rejected → pending_admin_review`
  - [ ] 2.3 — VO `KycRejectionReasonCode` frozen array + type
  - [ ] 2.4 — Exceptions `KycStatusInvalidTransitionError`, `KycRejectionInvalidError`, `KycRestartNotAllowedError`
  - [ ] 2.5 — Tests aggregate 12 cases (happy + invariants forbidden transitions + reasonCode enum + message length)
- [ ] **Task 3 — DB migration + entity + repository updates** (AC: #4)
  - [ ] 3.1 — Migration `1715291000000-RenameKycDecisionReasonAndAddMessage.ts` (rename + check + new col)
  - [ ] 3.2 — `ProProfileEntity` UPDATE `kycDecisionReasonCode` + `kycDecisionMessage`
  - [ ] 3.3 — `ProProfileTypeOrmRepository` UPDATE — `findById` mapping + `save` persist + `maxAgeOfPendingHours()` NEW method
  - [ ] 3.4 — Tests integration repo : INSERT/UPDATE happy + DB constraint violations defense in depth
- [ ] **Task 4 — `AcceptVerificationUseCase` + `RejectVerificationUseCase` + `RestartKycUseCase`** (AC: #2) — coverage ≥ 90 %
  - [ ] 4.1 — `AcceptVerificationUseCase` (transactional + outbox event)
  - [ ] 4.2 — `RejectVerificationUseCase` (transactional + Keycloak sync best-effort + 2 events)
  - [ ] 4.3 — `RestartKycUseCase` (transactional + Keycloak revert + event)
  - [ ] 4.4 — Tests unit happy + invariants 409 + Keycloak fail drift event
  - [ ] 4.5 — Wire usecases-proxy module + Symbol DI tokens
- [ ] **Task 5 — identity-svc internal controllers** (AC: #1, #2)
  - [ ] 5.1 — `POST /internal/admin/verifications/:proProfileId/accept`
  - [ ] 5.2 — `POST /internal/admin/verifications/:proProfileId/reject`
  - [ ] 5.3 — `POST /internal/pros/:proProfileId/restart-kyc`
  - [ ] 5.4 — `X-Internal-Service-Token` guard + `X-Actor-*` headers parsing
- [ ] **Task 6 — gateway-api 3 endpoints + forwarders** (AC: #1, #5)
  - [ ] 6.1 — `POST /v1/admin/verifications/:proProfileId/accept` + forwarder + RolesGuard admin-modo+
  - [ ] 6.2 — `POST /v1/admin/verifications/:proProfileId/reject` + forwarder + Zod validation body
  - [ ] 6.3 — `POST /v1/seller/kyc/restart` + forwarder + RolesGuard pro
  - [ ] 6.4 — Throttle 30/min admin actions, 3/hour seller restart
  - [ ] 6.5 — Tests E2E 6 scénarios gateway
- [ ] **Task 7 — Frontend admin : modales + ActionsZone + hooks** (AC: #6)
  - [ ] 7.1 — `useAcceptVerification` + `useRejectVerification` hooks (TanStack mutation + invalidation)
  - [ ] 7.2 — `<ApproveModal>` (focus trap, Esc, Spinner)
  - [ ] 7.3 — `<RejectModal>` (Select + Textarea + Zod live validation + counter)
  - [ ] 7.4 — `<ActionsZone>` integration in Story 2.4 placeholder
  - [ ] 7.5 — i18n `admin.verifications.detail.rejectReasons.*` 6 keys × 2 locales
  - [ ] 7.6 — Accessibility RGAA AA tests
- [ ] **Task 8 — Frontend seller : page rejected + middleware + restart hook** (AC: #7)
  - [ ] 8.1 — Page `apps/seller/src/app/[locale]/seller/onboarding/rejected/page.tsx` Server Component
  - [ ] 8.2 — Client component `RestartKycButton` + `useRestartKyc` hook
  - [ ] 8.3 — UPDATE `apps/seller/src/middleware.ts` — add rejected redirect rule + whitelist
  - [ ] 8.4 — UPDATE `apps/seller/src/messages/{fr,en}.json` namespace `seller.onboarding.rejected.*`
  - [ ] 8.5 — UPDATE Story 1.8 `/v1/me` response Pro shape — expose `kycDecisionReasonCode`, `kycDecisionMessage`, `kycDecisionAt` if rejected
- [ ] **Task 9 — Prometheus alert + cron metric scraper + Grafana dashboard** (AC: #10)
  - [ ] 9.1 — Cron `scrape-pending-pros.task.ts` toutes 5 min + repo method `maxAgeOfPendingHours`
  - [ ] 9.2 — Prometheus rule `identity-kyc-sla.yaml`
  - [ ] 9.3 — Métriques additionnelles (decisions counter, sync failures, restart, decision duration histogram)
  - [ ] 9.4 — Dashboard Grafana `admin-kyc-decisions.json` 5 panels
  - [ ] 9.5 — Slack webhook routing `SLACK_ALERTS_OPS_WEBHOOK` Doppler
- [ ] **Task 10 — Tests Playwright e2e + axe-core + perf + Prometheus alert test** (AC: #9) — 14 tests + coverage ≥ 80 %
- [ ] **Task 11 — Runbook + commit** (AC: #10)
  - [ ] 11.1 — Runbook `admin-kyc-accept-reject-debug.md`
  - [ ] 11.2 — Update Story 1.10 ADR-009 Implementation Notes section "KYC decision workflow Story 2.5"
  - [ ] 11.3 — Commit `feat(identity,admin,seller): Story 2.5 admin KYC accept/reject workflow + Pro restart flow + Prometheus SLA 24h alert + audit trail (identity.pro.verified.v1, identity.pro.rejected.v1)`

## Dev Notes

### Pourquoi Story 2.5 ferme la boucle Epic 2 KYC validation

Story 2.5 livre le **moment de la décision** — Léa user journey J5 click "Valider" en 30s décide du sort d'un Pro. C'est ici que les events `identity.pro.verified.v1` + `identity.pro.rejected.v1` sont publiés (consumed Story 2.2 wizard + Story 5.4 emails + Story 1.10 audit_log + Story 2.7 audit UI). Pattern **state machine transitions + structured rejection + Keycloak sync best-effort** réutilisé Stories 6.5 (account suspension/ban graduée), Story 6.4 (signalements decision validate/reject), Story 10.x V1 (dispute resolution admin), Story 12.x V1 (review moderation reject).

### Décisions techniques majeures actées

1. **`tukio_status` reste `pending_admin_review` après KYC approve** — final transition à `active` est dans Story 2.2 CompleteOnboardingUseCase (post-1ère-fiche). Évite ambiguïté : "Pro KYC validé mais pas encore listing publié = encore en onboarding". Cohérent enum `tukio_status: 'active' | 'pending_admin_review' | 'rejected' | 'suspended'` (Story 2.2 line 227 — 'active' ≠ 'verified').
2. **`tukio_status` transition à `rejected` au reject KYC** — middleware seller a besoin de cette info dans JWT (sinon 1 call /v1/me par navigation). Cohérent UX — Pro voit immédiatement page rejected post-login.
3. **2 events séparés** `pro-verified.v1` + `pro-rejected.v1` (vs un seul `pro-decision.v1` avec discriminator) — schema simpler, payload type-safe, easier consumer routing (Story 5.4 different templates per event), aligné epic naming.
4. **Keycloak sync best-effort + drift event fallback** — DB est source of truth. Si Keycloak fail (network, 5xx), DB committed + drift event → reconciliation cron Story 1.10 corrige plus tard. Évite blocking le UX admin sur Keycloak instabilité.
5. **`canTransitionKycTo` state machine explicit** — invariants centralisés dans aggregate (vs scattered across use cases). Tests aggregate exhaustifs garantissent que toute future story respecte la state machine.
6. **Restart endpoint MVP `/v1/seller/kyc/restart`** — minimal flow Pro re-soumet (reset state). Re-upload UX complet documents = Story 1.8 V1+ (placeholder support@tukio.one mailto). Évite scope-creep Story 2.5.
7. **Prometheus alert NFR48 vs in-app alert** — Slack `#tukio-alerts-ops` plus efficace pour ops team que page admin notification (Story 6.x). Métric source via cron 5 min — pas de DB query in alert path (separation of concerns).
8. **`<ApproveModal>` confirmation simple sans raison** vs `<RejectModal>` avec raison structurée — épice 2.5 spec. Justification : approve = success path, message au Pro template-générique. Reject = dialogue structuré (le Pro a besoin de comprendre pour reformer dossier).
9. **Migration rename `kyc_decision_reason → kyc_decision_reason_code`** + add `kyc_decision_message` — Story 1.3 avait posé un champ unique fourre-tout. Story 2.5 sépare en code (enum) + message (free text). Pas de production data → rename safe.
10. **Throttle endpoints** : 30/min admin actions (admin réfléchi pas spam), 3/hour seller restart (anti-abuse).
11. **EN strict + i18n strict + RGAA AA** memories.

### Versions à utiliser

(Pas de nouvelle dépendance — réutilise Stories 1.x/2.x : TanStack Query, Zod, axios, NestJS, TypeORM, Sonner, focus-trap-react Story 2.4, etc.)

### Project Structure cible

```
packages/contracts/src/events/identity/
├─ pro-verified.v1.{schema.json,ts}                              # NEW Story 2.5
├─ pro-rejected.v1.{schema.json,ts}                              # NEW Story 2.5
├─ pro-kyc-restart-requested.v1.{schema.json,ts}                 # NEW Story 2.5
└─ keycloak-sync-failed.v1.{schema.json,ts}                      # NEW Story 2.5

packages/contracts/src/dtos/admin/
├─ accept-verification.dto.ts                                    # NEW
├─ reject-verification.dto.ts                                    # NEW (KycRejectionReasonCodeEnum source of truth)
└─ restart-kyc.dto.ts                                            # NEW

packages/api-client/src/hooks/admin/
├─ use-accept-verification.ts                                    # NEW
└─ use-reject-verification.ts                                    # NEW

packages/api-client/src/hooks/seller/
└─ use-restart-kyc.ts                                            # NEW

apps/identity-svc/src/
├─ domain/
│  ├─ model/
│  │  ├─ pro-profile.aggregate.ts                                # UPDATE — approveKyc, rejectKyc, restartKyc, markUnderReview, canTransitionKycTo
│  │  ├─ user-profile.aggregate.ts                               # UPDATE — canTransitionTukioStatusTo allows rejected ↔ pending_admin_review
│  │  └─ value-objects/kyc-rejection-reason-code.value-object.ts # NEW
│  └─ exception/
│     ├─ kyc-status-invalid-transition.error.ts                  # NEW
│     ├─ kyc-rejection-invalid.error.ts                          # NEW
│     └─ kyc-restart-not-allowed.error.ts                        # NEW
├─ usecases/
│  ├─ accept-verification.usecase.ts + spec                      # NEW
│  ├─ reject-verification.usecase.ts + spec                      # NEW
│  └─ restart-kyc.usecase.ts + spec                              # NEW
├─ usecases-proxy/usecases-proxy.module.ts                       # UPDATE — wire 3 new use cases + DI tokens
├─ infrastructure/
│  ├─ http/controllers/
│  │  ├─ admin-verifications.controller.ts                       # UPDATE Story 2.4 — add accept + reject endpoints
│  │  └─ seller-kyc.controller.ts                                # NEW (or UPDATE Story 1.x seller-side)
│  ├─ persistence/typeorm/
│  │  ├─ entities/pro-profile.entity.ts                          # UPDATE — kycDecisionReasonCode + kycDecisionMessage
│  │  ├─ repositories/pro-profile.typeorm.repository.ts          # UPDATE — save mapping + maxAgeOfPendingHours
│  │  └─ migrations/1715291000000-RenameKycDecisionReasonAndAddMessage.ts  # NEW
│  └─ tasks/
│     └─ scrape-pending-pros.task.ts                             # NEW (Prom metrics every 5 min)

apps/gateway-api/src/
├─ usecases/admin/
│  ├─ admin-accept-verification.forwarder.ts                     # NEW
│  └─ admin-reject-verification.forwarder.ts                     # NEW
├─ usecases/seller/
│  └─ seller-kyc-restart.forwarder.ts                            # NEW
├─ infrastructure/http/controllers/
│  ├─ admin-verifications.controller.ts                          # UPDATE Story 2.4 — add accept + reject
│  └─ seller-kyc.controller.ts                                   # NEW
└─ infrastructure/external/identity-svc/identity-svc.client.ts   # UPDATE — acceptVerification + rejectVerification + restartKyc

apps/admin/src/
├─ features/admin/verifications/components/
│  ├─ ActionsZone.tsx + spec                                     # NEW
│  ├─ ApproveModal.tsx + spec                                    # NEW
│  └─ RejectModal.tsx + spec                                     # NEW
├─ app/[locale]/verifications/[proProfileId]/page.tsx            # UPDATE Story 2.4 — wire ActionsZone in placeholder
└─ messages/{fr,en}.json                                         # UPDATE — admin.verifications.detail.rejectReasons.*

apps/admin/e2e/verifications/accept-reject.spec.ts               # NEW Story 2.5

apps/seller/src/
├─ app/[locale]/seller/onboarding/rejected/page.tsx              # NEW Story 2.5
├─ features/seller/onboarding/components/
│  └─ RestartKycButton.tsx + spec                                # NEW
├─ middleware.ts                                                  # UPDATE Story 2.2 — rejected redirect + whitelist
└─ messages/{fr,en}.json                                         # UPDATE — seller.onboarding.rejected.*

apps/seller/e2e/onboarding/rejected.spec.ts                      # NEW Story 2.5

infra/k8s/prometheus-rules/identity-kyc-sla.yaml                 # NEW
infra/k8s/grafana-dashboards/admin-kyc-decisions.json            # NEW
docs/runbook/admin-kyc-accept-reject-debug.md                    # NEW

# Estimation : ~40 nouveaux + ~12 updates = ~52 fichiers
```

### Critical Architecture Constraints

> Cf. Stories 0.5/0.7 (atomics, outbox), 0.6 (Pretre), 1.2 (gateway-api), 1.3 (ProProfile + kyc_status enum + IKeycloakClient via Story 1.x), 1.7 (admin layout), 1.10 (audit_log + AuditLogConsumer + reconciliation cron), 2.1 (Stripe + payment-svc + ProProfile.stripe*), 2.2 (UserProfile.changeTukioStatus + middleware seller + wizard polling), 2.3 (admin queue + RBAC), 2.4 (admin detail screen + placeholder ActionsZone + IIdempotencyRepository) + memories.

1. **Pretre architecture stricte** — `domain/model/*` méthodes pures (pas d'I/O), use cases dans `usecases/` orchestrent ports, infra dans `infrastructure/`. Eslint-plugin-boundaries enforce.
2. **Transactional outbox ADR-007** — DB save + outbox event publish dans single transaction TypeORM (`ITransactionManager.runInTransaction`). Si DB commit fail, event non envoyé. outbox-relay Story 0.7 envoie au polling.
3. **API responses envelope ADR-014** (memory `feedback_api_envelope_response`) — toutes responses `{ method, code, data | error, meta }`.
4. **EN strict couche tech** (memory `feedback_tech_layer_english`) — events naming `identity.pro.verified.v1` strict EN. URL paths `/admin/verifications/:id/accept` strict EN.
5. **i18n FR/EN dès Sprint 0** (memory `feedback_i18n_frontend`) — namespaces `admin.verifications.detail.rejectReasons.*` + `seller.onboarding.rejected.*`. Zéro texte hardcodé frontend.
6. **NFR48 SLA admin 24h** — Prometheus alert + Slack `#tukio-alerts-ops`. Métrique `tukio_pro_pending_admin_review_age_hours_max` exposée par cron 5 min.
7. **NFR82 audit immutable** — events `identity.pro.verified.v1` + `identity.pro.rejected.v1` consumed AuditLogConsumer Story 1.10 → INSERT `audit_log` (immutable trigger).
8. **NFR1 RGPD audit** — `audit_log` 10 ans rétention. Rejection message contient potentiellement PII → cohérent NFR16 redaction (le message reste accessible admin via Story 2.7 audit UI mais pas exposé public).
9. **State machine transitions explicit** : `kyc_status` (4 états) + `tukio_status` (4 états) — invariants `canTransitionTo` dans aggregates.
10. **Keycloak sync best-effort + drift reconciliation** Story 1.10 cron — DB source of truth.
11. **Latest stable versions** (memory `feedback_latest_versions`).
12. **RGAA AA accessibility** (NFR47-55) — modales focus trap + aria-modal + role=dialog. Page rejected `<pre className="whitespace-pre-wrap font-sans">` preserve message formatting.

### Previous Story Intelligence

**Story 1.3 (Pro registration)** : a posé `pro_profiles.kyc_status` enum + `kyc_decision_at` + `kyc_decision_by` + `kyc_decision_reason` (single text field, Story 2.5 rename) + sketché méthodes `approveKyc / rejectKyc / markUnderReview` (cf. Story 1.3 ligne 370-372). Story 2.5 implémente ces méthodes + extends.

**Story 1.7 (admin layout)** : a livré middleware admin + `admin-modo`/`admin-super` roles + RBAC RolesGuard. Story 2.5 réutilise pour endpoints accept/reject (admin-modo+ minimum).

**Story 1.8 (profile management)** : `/v1/me` endpoint expose UserProfile + ProProfile. Story 2.5 UPDATE Story 1.8 minor : ajouter exposition `kycDecisionReasonCode`, `kycDecisionMessage`, `kycDecisionAt` quand Pro rejected (lecture seule, pour page rejected Story 2.5 frontend seller).

**Story 1.10 (Pretre consolidation)** : a livré (a) `audit_log` table immutable + AuditLogConsumer subscribe `identity.*` events → INSERT audit_log. Story 2.5 publie 2 events qui seront consumés automatiquement → audit trail. (b) reconciliation cron 3am UTC qui sync Keycloak ↔ DB drift — donc Story 2.5 sync Keycloak best-effort + drift event fallback OK (cron rectifie). (c) `IKeycloakClient` port (méthodes `updateUserAttribute` etc.) via Stories 1.2-1.7.

**Story 2.1 (Stripe Connect)** : a posé pattern transactional outbox + idempotency `stripe_events_inbox`. Story 2.5 réutilise `ITransactionManager` + `IEventPublisher` ports (Story 0.7 réutilisés).

**Story 2.2 (Pro onboarding wizard)** : a livré `UserProfile.changeTukioStatus` méthode + middleware seller + page `/seller/onboarding/kyc` qui polling render `kyc_status='approved'` (auto-redirect step 4) ou `'rejected'` (afficher raison + CTA "Corriger" → MVP redirect `/seller/onboarding/rejected` Story 2.5). Story 2.5 étend `UserProfile.canTransitionTukioStatusTo` allowed transitions (`pending_admin_review → rejected`, `rejected → pending_admin_review`).

**Story 2.3 (admin queue)** : a livré liste pending + bouton "Examiner" → naviguer Story 2.4. Story 2.5 invalide queue query keys post-mutation pour que la queue soit re-fetched (le Pro disparaît de la queue après decision).

**Story 2.4 (admin detail screen)** : a livré la page detail + placeholder `data-test="actions-zone"` pour Story 2.5 + `<HistoryTimeline>` qui affiche les actions. Story 2.5 ajoute les 2 boutons + 2 modales dans le placeholder. Le `useAdminVerificationDetail` hook Story 2.4 est invalidé post-mutation Story 2.5 pour re-render badges/timeline.

### What this story does NOT do

- ❌ **Email transactionnel pro-verified.{fr,en}.tsx** → Story 5.4 (notification-svc consume `identity.pro.verified.v1` event Story 2.5 publishes)
- ❌ **Email pro-rejected.{fr,en}.tsx** → Story 5.4 (consume `identity.pro.rejected.v1`)
- ❌ **In-app notification feed real-time SSE** → Story 11.1 V1
- ❌ **Re-upload UI documents post-restart** → Story 1.8 V1+ self-service profile (MVP : Pro contacte support@tukio.one)
- ❌ **Audit log UI** (filter, search, export) → Story 2.7 (Story 2.5 publie events consumed → audit_log INSERT, mais pas l'UI)
- ❌ **Auto-rejection 30j inactivity** → Story 2.8 (consume `identity.pro.auto-rejected.v1`)
- ❌ **Bulk actions (validate multiple Pros)** → V1+ admin tools
- ❌ **Approve avec note admin optionnelle** (MVP simple modal confirmation, V1+ pourra ajouter note)
- ❌ **Rejection reason free-text "other" required field separator** (MVP : reasonCode='other' + message libre = OK, V1+ pourra contraindre `if reasonCode='other' then minLength message=50` pour éviter abus)
- ❌ **Reject avec annexes (screenshot, lien)** → V1+ (file upload via FileUpload pattern Story 0.5)
- ❌ **Délai inactivité avant auto-rejection** → Story 2.8 (Story 2.5 fournit endpoint + état rejected, Story 2.8 ajoute cron auto-rejection)
- ❌ **Workflow disputes / appel pro** → Story 10.x V1 (un Pro qui conteste un rejet : MVP = email support)

### Files to UPDATE vs CREATE

(Cf. Project Structure cible — annoté UPDATE/NEW)

### Testing Standards

- Coverage ≥ 90 % use cases (3) — strict NFR71
- Coverage ≥ 95 % aggregates `ProProfile` + `UserProfile` (state machine critical)
- Coverage ≥ 80 % gateway endpoints (3)
- Coverage ≥ 80 % frontend (admin modales + seller page rejected)
- E2E Playwright FR/EN axe-core 0 violations 14 tests AC9
- Perf : POST accept p90 < 300ms, POST reject p90 < 500ms (Keycloak + 2 events), page rejected < 800ms
- Tests Prometheus alert assert (testcontainer fixture > 24h pending → Slack webhook called)
- Tests Keycloak sync fail simulation (mock 503 → DB committed + drift event)

### Project Structure Notes

✅ **Aligné architecture, PRD §FR3 (KYC validation flow), §FR83 (admin valide/rejette), §FR94 (audit log toutes actions admin), §FR95 (admin Super peut consulter audit trail), §FR17 (middleware redirect rejected), §NFR48 (SLA admin 24h), §NFR82 (audit immutable), §NFR47 (motion + RGAA AA), Stories 1.3/1.10/2.1/2.2/2.3/2.4, memories.**

⚠️ **Décision** : `tukio_status` reste `pending_admin_review` après KYC approve (final transition `active` → Story 2.2). Évite ambiguïté.

⚠️ **Décision** : `tukio_status='rejected'` après KYC reject + Keycloak claim sync — middleware redirect immédiat sans call /v1/me par navigation.

⚠️ **Décision** : 2 events séparés `pro-verified.v1` + `pro-rejected.v1` (epic naming, schema simpler, type-safe consumers).

⚠️ **Décision** : Keycloak sync best-effort + drift event fallback (DB source of truth — reconciliation cron Story 1.10 corrige).

⚠️ **Décision** : Prometheus alert NFR48 SLA via cron metric scraper 5 min (vs query in alert path) — separation of concerns.

⚠️ **Décision** : Migration rename `kyc_decision_reason → kyc_decision_reason_code` + add `kyc_decision_message` — Story 1.3 avait single text field ; Story 2.5 sépare. No production data → rename safe.

⚠️ **Décision** : Restart endpoint MVP minimal (reset state, pas re-upload UX) — scope-creep évité, Story 1.8 V1+ livre re-upload UI complet.

### References

- [Source: epics.md#Epic-2-Story-2.5 — Lines 1319-1334]
- [Source: prd.md#FR3, #FR17 (rejected redirect), #FR83, #FR94, #FR95, #NFR48 (SLA admin 24h), #NFR82 (audit immutable), #NFR47 (motion + RGAA)]
- [Source: ux-design-specification.md — admin KYC review detail (gap MVP critique designed Sprint 0)]
- [Source: architecture.md — ADR-007 transactional outbox, ADR-014 envelope, audit_log immutable lines, Pretre boundaries lines 2120-2164]
- [Source: Stories 1.3 (ProProfile + kyc_status enum + sketched approveKyc/rejectKyc), 1.7 (RBAC admin), 1.8 (`/v1/me`), 1.10 (audit_log + reconciliation + IKeycloakClient), 2.1 (Stripe + outbox), 2.2 (UserProfile.changeTukioStatus + middleware seller + wizard polling), 2.3 (admin queue invalidation), 2.4 (admin detail placeholder ActionsZone + HistoryTimeline)]
- [Memory: feedback_clean_architecture_explicit.md, feedback_api_envelope_response.md, feedback_tech_layer_english.md, feedback_i18n_frontend.md, feedback_latest_versions.md]

## Dev Agent Record

### Agent Model Used

(à remplir par dev agent : modèle + version)

### Debug Log References

### Completion Notes List

(à remplir à la fin — résumé décisions, déviations vs Dev Notes avec justification, points d'attention pour Story 2.6 (1ère fiche post-validation — consume `identity.pro.verified.v1` event Story 2.5 + integration Story 3.x catalog), Story 2.7 (audit trail UI — consulter `audit_log` qui contient désormais Story 2.5 events), Story 2.8 (auto-rejection 30j — réutilise `RejectVerificationUseCase` avec actor system + reasonCode='other' message inactivity), Story 5.4 (notification-svc consume `identity.pro.verified.v1` + `identity.pro.rejected.v1` events publish 2 emails templates), Story 6.5 (suspend/ban — réutilise pattern state machine + Keycloak sync + structured rejection))

### File List

(à remplir au fil de l'implémentation par le dev agent)

---

## Story Completion Status

- **Story Status** : `ready-for-dev`
- **Created** : 2026-05-09
- **Created by** : `bmad-create-story` workflow
- **Epic** : Epic 2 — Pro Onboarding & Admin Verification (MVP)
- **Sprint cible** : Sprint 3 (5ᵉ story Epic 2 après 2.1, 2.2, 2.3, 2.4)
- **Estimation effort** : 4-5 jours (1 dev fullstack — story complexité moyenne+ : 3 use cases + 2 modales + 1 page seller + middleware + Prometheus alert + Keycloak sync, ~52 fichiers)
- **Dépendances upstream** : Stories 0.5 (atomics), 0.6 (Pretre), 0.7 (outbox + ITransactionManager), 1.2 (gateway-api), 1.3 (ProProfile + kyc_status enum + sketched methods), 1.7 (admin layout RBAC), 1.8 (`/v1/me` exposition), 1.10 (audit_log + AuditLogConsumer + reconciliation cron + IKeycloakClient), 2.1 (Stripe + outbox patterns), 2.2 (UserProfile.changeTukioStatus + middleware seller + wizard polling), 2.3 (admin queue invalidation), 2.4 (admin detail screen + placeholder ActionsZone + HistoryTimeline + IIdempotencyRepository)
- **Dépendances downstream** :
  - Story 2.6 (1ère fiche post-validation) — consume `identity.pro.verified.v1` event Story 2.5
  - Story 2.7 (audit trail UI) — consulte `audit_log` qui contient désormais events Story 2.5
  - Story 2.8 (auto-rejection 30j) — réutilise `RejectVerificationUseCase` côté cron system actor
  - Story 5.4 (notification-svc) — consume 2 events Story 2.5 → 2 emails templates
  - Story 6.5 V1 (suspend/ban) — réutilise pattern state machine + Keycloak sync + structured rejection
  - Story 10.x V1 (dispute resolution) — réutilise pattern admin decision modale
- **FRs covered** :
  - **FR3** ✅ KYC validation flow (approve / reject)
  - **FR17 partial** ✅ middleware redirect rejected (Story 2.5 ajoute la règle)
  - **FR83** ✅ admin valide/rejette
  - **FR94** ✅ audit log toutes actions admin (events publié → audit_log INSERT)
- **NFRs touchés** :
  - **NFR1** ✅ RGPD audit 10 ans (audit_log immutable)
  - **NFR48** ✅ SLA 24h Prometheus alert + Slack `#tukio-alerts-ops`
  - **NFR71** ✅ coverage ≥ 90 % use cases + 95 % aggregates
  - **NFR82** ✅ audit immutable trigger
  - **NFR47** ✅ motion + RGAA AA modales focus trap + Esc

> **Prochaine story → Story 2.6** (1ère fiche service intégrée dans le wizard onboarding — consume Story 2.5 events + integration Story 3.x catalog)

---

**Dev agent next steps :**
1. Lire ce file complètement
2. Vérifier upstream Stories 0.5, 0.6, 0.7, 1.2, 1.3, 1.7, 1.8, 1.10, 2.1, 2.2, 2.3, 2.4 implémentées
3. Implémenter Tasks 1-11 dans l'ordre (DTOs/events Task 1 → domain Task 2 → DB Task 3 → use cases Task 4 → endpoints Task 5-6 → frontend Task 7-8 → observability Task 9 → tests Task 10 → runbook Task 11)
4. Lancer `pnpm playwright test --grep "admin verification accept reject"` + `--grep "seller onboarding rejected"` après chaque jalon
5. Commit Story 2.5 quand : 14/14 e2e + coverage thresholds NFR71 + axe-core 0 + perf cibles + Prometheus alert testé + Keycloak sync fail drift testé + state machine transitions tests aggregate exhaustifs + i18n FR/EN namespaces complets
6. Update sprint-status : `2-5-...: review` puis `done`
