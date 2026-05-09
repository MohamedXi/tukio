# Story 2.7: Audit trail toutes actions admin (extend admin.*, query endpoints, RGPD droit accès, archive R2 5 ans)

Status: ready-for-dev

## Story

**As an** Admin Super (FR89, FR94-95) + tout user RGPD (NFR1 droit d'accès),
**I want** **finaliser l'audit trail** Story 1.10 baseline avec :
- (1) **extension du subscription `AuditLogConsumer` Story 1.10** pour capturer également `admin.*` events (Stories 2.4 `admin.verification.viewed.v1`, 2.4 `admin.stripe.synced.v1`, future Stories 6.x sanctions/exports/réplays) — Story 1.10 line 184 avait reservé "+ admin.* V1+", Story 2.7 active maintenant ;
- (2) **endpoint `GET /v1/admin/audit`** paginé cursor (pattern Story 2.3) avec filtres (`actor_id`, `action_type` wildcard, `aggregate_type`, `aggregate_id`, `from`, `to`) — **data exposition** pour Story 6.6 V1 UI consultation (Story 2.7 ne livre PAS l'UI, juste l'API stable). RBAC strict : `admin-modo` voit ses propres actions uniquement (`actor_id = self.userId` filter forcé application-level — non bypassable), `admin-super` sees all ;
- (3) **endpoint user-facing RGPD `GET /v1/me/admin-actions`** qui retourne la liste des actions admin **sur le compte du user authentifié** (`aggregate_id IN (userProfile.id, proProfile.id?)`) avec **PII redaction côté response** : l'identité concrète de l'admin (`adminName`, `adminId`) est masquée et remplacée par un label générique constant (`actor: 'tukio-team'` + `actorLabel: 'Équipe Tukio'` FR / `'Tukio Team'` EN) + l'action_type traduit en langage compréhensible via mapping i18n (e.g., `identity.pro.verified` → "Votre dossier KYC a été validé" / "Your KYC application was approved") + raison rendue intelligible (e.g., reasonCode `siret_invalid` → "SIRET invalide" via Story 2.5 keys réutilisés) + filter actions techniques non user-visibles (e.g., `admin.verification.viewed`, `admin.stripe.synced`, `identity.keycloak-sync.failed`, `admin.audit-tamper-attempt`, `admin.audit-log.archived`) ;
- (4) **defense in depth Postgres RLS policies + dedicated archive role** : le rôle DB applicatif `tukio_identity_app` (Story 0.10) a **uniquement `INSERT, SELECT`** sur `audit_log` (pas `UPDATE, DELETE, ALTER, TRUNCATE`) — un dev compromis côté app ne peut pas tamperer même en bypass code (le trigger Story 1.10 protège au row-level, RLS Story 2.7 protège au schéma/table-level). Dedicated `tukio_audit_archiver` role (NEW Story 2.7) avec `SELECT, DELETE` + `session_replication_role = 'replica'` (lift trigger temporarily for monthly archive cron) ;
- (5) **trigger Postgres handler tamper attempt** : if `UPDATE`/`DELETE` attempt arrives (e.g., bug applicatif, dev forced) → trigger raise exception (Story 1.10 livré) + Story 2.7 capture cet événement via `pg_notify('audit_tamper_attempts', payload)` consommé par identity-svc listener (NEW Story 2.7 — TypeORM raw pool LISTEN) qui publie outbox event `admin.audit-tamper-attempt.v1` (NEW Story 2.7 — payload `{ attemptedAt, attemptedByRole, operation, targetAuditId, targetActionType }`) → Slack `#tukio-alerts-critical` immediate page admin-super (anti-tampering NFR82 critique) ;
- (6) **cron `archive-audit-log.task.ts` mensuel** (`@nestjs/schedule` `@Cron('0 4 1 * *')` — 4am UTC le 1er du mois, pattern Story 1.9 réutilisé) qui : (a) `SELECT * FROM audit_log WHERE at < NOW() - INTERVAL '5 years' LIMIT 10000`, (b) groupe par year/month → écrit chaque batch dans Cloudflare R2 bucket `tukio-audit-archive` (NEW Story 2.7 — server-side encryption AES-256, lifecycle 99 ans cold storage compliance LCEN/RGPD) avec path Hive-style `audit-archive/year=YYYY/month=MM/audit-YYYY-MM-{checksum}.jsonl.gz` (gzip compressed JSONL — Athena/Spark queryable later for legal investigations), (c) checksum verify post-upload (HEAD object), (d) DELETE batch from audit_log (using `tukio_audit_archiver` role — `session_replication_role='replica'` lifts trigger), (e) publish outbox event `admin.audit-log.archived.v1` (NEW Story 2.7 — meta-audit), (f) métriques Prom + idempotent (same checksum = same R2 key = re-run safe) + transactional fail rollback (R2 down → batch not deleted → next run retry) ;
- (7) **`POST /v1/admin/audit/export`** async background job (admin-super only) — query → write CSV/JSONL → upload R2 chiffré `tukio-audit-archive/exports/{actorId}/audit-export-{jobId}.{csv,jsonl}.gz` → email signed URL TTL 30 min via notification-svc Story 5.4 future (Story 2.7 livre l'endpoint + BullMQ worker + R2 upload + event published, notification-svc consume future) ;
- (8) **métriques + Prometheus alerts** : `tukio_audit_log_inserts_total` (counter rate), `tukio_audit_log_size_total{partition='hot'|'archive'}` (gauge), `tukio_audit_log_archive_rows_total` + `tukio_audit_log_archive_size_bytes` + `tukio_audit_log_archive_lag_days` + `tukio_audit_log_last_archive_at_unix` + `tukio_audit_tamper_attempts_total` (CRITICAL — should ALWAYS be 0) + `tukio_audit_log_exports_total{format}` ; Prometheus rules `identity-audit-log.yaml` : `AuditTamperAttempt > 0 / 5min → severity=critical page-oncall-admin-super`, `AuditLogArchiveFailed > 35 days → warning`, `AuditLogArchiveLagHigh > 5.5y → warning`,

**so that** Tukio satisfait les exigences **LCEN avocat numérique** (audit immutable + traçable + interrogeable post-incident — R2 mitigation gating launch) + **RGPD avocat** (droit d'accès user-facing intelligible + retention 5 ans + cold storage 99 ans) + **expert-comptable** (R1 mitigation — audit_log INSERT-only avec retention compliance) ; les Stories Epic 6 (admin moderation Story 6.6 audit UI + Story 6.5 sanctions consume audit_log) ont leur **API ready** quand elles seront développées V1 ; le **pattern complet "extend subscription + paginated query + RGPD redaction + cron archive R2 + RLS defense + tamper-attempt detection"** devient template Stories 10.x V1 (dispute audit), Stories Epic 5 (messaging audit FR74 5 ans retention).

> **Outcome attendu** : à la fin de cette story, l'AuditLogConsumer subscribe maintenant `identity.*` + `admin.*` events — un event `admin.verification.viewed.v1` Story 2.4 publié → consume → INSERT `audit_log` row (action_type=`admin.verification.viewed`, actor_id=adminId, aggregate_type=`ProProfile`, aggregate_id=proId, at=NOW) ; un `admin-super` Léa appelle `GET /v1/admin/audit?actor_id={leaId}&action_type=admin.verification.*&from=2026-05-01&pageSize=50&cursor=` → 200 enveloppe paginée 50 dernières actions de Léa filtrées ; un Pro Marc appelle `GET /v1/me/admin-actions` → 200 enveloppe avec ses propres actions (e.g., "2026-05-09 14:32 — Votre dossier KYC a été validé par l'Équipe Tukio") sans révéler `adminId`/`adminName` (RGPD anonymisation) ; un dev mal intentionné essaie `UPDATE audit_log SET reason='fake' WHERE id=...` via app code → Postgres trigger raise exception "audit_log is immutable" (Story 1.10) → exception bubble + identity-svc listener pg_notify capture → publie `admin.audit-tamper-attempt.v1` → Slack `#tukio-alerts-critical` page admin-super dans la minute ; le 1er du mois 4am UTC, cron archive tourne sur audit_log > 5 ans (fixture > 5 ans pour test) → batch 10000 rows → upload R2 `tukio-audit-archive/year=2021/month=05/audit-2021-05-{hash}.jsonl.gz` chiffré AES-256 → checksum verify → DELETE rows from DB chaude → publie `admin.audit-log.archived.v1` → métriques updates ; un test `pnpm playwright test --grep "audit trail"` passe FR/EN axe-core 0 violations 11 scénarios (subscription admin.*, admin endpoint pagination + filters + cursor, /v1/me RGPD redaction FR + EN, RLS no UPDATE/DELETE/ALTER, trigger UPDATE rejected, tamper-attempt event published Slack mock, cron archive happy path testcontainer 5y fixture, cron archive mid-fail rollback, export CSV background job R2 upload, métrique baseline) ; coverage ≥ 100 % AuditTamperListener (security critical) + 95 % consumer extension subscription + 90 % cron + endpoint.

## Acceptance Criteria

1. **AC1 — AuditLogConsumer subscription extension `identity.*` + `admin.*`** : Given Story 1.10 a livré le consumer subscribe `identity.*`, When Story 2.7 étend, Then :
   - **UPDATE `apps/identity-svc/src/infrastructure/messaging/nats/audit-log.consumer.ts`** :
     ```ts
     @NatsConsumer({
       subjects: ['identity.>', 'admin.>'], // Story 2.7: extend admin.*
       durable: 'identity-svc-audit-log',
       inboxTable: 'inbox',
     })
     export class AuditLogConsumer {
       @Handler()
       async handle(event: NatsEvent<unknown>): Promise<void> {
         await this.recordAuditLog.execute({
           eventType: event.eventType, eventVersion: event.eventVersion,
           aggregate: event.aggregate, actor: event.actor, correlationId: event.correlationId,
           payload: event.payload, occurredAt: event.occurredAt,
         });
       }
     }
     ```
   - **Subjects covered** : `identity.user.*`, `identity.pro.*`, `identity.admin.*`, `identity.reconciliation.*`, `identity.keycloak-sync.*`, `admin.verification.*` (Story 2.4), `admin.stripe.*` (Story 2.4), `admin.audit-tamper-attempt.*` (meta — Story 2.7 itself), `admin.audit-log.archived.*` (meta), `admin.audit-log.export-ready.*`, future `admin.account-suspended.*`, `admin.account-banned.*`, etc.
   - **Idempotence** : inbox table check (Story 0.7 pattern)
   - Tests integration : 3 cases — admin.* event INSERT visible, dedupe via inbox, identity.* still works

2. **AC2 — `GET /v1/admin/audit` paginated endpoint** : Given Story 6.6 V1 future UI consume, When Story 2.7 expose, Then :
   - **NEW gateway endpoint** :
     ```ts
     @Controller('/v1/admin/audit')
     @UseGuards(KeycloakJwtGuard, RolesGuard)
     @Roles('admin-modo', 'admin-super')
     export class AdminAuditController {
       @Get('/')
       @HttpCode(200)
       async list(@Query() query: ListAuditLogQuery, @CurrentActor() actor: Actor, @Res({ passthrough: true }) res: Response): Promise<AuditLogEntry[]> {
         const result = await this.adminAuditForwarder.getInstance().list({ query, actor });
         res.locals.pagination = { nextCursor: result.nextCursor, hasMore: result.hasMore, totalEstimate: result.totalEstimate, limit: query.pageSize ?? 50 };
         return result.items;
       }
     }
     ```
   - **Validation Zod** `ListAuditLogQuerySchema` :
     ```ts
     z.object({
       actorId: z.string().uuid().optional(),
       actionType: z.string().regex(/^[a-z]+(\.[a-z-]+)*\*?$/).optional(), // wildcard suffix support
       aggregateType: z.enum(['UserProfile', 'ProProfile', 'Booking', 'Order', 'Listing', 'Review', 'Conversation', 'Message', 'Dispute']).optional(),
       aggregateId: z.string().uuid().optional(),
       from: z.string().datetime().optional(),
       to: z.string().datetime().optional(),
       pageSize: z.number().int().min(1).max(200).default(50),
       cursor: z.string().optional(),
       sort: z.enum(['at:desc', 'at:asc']).default('at:desc'),
     });
     ```
   - **Cursor pagination composite `(at, id)`** Story 2.3 pattern : `WHERE (at, id) < (cursor.at, cursor.id) ORDER BY at DESC, id DESC LIMIT pageSize+1`
   - **RBAC application-level** : `admin-modo` → forwarder injects `actor_id = self.userId` filter automatically (cannot bypass via curl) ; `admin-super` → no auto-filter
   - **Throttle** : 60/min/user
   - Tests E2E : 6 scénarios — admin-super tous results, admin-modo only own actions even with override attempt, filter by aggregate_id, wildcard `admin.verification.*`, date range, cursor pagination

3. **AC3 — `GET /v1/me/admin-actions` RGPD endpoint user-facing avec PII redaction** : Given NFR1 droit d'accès, When :
   - **NEW gateway endpoint** :
     ```ts
     @Get('/v1/me/admin-actions')
     @UseGuards(KeycloakJwtGuard, RolesGuard)
     @Roles('client', 'pro') // not admin-* (admins use /v1/admin/audit)
     @HttpCode(200)
     async myAdminActions(@CurrentActor() actor: Actor, @Query() query: ListMyAdminActionsQuery, @AcceptLanguage() locale: 'fr' | 'en'): Promise<MyAdminAction[]> {
       return this.myAdminActionsForwarder.getInstance().list({ userProfileId: actor.userId, query, locale });
     }
     ```
   - **identity-svc internal use case `GetMyAdminActionsUseCase`** :
     - Fetch UserProfile + (if pro role) ProProfile owned by user
     - Build `aggregateIds` set : `[userProfile.id]` + (if pro) `[proProfile.id]` + (V1+ bookings/listings owned)
     - Query `audit_log WHERE aggregate_id IN ($aggregateIds) ORDER BY at DESC LIMIT 100`
     - **Map to user-facing shape with PII redaction** :
       ```ts
       interface MyAdminAction {
         at: string; actionType: string; actionLabel: string; // i18n
         actor: 'tukio-team'; // ALWAYS this constant — adminId/adminName redacted
         actorLabel: string; // i18n 'Équipe Tukio' / 'Tukio Team'
         reason?: string; // i18n translated reasonCode
         message?: string; // free text from admin (kept as-is — admin wrote it intended for user)
       }
       ```
   - **i18n labels mapping** NEW file `apps/identity-svc/src/usecases/audit-action-labels.ts` :
     ```ts
     export const AUDIT_ACTION_LABELS_FR: Record<string, string> = {
       'identity.pro.verified': 'Votre dossier KYC a été validé',
       'identity.pro.rejected': 'Votre dossier KYC a été rejeté',
       'identity.pro.kyc-restart-requested': 'Vous avez relancé votre dossier KYC',
       'identity.pro.onboarded': 'Votre onboarding est terminé',
       'identity.pro.onboarding-reminder-sent': 'Tukio vous a relancé pour publier votre 1ère fiche',
       'identity.pro.auto-rejected': 'Votre dossier KYC a été automatiquement fermé pour inactivité',
       'identity.user.deleted': 'Votre compte a été supprimé',
     };
     export const AUDIT_ACTION_LABELS_EN: Record<string, string> = { /* mirror FR */ };
     export const AUDIT_ACTIONS_NOT_USER_VISIBLE = new Set<string>([
       'admin.verification.viewed', 'admin.stripe.synced', 'admin.audit-tamper-attempt',
       'admin.audit-log.archived', 'admin.audit-log.export-ready', 'identity.keycloak-sync.failed',
       'identity.reconciliation.completed',
     ]);
     ```
   - **Filter `AUDIT_ACTIONS_NOT_USER_VISIBLE`** — technical/admin-internal actions never user-facing
   - **Reason translation** réutilise namespace `seller.onboarding.rejected.reasons.*` Story 2.5
   - **Throttle** : 30/min/user
   - Tests E2E : 5 scénarios — pro fixture 3 audit_log rows (1 verified + 1 admin viewed [filtered] + 1 reminder) → response 2 entries. Customer 0 actions → empty. Curl other user → 403. FR/EN locale labels.

4. **AC4 — Postgres RLS policies + dedicated `tukio_audit_archiver` role** : Given defense in depth NFR82, When je consulte migration `1715293000000-HardenAuditLogRLS.ts`, Then :
   - **Migration** :
     ```sql
     -- Defense in depth: app role only INSERT, SELECT
     REVOKE ALL ON audit_log FROM tukio_identity_app;
     GRANT INSERT, SELECT ON audit_log TO tukio_identity_app;
     -- TypeORM ALTER TABLE statements blocked by lack of ALTER privilege

     -- Dedicated archiver role
     CREATE ROLE tukio_audit_archiver NOINHERIT LOGIN PASSWORD '...'; -- Doppler
     GRANT SELECT, DELETE ON audit_log TO tukio_audit_archiver;
     ALTER ROLE tukio_audit_archiver SET session_replication_role = 'replica';

     -- Update Story 1.10 trigger function with pg_notify
     CREATE OR REPLACE FUNCTION raise_immutability_error()
     RETURNS TRIGGER AS $$
     BEGIN
       PERFORM pg_notify('audit_tamper_attempts', json_build_object(
         'attempted_at', NOW(), 'attempted_by_role', current_user, 'operation', TG_OP,
         'target_audit_id', OLD.id, 'target_action_type', OLD.action_type
       )::text);
       RAISE EXCEPTION 'audit_log is immutable. Update/Delete forbidden. Operation: %, Row: %', TG_OP, OLD.id;
     END;
     $$ LANGUAGE plpgsql;
     ```
   - **`down()`** : reverse — restore Story 1.10 function without pg_notify, DROP role, GRANT ALL
   - **Doppler secret NEW** : `TUKIO_AUDIT_ARCHIVER_DB_PASSWORD`
   - Tests integration testcontainer 6 cases (cf. AC9 Test 4-7)

5. **AC5 — `pg_notify` listener + `admin.audit-tamper-attempt.v1` event publisher** : Given AC4 trigger, When identity-svc starts, Then :
   - **NEW component** `apps/identity-svc/src/infrastructure/persistence/typeorm/listeners/audit-tamper-listener.service.ts` :
     ```ts
     @Injectable()
     export class AuditTamperListener implements OnModuleInit, OnModuleDestroy {
       async onModuleInit(): Promise<void> {
         this.client = await this.dbModule.getRawPool();
         await this.client.query('LISTEN audit_tamper_attempts');
         this.client.on('notification', async (msg) => {
           if (msg.channel !== 'audit_tamper_attempts') return;
           const payload = JSON.parse(msg.payload!);
           this.logger.error({ payload }, '🚨 audit_log tamper attempt detected');
           await this.eventPublisher.publishStandalone({
             eventType: 'admin.audit-tamper-attempt', eventVersion: 'v1',
             aggregate: { type: 'AuditLog', id: payload.target_audit_id ?? 'unknown' },
             actor: { userId: 'system', role: 'system' },
             correlationId: randomUUID(),
             payload: { attemptedAt: payload.attempted_at, attemptedByRole: payload.attempted_by_role, operation: payload.operation, targetAuditId: payload.target_audit_id, targetActionType: payload.target_action_type },
             occurredAt: new Date(),
           });
           this.metrics.counter('tukio_audit_tamper_attempts_total').inc();
         });
       }
       async onModuleDestroy(): Promise<void> { await this.client?.query('UNLISTEN audit_tamper_attempts'); await this.client?.release(); }
     }
     ```
   - **NEW event schema** `admin/audit-tamper-attempt.v1.{schema.json,ts}`
   - **Wire** `infrastructure.module.ts` providers
   - Tests integration : trigger UPDATE attempt → pg_notify → listener catches → outbox event published + Slack mock fired (Prom alert AC8 routes Slack)

6. **AC6 — Cron `archive-audit-log.task.ts` mensuel + R2 archive bucket** : Given NFR1 retention 5 ans, When je consulte `apps/identity-svc/src/infrastructure/tasks/archive-audit-log.task.ts`, Then :
   - **NEW task** `@Cron('0 4 1 * *', { timeZone: 'UTC' })` (4am UTC 1st of month) :
     ```ts
     async run(): Promise<void> {
       const cutoff = new Date(); cutoff.setFullYear(cutoff.getFullYear() - 5);
       let totalArchived = 0;
       while (true) {
         const batch = await this.auditLogRepo.findBatchOlderThan({ cutoff, limit: 10000 });
         if (batch.length === 0) break;
         const byMonth = groupBy(batch, row => `${row.at.getUTCFullYear()}-${String(row.at.getUTCMonth() + 1).padStart(2, '0')}`);
         for (const [yearMonth, rows] of Object.entries(byMonth)) {
           const [year, month] = yearMonth.split('-');
           const jsonl = rows.map(r => JSON.stringify(r)).join('\n');
           const gzipped = await gzip(Buffer.from(jsonl, 'utf-8'));
           const checksum = sha256(gzipped);
           const archiveKey = `audit-archive/year=${year}/month=${month}/audit-${yearMonth}-${checksum.slice(0, 12)}.jsonl.gz`;
           await this.mediaStorage.upload({ bucket: 'tukio-audit-archive', key: archiveKey, body: gzipped, contentType: 'application/x-ndjson+gzip', serverSideEncryption: 'AES256', metadata: { rowCount: String(rows.length), checksum, archivedAt: new Date().toISOString() } });
           const verified = await this.mediaStorage.verifyChecksum({ bucket: 'tukio-audit-archive', key: archiveKey, expectedChecksum: checksum });
           if (!verified) throw new ArchiveVerificationFailedError({ archiveKey, expectedChecksum: checksum });
           const deletedCount = await this.auditLogRepo.deleteBatch({ ids: rows.map(r => r.id) });
           await this.eventPublisher.publishStandalone({ eventType: 'admin.audit-log.archived', eventVersion: 'v1', aggregate: { type: 'AuditLog', id: archiveKey }, actor: { userId: 'system', role: 'system' }, correlationId, payload: { archivedRowsCount: rows.length, oldestRowAt: rows[rows.length-1].at.toISOString(), newestRowAt: rows[0].at.toISOString(), r2ArchiveKey: archiveKey, monthPartition: yearMonth, checksum }, occurredAt: new Date() });
           this.metrics.counter('tukio_audit_log_archive_rows_total').inc(rows.length);
           this.metrics.counter('tukio_audit_log_archive_size_bytes').inc(gzipped.length);
           totalArchived += rows.length;
         }
       }
       this.metrics.gauge('tukio_audit_log_last_archive_at_unix').set(Math.floor(Date.now() / 1000));
     }
     ```
   - **NEW R2 bucket** `tukio-audit-archive` — provisioning UPDATE `infra/scripts/provision-r2-buckets.sh` (server-side encryption AES-256 + lifecycle 99 ans cold storage)
   - **NEW repo methods** `IAuditLogRepository.findBatchOlderThan` + `deleteBatch` (uses `tukio_audit_archiver` connection — `session_replication_role='replica'` lifts trigger)
   - **NEW R2 method** `IMediaStorage.verifyChecksum({ bucket, key, expectedChecksum })` (Story 1.3 port extended) — HEAD object + compare ETag/checksum
   - **NEW exception** `ArchiveVerificationFailedError`
   - **Failure handling** : R2 upload fail OR checksum verify fail → throw → batch NOT deleted from DB → next cron retry idempotent (same checksum = same R2 key)
   - Tests integration testcontainer LocalStack S3 + Postgres : 4 scenarios — happy archive 100 rows, partial fail R2, idempotent re-run skips already-archived, 5y boundary edge case

7. **AC7 — `POST /v1/admin/audit/export` async background job** : Given Story 6.6 V1 future export, When :
   - **NEW gateway endpoint** :
     ```ts
     @Post('/export')
     @UseGuards(KeycloakJwtGuard, RolesGuard)
     @Roles('admin-super')
     @HttpCode(202) // accepted async job
     async export(@Body() body: ExportAuditLogInput, @CurrentActor() actor: Actor): Promise<{ jobId: string; expectedReadyAt: string }> {
       return this.adminAuditExportForwarder.getInstance().enqueue({ filters: body.filters, format: body.format, actor });
     }
     ```
   - **Body** : `{ filters: { actorId?, actionType?, aggregateType?, from?, to? }, format: 'csv' | 'jsonl' }`
   - **Job flow** (BullMQ + Redis Story 0.10 — pattern réutilisé Story 0.7) :
     1. Validate + enqueue job `audit-log-export`
     2. Worker `audit-log-export.worker.ts` (NEW Story 2.7) consume :
        - Query audit_log filters (paginated batches)
        - Stream to CSV/JSONL → gzip → upload R2 `tukio-audit-archive/exports/{actorId}/audit-export-{jobId}.{csv,jsonl}.gz`
        - Generate signed URL TTL 30 min (NFR15 short)
        - Publish outbox event `admin.audit-log.export-ready.v1` (NEW Story 2.7) consumed Story 5.4 future → email
   - **Métrique** `tukio_audit_log_exports_total{format}`
   - Tests E2E : enqueue → worker → R2 file + signed URL valid + event published. admin-modo → 403.

8. **AC8 — Métriques Prom + Slack alerts** :
   - **Métriques NEW** (cf. story body)
   - **Prometheus rules `infra/k8s/prometheus-rules/identity-audit-log.yaml`** :
     ```yaml
     groups:
     - name: identity-audit-log
       rules:
       - alert: AuditTamperAttempt
         expr: increase(tukio_audit_tamper_attempts_total[5m]) > 0
         for: 0s
         labels: { severity: critical, team: ops, page: oncall-admin-super }
         annotations:
           summary: "🚨 audit_log tamper attempt — IMMEDIATE INVESTIGATION REQUIRED"
       - alert: AuditLogArchiveFailed
         expr: time() - tukio_audit_log_last_archive_at_unix > 35 * 24 * 3600
         for: 1h
         labels: { severity: warning, team: ops }
       - alert: AuditLogArchiveLagHigh
         expr: tukio_audit_log_archive_lag_days > 365 * 5.5
         for: 1d
         labels: { severity: warning, team: ops }
     ```
   - **Slack channels** `#tukio-alerts-critical` (tamper) + `#tukio-alerts-ops` (archive)
   - **Dashboard Grafana `audit-log.json`** 5 panels : INSERT rate, hot DB size + archive size, archive run history, tamper attempts (should be 0), exports volume

9. **AC9 — Tests Playwright e2e + integration** : 11 tests dans 3 files :
   - **`apps/identity-svc/test/audit/consumer.spec.ts`** (3 integration) :
     - T1 : publish `admin.verification.viewed.v1` → consume → audit_log row INSERT visible
     - T2 : publish duplicate event_id → 2nd consume skip (inbox idempotence)
     - T3 : publish `identity.pro.verified.v1` Story 2.5 → consume → INSERT (identity.* legacy works)
   - **`apps/identity-svc/test/audit/rls.spec.ts`** (4 testcontainer Postgres) :
     - T4 : tukio_identity_app INSERT → success
     - T5 : tukio_identity_app UPDATE/DELETE/ALTER → fail permission denied
     - T6 : tukio_audit_archiver DELETE → success (replica role lifts trigger)
     - T7 : forced UPDATE attempt → trigger raise + pg_notify → AuditTamperListener catches → outbox event published + Slack mock fired
   - **`apps/admin/e2e/audit/api.spec.ts`** (4 E2E) :
     - T8 : admin-super GET `/v1/admin/audit?actor_id={leaId}&action_type=admin.verification.*&pageSize=20` → 200 + filtered + cursor next
     - T9 : admin-modo same query with override attempt → response only self-actor
     - T10 : pro user GET `/v1/me/admin-actions` FR → labels FR + actor='Équipe Tukio' + filter admin.verification.viewed
     - T11 : admin-super POST `/v1/admin/audit/export` format=csv → 202 + worker R2 file + event published
   - **Test cron archive testcontainer LocalStack S3** : fixture 100 rows > 5y + 50 < 5y → cron → R2 file + 100 rows DELETED + event
   - **Test perf** : `/v1/admin/audit` p90 < 300ms with 1M rows fixture (composite index `(at, id)` validation EXPLAIN ANALYZE)
   - Coverage ≥ 100 % AuditTamperListener + 95 % consumer + 90 % cron/usecase

10. **AC10 — Documentation runbook + ADR update** :
    - **NEW runbook critical** `docs/runbook/audit-tamper-incident.md` (~80 lignes) — incident response procedure
    - **NEW runbook** `docs/runbook/audit-log-archive.md` (~40 lignes)
    - **NEW runbook** `docs/runbook/audit-log-export-job.md` (~30 lignes)
    - **UPDATE ADR-009** ajouter section "Audit log finalization Story 2.7"
    - **UPDATE `docs/project-context.md`** ajouter section "Audit Trail (Story 2.7 finalized)"

## Tasks / Subtasks

- [ ] **Task 1 — `@tukio/contracts` event schemas + DTOs** (AC: #2, #3, #5, #6, #7)
  - [ ] 1.1-1.3 — Event schemas (audit-tamper-attempt, audit-log-archived, audit-log-export-ready)
  - [ ] 1.4-1.5 — DTOs admin/audit-log + user/my-admin-actions (PII-redacted shape)
- [ ] **Task 2 — DB migration RLS + tukio_audit_archiver role + trigger update pg_notify** (AC: #4)
  - [ ] 2.1 — Migration `1715293000000-HardenAuditLogRLS.ts`
  - [ ] 2.2 — Doppler secret `TUKIO_AUDIT_ARCHIVER_DB_PASSWORD`
  - [ ] 2.3 — Tests integration 6 cases AC4
- [ ] **Task 3 — Extend AuditLogConsumer subscription `admin.*`** (AC: #1) — coverage ≥ 95 %
- [ ] **Task 4 — `AuditTamperListener` pg_notify catcher** (AC: #5) — coverage ≥ 100 % (security critical)
- [ ] **Task 5 — `GET /v1/admin/audit` paginated endpoint + RBAC** (AC: #2)
- [ ] **Task 6 — `GET /v1/me/admin-actions` RGPD endpoint + i18n labels** (AC: #3)
- [ ] **Task 7 — Cron `archive-audit-log.task.ts` + R2 bucket + IMediaStorage extension** (AC: #6) — coverage ≥ 90 %
- [ ] **Task 8 — `/v1/admin/audit/export` async BullMQ worker** (AC: #7)
- [ ] **Task 9 — Métriques + Prometheus rules + Grafana dashboard** (AC: #8)
- [ ] **Task 10 — Tests Playwright e2e + perf + axe-core** (AC: #9) — 11 tests
- [ ] **Task 11 — Documentation runbooks + ADR + commit** (AC: #10)

## Dev Notes

### Pourquoi Story 2.7 ferme la boucle audit Epic 2

Story 1.10 a livré la **fondation** (table + trigger + consumer subscribe identity.*). Story 2.7 livre la **finalisation production-ready** : extension subscription admin.*, defense in depth RLS, tamper detection real-time pg_notify, RGPD droit d'accès endpoint user-facing avec PII redaction, cron archive 5 ans, query API pour Story 6.6 V1 UI. Pattern complet **immutable audit trail with multi-layer defense** = **R2 mitigation LCEN** + **NFR1 RGPD** + **NFR82 audit immutable** + **R1 expert-comptable** ready pour audit avocat numérique pre-launch.

### Décisions techniques majeures actées

1. **Extend subscription `identity.*` + `admin.*`** (vs separate consumer admin) — DRY single AuditLogConsumer + single inbox idempotence + single insertion logic.
2. **`/v1/admin/audit` data exposition Story 2.7 + UI Story 6.6** — split scope clear. Story 2.7 livre l'API, Story 6.6 V1 livre le frontend. API stable utilisable autres consumers (compliance tools, scripts ops).
3. **`/v1/me/admin-actions` RGPD endpoint** (NEW Story 2.7 — pas dans epic explicitement mais NFR1 droit d'accès l'exige) — actor PII redacted (`tukio-team` constant) + i18n labels intelligibles + filter actions techniques. Privacy-by-design.
4. **RLS table-level grants** (vs row-level RLS policies) — simpler + sufficient for audit_log (no per-tenant filtering needed). REVOKE ALL + GRANT INSERT/SELECT only.
5. **Dedicated `tukio_audit_archiver` role** with `session_replication_role='replica'` — only this role can DELETE (lift trigger temporarily for archive cron). Separation of duties.
6. **`pg_notify` real-time tamper detection** (vs polling logs) — instant alert via TypeORM raw pool LISTEN. Should fire 0/year but critical when fires.
7. **R2 archive monthly partitioned files** Hive-style `audit-archive/year=YYYY/month=MM/...jsonl.gz` — Athena/Spark queryable later for legal investigations. Gzip ~10x reduction.
8. **Idempotent archive checksum** — same data + same checksum = same R2 key (re-run cron after partial fail = no double-upload).
9. **Async export job via BullMQ** (vs sync endpoint) — large exports take minutes. 202 Accepted + email-when-ready UX pattern.
10. **Cron monthly 4am UTC 1st** — low load + après éventuelle window maintenance.
11. **Retention 5 ans hot DB + 99 ans cold R2** (LCEN + RGPD compliance — actions admin sensible long retention).
12. **EN strict + i18n + RGAA AA + Pretre + envelope ADR-014 + latest stable versions** memories.

### Versions à utiliser

| Lib | Usage | Version | Notes |
|-----|-------|---------|-------|
| `@nestjs/bull` + `bullmq` | Async export | latest stable | Réutilisé Story 0.7/2.1 outbox pattern |
| `pg` (raw pool) | LISTEN/NOTIFY tamper | TypeORM dep | Native Postgres pg_notify |
| `@aws-sdk/client-s3` | R2 archive upload | v3 latest | Story 1.3 already integrated |
| `node:zlib` (gzip) | Archive compression | native | No dep |

### Project Structure cible

```
packages/contracts/src/events/admin/
├─ audit-tamper-attempt.v1.{schema.json,ts}                      # NEW Story 2.7
├─ audit-log-archived.v1.{schema.json,ts}                        # NEW Story 2.7
└─ audit-log-export-ready.v1.{schema.json,ts}                    # NEW Story 2.7

packages/contracts/src/dtos/
├─ admin/audit-log.dto.ts                                        # NEW
└─ user/my-admin-actions.dto.ts                                  # NEW

packages/api-client/src/hooks/admin/
├─ use-admin-audit-list.ts                                       # NEW (Story 6.6 V1 will use)
└─ use-admin-audit-export.ts                                     # NEW

packages/api-client/src/hooks/user/
└─ use-my-admin-actions.ts                                       # NEW (RGPD self-service)

apps/identity-svc/src/
├─ domain/
│  ├─ ports/audit-log-repository.port.ts                         # UPDATE Story 1.10 — findBatchOlderThan + deleteBatch
│  └─ exception/archive-verification-failed.error.ts             # NEW
├─ usecases/
│  ├─ list-audit-log.usecase.ts + spec                           # NEW
│  ├─ get-my-admin-actions.usecase.ts + spec                     # NEW
│  ├─ enqueue-audit-export.usecase.ts + spec                     # NEW
│  └─ audit-action-labels.ts                                     # NEW (i18n FR + EN labels mapping)
├─ usecases-proxy/usecases-proxy.module.ts                       # UPDATE — wire 3 new use cases
├─ infrastructure/
│  ├─ http/controllers/
│  │  ├─ admin-audit.controller.ts                               # NEW (internal endpoint)
│  │  ├─ seller-me.controller.ts                                 # UPDATE Story 1.8 — add /admin-actions
│  │  └─ admin-audit-export.controller.ts                        # NEW
│  ├─ persistence/typeorm/
│  │  ├─ migrations/1715293000000-HardenAuditLogRLS.ts            # NEW
│  │  ├─ repositories/audit-log.typeorm.repository.ts            # UPDATE — findBatchOlderThan + deleteBatch
│  │  └─ listeners/audit-tamper-listener.service.ts              # NEW (pg_notify catcher)
│  ├─ messaging/nats/audit-log.consumer.ts                       # UPDATE Story 1.10 — extend admin.*
│  ├─ tasks/archive-audit-log.task.ts                            # NEW (cron monthly)
│  ├─ workers/audit-log-export.worker.ts                         # NEW (BullMQ job)
│  └─ external/r2/r2-media-storage.service.ts                    # UPDATE Story 1.3 — verifyChecksum

apps/gateway-api/src/
├─ usecases/admin/
│  ├─ admin-audit.forwarder.ts                                   # NEW
│  └─ admin-audit-export.forwarder.ts                            # NEW
├─ usecases/user/my-admin-actions.forwarder.ts                   # NEW
├─ infrastructure/http/controllers/
│  ├─ admin-audit.controller.ts                                  # NEW
│  ├─ admin-audit-export.controller.ts                           # NEW
│  └─ seller-me.controller.ts                                    # UPDATE Story 1.8
└─ infrastructure/external/identity-svc/identity-svc.client.ts   # UPDATE

apps/identity-svc/test/audit/
├─ consumer.spec.ts                                              # NEW (3 tests)
├─ rls.spec.ts                                                   # NEW (4 tests testcontainer)
└─ archive.spec.ts                                               # NEW (4 tests testcontainer LocalStack)

apps/admin/e2e/audit/api.spec.ts                                 # NEW (4 tests E2E)

infra/scripts/provision-r2-buckets.sh                            # UPDATE Story 0.10 — add tukio-audit-archive
infra/k8s/prometheus-rules/identity-audit-log.yaml               # NEW
infra/k8s/grafana-dashboards/audit-log.json                      # NEW

docs/runbook/audit-tamper-incident.md                            # NEW (critical ~80 lignes)
docs/runbook/audit-log-archive.md                                # NEW (~40 lignes)
docs/runbook/audit-log-export-job.md                             # NEW (~30 lignes)

docs/adr/0009-keycloak-identity-svc-split.md                     # UPDATE — section Story 2.7
docs/project-context.md                                          # UPDATE — section "Audit Trail (Story 2.7)"

# Estimation : ~35 nouveaux + ~10 updates = ~45 fichiers
```

### Critical Architecture Constraints

> Cf. Stories 0.5/0.7/0.10 (atomics, outbox/inbox, Doppler/R2 provisioning), 0.6 (Pretre), 1.2 (gateway-api), 1.3 (IMediaStorage R2 + AES-256), 1.7 (admin layout), 1.8 (`/v1/me`), 1.9 (cron `@nestjs/schedule`), 1.10 (audit_log table + immutability trigger + AuditLogConsumer subscribe identity.* + RecordAuditLogUseCase), 2.1 (outbox + BullMQ pattern), 2.3 (cursor pagination Story 2.3 admin queue pattern), 2.4 (admin.verification.viewed event), 2.5 (identity.pro.verified/rejected events + reasonCode i18n keys), 2.6 (catalog event refinement) + memories.

1. **Pretre architecture stricte** — port `IAuditLogRepository` extended Story 2.7 keeps domain pure.
2. **Transactional outbox ADR-007** — events single transaction. Tamper event `publishStandalone`.
3. **API responses envelope ADR-014** — paginated `{ data: [], pagination, meta }`.
4. **EN strict + i18n FR/EN + RGAA AA** memories.
5. **NFR1 RGPD audit retention 5 ans** — cron monthly + archive R2 99 ans.
6. **NFR15 chiffrement at-rest R2** — AES-256 sur `tukio-audit-archive` bucket.
7. **NFR82 audit immutable + tamper detection** — Postgres trigger + RLS + pg_notify + Slack page admin-super critical.
8. **Cursor pagination canonical** Story 2.3 réutilisé.
9. **Latest stable versions** memory.

### Previous Story Intelligence

**Story 1.3 (Pro registration)** : `IMediaStorage` port (R2 KYC bucket). Story 2.7 étend avec `verifyChecksum` méthode pour archive integrity + utilise `tukio-audit-archive` bucket NEW.

**Story 1.7 (admin layout)** : RBAC roles. Story 2.7 utilise pour endpoints `/v1/admin/audit` (admin-modo+ avec auto-filter actor_id=self, admin-super sees all) + `/v1/admin/audit/export` (admin-super only).

**Story 1.8 (profile management)** : `/v1/me` controller. Story 2.7 ajoute `/v1/me/admin-actions` même controller.

**Story 1.9 (account deletion)** : pattern `@nestjs/schedule` cron + `purge-tokens.task.ts`. Story 2.7 réutilise pour `archive-audit-log.task.ts`.

**Story 1.10 (Pretre consolidation)** : a livré table `audit_log` + immutability trigger + AuditLogConsumer subscribe `identity.*` + `RecordAuditLogUseCase` + inbox. Story 2.7 **étend** : (1) consumer subscription `+ admin.*` (Story 1.10 line 184 reserved "+ admin.* V1+"), (2) trigger function update with pg_notify (function update propagates), (3) RLS table-level grants additional layer, (4) endpoints query/export, (5) cron archive R2.

**Story 2.1 (Stripe Connect)** : pattern outbox + BullMQ for async jobs. Story 2.7 réutilise BullMQ pour `audit-log-export.worker.ts`.

**Story 2.3 (admin queue)** : cursor pagination `(at, id)` composite. Story 2.7 réutilise pour `/v1/admin/audit` query (UI réutilisera `<DataTable>` Story 6.6 V1).

**Story 2.4 (admin detail)** : publie `admin.verification.viewed.v1` qui sera maintenant capturé par AuditLogConsumer extension Story 2.7.

**Story 2.5 (admin accept/reject)** : publie `identity.pro.verified.v1`, `identity.pro.rejected.v1`, etc. — déjà capturés Story 1.10. Story 2.5 reasonCode i18n keys réutilisés Story 2.7 `/v1/me/admin-actions`.

**Story 2.6 (1ère fiche)** : publie `identity.pro.onboarding-reminder-sent.v1` — capturé identity.*. Story 2.7 ajoute label i18n.

### What this story does NOT do

- ❌ **UI consultation `/admin/audit`** — Story 6.6 V1 livre l'UI.
- ❌ **Suspend/Ban accounts admin sanctions** — Story 6.5 V1.
- ❌ **Event replay sensitive admin tool** — Story 10.3 V1.
- ❌ **User impersonation sensitive** — Story 10.4 V1.
- ❌ **Anonymisation post-archive cold storage** — V1+ implementation.
- ❌ **Real-time audit log streaming dashboard** — V1+ Grafana Loki integration.
- ❌ **Tamper attempt auto-revoke compromised credentials** — V1+ admin runbook handles manually.
- ❌ **Audit log encryption (separate KMS keys)** — V1+ if compliance requires. MVP : R2 server-side AES-256.

### Testing Standards

- Coverage ≥ 100 % `AuditTamperListener` (security critical) — NFR82 strict
- Coverage ≥ 95 % consumer extension subscription
- Coverage ≥ 90 % cron + use cases + worker
- Coverage ≥ 80 % gateway endpoints
- E2E Playwright FR/EN axe-core 0 violations 11 tests AC9
- Tests integration testcontainer Postgres + LocalStack S3 + BullMQ Redis
- Perf : `/v1/admin/audit` p90 < 300ms with 1M rows fixture (composite index validated EXPLAIN ANALYZE), `/v1/me/admin-actions` p90 < 200ms with 100k rows, cron archive 10k rows < 30s
- **Critical security tests** : tamper detection end-to-end (UPDATE attempt → trigger → pg_notify → listener → event → Slack mock fired in same test)

### Project Structure Notes

✅ **Aligné architecture, PRD §FR89 (audit log viewer + export — Story 6.6 UI), §FR94 (audit log toutes actions admin), §FR95 (admin Super peut consulter audit trail), §NFR1 (RGPD droit accès + retention 5 ans), §NFR15 (R2 archive chiffrement), §NFR82 (audit immutable + tamper detection), Stories 1.3/1.7/1.8/1.9/1.10/2.1/2.3/2.4/2.5/2.6, memories.**

⚠️ **Décision** : Extension `+ admin.*` subscription (vs separate consumer) — DRY.
⚠️ **Décision** : RLS table-level grants `INSERT, SELECT only` (vs row-level policies) — simpler.
⚠️ **Décision** : Dedicated `tukio_audit_archiver` role + `session_replication_role='replica'` — separation of duties.
⚠️ **Décision** : `pg_notify` real-time tamper detection — instant Slack alert.
⚠️ **Décision** : R2 monthly partitioned Hive-style — queryable Athena/Spark.
⚠️ **Décision** : `/v1/me/admin-actions` PII-redacted — RGPD privacy-by-design.
⚠️ **Décision** : Async export BullMQ — large exports + email-when-ready UX.
⚠️ **Décision** : Story 2.7 livre **API** ; Story 6.6 V1 livre **UI** — split scope clair.

### References

- [Source: epics.md#Epic-2-Story-2.7 — Lines 1350-1363]
- [Source: epics.md#Epic-6-Story-6.6 — Lines 2094-2107 (forward UI consumer)]
- [Source: prd.md#FR89, #FR94, #FR95, #NFR1 (RGPD retention 5y), #NFR15 (R2 encrypted), #NFR82 (audit immutable)]
- [Source: architecture.md — ADR-007 transactional outbox, ADR-014 envelope, audit_log immutability lines, Pretre boundaries lines 2120-2164, R2 server-side encryption]
- [Source: Stories 1.3 (IMediaStorage R2 port), 1.7 (RBAC), 1.8 (`/v1/me`), 1.9 (cron pattern), 1.10 (audit_log table + trigger + AuditLogConsumer + RecordAuditLogUseCase), 2.1 (BullMQ pattern), 2.3 (cursor pagination + DataTable forward Story 6.6), 2.4 (admin.verification.viewed event), 2.5 (identity.pro.verified/rejected events + reasonCode i18n), 2.6 (identity.pro.onboarding-reminder-sent event)]
- [Memory: feedback_clean_architecture_explicit.md, feedback_api_envelope_response.md, feedback_tech_layer_english.md, feedback_i18n_frontend.md, feedback_latest_versions.md]

## Dev Agent Record

### Agent Model Used

(à remplir par dev agent : modèle + version)

### Debug Log References

### Completion Notes List

(à remplir à la fin — résumé décisions, déviations vs Dev Notes avec justification, points d'attention pour Story 2.8 (auto-rejection 30j publish `identity.pro.auto-rejected.v1` consumed audit_log Story 2.7), Story 6.5 V1 (suspend/ban admin sanctions — events consumed audit_log Story 2.7), Story 6.6 V1 (audit UI — consume `/v1/admin/audit` API), Story 10.3 V1 (event replay), Story 10.4 V1 (user impersonation))

### File List

(à remplir au fil de l'implémentation par le dev agent)

---

## Story Completion Status

- **Story Status** : `ready-for-dev`
- **Created** : 2026-05-09
- **Created by** : `bmad-create-story` workflow
- **Epic** : Epic 2 — Pro Onboarding & Admin Verification (MVP)
- **Sprint cible** : Sprint 3 (7ᵉ story Epic 2 après 2.1-2.6)
- **Estimation effort** : 4-5 jours (1 dev senior — story complexité high : 2 endpoints + 1 worker + 1 cron + 1 listener pg_notify + RLS hardening + R2 archive + extension consumer, ~45 fichiers, security-critical tests)
- **Dépendances upstream** : Stories 0.5 (atomics), 0.6 (Pretre), 0.7 (outbox + BullMQ), 0.10 (Doppler + R2 provisioning), 1.2 (gateway-api), 1.3 (IMediaStorage R2), 1.7 (RBAC), 1.8 (`/v1/me`), 1.9 (cron pattern), 1.10 (audit_log + AuditLogConsumer + RecordAuditLogUseCase + inbox), 2.1 (BullMQ + outbox), 2.3 (cursor pagination), 2.4 (admin.verification.viewed event), 2.5 (identity.pro.verified/rejected events + reasonCode i18n keys réutilisés `/v1/me/admin-actions`), 2.6 (identity.pro.onboarding-reminder-sent event)
- **Dépendances downstream** :
  - Story 2.8 (auto-rejection 30j) — publie `identity.pro.auto-rejected.v1` consumed audit_log via Story 2.7 extension
  - Story 6.5 V1 — events `admin.account-suspended.v1` etc. consumed audit_log Story 2.7 admin.* subscription
  - Story 6.6 V1 — consume `/v1/admin/audit` + `/export` API + réutilise `<DataTable>` Story 2.3
  - Story 10.3 V1 — event replay uses audit_log query Story 2.7
  - Story 10.4 V1 — user impersonation publishes audit events captured Story 2.7
  - Stories Epic 5 (messaging audit FR74) — pattern Story 2.7 réutilisé
- **FRs covered** :
  - **FR89** ✅ admin peut consulter et exporter le journal d'audit immuable (API exposed Story 2.7, UI Story 6.6 V1)
  - **FR94** ✅ audit log toutes actions admin (events Story 2.4/2.5/2.6 captured via consumer extension)
  - **FR95** ✅ admin Super peut consulter audit trail (RBAC strict)
- **NFRs touchés** :
  - **NFR1** ✅ RGPD droit d'accès `/v1/me/admin-actions` + retention 5y archive R2 + 99y cold storage
  - **NFR15** ✅ R2 server-side encryption AES-256 sur tukio-audit-archive bucket
  - **NFR21** ✅ LCEN audit avocat (immutable trigger + RLS + tamper detection real-time)
  - **NFR71** ✅ coverage ≥ 100 % AuditTamperListener (security critical) + ≥ 95 % consumer extension + ≥ 90 % cron/use cases
  - **NFR82** ✅ audit immutable trigger + RLS defense in depth + tamper detection pg_notify + Slack page admin-super

> **Prochaine story → Story 2.8** (Pro verification reminder + auto-rejection après 30 jours d'inactivité — réutilise pattern cron Story 2.6 + RejectVerificationUseCase Story 2.5 actor=system)

---

**Dev agent next steps :**
1. Lire ce file complètement
2. Vérifier upstream Stories 0.5, 0.6, 0.7, 0.10, 1.2, 1.3, 1.7, 1.8, 1.9, 1.10, 2.1, 2.3, 2.4, 2.5, 2.6 implémentées
3. Implémenter Tasks 1-11 dans l'ordre
4. Lancer `pnpm vitest --filter=identity-svc audit/` après chaque jalon
5. Commit Story 2.7 quand : 11/11 e2e + 4/4 RLS testcontainer + 4/4 archive testcontainer + 100% coverage AuditTamperListener + 95% consumer + 90% cron/usecases + tamper detection end-to-end testé + Prometheus alerts testés + RGPD redaction validée FR/EN + cron archive monthly testé idempotent + R2 bucket provisioned + ADR-009 updated
6. Update sprint-status : `2-7-...: review` puis `done`
