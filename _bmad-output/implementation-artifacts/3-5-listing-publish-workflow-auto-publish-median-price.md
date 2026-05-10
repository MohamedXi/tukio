# Story 3.5: Listing publish workflow + auto-publish (FR30) + median price calculation (FR31, FR32)

Status: ready-for-dev

## Story

**As a** Pro `verified` ayant complété wizard Story 3.3 + uploadé 3-15 photos via pipeline Story 3.4,
**I want** **publier ma fiche service** depuis Step 5 wizard avec **auto-publish** si confiance critère métier (FR30 — verified > 30 jours + reportsCount < 3 + tukio_status='active') OU **soumission modération a posteriori** si profil pas encore "trusted" (FR30 inverse — Story 6.2 future admin queue) — Story 3.2 a livré le **skeleton** `publish-listing.usecase.ts` + `compute-median-price.usecase.ts` + `ListingPublicationService.shouldAutoPublish()` + `IMedianPriceCalculator` port. Story 3.5 finalise maintenant la **boucle complète** :
- (a) **`publish-listing.usecase.ts` finalisation** (Story 3.2 skeleton MVP → full implementation Story 3.5) :
```ts
async execute(input: { listingId: string; proProfileId: string; correlationId: string }): Promise<PublishListingOutput> {
  return this.txnManager.runInTransaction(async (txn) => {
    const listing = await txn.listingRepo.findById(input.listingId);
    if (!listing) throw new ListingNotFoundException(input.listingId);
    if (listing.proProfileId !== input.proProfileId) throw new ListingForbiddenException();

    // 1. Validate integrity invariants (Story 3.2 Listing.publishDraft enforces)
    //    photos.length >= 3 (FR23), title.fr OK, description.fr OK, pricing.amount > 0, serviceArea OK, slug OK

    // 2. Compute median price for category + pricing mode (FR31)
    const median = await this.medianPriceCalculator.compute({
      categoryId: listing.categoryId,
      pricingMode: listing.pricing.mode, // 'unit' | 'package'
    });

    // 3. Compute price deviation (FR32 soft-warning, NOT blocking)
    const priceDeviation = this.listingPublicationService.computePriceDeviation(listing.pricing.amount, median);

    // 4. Determine auto-publish eligibility (FR30)
    const autoPublish = await this.listingPublicationService.shouldAutoPublish(input.proProfileId);

    // 5. Apply state machine transition via aggregate domain method (Story 3.2)
    listing.publishDraft(autoPublish, priceDeviation);
    await txn.listingRepo.save(listing);

    // 6. Publish appropriate outbox event (transactional)
    const eventType = autoPublish ? 'catalog.listing.published' : 'catalog.listing.submitted-for-moderation';
    await txn.eventPublisher.publish({
      eventType,
      eventVersion: 'v1',
      aggregate: { type: 'Listing', id: listing.id },
      actor: { userId: input.proProfileId, role: 'pro' },
      correlationId: input.correlationId,
      payload: this.buildEventPayload(listing, median, priceDeviation),
      occurredAt: new Date(),
    });

    return {
      listingId: listing.id,
      status: listing.status, // 'published' | 'pending_moderation'
      publishedAt: listing.publishedAt?.toISOString() ?? null,
      autoPublished: autoPublish,
      priceDeviation,
      medianPriceForCategory: median ? { amountCents: median.amountCents, currency: median.currency } : null,
    };
  });
}
```
- (b) **`compute-median-price.usecase.ts` finalisation** (Story 3.2 skeleton MVP → full implementation Story 3.5) — SQL `percentile_cont(0.5) WITHIN GROUP` + cache Redis 1h pour amortir charge cron + on-demand calls Story 3.3 wizard step 3 :
```ts
async execute(input: { categoryId: string; pricingMode: 'unit' | 'package' }): Promise<Money | null> {
  const cacheKey = `tukio:median-price:${input.categoryId}:${input.pricingMode}`;
  const cached = await this.cache.get<Money>(cacheKey);
  if (cached) return cached;

  // SQL query — uses index idx_listing_pricing_mode + idx_listing_category_id_status (Story 3.2)
  const result = await this.listingRepo.computeMedianPrice({ categoryId: input.categoryId, pricingMode: input.pricingMode });
  // Returns null if < 5 listings published (statistically not significant — UX FR31 displays "Pas assez de données" placeholder Story 3.12)

  if (!result) {
    await this.cache.set(cacheKey, null, 3600); // cache null too — avoid re-computing
    return null;
  }
  await this.cache.set(cacheKey, result, 3600);
  return result;
}
```
- (c) **NEW repo SQL method `IListingRepository.computeMedianPrice({ categoryId, pricingMode })`** (Story 3.2 had `IMedianPriceCalculator` port — Story 3.5 implements via this repo method called by use case AC2) :
```sql
SELECT
  CASE
    WHEN COUNT(*) < 5 THEN NULL
    ELSE percentile_cont(0.5) WITHIN GROUP (ORDER BY (pricing->>'amountCents')::bigint)::bigint
  END AS median_amount_cents,
  'EUR' AS currency
FROM listing
WHERE category_id = $1
  AND (pricing->>'mode') = $2
  AND status = 'published'
  AND deleted_at IS NULL;
-- Returns NULL if < 5 published listings (statistical threshold — avoid misleading median on tiny sample)
```
- (d) **Cron `compute-medians.task.ts`** (NEW Story 3.5 — `@nestjs/schedule` `@Cron('0 2 * * *')` 2am UTC daily — pattern Stories 1.9/2.5 réutilisé) qui itère toutes les `(categoryId, pricingMode)` combinations (filtered MVP: only `mvp_pilot=true` categories — Story 3.1 = 10 categories × 2 pricing modes = 20 medians max) :
  - Pour chaque combination : `await computeMedianPriceUseCase.execute({ categoryId, pricingMode })` → updates `category.median_price_amount` + `category.median_price_currency` directement DB (lecture optimisée Story 3.12 page catégorie + Story 3.3 wizard step 3 deviation)
  - Cache Redis invalidated post-update (`cache.del('tukio:median-price:{categoryId}:{mode}')`)
  - Outbox event `catalog.medians.computed.v1` (NEW Story 3.5 — payload `{ computedAt, categoriesCount, medianValues: [{ categoryId, pricingMode, medianAmountCents }] }`) consumed Story 2.7 audit_log
  - Métriques Prom : `tukio_catalog_medians_computed_total` + `tukio_catalog_medians_compute_duration_seconds` histogram + gauge `tukio_catalog_medians_categories_with_median_count` (combinations qui ont reach threshold ≥ 5 listings — quand cette gauge augmente, plus de catégories ont signal statistique)
