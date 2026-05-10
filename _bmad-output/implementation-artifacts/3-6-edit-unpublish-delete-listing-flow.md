# Story 3.6: Edit / Unpublish / Delete listing flow (`/seller/listings` page + 3 actions + modales destructrices)

Status: ready-for-dev

## Story

**As a** Pro `verified` (sortant Story 3.5 published listing OU draft Story 3.3 OU pending_moderation),
**I want** **gérer mon catalogue dans le temps** depuis `/seller/listings` (page liste paginated avec status badges + actions menu Edit/Duplicate/Unpublish/Delete) — Story 3.5 a livré la **publication initiale**. Story 3.6 ferme la **boucle Pro management** : visibilité globale catalogue + édition contenu + dépublication contrôlée + suppression brouillons :
- (a) **Page `/seller/listings`** Server Component (`apps/seller/src/app/[locale]/seller/listings/page.tsx`) :
  - Fetch initial `GET /v1/listings/me?status=all|draft|pending_moderation|published|unpublished&cursor=&pageSize=20` (NEW endpoint Story 3.6 — consume Story 3.2 `list-pro-listings.usecase.ts` full implementation, étend filter status param multi-value)
  - Render `<SellerListingsLayout>` (NEW pattern Story 3.6 — réutilisable Stories Epic 4 V1 pro bookings + Stories Epic 5 V1 pro reviews) avec :
    - Hero `<h1>Mes fiches services</h1>` + count `<Badge>{totalCount} fiches</Badge>` + CTA primary "+ Créer une fiche" → `/seller/listings/new` (Story 3.3)
    - `<FilterTabs>` Story 0.5 atomic ou créer Story 3.6 si manquant — 5 onglets `Toutes | Brouillons | En modération | Publiées | Dépubliées` avec count par tab (URL state sync `?status=...`)
    - `<DataTable>` Story 2.3 pattern réutilisé (cursor pagination composite `(updated_at, id)` Story 2.3) ou alternative `<ListingsGrid>` Card layout (UX-DR15 — gap MVP cf. Story 0.5)
    - Each `<ListingRow>` (NEW Story 3.6) avec colonnes :
      - `<Avatar>` placeholder + thumbnail première photo (variants Story 3.4 `urls.thumbnail`) — `<EmptyImageIcon>` si listing draft sans photos
      - Title FR + slug preview `/fr/services/{slug}`
      - Status badge `<Badge variant={...}>` :
        - `draft` → `<Badge variant="muted">Brouillon</Badge>`
        - `pending_moderation` → `<Badge variant="warning">En modération</Badge>` + tooltip "Validation Tukio sous 24h"
        - `published` → `<Badge variant="success">Publiée</Badge>` + lien externe `<Link href="/fr/services/{slug}" target="_blank">↗ Voir</Link>` (Story 3.10 future page)
        - `unpublished` → `<Badge variant="muted">Dépubliée</Badge>` + relative `Dépubliée il y a Xj`
      - Pricing display compact (Story 0.5 `<PricingDisplay>` réutilisé)
      - Last updated relative time (`formatRelativeTime` next-intl)
      - `<ActionsMenu>` (NEW Story 3.6 atomic via `@radix-ui/react-dropdown-menu` v2+ ou réutiliser Story 0.4 si exists) avec items conditionnels selon status :
        - `Éditer` (toujours sauf pending_moderation — UX prevent edit during admin review) → redirect `/seller/listings/:id/edit?step=1` (Story 3.3 wizard reuse)
        - `Dupliquer` (toujours) → POST `/v1/listings/:id/duplicate` (NEW endpoint Story 3.6) → returns `{ newListingId }` → redirect `/seller/listings/:newId/edit?step=1` (Pro can adjust duplicated)
        - `Dépublier` (only if status='published') → ouvre `<UnpublishModal>` (cf. AC4)
        - `Supprimer` (only if status='draft' OR status='unpublished') → ouvre `<DeleteModal>` (cf. AC5)
- (b) **Edit flow re-publish** : Pro click "Éditer" → wizard Story 3.3 mode edit (`/seller/listings/:id/edit`) — Story 3.3 livre déjà la page edit. Story 3.6 confirme : à click "Publier" depuis step 5 wizard sur listing déjà `published` (re-publish post-edit) → POST `/v1/listings/:id/publish` Story 3.5 endpoint réutilisé → applique mêmes règles `ListingPublicationService.shouldAutoPublish()` (auto-publish si Pro toujours trusted, OU pending_moderation si profil dégradé reportsCount augmenté entre temps) + outbox event `catalog.listing.updated.v1` (Story 3.2 livré schema) → consumed Story 3.7 future Meilisearch indexer pour update search ;
- (c) **`<UnpublishModal>`** flow destructive avec sécurités :
  - Modal title "Dépublier {companyName} - {title.fr}"
  - Body warning `<Alert variant="warning">` "Votre fiche ne sera plus visible publiquement. Les visiteurs ne pourront plus la trouver via search."
  - **Active bookings check** (forward-dep Story 4.x — booking-svc) : Story 3.6 stub MVP frontend appelle `GET /v1/listings/:id/active-bookings-count` (NEW endpoint Story 3.6 stub returning `{ count: 0 }` MVP) — Story 4.x finalisera avec real query booking-svc. Si `count > 0` → `<Alert variant="error">` strong warning "{count} réservation(s) à venir bloquent la dépublication. Voir les résas ?" + lien `/seller/bookings?status=confirmed&listingId=:id` (Story 4.x future) — **PAS de blocage technique strict MVP** (Pro peut quand-même unpublish — risk assumé). UX warning fort suffisant.
  - 2 CTAs Annuler (ghost) + Confirmer Dépublication (danger) — focus trap RGAA
  - On confirm → `POST /v1/listings/:id/unpublish` Story 3.6 NEW endpoint (gateway-api) consume Story 3.2 `unpublish-listing.usecase.ts` → state machine `published → unpublished` + `unpublishedAt = NOW` + outbox `catalog.listing.unpublished.v1` (schema Story 3.2 livré) → success toast "Fiche dépubliée" + invalidate listings query → re-fetch ;
