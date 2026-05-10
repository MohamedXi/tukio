# Story 3.7: Meilisearch index per locale + outbox-driven sync (FR33, FR103)

Status: ready-for-dev

## Story

**As a** developer Tukio (gardien de la cohérence search + résilience pannes infra) + downstream Visitor user qui dépend search performance NFR1 < 150 ms p95,
**I want** **livrer la couche search backend** : 2 index Meilisearch (`listings_fr` + `listings_en`) auto-synced via consumer NATS outbox-driven (consume événements Stories 3.5/3.6 publiés `catalog.listing.{published,unpublished,deleted,updated}.v1`) + setup script index settings + fallback FR if EN missing (NFR60 strategy mirror Story 3.1 categories) + DLQ NATS retry pattern + cron reconcile weekly DB vs Meilisearch (NFR42/46 résilience) — Story 3.5 a livré la **publication initiale** (event `catalog.listing.published.v1` published) + Story 3.6 a livré **unpublish/delete events**. Story 3.7 livre maintenant la **boucle search backend complète** :
- (a) **Setup script `infra/meilisearch/setup-indexes.ts`** (NEW Story 3.7 — pattern Story 3.1 seed-categories réutilisé : TypeScript executable via `tsx` + idempotent ré-exécutable safely) qui :
  1. Connect Meilisearch via SDK `meilisearch` v0.50+ (latest stable JS SDK Meilisearch v1.10+)
  2. Create or update 2 index : `listings_fr` + `listings_en` (idempotent via `client.getIndex(uid)` + try/catch IndexNotFound → `client.createIndex(uid, { primaryKey: 'id' })`)
  3. Configure settings per index :
     ```ts
     await fr_index.updateSettings({
       searchableAttributes: [
         'title',           // localized FR title (priority 1 — title weight)
         'description',     // localized FR description
         'categoryName',    // FR category name (e.g., 'Chapiteaux & barnums' Story 3.1 translations)
         'subcategoryName', // FR subcategory name
         'proName',         // pro company name (cross-locale — names not translated)
         'city',            // city name (FR primary)
       ],
       filterableAttributes: [
         'categorySlug',         // EN strict (Story 3.1 — search by category)
         'subcategorySlug',      // EN strict
         'serviceTypeSlug',      // EN strict
         'postalCode',           // FR format \d{5}
         'deliveryRadiusKm',     // numeric int
         'pricingMode',          // 'unit' | 'package'
         'priceUnitAmountCents', // numeric for range filters Story 3.9 future
         'minLeadTimeDays',      // numeric
         'capacity',             // numeric V1+ (currently null MVP — placeholder filterable)
         'status',               // always 'published' filtered (not displayed but defensive)
         '_fallback_locale',     // 'fr' marker if EN content fallback to FR
       ],
       sortableAttributes: ['publishedAt', 'priceUnitAmountCents', 'deliveryRadiusKm'],
       rankingRules: [
         'words', 'typo', 'proximity', 'attribute', 'sort', 'exactness',
         'publishedAt:desc', // recency boost — newer listings ranked slightly higher
       ],
       stopWords: ['de', 'la', 'le', 'les', 'du', 'des', 'et', 'à', 'au'], // FR stop words for FR index
       synonyms: { // V1+ extensible — MVP minimal
         'tente': ['chapiteau', 'barnum', 'marquee'],
         'chaise': ['siège'],
       },
       distinctAttribute: 'id', // ensure unique per listing
       faceting: { maxValuesPerFacet: 200 }, // for Story 3.9 facet display
       pagination: { maxTotalHits: 1000 }, // p99 limit — V1+ extensible
       typoTolerance: { enabled: true, minWordSizeForTypos: { oneTypo: 4, twoTypos: 8 } },
     });
     ```
  4. EN index : same settings but `stopWords` EN (`the, a, an, of, and, to, in, on, at`) + `synonyms` EN (`tent: marquee, pavilion`) — translations cohérentes Story 3.1
  5. Logging structured pino + métriques Prom : `tukio_meilisearch_setup_runs_total{result}` + `tukio_meilisearch_indexes_count` (gauge — should always be 2)
  6. Re-run safety : updateSettings idempotent (Meilisearch handles diffs natively)
- (b) **NATS consumer `listing-search-indexer.consumer.ts`** (`apps/catalog-svc/src/infrastructure/messaging/nats/`) — subscribe 4 subjects + idempotence inbox Story 0.7 :
```ts
@NatsConsumer({
  subjects: ['catalog.listing.published.v1', 'catalog.listing.unpublished.v1', 'catalog.listing.deleted.v1', 'catalog.listing.updated.v1'],
  durable: 'catalog-svc-search-indexer',
  inboxTable: 'inbox',
})
export class ListingSearchIndexerConsumer {
  @Handler()
  async handle(event: NatsEvent<unknown>): Promise<void> {
    switch (event.eventType) {
      case 'catalog.listing.published':
      case 'catalog.listing.updated':
        await this.indexListingUseCase.execute({ listingId: event.aggregate.id, eventType: event.eventType });
        break;
      case 'catalog.listing.unpublished':
      case 'catalog.listing.deleted':
        await this.removeListingFromIndexUseCase.execute({ listingId: event.aggregate.id });
        break;
      default:
        this.logger.warn({ eventType: event.eventType }, 'unexpected event type — skip');
    }
  }
}
```
- (c) **2 use cases catalog-svc** :
  - **`index-listing.usecase.ts`** (NEW — implements `ISearchIndexer` port livré Story 3.2) :
    1. Load listing via `IListingRepository.findById(listingId, { includeRelations: true })` — Story 3.2 reuse
    2. Skip if `listing.status !== 'published'` (defensive — should not happen given event source mais safety)
    3. Build `MeilisearchDocument` shape per locale (cf. story body section d)
    4. Index FR via `meilisearchClient.index('listings_fr').addDocuments([doc_fr])` (replace if exists — primaryKey id)
    5. Build EN document : if `listing.title.en !== null && listing.description.en !== null` → use EN translations, sinon use FR content + `_fallback_locale: 'fr'` flag (NFR60)
    6. Index EN via `meilisearchClient.index('listings_en').addDocuments([doc_en])`
    7. Outbox publish `catalog.listing.indexed.v1` (NEW Story 3.7 — payload `{ listingId, indexedAt, locales: ['fr', 'en'], hasEnTranslation: boolean }`) consumed Story 2.7 audit_log V1+ + Story 3.10 future detail page perf cache invalidation
  - **`remove-listing-from-index.usecase.ts`** (NEW) — `meilisearchClient.index('listings_fr').deleteDocument(listingId)` + `listings_en.deleteDocument(listingId)` parallel