- (e) **Endpoint `/v1/categories/:slug/median-price` Story 3.3 stub finalisé** :
```ts
// Story 3.3 stub returned `{ medianAmountCents: null, currency: 'EUR' }` always
// Story 3.5 finalise — appelle ComputeMedianPriceUseCase.execute() avec cache Redis 1h
@Get('/:slug/median-price')
@HttpCode(200)
@CacheControl('public, max-age=3600') // 1h browser cache (cohérent Story 3.1 categories cache)
async getMedianPrice(@Param('slug') slug: string, @Query() query: { pricingMode: 'unit' | 'package' }): Promise<{ medianAmountCents: number | null; currency: 'EUR' }> {
  const category = await this.categoryRepo.findBySlug(slug);
  if (!category) throw new CatalogNotFoundException(`category slug ${slug}`);
  const median = await this.computeMedianPriceUseCase.execute({ categoryId: category.id, pricingMode: query.pricingMode });
  return { medianAmountCents: median?.amountCents ?? null, currency: 'EUR' };
}
```
- (f) **Frontend Story 3.3 update** : `usePriceDeviation` hook Story 3.3 livré stub MVP + soft-warning `<Alert>` mécanique → Story 3.5 NO frontend code change requis (hook consume endpoint Story 3.3 stub finalisé). **Regression check** : 14/14 e2e Story 3.3 still pass (T5 soft-warning price deviation test passe maintenant avec REAL median). UX Pro Step 3 wizard saisit prix → debounced 1s → API call → si median exists ET deviation > 50% → alert visible.
- (g) **NEW NATS event schemas** :
  - `catalog.listing.submitted-for-moderation.v1.{schema.json,ts}` (NEW Story 3.5 — payload `{ listingId, proProfileId, categoryId, slug, title: { fr, en? }, submittedAt, autoPublishCriteriaFailed: { kycStatus, tukioStatus, verifiedAt, daysSinceVerified, reportsCount } }`) consumed Story 6.2 V1 admin moderation queue
  - `catalog.medians.computed.v1.{schema.json,ts}` (NEW — payload cf. AC4 cron)
  - `catalog.listing.published.v1.{schema.json,ts}` Story 2.6 livré déjà — Story 3.5 utilise tel quel
- (h) **Frontend feedback Step 5 wizard Story 3.3** : Story 3.3 wizard step 5 wire `usePublishListingMutation` consume Story 3.5 endpoint :
  - Si `response.autoPublished === true` → toast succès "Fiche publiée ! 🎉" + redirect `/seller/listings`
  - Si `response.autoPublished === false` → toast info "Fiche envoyée en modération (~24h). Nous vous notifierons par email." + redirect `/seller/listings`
  - Si `response.priceDeviation === true` → toast warning supplémentaire "Votre prix dévie de la médiane catégorie — gardez à l'œil les retours clients" (UX éducative non-blocante)
- (i) **Story 3.12 future page catégorie générale** prepared : Story 3.12 consume `category.median_price_amount` field (populated by Story 3.5 cron) pour afficher "Prix médian catégorie : XX€/jour" UX FR31 transparence client. Story 3.5 livre uniquement la **donnée** ; Story 3.12 livre l'**UI public**.
- (j) **NFR1 RGPD transparence** : `category.median_price_amount` est public (visible /fr/category/{slug}) — pas d'identification des Pros sources. Calcul agrégé statistique sans révéler prix individuels. Threshold ≥ 5 listings pour anonymisation effective (médiane d'un seul listing = prix exact = leak).

**so that** Marc Pro fraîchement validé Story 2.5 (verified depuis 35 jours, reportsCount=0, tukio_status='active') click "Publier" depuis wizard step 5 Story 3.3 → backend `PublishListingUseCase` exécute en transaction : valide invariants (3 photos OK + title.fr OK + pricing OK + serviceArea OK) + computeMedianPrice(category=tents-marquees, mode=unit) returns 350€/jour cached → priceDeviation = abs(400 - 350) / 350 = 14% < 50% → no soft-warning → shouldAutoPublish() = TRUE (Marc trusted) → `listing.publishDraft(autoPublish=true, priceDeviation=false)` → status='published' + publishedAt=NOW → outbox `catalog.listing.published.v1` event (consumed Story 3.7 future Meilisearch indexer) → response 200 `{ status: 'published', autoPublished: true, priceDeviation: false }` → frontend toast "Fiche publiée ! 🎉" redirect `/seller/listings` ; Pierre Pro fraîchement validé il y a 5 jours (verified < 30 days) clicks "Publier" → shouldAutoPublish() = FALSE → status='pending_moderation' + outbox `catalog.listing.submitted-for-moderation.v1` (consumed Story 6.2 V1 admin moderation queue) → response 200 `{ status: 'pending_moderation', autoPublished: false }` → frontend toast info "Fiche envoyée en modération (~24h)" ; Sophie Pro saisit prix 800€/jour pour tente Marquee (catégorie médiane 350€) → wizard step 3 Story 3.3 deviation 130% → soft-warning `<Alert>` "Votre prix dévie de 130% de la médiane (~350€/jour). Continuer ou ajuster ?" — pas blocage strict, juste UX éducative ; un Visitor consulte `/fr/category/tents-marquees` Story 3.12 future → voit "Prix médian catégorie : 35€ par jour" (350 cents/100) — transparence FR31 sans identifier Pros sources ; le cron daily 2am UTC tourne → 20 medians recalculés (10 mvp_pilot categories × 2 pricing modes) → `category.median_price_amount` updated DB → cache Redis invalidated → métrique `tukio_catalog_medians_compute_duration_seconds` ~5s p90 ; un test `pnpm playwright test --grep "publish workflow"` passe FR/EN axe-core 0 violations 9 scénarios (auto-publish happy + moderation pending + price deviation soft-warning + insufficient photos block + median computation 5+ threshold + cron compute-medians daily + cache 1h hit ratio + Story 3.7 forward Meilisearch event + Story 6.2 forward moderation event) ; coverage ≥ 95 % use cases (publish + median) + 90 % cron + 80 % gateway + repo SQL.

