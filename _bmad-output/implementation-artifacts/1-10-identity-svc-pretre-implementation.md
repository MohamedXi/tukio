# Story 1.10: identity-svc Pretre implementation (domain UserProfile + ProProfile + Keycloak sync + reconciliation jobs + audit_log)

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

**As a** backend tech lead (équipe Epic 1 close-out),
**I want** une story de **consolidation finale d'identity-svc Epic 1** qui (a) **audite l'application stricte du Pattern Pretre** sur les 8 use cases Stories 1.2-1.9 (boundaries lint passe sur `apps/identity-svc/`, coverage thresholds NFR71 atteints, structure dossiers conforme Architecture lignes 1230-1238), (b) **livre les 2 composants critiques manquants** identifiés par les Stories précédentes : (b1) **`POST /internal/keycloak-events` endpoint Phasetwo webhook consumer** que Story 1.1 AC5 a configuré côté Keycloak realm + Phasetwo Webhooks Extension mais qui attendait son receiver côté identity-svc — il consume les events `LOGIN`, `LOGIN_ERROR`, `LOGOUT`, `USER_DISABLED_BY_TEMPORARY_LOCKOUT`, `RECOVERY_AUTHN_CODE_USED` envoyés par Phasetwo HMAC-signed, vérifie la signature `X-Phasetwo-Signature: sha256=<hmac>` (secret partagé via Doppler `KEYCLOAK_WEBHOOK_SECRET`), idempotence via `keycloak_events_inbox` table (event_id UUID PK + processed_at), transforme chaque event en NATS event Tukio (`identity.login.error.v1` Story 1.1 AC5 + `identity.admin.totp.recovery-used.v1` Story 1.7 AC5 + `identity.user.logged-in.v1` Story 1.4 + `identity.user.logged-out.v1` NEW), publish via outbox-relay Story 0.7 ; (b2) **`reconcile-keycloak-drift.task.ts` cron quotidien** (`@nestjs/schedule` Story 1.9 réutilisé, `@Cron('0 3 * * *')` 3am UTC avant purge cron Story 1.9 4am) qui compare Keycloak users (`kcAdminClient.users.find({ realm:'tukio', max: 1000 })` paginated) vs `user_profiles` DB rows, détecte 4 types de drift : (1) **orphan Keycloak users** (Keycloak a un user, DB n'a rien) — happens si compensation Story 1.2/1.3 fail mid-saga → action: log alert + Slack `#tukio-alerts` + ne PAS auto-delete (manual review Story 6.x), (2) **orphan DB users** (DB a row, Keycloak n'a rien) — happens si admin a delete user Keycloak directement → action: alert + propose `pnpm reconcile:fix --user-id=...` CLI script manual fix, (3) **email mismatch** Keycloak.email ≠ user_profiles.email — sync direction DB→Keycloak (DB source of truth post-Story 1.8 profile update), (4) **emailVerified drift** — sync DB→Keycloak ou Keycloak→DB selon `updated_at` plus récent (resolves Story 1.6 verify race condition + Story 1.8 profile update fail) — reconciliation publish event `identity.reconciliation.completed.v1` avec stats (orphans count, drift count, fixed count) — alert Slack si orphans > 10 (probably bug) ; (c) **table `audit_log` baseline migration** + immutability trigger Postgres (`CREATE TRIGGER prevent_update_delete BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION raise_immutability_error()`) — table utilisée immédiatement par Stories 1.4 (login audit consume `identity.user.logged-in.v1` event), Story 1.7 (TOTP setup consume `identity.admin.totp.configured.v1`), Story 1.9 (delete consume `identity.user.deleted.v1`) — Story 1.10 livre la table + trigger + NATS consumer pattern réutilisable (Story 2.7 ajoute UI consultation) ; (d) **lint enforcement strict eslint-plugin-boundaries** sur `apps/identity-svc/` — fail CI si tout fichier `domain/*` import `@nestjs/*`, `typeorm`, `axios`, `bcrypt`, autre lib I/O (validation Story 0.6 AC8 strictement appliquée fin Epic 1) ; (e) **documentation Epic 1 close-out** : update `docs/project-context.md` (NEW Story 1.10 — généré post-Sprint 0 par Story 0.13, étendu Epic 1) avec section "Identity & Auth Backbone" qui résume l'architecture finale (10 user-cases, 4 tables `user_profiles`/`pro_profiles`/`email_verification_tokens`/`password_reset_tokens` + nouvelle `audit_log` + nouvelle `keycloak_events_inbox`, 12 NATS events outbox, 5 Resend templates, 4 OIDC clients Keycloak, 2 Required Actions, 5 use cases auth gateway-api, 7 endpoints REST `/v1/auth/*` + `/v1/me`), update ADR-009 Implementation Notes finalisée Epic 1, runbook handoff Epic 2 (Stripe Connect Express Story 2.1 prereq : `ProProfile.stripeAccountId` field + `kyc_status` enum extended),
**so that** Epic 1 est **closed-out propre** : tout audit code review de tiers (avocat numérique NFR21 + auditor security) trouve une codebase exemplaire Pattern Pretre + RGPD-compliant + observability complète + reconciliation automatique drift R8 ; les Stories Epic 2-7 démarrent sur une fondation auth solide, sans dette technique cachée ; les events NATS audit `identity.*` sont consommés par `audit_log` consumer Story 1.10 dès production launch (pas besoin de backfill ultérieur) ; et la **Phasetwo webhooks bridge boucle est fermée** (Story 1.1 émet → Story 1.10 consume → identity-svc → outbox → NATS Tukio events).

> **Outcome attendu** : à la fin de cette story, `pnpm --filter=identity-svc lint` passe avec **0 violations boundaries** (domain pure) ; `pnpm --filter=identity-svc test --coverage` montre **≥ 80% domain, ≥ 70% usecases, ≥ 50% infrastructure** (NFR71) ; un Phasetwo webhook arrive sur `https://api.tukio.one/v1/internal/keycloak-events` avec event `LOGIN_ERROR` HMAC-signed → identity-svc verify HMAC + check idempotence inbox + transform + publish NATS event `identity.login.error.v1` → consumed par audit_log consumer (NEW Story 1.10) qui INSERT dans `audit_log` table → événement traçable 10 ans (NFR1 + ADR-014 audit) ; le cron reconciliation daily 3am UTC tourne, log les stats `0 orphans / 5 drifts fixed / 0 errors`, alerte Slack si > 10 orphans (anomaly indicator) ; un dev qui essaie de pousser une PR avec `import { Repository } from 'typeorm'` dans `apps/identity-svc/src/domain/model/user-profile.aggregate.ts` voit ESLint fail en CI avec message clair `"🚫 Pattern Pretre violation: domain/ must not import I/O libs"` (Story 0.6 AC8 strictement appliqué) ; `docs/project-context.md` est updated avec section "Identity & Auth Backbone (Epic 1 finalized 2026-MM-DD)" qui documente l'architecture finale (utilisable par tout dev futur ou IA agent comme contexte) ; un test `pnpm playwright test --grep "identity audit"` passe avec verify event NATS publié → audit_log row visible (10 ans rétention) ; la **handoff Epic 2** est documentée — Story 2.1 (Stripe Connect Express) peut démarrer sans surprise (ProProfile.stripeAccountId field + kyc_status extended documentés) ; `_bmad-output/implementation-artifacts/sprint-status.yaml` flip Epic 1 = `done` après ce dernier story `done`.

