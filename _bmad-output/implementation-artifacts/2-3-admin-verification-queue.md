# Story 2.3: Admin verification queue (`GET /v1/admin/verifications` + UI list)

Status: ready-for-dev

## Story

**As an** Admin (`admin-support` / `admin-modo` / `admin-super`),
**I want** une **page admin queue** sur `admin.tukio.one/{locale}/verifications` qui liste de manière paginée tous les Pros en `pending_admin_review` (sortant Story 1.3 register Pro) ordonnés par `submittedAt:asc` (oldest first — SLA NFR48 < 24h validation), exposée via gateway-api `GET /v1/admin/verifications?status=pending_admin_review&page=1&pageSize=20&sort=submittedAt:asc` qui forward identity-svc internal endpoint, retourne enveloppe paginée ADR-014 `{ method:'GET', code:200, data: [{ proProfileId, userProfileId, companyName, siret, submittedAt, kycStatus, kycDocsCount: '3/3', stripeStatus, slaWarning: boolean (true if submittedAt > 24h ago) }], pagination: { nextCursor, hasMore, totalEstimate, limit } }` ; UI rendue `<AdminQueueLayout>` (NEW Story 2.3 — pattern réutilisable Stories 2.4/6.x autres queues admin) avec `<DataTable>` (Story 0.5 atomic ou créé Story 2.3) listing chaque Pro pending avec colonnes : `<Avatar>` placeholder + nom société + SIRET formaté + relative timestamp ("il y a 2h" via `next-intl` formatRelativeTime) + `<Badge variant="warning">"En attente"</Badge>` + `<Badge>3/3 docs</Badge>` + `<Badge variant={stripeStatus === 'submitted' ? 'success' : 'warning'}>{stripeStatus}</Badge>` + bouton `<Button variant="primary">Examiner</Button>` → redirect Story 2.4 `/admin/verifications/{proProfileId}` ; **filter SLA badge rouge** "⚠️ SLA dépassé" affiché sur Pros avec `submittedAt > NOW() - INTERVAL '24h'` ; **filter UI dropdown** `<Select>` "Tous" / "SLA OK" / "SLA dépassé" + sort `<Select>` "Plus anciens" / "Plus récents" ; **empty state** `<EmptyState variant="success">` "🎉 Aucune vérification en attente. Bon boulot !" (UX-DR16) ; **RBAC granulaire** : tous `admin-*` voient la queue (lecture autorisée), seul `admin-modo`/`admin-super` peut valider/rejeter (Story 2.5) ; `admin-support` voit la queue + peut ajouter note pré-screening (Story 2.4 — feature `<NoteInput>` côté detail screen) mais ne peut pas valider/rejeter ; **pas d'audit event lecture queue** (NFR82 — audit fine-grained sur ouverture détail Story 2.4 + actions Story 2.5 uniquement, pas sur browse list pour réduire bruit) ; **performance** pagination cursor-based (vs offset pour scaling — table size grow over months) avec `pageSize` default 20 max 100, **i18n strict** (memory) namespace `admin.verifications.queue.*`, **accessibility RGAA AA** axe-core 0 violations + `<table>` semantic + sortable column headers `aria-sort` + keyboard navigation, **NFR48 SLA dashboard** : count badge "X pros pending" affiché dans `<AdminSidebar>` Story 6.1 placeholder (Story 2.3 expose juste l'API + page),
**so that** Léa (admin-support persona Tukio J5 user journey) traite la file matin chaque jour en < 24h moyen + Lis un Pro pending : 30s pour scan card + click "Examiner" → 2 min Story 2.4 KYC review → click "Valider" Story 2.5 → done. Story 2.4 (admin KYC review detail) consomme `proProfileId` query param Story 2.3. Story 2.8 (Pro reminder + auto-rejection 30j) consume `submittedAt` field (calc days elapsed). Story 6.1 (admin dashboard home) consume count via même endpoint. Et le **pattern complet "admin queue with pagination + SLA badges + RBAC granulaire + cursor pagination"** devient template Stories 6.2 (listings moderation queue), 6.3 (reviews moderation queue), 6.4 (signalements queue).