## Acceptance Criteria

1. **AC1 — `publish-listing.usecase.ts` finalisation** : Given Story 3.2 skeleton MVP livré, When je consulte `apps/catalog-svc/src/usecases/publish-listing.usecase.ts`, Then :
   - **Full implementation** (cf. story body section a) avec orchestration : invariants validation (Story 3.2 `listing.publishDraft()` aggregate method enforces) → computeMedianPrice → computePriceDeviation → shouldAutoPublish → state machine transition → outbox event publish (transactional)
   - **2 events publish branching** :
     - autoPublish=true → `catalog.listing.published.v1` (Story 2.6 schema réutilisé)
     - autoPublish=false → `catalog.listing.submitted-for-moderation.v1` (NEW Story 3.5)
   - **Errors** :
     - `ListingNotFoundException` → 404 `LISTING-NOT-FOUND-001`
     - `ListingForbiddenException` cross-pro → 403 `LISTING-FORBIDDEN-001`
     - `ListingStatusInvalidTransitionException` (already published) → 409 `LISTING-STATUS-CONFLICT-001`
     - `CatalogValidationException` (photos < 3, title.fr empty, etc.) → 422 `LISTING-VALIDATION-001` avec `details: { field, code }`
   - **Output `PublishListingOutput`** :
     ```ts
     interface PublishListingOutput {
       listingId: string;
       status: 'published' | 'pending_moderation';
       publishedAt: string | null;
       autoPublished: boolean;
       priceDeviation: boolean;
       medianPriceForCategory: { amountCents: number; currency: 'EUR' } | null;
     }
     ```
   - Tests unit ≥ 95 % use case : 8 cases — happy auto-publish, happy moderation pending, photos < 3 block, title.fr empty block, already published 409, cross-pro 403, median null returns null deviation false, Keycloak/identity-svc fail downstream → graceful fallback (treat as autoPublish=false safer default)

2. **AC2 — `compute-median-price.usecase.ts` finalisation + Redis cache 1h** : Given Story 3.2 skeleton, When je consulte, Then :
   - **Full implementation** cf. story body section b
   - **Redis cache** : key `tukio:median-price:{categoryId}:{pricingMode}` TTL 3600s. Cache hit returns immediate. Cache miss → SQL → cache set
   - **Threshold ≥ 5 listings statistical significance** — return null si COUNT < 5 (NFR1 RGPD anonymisation)
   - **NEW repo SQL method** `IListingRepository.computeMedianPrice({ categoryId, pricingMode }): Promise<{ amountCents: number; currency: 'EUR' } | null>` (cf. story body section c)
   - **Tests unit ≥ 95 %** : 6 cases — happy cache miss → SQL → cache, cache hit, threshold < 5 returns null, threshold ≥ 5 returns median, large dataset perf < 50ms, cache invalidation post-update

3. **AC3 — `ListingPublicationService.shouldAutoPublish` integration + IProProfileClient verifiedAt mapping** : Given Story 3.2 livré service skeleton + IProProfileClient port, When je consulte `apps/catalog-svc/src/domain/service/listing-publication.service.ts`, Then :
   - **shouldAutoPublish()** uses Story 3.2 implementation : checks `proProfile.tukioStatus === 'active'` + `proProfile.kycStatus === 'approved'` + `daysSinceVerified >= 30` + `proProfile.reportsCount < 3`
   - **NEW** : `verifiedAt` field clarification — Story 3.5 confirms mapping `proProfile.verifiedAt = pro_profiles.kyc_decision_at WHEN kyc_status='approved'` (Story 2.5 enum). identity-svc `/internal/pros/by-id/:id` endpoint Story 1.10 returns `verifiedAt = kycDecisionAt if kycStatus='approved' else null`. Story 3.5 verifies + documents this mapping.
   - **Failure handling** : if identity-svc unreachable → `IProProfileClient.getById()` throws `IdentitySvcUnavailableException` → use case catches → defaults to `autoPublish=false` (safer fallback — moderation queue) + log warning + métric `tukio_catalog_publish_identity_unavailable_total`
   - Tests integration : mock `IProProfileClient` 8 scenarios — all criteria pass → true, each criterion fails → false, identity-svc unavailable → false fallback

4. **AC4 — Cron `compute-medians.task.ts` daily** : Given AC2, When je consulte `apps/catalog-svc/src/infrastructure/tasks/compute-medians.task.ts`, Then :
   ```ts
   @Cron('0 2 * * *', { timeZone: 'UTC' }) // 2am UTC daily — low traffic window
   async run(): Promise<void> {
     const correlationId = randomUUID();
     const start = Date.now();

     // Iterate mvp_pilot categories × 2 pricing modes = 20 combinations MVP
     const categories = await this.categoryRepo.findAll({ mvpPilotOnly: true, locale: 'fr', tree: false });
     const computedMedians: { categoryId: string; pricingMode: 'unit' | 'package'; medianAmountCents: number | null }[] = [];

     for (const category of categories) {
       for (const pricingMode of ['unit', 'package'] as const) {
         await this.cache.del(`tukio:median-price:${category.id}:${pricingMode}`); // invalidate cache before re-compute
         const median = await this.computeMedianPriceUseCase.execute({ categoryId: category.id, pricingMode });
         computedMedians.push({ categoryId: category.id, pricingMode, medianAmountCents: median?.amountCents ?? null });

         // Persist to category.median_price column (lecture optimisée Story 3.12 page catégorie + Story 3.3 wizard step 3 deviation cache miss path)
         if (pricingMode === 'unit') {
           await this.categoryRepo.updateMedianPrice({ categoryId: category.id, medianAmountCents: median?.amountCents ?? null, currency: 'EUR' });
         }
         // NB MVP: only 'unit' median stored on category row (column granularity — V1+ pourra séparer per pricingMode si besoin)
       }
     }

     await this.eventPublisher.publishStandalone({
       eventType: 'catalog.medians.computed', eventVersion: 'v1',
       aggregate: { type: 'CatalogMedians', id: 'global' },
       actor: { userId: 'system', role: 'system' },
       correlationId,
       payload: { computedAt: new Date().toISOString(), categoriesCount: categories.length, medianValues: computedMedians },
       occurredAt: new Date(),
     });

     this.metrics.histogram('tukio_catalog_medians_compute_duration_seconds').observe((Date.now() - start) / 1000);
     this.metrics.counter('tukio_catalog_medians_computed_total').inc();
     this.metrics.gauge('tukio_catalog_medians_categories_with_median_count').set(computedMedians.filter(m => m.medianAmountCents !== null).length);

     this.logger.info({ correlationId, durationMs: Date.now() - start, categoriesCount: categories.length }, 'compute-medians.task.ts completed');
   }
   ```
   - **NEW repo method** `ICategoryRepository.updateMedianPrice({ categoryId, medianAmountCents, currency })` — UPDATE category SET median_price_amount + median_price_currency
   - Tests integration testcontainer Postgres : 3 scenarios — happy compute 5 categories × 2 modes, threshold < 5 returns null + persisted as null, cache invalidation post-compute (cache hit + cron run + cache miss assertion)