## Acceptance Criteria

1. **AC1 — Phasetwo webhook consumer endpoint `POST /internal/keycloak-events`** : Given Story 1.1 AC5 a configuré Phasetwo Webhooks Extension côté Keycloak realm pour POST events HMAC-signed vers `${IDENTITY_SVC_URL}/internal/keycloak-events`, When un Phasetwo event arrive (e.g., `LOGIN_ERROR` payload Story 1.1 AC5), Then identity-svc :
   - **Endpoint** :
     ```ts
     @Controller('/internal/keycloak-events')
     export class KeycloakEventsController {
       @Post('/')
       @HttpCode(204) // ack-only — Phasetwo retry si pas 2xx
       async handleEvent(
         @Body() rawBody: any,
         @Headers('x-phasetwo-signature') signature: string,
         @Headers('x-phasetwo-event-id') eventId: string, // unique per event Phasetwo
       ): Promise<void> {
         return this.handleKeycloakEventUseCaseProxy.getInstance().execute({ rawBody, signature, eventId });
       }
     }
     ```
   - **Use case `HandleKeycloakEventUseCase`** :
     1. Verify HMAC signature : `expectedSig = 'sha256=' + crypto.createHmac('sha256', config.getKeycloakWebhookSecret()).update(JSON.stringify(rawBody)).digest('hex')` — comparer avec `signature` via `crypto.timingSafeEqual` (anti timing-attack) — si mismatch → throw `AuthForbiddenException('AUTH-FORBIDDEN-002', 'Invalid HMAC signature')` + alerte Slack `#tukio-security` (suspect attack)
     2. Check idempotence : query `SELECT 1 FROM keycloak_events_inbox WHERE event_id = $1` — si existe → return 204 (event déjà traité — Phasetwo peut retry)
     3. Map Phasetwo event type → NATS event Tukio :
        - `LOGIN` → `identity.user.logged-in.v1` (consume audit_log)
        - `LOGIN_ERROR` → `identity.login.error.v1` (Story 1.1 AC5)
        - `LOGOUT` → `identity.user.logged-out.v1` (NEW)
        - `USER_DISABLED_BY_TEMPORARY_LOCKOUT` → `identity.user.locked.v1` (NEW — alert security)
        - `USER_DISABLED_BY_PERMANENT_LOCKOUT` → `identity.user.banned.v1` (NEW — alert critical)
        - `RECOVERY_AUTHN_CODE_USED` → `identity.admin.totp.recovery-used.v1` (Story 1.7 AC5)
        - Other events → log + skip (extension future)
     4. Transform payload : extract `userId`, `username`, `ipAddress`, `userAgent`, `error?` (from Phasetwo payload format) → match schema NATS event Tukio
     5. Atomic transaction : INSERT `keycloak_events_inbox` row (idempotence guard) + outbox publish NATS event (Story 0.7 pattern)
     6. Return 204 ACK
   - **Table `keycloak_events_inbox`** (NEW migration Story 1.10) :
     ```sql
     CREATE TABLE keycloak_events_inbox (
       event_id UUID PRIMARY KEY,
       phasetwo_event_type VARCHAR(100) NOT NULL,
       user_id UUID NULL, -- nullable car LOGIN_ERROR peut concerner email inconnu
       received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       processed_at TIMESTAMPTZ NULL,
       payload_summary JSONB -- pour debug/audit
     );
     CREATE INDEX idx_keycloak_events_inbox_received_at ON keycloak_events_inbox (received_at DESC);
     ```
   - **Tests E2E** : valid HMAC + new eventId → 204 + NATS event published. Invalid HMAC → 403. Duplicate eventId → 204 (idempotent). Unknown event type → 204 + skip log. Tests integration : nock Phasetwo simulator + MailHog inbox check (impact email side-effects).

2. **AC2 — `reconcile-keycloak-drift.task.ts` cron daily 3am UTC** : Given le risque drift R8 (Keycloak ↔ DB out-of-sync), When le cron job tourne, Then :
   - **NEW `apps/identity-svc/src/tasks/reconcile-keycloak-drift.task.ts`** :
     ```ts
     @Injectable()
     export class ReconcileKeycloakDriftTask {
       @Cron('0 3 * * *') // 3am UTC daily — avant purge cron Story 1.9 4am
       async handleReconciliation() {
         const stats = { keycloakUsers: 0, dbUsers: 0, orphansKeycloak: [], orphansDb: [], emailMismatches: [], emailVerifiedDrifts: [], errors: [] };
         
         // 1. Fetch all Keycloak users (paginated, 1000/batch)
         let first = 0;
         const max = 1000;
         while (true) {
           const batch = await this.keycloakAdmin.listUsers({ first, max, realm: 'tukio' });
           stats.keycloakUsers += batch.length;
           
           for (const kcUser of batch) {
             // 2. Lookup DB user by keycloak_user_id
             const dbUser = await this.userProfileRepo.findByKeycloakUserId(kcUser.id);
             
             if (!dbUser) {
               stats.orphansKeycloak.push({ keycloakUserId: kcUser.id, email: kcUser.email });
               continue;
             }
             stats.dbUsers++;
             
             // 3. Detect drift email
             if (kcUser.email !== dbUser.email.value && !dbUser.deletedAt) {
               // Sync DB → Keycloak (DB source of truth post-Story 1.8 profile update)
               try {
                 await this.keycloakAdmin.updateUser({ keycloakUserId: kcUser.id, updates: { email: dbUser.email.value } });
                 stats.emailMismatches.push({ keycloakUserId: kcUser.id, oldEmail: kcUser.email, newEmail: dbUser.email.value });
               } catch (e) { stats.errors.push({ keycloakUserId: kcUser.id, error: e.message }); }
             }
             
             // 4. Detect drift emailVerified — sync direction selon updated_at most recent
             if (kcUser.emailVerified !== dbUser.emailVerified) {
               // If DB.updatedAt > Keycloak event timestamp → DB→KC, else KC→DB
               // Heuristic MVP : DB → KC always (DB est source of truth post-Story 1.6 verify)
               try {
                 await this.keycloakAdmin.updateUser({ keycloakUserId: kcUser.id, updates: { emailVerified: dbUser.emailVerified } });
                 stats.emailVerifiedDrifts.push({ keycloakUserId: kcUser.id });
               } catch (e) { stats.errors.push({ ... }); }
             }
           }
           
           if (batch.length < max) break;
           first += max;
         }
         
         // 5. Detect orphan DB users (DB has row, Keycloak doesn't)
         const allDbUsers = await this.userProfileRepo.listAll({ batchSize: 1000 });
         for (const dbUser of allDbUsers) {
           if (!dbUser.deletedAt) { // skip soft-deleted (Story 1.9)
             try {
               await this.keycloakAdmin.findByKeycloakUserId(dbUser.keycloakUserId);
             } catch (e) {
               if (e instanceof KeycloakUserNotFoundError) {
                 stats.orphansDb.push({ userProfileId: dbUser.id, keycloakUserId: dbUser.keycloakUserId });
               }
             }
           }
         }
         
         // 6. Publish reconciliation event + alerts
         await this.eventPublisher.publish({
           eventType: 'identity.reconciliation.completed',
           eventVersion: 'v1',
           aggregate: { type: 'IdentityReconciliation', id: randomUUID() },
           actor: { userId: 'system-cron', role: 'system' },
           payload: { stats, completedAt: new Date().toISOString() },
         });
         
         if (stats.orphansKeycloak.length > 10 || stats.orphansDb.length > 10) {
           await this.slackAlertService.alert('#tukio-alerts', `⚠️ Reconciliation drift > 10 orphans: ${JSON.stringify(stats)}`);
         }
         
         // Metrics
         this.metrics.gauge('tukio_identity_reconcile_orphans_keycloak', stats.orphansKeycloak.length);
         this.metrics.gauge('tukio_identity_reconcile_orphans_db', stats.orphansDb.length);
         this.metrics.gauge('tukio_identity_reconcile_drifts_fixed', stats.emailMismatches.length + stats.emailVerifiedDrifts.length);
       }
     }
     ```
   - **NB sur orphan KC NOT auto-delete** : si Keycloak a un user que DB n'a pas, c'est probablement un Story 1.2/1.3 register fail mid-saga (compensation rollback fail). Auto-delete le KC user serait dangereux (perte data audit Keycloak). **Décision** : log + alert Slack pour manual review. CLI script `pnpm reconcile:fix --user-id=...` (NEW Story 1.10) permet à un admin/dev de fix manuel (soit complete le register en créant DB row, soit delete KC user).
   - **CLI dry-run** : `pnpm reconcile:dry-run` outputs les stats sans applying fixes — utilisé pour audits manuels MVP.
   - **Tests** : mock KeycloakAdmin + UserProfileRepo + tester 4 types de drift detection + idempotence + alerte Slack threshold