> **Outcome attendu** : à la fin de cette story, Léa (admin-modo) se connecte `admin.tukio.one/fr/verifications` → page render `<DataTable>` avec X Pros pending (mock fixture 5 Pros pour dev local) → trie déjà par submittedAt asc (oldest first) → badge rouge "SLA dépassé" sur 1 Pro submitted il y a 25h → click "Examiner" sur Pro #1 → redirect Story 2.4 detail screen ; un `admin-support` accède same page → mêmes data + bouton "Examiner" navigue vers detail Story 2.4 (mais Story 2.5 actions sont disabled pour admin-support — RBAC granulaire) ; un test `pnpm playwright test --grep "admin verification queue"` passe FR/EN, axe-core 0 violations, perf < 1s p90 page load avec 100 Pros pending fixture, cursor pagination tested + "Plus" CTA loads next batch.

## Acceptance Criteria

1. **AC1 — gateway-api endpoint `GET /v1/admin/verifications`** : Given gateway-api Story 1.2/2.1, When un admin authentifié appelle `GET /v1/admin/verifications?status=pending_admin_review&pageSize=20&sort=submittedAt:asc&cursor=<base64>&slaFilter=all|sla-ok|sla-exceeded`, Then :
   - **Endpoint** :
     ```ts
     @Controller('/v1/admin/verifications')
     export class AdminVerificationsController {
       @Get('/')
       @UseGuards(KeycloakJwtGuard, RolesGuard)
       @Roles('admin-support', 'admin-modo', 'admin-super')
       @HttpCode(200)
       async list(@Query() query: ListVerificationsQuery, @Res({ passthrough: true }) res: Response): Promise<VerificationListItem[]> {
         const result = await this.adminVerificationsForwarder.getInstance().list(query);
         res.locals.pagination = { nextCursor: result.nextCursor, hasMore: result.hasMore, totalEstimate: result.totalEstimate, limit: query.pageSize ?? 20 };
         return result.items;
       }
     }
     ```
   - **Validation Zod** : `ListVerificationsQuerySchema` (`status: enum('pending_admin_review' | 'under_review'), pageSize: 1-100, cursor: string | undefined, sort: 'submittedAt:asc' | 'submittedAt:desc', slaFilter: 'all' | 'sla-ok' | 'sla-exceeded'`)
   - **Forwarder** appelle identity-svc `GET /internal/admin/verifications` avec mêmes query params + `X-Internal-Service-Token`
   - **Réponse paginée envelope ADR-014** :
     ```json
     {
       "method": "GET",
       "code": 200,
       "data": [
         {
           "proProfileId": "uuid",
           "userProfileId": "uuid",
           "companyName": "Marc Loueur SARL",
           "siret": "12345678901234",
           "siretFormatted": "123 456 789 01234",
           "submittedAt": "2026-05-08T10:00:00Z",
           "kycStatus": "pending_review",
           "kycDocsUploadedCount": 3,
           "kycDocsTotal": 3,
           "stripeStatus": "submitted",
           "stripeChargesEnabled": true,
           "slaExceeded": false,
           "submittedDaysAgo": 0.5
         }
       ],
       "pagination": { "nextCursor": "eyJzdWJtaXR0ZWRBdCI6IjIwMjYtMDUtMDhUMTA6MDA6MDBaIiwicHJvUHJvZmlsZUlkIjoidXVpZCJ9", "hasMore": true, "totalEstimate": 87, "limit": 20 },
       "meta": { ... }
     }
     ```
   - **Cursor encoding** : base64-JSON `{ submittedAt: ISO, proProfileId: UUID }` (composite cursor — handles ties on submittedAt). identity-svc query : `WHERE (submitted_at, pro_profile_id) > (cursor.submittedAt, cursor.proProfileId) ORDER BY submitted_at ASC, pro_profile_id ASC LIMIT pageSize+1`
   - **Throttle** : 60/min/user (admin queue browsing courant — pas de spam concern)
   - **Tests E2E** : query valid → 200 + paginated. Cursor valid → 200 next batch. RolesGuard non-admin → 403. SLA filter exceeded → uniquement Pros submitted > 24h.