5. **AC5 — Endpoint `GET /v1/categories/:slug/median-price` Story 3.3 stub finalisé** : Given AC2, When je consulte gateway-api + catalog-svc internal endpoints, Then :
   - **gateway-api** `apps/gateway-api/src/infrastructure/http/controllers/categories.controller.ts` UPDATE — replace stub return null with real call to `/internal/categories/:slug/median-price`
   - **catalog-svc internal** UPDATE Story 3.3 stub endpoint → real implementation calls `ComputeMedianPriceUseCase.execute()`
   - **Cache HTTP `Cache-Control: public, max-age=3600`** (cohérent Story 3.1 categories cache + Redis cache mirror)
   - **Errors** : 404 si category slug not found
   - Tests E2E : 4 scenarios — slug exists median > 5 listings → 200 with amountCents, slug exists median < 5 listings → 200 with null, slug not found → 404, cache header present

6. **AC6 — `POST /v1/listings/:id/publish` endpoint UPDATE Story 3.3 + frontend toast feedback** : Given Story 3.3 livré endpoint avec skeleton + frontend usePublishListingMutation, When :
   - **gateway-api endpoint Story 3.3 UPDATE** — return `PublishListingOutput` shape AC1 (vs Story 3.3 stub ok)
   - **Frontend Story 3.3 wizard step 5 UPDATE** : `usePublishListingMutation.onSuccess(response)` :
     - Si `response.autoPublished` → toast success "Fiche publiée ! 🎉"
     - Sinon → toast info "Fiche envoyée en modération (~24h). Nous vous notifierons par email."
     - Si `response.priceDeviation` → toast warning supplémentaire "Votre prix dévie de la médiane catégorie — gardez à l'œil les retours clients"
     - Then : redirect `/seller/listings`
   - **i18n keys NEW** `seller.listings.publish.toasts.{published,pendingModeration,priceDeviationWarning}` × 2 locales
   - Tests E2E : 3 scenarios — autoPublish toast success, moderation toast info, deviation warning toast secondary

7. **AC7 — NEW NATS event schemas + Story 6.2 V1 forward consumer documentation** : Given AC1, When je consulte `packages/contracts/src/events/catalog/`, Then :
   - **NEW** `listing-submitted-for-moderation.v1.{schema.json,ts}` — payload `{ listingId, proProfileId, categoryId, categorySlug, slug, title: { fr, en? }, submittedAt, autoPublishCriteriaFailed: { kycStatus: string; tukioStatus: string; verifiedAt: string | null; daysSinceVerified: number | null; reportsCount: number } }`
   - **NEW** `medians-computed.v1.{schema.json,ts}` — payload `{ computedAt, categoriesCount, medianValues: array }`
   - **REUSED** `listing-published.v1.{schema.json,ts}` (Story 2.6 livré) — payload field check : Story 3.5 ajoute `medianPriceForCategory: { amountCents, currency } | null` + `priceDeviation: boolean` au payload (UPDATE Story 2.6 schema avec backward-compat — fields nouveaux optional)
   - Tests ajv schema 3 events
   - Forward-dep documentation : Story 6.2 V1 (admin moderation queue) consumera `catalog.listing.submitted-for-moderation.v1` event pour pousser dans queue admin pending_moderation

8. **AC8 — Métriques Prom + alerts + dashboard** :
   - **Métriques NEW** :
     - `tukio_catalog_publish_total{result, autoPublished}` (counter — split published/pending-moderation × auto/manual)
     - `tukio_catalog_publish_duration_seconds` (histogram — use case latency)
     - `tukio_catalog_publish_identity_unavailable_total` (counter — fallback safer default)
     - `tukio_catalog_medians_computed_total` (counter daily)
     - `tukio_catalog_medians_compute_duration_seconds` (histogram)
     - `tukio_catalog_medians_categories_with_median_count` (gauge)
     - `tukio_catalog_median_cache_hit_total` + `tukio_catalog_median_cache_miss_total` (counters — alert if hit_ratio < 80%)
     - `tukio_catalog_listing_publish_failures_total{error_code}` (counter)
   - **Prometheus rule NEW** `infra/k8s/prometheus-rules/catalog-publish.yaml` (NEW Story 3.5) :
     ```yaml
     - alert: CatalogPublishFailureRateHigh
       expr: rate(tukio_catalog_listing_publish_failures_total[10m]) > 0.05 # > 5% failure rate
       for: 5m
       labels: { severity: warning, team: ops }
     - alert: CatalogMediansCronFailed
       expr: time() - max(tukio_catalog_medians_last_run_at_unix) > 26 * 3600 # > 26h since last successful run
       for: 1h
       labels: { severity: warning }
     - alert: CatalogIdentityFallbackHigh
       expr: rate(tukio_catalog_publish_identity_unavailable_total[5m]) > 0.5/sec # identity-svc down impacting publish UX
       for: 2m
       labels: { severity: critical, team: ops }
     ```
   - **Dashboard Grafana `catalog-publish.json`** (NEW ~5 panels) : publish rate (auto vs moderation), median compute history, cache hit ratio, identity-svc fallback rate, deviation distribution (V1+ histogram for analytics)