3. **AC3 — Table `audit_log` baseline + immutability trigger + NATS consumer** : Given le scope audit RGPD + LCEN + traçabilité 10 ans (NFR1), When je consulte `apps/identity-svc/src/`, Then :
   - **NEW migration `1715260000000-CreateAuditLogTable.ts`** :
     ```sql
     CREATE TABLE audit_log (
       id UUID PRIMARY KEY,
       actor_id UUID NULL, -- NULL pour system events
       actor_role VARCHAR(30) NULL, -- 'client', 'pro', 'admin-*', 'system'
       action_type TEXT NOT NULL, -- ex: 'identity.user.registered', 'identity.user.logged-in', etc.
       aggregate_type TEXT NOT NULL, -- 'UserProfile', 'ProProfile', etc.
       aggregate_id UUID NOT NULL,
       before_state JSONB NULL, -- previous values for UPDATE/DELETE
       after_state JSONB NULL, -- new values
       reason TEXT NULL, -- optional human-readable reason
       correlation_id UUID NULL, -- propagated from Story 0.7 correlationContext
       at TIMESTAMPTZ NOT NULL,
       ip_address INET NULL,
       user_agent TEXT NULL
     );
     CREATE INDEX idx_audit_log_actor_at ON audit_log (actor_id, at DESC);
     CREATE INDEX idx_audit_log_aggregate ON audit_log (aggregate_id, at DESC);
     CREATE INDEX idx_audit_log_action_type ON audit_log (action_type);
     CREATE INDEX idx_audit_log_correlation ON audit_log (correlation_id) WHERE correlation_id IS NOT NULL;
     
     -- Immutability trigger — NFR1 LCEN compliance
     CREATE OR REPLACE FUNCTION raise_immutability_error()
     RETURNS TRIGGER AS $$
     BEGIN
       RAISE EXCEPTION 'audit_log is immutable. Update/Delete forbidden. Operation: %, Row: %', TG_OP, OLD.id;
     END;
     $$ LANGUAGE plpgsql;
     
     CREATE TRIGGER prevent_update_delete BEFORE UPDATE OR DELETE ON audit_log
       FOR EACH ROW EXECUTE FUNCTION raise_immutability_error();
     ```
   - **NEW NATS consumer `AuditLogConsumer`** (`apps/identity-svc/src/infrastructure/messaging/nats/audit-log.consumer.ts`) :
     - Subscribe sur subjects `identity.*` (toutes les Stories 1.x events) + `admin.*` V1+
     - Inbox idempotence pattern Story 0.7 (vérifier `inbox` table avant INSERT audit_log)
     - INSERT row dans `audit_log` avec mapping :
       - `action_type` = event.eventType (ex: `'identity.user.registered'`)
       - `aggregate_type` = event.aggregate.type
       - `aggregate_id` = event.aggregate.id
       - `actor_id` = event.actor.userId (NULL si 'system')
       - `actor_role` = event.actor.role
       - `before_state` / `after_state` = event.payload.before / .after (NULL pour register events)
       - `correlation_id` = event.correlationId
       - `at` = event.occurredAt
   - **Use case `RecordAuditLogUseCase`** (NEW) — appelé par `AuditLogConsumer` :
     - Validates aggregate exists (foreign key check via aggregateId — non-blocking, log if missing)
     - Persists to `audit_log` (INSERT only, never UPDATE/DELETE)
   - **Tests** : tester insert + tester immutability trigger raises exception sur UPDATE/DELETE attempt
   - **Story 2.7 finalize** : UI consultation admin (filter by actor/aggregate/action_type/date range) + export CSV — Story 1.10 livre la table + données, Story 2.7 livre le frontend admin.