2. **AC2 — identity-svc use case `ListVerificationsUseCase` + repository extension** : Given Pretre architecture, When je consulte `apps/identity-svc/src/`, Then :
   - **NEW use case** `apps/identity-svc/src/usecases/list-verifications.usecase.ts` :
     ```ts
     async execute(input: { status: 'pending_admin_review' | 'under_review'; pageSize: number; cursor?: string; sort: 'submittedAt:asc' | 'submittedAt:desc'; slaFilter: 'all' | 'sla-ok' | 'sla-exceeded' }): Promise<{ items: VerificationListItem[]; nextCursor: string | null; hasMore: boolean; totalEstimate: number }> {
       const decodedCursor = input.cursor ? JSON.parse(Buffer.from(input.cursor, 'base64').toString('utf-8')) : null;
       const slaThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24h ago
       
       const proProfiles = await this.proProfileRepo.findVerifications({
         kycStatus: input.status,
         slaFilter: input.slaFilter, // 'sla-exceeded' = createdAt < slaThreshold
         cursor: decodedCursor,
         sort: input.sort,
         limit: input.pageSize + 1, // +1 for hasMore detection
       });
       
       const hasMore = proProfiles.length > input.pageSize;
       const items = proProfiles.slice(0, input.pageSize).map(p => ({
         proProfileId: p.id,
         userProfileId: p.userProfileId,
         companyName: p.companyName,
         siret: p.siret.value,
         siretFormatted: p.siret.formatted, // VO method
         submittedAt: p.createdAt.toISOString(),
         kycStatus: p.kycStatus,
         kycDocsUploadedCount: this.countKycDocs(p),
         kycDocsTotal: 3,
         stripeStatus: p.stripeStatus, // Story 2.1 added field
         stripeChargesEnabled: p.stripeChargesEnabled,
         slaExceeded: p.createdAt < slaThreshold,
         submittedDaysAgo: differenceInHours(new Date(), p.createdAt) / 24,
       }));
       
       const nextCursor = hasMore && items.length > 0 ? Buffer.from(JSON.stringify({ submittedAt: items[items.length - 1].submittedAt, proProfileId: items[items.length - 1].proProfileId })).toString('base64') : null;
       const totalEstimate = await this.proProfileRepo.countVerifications({ kycStatus: input.status, slaFilter: input.slaFilter });
       
       return { items, nextCursor, hasMore, totalEstimate };
     }
     ```
   - **NEW repository methods** `IProProfileRepository` (Story 1.3 extends) :
     - `findVerifications({ kycStatus, slaFilter, cursor, sort, limit }): Promise<ProProfile[]>` (cursor pagination + filter + sort)
     - `countVerifications({ kycStatus, slaFilter }): Promise<number>` (estimate count, possibly cached 60s)
   - **Helper** `countKycDocs(proProfile)` : count `kyc_id_card_r2_key + kyc_rib_r2_key + kyc_kbis_r2_key` not null (returns 1-3)
   - **Indexes DB** (migration NEW Story 2.3) : `CREATE INDEX idx_pro_profiles_kyc_status_created_at ON pro_profiles (kyc_status, created_at) WHERE deleted_at IS NULL` (cover sort + filter)
   - Tests unit ≥ 90 % use case + integration test cursor pagination edge cases