9. **AC9 — Tests Playwright e2e + integration + perf** : 9 scenarios :
   - **`apps/seller/e2e/listings/publish.spec.ts`** (5 tests) :
     - T1 (auto-publish FR happy) : Pro fixture verified > 30d + 0 reports + 5 photos uploaded → wizard step 5 click Publier → 200 autoPublished=true + toast success FR + redirect /seller/listings + listing visible status='published'
     - T2 (auto-publish EN) : idem `/en/`
     - T3 (moderation pending FR) : Pro fixture verified < 30d → click Publier → 200 autoPublished=false + toast info FR pending moderation + redirect
     - T4 (price deviation soft-warning) : Pro saisit 800€ alors que median 350€ → wizard step 3 alert visible → click Publier → 200 + toast warning supplémentaire deviation
     - T5 (insufficient photos block) : Pro 2 photos seulement → wizard step 5 button Publier disabled (Story 3.3 frontend) + curl bypass → 422 LISTING-VALIDATION-001 photos.min
   - **`apps/catalog-svc/test/cron/compute-medians.spec.ts`** (3 integration testcontainer Postgres) :
     - T6 happy compute 5 categories × 2 modes → 10 medians + cache invalidated
     - T7 threshold < 5 listings → median null persisted
     - T8 cache hit ratio after cron run + subsequent reads
   - **`apps/seller/e2e/listings/median-display.spec.ts`** (1 test) :
     - T9 wizard step 3 mock median API 350€ → enter 800€ → deviation alert visible 130%
   - **Test perf** : publish use case < 500ms p90 (median cache hit + DB transaction + outbox publish), compute-median SQL < 50ms p90 with 1k published listings fixture, cron 20 combinations < 30s total
   - **Tests integration** : mock `IProProfileClient` 8 scenarios shouldAutoPublish criteria + identity-svc unavailable fallback
   - Coverage ≥ 95 % use cases publish + median + 90 % cron + 80 % gateway + repo SQL

10. **AC10 — Documentation + runbook + commit** :
    - **NEW runbook** `docs/runbook/listing-publish-debug.md` (~50 lignes) — flow + troubleshooting (autoPublish criteria not met, identity-svc fallback, median cache stale, percentile_cont SQL slow, deviation false-positives)
    - **NEW runbook** `docs/runbook/compute-medians-cron.md` (~40 lignes) — cron monitoring + Redis cache invalidation + DB perf check
    - **UPDATE** `docs/project-context.md` section "Catalog Publish Workflow (Story 3.5)" : flow diagram + auto-publish criteria + median formula + soft-warning thresholds
    - **Commit** `feat(catalog,seller): Story 3.5 listing publish workflow + auto-publish FR30 + median price computation FR31/FR32 + cron compute-medians daily + Story 3.3 stub finalisation`

## Tasks / Subtasks