4. **AC4 — Lint enforcement strict eslint-plugin-boundaries identity-svc** : Given Story 0.6 AC8 a configuré `eslint-plugin-boundaries`, When la CI tourne `pnpm --filter=identity-svc lint` Story 1.10, Then :
   - **0 violations boundaries** sur `apps/identity-svc/src/domain/**` (pas d'import `@nestjs/*`, `typeorm`, `axios`, `bcrypt`, `crypto.subtle`, etc.)
   - **Audit code review manuel Story 1.10** : ouvrir chaque fichier `apps/identity-svc/src/domain/model/*.ts`, `domain/ports/*.ts`, `domain/exception/*.ts`, vérifier qu'il n'y a que des imports purs TS + autres modules `domain/*`
   - **Test failure case** : créer temporairement un fichier `domain/test-violation.ts` avec `import { Repository } from 'typeorm'` → vérifier `pnpm lint` fail → SUPPRIMER le fichier après vérification (pas de commit)
   - **Coverage thresholds** (NFR71) appliqués strictement (config Vitest/Jest dans `apps/identity-svc/jest.config.ts` Story 0.6) : domain ≥ 80%, usecases ≥ 70%, infrastructure ≥ 50%
   - **CI workflow** `.github/workflows/ci.yml` (Story 0.11) — vérifier que `pnpm --filter=identity-svc test:cov` est wired dans la pipeline + report uploaded

5. **AC5 — Consolidation use cases Pretre** : Given Stories 1.2-1.9 ont chacune ajouté des use cases incrémentalement, When je consulte `apps/identity-svc/src/usecases/` Story 1.10, Then je trouve **les 13 use cases** suivants (validation finale Epic 1 — coherent avec acceptance Story 1.10 epics.md ligne 1232) :
   - `register-customer.usecase.ts` (Story 1.2) ✅
   - `register-pro.usecase.ts` (Story 1.3) ✅
   - `verify-email.usecase.ts` (Story 1.6) ✅
   - `resend-email-verification.usecase.ts` (Story 1.6) ✅
   - `validate-email-verification-token.usecase.ts` (Story 1.6) ✅
   - `request-password-reset.usecase.ts` (Story 1.5) ✅
   - `confirm-password-reset.usecase.ts` (Story 1.5) ✅
   - `validate-password-reset-token.usecase.ts` (Story 1.5) ✅
   - `initiate-totp-setup.usecase.ts` (Story 1.7) ✅
   - `verify-totp-setup.usecase.ts` (Story 1.7) ✅
   - `create-admin.usecase.ts` (Story 1.7) ✅
   - `get-my-profile.usecase.ts` (Story 1.8) ✅
   - `update-my-profile.usecase.ts` (Story 1.8) ✅
   - `get-kyc-doc-signed-url.usecase.ts` (Story 1.8) ✅
   - `delete-my-account.usecase.ts` (Story 1.9) ✅
   - **NEW Story 1.10** : `handle-keycloak-event.usecase.ts` (Phasetwo webhook AC1) + `record-audit-log.usecase.ts` (NATS consumer AC3) + `reconcile-keycloak-drift.task.ts` (cron AC2 — c'est un task pas un use case stricto sensu, vit dans `tasks/`)
   - **Audit final Story 1.10** : ouvrir `apps/identity-svc/src/infrastructure/usecases-proxy/usecases-proxy.module.ts` et vérifier que les **15 use cases sont tous wirés** avec leurs Symbol DI tokens corrects + correct imports — code review final

6. **AC6 — Documentation Epic 1 close-out** : Given Epic 1 = 10 stories, When je consulte la documentation post-Story 1.10, Then :
   - **Update `docs/project-context.md`** (Story 0.13 a généré le squelette, Story 1.10 ajoute section Epic 1) :
     - Section "Identity & Auth Backbone (Epic 1 finalized 2026-MM-DD)"
     - Sub-sections : Architecture (Pattern Pretre + 5 tables DB + 12 NATS events + 5 Resend templates + 4 OIDC clients + 2 Required Actions), Endpoints (`/v1/auth/*` + `/v1/me`), Reconciliation (cron 3am + 4am Story 1.9), Audit Log (table immutable + 10y retention), Phasetwo Webhooks Bridge
     - Pour chaque story 1.1-1.10 : 1 paragraphe de résumé (utile pour devs futurs + IA agents)
   - **Update `docs/adr/0009-keycloak-identity-svc-split.md`** (Story 0.13 ADR-009) : ajouter section "Implementation Notes Epic 1 finalized" résumant les décisions techniques majeures Stories 1.1-1.10 (Phasetwo Webhooks vs Custom SPI, recovery codes Keycloak natif, anti-énumération, Cron purge 10y, drift reconciliation, audit_log immutable trigger)
   - **NEW `docs/runbook/identity-svc-handoff-epic-2.md`** (~50 lignes) : briefing pour Epic 2 dev (Stripe Connect Express Story 2.1 prereq) :
     - Story 2.1 doit ajouter `pro_profiles.stripe_account_id VARCHAR(50) NULL UNIQUE WHERE deleted_at IS NULL` via migration Story 2.1
     - Story 2.1 doit étendre `kyc_status` enum avec valeurs `'stripe_pending'` (entre `pending_review` et `under_review`)
     - Story 4.1 doit exposer `GET /internal/bookings/active?userId={id}` endpoint (consommé Story 1.9 delete check)
     - Story 5.4 doit consume 5 templates Resend (`email-verify`, `email-verify-confirmation`, `password-reset`, `password-reset-confirmation`, `pro-pending-admin-review`, `admin-onboarding`)
     - Story 2.7 doit ajouter UI consultation `audit_log` + filters + export
   - **Update `packages/contracts/README.md`** : section finale "Epic 1 Identity events catalog" avec liste complète des 12 NATS events + 5 templates + error codes catalog

7. **AC7 — `infra/scripts/reconcile-keycloak-drift.sh` CLI manual fix** : Given le besoin de fix manuel post-cron alert, When un dev/admin lance `pnpm reconcile:fix --user-id=<keycloakUserId> --action=<delete-kc|create-db|sync>`, Then :
   - **Script** `infra/scripts/reconcile-keycloak-drift.sh` (bash wrapper appelant TypeScript)
   - **Actions supportées** :
     - `--action=delete-kc --user-id=<kc-uuid>` : delete Keycloak user orphan (e.g., post-Story 1.2 register compensation fail)
     - `--action=create-db --user-id=<kc-uuid>` : create UserProfile DB row from Keycloak data (utilisateur réel manqué par Story 1.2 saga)
     - `--action=sync --user-id=<kc-uuid> --field=email|emailVerified` : force sync DB → Keycloak ou inverse pour un field spécifique
     - `--dry-run` : preview changes sans applying
   - **Validations** : confirme manuellement (`Continue? [y/N]`), log all actions to `audit_log` (action_type='reconciliation.manual.fix')
   - **Tests** : tester les 3 actions avec testcontainer + dry-run

8. **AC8 — Audit final structure dossiers identity-svc + reorganisation cohérence** : Given Stories 1.2-1.9 ont incrémenté la structure, When je consulte `apps/identity-svc/src/` Story 1.10, Then je trouve **strictement** la structure suivante (alignée Architecture lignes 1230-1238 + Story 0.6 AC1) :
   ```
   apps/identity-svc/src/
   ├─ main.ts
   ├─ app.module.ts                                    # imports tous les modules
   ├─ domain/
   │  ├─ model/
   │  │  ├─ user-profile.aggregate.ts                  # Story 1.2 + extensions Stories 1.6, 1.8, 1.9
   │  │  ├─ pro-profile.aggregate.ts                   # Story 1.3 + extensions Story 1.9
   │  │  └─ value-objects/
   │  │     ├─ email.value-object.ts                   # Story 1.2
   │  │     ├─ password-policy.value-object.ts         # NEW Story 1.10 (dedup logic Stories 1.2/1.5/1.7)
   │  │     ├─ siret.value-object.ts                   # Story 1.3
   │  │     ├─ vat-number.value-object.ts              # Story 1.3
   │  │     ├─ address.value-object.ts                 # Story 1.3
   │  │     ├─ phone-number.value-object.ts            # Story 1.3
   │  │     ├─ locale.value-object.ts                  # Story 1.2
   │  │     ├─ acquisition-source.value-object.ts      # Story 1.2
   │  │     ├─ role.value-object.ts                    # NEW Story 1.10 (consolidation Role enum + Symbol)
   │  │     └─ tukio-status.value-object.ts            # NEW Story 1.10 (consolidation status enum)
   │  ├─ ports/
   │  │  ├─ user-profile-repository.port.ts            # Story 1.2/1.6/1.8/1.9
   │  │  ├─ pro-profile.repository.port.ts             # Story 1.3
   │  │  ├─ email-verification-token-repository.port.ts # Story 1.2/1.6
   │  │  ├─ password-reset-token-repository.port.ts    # Story 1.5
   │  │  ├─ keycloak-admin.port.ts                     # Story 1.2 + extensions
   │  │  ├─ insee-siret-validator.port.ts              # Story 1.3
   │  │  ├─ media-storage.port.ts                      # Story 1.3
   │  │  ├─ event-publisher.port.ts                    # Story 0.7
   │  │  ├─ cache.port.ts                              # Story 1.7
   │  │  ├─ booking-svc-client.port.ts                 # Story 1.9
   │  │  ├─ slack-alert.port.ts                        # NEW Story 1.10
   │  │  └─ tokens.ts                                  # tous les Symbol DI
   │  ├─ service/
   │  │  └─ password-policy.service.ts                 # NEW Story 1.10 (extracted from Stories 1.2/1.5)
   │  └─ exception/
   │     ├─ identity.exception.ts                      # Story 0.6 base
   │     ├─ identity-conflict.exception.ts             # Story 1.2 (codes 001/002/003)
   │     ├─ identity-validation.exception.ts           # Story 1.3 (codes 001-005)
   │     ├─ identity-not-found.exception.ts            # Story 1.2/1.8
   │     ├─ identity-expired.exception.ts              # Story 1.5/1.6/1.7
   │     ├─ external-service.exception.ts              # Story 1.2/1.3
   │     └─ auth-forbidden.exception.ts                # Story 0.8/1.7/1.10
   ├─ usecases/                                        # 15 use cases (cf. AC5)
   ├─ tasks/                                           # cron jobs
   │  ├─ purge-deleted-accounts.task.ts                # Story 1.9
   │  └─ reconcile-keycloak-drift.task.ts              # NEW Story 1.10
   └─ infrastructure/
      ├─ persistence/typeorm/
      │  ├─ entities/                                  # 5 entities (user-profile, pro-profile, email-verification-token, password-reset-token, audit-log, keycloak-events-inbox)
      │  ├─ repositories/                              # 5 repositories
      │  ├─ mappers/
      │  ├─ migrations/                                # 7+ migrations chronologiques
      │  └─ data-source.ts
      ├─ external/
      │  ├─ keycloak/{keycloak-admin.service.ts,keycloak-admin.module.ts,errors.ts}  # Story 1.2 + extensions
      │  ├─ insee/{insee-siret-validator.service.ts,...}             # Story 1.3
      │  ├─ r2/{r2-media-storage.service.ts,...}                     # Story 1.3
      │  ├─ booking-svc/{booking-svc.client.ts,...}                  # Story 1.9
      │  └─ slack/{slack-alert.service.ts,...}                       # NEW Story 1.10
      ├─ cache/{redis-cache.service.ts,cache.module.ts}              # Story 1.7
      ├─ messaging/nats/
      │  ├─ event-publisher.nats.ts                    # Story 0.7
      │  ├─ outbox-publisher.ts                        # Story 0.7
      │  ├─ inbox-consumer.ts                          # Story 0.7
      │  └─ audit-log.consumer.ts                      # NEW Story 1.10
      ├─ http/
      │  ├─ controllers/                               # 8 controllers (customer, pro, auth-totp, admin, me, password-reset, email-verify, keycloak-events)
      │  ├─ dtos/
      │  ├─ guards/{internal-service.guard.ts}        # Story 1.2
      │  ├─ interceptors/{response-envelope.interceptor.ts}  # Story 0.6
      │  ├─ filters/{envelope-exception.filter.ts}    # Story 0.6
      │  └─ http.module.ts
      ├─ logger/                                       # Story 0.6
      ├─ config/                                       # Story 0.6 + extensions Stories 1.x
      └─ usecases-proxy/usecases-proxy.module.ts       # 15 proxies
   ```
   - **Audit Story 1.10** : ouvrir le repo + verify chaque fichier listed exists. Manquant → flag dans Completion Notes pour fix. Extra files non-listés → review pour cleanup.

9. **AC9 — Tests Playwright e2e + integration end-to-end Epic 1** : Given Epic 1 = 10 stories, When je lance `pnpm playwright test --grep "@epic-1"`, Then :
   - **Test integration end-to-end Customer journey** (NEW Story 1.10) :
     1. Register Customer via Story 1.2 form → vérifier user en DB + email reçu MailHog
     2. Click verify link (extract token from MailHog) → Story 1.6 verify → vérifier `email_verified=true` Keycloak + DB
     3. Login Story 1.4 → vérifier session cookies + redirect dashboard
     4. Edit profile Story 1.8 (changer firstName + locale) → vérifier DB updated + Keycloak synced
     5. Logout Story 1.4 → vérifier session révoquée
     6. Forgot password Story 1.5 → request → email reçu → click → set new password → login back
     7. Delete account Story 1.9 → vérifier soft-delete + anonymisation + Keycloak disabled + redirect homepage
   - **Test integration end-to-end Pro journey** (NEW Story 1.10) :
     1. Register Pro Story 1.3 wizard 3 steps → vérifier Pro pending_admin_review + KYC docs R2
     2. Verify email Story 1.6
     3. Login Story 1.4 → redirect /seller/onboarding/pending (FR17 enforced)
     4. (Pro non validé encore — admin valide via Story 2.5 dans Epic 2)
   - **Test integration end-to-end Admin journey** (NEW Story 1.10) :
     1. Create admin via Story 1.7 CLI script → vérifier user Keycloak + email onboarding
     2. Login Story 1.4 → redirect /auth/totp-setup Story 1.7 (CONFIGURE_TOTP required)
     3. Setup TOTP Story 1.7 wizard → vérifier credential + 8 recovery codes
     4. Re-login Story 1.4 avec TOTP → vérifier accès `/admin/dashboard`
   - **Test reconciliation cron** : insert orphan KC user manually → trigger cron → vérifier alerte Slack publish
   - **Test audit_log trigger immutability** : INSERT row → UPDATE/DELETE attempt → vérifier exception raised
   - **Coverage Epic 1 final** : ≥ 80% domain identity-svc, ≥ 70% usecases, ≥ 50% infrastructure (NFR71 strictly applied)

10. **AC10 — Sprint-status finalize Epic 1 + Epic 2 handoff** :
    - **Update `_bmad-output/implementation-artifacts/sprint-status.yaml`** : `epic-1: in-progress → done` (après que toutes les Stories 1.1-1.10 soient `done` post-code-review). Story 1.10 elle-même flip `1-10-...: ready-for-dev → done` après implémentation.
    - **Optional** `epic-1-retrospective: optional → done` après retro session
    - **Slack notification** `#tukio-product` : `"🎉 Epic 1 complete (Identity & Auth Backbone) — Auth foundation ready for Epic 2 (Pro Onboarding + Admin Verification)"`
    - **Update `docs/runbook/identity-svc-handoff-epic-2.md`** finalize avec le résumé des dépendances downstream (Stories 2.1, 4.1, 5.4, 6.x consument identity events)

## Tasks / Subtasks

- [ ] **Task 1 — `@tukio/contracts` extensions Story 1.10** (AC: #1, #2, #3)
  - [ ] 1.1 — Créer events `identity/{login-error,user-logged-in,user-logged-out,user-locked,user-banned,reconciliation-completed}.v1.{schema.json,ts}` (6 events)
  - [ ] 1.2 — Update `types/error-codes.ts` : `AUTH-FORBIDDEN-002` (HMAC mismatch — Story 1.7 a posé)
  - [ ] 1.3 — Build + test

- [ ] **Task 2 — Phasetwo webhook consumer endpoint + use case + idempotence inbox table** (AC: #1)
  - [ ] 2.1 — Créer migration `1715260000001-CreateKeycloakEventsInboxTable.ts`
  - [ ] 2.2 — Créer entity `keycloak-event-inbox.entity.ts` + repo
  - [ ] 2.3 — Créer `usecases/handle-keycloak-event.usecase.ts` + spec (5+ cases : valid HMAC, invalid HMAC, idempotent, unknown event, transform)
  - [ ] 2.4 — Créer controller `infrastructure/http/controllers/keycloak-events.controller.ts`
  - [ ] 2.5 — Helper `infrastructure/http/utils/hmac-verify.ts` (timingSafeEqual)
  - [ ] 2.6 — Update `app.module.ts` + `usecases-proxy.module.ts`
  - [ ] 2.7 — Tests E2E

- [ ] **Task 3 — `audit_log` table + immutability trigger + NATS consumer** (AC: #3)
  - [ ] 3.1 — Créer migration `1715260000000-CreateAuditLogTable.ts` (avec function + trigger PG)
  - [ ] 3.2 — Créer entity `audit-log.entity.ts` (read-only TypeORM via `@Entity({readonly: true})`)
  - [ ] 3.3 — Créer repo `audit-log.typeorm.repository.ts`
  - [ ] 3.4 — Créer `usecases/record-audit-log.usecase.ts` + spec
  - [ ] 3.5 — Créer NATS consumer `messaging/nats/audit-log.consumer.ts` (subscribe `identity.*` + idempotence inbox Story 0.7)
  - [ ] 3.6 — Update `messaging.module.ts` : register consumer
  - [ ] 3.7 — Tests integration : tester INSERT + tester trigger raises sur UPDATE

- [ ] **Task 4 — Reconciliation cron + CLI fix script** (AC: #2, #7)
  - [ ] 4.1 — Créer port `domain/ports/slack-alert.port.ts` (ISlackAlert + Symbol SLACK_ALERT)
  - [ ] 4.2 — Créer impl `infrastructure/external/slack/slack-alert.service.ts` (axios webhook URL Doppler)
  - [ ] 4.3 — Update `keycloak-admin.port.ts` : ajouter `listUsers`, `findByKeycloakUserId`, `deleteUser` (si pas déjà — Stories 1.2/1.9 ont posé)
  - [ ] 4.4 — Update `user-profile.repository.port.ts` : ajouter `findByKeycloakUserId`, `listAll(batchSize)`
  - [ ] 4.5 — Créer `tasks/reconcile-keycloak-drift.task.ts` (Cron 3am UTC daily)
  - [ ] 4.6 — Update `app.module.ts` : provider register
  - [ ] 4.7 — Créer `infra/scripts/reconcile-keycloak-drift.sh` + TS implementation `infra/scripts/reconcile-fix.ts` (3 actions + dry-run)
  - [ ] 4.8 — Add `package.json` aliases `reconcile:dry-run`, `reconcile:fix`
  - [ ] 4.9 — Tests integration : Postgres + Keycloak testcontainer + simuler drift + tester detection + alerte Slack mock

- [ ] **Task 5 — Lint enforcement strict + audit code review boundaries** (AC: #4)
  - [ ] 5.1 — Run `pnpm --filter=identity-svc lint` — vérifier 0 violations
  - [ ] 5.2 — Si violations détectées → fix imports (move I/O code from domain → infrastructure)
  - [ ] 5.3 — Test failure case : créer temp `domain/test-violation.ts` → lint fail → rm
  - [ ] 5.4 — Run `pnpm --filter=identity-svc test:cov` — vérifier thresholds NFR71
  - [ ] 5.5 — Si coverage insuffisant → ajouter tests aux use cases sous-testés
  - [ ] 5.6 — Update `.github/workflows/ci.yml` (Story 0.11) : confirme `pnpm test:cov` step + coverage report uploaded (Codecov ou GitHub PR comment)

- [ ] **Task 6 — Consolidation Value Objects + extraction PasswordPolicy + RoleVO** (AC: #5, #8)
  - [ ] 6.1 — Créer `domain/model/value-objects/password-policy.value-object.ts` (consolide regex + min length de Stories 1.2/1.5/1.7 dispersés)
  - [ ] 6.2 — Créer `domain/service/password-policy.service.ts` (utility `PasswordPolicyService.validate(plaintext): ValidationResult`)
  - [ ] 6.3 — Créer `domain/model/value-objects/role.value-object.ts` (consolide enum `'client' | 'pro' | 'admin-*'` + Symbol)
  - [ ] 6.4 — Créer `domain/model/value-objects/tukio-status.value-object.ts` (`'active' | 'pending_admin_review' | 'rejected' | 'suspended'`)
  - [ ] 6.5 — Refactor Stories 1.2/1.3/1.5/1.7 use cases pour utiliser ces VOs centralisés
  - [ ] 6.6 — Tests unit VOs

- [ ] **Task 7 — Audit structure dossiers identity-svc + cleanup** (AC: #8)
  - [ ] 7.1 — Run `tree apps/identity-svc/src` ou `find ... -type f` — comparer avec structure cible AC8
  - [ ] 7.2 — Identifier fichiers manquants (créer si nécessaire) ou extra (review pour delete/move)
  - [ ] 7.3 — Verify `usecases-proxy.module.ts` wire 15 use cases avec Symbol tokens corrects
  - [ ] 7.4 — Code review pull request final Epic 1

- [ ] **Task 8 — Tests integration end-to-end Epic 1 (Customer + Pro + Admin journeys)** (AC: #9)
  - [ ] 8.1 — Créer `apps/public/e2e/integration/customer-journey.spec.ts` (test 7-step Customer flow)
  - [ ] 8.2 — Créer `apps/public/e2e/integration/pro-journey.spec.ts` (test 4-step Pro flow)
  - [ ] 8.3 — Créer `apps/admin/e2e/integration/admin-journey.spec.ts` (test 4-step Admin flow including TOTP setup)
  - [ ] 8.4 — Helpers : MailHog API + token extraction + testcontainer setup
  - [ ] 8.5 — Tag `@epic-1` sur tests pour run ciblé `--grep "@epic-1"`
  - [ ] 8.6 — Run en CI nightly `.github/workflows/e2e-epic-1.yml` (NEW workflow Story 1.10)

- [ ] **Task 9 — Documentation Epic 1 close-out** (AC: #6)
  - [ ] 9.1 — Update `docs/project-context.md` : section "Identity & Auth Backbone (Epic 1 finalized)" (~150 lignes)
  - [ ] 9.2 — Update `docs/adr/0009-keycloak-identity-svc-split.md` : Implementation Notes finalized
  - [ ] 9.3 — Créer `docs/runbook/identity-svc-handoff-epic-2.md` (~50 lignes)
  - [ ] 9.4 — Update `packages/contracts/README.md` : Epic 1 catalog (12 events + 5 templates + error codes)

- [ ] **Task 10 — Sprint-status finalize + Epic 1 retrospective + commit** (AC: #10)
  - [ ] 10.1 — Verify toutes Stories 1.1-1.10 status `done` (post-code-review chacune)
  - [ ] 10.2 — Update `sprint-status.yaml` : `epic-1: done` + last_updated
  - [ ] 10.3 — Optional : Slack notification `#tukio-product` Epic 1 complete
  - [ ] 10.4 — Lint + typecheck + tests + coverage NFR71 strictly verified
  - [ ] 10.5 — Commit `feat(identity): identity-svc Epic 1 final consolidation (Phasetwo webhook consumer + audit_log immutable + reconciliation cron + lint boundaries strict + 15 use cases consolidated + Epic 1 close-out docs)` — Story 1.10 done — Epic 1 done

## Dev Notes

### Pourquoi Story 1.10 = Epic 1 close-out story

> **Sources** : `architecture.md` §Pretre + §Audit + ADR-009 ; `prd.md` §NFR1 (RGPD audit) + §NFR71 (coverage) + §NFR21 (audit avocat) ; `epics.md` §Story 1.10 (lignes 1222-1238) ; Stories 1.1-1.9 + memories.

Story 1.10 n'est PAS une feature story. C'est une **consolidation + audit + close-out story**. Elle :
1. **Audite + verifie** que le code Stories 1.2-1.9 est cohérent + lint-clean + coverage thresholds
2. **Livre les pièces manquantes** identifiées (Phasetwo webhook consumer, reconciliation cron, audit_log)
3. **Documente** la handoff Epic 2

**Story 1.10 = preuve de qualité Epic 1.** Sans Story 1.10, Epic 1 livre un système fonctionnel mais avec des trous (drift R8 pas mitigated, audit_log absent, Phasetwo bridge incomplete, lint boundaries pas strictement enforced). Story 1.10 ferme ces trous.

### Décisions techniques majeures actées

1. **Phasetwo webhook consumer** = use case standalone Story 1.10 (pas split par event type) — Pretre simple, idempotence via inbox table dédiée `keycloak_events_inbox`
2. **Reconciliation orphan KC NOT auto-delete** — manual review via CLI script (sécurité before automation)
3. **`audit_log` table immutable trigger Postgres natif** (pas application-level guard) — RGPD-compliant + LCEN robust
4. **NATS consumer pattern audit_log** — subscribe `identity.*` events, INSERT only (no UPDATE/DELETE possible — trigger blocks)
5. **Cron reconciliation 3am UTC** — avant cron purge 4am Story 1.9 (ordre : reconcile → purge — fix drift before delete)
6. **VOs consolidation Story 1.10** : extract `password-policy.vo`, `role.vo`, `tukio-status.vo` qui étaient dispersés Stories 1.2/1.5/1.7
7. **Slack alerts** via `ISlackAlert` port + `SlackAlertService` impl (axios webhook) — réutilisable Stories Epic 6+
8. **Tests integration end-to-end Epic 1** journey-based (Customer + Pro + Admin) — confirme l'intégration cross-stories
9. **Documentation Epic 1 close-out** : `project-context.md` + ADR-009 update + runbook handoff Epic 2

### Versions à utiliser

| Lib | Rôle | Version |
|---|---|---|
| Existing : `@nestjs/schedule` (Story 1.9), `@keycloak/keycloak-admin-client` (Story 1.2), `axios`, ioredis (Story 1.7), nock (tests) | — | — |
| **`@slack/webhook`** | Slack alerts (Story 1.10 ajout) | latest stable |
| **No new heavy deps** Story 1.10 | — | — |

### Project Structure cible

(cf. AC8 — structure dossiers complète)

### Critical Architecture Constraints

> Cf. Stories 1.1-1.9 + memories. Patterns réutilisés strictement.

1. **Pretre boundaries strict** (Story 0.6 AC8 + Story 1.10 AC4) — domain pure, lint enforce
2. **Symbol DI tokens partout** (Story 0.6 + Story 1.10 verify)
3. **Outbox transactional** (Story 0.7) — toutes les events publiés dans transaction DB
4. **Inbox idempotence** (Story 0.7 + Story 1.10 patterns) — Phasetwo webhook + audit_log consumer
5. **Audit_log immutable** (LCEN + RGPD)
6. **Reconciliation orphan manual review** (sécurité before automation)
7. **i18n + EN strict** memories réutilisés

### Previous Story Intelligence

**Stories 1.1-1.9** : tous les use cases + tables + events sont déjà livrés. Story 1.10 :
- **Audite** la cohérence Pretre + structure dossiers + boundaries lint
- **Consolide** les VOs dispersés (Task 6)
- **Wire** les 2 pièces manquantes (Phasetwo webhook + reconciliation cron) qui étaient identifiées dans les Stories précédentes mais non implémentées (Story 1.1 AC5 attendait Story 1.10 endpoint, Story 1.2/1.3 compensation drift attendait reconciliation cron Story 1.10)
- **Crée** `audit_log` table + consumer (utilisable rétroactivement pour Stories 1.4/1.7/1.9 events publiés)

### What this story does NOT do (out of scope)

- ❌ **Audit log UI consultation admin** → Story 2.7 (Story 1.10 livre la table + données)
- ❌ **Pro 2FA optionnel** → V1 FR10 (réutilise pattern Story 1.7)
- ❌ **B2B Customer Account** → V1 FR2 Epic 8
- ❌ **Conversion compte client → Pro** → V1 FR13
- ❌ **Login social Google + Apple** → V1 FR5
- ❌ **SAML SSO B2B Enterprise** → V2 FR6
- ❌ **Stripe Connect Express integration** → Epic 2 Story 2.1
- ❌ **Admin verification queue UI** → Epic 2 Story 2.3
- ❌ **GDPR data export portability** → V1 (réutilise pattern Story 1.5/1.6 token-based)

### Files to UPDATE vs CREATE

(cf. Project Structure cible AC8)

### Testing Standards

- Coverage strictly enforced NFR71 (domain ≥ 80%, usecases ≥ 70%, infrastructure ≥ 50%)
- Lint boundaries strict (Story 0.6 AC8) — 0 violations
- Tests integration end-to-end Customer + Pro + Admin journeys (NEW Story 1.10)
- Tests reconciliation cron (Postgres + Keycloak testcontainers)
- Tests audit_log trigger immutability

### Project Structure Notes

✅ Aligné avec architecture, PRD, epics, Stories 1.1-1.9, memories.

⚠️ **Décision** : Phasetwo webhook consumer = use case standalone (pas split par event type) — simplification Pretre.

⚠️ **Décision** : reconciliation orphan KC = manual review via CLI (pas auto-delete) — sécurité.

⚠️ **Décision** : `audit_log` immutable trigger Postgres natif (pas application-level) — RGPD/LCEN robust.

⚠️ **À noter** : Story 2.7 ajoute UI consultation `audit_log` (filter, search, export). Story 1.10 livre la table + données seulement.

### References

- [Source: epics.md#Epic-1-Story-1.10 — Lines 1222-1238]
- [Source: architecture.md#Pretre + ADR-009 + ADR-014 envelope]
- [Source: prd.md#NFR1 (audit RGPD), #NFR21 (audit avocat), #NFR71 (coverage)]
- [Source: 1-1-...md — Phasetwo Webhooks Extension setup AC5 + Required Actions AC3]
- [Source: 1-2-...md — UserProfile + KeycloakAdminService + email_verification_tokens table]
- [Source: 1-3-...md — ProProfile + INSEE + R2 + ProAddress VO]
- [Source: 1-4-...md — login flow + force-refresh + middleware admin/customer/seller]
- [Source: 1-5-...md — password reset + IdentityExpiredException pattern]
- [Source: 1-6-...md — email verify + force-refresh post-verify + email_verification_tokens reused]
- [Source: 1-7-...md — admin TOTP + recovery codes Keycloak natif + Slack alerts pattern]
- [Source: 1-8-...md — me.controller + UserProfile domain methods + Keycloak sync]
- [Source: 1-9-...md — soft-delete + anonymisation + cron purge + booking-svc client port]
- [Source: 0-13-...md — ADR-009 + acquisition_*]
- [External: https://github.com/p2-inc/keycloak-events — Phasetwo Webhooks Extension docs]
- [External: https://www.postgresql.org/docs/current/sql-createtrigger.html — Postgres trigger immutability]
- [External: https://eur-lex.europa.eu/eli/reg/2016/679/oj — RGPD]
- [Memory: feedback_clean_architecture_explicit.md, feedback_api_envelope_response.md, feedback_tech_layer_english.md, feedback_i18n_frontend.md, feedback_latest_versions.md, feedback_comprehensive_briefs.md]

## Dev Agent Record

(à remplir)

---

## Story Completion Status

- **Story Status** : `ready-for-dev`
- **Created** : 2026-05-09
- **Created by** : `bmad-create-story` workflow
- **Epic** : Epic 1 — Identity & Authentication Backbone (MVP) — **CLOSING STORY**
- **Sprint cible** : Sprint 2 (10ᵉ et dernière story Epic 1)
- **Estimation effort** : 3-5 jours (1 dev senior — story consolidation + audit + 2 features critiques manquantes Phasetwo webhook + reconciliation cron + audit_log)
- **Dépendances upstream** :
  - **Stories 1.1-1.9** TOUTES doivent être implémentées avant Story 1.10 (consolidation = audit final)
- **Dépendances downstream** :
  - **Story 2.1** (Stripe Connect Express) — démarre Epic 2 sur fondation Epic 1 finalisée
  - **Story 2.7** (Admin audit log UI) — consume `audit_log` table livrée Story 1.10
  - **Stories Epic 4** (booking-svc) — réutilisent patterns Pretre + outbox + audit_log
  - **Stories Epic 5** (notification-svc) — consume 5 templates Resend Epic 1
  - **Stories Epic 6** (admin moderation) — consume `audit_log` + admin sanction patterns
  - **V1 FR5** (social login), **V1 FR10** (Pro 2FA), **V1 FR13** (client→pro conversion), **V2 FR6** (SAML SSO) — tous extensions de Epic 1 fondation
- **FRs covered** :
  - **FR1-FR17** ✅ tous backed par identity-svc Pretre Stories 1.2-1.9 — Story 1.10 audite/consolide
- **NFRs touchés** :
  - **NFR1** ✅ RGPD audit_log immuable + reconciliation
  - **NFR9-13** ✅ Sécurité auth (JWT + cookies + MFA + sessions)
  - **NFR15** ✅ KYC docs encrypted + signed URLs
  - **NFR21** ✅ LCEN audit avocat (audit_log immutable trigger)
  - **NFR42** ✅ Outbox transactional cohérence
  - **NFR71** ✅ Coverage thresholds strictly enforced Story 1.10
  - **R8** ✅ Drift Keycloak ↔ DB mitigated via reconciliation cron + manual fix CLI

> **🎉 Epic 1 — Identity & Authentication Backbone CLOSED-OUT après cette story**
>
> **Prochaine story → Story 2.1** (Stripe Connect Express account creation + onboarding) — démarre Epic 2 (Pro Onboarding & Admin Verification)

---

**Dev agent next steps :**
1. Lire ce file en entier
2. Vérifier upstream Stories 1.1-1.9 ALL implementées + en `done` post-code-review
3. **CRITIQUE Task 5 lint** : run `pnpm --filter=identity-svc lint` AVANT de start Tasks 1-4 — si violations, fix d'abord
4. Implémenter Tasks 1-10 dans l'ordre
5. Lancer après chaque jalon : `pnpm lint && pnpm typecheck && pnpm test --filter=identity-svc --coverage && pnpm playwright test --grep "@epic-1"`
6. Commit Story 1.10 quand : 0 lint violations + coverage NFR71 + 3 e2e journeys pass + audit_log trigger tested + reconciliation cron tested
7. Update sprint-status : `1-10-...: review` puis `done` puis `epic-1: done`
8. **Slack notification** `#tukio-product` : Epic 1 complete 🎉