- (d) **`MeilisearchDocument` shape** — DTO `@tukio/contracts/dtos/catalog/meilisearch-document.dto.ts` (NEW Story 3.7) :
```ts
export interface MeilisearchListingDocument {
  id: string;                     // listing.id (primaryKey)
  slug: string;                   // EN strict
  proProfileId: string;
  proName: string;                // listing.proCompanyName (cached from identity-svc)
  proSlug: string;                // pro public profile slug Story 3.11
  title: string;                  // localized
  description: string;            // localized truncated 500 chars (search snippet)
  categoryId: string;
  categorySlug: string;           // EN strict
  categoryName: string;           // localized
  subcategorySlug: string | null;
  subcategoryName: string | null; // localized
  serviceTypeSlug: string;
  pricingMode: 'unit' | 'package';
  priceUnitAmountCents: number;   // for sortable + range filter
  priceCurrency: 'EUR';
  pricingUnit: string | null;     // 'par jour' / 'per day' (mode='unit' only)
  minLeadTimeDays: number;
  postalCode: string;             // 5 digits FR
  city: string;                   // resolved from postalCode (pre-Story 3.8 city resolver — MVP placeholder INSEE postal lookup)
  deliveryRadiusKm: number;
  capacity: number | null;        // V1+ filterable, MVP null
  status: 'published';            // always 'published' (defensive — non-published not indexed)
  publishedAt: number;            // unix epoch ms (sortable)
  primaryPhotoUrls: { thumbnail: string; card: string };  // Story 3.4 variants
  photosCount: number;            // for UI hint
  reviewsAggregate: { count: number; averageScore: number | null }; // V1+ Story 5.8 (MVP {count: 0, averageScore: null})
  _fallback_locale?: 'fr';        // EN index only — flag if EN content fallback to FR (Story 5.9 badge "FR only" UI)
}
```
- (e) **`IListingSearchIndexerService` infra impl** `apps/catalog-svc/src/infrastructure/external/meilisearch/listing-search-indexer.service.ts` (implements Story 3.2 `ISearchIndexer` port) — wraps `meilisearch` SDK + métriques + retry exponential :
```ts
@Injectable()
export class ListingSearchIndexerService implements ISearchIndexer {
  constructor(@Inject(CONFIG_SERVICE) config: IConfigService) {
    this.client = new MeiliSearch({ host: config.getMeilisearchHost(), apiKey: config.getMeilisearchAdminApiKey() });
  }
  async indexListing(doc: MeilisearchListingDocument, locale: 'fr' | 'en'): Promise<void> {
    const indexName = locale === 'fr' ? 'listings_fr' : 'listings_en';
    await this.client.index(indexName).addDocuments([doc]);
  }
  async removeListing(listingId: string): Promise<void> {
    await Promise.all([
      this.client.index('listings_fr').deleteDocument(listingId),
      this.client.index('listings_en').deleteDocument(listingId),
    ]);
  }
  async search(input: { indexName: string; query: string; filter?: string; sort?: string[]; limit?: number; offset?: number }): Promise<MeilisearchSearchResponse> {
    return this.client.index(input.indexName).search(input.query, { filter: input.filter, sort: input.sort, limit: input.limit ?? 20, offset: input.offset ?? 0, attributesToHighlight: ['title', 'description'], facets: ['categorySlug', 'subcategorySlug', 'pricingMode'] });
  }
}
```
- (f) **DLQ NATS retry pattern** : NATS JetStream Story 0.7 livre déjà pattern retries + DLQ. Story 3.7 configure le consumer `catalog-svc-search-indexer` avec :
  - `max_deliver: 3` (3 retries)
  - `ack_wait: 30s` (timeout per delivery)
  - `backoff: ['1s', '5s', '15s']` (exponential)
  - Si 3 retries fail → DLQ stream `dlq.catalog.listing-indexer` (NEW Story 3.7 — provisioning script `infra/scripts/setup-nats-streams.sh` UPDATE Story 0.7 ajout DLQ stream)
  - Métriques : `tukio_meilisearch_index_failures_total{event_type, retry_count}` + alerting Prometheus si DLQ depth > 10 → Slack `#tukio-alerts-ops`
  - **Recovery procedure** : Story 6.x V1 admin tool consume DLQ + manual retry. MVP : runbook documenté pour ops manual replay via NATS CLI.
- (g) **Cron `meilisearch-reconcile.task.ts`** (NEW Story 3.7 — `@nestjs/schedule` `@Cron('0 6 * * 0')` Sunday 6am UTC weekly — pattern Stories 1.9/2.6/2.7/3.4 réutilisé staggered cron schedule) :
  1. Fetch all `listing` rows DB `WHERE status='published' AND deleted_at IS NULL` — paginate by 1000
  2. Fetch all docs Meilisearch `listings_fr` index (use `client.index('listings_fr').getDocuments({ limit: 1000, offset: ... })`)
  3. Compute diff : (a) **DB but not Meilisearch** = re-index (orphan-fix), (b) **Meilisearch but not DB** = remove (purge-orphans), (c) **both but content differs** (last 7d updated) = re-index (drift-fix — uses `updated_at` field comparison)
  4. Apply diffs sequentially (chunks of 100 to avoid Meilisearch rate limit ~1000 ops/sec)
  5. Outbox event `catalog.search.reconciled.v1` (NEW Story 3.7 — payload `{ reconciledAt, addedCount, removedCount, updatedCount, totalDbListings, totalMsListingsBefore }`) consumed Story 2.7 audit_log V1+ + Slack `#tukio-alerts-ops` if >5% drift detected (anomaly indicator)
  6. Métriques : `tukio_meilisearch_reconcile_drift_count{type}` + `tukio_meilisearch_reconcile_duration_seconds` histogram