- (d) **`<DeleteModal>`** flow destructive (uniquement draft OR unpublished) :
  - Modal title "Supprimer définitivement ?"
  - Body warning `<Alert variant="error">` "Cette action est irréversible. La fiche et ses photos seront supprimées définitivement après 7 jours (récupération possible via support pendant cette période)."
  - **Si tentative delete sur listing `published`** → forwarder gateway-api retourne 422 `LISTING-CANNOT-DELETE-PUBLISHED-001` "Dépubliez d'abord" + UI inline error pre-modal "Vous ne pouvez pas supprimer une fiche publiée. Dépubliez-la d'abord." (cohérent epic AC6)
  - 2 CTAs Annuler (ghost) + Confirmer Suppression (danger) — focus trap RGAA
  - On confirm → `DELETE /v1/listings/:id` Story 3.6 NEW endpoint consume Story 3.2 `delete-listing.usecase.ts` → state machine soft-delete (`Listing.softDelete()` invariant `status === 'draft' || 'unpublished'`) + cascade soft-delete photos via `IPhotoStorage` Story 3.4 (Story 3.4 SoftDeletePhotoUseCase consumed via media-svc internal endpoint) → outbox `catalog.listing.deleted.v1` (schema Story 3.2 livré) → success toast "Fiche supprimée" + invalidate query
- (e) **Cron `purge-soft-deleted-listings.task.ts`** (NEW Story 3.6 — `@nestjs/schedule` `@Cron('0 5 * * *')` 5am UTC daily — décalé Story 3.4 photos cron 3am UTC + Story 3.3 drafts cron 4am UTC pour spread) qui hard-delete listings `deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '7 days'` :
  - DELETE listing row + cascade DELETE listing_translations + listing_photo (Story 3.2 schema cascade) + UPDATE related media-svc.media.listing_id = NULL (orphan photos qui seront purged via Story 3.4 cron 7j post `deleted_at`)
  - Outbox event `catalog.listing.purged.v1` (NEW Story 3.6 — payload `{ listingId, proProfileId, purgedAt, originalCreatedAt }`) consumed Story 2.7 audit_log (`catalog.*` subscription if extended V1+ — MVP no-op)
  - Métriques Prom : `tukio_catalog_listings_purged_total` + `tukio_catalog_listings_purge_duration_seconds`