3. **AC3 — Frontend page `apps/admin/[locale]/verifications/page.tsx`** : Given AC1, When un admin navigue `admin.tukio.one/{locale}/verifications`, Then :
   - **Layout** : Server Component fetch initial page server-side avec cookies → render `<AdminQueueLayout>` (NEW Story 2.3 — pattern shared admin queues)
   - **Hero** : `<h1>Vérifications Pros en attente</h1>` (FR) / EN
   - **Filters bar** : `<select>` filter SLA + sort + pageSize (default 20) — utilisent URL query params (`?slaFilter=sla-exceeded&sort=submittedAt:asc&pageSize=50`) pour shareable URL + browser back/forward
   - **`<DataTable>`** (NEW atomic Story 2.3 ou Story 0.5 si exists — réutilisable Stories 6.x queues) avec colonnes :
     - `<Avatar>` placeholder (Pro logo V1)
     - Nom société + SIRET formaté
     - Submitted at (relative time `formatRelativeTime` next-intl + tooltip absolute date)
     - Badge KYC `3/3 docs` (vert si complet)
     - Badge Stripe (`Submitted`, `Pending`, `Requires action`, `Restricted`) avec variant approprié
     - Badge SLA rouge "⚠️ SLA dépassé" si `slaExceeded === true`
     - Bouton `<Button variant="primary" size="sm">Examiner →</Button>` → `<Link href="/admin/verifications/{proProfileId}">`
   - **Pagination cursor-based** : bouton `<Button>Charger plus</Button>` en bas (or auto-infinite-scroll V1+) → fetch next page avec `?cursor=...`
   - **Empty state** : `<EmptyState variant="success" illustration="<CheckCircleLargeIcon />" title="🎉 Aucune vérification en attente" description="Bon boulot, l'équipe Tukio !" />`
   - **Loading state** : `<TableSkeleton rows={5} />` durant fetch
   - **Error state** : `<EmptyState variant="error">Impossible de charger la liste. Réessayer ?</EmptyState>` + bouton retry
   - **Mobile responsive** : table devient `<Card>` stack vertical avec champs key-value (sur < 768px)
   - **i18n** : namespace `admin.verifications.queue.*` (~15 keys)
   - **A11y** : `<table>` semantic, `aria-sort` sur column headers, `aria-busy` durant fetch, focus-visible sur "Examiner" buttons, axe-core 0 violations
   - **Tests E2E** : (cf. AC8)

4. **AC4 — `<DataTable>` atomic réutilisable + `<AdminQueueLayout>`** : Given Stories Epic 6 (autres queues admin) consommeront le même pattern, When je consulte `packages/ui/src/`, Then :
   - **NEW atomic `<DataTable>`** (`packages/ui/src/components/DataTable/DataTable.tsx`) — pattern réutilisable :
     - Props : `columns: TableColumn[]`, `data: T[]`, `loading`, `emptyState`, `onRowClick`, `pagination` (cursor-based)
     - Mobile responsive (auto-stack en cards)
     - A11y `<table>` semantic + `aria-sort` + keyboard nav
     - **Décision MVP** : minimal API, V1+ extends avec multi-select, bulk actions
   - **NEW pattern `<AdminQueueLayout>`** (`packages/ui/src/patterns/AdminQueueLayout/AdminQueueLayout.tsx`) :
     - Hero title + filters bar + DataTable + pagination CTA + empty/loading/error states
     - Réutilisable Stories 6.2 listings, 6.3 reviews, 6.4 signalements
   - Tests Storybook + a11y axe-core via `@testing-library/react`

5. **AC5 — `useAdminVerificationsQueue` hook + `@tukio/contracts` DTOs** : Given AC1-3, When je consulte `packages/`, Then :
   - **NEW DTO** `dtos/admin/verifications.dto.ts` :
     - `ListVerificationsQuerySchema` (Zod)
     - `VerificationListItemSchema`
     - `ListVerificationsResponseSchema` (envelope wrap typed)
   - **NEW hook** `packages/api-client/src/hooks/admin/use-admin-verifications-queue.ts` :
     - TanStack Query `useInfiniteQuery({ queryKey: ['admin', 'verifications', query], queryFn: fetch + cursor, getNextPageParam: (page) => page.pagination.nextCursor })`
     - Auto-refetch on filter/sort change