- (h) **Story 3.4 forward-dep + Story 5.x V1+ extensions documentées** :
  - Story 3.4 `media.photo.uploaded.v1` event NOT consumed Story 3.7 directement (photos changes don't trigger re-index — listing-level event `catalog.listing.updated.v1` Story 3.6 captures all photo changes via aggregate save). Si V1+ Pro just edits altText without listing change → forward consider extending Story 3.7 consumer to subscribe `media.photo.alt-text-updated.v1` (V1+ refinement).
  - Story 5.8 V1 (Reviews aggregate display) extends `reviewsAggregate` field — Story 3.7 consumer ajoutera `subscribe + 'review.created.v1' + 'review.deleted.v1'` events (V1+ extension).
- (i) **Performance NFR1 < 150 ms p95** :
  - Meilisearch typical p95 search latency 30-80 ms en prod cloud → Story 3.7 OK
  - Index size MVP : 100-500 listings (PdL launch) — single Meilisearch instance suffit
  - V1+ scale : sharding + replication si > 100k listings

**so that** Marc fraîchement publié Story 3.5 → outbox event `catalog.listing.published.v1` → consumer Story 3.7 → 1 listing FR + 1 listing EN (avec fallback FR si pas de EN translation Marc) indexed dans 2 indexes Meilisearch en < 1s post-publish ; Visitor anglais search "tents Nantes" → query `listings_en` → 5 résultats (3 listings avec EN translations + 2 fallback FR avec badge "FR only" Story 5.9 UI) en 30 ms p90 ; Pro Pierre dépublie Story 3.6 → event consumed → listing supprimé des 2 indexes en < 500ms ; Pro Sophie supprime brouillon Story 3.6 → event consumed → noop (listing was draft, never indexed) ; Pierre Pro édite title/photos Story 3.6 → event `catalog.listing.updated.v1` → re-indexed avec nouveau content ; un cron weekly Sunday 6am UTC tourne → 0 drift typically (system robuste) ; un test `pnpm playwright test --grep "search indexer"` passe FR/EN axe-core 0 violations 12 scénarios (publish event index FR + EN, fallback FR EN missing, unpublish event remove, delete event remove, updated event re-index, DLQ after 3 retries, reconcile detect orphans + add to MS, reconcile detect MS-only + remove, reconcile drift detect + re-index, perf p95 < 80ms with 500 listings fixture, NFR42 resilience pannes Meilisearch retry success on 2nd, search facets categorySlug return correct facet counts) ; coverage ≥ 95 % consumer + 90 % use cases + cron reconcile + 80 % infra Meilisearch service ; pattern complet **outbox-driven indexer + DLQ retry + reconciliation cron + per-locale fallback** réutilisé Stories 5.x reviews search V1+, Stories Epic 11 V1+ in-app notifications search.

## Acceptance Criteria

1. **AC1 — Meilisearch setup script `infra/meilisearch/setup-indexes.ts`** : Given Story 0.10 livré docker-compose Meilisearch service, When je lance `pnpm meilisearch:setup` (NEW alias `package.json` root), Then :
   - **Script TypeScript executable via `tsx`** (pattern Story 3.1 seed-categories réutilisé) idempotent
   - **2 indexes créés/updated** : `listings_fr` + `listings_en` avec settings cf. story body section a
   - **Validation post-setup** : query `client.health()` returns OK + `client.getIndexes()` returns 2 indexes + settings diff check
   - **Doppler secrets** : `MEILISEARCH_HOST`, `MEILISEARCH_ADMIN_API_KEY` (admin key for index management — searchKey separate for read-only frontend Story 3.8)
   - **Logging structured + métriques** : `tukio_meilisearch_setup_runs_total{result}` counter + `tukio_meilisearch_indexes_count` gauge
   - Tests integration testcontainer Meilisearch (`getmeili/meilisearch:v1.10` Docker image) : 3 scenarios — happy create from scratch, idempotent re-run no-op diff, settings update detected and applied

2. **AC2 — `MeilisearchDocument` DTO + DTOs `@tukio/contracts`** : Given Story 0.2 contracts package, When je consulte `packages/contracts/src/dtos/catalog/`, Then :
   - **NEW DTO** `meilisearch-document.dto.ts` (cf. story body section d) avec Zod schema MeilisearchListingDocumentSchema validates field types + constraints (priceUnitAmountCents > 0, postalCode regex `\d{5}`, status='published', etc.)
   - **NEW DTO** `search-listings-query.dto.ts` (Story 3.8 forward-dep — Story 3.7 livre le shape Story 3.8 wirera l'endpoint frontend) `{ query?: string; categorySlug?: string; postalCodes?: string[]; deliveryRadiusKm?: number; pricingMode?: 'unit' | 'package'; priceMinCents?: number; priceMaxCents?: number; sort?: 'publishedAt:desc' | 'priceUnitAmountCents:asc' | 'deliveryRadiusKm:asc'; locale: 'fr' | 'en'; limit?: number; offset?: number }`
   - Tests Zod schema validation 5 cases

3. **AC3 — `ListingSearchIndexerService` infra impl + `ISearchIndexer` port** : Given Story 3.2 livré `ISearchIndexer` port, When je consulte `apps/catalog-svc/src/infrastructure/external/meilisearch/listing-search-indexer.service.ts`, Then :
   - **Lib** : `meilisearch` v0.50+ (latest stable JS SDK Meilisearch v1.10+)
   - **Implementation** cf. story body section e — `indexListing(doc, locale)`, `removeListing(listingId)`, `search(query, filters, sort)`
   - **Errors handling** :
     - `MeilisearchTimeoutError` (timeout > 5s) → throw → consumer retries via NATS JetStream
     - `MeilisearchAuthenticationError` → fatal log + alert Prometheus critical (token revoked or rotated wrong)
     - `MeilisearchIndexNotFoundError` (e.g., setup script not run yet) → throw `SearchInfrastructureNotReadyException` + Slack alert ops
   - **PII redaction logger** : Pino redact API keys + signed search keys never logged
   - Tests integration testcontainer Meilisearch : 6 scenarios (indexListing FR happy, indexListing EN with fallback FR, removeListing both indexes, search with filters + facets, timeout retry, auth fatal alert)

4. **AC4 — `index-listing.usecase.ts` + `remove-listing-from-index.usecase.ts`** : Given AC3 + Story 3.2 IListingRepository.findById(includeRelations), When je consulte `apps/catalog-svc/src/usecases/`, Then :
   - **`index-listing.usecase.ts`** :
     ```ts
     async execute(input: { listingId: string; eventType: 'catalog.listing.published' | 'catalog.listing.updated' }): Promise<void> {
       const listing = await this.listingRepo.findById(input.listingId, { includeRelations: true });
       if (!listing) {
         this.logger.warn({ listingId: input.listingId }, 'listing not found — skip indexing (probably deleted between event publish and consumer)');
         return;
       }
       if (listing.status !== 'published') {
         this.logger.debug({ listingId, status: listing.status }, 'listing not published — skip indexing');
         return;
       }

       // Build FR document
       const proProfile = await this.proProfileClient.getById(listing.proProfileId); // Story 3.2 IProProfileClient port reused — small extension to expose proCompanyName (Story 1.3 ProProfile.companyName)
       const category = await this.categoryRepo.findById(listing.categoryId, { locale: 'fr' });
       const serviceType = await this.serviceTypeRepo.findById(listing.serviceTypeId, { locale: 'fr' });
       const city = this.resolveCityFromPostalCode(listing.serviceArea.originPostalCode); // Story 3.7 helper — INSEE postal_codes lookup (forward-dep Story 3.8 city resolver, MVP fallback first 2 digits → département → simple mapping)

       const docFr: MeilisearchListingDocument = {
         id: listing.id, slug: listing.slug.value,
         proProfileId: listing.proProfileId, proName: proProfile.companyName, proSlug: proProfile.slug ?? proProfile.id, // Story 3.11 V1 pro slug
         title: listing.title.fr, description: listing.description.fr.slice(0, 500),
         categoryId: listing.categoryId, categorySlug: category.slug, categoryName: category.name, // FR translations Story 3.1
         subcategorySlug: null, subcategoryName: null, // V1+ subcategory hierarchy
         serviceTypeSlug: serviceType.slug,
         pricingMode: listing.pricing.mode,
         priceUnitAmountCents: listing.pricing.amount.amountCents,
         priceCurrency: 'EUR',
         pricingUnit: listing.pricing.mode === 'unit' ? listing.pricing.unit : null,
         minLeadTimeDays: listing.serviceArea.minLeadTimeDays,
         postalCode: listing.serviceArea.originPostalCode,
         city, deliveryRadiusKm: listing.serviceArea.deliveryRadiusKm,
         capacity: null, status: 'published',
         publishedAt: listing.publishedAt!.getTime(),
         primaryPhotoUrls: { thumbnail: listing.photos[0]?.cloudflareImageId ? this.cloudflareImagesService.getVariantUrls(listing.photos[0].cloudflareImageId).thumbnail : '', card: ... },
         photosCount: listing.photos.length,
         reviewsAggregate: { count: 0, averageScore: null }, // V1+ Story 5.8
       };
       await this.searchIndexer.indexListing(docFr, 'fr');

       // Build EN document — fallback FR if EN content missing
       const hasEnTranslation = listing.title.en !== null && listing.description.en !== null;
       const docEn: MeilisearchListingDocument = {
         ...docFr, // shared fields
         title: hasEnTranslation ? listing.title.en! : listing.title.fr,
         description: hasEnTranslation ? listing.description.en!.slice(0, 500) : listing.description.fr.slice(0, 500),
         categoryName: hasEnTranslation ? (await this.categoryRepo.findById(listing.categoryId, { locale: 'en' })).name : category.name,
         _fallback_locale: hasEnTranslation ? undefined : 'fr',
       };
       await this.searchIndexer.indexListing(docEn, 'en');

       await this.eventPublisher.publishStandalone({
         eventType: 'catalog.listing.indexed', eventVersion: 'v1',
         aggregate: { type: 'Listing', id: listing.id },
         actor: { userId: 'system', role: 'system' },
         correlationId: input.eventType + ':' + listing.id,
         payload: { listingId: listing.id, indexedAt: new Date().toISOString(), locales: ['fr', 'en'], hasEnTranslation, sourceEventType: input.eventType },
         occurredAt: new Date(),
       });
     }
     ```
   - **`remove-listing-from-index.usecase.ts`** : `await this.searchIndexer.removeListing(listingId)` + outbox event `catalog.listing.unindexed.v1` (NEW Story 3.7)
   - Tests unit ≥ 90 % each : 8 scenarios (happy index FR + EN, fallback FR EN missing, listing not found graceful skip, listing not published skip, identity-svc unavailable fallback proName=Anonymous, Meilisearch timeout retry, remove from both indexes, idempotent re-call same listingId)

5. **AC5 — NATS consumer `listing-search-indexer.consumer.ts` + DLQ pattern** : Given Story 0.7 outbox + JetStream + Story 3.7 use cases, When je consulte `apps/catalog-svc/src/infrastructure/messaging/nats/listing-search-indexer.consumer.ts`, Then :
   - **Subscribe 4 subjects** (cf. story body section b)
   - **DLQ config NATS JetStream** :
     ```ts
     const consumerConfig: ConsumerConfig = {
       durable_name: 'catalog-svc-search-indexer',
       deliver_policy: DeliverPolicy.New,
       ack_policy: AckPolicy.Explicit,
       ack_wait: 30 * 1_000_000_000, // 30s nanoseconds
       max_deliver: 3,
       backoff: [1_000_000_000, 5_000_000_000, 15_000_000_000], // 1s, 5s, 15s
       deliver_subject: 'catalog.listing-indexer.deliver',
       opt_start_seq: undefined,
     };
     // After 3 retries fail, NATS auto-publishes to dlq stream subject 'dlq.catalog.listing-indexer'
     ```
   - **DLQ stream provisioning** : UPDATE `infra/scripts/setup-nats-streams.sh` Story 0.7 — add stream `DLQ_CATALOG_LISTING_INDEXER` (subject `dlq.catalog.listing-indexer`, max_age 90 days, retention WorkQueue)
   - **Métriques** : `tukio_meilisearch_index_failures_total{event_type, retry_count}` (counter — alert Prom if DLQ depth > 10 = ops investigation needed)
   - **Idempotence inbox** Story 0.7 — duplicate event_id skip
   - Tests integration : 5 scenarios (consume happy 4 event types, retry on Meilisearch timeout success on 2nd, fail 3 times → DLQ, idempotent dedupe, recover from DLQ via manual replay)

6. **AC6 — Cron `meilisearch-reconcile.task.ts` weekly** : Given AC3-5, When je consulte `apps/catalog-svc/src/infrastructure/tasks/meilisearch-reconcile.task.ts`, Then :
   - **Cron** `@Cron('0 6 * * 0', { timeZone: 'UTC' })` Sunday 6am UTC weekly (pattern Stories 1.9/2.5/2.6/2.7/3.4/3.5/3.6 staggered)
   - **Algorithm** :
     1. Paginate DB published listings 1000 by 1000 → set `dbListingIds`
     2. Paginate Meilisearch `listings_fr` documents 1000 by 1000 → set `msListingIdsFr`
     3. Compute diffs : `addToMS = dbListingIds - msListingIdsFr`, `removeFromMS = msListingIdsFr - dbListingIds`, `driftCheck = intersection(dbListingIds, msListingIdsFr)` (compare doc.publishedAt vs db.published_at — V1+ heavier diff)
     4. For each `addToMS`: call `IndexListingUseCase.execute({ listingId, eventType: 'reconcile' })` (chunks of 100 to avoid MS rate limit)
     5. For each `removeFromMS`: call `RemoveListingFromIndexUseCase.execute({ listingId })`
     6. Skip drift detection MVP (heavy compute — V1+ extension)
   - **Outbox event** `catalog.search.reconciled.v1` (cf. story body section g)
   - **Métriques** + Slack alert if > 5% drift (anomaly indicator)
   - Tests integration testcontainer Meilisearch + Postgres : 4 scenarios (happy 0 drift, orphan add 5 listings, msOrphan remove 3 docs, mixed drift add+remove)

7. **AC7 — `IListingRepository.findById(options: { includeRelations? })` extension Story 3.2** + helper `resolveCityFromPostalCode` : Given Story 3.2 livré repo, When je consulte updates :
   - **UPDATE** `apps/catalog-svc/src/infrastructure/persistence/typeorm/repositories/listing.typeorm.repository.ts` Story 3.2 — `findById(id, options?: { includeRelations: boolean })` retourne avec eager load relations `translations + photos + category + serviceType` if option true (Story 3.7 needs full data for indexing)
   - **NEW helper service** `apps/catalog-svc/src/domain/service/postal-code-city-resolver.service.ts` (NEW Story 3.7) — MVP simple : load `infra/data/insee-postal-codes-fr.json` (NEW seed data Story 3.7 — INSEE postal codes France ~37k entries via INSEE base codes-postaux JSON) → returns `{ city: 'Nantes', department: 'Loire-Atlantique', region: 'Pays de la Loire' }` for postalCode '44000'. **Story 3.8 future** wirera ce helper pour search bar city autocomplete + remplacera par geo-svc V1.
   - Tests unit helper 5 cases (Nantes 44000, Paris 75001, postalCode invalid, postalCode not found, edge case Corsica 20)

8. **AC8 — NEW NATS event schemas + alerts Prom** : Given AC4-6, When je consulte `packages/contracts/src/events/catalog/`, Then :
   - **NEW event schemas** :
     - `listing-indexed.v1.{schema.json,ts}` — payload `{ listingId, indexedAt, locales: ['fr', 'en'], hasEnTranslation, sourceEventType }`
     - `listing-unindexed.v1.{schema.json,ts}` — payload `{ listingId, unindexedAt, sourceEventType }`
     - `search-reconciled.v1.{schema.json,ts}` — payload `{ reconciledAt, addedCount, removedCount, totalDbListings, totalMsListingsBefore, totalMsListingsAfter, durationMs }`
   - **Métriques Prom NEW** :
     - `tukio_meilisearch_index_total{event_type, locale, result}` (counter)
     - `tukio_meilisearch_index_duration_seconds` (histogram p50/p90/p99)
     - `tukio_meilisearch_index_failures_total{event_type, retry_count}` (counter)
     - `tukio_meilisearch_dlq_depth` (gauge — alert > 10)
     - `tukio_meilisearch_reconcile_drift_count{type}` (counter — alert > 5% total)
     - `tukio_meilisearch_reconcile_duration_seconds` (histogram)
     - `tukio_meilisearch_search_p95_seconds` (histogram — Story 3.8 future will measure end-to-end ; Story 3.7 measures index-side only)
   - **Prometheus rules NEW** `infra/k8s/prometheus-rules/catalog-search.yaml` :
     ```yaml
     - alert: MeilisearchDLQDepthHigh
       expr: tukio_meilisearch_dlq_depth > 10
       for: 30m
       labels: { severity: warning, team: ops }
     - alert: MeilisearchReconcileDriftHigh
       expr: tukio_meilisearch_reconcile_drift_count{type='total'} / tukio_catalog_listings_published_total > 0.05
       for: 1h
       labels: { severity: warning, team: ops }
     - alert: MeilisearchAuthFailures
       expr: rate(tukio_meilisearch_index_failures_total{retry_count='3'}[5m]) > 0.1
       for: 5m
       labels: { severity: critical, team: ops }
     ```
   - **Dashboard Grafana** `infra/k8s/grafana-dashboards/catalog-search.json` (NEW Story 3.7 ~6 panels) : index rate, p90 latency, DLQ depth, reconcile drift weekly, fallback EN ratio, search top queries (V1+)

9. **AC9 — Tests Playwright e2e + integration testcontainer + perf** : 12 scenarios :
   - **`apps/catalog-svc/test/integration/`** (testcontainer Meilisearch + Postgres) :
     - T1 publish event `catalog.listing.published.v1` → consumer → 1 doc indexed FR + 1 doc indexed EN (with fallback if EN missing) → metric increments
     - T2 fallback FR : Pro publishes listing with title.en = null → EN index doc has _fallback_locale='fr' flag
     - T3 unpublish event → docs removed both indexes
     - T4 delete event → docs removed (idempotent if not previously indexed — listing was draft)
     - T5 updated event → re-indexed with new content (e.g., price change)
     - T6 DLQ : Meilisearch down (mock) → 3 retries fail → event moved to DLQ stream → metric increments
     - T7 reconcile cron : 5 DB listings + 4 MS docs (1 missing) → cron adds the missing 1
     - T8 reconcile cron : 3 DB listings + 5 MS docs (2 stale) → cron removes the 2 orphans
     - T9 perf : 500 listings indexed → search query "tente Nantes" → < 80ms p90
   - **`apps/seller/e2e/listings/search-indexing.spec.ts`** (3 e2e — black-box validation flow Story 3.5/3.6/3.7 integration) :
     - T10 Pro publishes via Story 3.5 wizard → wait 3s → query Meilisearch directly → listing indexed both locales
     - T11 Pro unpublishes via Story 3.6 → wait 3s → query Meilisearch → listing removed
     - T12 Pro edits title via Story 3.6 → wait 3s → query Meilisearch → new title indexed
   - **Coverage** : ≥ 95 % consumer + 90 % use cases + cron + 80 % infra Meilisearch service

10. **AC10 — Documentation runbooks + commit** :
    - **NEW runbook** `docs/runbook/meilisearch-setup.md` (~50 lignes) — admin setup Meilisearch cloud account + admin API key + search API key + index creation via setup script
    - **NEW runbook** `docs/runbook/meilisearch-dlq-recovery.md` (~40 lignes) — manual replay events from DLQ via NATS CLI + retry logic + ops procedure
    - **NEW runbook** `docs/runbook/meilisearch-reconcile-debug.md` (~30 lignes) — cron debug + drift investigation + manual reconcile commands
    - **UPDATE** `docs/project-context.md` section "Catalog Search Backend (Story 3.7)" — flow diagram + indexes + DLQ + reconcile pattern
    - **Commit** `feat(catalog): Story 3.7 Meilisearch indexer outbox-driven sync + 2 indexes per locale + fallback FR + DLQ retry pattern + reconcile cron weekly + setup script`

## Tasks / Subtasks

- [ ] **Task 1 — `@tukio/contracts` event schemas + DTOs Meilisearch** (AC: #2, #8)
  - [ ] 1.1 — Event schemas listing-indexed + listing-unindexed + search-reconciled
  - [ ] 1.2 — DTO `meilisearch-document.dto.ts` + `search-listings-query.dto.ts` (forward Story 3.8)
  - [ ] 1.3 — Tests Zod
- [ ] **Task 2 — Meilisearch setup script + alias `pnpm meilisearch:setup`** (AC: #1)
  - [ ] 2.1 — `infra/meilisearch/setup-indexes.ts` (TypeScript executable via tsx)
  - [ ] 2.2 — Doppler secrets `MEILISEARCH_HOST` + `MEILISEARCH_ADMIN_API_KEY`
  - [ ] 2.3 — UPDATE `docker-compose.yml` Story 0.10 — add Meilisearch service for dev local
  - [ ] 2.4 — Tests integration testcontainer 3 scenarios
- [ ] **Task 3 — `ListingSearchIndexerService` infra impl `meilisearch` SDK** (AC: #3) — coverage ≥ 80 %
  - [ ] 3.1 — Service implements `ISearchIndexer` port Story 3.2
  - [ ] 3.2 — Errors handling timeout + auth + index not found
  - [ ] 3.3 — Tests integration testcontainer 6 scenarios
- [ ] **Task 4 — Use cases `index-listing` + `remove-listing-from-index`** (AC: #4) — coverage ≥ 90 %
  - [ ] 4.1 — `index-listing.usecase.ts` (build doc FR + EN with fallback)
  - [ ] 4.2 — `remove-listing-from-index.usecase.ts`
  - [ ] 4.3 — `IListingRepository.findById(options)` extension Story 3.2 (eager load relations)
  - [ ] 4.4 — `IProProfileClient` minor extension Story 3.2 (expose proCompanyName)
  - [ ] 4.5 — Tests unit 8 scenarios
- [ ] **Task 5 — `PostalCodeCityResolverService` + INSEE postal codes seed** (AC: #7)
  - [ ] 5.1 — Helper service `domain/service/postal-code-city-resolver.service.ts`
  - [ ] 5.2 — Seed data `infra/data/insee-postal-codes-fr.json` (~37k entries)
  - [ ] 5.3 — Tests unit 5 cases
- [ ] **Task 6 — NATS consumer `listing-search-indexer.consumer.ts` + DLQ pattern** (AC: #5) — coverage ≥ 95 %
  - [ ] 6.1 — Consumer subscribe 4 subjects + idempotence inbox
  - [ ] 6.2 — DLQ stream provisioning UPDATE `setup-nats-streams.sh` Story 0.7
  - [ ] 6.3 — Tests integration 5 scenarios consume + retry + DLQ
- [ ] **Task 7 — Cron `meilisearch-reconcile.task.ts` weekly** (AC: #6) — coverage ≥ 90 %
  - [ ] 7.1 — Task `@Cron 0 6 * * 0` Sunday 6am UTC
  - [ ] 7.2 — Repo methods `findAllPublishedPaginated` + Meilisearch `getDocuments` paginate
  - [ ] 7.3 — Tests integration testcontainer 4 scenarios
- [ ] **Task 8 — Métriques Prom + alerts + Grafana dashboard** (AC: #8)
  - [ ] 8.1 — 7 nouvelles métriques
  - [ ] 8.2 — Prometheus rules `catalog-search.yaml` 3 alerts
  - [ ] 8.3 — Dashboard Grafana `catalog-search.json` 6 panels
- [ ] **Task 9 — Tests Playwright e2e + integration + perf** (AC: #9)
  - [ ] 9.1 — Tests integration 9 scenarios testcontainer
  - [ ] 9.2 — Tests e2e 3 black-box flows
  - [ ] 9.3 — Coverage thresholds
- [ ] **Task 10 — Runbooks + commit** (AC: #10)
  - [ ] 10.1 — Runbook meilisearch-setup.md
  - [ ] 10.2 — Runbook meilisearch-dlq-recovery.md
  - [ ] 10.3 — Runbook meilisearch-reconcile-debug.md
  - [ ] 10.4 — Update project-context.md
  - [ ] 10.5 — Commit

## Dev Notes

### Pourquoi Story 3.7 ouvre la couche Visitor search Epic 3

Stories 3.1-3.6 ont livré la **couche Pro management** (taxonomy + listing aggregate + wizard + photos + publish + manage). Story 3.7 ouvre la **couche Visitor public** : sans Story 3.7, search Story 3.8 frontend n'a aucune source de données indexée. Pattern complet **outbox-driven indexer + per-locale + DLQ retry + cron reconcile + fallback locale** réutilisé Stories 5.x V1 (reviews search), Stories 11.x V1 (in-app notifications search).

### Décisions techniques majeures actées

1. **2 indexes per locale FR + EN** (vs 1 index avec field locale) — Meilisearch best practice : tokenizer + stop words + synonyms per language. Performance + relevance.
2. **Fallback FR if EN missing** + flag `_fallback_locale: 'fr'` — UX EN visitor voit listing FR avec badge "FR only" Story 5.9 (vs hide listing complètement = pertes commerciales).
3. **Outbox-driven sync** (vs polling DB) — résilient race conditions + idempotent + audit trail.
4. **DLQ NATS JetStream après 3 retries** — événements ne sont jamais perdus (NFR42/46) + ops manual replay.
5. **Reconcile cron weekly** — failsafe contre drift accumulé (events lost à cause bugs résolus + DB updates manuels).
6. **`meilisearch` SDK v0.50+ + Meilisearch v1.10+** — features modernes (multi-search, geosearch V1+).
7. **Settings updateable idempotent** — Meilisearch handles diffs natively, setup script sûr re-runnable.
8. **City resolver MVP simple** (INSEE postal codes seed) — Story 3.8 future pourra upgrade vers geo-svc.
9. **Performance NFR1 < 150ms p95** — Meilisearch typical 30-80ms p95 → confortable.
10. **Cron 6am UTC Sunday weekly** — staggered avec autres crons (3am photos / 4am drafts / 5am listings / 2am medians).
11. **EN strict + Pretre + envelope ADR-014 + i18n + latest stable versions** memories.

### Versions à utiliser

| Lib | Usage | Version | Notes |
|-----|-------|---------|-------|
| `meilisearch` | JS SDK Meilisearch | latest stable v0.50+ | Compatible Meilisearch v1.10+ |
| `getmeili/meilisearch` Docker | Docker image dev local | latest stable v1.10 | Story 0.10 docker-compose UPDATE |

(Autres libs réutilisées Stories 0.x/1.x/3.x : `@nestjs/schedule`, NATS JetStream, TypeORM, Pino)

### Project Structure cible

```
packages/contracts/src/events/catalog/
├─ listing-indexed.v1.{schema.json,ts}                            # NEW Story 3.7
├─ listing-unindexed.v1.{schema.json,ts}                          # NEW
└─ search-reconciled.v1.{schema.json,ts}                          # NEW

packages/contracts/src/dtos/catalog/
├─ meilisearch-document.dto.ts                                    # NEW Story 3.7
└─ search-listings-query.dto.ts                                   # NEW (forward Story 3.8)

apps/catalog-svc/src/
├─ usecases/
│  ├─ index-listing.usecase.ts + spec                             # NEW
│  └─ remove-listing-from-index.usecase.ts + spec                 # NEW
├─ usecases-proxy/usecases-proxy.module.ts                        # UPDATE Story 3.2 — wire 2 new use cases + Meilisearch service
├─ domain/service/postal-code-city-resolver.service.ts            # NEW
├─ infrastructure/
│  ├─ external/meilisearch/listing-search-indexer.service.ts      # NEW (implements ISearchIndexer port Story 3.2)
│  ├─ messaging/nats/listing-search-indexer.consumer.ts           # NEW (subscribe 4 subjects + DLQ)
│  ├─ tasks/meilisearch-reconcile.task.ts                         # NEW (cron weekly Sunday 6am UTC)
│  └─ persistence/typeorm/repositories/listing.typeorm.repository.ts  # UPDATE Story 3.2 — findById(options.includeRelations)

apps/catalog-svc/test/
├─ integration/meilisearch-indexer.spec.ts                        # NEW (testcontainer 9 scenarios)
└─ integration/meilisearch-reconcile.spec.ts                      # NEW (4 scenarios)

apps/seller/e2e/listings/search-indexing.spec.ts                  # NEW (3 black-box flows)

infra/meilisearch/setup-indexes.ts                                # NEW (idempotent setup script)
infra/data/insee-postal-codes-fr.json                             # NEW (~37k entries postal → city)
infra/scripts/setup-nats-streams.sh                               # UPDATE Story 0.7 — add DLQ stream
infra/docker-compose.yml                                          # UPDATE Story 0.10 — add Meilisearch service local

infra/k8s/prometheus-rules/catalog-search.yaml                    # NEW
infra/k8s/grafana-dashboards/catalog-search.json                  # NEW

docs/runbook/meilisearch-setup.md                                 # NEW (~50 lignes)
docs/runbook/meilisearch-dlq-recovery.md                          # NEW (~40 lignes)
docs/runbook/meilisearch-reconcile-debug.md                       # NEW (~30 lignes)

package.json (root)                                                # UPDATE — add meilisearch:setup alias

# Estimation : ~25 nouveaux + ~5 updates = ~30 fichiers
```

### Critical Architecture Constraints

> Cf. Stories 0.2 (contracts events), 0.6 (Pretre), 0.7 (outbox + JetStream + setup-nats-streams.sh), 0.10 (docker-compose + Doppler + provisioning), 1.9 (cron pattern), 2.7 (audit_log subscription scope), 3.1 (categories taxonomy + translations), 3.2 (Listing aggregate + ISearchIndexer port + IListingRepository + IProProfileClient port + IPhotoStorage port — Story 3.7 reuses ICloudflareImagesService for variant URLs), 3.4 (CloudflareImagesService variant URLs reused), 3.5 (catalog.listing.published.v1 event), 3.6 (catalog.listing.unpublished.v1 + catalog.listing.deleted.v1 + catalog.listing.updated.v1 events).

1. **Pretre architecture stricte** — Story 3.7 implémente `ISearchIndexer` port livré Story 3.2 — domain pure no I/O imports.
2. **Transactional outbox ADR-007** — events publish single transaction.
3. **API responses envelope ADR-014** — Story 3.8 future search endpoint.
4. **EN strict + i18n FR/EN + latest stable versions** memories.
5. **NFR1 < 150 ms p95 search** — Meilisearch typical 30-80ms.
6. **NFR42/46 résilience** — DLQ retry + reconcile cron failsafe.
7. **NFR60 fallback locale** — Story 3.7 indexes EN with fallback FR + flag.

### Previous Story Intelligence

**Story 0.7 (NATS JetStream + outbox + setup-nats-streams.sh)** : pattern réutilisé. Story 3.7 UPDATE script add DLQ stream.

**Story 0.10 (docker-compose + Doppler)** : Story 3.7 UPDATE — add Meilisearch service for dev local.

**Story 2.7 (audit_log subscription)** : Story 3.7 events `catalog.listing.indexed.v1` + `search-reconciled.v1` PAS consommés audit_log (catalog.* not subscribed). MVP audit_log capture identity.* + admin.* uniquement. V1+ if needed.

**Story 3.1 (categories taxonomy + translations + slug EN strict)** : Story 3.7 build documents avec category data Story 3.1 + locale fallback pattern mirror.

**Story 3.2 (Listing aggregate + ISearchIndexer port + IProProfileClient + IListingRepository.findById)** : Story 3.7 implements `ISearchIndexer`. Extension `findById(options)` minor.

**Story 3.4 (Photo VO + CloudflareImagesService variant URLs)** : Story 3.7 build doc with `primaryPhotoUrls` from variants.

**Stories 3.5/3.6 (publish/unpublish/delete/updated events)** : Story 3.7 consumer subscribes ces events.

### What this story does NOT do

- ❌ **Story 3.8 search frontend barre recherche** — Story 3.7 livre infra search. Story 3.8 livre l'UI Visitor.
- ❌ **Story 3.9 filters / facettes search results page** — Story 3.7 expose facets via Meilisearch settings. Story 3.9 livre l'UI.
- ❌ **Geosearch radius (lat/lng)** — V1+ feature. MVP : postalCode + deliveryRadiusKm filter.
- ❌ **DeepL auto-translate FR → EN missing** — V1+ FR101.
- ❌ **AI semantic search** — V2 Story 13.3.
- ❌ **Reviews aggregate field populated** — V1 Story 5.8 (Story 3.7 placeholder `{count: 0, averageScore: null}`).
- ❌ **Capacity field populated** — V1+ enhancement (Story 3.3 wizard step pricing add capacity field).
- ❌ **Multi-search (cross-index aggregated query)** — V1+ feature Meilisearch v1.10+.
- ❌ **Index sharding / replication** — V1+ scale > 100k listings.
- ❌ **Drift detection content-level** (compare doc fields) — V1+ heavier compute. MVP : presence/absence diff only.

### Files to UPDATE vs CREATE

(Cf. Project Structure cible — annoté UPDATE/NEW)

### Testing Standards

- Coverage ≥ 95 % consumer (security/resilience critical)
- Coverage ≥ 90 % use cases + cron reconcile
- Coverage ≥ 80 % infra Meilisearch service
- Tests integration testcontainer Meilisearch + Postgres : 9 scenarios + 4 reconcile + 3 e2e black-box = 16 total
- Perf : 500 listings indexed → search p90 < 80ms (Meilisearch native perf)
- Tests perf indexing : 500 listings publish → all indexed in < 30s (NFR3 search availability post-publish)

### Project Structure Notes

✅ **Aligné architecture, PRD §FR33 (Meilisearch index per locale), §FR103 (i18n + fallback FR), §NFR1 (search p95 < 150ms), §NFR42/46 (résilience DLQ), §NFR60 (fallback locale strategy mirror Story 3.1), Stories 0.2/0.7/0.10/1.9/3.1/3.2/3.4/3.5/3.6, memories.**

⚠️ **Décision** : 2 indexes per locale (vs 1 avec field) — Meilisearch best practice tokenizer per language.
⚠️ **Décision** : Fallback FR if EN missing + flag — UX EN sees FR with badge V1.
⚠️ **Décision** : Outbox-driven sync (vs polling) — résilient race conditions.
⚠️ **Décision** : DLQ après 3 retries + reconcile weekly — failsafe NFR42/46.
⚠️ **Décision** : `meilisearch` SDK v0.50+ + Meilisearch v1.10+ — features modernes.
⚠️ **Décision** : City resolver MVP INSEE seed — Story 3.8 future pourra upgrade geo-svc.
⚠️ **Décision** : Cron 6am UTC Sunday — staggered.
⚠️ **Décision** : audit_log Story 2.7 NOT extended pour catalog.* — MVP scope clair.

### References

- [Source: epics.md#Epic-3-Story-3.7 — Lines 1490-1503]
- [Source: prd.md#FR33 (Meilisearch per locale), #FR103 (i18n), #NFR1 (p95 < 150ms), #NFR42/46 (résilience), #NFR60 (fallback)]
- [Source: architecture.md — line 619-620 Meilisearch + p95 < 150ms, ADR-007 outbox, ADR-014 envelope, lines 2120-2164 Pretre]
- [Source: Stories 0.2/0.7/0.10/1.9/3.1/3.2/3.4/3.5/3.6]
- [Memory: feedback_clean_architecture_explicit.md, feedback_api_envelope_response.md, feedback_tech_layer_english.md, feedback_i18n_frontend.md, feedback_latest_versions.md]

## Dev Agent Record

### Agent Model Used

(à remplir)

### Debug Log References

### Completion Notes List

(à remplir à la fin — résumé décisions, déviations vs Dev Notes avec justification, points d'attention pour Story 3.8 (search frontend consume `GET /v1/search/listings` endpoint à wirer Story 3.8 + city autocomplete consume helper Story 3.7 ou geo-svc V1), Story 3.9 (filters/facettes consume Meilisearch facets Story 3.7), Story 3.10 (listing detail consume `catalog.listing.indexed.v1` event for cache invalidation), Story 5.8 V1 (reviews aggregate field populated), Story 5.9 (badge "FR only" UI consume `_fallback_locale: 'fr'` flag Story 3.7))

### File List

(à remplir au fil de l'implémentation par le dev agent)

---

## Story Completion Status

- **Story Status** : `ready-for-dev`
- **Created** : 2026-05-10
- **Created by** : `bmad-create-story` workflow
- **Epic** : Epic 3 — Catalog Publication & Discovery (MVP) — couche Visitor démarre
- **Sprint cible** : Sprint 4 (7ᵉ story Epic 3 — couche Visitor backend)
- **Estimation effort** : 4-5 jours (1 dev senior — story complète : Meilisearch SDK + 2 use cases + consumer + cron + city resolver + setup script + 16 tests, ~30 fichiers)
- **Dépendances upstream** : Stories 0.2, 0.7 (outbox + JetStream + DLQ pattern), 0.10 (docker-compose + Doppler), 1.9 (cron pattern), 3.1 (categories + translations), 3.2 (ISearchIndexer port + Listing aggregate + IListingRepository + IProProfileClient + ICloudflareImagesService), 3.4 (CloudflareImagesService variant URLs), 3.5 (catalog.listing.published.v1 event), 3.6 (catalog.listing.{unpublished,deleted,updated}.v1 events)
- **Dépendances downstream** :
  - Story 3.8 (search frontend) — consume Meilisearch via gateway endpoint à wirer Story 3.8
  - Story 3.9 (filters/facettes) — consume Meilisearch facets exposed Story 3.7
  - Story 3.10 (listing detail) — consume `catalog.listing.indexed.v1` event for cache invalidation
  - Story 5.8 V1 (reviews aggregate field populated)
  - Story 5.9 (badge "FR only" UI consume `_fallback_locale: 'fr'` flag)
  - Stories 11.x V1 (in-app notifications search) — pattern réutilisé
- **FRs covered** :
  - **FR33** ✅ Meilisearch index per locale (FR + EN)
  - **FR103** ✅ i18n cross-cutting + fallback FR
- **NFRs touchés** :
  - **NFR1** ✅ search p95 < 150ms (Meilisearch typical 30-80ms)
  - **NFR42** ✅ résilience DLQ retry pattern
  - **NFR46** ✅ recoverability via reconcile cron
  - **NFR60** ✅ fallback locale strategy mirror Story 3.1
  - **NFR71** ✅ coverage ≥ 95 % consumer + 90 % use cases/cron + 80 % infra

> **Prochaine story → Story 3.8** (Search frontend barre recherche FR18 — Visitor search bar 3 fields category/city/date + consume Meilisearch via gateway endpoint à wirer)

---

**Dev agent next steps :**
1. Lire ce file complètement
2. Vérifier upstream Stories 0.2, 0.7, 0.10, 1.9, 3.1, 3.2, 3.4, 3.5, 3.6 implémentées
3. Implémenter Tasks 1-10 dans l'ordre
4. Lancer `pnpm vitest --filter=catalog-svc test/integration/meilisearch` après chaque jalon + `pnpm test:integration` testcontainer Meilisearch
5. Commit Story 3.7 quand : 16/16 integration + 3/3 e2e black-box + coverage NFR71 + perf cible 500 listings p90 < 80ms + DLQ tested + reconcile tested + setup script idempotent + INSEE seed integrated + métriques validated
6. Update sprint-status : `3-7-...: review` puis `done`