- (f) **`POST /v1/listings/:id/duplicate` endpoint** Story 3.6 NEW :
  - Use case `duplicate-listing.usecase.ts` (NEW Story 3.6 catalog-svc) — load source listing + clone Listing aggregate (new id + new slug `Slug.fromTitle(title.fr + ' (copie)', randomSuffix=true)` + status='draft' + photos cloned avec NEW Photo VOs (réutilise même `r2_key` + `cloudflareImageId` car même fichier physique, mais nouveau Photo.id + listing_id) — **NB MVP** : photos reference same R2/CF Images files (cost-efficient). Si Pro modifie photos sur duplicate, Story 3.4 pipeline gère normalement (re-upload = new files). Si Pro delete duplicate, photos NOT deleted from R2/CF Images si encore référencées par source listing — cron Story 3.4 7j gère orphans gracefully.
  - Frontend redirect `/seller/listings/:newId/edit?step=1` (wizard Story 3.3 mode edit pre-rempli)
- (g) **i18n FR/EN** : namespace `seller.listings.list.*` ~30 keys × 2 locales (status badges, action labels, modales titres/descriptions, empty states, filter tabs, toasts)
- (h) **Empty states** :
  - 0 listings tous status → `<EmptyState variant="info">` "Aucune fiche" + CTA "Créer ma 1ère fiche" → `/seller/listings/new` Story 3.3
  - 0 dans tab spécifique (e.g., 0 unpublished) → `<EmptyState variant="info">` "Aucune fiche dépubliée"
- (i) **Accessibility RGAA AA** : `<DataTable>` semantic `<table>` + sortable columns aria-sort + ActionsMenu kbd navigable + modales focus trap + axe-core 0 violations,

**so that** Marc Pro tukio_status='active' avec 3 listings (1 draft, 1 published, 1 unpublished) navigue `/seller/listings` → render Card layout 3 rows + status badges + filter tabs avec counts → click tab "Publiées" → URL `?status=published` → 1 listing visible → click ActionsMenu → "Dépublier" → modal warning + active bookings count 0 → confirm → POST unpublish → toast succès + listing migre tab "Dépubliées" ; Marc édite listing draft → wizard Story 3.3 reuse → click "Publier" → applique Story 3.5 publish rules → autoPublish=true (Marc trusted) → status='published' visible search Story 3.7 ; Marc duplique listing successful → redirect wizard pre-rempli "Tente Marquee 6m (copie)" → ajuste prix + slug → publie ; Pierre Pro tente delete listing published → 422 error inline "Dépubliez d'abord" ; cron 5am UTC tourne → 5 listings soft-deleted > 7j → hard-delete + cascade + audit ; un test `pnpm playwright test --grep "seller listings management"` passe FR/EN axe-core 0 violations 11 scénarios (page render 4 status counts, filter tabs URL sync, edit redirect wizard, duplicate flow, unpublish modal active bookings warning, delete draft happy, delete published blocked, cron purge 7d simulation, RGAA modale focus trap, empty state, mobile responsive Card stack).

## Acceptance Criteria

1. **AC1 — `GET /v1/listings/me` endpoint Story 3.2 use case full integration** : Given Story 3.2 livré `list-pro-listings.usecase.ts` full + cursor pagination, When je consulte gateway-api Story 3.6, Then :
   - **NEW gateway endpoint** `GET /v1/listings/me?status=all|draft|pending_moderation|published|unpublished&cursor=&pageSize=20&sort=updated_at:desc`
   - **Status filter multi-value** : `?status=draft,unpublished` (comma-separated) ou single-value
   - **Use case extension** : `list-pro-listings.usecase.ts` accepte `status?: ListingStatus[]` array filter (Story 3.2 livré single status — Story 3.6 étends array support)
   - **Response** : enveloppe paginée `{ data: ListingSummary[], pagination, meta }` avec `ListingSummary` shape `{ id, slug, status, title: { fr, en? }, pricingMode, pricingAmountCents, currency, photosCount, firstPhotoUrls?: { thumbnail }, createdAt, updatedAt, publishedAt?, unpublishedAt? }` — DTO `@tukio/contracts/dtos/catalog/listing-summary.dto.ts` NEW
   - **Counts per status** : query param `?includeCounts=true` returns additionnel `meta.statusCounts: { all, draft, pending_moderation, published, unpublished }` for filter tabs UI
   - **Throttle** : 60/min/user
   - Tests E2E gateway 6 scenarios (all status, single filter, multi filter, cursor pagination, counts, RBAC cross-pro 403)

2. **AC2 — Page `/seller/listings` Server Component + filter tabs + listing rows** : Given AC1, When je consulte `apps/seller/src/app/[locale]/seller/listings/page.tsx` (NEW Server Component), Then :
   - **Page Server Component** :
     1. Fetch `GET /v1/listings/me?includeCounts=true&status={searchParams.status ?? 'all'}` parallel + `GET /v1/me` (Story 1.8) for header
     2. Render `<SellerListingsLayout>` Client Component avec data initial
   - **`<SellerListingsLayout>` Client Component** :
     - `<HeroSection>` title + count + CTA "+ Créer une fiche"
     - `<FilterTabs>` 5 tabs avec counts dynamiques + URL state sync via `?status=...`
     - `<ListingsGrid>` ou `<DataTable>` selon UX-DR15 (gap MVP — choisir Card grid layout `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` style Stories 3.10 future détaillées)
     - Each `<ListingRow>` (or `<ListingCard>`) component cf. story body section a
     - `<ResumeDraftBanner>` Story 3.3 réutilisé en haut si drafts existent
     - Cursor pagination via TanStack Query `useInfiniteQuery({ queryKey: ['listings', 'me', filters], queryFn: ..., getNextPageParam })`
     - Empty state per tab cf. story body section h
   - **i18n** namespace `seller.listings.list.*` ~30 keys × 2 locales
   - Tests `@testing-library/react` : 8 scenarios (render counts, filter tab change URL sync, listing row render all status, empty state, cursor pagination next, resume draft banner integration, RGAA semantic table)

3. **AC3 — `<ActionsMenu>` conditionnel par status + 4 actions** : Given AC2, When je consulte `apps/seller/src/features/seller/listings/components/ActionsMenu.tsx` (NEW), Then :
   - **`@radix-ui/react-dropdown-menu` v2+** (latest stable — Tailwind v4 + Headless UI compatible, RGAA-friendly)
   - **Items conditionnels per status** :
     ```ts
     const actions = useMemo(() => {
       const all: Action[] = [];
       if (status !== 'pending_moderation') all.push({ label: t('actions.edit'), icon: <PencilIcon />, onClick: () => router.push(`/seller/listings/${id}/edit?step=1`) });
       all.push({ label: t('actions.duplicate'), icon: <CopyIcon />, onClick: handleDuplicate });
       if (status === 'published') all.push({ label: t('actions.unpublish'), icon: <ArchiveIcon />, variant: 'warning', onClick: () => setShowUnpublishModal(true) });
       if (status === 'draft' || status === 'unpublished') all.push({ label: t('actions.delete'), icon: <TrashIcon />, variant: 'danger', onClick: () => setShowDeleteModal(true) });
       return all;
     }, [status, id]);
     ```
   - **Keyboard navigation** : Tab + Arrow keys + Enter/Space activate (Radix natif RGAA)
   - **Mobile responsive** : long-press alternative + bottom-sheet style (Radix MobileSheet variant)
   - Tests : 4 status scenarios (each shows correct items + missing items)

4. **AC4 — `<UnpublishModal>` + `POST /v1/listings/:id/unpublish` endpoint** : Given AC3 + Story 3.2 `unpublish-listing.usecase` full, When :
   - **NEW gateway endpoint** :
     ```ts
     @Post('/:id/unpublish')
     @UseGuards(KeycloakJwtGuard, RolesGuard)
     @Roles('pro')
     @HttpCode(200)
     async unpublish(@Param('id', ParseUUIDPipe) id: string, @CurrentActor() actor: Actor): Promise<{ listingId: string; status: 'unpublished'; unpublishedAt: string }> {
       return this.listingsForwarder.getInstance().unpublish({ listingId: id, proProfileId: actor.proProfileId });
     }
     ```
   - **NEW gateway endpoint** `GET /v1/listings/:id/active-bookings-count` (Story 3.6 stub returning `{ count: 0 }` MVP — Story 4.x finalise avec real query booking-svc internal endpoint)
   - **`<UnpublishModal>`** Client Component :
     - Pre-fetch active bookings count on modal open
     - If `count > 0` → strong warning Alert error + lien (Story 4.x future)
     - Confirm CTA disabled briefly (200ms) après modale open pour prevent accidental fast-click confirm (UX safety)
     - Mutation `useUnpublishListingMutation` → onSuccess invalidate listings query + toast
   - **Errors** : 409 `LISTING-STATUS-CONFLICT-001` si listing déjà unpublished
   - Tests E2E : 3 scenarios (happy unpublish + active bookings warning + 409 already unpublished)

5. **AC5 — `<DeleteModal>` + `DELETE /v1/listings/:id` endpoint + cascade photos** : Given AC3 + Story 3.2 `delete-listing.usecase` full + Story 3.4 photos pipeline, When :
   - **NEW gateway endpoint** :
     ```ts
     @Delete('/:id')
     @UseGuards(KeycloakJwtGuard, RolesGuard)
     @Roles('pro')
     @HttpCode(200)
     async softDelete(@Param('id', ParseUUIDPipe) id: string, @CurrentActor() actor: Actor): Promise<{ ok: true; deletedAt: string }> {
       return this.listingsForwarder.getInstance().softDelete({ listingId: id, proProfileId: actor.proProfileId });
     }
     ```
   - **`<DeleteModal>`** Client Component cf. story body section d
   - **Errors** :
     - 422 `LISTING-CANNOT-DELETE-PUBLISHED-001` si tentative delete sur status='published'
     - 404 not found
     - 403 cross-pro
   - **Cascade photos soft-delete** : Story 3.6 catalog-svc `delete-listing.usecase` (Story 3.2 full) consume Story 3.4 media-svc internal endpoint `DELETE /internal/media/by-listing/:listingId` (NEW Story 3.6 minor extension Story 3.4 — soft-delete all photos linked to listingId). **Story 3.4 internal endpoint UPDATE** : add bulk soft-delete by listingId.
   - Tests E2E : 3 scenarios (happy delete draft + cannot delete published 422 + cannot delete pending_moderation 422)

6. **AC6 — `POST /v1/listings/:id/duplicate` endpoint + duplicate-listing.usecase** : Given AC3, When :
   - **NEW gateway endpoint** :
     ```ts
     @Post('/:id/duplicate')
     @UseGuards(KeycloakJwtGuard, RolesGuard)
     @Roles('pro')
     @HttpCode(201)
     async duplicate(@Param('id', ParseUUIDPipe) id: string, @CurrentActor() actor: Actor): Promise<{ newListingId: string; newSlug: string }> {
       return this.listingsForwarder.getInstance().duplicate({ sourceListingId: id, proProfileId: actor.proProfileId });
     }
     ```
   - **NEW use case** `apps/catalog-svc/src/usecases/duplicate-listing.usecase.ts` :
     ```ts
     async execute(input: { sourceListingId, proProfileId, correlationId }): Promise<{ newListingId, newSlug }> {
       return this.txnManager.runInTransaction(async (txn) => {
         const source = await txn.listingRepo.findById(input.sourceListingId);
         if (!source) throw new ListingNotFoundException(input.sourceListingId);
         if (source.proProfileId !== input.proProfileId) throw new ListingForbiddenException();

         // Clone via Listing.create static factory + new slug
         const duplicateTitle = source.title.getFor('fr') + ' (copie)';
         const newSlug = Slug.fromTitle(duplicateTitle, true); // 6-char nanoid suffix anti-collision
         const newTitle = new TitleMultilang(duplicateTitle, source.title.getFor('en') ? source.title.getFor('en') + ' (copy)' : null);
         const duplicated = Listing.create({
           proProfileId: source.proProfileId, categoryId: source.categoryId, serviceTypeId: source.serviceTypeId,
           slug: newSlug, title: newTitle, description: source.description, pricing: source.pricing, serviceArea: source.serviceArea,
         });
         // Clone photos VOs (same r2_key + cloudflareImageId — files referenced, no duplication R2/CF storage)
         for (const photo of source.photos) {
           duplicated.addPhoto(new Photo({ id: PhotoId.generate(), r2Key: photo.r2Key, cloudflareImageId: photo.cloudflareImageId, altText: photo.altText, sortOrder: photo.sortOrder }));
         }
         await txn.listingRepo.save(duplicated);
         await txn.eventPublisher.publish({
           eventType: 'catalog.listing.duplicated', eventVersion: 'v1',
           aggregate: { type: 'Listing', id: duplicated.id },
           actor: { userId: input.proProfileId, role: 'pro' },
           correlationId: input.correlationId,
           payload: { newListingId: duplicated.id, sourceListingId: source.id, proProfileId: input.proProfileId, duplicatedAt: new Date().toISOString() },
           occurredAt: new Date(),
         });
         return { newListingId: duplicated.id, newSlug: duplicated.slug.value };
       });
     }
     ```
   - **NEW NATS event schema** `catalog/listing-duplicated.v1.{schema.json,ts}` (NEW Story 3.6) — payload `{ newListingId, sourceListingId, proProfileId, duplicatedAt }`
   - **Frontend redirect** : on success `router.push(`/seller/listings/${newListingId}/edit?step=1`)` (wizard Story 3.3 mode edit pre-rempli)
   - Tests E2E : 2 scenarios (duplicate happy + cross-pro 403)

7. **AC7 — Cron `purge-soft-deleted-listings.task.ts` daily 5am UTC** : Given partial index Story 3.2, When je consulte `apps/catalog-svc/src/infrastructure/tasks/purge-soft-deleted-listings.task.ts` (NEW), Then :
   ```ts
   @Cron('0 5 * * *', { timeZone: 'UTC' }) // 5am UTC daily — staggered with Story 3.4 photos cron 3am + Story 3.3 drafts cron 4am
   async run(): Promise<void> {
     const correlationId = randomUUID();
     const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
     const candidates = await this.listingRepo.findSoftDeletedOlderThan({ cutoff, limit: 1000 });
     this.metrics.gauge('tukio_catalog_listings_purge_candidates_count').set(candidates.length);
     for (const listing of candidates) {
       try {
         // Hard-delete — cascade listing_translations + listing_photo via DB ON DELETE CASCADE
         // media-svc photos with listing_id = NULL after CASCADE → orphans purged by Story 3.4 cron 7j based on media.deleted_at
         await this.listingRepo.hardDelete(listing.id);
         await this.eventPublisher.publishStandalone({
           eventType: 'catalog.listing.purged', eventVersion: 'v1',
           aggregate: { type: 'Listing', id: listing.id },
           actor: { userId: 'system', role: 'system' },
           correlationId,
           payload: { listingId: listing.id, proProfileId: listing.proProfileId, purgedAt: new Date().toISOString(), originalCreatedAt: listing.createdAt.toISOString() },
           occurredAt: new Date(),
         });
         this.metrics.counter('tukio_catalog_listings_purged_total').inc();
       } catch (err) { this.logger.error({ err, listingId: listing.id }, 'listing purge failed — skip retry next day'); }
     }
   }
   ```
   - **NEW repo method** `IListingRepository.findSoftDeletedOlderThan` + `hardDelete`
   - **NEW NATS event schema** `catalog/listing-purged.v1.{schema.json,ts}`
   - Tests integration testcontainer 3 scenarios

8. **AC8 — Métriques Prom + tests E2E + i18n + commit** :
   - **Métriques NEW** :
     - `tukio_catalog_listings_unpublish_total{result}` (counter)
     - `tukio_catalog_listings_delete_total{result, status_at_delete}` (counter)
     - `tukio_catalog_listings_duplicate_total` (counter)
     - `tukio_catalog_listings_purge_candidates_count` (gauge)
     - `tukio_catalog_listings_purged_total` (counter)
     - `tukio_catalog_listings_purge_duration_seconds` (histogram)
   - **i18n** : namespace `seller.listings.list.*` (~30 keys × 2 locales)
   - **Tests Playwright e2e** 11 scenarios (cf. story Outcome) :
     - T1-2 page render FR + EN avec 4 status counts
     - T3 filter tabs URL sync `?status=published` → render filtered
     - T4 actions menu items conditionnels per status
     - T5 edit click → redirect wizard Story 3.3
     - T6 duplicate flow → redirect wizard pre-rempli
     - T7 unpublish modal happy + active bookings warning if count > 0 (mock booking-svc endpoint)
     - T8 delete draft happy + cascade photos soft-delete (verify Story 3.4 endpoint called)
     - T9 delete published blocked → 422 inline error
     - T10 cron purge 7d simulation testcontainer
     - T11 RGAA modale focus trap + ActionsMenu kbd nav + axe-core 0 violations + mobile Card stack responsive
   - Coverage ≥ 90 % use cases (duplicate + cron) + 80 % gateway endpoints + 85 % frontend page + components
   - **Commit** `feat(catalog,seller): Story 3.6 seller listings management page + edit/unpublish/delete/duplicate actions + cron purge 7d`

## Tasks / Subtasks

- [ ] **Task 1 — `@tukio/contracts` event schemas + DTOs** (AC: #1, #6, #7)
  - [ ] 1.1 — Event schemas `listing-duplicated.v1` + `listing-purged.v1`
  - [ ] 1.2 — DTOs `dtos/catalog/listing-summary.dto.ts` + `list-listings-query.dto.ts` (status array filter + cursor)
- [ ] **Task 2 — Use case `duplicate-listing.usecase.ts` + cron purge** (AC: #6, #7) — coverage ≥ 90 %
  - [ ] 2.1 — `duplicate-listing.usecase.ts` + spec (clone aggregate + photos refs)
  - [ ] 2.2 — Cron `purge-soft-deleted-listings.task.ts` `@Cron 0 5 * * *`
  - [ ] 2.3 — Tests integration testcontainer 3 scenarios cron
- [ ] **Task 3 — `list-pro-listings.usecase.ts` extension status array filter** (AC: #1)
  - [ ] 3.1 — Update Story 3.2 use case for status array
  - [ ] 3.2 — `includeCounts` query param meta response
- [ ] **Task 4 — gateway-api 5 endpoints + forwarders + Story 3.4 minor extension** (AC: #1, #4, #5, #6, #7)
  - [ ] 4.1 — `GET /v1/listings/me` + `GET /v1/listings/:id/active-bookings-count` stub
  - [ ] 4.2 — `POST /v1/listings/:id/unpublish`
  - [ ] 4.3 — `DELETE /v1/listings/:id`
  - [ ] 4.4 — `POST /v1/listings/:id/duplicate`
  - [ ] 4.5 — Story 3.4 media-svc internal endpoint UPDATE — add bulk soft-delete by listingId
  - [ ] 4.6 — Tests E2E gateway 12 scenarios
- [ ] **Task 5 — Page `/seller/listings` Server Component + SellerListingsLayout + ListingsGrid + ListingRow** (AC: #2)
  - [ ] 5.1 — Page Server Component
  - [ ] 5.2 — `<SellerListingsLayout>` Client Component
  - [ ] 5.3 — `<FilterTabs>` URL state sync
  - [ ] 5.4 — `<ListingsGrid>` ou `<DataTable>` Story 2.3 réutilisé
  - [ ] 5.5 — `<ListingRow>` / `<ListingCard>` component
  - [ ] 5.6 — Tests `@testing-library/react` 8 scenarios
- [ ] **Task 6 — `<ActionsMenu>` Radix dropdown** (AC: #3)
  - [ ] 6.1 — Install `@radix-ui/react-dropdown-menu` v2+
  - [ ] 6.2 — Component + items conditionnels per status
  - [ ] 6.3 — Mobile bottom-sheet variant
  - [ ] 6.4 — Tests RGAA kbd nav
- [ ] **Task 7 — `<UnpublishModal>` + active bookings count check** (AC: #4)
  - [ ] 7.1 — Component + warning Alert if active bookings > 0
  - [ ] 7.2 — `useUnpublishListingMutation` hook
  - [ ] 7.3 — Tests E2E 3 scenarios
- [ ] **Task 8 — `<DeleteModal>` + cascade photos soft-delete** (AC: #5)
  - [ ] 8.1 — Component + warning Alert irréversible 7j
  - [ ] 8.2 — `useDeleteListingMutation` hook
  - [ ] 8.3 — Tests E2E 3 scenarios
- [ ] **Task 9 — i18n + RGAA + métriques** (AC: #8)
  - [ ] 9.1 — i18n namespace `seller.listings.list.*` ~30 keys × 2 locales
  - [ ] 9.2 — RGAA AA tests axe-core sur 4 contextes (page + 3 modales)
  - [ ] 9.3 — Métriques Prom 6 nouvelles
- [ ] **Task 10 — Tests Playwright e2e + cron + commit** (AC: #8) — 11 tests
  - [ ] 10.1 — Tests E2E 11 scenarios
  - [ ] 10.2 — Coverage thresholds NFR71
  - [ ] 10.3 — Update `docs/project-context.md`
  - [ ] 10.4 — Commit

## Dev Notes

### Pourquoi Story 3.6 ferme la boucle Pro management Epic 3

Story 3.5 a livré la **publication initiale**. Story 3.6 livre la **gestion long-terme** : édition + dépublication + suppression + duplication. C'est la dernière story de la couche Pro management (3.3-3.6 = lifecycle complet wizard → publish → manage). Les Stories 3.7-3.12 livrent ensuite la couche Visitor public (search + listing detail + pro profile + page catégorie). Pattern complet **list page paginated + filter tabs URL state + actions menu conditionnel + 3 destructive modales avec safeties + cron purge** réutilisé Stories Epic 4 V1 (pro bookings management), Stories Epic 5 V1 (pro reviews management).

### Décisions techniques majeures actées

1. **Soft-delete + cron 7j hard-delete** — restore window UX safety + audit trail. Story 3.4 photos cron 7j gère orphans gracefully via `media.listing_id = NULL` post-cascade.
2. **Active bookings check stub Story 3.6 + finalise Story 4.x** — UX warning fort sans blocage technique strict (Pro decision). Story 4.x finalise endpoint avec real booking-svc query.
3. **Edit re-publish reuse Story 3.5 publish rules** — auto-publish si Pro toujours trusted, ou pending_moderation si profil dégradé entre temps.
4. **Cannot delete published** — UX safety + transactional history preservation. Pro doit unpublish first explicit.
5. **Duplicate clones photos refs (vs copy R2/CF Images files)** — cost-efficient. Stories Pro modifie photos = re-upload (Story 3.4 pipeline). Cron Story 3.4 7j gère orphans.
6. **`@radix-ui/react-dropdown-menu` v2+** ActionsMenu — RGAA-friendly modern + Tailwind v4 + Headless UI compatible.
7. **`<FilterTabs>` URL state sync** — shareable filtered view + browser back/forward.
8. **Cursor pagination** Story 2.3 pattern réutilisé.
9. **Cron 5am UTC daily** staggered with Story 3.3 drafts 4am UTC + Story 3.4 photos 3am UTC + Story 3.5 medians 2am UTC + Stories 1.9/2.5/2.6/2.7 — spread DB load.
10. **Frontend redirect wizard Story 3.3 mode edit** — DRY (no separate edit UI).
11. **EN strict + i18n FR/EN + RGAA AA + Pretre + envelope ADR-014 + latest stable versions** memories.

### Versions à utiliser

| Lib | Usage | Version | Notes |
|-----|-------|---------|-------|
| `@radix-ui/react-dropdown-menu` | ActionsMenu | latest stable v2+ | RGAA + Tailwind v4 compatible |
| `next-intl` `formatRelativeTime` | Last updated relative time | (Story 0.9 already installed) | |

(Autres : Stories 0.5/0.9/2.3/3.2/3.3/3.4/3.5 réutilisés)

### Project Structure cible

```
packages/contracts/src/events/catalog/
├─ listing-duplicated.v1.{schema.json,ts}                        # NEW Story 3.6
└─ listing-purged.v1.{schema.json,ts}                            # NEW

packages/contracts/src/dtos/catalog/
├─ listing-summary.dto.ts                                        # NEW (ListingSummary shape for /v1/listings/me)
└─ list-listings-query.dto.ts                                    # NEW (status array filter + cursor + includeCounts)

apps/catalog-svc/src/
├─ usecases/
│  ├─ duplicate-listing.usecase.ts + spec                        # NEW Story 3.6
│  └─ list-pro-listings.usecase.ts                               # UPDATE Story 3.2 — extend status array filter
├─ infrastructure/
│  ├─ persistence/typeorm/repositories/listing.typeorm.repository.ts  # UPDATE — findSoftDeletedOlderThan + hardDelete
│  └─ tasks/purge-soft-deleted-listings.task.ts                  # NEW (cron 5am UTC daily)

apps/media-svc/src/
└─ infrastructure/http/controllers/internal-media.controller.ts  # UPDATE Story 3.4 — add bulk soft-delete by listingId endpoint

apps/gateway-api/src/
├─ usecases/catalog/listings.forwarder.ts                        # UPDATE Story 3.3 — add 5 new methods (list-me, unpublish, delete, duplicate, active-bookings-count stub)
└─ infrastructure/http/controllers/listings.controller.ts        # UPDATE — add 5 new endpoints

apps/seller/src/
├─ app/[locale]/seller/listings/page.tsx                         # NEW Server Component
├─ features/seller/listings/
│  ├─ components/
│  │  ├─ SellerListingsLayout.tsx                                # NEW Client Component
│  │  ├─ FilterTabs.tsx                                          # NEW
│  │  ├─ ListingsGrid.tsx                                        # NEW (Card grid layout)
│  │  ├─ ListingCard.tsx                                         # NEW (or ListingRow)
│  │  ├─ ActionsMenu.tsx                                         # NEW (Radix dropdown)
│  │  ├─ UnpublishModal.tsx                                      # NEW
│  │  └─ DeleteModal.tsx                                         # NEW
│  └─ hooks/
│     ├─ use-list-my-listings-query.ts                           # NEW (TanStack useInfiniteQuery)
│     ├─ use-unpublish-listing-mutation.ts                       # NEW
│     ├─ use-delete-listing-mutation.ts                          # NEW
│     ├─ use-duplicate-listing-mutation.ts                       # NEW
│     └─ use-active-bookings-count.ts                            # NEW (stub query)
└─ messages/{fr,en}.json                                         # UPDATE — i18n seller.listings.list.* ~30 keys × 2

apps/seller/e2e/listings/management.spec.ts                      # NEW Story 3.6 (11 tests)

# Estimation : ~25 nouveaux + ~5 updates = ~30 fichiers
```

### Critical Architecture Constraints

> Cf. Stories 0.5 (atomics), 0.9 (TanStack Query + next-intl), 1.7 (admin layout reference for seller), 2.3 (cursor pagination + DataTable), 2.4 (focus-trap-react), 3.2 (Listing aggregate + 8 use cases full), 3.3 (wizard `/seller/listings/:id/edit` reuse), 3.4 (media-svc internal endpoint extension), 3.5 (publish workflow Story 3.5 reuse for re-publish post-edit).

1. **Pretre architecture stricte** — duplicate use case in `usecases/`, cron in `infrastructure/tasks/`.
2. **Transactional outbox ADR-007** — duplicate + cron events single transaction.
3. **API responses envelope ADR-014**.
4. **EN strict + i18n FR/EN + RGAA AA + latest stable versions** memories.
5. **Cursor pagination Story 2.3** réutilisé.
6. **State machine Story 3.2** invariants enforce.

### Previous Story Intelligence

**Story 0.5 (atomics + patterns)** : `<Card>`, `<Badge>`, `<Modal>`, `<Alert>`, `<Avatar>` réutilisés.

**Story 2.3 (admin queue + DataTable + cursor pagination)** : pattern réutilisé pour `/seller/listings` page.

**Story 2.4 (focus-trap-react)** : modales destructives focus trap.

**Story 3.2 (Listing aggregate + use cases full)** : Story 3.6 consume `unpublish-listing`, `delete-listing`, `update-listing` (full Story 3.2). Add NEW `duplicate-listing` Story 3.6.

**Story 3.3 (wizard `/seller/listings/:id/edit`)** : Story 3.6 redirect Edit + Duplicate vers wizard Story 3.3 mode edit. Reuse complète.

**Story 3.4 (photos pipeline + cron purge 7d)** : Story 3.6 cascade soft-delete photos via Story 3.4 internal endpoint UPDATE bulk-by-listingId. Story 3.4 cron 7j gère orphans `media.listing_id = NULL`.

**Story 3.5 (publish workflow + auto-publish + median)** : Story 3.6 edit → re-publish reuse Story 3.5 endpoint + apply same rules.

### What this story does NOT do

- ❌ **Story 3.7 Meilisearch indexer** consume `catalog.listing.unpublished.v1` + `catalog.listing.deleted.v1` events Story 3.6 — Story 3.7 implement.
- ❌ **Story 4.x active bookings real query** — Story 3.6 livre stub MVP returning count=0. Story 4.x finalise.
- ❌ **Restore deleted listing < 7d via support tool** — V1+ admin tool. MVP Pro contacte support@tukio.one.
- ❌ **Bulk operations (delete multiple, unpublish multiple)** — V1+ admin tools.
- ❌ **Listing analytics (views, search ranking)** — V1+ Stories 7.x analytics.
- ❌ **Listing version history (rollback edits)** — V1+ if requested.

### Files to UPDATE vs CREATE

(Cf. Project Structure cible — annoté UPDATE/NEW)

### Testing Standards

- Coverage ≥ 90 % duplicate use case + cron purge
- Coverage ≥ 80 % gateway endpoints + frontend page + components
- E2E Playwright FR/EN axe-core 0 violations 11 tests AC8
- Tests integration testcontainer cron 3 scenarios
- Perf : page /seller/listings load < 1s p90 with cursor pagination, modale open < 100ms

### Project Structure Notes

✅ **Aligné architecture, PRD §FR23 (catalog management), §FR99 (FR obligatoire), §UX-DR15 (seller listings page gap MVP), §NFR71 (coverage), Stories 0.5/0.9/2.3/2.4/3.2/3.3/3.4/3.5, memories.**

⚠️ **Décision** : Soft-delete + cron 7j — restore window UX safety.
⚠️ **Décision** : Active bookings stub Story 3.6 + finalise Story 4.x — UX warning sans blocage strict MVP.
⚠️ **Décision** : Edit re-publish reuse Story 3.5 rules — auto-publish ou moderation selon profil actuel.
⚠️ **Décision** : Cannot delete published — UX safety + history preservation.
⚠️ **Décision** : Duplicate clones photos refs (no R2/CF copy) — cost-efficient + cron handles orphans.
⚠️ **Décision** : Cron staggered times (3am photos / 4am drafts / 5am listings) — spread DB load.
⚠️ **Décision** : Frontend redirect wizard Story 3.3 — DRY no duplicate UI.

### References

- [Source: epics.md#Epic-3-Story-3.6 — Lines 1474-1488]
- [Source: prd.md#FR23 (catalog management), #FR99 (FR obligatoire), #UX-DR15 (seller listings page)]
- [Source: architecture.md — ADR-007 outbox, ADR-014 envelope, lines 2120-2164 Pretre]
- [Source: Stories 0.5 (atomics), 0.9 (TanStack Query), 2.3 (cursor pagination), 2.4 (focus-trap), 3.2 (use cases full), 3.3 (wizard edit reuse), 3.4 (photos pipeline + cron + internal endpoint), 3.5 (publish workflow reuse)]
- [Memory: feedback_clean_architecture_explicit.md, feedback_api_envelope_response.md, feedback_tech_layer_english.md, feedback_i18n_frontend.md, feedback_latest_versions.md]

## Dev Agent Record

### Agent Model Used

(à remplir)

### Debug Log References

### Completion Notes List

(à remplir à la fin — résumé décisions, déviations vs Dev Notes avec justification, points d'attention pour Story 3.7 (Meilisearch indexer consume `catalog.listing.unpublished.v1` + `catalog.listing.deleted.v1` events Story 3.6), Story 4.x V1 (booking active count real query — replace stub Story 3.6), Story 6.x V1 (admin restore deleted listing tool))

### File List

(à remplir au fil de l'implémentation par le dev agent)

---

## Story Completion Status

- **Story Status** : `ready-for-dev`
- **Created** : 2026-05-09
- **Created by** : `bmad-create-story` workflow
- **Epic** : Epic 3 — Catalog Publication & Discovery (MVP)
- **Sprint cible** : Sprint 4 (6ᵉ story Epic 3 — clôt Pro management couche)
- **Estimation effort** : 4-5 jours (1 dev fullstack — story complète : 5 endpoints + 1 use case + 1 cron + page + 6 components + 3 modales + i18n + 11 e2e tests, ~30 fichiers)
- **Dépendances upstream** : Stories 0.5, 0.9, 2.3, 2.4, 3.2, 3.3, 3.4, 3.5
- **Dépendances downstream** :
  - Story 3.7 Meilisearch indexer — consume `catalog.listing.unpublished.v1` + `catalog.listing.deleted.v1`
  - Story 4.x V1 — replace active bookings stub Story 3.6
  - Story 6.x V1 — admin restore deleted listing tool
- **FRs covered** :
  - **FR23 partial** ✅ catalog management complete (CRUD listings)
- **NFRs touchés** :
  - **NFR71** ✅ coverage thresholds
  - **NFR47/50** ✅ RGAA AA modales + ActionsMenu kbd nav

> **Prochaine story → Story 3.7** (Meilisearch index per locale + outbox-driven sync — consume Stories 3.5/3.6 events + index per locale FR/EN + facets)

---

**Dev agent next steps :**
1. Lire ce file complètement
2. Vérifier upstream Stories 0.5, 0.9, 2.3, 2.4, 3.2, 3.3, 3.4, 3.5 implémentées
3. Implémenter Tasks 1-10 dans l'ordre
4. Lancer `pnpm playwright test --grep "seller listings management"` après chaque jalon
5. Commit Story 3.6 quand : 11/11 e2e + coverage NFR71 + axe-core 0 + cron testé + Story 3.4 internal endpoint extension testée
6. Update sprint-status : `3-6-...: review` puis `done`