6. **AC6 — RBAC granulaire + audit log absence (NFR82)** : Given AC1, When admin accède queue, Then :
   - **`@Roles('admin-support', 'admin-modo', 'admin-super')`** : tous voient
   - **PAS d'audit event** publié sur lecture queue (NFR82 explicite — éviter bruit, audit fine-grained sur Story 2.4 detail open + Story 2.5 actions)
   - **Story 2.4 + 2.5** seront responsables d'audit events `admin.verification.viewed.v1` (open detail) + `admin.verification.{accepted,rejected}.v1` (actions)

7. **AC7 — Documentation runbook + observability** :
   - **`docs/runbook/admin-verification-queue-debug.md`** (~30 lignes) : flow + troubleshooting (cursor invalid base64, stale data, RBAC mismatch, SLA threshold tuning)
   - **Métriques Prom** : `tukio_admin_verifications_queue_size{kyc_status,sla_status}` (gauge), `tukio_admin_verification_view_duration_seconds` (histogram open detail latency Story 2.4)
   - **Dashboard Grafana** : 3 panels (queue size daily, SLA breaches/day, average time-to-process)

8. **AC8 — Tests Playwright e2e + axe-core + perf** : 6 tests `apps/admin/e2e/verifications/queue.spec.ts` :
   - Test 1 (happy path FR admin-modo) : login admin-modo → naviguer `/fr/verifications` → vérifier table render + 5 Pros (fixture) + sort par submittedAt asc → click "Examiner" sur 1ʳᵉ ligne → vérifier redirect `/admin/verifications/{proProfileId}`
   - Test 2 (happy path EN) : idem `/en/`
   - Test 3 (filter SLA exceeded) : 3 fixtures (1 SLA OK, 2 SLA exceeded) → filter `sla-exceeded` → vérifier 2 rows + badges rouge
   - Test 4 (admin-support readonly) : login admin-support → table visible + bouton Examiner active (Story 2.4 visible mais Story 2.5 actions disabled — vérifié Story 2.5)
   - Test 5 (empty state) : 0 Pros pending fixture → render EmptyState success
   - Test 6 (cursor pagination) : 25 Pros fixture, pageSize 20 → click "Charger plus" → fetch next → vérifier 5 rows ajoutés
   - Test axe-core : 0 violations
   - Test perf : < 1s p90 page load avec 100 Pros fixture
   - Coverage ≥ 80 % gateway endpoint + 90 % use case + 80 % frontend

## Tasks / Subtasks