- [ ] **Task 1 — `@tukio/contracts` event schemas** (AC: #7)
  - [ ] 1.1 — Event schema `catalog/listing-submitted-for-moderation.v1.{schema.json,ts}`
  - [ ] 1.2 — Event schema `catalog/medians-computed.v1.{schema.json,ts}`
  - [ ] 1.3 — UPDATE schema `catalog/listing-published.v1` Story 2.6 — add optional `medianPriceForCategory` + `priceDeviation` fields backward-compat
  - [ ] 1.4 — Tests ajv 3 events
- [ ] **Task 2 — `compute-median-price.usecase.ts` finalisation + Redis cache** (AC: #2) — coverage ≥ 95 %
  - [ ] 2.1 — Full implementation usecase (Story 3.2 skeleton → full)
  - [ ] 2.2 — NEW repo method `IListingRepository.computeMedianPrice` SQL percentile_cont
  - [ ] 2.3 — Redis cache wrapper TTL 1h
  - [ ] 2.4 — Tests unit 6 cases
- [ ] **Task 3 — `publish-listing.usecase.ts` finalisation** (AC: #1, #3) — coverage ≥ 95 %
  - [ ] 3.1 — Full implementation orchestration (validation → median → deviation → autoPublish → state machine → outbox)
  - [ ] 3.2 — Identity-svc unavailable fallback graceful (autoPublish=false safer)
  - [ ] 3.3 — Tests unit 8 cases happy + invariants + fallback
- [ ] **Task 4 — Cron `compute-medians.task.ts` + ICategoryRepository.updateMedianPrice** (AC: #4) — coverage ≥ 90 %
  - [ ] 4.1 — Task `@Cron 0 2 * * *` UTC daily
  - [ ] 4.2 — Repo method `ICategoryRepository.updateMedianPrice` UPDATE SQL
  - [ ] 4.3 — Cache invalidation pre-compute
  - [ ] 4.4 — Outbox event `catalog.medians.computed.v1`
  - [ ] 4.5 — Tests integration testcontainer 3 scenarios
- [ ] **Task 5 — Endpoint `/v1/categories/:slug/median-price` finalisation Story 3.3 stub** (AC: #5)
  - [ ] 5.1 — UPDATE catalog-svc internal endpoint → real impl
  - [ ] 5.2 — UPDATE gateway-api forward
  - [ ] 5.3 — Cache HTTP header
  - [ ] 5.4 — Tests E2E 4 scenarios
- [ ] **Task 6 — Frontend Story 3.3 wizard step 5 toasts + i18n** (AC: #6)
  - [ ] 6.1 — `usePublishListingMutation.onSuccess` 3 toasts conditionnels (published, pendingModeration, priceDeviation)
  - [ ] 6.2 — i18n keys `seller.listings.publish.toasts.*` × 2 locales
  - [ ] 6.3 — Tests E2E 3 scenarios
- [ ] **Task 7 — Métriques + Prometheus alerts + Grafana dashboard** (AC: #8)
  - [ ] 7.1 — 8 nouvelles métriques
  - [ ] 7.2 — Prometheus rule 3 alerts
  - [ ] 7.3 — Dashboard `catalog-publish.json` 5 panels
  - [ ] 7.4 — Slack routing
- [ ] **Task 8 — Tests Playwright e2e + integration testcontainer + perf** (AC: #9)
  - [ ] 8.1 — 5 tests publish.spec.ts
  - [ ] 8.2 — 3 tests cron compute-medians testcontainer
  - [ ] 8.3 — 1 test median display deviation
  - [ ] 8.4 — Coverage thresholds NFR71
- [ ] **Task 9 — Documentation runbooks + commit** (AC: #10)
  - [ ] 9.1 — Runbook listing-publish-debug.md
  - [ ] 9.2 — Runbook compute-medians-cron.md
  - [ ] 9.3 — Update project-context.md
  - [ ] 9.4 — Commit `feat(catalog,seller): Story 3.5 publish workflow + auto-publish + median + cron`

## Dev Notes

### Pourquoi Story 3.5 = moment de vérité publication Epic 3

Story 3.2 a livré **skeletons** (`publish-listing` + `compute-median-price` + `ListingPublicationService.shouldAutoPublish`). Story 3.5 finalise + crée le **cron + cache + transparence client FR31**. C'est ici que le funnel Pro Tukio J3 happy path (Marc registré → onboardé → KYC validé → wizard rempli → photos uploadées → click Publier) atteint son **moment de vérité** : auto-publish (UX immédiate satisfaction Pro trusted) ou moderation pending (filet sécurité plateforme). Pattern complet **state machine transitions backend + auto-publish gating + median computation aggregated SQL + Redis cache + cron daily + soft-warning UX deviation** réutilisé Stories 5.x reviews multi-criteria median display, Stories 9.x V1 subscription tier upgrade workflow.

### Décisions techniques majeures actées

1. **Threshold ≥ 5 listings statistical significance** — RGPD anonymisation (médiane d'1 listing = leak prix individuel) + UX honnête (médiane sur 2 listings pas significative).
2. **Redis cache 1h on `compute-median-price.usecase`** — wizard step 3 Story 3.3 multi-Pro saisit prix → millier d'appels possibles → cache amorti. Cron daily invalide cache + recompute.
3. **Cron 2am UTC daily** (vs hourly) — médians changent rarement, daily suffit. 2am = low traffic window.
4. **`category.median_price_amount` column** (vs separate medians table) — accès atomique avec category data Story 3.12 page catégorie. Une seule médiane par catégorie MVP (mode='unit' default — V1+ pourra ajouter median par mode).
5. **Identity-svc unavailable → autoPublish=false safer fallback** — failsafe rather than fail (Pro UX dégradée mais publication possible via moderation).
6. **2 events séparés `published.v1` + `submitted-for-moderation.v1`** (vs 1 event avec discriminator) — schemas spécialisés, type-safe consumers (Story 3.7 indexer ne consume que published, Story 6.2 admin queue ne consume que moderation).
7. **`listing-published.v1` schema UPDATE backward-compat** (ajout fields optional) — Story 2.6 + Story 3.5 cohabitent. Consumers Story 3.7 future ignorent fields nouveaux gracefully.
8. **Soft-warning deviation NON blocant** (FR32 explicit) — UX éducative pas paternaliste. Pro peut publier même 200% deviation.
9. **Frontend toasts 3 niveaux** (success / info / warning supplémentaire) — UX riche communique le state final clairement.
10. **MVP : median per category (uniquement mode='unit')** — column unique. V1+ pourra séparer par mode si signal métier. Évite over-engineering.
11. **EN strict + Pretre + envelope ADR-014 + i18n + latest stable versions** memories.

### Versions à utiliser

(Pas de nouvelle dépendance — réutilise Stories 0.x/2.x/3.x : `@nestjs/schedule` (Story 1.9), Redis client `ioredis` (Story 1.5/2.4 cache pattern), TypeORM, Pino. Pas de lib stats externe — `percentile_cont` SQL natif Postgres ≥ 9.4.)

### Project Structure cible

```
packages/contracts/src/events/catalog/
├─ listing-submitted-for-moderation.v1.{schema.json,ts}          # NEW Story 3.5
├─ medians-computed.v1.{schema.json,ts}                          # NEW Story 3.5
└─ listing-published.v1.{schema.json,ts}                         # UPDATE Story 2.6 — add optional fields backward-compat

apps/catalog-svc/src/
├─ usecases/
│  ├─ publish-listing.usecase.ts + spec                          # UPDATE Story 3.2 skeleton → FULL
│  └─ compute-median-price.usecase.ts + spec                     # UPDATE Story 3.2 skeleton → FULL + Redis cache
├─ domain/
│  ├─ ports/
│  │  ├─ listing-repository.port.ts                              # UPDATE Story 3.2 — add computeMedianPrice method
│  │  └─ category-repository.port.ts                             # UPDATE Story 3.1 — add updateMedianPrice method
│  └─ service/listing-publication.service.ts                     # UPDATE Story 3.2 — verify mapping verifiedAt = kyc_decision_at when kyc_status='approved'
├─ infrastructure/
│  ├─ persistence/typeorm/repositories/
│  │  ├─ listing.typeorm.repository.ts                           # UPDATE — add computeMedianPrice SQL percentile_cont
│  │  └─ category.typeorm.repository.ts                          # UPDATE Story 3.1 — add updateMedianPrice SQL
│  ├─ cache/
│  │  └─ median-price-cache.service.ts                           # NEW Story 3.5 (Redis wrapper TTL 1h)
│  └─ tasks/compute-medians.task.ts                              # NEW (cron daily 2am UTC)

apps/gateway-api/src/
├─ infrastructure/http/controllers/
│  ├─ listings.controller.ts                                     # UPDATE Story 3.3 — return PublishListingOutput shape
│  └─ categories.controller.ts                                   # UPDATE Story 3.3 stub → real call to /internal/categories/:slug/median-price

apps/seller/src/features/seller/listings/
├─ hooks/use-publish-listing-mutation.ts                         # UPDATE Story 3.3 — 3 toasts conditionnels onSuccess
└─ components/steps/StepPreview.tsx                              # UPDATE Story 3.3 — wire mutation response handling
└─ messages/{fr,en}.json                                         # UPDATE — i18n keys seller.listings.publish.toasts.*

apps/catalog-svc/test/
├─ cron/compute-medians.spec.ts                                  # NEW (testcontainer 3 scenarios)
└─ usecases/{publish,compute-median}.spec.ts                     # UPDATE Story 3.2 specs → ≥ 95 % coverage

apps/seller/e2e/listings/
├─ publish.spec.ts                                               # NEW Story 3.5 (5 tests)
└─ median-display.spec.ts                                        # NEW Story 3.5 (1 test)

infra/k8s/prometheus-rules/catalog-publish.yaml                  # NEW
infra/k8s/grafana-dashboards/catalog-publish.json                # NEW

docs/runbook/listing-publish-debug.md                            # NEW
docs/runbook/compute-medians-cron.md                             # NEW

# Estimation : ~15 nouveaux + ~10 updates = ~25 fichiers (story finalisation Stories 3.2/3.3 skeletons — moins lourde que 3.4)
```

### Critical Architecture Constraints

> Cf. Stories 0.2 (contracts events), 0.6 (Pretre + boundaries), 0.7 (outbox), 1.5/2.4 (Redis cache pattern), 1.9 (cron pattern), 2.5 (state machine canTransitionTo), 2.6 (catalog.listing.published.v1 schema), 2.7 (audit_log subscription identity.* + admin.* + medians-computed.v1 captured), 3.1 (category table + median_price_amount column + ICategoryRepository), 3.2 (Listing aggregate + state machine + ListingPublicationService + IMedianPriceCalculator port + IListingRepository), 3.3 (POST /v1/listings/:id/publish endpoint + GET /v1/categories/:slug/median-price stub + frontend usePriceDeviation + usePublishListingMutation), 3.4 (photos.length >= 3 invariant validates publication).

1. **Pretre architecture stricte** — Story 3.5 finalise les use cases skeletons Story 3.2 sans casser pure domain.
2. **Transactional outbox ADR-007** — publish use case + outbox event single transaction.
3. **API responses envelope ADR-014**.
4. **NFR1 RGPD transparence client FR31** — median publique sans identifier Pros sources + threshold ≥ 5 anonymisation.
5. **NFR48 cron SLA** — compute-medians 20 combinations < 30s total p90.
6. **Cache Redis TTL 1h** — pattern Story 1.5/2.4 réutilisé.
7. **EN strict + i18n FR/EN + latest stable versions** memories.

### Previous Story Intelligence

**Story 2.5 (admin accept/reject)** : `kyc_status='approved'` + `tukio_status='active'` + `kyc_decision_at` = source of truth pour `verifiedAt` calc Story 3.5.

**Story 2.6 (`catalog.listing.published.v1` schema)** : Story 3.5 UPDATE schema add optional fields `medianPriceForCategory` + `priceDeviation` backward-compat.

**Story 2.7 (audit_log AuditLogConsumer subscribe identity.* + admin.*)** : Story 3.5 events `catalog.listing.published.v1` + `catalog.listing.submitted-for-moderation.v1` + `catalog.medians.computed.v1` — Story 2.7 consumer ne subscribe PAS `catalog.*` actuellement. **Décision Story 3.5** : extend Story 2.7 consumer subscription `+ catalog.*` ? OU laisser audit_log Story 2.7 ne capture que identity/admin events (decisions admin = critical audit, catalog publish = pas critical audit). **MVP Story 3.5** : NE pas extend AuditLogConsumer subscription — catalog events sont consumés par leurs propres consumers (Story 3.7 Meilisearch indexer, Story 6.2 admin moderation). Si V1+ requires catalog audit, future story `extend audit_log subscription`.

**Story 3.1 (category table + median_price_amount column)** : Story 3.1 a posé la colonne (NULL initialement). Story 3.5 cron populates.

**Story 3.2 (Listing aggregate + ListingPublicationService skeleton + IMedianPriceCalculator port)** : Story 3.5 finalise skeletons. Aucune modification du domain Listing ou des invariants — juste implémentation des use cases.

**Story 3.3 (frontend wizard publish + median endpoints stub)** : Story 3.5 finalise les stubs. Frontend hooks consume real backend.

**Story 3.4 (photos pipeline)** : `listing.photos.length >= 3` invariant Story 3.2 enforces lors `publishDraft()` — Story 3.4 garantit photos uploaded ready.

### What this story does NOT do

- ❌ **Story 3.6 edit/unpublish/delete** — Story 3.6 reuse `update-listing.usecase` Story 3.2 + applique mêmes règles publish (auto-publish ou moderation selon profil). Story 3.5 livre la logique core.
- ❌ **Story 3.7 Meilisearch indexer consume `catalog.listing.published.v1`** — Story 3.7 implement.
- ❌ **Story 6.2 admin moderation queue consume `catalog.listing.submitted-for-moderation.v1`** — Story 6.2 V1 implement.
- ❌ **Story 3.12 page catégorie générale display median** — Story 3.12 consume `category.median_price_amount` populated by Story 3.5 cron.
- ❌ **Story 3.10 listing detail public** — independent Story.
- ❌ **Auto-publish criteria configurable per Pro tier** — V1+ admin tool. MVP fixed criteria (verified > 30d + reportsCount < 3 + tukio_status='active').
- ❌ **Median per pricingMode separately on category row** — MVP single column 'unit'. V1+ if signal.
- ❌ **DeepL auto-translate FR → EN missing** title/description if EN absent at publish — V1+ FR101.
- ❌ **Image AI moderation on publish (offensive content)** — V1+ Stories 6.x.
- ❌ **Real-time median update on each new listing publish** — daily cron suffit MVP. V1+ Pub/Sub instant if needed.

### Files to UPDATE vs CREATE

(Cf. Project Structure cible — annoté UPDATE/NEW)

### Testing Standards

- Coverage ≥ 95 % use cases publish + compute-median (NFR71 strict — critical state machine + statistical computation)
- Coverage ≥ 90 % cron compute-medians
- Coverage ≥ 80 % gateway endpoints + repo SQL
- Tests integration testcontainer Postgres : 3 scenarios cron + 6 use case scenarios
- Tests E2E Playwright FR/EN axe-core 0 violations 9 tests AC9
- Perf : publish use case < 500ms p90, compute-median SQL < 50ms p90 with 1k listings, cron 20 combinations < 30s
- Tests integration mock IProProfileClient 8 scenarios shouldAutoPublish criteria

### Project Structure Notes

✅ **Aligné architecture, PRD §FR30 (auto-publish), §FR31 (median price transparence), §FR32 (deviation soft-warning), §NFR1 (RGPD anonymisation), §NFR48 (cron SLA), Stories 0.2/0.6/0.7/1.5/2.5/2.6/3.1/3.2/3.3/3.4, memories.**

⚠️ **Décision** : Threshold ≥ 5 listings statistical significance — RGPD anonymisation + UX honnête.
⚠️ **Décision** : Redis cache 1h on compute-median-price — amorti charge wizard step 3.
⚠️ **Décision** : Cron 2am UTC daily — low traffic + médians changent rarement.
⚠️ **Décision** : `category.median_price_amount` column simple (vs separate table) — atomic + lecture simple.
⚠️ **Décision** : Identity-svc unavailable → autoPublish=false safer fallback — failsafe.
⚠️ **Décision** : 2 events séparés (vs discriminator) — schemas type-safe + consumers spécialisés.
⚠️ **Décision** : Schema `listing-published.v1` UPDATE backward-compat — Stories 2.6/3.5 cohabitent.
⚠️ **Décision** : Soft-warning deviation NON blocant — UX éducative pas paternaliste.
⚠️ **Décision** : MVP single median column 'unit' — V1+ separate per mode.
⚠️ **Décision** : audit_log Story 2.7 subscription NOT extended pour catalog.* — events consumés par leurs propres consumers spécialisés.

### References

- [Source: epics.md#Epic-3-Story-3.5 — Lines 1459-1472]
- [Source: prd.md#FR30 (auto-publish criteria), #FR31 (median transparence), #FR32 (deviation soft-warning), #NFR1 (RGPD anonymisation)]
- [Source: architecture.md — ADR-007 outbox, ADR-014 envelope, lines 2120-2164 Pretre]
- [Source: Stories 0.2 (contracts), 0.6 (Pretre), 0.7 (outbox), 1.5/2.4 (Redis cache pattern), 1.9 (cron pattern), 2.5 (state machine + verifiedAt mapping), 2.6 (catalog.listing.published.v1 schema), 2.7 (AuditLogConsumer subscription scope), 3.1 (category.median_price_amount column), 3.2 (skeletons publish + compute-median + ListingPublicationService + IMedianPriceCalculator port + state machine), 3.3 (POST publish endpoint + median endpoint stubs + frontend hooks), 3.4 (photos pipeline garantit listing.photos ready)]
- [Memory: feedback_clean_architecture_explicit.md, feedback_api_envelope_response.md, feedback_tech_layer_english.md, feedback_i18n_frontend.md, feedback_latest_versions.md]

## Dev Agent Record

### Agent Model Used

(à remplir)

### Debug Log References

### Completion Notes List

(à remplir à la fin — résumé décisions, déviations vs Dev Notes avec justification, points d'attention pour Story 3.6 (edit/unpublish/delete — reuse update-listing.usecase Story 3.2 + applique règles publish Story 3.5 si re-publish), Story 3.7 (Meilisearch indexer — consume `catalog.listing.published.v1` event Story 3.5), Story 3.10 (listing detail public — slug routing reuse), Story 3.12 (page catégorie générale — display median price field populated by cron Story 3.5), Story 6.2 V1 (admin moderation queue — consume `catalog.listing.submitted-for-moderation.v1`))

### File List

(à remplir au fil de l'implémentation par le dev agent)

---

## Story Completion Status

- **Story Status** : `ready-for-dev`
- **Created** : 2026-05-09
- **Created by** : `bmad-create-story` workflow
- **Epic** : Epic 3 — Catalog Publication & Discovery (MVP)
- **Sprint cible** : Sprint 4 (5ᵉ story Epic 3 — finalisation Stories 3.2/3.3 skeletons)
- **Estimation effort** : 3-4 jours (1 dev fullstack — story finalisation + cron + Redis cache + frontend toasts + tests, ~25 fichiers)
- **Dépendances upstream** : Stories 0.2, 0.6, 0.7, 1.5/2.4 (Redis cache pattern), 1.9 (cron pattern), 2.5 (state machine + verifiedAt mapping), 2.6 (event schema), 2.7 (audit_log subscription scope), 3.1 (category.median_price_amount column + ICategoryRepository), 3.2 (Listing aggregate + skeletons publish/median + ListingPublicationService + IMedianPriceCalculator port + state machine), 3.3 (POST publish endpoint + median endpoint stubs + frontend hooks), 3.4 (photos pipeline garantit photos ready)
- **Dépendances downstream** :
  - Story 3.6 (edit/unpublish/delete) — reuse update-listing + applique publish rules Story 3.5 si re-publish post-edit
  - Story 3.7 (Meilisearch indexer) — consume `catalog.listing.published.v1` Story 3.5
  - Story 3.10 (listing detail public) — slug routing
  - Story 3.12 (page catégorie générale) — display median field populated by cron
  - Story 6.2 V1 (admin moderation queue) — consume `catalog.listing.submitted-for-moderation.v1`
- **FRs covered** :
  - **FR30** ✅ auto-publish (Pro verified > 30d + reportsCount < 3) OU moderation a posteriori
  - **FR31** ✅ median price transparence client (cron daily + threshold ≥ 5)
  - **FR32** ✅ deviation > 50% soft-warning UX éducative (frontend Story 3.3 mécanique + backend Story 3.5 median)
- **NFRs touchés** :
  - **NFR1** ✅ RGPD anonymisation médian (threshold ≥ 5 listings)
  - **NFR48** ✅ cron SLA < 30s p90 (20 combinations)
  - **NFR71** ✅ coverage ≥ 95 % use cases + 90 % cron + 80 % gateway/repo

> **Prochaine story → Story 3.6** (Edit / Unpublish / Delete listing flow — `/seller/listings` page liste + actions menu + reuse use cases Story 3.2 full + apply publish rules Story 3.5 si re-publish post-edit)

---

**Dev agent next steps :**
1. Lire ce file complètement
2. Vérifier upstream Stories 0.2, 0.6, 0.7, 1.5/2.4, 1.9, 2.5, 2.6, 2.7, 3.1, 3.2, 3.3, 3.4 implémentées
3. Implémenter Tasks 1-9 dans l'ordre (events Task 1 → use cases finalisation Tasks 2-3 → cron Task 4 → endpoint finalisation Task 5 → frontend toasts Task 6 → métriques Task 7 → tests Task 8 → docs Task 9)
4. Lancer `pnpm vitest --filter=catalog-svc test/usecases/publish` + `pnpm playwright test --grep "publish workflow"` après chaque jalon
5. Commit Story 3.5 quand : 9/9 e2e + 8/8 use case unit tests + 3/3 cron testcontainer + coverage NFR71 + perf cibles + lint boundaries 0 + Redis cache hit ratio > 80% en charge dev local + Story 3.3 stub finalisé + Story 3.3 14 e2e regression pass
6. Update sprint-status : `3-5-...: review` puis `done`