- [ ] **Task 1 — `@tukio/contracts` DTOs + types** (AC: #5)
- [ ] **Task 2 — identity-svc use case + repo extensions + migration index** (AC: #2) — coverage ≥ 90 %
- [ ] **Task 3 — identity-svc controller `GET /internal/admin/verifications`** (AC: #2)
- [ ] **Task 4 — gateway-api endpoint `GET /v1/admin/verifications` + forwarder + RolesGuard** (AC: #1, #6)
- [ ] **Task 5 — `<DataTable>` atomic + `<AdminQueueLayout>` pattern** (AC: #4)
- [ ] **Task 6 — Frontend page `apps/admin/[locale]/verifications/page.tsx`** (AC: #3) + i18n + responsive
- [ ] **Task 7 — `useAdminVerificationsQueue` hook + URL state sync** (AC: #5)
- [ ] **Task 8 — Tests Playwright e2e + axe-core + perf** (AC: #8)
- [ ] **Task 9 — Observability + runbook + commit** (AC: #7)

## Dev Notes

### Pourquoi Story 2.3 = template admin queue

Story 2.3 livre le **1ᵉʳ admin queue UI** (Léa user journey J5). Pattern pagination cursor + RBAC + SLA badges + DataTable réutilisé Stories 6.2 (listings moderation), 6.3 (reviews moderation), 6.4 (signalements).

### Décisions techniques majeures actées

1. **Cursor pagination** (vs offset) — évite drift quand DB grow + RBAC ranking. Composite cursor `(submittedAt, proProfileId)` handles ties.
2. **Pas d'audit event lecture queue** (NFR82 — réduit bruit). Audit fine-grained Stories 2.4/2.5.
3. **`<DataTable>` atomic NEW** — réutilisable Epic 6 queues admin.
4. **URL state sync** filters/sort/cursor via query params — shareable + back/forward
5. **Initial page Server Component fetch** (SSR) — UX optimale, pas de loading flash
6. **TotalEstimate cached** (60s server-side cache) — Pros pending count change rarely
7. **EN strict + i18n strict** memories

### Versions à utiliser

(Réutilisés Stories 1.x — TanStack Query, Zod, etc. — no new deps)

### Project Structure cible

```
packages/ui/src/components/DataTable/                                    # NEW Story 2.3 atomic
├─ DataTable.tsx + DataTable.spec.tsx + index.ts
└─ TableSkeleton.tsx

packages/ui/src/patterns/AdminQueueLayout/                               # NEW Story 2.3 pattern
└─ AdminQueueLayout.tsx + spec + index.ts

packages/contracts/src/dtos/admin/verifications.dto.ts                   # NEW

packages/api-client/src/hooks/admin/use-admin-verifications-queue.ts     # NEW

apps/identity-svc/src/
├─ usecases/list-verifications.usecase.ts + spec                         # NEW
├─ infrastructure/persistence/typeorm/repositories/pro-profile.typeorm.repository.ts  # UPDATE — findVerifications + countVerifications
├─ infrastructure/persistence/typeorm/migrations/1715290000000-AddIndexProProfilesKycStatusCreatedAt.ts  # NEW
└─ infrastructure/http/controllers/admin-verifications.controller.ts     # NEW (internal)

apps/gateway-api/src/
├─ usecases/admin/admin-verifications.forwarder.ts                       # NEW
├─ infrastructure/external/identity-svc/identity-svc.client.ts           # UPDATE — listVerifications
└─ infrastructure/http/controllers/admin-verifications.controller.ts     # NEW

apps/admin/src/
├─ app/[locale]/verifications/page.tsx                                   # NEW Story 2.3
├─ features/admin/verifications/components/{VerificationsList,FilterBar,VerificationRow}.tsx  # NEW
└─ messages/{fr,en}.json                                                 # UPDATE — namespace admin.verifications.queue.*

apps/admin/e2e/verifications/queue.spec.ts                               # NEW

infra/k8s/grafana-dashboards/admin-verification-queue.json               # NEW
docs/runbook/admin-verification-queue-debug.md                           # NEW

# Estimation : ~25 nouveaux + ~5 updates = ~30 fichiers
```

### Critical Architecture Constraints

> Cf. Stories 1.2 (gateway-api scaffolding), 1.3 (ProProfile aggregate), 1.4 (KeycloakJwtGuard + RolesGuard), 1.7 (admin login + middleware), 2.1 (ProProfile.stripeStatus field), 2.2 (wizard), Story 1.10 (audit_log) + memories.

1. Pretre + envelope ADR-014 + RolesGuard (Stories 0.6/0.8) réutilisés
2. EN strict + i18n strict + RGAA AA (memories)
3. Cursor pagination canonical (Architecture lignes 1281+ — réutilise depuis Story 0.2 envelope pagination type)
4. Pas d'audit event lecture (NFR82)

### Previous Story Intelligence

**Story 1.3** : ProProfile aggregate + kycStatus field (Story 2.3 query).

**Story 1.7** : middleware admin + AdminAuthLayout (Story 2.3 réutilise — admin app layout déjà wrapped).

**Story 1.10** : audit_log consumer (Stories 2.4/2.5 publieront events qui feed audit_log — Story 2.3 pas d'event).

**Story 2.1** : ProProfile.stripeStatus field (Story 2.3 affiche dans queue row).

**Story 2.2** : aucune dépendance directe (Story 2.3 indépendante du wizard Pro).

### What this story does NOT do

- ❌ Admin KYC review detail screen → Story 2.4
- ❌ Admin accept/reject actions → Story 2.5
- ❌ Pro reminder + auto-rejection 30j → Story 2.8
- ❌ Audit trail UI → Story 2.7
- ❌ Bulk actions (approve multiple) → V1+

### Files to UPDATE vs CREATE

(cf. Project Structure cible)

### Testing Standards

- Coverage ≥ 90 % use case + 80 % gateway + 80 % frontend (NFR71)
- E2E Playwright FR/EN axe-core 6 tests AC8
- Perf < 1s p90 page load (NFR48)

### Project Structure Notes

✅ Aligné architecture, PRD §FR83 (admin valide/rejette — Story 2.5 finalise), §NFR48 SLA, §NFR82 audit, UX-DR9 admin verification queue gap MVP, Stories 1.3/1.7/2.1, memories.

⚠️ Décision : `<DataTable>` atomic NEW Story 2.3 — réutilisable Epic 6.

⚠️ Décision : pas d'audit event lecture queue (NFR82 fine-grained).

### References

- [Source: epics.md#Epic-2-Story-2.3 — Lines 1288-1301]
- [Source: prd.md#FR83, #NFR48 (SLA 24h), #NFR82 (audit), #UX-DR9]
- [Source: ux-design-specification.md#admin-verification-queue — gap MVP critique designed Sprint 0]
- [Source: Stories 1.3 (ProProfile), 1.7 (admin layout), 2.1 (Stripe field), 1.10 (audit pattern)]
- [Memory: feedback_clean_architecture_explicit.md, feedback_api_envelope_response.md, feedback_tech_layer_english.md, feedback_i18n_frontend.md]

## Dev Agent Record

(à remplir)

---

## Story Completion Status

- **Story Status** : `ready-for-dev`
- **Created** : 2026-05-09
- **Created by** : `bmad-create-story` workflow
- **Epic** : Epic 2 — Pro Onboarding & Admin Verification (MVP)
- **Sprint cible** : Sprint 3 (3ᵉ story Epic 2)
- **Estimation effort** : 3-4 jours (1 dev fullstack — story moyenne complexité, ~30 fichiers)
- **Dépendances upstream** : Stories 0.5 (atomics), 1.2 (gateway-api), 1.3 (ProProfile), 1.7 (admin app layout), 2.1 (stripeStatus field)
- **Dépendances downstream** :
  - Story 2.4 (admin KYC review detail) — consume `proProfileId` query param
  - Story 2.5 (admin accept/reject) — opens from queue
  - Story 2.7 (audit trail UI) — Stories 2.4/2.5 publish events
  - Story 2.8 (auto-rejection 30j) — uses submittedAt field
  - Stories 6.1-6.4 (admin queues) — réutilisent `<DataTable>` + `<AdminQueueLayout>`
- **FRs covered** : **FR83 partial** ✅ admin voit la queue (validation Story 2.5)
- **NFRs touchés** : **NFR48** ✅ SLA 24h badge, **NFR71** ✅ coverage, **NFR82** ✅ audit fine-grained pas sur lecture

> **Prochaine story → Story 2.4** (Admin KYC review detail screen + signed URL preview)

---

**Dev agent next steps :**
1. Lire ce file
2. Vérifier upstream Stories 0.5, 1.2, 1.3, 1.7, 2.1 implémentées
3. Implémenter Tasks 1-9
4. Lancer `pnpm playwright test --grep "admin verification queue"` après chaque jalon
5. Commit Story 2.3 quand : 6/6 e2e + coverage thresholds + axe-core 0 + perf < 1s p90
6. Update sprint-status : `2-3-...: review` puis `done`
