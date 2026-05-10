# Story 3.2: catalog-svc Pretre implementation (Listing aggregate + value-objects + 8 use cases)

Status: ready-for-dev

## Story

**As a** backend developer Tukio (gardien Pattern Pretre + Clean Architecture catalog-svc + foundation domain pour toutes les Stories Epic 3 downstream),
**I want** **livrer le domain Listing complet** (aggregate root + 6 value-objects + 8 use cases skeletons + 6 ports + ListingPublicationService + DB tables + lint boundaries strict) — Story 3.1 a déjà scaffold catalog-svc (Pretre baseline) + taxonomy data model (category/service_type tables + seed). Story 3.2 livre maintenant le **cœur métier Listing** que Stories 3.3 (wizard frontend), 3.4 (photo upload), 3.5 (publish workflow + auto-publish), 3.6 (edit/unpublish/delete), 3.7 (Meilisearch indexer), 3.10 (listing detail public) consomment :
- (a) **Domain `Listing` aggregate root** (`apps/catalog-svc/src/domain/model/listing.aggregate.ts`) avec invariants stricts state machine + value-objects composites :
```ts
export class Listing {
  readonly id: ListingId;
  readonly proProfileId: string; // FK → identity-svc.pro_profiles.id
  readonly categoryId: string;   // FK → category Story 3.1
  readonly serviceTypeId: string;// FK → service_type Story 3.1
  slug: Slug; // EN strict slug VO (memory feedback_tech_layer_english)
  title: TitleMultilang; // VO {fr: string (required), en: string | null}
  description: DescriptionMultilang;
  pricing: Pricing; // VO embedded mode='unit' | 'package'
  serviceArea: ServiceArea; // VO embedded
  photos: Photo[]; // collection 0-15 photos
  status: ListingStatus; // 'draft' | 'pending_moderation' | 'published' | 'unpublished'
  publishedAt: Date | null;
  unpublishedAt: Date | null;
  draftMetadata: DraftMetadata | null; // {priceDeviation: boolean, lastAutoSavedAt: Date} populated by Story 3.5
  reportsCount: number; // populated Story 6.4 reports
  createdAt: Date; updatedAt: Date; deletedAt: Date | null;

  // Domain methods (state machine — Story 3.2 implements transitions, Story 3.5 fills auto-publish service):
  static create(input: { proProfileId, categoryId, serviceTypeId, slug, title, description, pricing, serviceArea }): Listing { ... } // status = 'draft'
  updateContent(input: { title?, description?, pricing?, serviceArea?, slug? }): void { /* invariant: only allowed if status ∈ {draft, published, unpublished} */ }
  addPhoto(photo: Photo): void { /* invariant: photos.length < 15 */ }
  removePhoto(photoId: string): void { /* invariant: photos.length > 1 (cannot remove last) */ }
  reorderPhotos(orderedIds: string[]): void { /* invariant: same set, just resorted */ }
  publishDraft(autoPublish: boolean, priceDeviation: boolean): void { /* invariant: status ∈ {draft, unpublished} + photos.length >= 3 (FR23) + title.fr OK + pricing OK + serviceArea OK; sets status='published' OR 'pending_moderation' selon autoPublish */ }
  unpublish(): void { /* invariant: status === 'published'; sets unpublishedAt + status='unpublished' */ }
  approveModeration(): void { /* invariant: status === 'pending_moderation' (Story 6.2 admin moderation) */ }
  rejectModeration(reason: string): void { /* invariant: status === 'pending_moderation'; reverts to draft + decision metadata */ }
  softDelete(): void { /* invariant: status === 'draft' (cannot delete published — Story 3.6 unpublish first) */ }
  incrementReportsCount(): void { /* called by Story 6.4 reports consumer */ }

  private canTransitionStatusTo(target: ListingStatus): boolean {
    const allowed: Record<ListingStatus, ListingStatus[]> = {
      draft: ['pending_moderation', 'published'], // direct publish if autoPublish OR via moderation
      pending_moderation: ['published', 'draft'], // approved or rejected back to draft
      published: ['unpublished'],
      unpublished: ['published', 'draft'], // re-publish or move back to draft
    };
    return allowed[this.status]?.includes(target) ?? false;
  }
}
```
- (b) **6 value-objects** (`apps/catalog-svc/src/domain/model/value-objects/`) — pure TS, no I/O imports (lint boundaries enforce) :
  - **`title-multilang.vo.ts`** : `TitleMultilang` immutable VO `{ fr: string (1-80 chars required), en: string | null (1-80 chars optional) }` — invariants throw `CatalogValidationException('title.fr.required')` (FR99). Méthodes : `getFor(locale): string` (returns `en ?? fr` fallback).
  - **`description-multilang.vo.ts`** : `DescriptionMultilang` `{ fr: string (1-2000 chars required), en: string | null (1-2000 chars optional) }` (FR99 + UX wizard Story 3.3 max chars).
  - **`pricing.vo.ts`** : `Pricing` discriminated union :
    ```ts
    export type Pricing = UnitPricing | PackagePricing;
    interface UnitPricing { mode: 'unit'; amount: Money; unit: string; minQuantity: number | null; maxQuantity: number | null; }
    interface PackagePricing { mode: 'package'; amount: Money; packageDescription: string; }
    interface Money { amountCents: number; currency: 'EUR'; } // amountCents > 0, currency MVP only EUR
    ```
    Invariants : `amount.amountCents > 0`, mode='unit' → unit string non-empty + minQuantity >= 1 si défini + maxQuantity >= minQuantity si défini, mode='package' → packageDescription 1-500 chars (FR25 MVP).
  - **`service-area.vo.ts`** : `ServiceArea` `{ originPostalCode: string (5 chars FR format \d{5}), deliveryRadiusKm: number (1-200), minLeadTimeDays: number (1-30) }`. Invariants throw `CatalogValidationException('service-area.invalid-postal-code'|'service-area.radius-out-of-range'|'service-area.lead-time-out-of-range')` (FR26).
  - **`photo.vo.ts`** : `Photo` `{ id: PhotoId, r2Key: string, cloudflareImageId: string, altText: string | null (max 125 chars NFR50 a11y), sortOrder: number (0+) }`. Invariants : `r2Key` + `cloudflareImageId` requis (chaque photo doit exister sur les 2 systèmes — Story 3.4 garantit le pipeline R2 → CF Images).
  - **`slug.vo.ts`** : `Slug` `string` value validated `/^[a-z0-9]+(-[a-z0-9]+)*$/` (EN strict + lowercase). Méthode statique `Slug.fromTitle(title: string, randomSuffix: boolean = true): Slug` qui slugify + ASCII transliterate (e.g., "Chapiteau Élégant 6×6m" → "chapiteau-elegant-6x6m") + optional 6-char random suffix anti-collision (Story 3.5 unique constraint).
- (c) **2 entities** (Story 3.1 baseline réutilisé) :
  - `category.entity.ts` (Story 3.1 livré, Story 3.2 réutilise tel quel — pas de modification)
  - `service-type.entity.ts` (Story 3.1 livré, Story 3.2 réutilise)
- (d) **6 ports `apps/catalog-svc/src/domain/ports/`** (Pretre — domain pure, infra infra/external/) :
  - `listing-repository.port.ts` (`IListingRepository` — `findById`, `findByProProfileId({ proProfileId, status?, page, pageSize })` cursor pagination Story 2.3 pattern, `findBySlug(slug, locale?)`, `save(listing): Promise<void>` (upsert + cascade photos), `softDelete(id)`, `countByCategoryAndStatus(categoryId, status)`)
  - `category-repository.port.ts` (Story 3.1 livré, Story 3.2 réutilise — pas de modification)
  - `search-indexer.port.ts` (`ISearchIndexer` — abstraction Meilisearch consumed Story 3.7. Story 3.2 livre le port + interface `indexListing(listing)`, `removeListing(id)`. Story 3.7 implémente.)
  - `photo-storage.port.ts` (`IPhotoStorage` — abstraction R2/CF Images consumed Story 3.4. Story 3.2 livre le port + interface `generateUploadUrl()`, `finalizeUpload(r2Key)`, `softDelete(photoId)`. Story 3.4 implémente.)
  - `event-publisher.port.ts` (Story 0.7 réutilisé — `publish(event): Promise<void>` outbox pattern)
  - `median-price-calculator.port.ts` (`IMedianPriceCalculator` — `compute(categoryId, pricingMode): Promise<Money | null>`. Story 3.5 implémente le cron `compute-medians.task.ts`.)
- (e) **`ListingPublicationService`** domain service (`apps/catalog-svc/src/domain/service/listing-publication.service.ts`) — orchestrateur pure logic :
```ts
@Injectable()
export class ListingPublicationService {
  constructor(@Inject(PRO_PROFILE_CLIENT) private readonly proProfileClient: IProProfileClient) {} // domain port — calls identity-svc /internal/pros/by-id/:id
  
  /** FR30 auto-publish criteria: verifiedAt > 30 days ago AND reportsCount < 3 AND tukio_status='active' (Story 2.5 confirmed enum) */
  async shouldAutoPublish(proProfileId: string): Promise<boolean> {
    const proProfile = await this.proProfileClient.getById(proProfileId);
    if (!proProfile) return false;
    if (proProfile.tukioStatus !== 'active') return false; // Story 2.5 enum 'active' = onboarding completed
    if (proProfile.kycStatus !== 'approved') return false; // Story 2.5 confirmed
    if (proProfile.reportsCount >= 3) return false;
    if (!proProfile.verifiedAt) return false;
    const daysSinceVerified = Math.floor((Date.now() - proProfile.verifiedAt.getTime()) / (24 * 60 * 60 * 1000));
    return daysSinceVerified >= 30;
  }

  /** FR32 soft-warning: deviation > 50% of category median */
  computePriceDeviation(price: Money, median: Money | null): boolean {
    if (!median || median.amountCents === 0) return false;
    return Math.abs(price.amountCents - median.amountCents) / median.amountCents > 0.5;
  }
}
```
- (f) **3 exceptions** (`apps/catalog-svc/src/domain/exception/`) :
  - `catalog-validation.exception.ts` (`CatalogValidationException` — generic with `field` + `code` + `details?`)
  - `listing-status-invalid-transition.exception.ts` (with `from`, `to`, `listingId` context)
  - `listing-not-found.exception.ts`
- (g) **DB migration `1715310000000-CreateListingTables.ts`** Story 3.2 — 3 tables + indexes + check constraints :
```sql
CREATE TABLE listing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pro_profile_id UUID NOT NULL, -- FK logique vers identity-svc.pro_profiles.id (cross-svc, no DB FK)
  category_id UUID NOT NULL REFERENCES category(id) ON DELETE RESTRICT,
  service_type_id UUID NOT NULL REFERENCES service_type(id) ON DELETE RESTRICT,
  slug VARCHAR(140) NOT NULL UNIQUE, -- EN strict (Slug VO regex)
  status VARCHAR(30) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_moderation', 'published', 'unpublished')),
  pricing JSONB NOT NULL, -- discriminated union { mode: 'unit'|'package', ... } embedded
  service_area JSONB NOT NULL, -- { originPostalCode, deliveryRadiusKm, minLeadTimeDays }
  draft_metadata JSONB NULL, -- { priceDeviation: boolean, lastAutoSavedAt: ISO } Story 3.3 wizard auto-save
  reports_count INT NOT NULL DEFAULT 0 CHECK (reports_count >= 0),
  published_at TIMESTAMPTZ NULL,
  unpublished_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL
);
CREATE INDEX idx_listing_pro_profile_id_status ON listing (pro_profile_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_listing_status_published_at ON listing (status, published_at DESC) WHERE deleted_at IS NULL AND status = 'published';
CREATE INDEX idx_listing_category_id_status ON listing (category_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_listing_pricing_mode ON listing ((pricing->>'mode')) WHERE deleted_at IS NULL;
-- Auto-update updated_at trigger (Story 1.10 pattern)
CREATE TRIGGER listing_updated_at BEFORE UPDATE ON listing FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TABLE listing_translations (
  listing_id UUID NOT NULL REFERENCES listing(id) ON DELETE CASCADE,
  locale VARCHAR(2) NOT NULL CHECK (locale IN ('fr', 'en')),
  title VARCHAR(80) NOT NULL,
  description TEXT NOT NULL CHECK (LENGTH(description) BETWEEN 1 AND 2000),
  PRIMARY KEY (listing_id, locale)
);

CREATE TABLE listing_photo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listing(id) ON DELETE CASCADE,
  r2_key VARCHAR(500) NOT NULL,
  cloudflare_image_id VARCHAR(100) NOT NULL,
  alt_text VARCHAR(125) NULL, -- NFR50 a11y
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  UNIQUE (listing_id, r2_key)
);
CREATE INDEX idx_listing_photo_listing_id_sort_order ON listing_photo (listing_id, sort_order) WHERE deleted_at IS NULL;
```
- (h) **8 use cases** (`apps/catalog-svc/src/usecases/`) — Story 3.2 livre tous les skeletons + l'implémentation MVP. Stories 3.3-3.6 wirent gateway endpoints + UI :

| Use case | Scope Story 3.2 | Consumer downstream |
|----------|-----------------|----------------------|
| `create-listing.usecase.ts` | **Full implementation** : `Listing.create(...)` + persist + outbox event `catalog.listing.created.v1` | Story 3.3 wizard step 5 "Sauvegarder en brouillon" |
| `update-listing.usecase.ts` | **Full** : load + `listing.updateContent(...)` + photo CRUD methods + persist + outbox `catalog.listing.updated.v1` | Story 3.3 wizard auto-save + Story 3.6 edit |
| `publish-listing.usecase.ts` | **Skeleton MVP** : load + invariant photos.length >= 3 + delegate `ListingPublicationService.shouldAutoPublish()` → `listing.publishDraft(autoPublish, priceDeviation)` + outbox event. **Story 3.5 finalise** : intègre `MedianPriceCalculator.compute()` + price deviation check + auto-publish gating | Story 3.5 publish workflow |
| `unpublish-listing.usecase.ts` | **Full** : load + `listing.unpublish()` + outbox `catalog.listing.unpublished.v1` | Story 3.6 |
| `delete-listing.usecase.ts` | **Full** : load + `listing.softDelete()` + cascade photos soft-delete + outbox `catalog.listing.deleted.v1` | Story 3.6 |
| `get-listing-detail.usecase.ts` | **Full** : load by id or slug + locale fallback FR if EN missing (NFR60 pattern Story 3.1) + photos sorted | Story 3.10 listing detail public + Story 3.6 edit (load draft) |
| `list-pro-listings.usecase.ts` | **Full** : `findByProProfileId({ proProfileId, status?, cursor })` cursor pagination Story 2.3 pattern | Story 3.6 seller listings page |
| `compute-median-price.usecase.ts` | **Skeleton with TODO** : interface + signature `execute(categoryId, pricingMode): Promise<Money \| null>` returning `null` MVP. **Story 3.5 finalise** : SQL query `SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY (pricing->>'amountCents')::bigint) FROM listing WHERE category_id = $1 AND (pricing->>'mode') = $2 AND status = 'published' AND deleted_at IS NULL` | Story 3.5 cron `compute-medians.task.ts` |

- (i) **Lint boundaries strict** : `pnpm --filter=catalog-svc lint` 0 violations sur `apps/catalog-svc/src/domain/**` — NO imports `@nestjs/*`, `typeorm`, `axios`, `meilisearch`, `@aws-sdk/*`, `cloudflare`. Test failure case : créer temporairement `domain/test-violation.ts` avec `import { Repository } from 'typeorm'` → `pnpm lint` fail clear message → SUPPRIMER fichier (pas de commit).

**so that** Stories Epic 3 downstream (3.3 wizard, 3.4 photos, 3.5 publish, 3.6 edit/unpublish/delete, 3.7 Meilisearch indexer, 3.10 listing detail, 3.11 pro public profile, 3.12 page catégorie générale) consomment un **domain Listing solide testable** sans coupler aux détails infra (R2, Cloudflare Images, Meilisearch, Postgres, NATS) — pure domain logic + ports interfaces. Le **pattern complet "aggregate root with state machine + multi-VO + multi-port + domain service for orchestration"** devient template Stories Epic 4 (Booking aggregate saga + state machine), Stories Epic 5 (Conversation/Message aggregates), Stories Epic 10 V1 (Dispute aggregate state machine).

> **Outcome attendu** : à la fin de cette story, `pnpm --filter=catalog-svc lint` passe avec **0 violations boundaries** (domain pure) ; `pnpm --filter=catalog-svc test --coverage` montre **≥ 95 % aggregate Listing + 6 VOs (state machine + invariants critical)**, **≥ 90 % use cases**, **≥ 80 % infrastructure** (NFR71) ; la migration `1715310000000-CreateListingTables.ts` crée les 3 tables `listing` + `listing_translations` + `listing_photo` avec index partials performance-friendly + check constraints ; un dev backend Story 3.3 (future wizard) peut appeler `gateway-api → POST /v1/listings (draft)` qui forward catalog-svc `CreateListingUseCase.execute({...})` → `Listing.create(...)` + persist DB + outbox event publié visible `localhost:8222/jsz` ; un dev backend Story 3.4 (future photo upload) peut `Listing.addPhoto(photo)` + persist via `IListingRepository.save(listing)` (cascade photos) ; un dev backend Story 3.5 (future publish workflow) peut consumer `ListingPublicationService.shouldAutoPublish(proProfileId)` qui call identity-svc internal `/internal/pros/by-id/:id` (Story 1.10 endpoint réutilisé) ; un dev backend Story 3.7 (future Meilisearch indexer) peut implement `ISearchIndexer` port livré Story 3.2 + subscribe `catalog.listing.published.v1` event ; un test `pnpm vitest --filter=catalog-svc test/aggregates` passe **40+ test cases** state machine + VO invariants exhaustifs ; la **handoff Stories 3.3-3.12** est documentée — chaque story future consume des use cases déjà implémentés (full ou skeleton) sans avoir à toucher au domain aggregate.

## Acceptance Criteria

1. **AC1 — Domain `Listing` aggregate root + state machine** : Given Pretre architecture Story 3.1 baseline, When je consulte `apps/catalog-svc/src/domain/model/listing.aggregate.ts`, Then :
   - **Aggregate Listing** avec tous les fields (cf. story body) + state machine `canTransitionStatusTo` privé
   - **Domain methods** Story 3.2 implémentées :
     - `static create({...})` — factory avec validation invariants (FR99 title.fr required + photos initialement vide [] + status='draft')
     - `updateContent(input)` — invariants : status ∈ {draft, published, unpublished} (cannot edit pending_moderation)
     - `addPhoto(photo)` — invariant `photos.length < 15` else `CatalogValidationException('photos.max-exceeded')`
     - `removePhoto(photoId)` — invariant `photos.length > 1` (cannot remove last — FR23 minimum 1) — Story 3.5 finalisera invariant photos.length >= 3 lors publish
     - `reorderPhotos(orderedIds)` — invariant : same set of IDs
     - `publishDraft(autoPublish: boolean, priceDeviation: boolean)` — invariants : status ∈ {draft, unpublished} + photos.length >= 3 (FR23) + title.fr OK + pricing OK + serviceArea OK + slug OK ; sets `status='published'` (autoPublish=true) OU `status='pending_moderation'` (false) ; sets `publishedAt = NOW()` si autoPublish=true ; sets `draftMetadata.priceDeviation = priceDeviation`
     - `unpublish()` — invariant `status === 'published'` ; sets `unpublishedAt = NOW()` + `status='unpublished'`
     - `approveModeration()` — invariant `status === 'pending_moderation'` (Story 6.2 admin) ; sets `status='published'` + `publishedAt = NOW()`
     - `rejectModeration(reason)` — invariant `status === 'pending_moderation'` ; sets `status='draft'` + persist reason in `draftMetadata.moderationRejection`
     - `softDelete()` — invariant `status === 'draft'` (cannot delete published — Story 3.6 unpublish first) ; sets `deletedAt = NOW()`
     - `incrementReportsCount()` — pas d'invariant strict ; consume Story 6.4 reports event
   - **Tests aggregate ≥ 95 %** : 30+ cases exhaustifs (each transition allowed/forbidden + each invariant violation + edge cases boundary photos.length=2/3/15/16)

2. **AC2 — 6 value-objects + invariants stricts** : Given AC1, When je consulte `apps/catalog-svc/src/domain/model/value-objects/`, Then :
   - **`title-multilang.vo.ts`** :
     ```ts
     export class TitleMultilang {
       constructor(public readonly fr: string, public readonly en: string | null) {
         if (!fr || fr.trim().length === 0) throw new CatalogValidationException({ field: 'title.fr', code: 'required' });
         if (fr.length > 80) throw new CatalogValidationException({ field: 'title.fr', code: 'max-length-exceeded', details: { max: 80, actual: fr.length } });
         if (en !== null && (en.length === 0 || en.length > 80)) throw new CatalogValidationException({ field: 'title.en', code: 'invalid-length' });
       }
       getFor(locale: 'fr' | 'en'): string { return locale === 'en' && this.en ? this.en : this.fr; } // fallback FR if EN missing
     }
     ```
   - **`description-multilang.vo.ts`** : similar pattern, max 2000 chars (vs 80 for title)
   - **`pricing.vo.ts`** : discriminated union `Pricing = UnitPricing | PackagePricing`, factory `Pricing.unit({...})` + `Pricing.package({...})` with invariants
   - **`service-area.vo.ts`** : invariants `originPostalCode` regex `/^\d{5}$/` (FR format), `deliveryRadiusKm BETWEEN 1 AND 200`, `minLeadTimeDays BETWEEN 1 AND 30`
   - **`photo.vo.ts`** : invariants `r2Key` non-empty, `cloudflareImageId` non-empty, `altText` ≤ 125 chars (NFR50), `sortOrder >= 0`
   - **`slug.vo.ts`** : regex `/^[a-z0-9]+(-[a-z0-9]+)*$/` strict + factory `Slug.fromTitle(title, randomSuffix)` qui ASCII-transliterate (lib `slugify` latest stable v1.6+ — pure JS no native deps) + optional 6-char nanoid suffix
   - Tests VOs ≥ 95 % chaque : happy + each invariant violation + edge cases (boundary lengths, regex matches)

3. **AC3 — 6 ports + 3 exceptions** : Given AC1, When je consulte `apps/catalog-svc/src/domain/ports/` + `domain/exception/`, Then :
   - **Ports** (cf. story body) — interfaces only, no implementations (infra/external livre les impls Stories 3.3-3.7)
   - **`ProProfileClient` port** NEW Story 3.2 (`domain/ports/pro-profile-client.port.ts`) — abstraction call identity-svc `/internal/pros/by-id/:id` :
     ```ts
     export interface IProProfileClient {
       getById(proProfileId: string): Promise<ProProfileSnapshot | null>;
     }
     export interface ProProfileSnapshot {
       id: string;
       userProfileId: string;
       tukioStatus: 'active' | 'pending_admin_review' | 'rejected' | 'suspended';
       kycStatus: 'pending_review' | 'under_review' | 'approved' | 'rejected';
       verifiedAt: Date | null; // = pro_profiles.kyc_decision_at when kyc_status='approved'
       reportsCount: number; // populated Story 6.4 V1, 0 MVP
     }
     ```
   - **Exceptions** :
     - `catalog-validation.exception.ts` (`CatalogValidationException` generic + `field`/`code`/`details`/`message`)
     - `listing-status-invalid-transition.exception.ts` (`from`/`to`/`listingId`)
     - `listing-not-found.exception.ts`
   - Tests : exception construction + serialization (`toEnvelope()` method for ADR-014 mapping)

4. **AC4 — `ListingPublicationService` domain service** : Given AC3, When je consulte `apps/catalog-svc/src/domain/service/listing-publication.service.ts`, Then :
   - **`shouldAutoPublish(proProfileId)`** — implementation cf. story body. Calls `IProProfileClient.getById` (port — implementation in `infrastructure/external/identity-svc/identity-svc-client.service.ts` Story 3.2)
   - **`computePriceDeviation(price, median)`** — pure function, > 50 % deviation → true (FR32 soft-warning)
   - Tests unit ≥ 95 % : 8 cases (auto-publish happy active+approved+30days+0reports → true ; tukio_status≠active → false ; kyc_status≠approved → false ; verifiedAt < 30days → false ; reportsCount >= 3 → false ; price deviation 50% boundary edge ; median null → false ; price=0 edge)

5. **AC5 — DB migration `listing` + `listing_translations` + `listing_photo` + indexes** : Given Story 3.1 baseline migration, When je consulte `apps/catalog-svc/src/infrastructure/persistence/typeorm/migrations/1715310000000-CreateListingTables.ts`, Then :
   - **3 tables créées** (cf. story body)
   - **Indexes partials performance-friendly** : `idx_listing_pro_profile_id_status` (Story 3.6 list seller listings), `idx_listing_status_published_at` (Story 3.7 Meilisearch sync queue), `idx_listing_category_id_status` (Story 3.5 median calc + Story 3.12 page catégorie), `idx_listing_pricing_mode` (Story 3.5 median by mode), `idx_listing_photo_listing_id_sort_order` (Story 3.10 detail page render)
   - **Trigger `listing_updated_at`** — pattern Story 1.10 `trigger_set_updated_at()` function réutilisé (auto-update updated_at on UPDATE)
   - **Check constraints** (status enum, reports_count >= 0, description length 1-2000, alt_text length ≤ 125)
   - **`down()` migration** : DROP cascade ordre inverse FK
   - Tests integration testcontainer Postgres 6 cases : INSERT happy + check constraint violations + cascade delete photos when listing deleted + cascade translations + soft-delete preserves translations + index EXPLAIN ANALYZE on common queries

6. **AC6 — TypeORM repository `listing.typeorm.repository.ts` + entities** : Given AC5, When je consulte `apps/catalog-svc/src/infrastructure/persistence/typeorm/`, Then :
   - **Entities ORM** (distinct from domain entities — pattern Story 1.3) : `listing.entity.ts`, `listing-translation.entity.ts`, `listing-photo.entity.ts` avec décorateurs TypeORM + relations
   - **Repository** `listing.typeorm.repository.ts` implémente `IListingRepository` :
     - `findById(id, options?)` — JOIN translations + photos (eager load avec `relations: ['translations', 'photos']`)
     - `findByProProfileId({ proProfileId, status?, cursor })` — cursor pagination composite `(updated_at DESC, id DESC)` Story 2.3 pattern
     - `findBySlug(slug, locale?)` — slug unique global, JOIN translations selon locale
     - `save(listing): Promise<void>` — upsert listing + cascade translations + cascade photos (transaction TypeORM `runInTransaction`)
     - `softDelete(id)` — UPDATE deleted_at + cascade photos.deleted_at
     - `countByCategoryAndStatus(categoryId, status)` — for Story 3.5 median + Story 3.12 page catégorie
   - **Mapper `listing.mapper.ts`** : `toDomain(entity): Listing` + `toEntity(domain): ListingEntity` (handles VOs serialization to JSONB pricing/serviceArea + photos collection)
   - Tests integration testcontainer : 8 scenarios (CRUD + cursor pagination + cascade + soft-delete preservation)

7. **AC7 — 8 use cases** : Given AC1-6, When je consulte `apps/catalog-svc/src/usecases/`, Then les 8 use cases existent avec scope Story 3.2 (full vs skeleton — cf. story body table) :
   - **Full implementations** (Story 3.2 livre fully) : `create-listing.usecase.ts`, `update-listing.usecase.ts`, `unpublish-listing.usecase.ts`, `delete-listing.usecase.ts`, `get-listing-detail.usecase.ts`, `list-pro-listings.usecase.ts`
   - **Skeletons MVP** (Story 3.5 finalise) : `publish-listing.usecase.ts` (minimal logic — invariants + delegate service ; Story 3.5 ajoute median + auto-publish full), `compute-median-price.usecase.ts` (returns null MVP — Story 3.5 implémente SQL percentile_cont)
   - Each use case : transactional outbox publish event approprié (`catalog.listing.created.v1`, `catalog.listing.updated.v1`, `catalog.listing.unpublished.v1`, `catalog.listing.deleted.v1`)
   - Wire `usecases-proxy.module.ts` Story 3.1 — add 8 use cases avec Symbol DI tokens
   - Tests unit ≥ 90 % chaque use case (happy + invariants + transactional rollback simulation)

8. **AC8 — `IProProfileClient` infra implementation + identity-svc internal endpoint** : Given AC3 port, When je consulte :
   - **NEW infra impl** `apps/catalog-svc/src/infrastructure/external/identity-svc/identity-svc-client.service.ts` (`IdentitySvcClientService implements IProProfileClient`) — axios call to identity-svc `GET /internal/pros/by-id/:id` avec `X-Internal-Service-Token` header (Doppler `INTERNAL_SERVICE_TOKEN`)
   - **identity-svc UPDATE Story 3.2 minor** : si Story 1.10 a livré `/internal/pros/by-id/:id` (Story 1.10 line 569 mentions). Si pas livré → Story 3.2 l'expose (lecture seule, returns `ProProfileSnapshot` shape AC3) — pattern internal endpoint Story 2.4 réutilisé
   - **Caching MVP** : 60s in-memory cache (read-mostly, slightly stale acceptable for FR30 auto-publish criteria — admin reports rare events)
   - Tests integration mock axios + identity-svc testcontainer

9. **AC9 — NATS event schemas `@tukio/contracts`** : Given Story 0.2 contracts package, When je consulte `packages/contracts/src/events/catalog/`, Then :
   - **NEW event schemas** :
     - `listing-created.v1.{schema.json,ts}` — payload `{ listingId, proProfileId, categoryId, slug, title: { fr, en? }, status: 'draft', createdAt }`
     - `listing-updated.v1.{schema.json,ts}` — payload `{ listingId, proProfileId, fieldsChanged: string[], updatedAt }`
     - `listing-unpublished.v1.{schema.json,ts}` — payload `{ listingId, proProfileId, unpublishedAt, reason: 'pro-action'|'admin-action' }`
     - `listing-deleted.v1.{schema.json,ts}` — payload `{ listingId, proProfileId, deletedAt }`
   - **NB** : `catalog.listing.published.v1` schema already livré Story 2.6 AC2 (forward Story 3.5) — Story 3.2 réutilise tel quel
   - Tests ajv schema validation

10. **AC10 — Lint boundaries strict + tests + commit** :
    - **Lint boundaries** : `pnpm --filter=catalog-svc lint` 0 violations sur `apps/catalog-svc/src/domain/**` (NO imports `@nestjs/*`, `typeorm`, `axios`, `meilisearch`, `@aws-sdk/*`, `cloudflare`, `nanoid` à la rigueur OK car pure JS)
    - **Coverage thresholds** : ≥ 95 % aggregate + VOs + service + ≥ 90 % use cases + ≥ 80 % infra (NFR71)
    - **Tests aggregate exhaustifs** : 40+ cases (state machine all transitions allowed + forbidden + each invariant)
    - **Tests integration testcontainer** : 8 repository scenarios + 6 migration scenarios
    - **Documentation** : update `docs/project-context.md` section "Catalog Domain (Story 3.2)" + handoff stories 3.3-3.12
    - **Commit** `feat(catalog): Story 3.2 catalog-svc Pretre Listing aggregate + 6 VOs + 8 use cases + ListingPublicationService + IProProfileClient + DB tables listing/translations/photo + lint boundaries strict`

## Tasks / Subtasks

- [ ] **Task 1 — `@tukio/contracts` event schemas catalog** (AC: #9)
  - [ ] 1.1-1.4 — 4 event schemas (listing-created, listing-updated, listing-unpublished, listing-deleted)
  - [ ] 1.5 — Tests ajv
- [ ] **Task 2 — Domain value-objects (6)** (AC: #2) — coverage ≥ 95 %
  - [ ] 2.1 — `title-multilang.vo.ts` + spec
  - [ ] 2.2 — `description-multilang.vo.ts` + spec
  - [ ] 2.3 — `pricing.vo.ts` (discriminated union) + spec
  - [ ] 2.4 — `service-area.vo.ts` + spec
  - [ ] 2.5 — `photo.vo.ts` + spec
  - [ ] 2.6 — `slug.vo.ts` + factory `fromTitle` + slugify lib install
- [ ] **Task 3 — Domain `Listing` aggregate root + state machine** (AC: #1) — coverage ≥ 95 %
  - [ ] 3.1 — `listing.aggregate.ts` (factory + 10 domain methods + canTransitionStatusTo)
  - [ ] 3.2 — Tests aggregate exhaustifs 30+ cases
- [ ] **Task 4 — Domain ports (6) + exceptions (3)** (AC: #3)
  - [ ] 4.1 — 6 ports interfaces
  - [ ] 4.2 — `IProProfileClient` port + `ProProfileSnapshot` type
  - [ ] 4.3 — 3 exceptions
  - [ ] 4.4 — Tests serialization
- [ ] **Task 5 — `ListingPublicationService`** (AC: #4) — coverage ≥ 95 %
  - [ ] 5.1 — Service implementation (shouldAutoPublish + computePriceDeviation)
  - [ ] 5.2 — Tests unit 8 scenarios
- [ ] **Task 6 — DB migration listing tables + indexes + trigger** (AC: #5)
  - [ ] 6.1 — Migration `1715310000000-CreateListingTables.ts` (3 tables + 5 indexes + 1 trigger)
  - [ ] 6.2 — Tests integration testcontainer 6 scenarios
- [ ] **Task 7 — TypeORM entities + repository + mapper** (AC: #6) — coverage ≥ 80 %
  - [ ] 7.1 — Entities ORM 3 (listing, listing-translation, listing-photo)
  - [ ] 7.2 — Repository `listing.typeorm.repository.ts` 6 méthodes
  - [ ] 7.3 — Mapper toDomain/toEntity (VOs ↔ JSONB)
  - [ ] 7.4 — Tests integration testcontainer 8 scenarios CRUD + cursor pagination + cascade
- [ ] **Task 8 — 8 use cases** (AC: #7) — coverage ≥ 90 %
  - [ ] 8.1 — `create-listing.usecase.ts` + spec (full)
  - [ ] 8.2 — `update-listing.usecase.ts` + spec (full)
  - [ ] 8.3 — `publish-listing.usecase.ts` + spec (skeleton MVP — Story 3.5 finalise)
  - [ ] 8.4 — `unpublish-listing.usecase.ts` + spec (full)
  - [ ] 8.5 — `delete-listing.usecase.ts` + spec (full)
  - [ ] 8.6 — `get-listing-detail.usecase.ts` + spec (full + locale fallback)
  - [ ] 8.7 — `list-pro-listings.usecase.ts` + spec (full + cursor pagination)
  - [ ] 8.8 — `compute-median-price.usecase.ts` + spec (skeleton — Story 3.5 finalise)
  - [ ] 8.9 — Wire usecases-proxy.module.ts + Symbol DI tokens
- [ ] **Task 9 — `IProProfileClient` impl + identity-svc internal endpoint** (AC: #8)
  - [ ] 9.1 — `identity-svc-client.service.ts` axios + caching 60s
  - [ ] 9.2 — Verify identity-svc `/internal/pros/by-id/:id` endpoint exists (Story 1.10) — UPDATE if missing
  - [ ] 9.3 — Tests integration mock axios + testcontainer
- [ ] **Task 10 — Lint boundaries enforce + coverage CI + commit** (AC: #10)
  - [ ] 10.1 — eslint-plugin-boundaries rules verify domain/ pure
  - [ ] 10.2 — CI workflow assert lint 0 violations
  - [ ] 10.3 — Update `docs/project-context.md` section catalog
  - [ ] 10.4 — Commit `feat(catalog): Story 3.2 Listing aggregate + VOs + use cases`

## Dev Notes

### Pourquoi Story 3.2 = pierre angulaire backend Epic 3

Story 3.1 a livré la **taxonomie** (catégories + types). Story 3.2 livre le **cœur métier** : `Listing` aggregate avec son state machine + value-objects + use cases. Toutes les Stories 3.3-3.12 consomment ce domain. Pattern complet **aggregate root with state machine + multi-VO + multi-port + domain service for cross-cutting orchestration** réutilisé Stories Epic 4 (Booking saga aggregate FR47), Stories Epic 5 (Conversation/Message aggregates), Stories 10.x V1 (Dispute aggregate state machine FR87), Stories 12.x V1 (Review multi-criteria aggregate FR76).

### Décisions techniques majeures actées

1. **Pricing JSONB embedded** (vs separate table `listing_pricing`) — discriminated union {unit | package} + accès single query. Indexable via `(pricing->>'mode')` partial index. Évite JOIN.
2. **ServiceArea JSONB embedded** — same rationale (3 fields, accès atomique avec listing).
3. **`listing_translations` séparée** (vs JSONB column on listing) — pattern Story 3.1 cohérent (JOIN per locale + indexable per locale + scalable V1+).
4. **`listing_photo` séparée** (1:N) — collection grow up to 15, sort_order changes via PATCH reorder, soft-delete cascadé independently.
5. **Slug unique global** (vs scoped per category) — UX URLs `/fr/services/{slug}` simple. 6-char nanoid suffix anti-collision (`Slug.fromTitle('Chapiteau 6m', true)` → `chapiteau-6m-x7k9q2`).
6. **State machine status enum** : `draft → pending_moderation → published → unpublished` (+ rollback paths). Approved by Story 6.2 admin moderation. Auto-publish gating Story 3.5 + ListingPublicationService.
7. **`IProProfileClient` port** (vs direct DB query — cross-svc boundary) — DDD bounded contexts + scalability (catalog-svc et identity-svc séparables in-app/in-K8s).
8. **`shouldAutoPublish` logic in domain service** (vs use case) — re-utilisable Story 3.5 + Story 3.6 (re-publish edit) + future stories 6.x admin override.
9. **6 ports** (vs 1 mega port) — Pretre dependency inversion strict. Each port has narrow responsibility.
10. **Use cases full vs skeleton scope explicit** — Story 3.2 livre les 8 ; Stories 3.5 finalise 2 (publish-listing + compute-median-price). Permet split scope clair sans bloquer Stories 3.3 wizard frontend qui peut consumer create-listing dès Story 3.2.
11. **JSONB cf check constraint** — minimal validation au DB level (laissé au domain VO invariants stricts). Avoids over-engineering DB checks for nested JSON.
12. **Trigger `listing_updated_at`** Story 1.10 réutilisé — auto-update updated_at on UPDATE (DRY).
13. **Lint boundaries strict** — domain pure no I/O. Catch dev mistakes early in CI.
14. **EN strict + i18n + Pretre + envelope ADR-014 + latest stable versions** memories.

### Versions à utiliser

| Lib | Usage | Version | Notes |
|-----|-------|---------|-------|
| `slugify` | Slug.fromTitle ASCII transliterate | latest stable v1.6+ | Pure JS no deps. Already widely used. |
| `nanoid` | Slug random suffix anti-collision | latest stable v5+ | Crypto-secure, URL-safe, ~21 chars but configurable. Story 3.2 uses 6-char alphabet `0-9a-z` |
| `decimal.js` | Money.amountCents arithmetic if needed | latest stable v10+ | Pour median calculations Story 3.5 V1+ — MVP int64 sufficient |

(Autres libs réutilisées Stories 0.x/1.x/2.x : NestJS 11, TypeORM, Zod, axios, pino, Vitest)

### Project Structure cible

```
packages/contracts/src/events/catalog/
├─ listing-created.v1.{schema.json,ts}                            # NEW Story 3.2
├─ listing-updated.v1.{schema.json,ts}                            # NEW Story 3.2
├─ listing-unpublished.v1.{schema.json,ts}                        # NEW Story 3.2
├─ listing-deleted.v1.{schema.json,ts}                            # NEW Story 3.2
└─ listing-published.v1.{schema.json,ts}                          # Story 2.6 livré (forward Story 3.5) — réutilisé

apps/catalog-svc/src/
├─ domain/
│  ├─ model/
│  │  ├─ listing.aggregate.ts                                     # NEW Story 3.2 (AGGREGATE ROOT)
│  │  ├─ category.entity.ts                                       # Story 3.1 livré (réutilisé)
│  │  ├─ service-type.entity.ts                                   # Story 3.1 livré
│  │  └─ value-objects/
│  │     ├─ title-multilang.vo.ts + spec                          # NEW
│  │     ├─ description-multilang.vo.ts + spec                    # NEW
│  │     ├─ pricing.vo.ts + spec                                  # NEW
│  │     ├─ service-area.vo.ts + spec                             # NEW
│  │     ├─ photo.vo.ts + spec                                    # NEW
│  │     ├─ slug.vo.ts + spec                                     # NEW
│  │     └─ money.vo.ts                                           # NEW (used by Pricing)
│  ├─ ports/
│  │  ├─ listing-repository.port.ts                               # NEW
│  │  ├─ category-repository.port.ts                              # Story 3.1 livré
│  │  ├─ search-indexer.port.ts                                   # NEW (Story 3.7 implements)
│  │  ├─ photo-storage.port.ts                                    # NEW (Story 3.4 implements)
│  │  ├─ event-publisher.port.ts                                  # Story 0.7 livré
│  │  ├─ median-price-calculator.port.ts                          # NEW (Story 3.5 implements)
│  │  └─ pro-profile-client.port.ts                               # NEW Story 3.2
│  ├─ service/
│  │  └─ listing-publication.service.ts + spec                    # NEW Story 3.2 (FR30 auto-publish + FR32 deviation)
│  └─ exception/
│     ├─ catalog-validation.exception.ts                          # NEW
│     ├─ listing-status-invalid-transition.exception.ts           # NEW
│     └─ listing-not-found.exception.ts                           # NEW
├─ usecases/
│  ├─ create-listing.usecase.ts + spec                            # NEW (full)
│  ├─ update-listing.usecase.ts + spec                            # NEW (full)
│  ├─ publish-listing.usecase.ts + spec                           # NEW (skeleton MVP — Story 3.5 finalise)
│  ├─ unpublish-listing.usecase.ts + spec                         # NEW (full)
│  ├─ delete-listing.usecase.ts + spec                            # NEW (full)
│  ├─ get-listing-detail.usecase.ts + spec                        # NEW (full + locale fallback)
│  ├─ list-pro-listings.usecase.ts + spec                         # NEW (full + cursor pagination)
│  └─ compute-median-price.usecase.ts + spec                      # NEW (skeleton — Story 3.5 finalise)
├─ usecases-proxy/usecases-proxy.module.ts                        # UPDATE Story 3.1 — add 8 use cases + DI tokens
├─ infrastructure/
│  ├─ persistence/typeorm/
│  │  ├─ entities/
│  │  │  ├─ listing.entity.ts                                     # NEW
│  │  │  ├─ listing-translation.entity.ts                         # NEW
│  │  │  └─ listing-photo.entity.ts                               # NEW
│  │  ├─ repositories/listing.typeorm.repository.ts               # NEW
│  │  ├─ mappers/listing.mapper.ts                                # NEW (toDomain/toEntity)
│  │  └─ migrations/1715310000000-CreateListingTables.ts          # NEW
│  └─ external/
│     └─ identity-svc/identity-svc-client.service.ts              # NEW Story 3.2 (implements IProProfileClient)

apps/identity-svc/src/infrastructure/http/controllers/
└─ internal-pros.controller.ts                                    # UPDATE Story 1.10 (verify endpoint /internal/pros/by-id/:id exists, ELSE create)

apps/catalog-svc/test/
├─ aggregate/
│  ├─ listing.spec.ts                                             # NEW (30+ tests)
│  └─ value-objects/{title,description,pricing,service-area,photo,slug,money}.spec.ts  # NEW
├─ service/listing-publication.service.spec.ts                    # NEW
├─ usecases/{8 use cases}.spec.ts                                 # NEW
├─ integration/
│  ├─ listing-repo.spec.ts                                        # NEW (testcontainer 8 scenarios)
│  ├─ migration-listing.spec.ts                                   # NEW (testcontainer 6 scenarios)
│  └─ identity-svc-client.spec.ts                                 # NEW
└─ jest.config.ts

# Estimation : ~50 nouveaux + ~5 updates = ~55 fichiers
```

### Critical Architecture Constraints

> Cf. Stories 0.2 (`@tukio/contracts` DTOs + events), 0.6 (Pretre + replicate script + boundaries lint), 0.7 (outbox/inbox), 0.10 (docker-compose), 1.2 (gateway-api), 1.3 (TypeORM repo + soft-delete), 1.10 (internal endpoint pattern + audit_log + IKeycloakClient), 2.1 (forwarder pattern + outbox), 2.3 (cursor pagination), 2.5 (state machine canTransitionTo + tukio_status='active' enum confirmed), 3.1 (catalog-svc Pretre baseline scaffolding + category + service_type entities + IProProfileClient pattern reference). Architecture lines 2120-2164 Pretre + ADR-007 outbox + ADR-014 envelope.

1. **Pretre architecture stricte** — domain pure (no I/O imports). Eslint-plugin-boundaries enforce.
2. **Transactional outbox ADR-007** — use cases publish events in single transaction.
3. **API responses envelope ADR-014** — exceptions mapped to envelope error response (gateway-api forwarder).
4. **EN strict couche tech** + **i18n FR/EN** (translations table) + **RGAA AA** memories.
5. **Cursor pagination canonical** Story 2.3 réutilisé pour `findByProProfileId`.
6. **Soft-delete pattern** Story 1.3 réutilisé.
7. **Latest stable versions** memory.
8. **State machine explicit `canTransitionStatusTo`** — Story 2.5 pattern réutilisé.

### Previous Story Intelligence

**Story 0.2 (`@tukio/contracts`)** : envelope types + Zod base. Story 3.2 ajoute 4 event schemas catalog.

**Story 0.6 (Pretre scaffolding)** : eslint-plugin-boundaries rules. Story 3.2 lint enforce strict.

**Story 0.7 (Outbox/inbox)** : pattern `IEventPublisher` réutilisé.

**Story 1.3 (Pro registration)** : TypeORM repository pattern + soft-delete + cascade pattern réutilisé.

**Story 1.10 (Pretre consolidation)** : `/internal/pros/by-id/:id` endpoint référencé. Story 3.2 vérifie existence + UPDATE si manquant. Pattern internal endpoint réutilisé.

**Story 2.5 (state machine kyc_status + tukio_status)** : pattern `canTransitionStatusTo` privé dans aggregate. Story 3.2 réutilise pour `listing.status` 4 états.

**Story 2.6 (event `catalog.listing.published.v1` schema)** : déjà publié dans `@tukio/contracts/events/catalog/listing-published.v1.{schema.json,ts}`. Story 3.2 réutilise tel quel + ajoute 4 events siblings.

**Story 3.1 (catalog-svc baseline)** : scaffolding Pretre + outbox/inbox tables + category/service_type tables + `ICategoryRepository`. Story 3.2 étend dans le même service. **Pas de modification Story 3.1** — Story 3.2 ajoute Listing tables séparément.

### What this story does NOT do

- ❌ **Pro create listing wizard frontend** → Story 3.3 (consume `create-listing.usecase` + `update-listing.usecase`)
- ❌ **Photo upload pipeline R2 + Cloudflare Images** → Story 3.4 (implement `IPhotoStorage` port livré Story 3.2 + media-svc scaffolding)
- ❌ **Listing publish auto-publish + median price compute** finalisation → Story 3.5 (Story 3.2 livre skeleton + service)
- ❌ **Listing edit/unpublish/delete UI** → Story 3.6 (consume use cases livrés full)
- ❌ **Meilisearch indexer outbox-driven sync** → Story 3.7 (implement `ISearchIndexer` port livré Story 3.2)
- ❌ **Search frontend barre recherche** → Story 3.8
- ❌ **Filters facettes search results** → Story 3.9
- ❌ **Listing detail public page** → Story 3.10 (consume `get-listing-detail.usecase`)
- ❌ **Pro public profile page** → Story 3.11
- ❌ **Page catégorie générale + median display** → Story 3.12
- ❌ **gateway-api endpoints `/v1/listings`** — Story 3.2 livre uniquement domain + use cases. Stories 3.3 (POST /v1/listings draft), 3.5 (POST /v1/listings/:id/publish), 3.6 (PATCH/DELETE) wirent gateway-api endpoints + forwarders.
- ❌ **Admin moderation queue** → Story 6.2 (consume `listing.status='pending_moderation'` + `approveModeration()`/`rejectModeration()` méthodes livrées Story 3.2)
- ❌ **Listing reports system** → Story 6.4 (consume `incrementReportsCount()` méthode Story 3.2)
- ❌ **DeepL auto-translate FR → EN missing** → V1+ FR101

### Files to UPDATE vs CREATE

(Cf. Project Structure cible — annoté UPDATE/NEW)

### Testing Standards

- Coverage ≥ 95 % aggregate Listing + 6 VOs + ListingPublicationService — NFR71 strict (state machine critical)
- Coverage ≥ 90 % use cases (8)
- Coverage ≥ 80 % infrastructure repo + mapper + identity-svc-client
- Tests aggregate exhaustifs ≥ 30 cases (state machine all transitions allowed/forbidden + invariants)
- Tests integration testcontainer Postgres : 6 migration scenarios + 8 repository scenarios
- Tests integration mock identity-svc client (axios)
- **Lint boundaries** : `pnpm --filter=catalog-svc lint` 0 violations (CI assert)
- **Test failure case** : créer temporairement `domain/test-violation.ts` avec `import { Repository } from 'typeorm'` → `pnpm lint` fail clear → SUPPRIMER (no commit)

### Project Structure Notes

✅ **Aligné architecture, PRD §FR23 (catalog data model — listing partie), §FR25 (pricing unit/package MVP), §FR26 (service area), §FR99 (FR obligatoire), §NFR71 (coverage), §NFR50 (a11y altText), Stories 0.2/0.6/0.7/1.3/1.10/2.5/2.6/3.1, memories.**

⚠️ **Décision** : Pricing + ServiceArea JSONB embedded (vs separate tables) — atomic + indexable.
⚠️ **Décision** : `listing_translations` séparée (vs JSONB) — pattern Story 3.1 cohérent.
⚠️ **Décision** : Slug unique global + 6-char nanoid suffix anti-collision.
⚠️ **Décision** : State machine 4 états + canTransitionStatusTo Story 2.5 pattern réutilisé.
⚠️ **Décision** : `IProProfileClient` port + cross-svc boundary — DDD bounded contexts.
⚠️ **Décision** : `shouldAutoPublish` in domain service (vs use case) — réutilisable.
⚠️ **Décision** : 6 ports (vs 1 mega port) — narrow responsibility Pretre.
⚠️ **Décision** : Skeleton scope explicit `publish-listing` + `compute-median-price` → Story 3.5 finalise.
⚠️ **Décision** : Trigger `listing_updated_at` Story 1.10 réutilisé.
⚠️ **Décision** : Lint boundaries strict CI assert — domain pure NO I/O imports.

### References

- [Source: epics.md#Epic-3-Story-3.2 — Lines 1407-1421]
- [Source: prd.md#FR23 (catalog data model), #FR25 (pricing), #FR26 (service area), #FR30 (auto-publish), #FR32 (price deviation soft-warning), #FR99 (FR obligatoire), #FR103 (i18n), #NFR50 (a11y), #NFR58 (URLs EN), #NFR71 (coverage)]
- [Source: architecture.md — ADR-007 outbox, ADR-014 envelope, Pretre boundaries lines 2120-2164, EN strict line 158, soft-delete line 264]
- [Source: Stories 0.2 (contracts), 0.6 (Pretre + boundaries lint), 0.7 (outbox), 1.3 (TypeORM repo + soft-delete + cascade), 1.10 (internal endpoint pattern + IKeycloakClient), 2.5 (state machine canTransitionTo pattern + tukio_status='active' enum), 2.6 (catalog.listing.published.v1 event schema livré), 3.1 (catalog-svc baseline + ICategoryRepository + IProProfileClient pattern reference)]
- [Memory: feedback_clean_architecture_explicit.md, feedback_api_envelope_response.md, feedback_tech_layer_english.md, feedback_i18n_frontend.md, feedback_latest_versions.md]

## Dev Agent Record

### Agent Model Used

(à remplir par dev agent : modèle + version)

### Debug Log References

### Completion Notes List

(à remplir à la fin — résumé décisions, déviations vs Dev Notes avec justification, points d'attention pour Story 3.3 (wizard frontend consume `create-listing` + `update-listing` use cases via gateway-api endpoints à wirer Story 3.3), Story 3.4 (photo upload — implement `IPhotoStorage` port livré Story 3.2 + media-svc scaffolding), Story 3.5 (publish workflow — finalise `publish-listing.usecase` skeleton + `compute-median-price.usecase` skeleton + cron compute-medians), Story 3.6 (edit/unpublish/delete — consume `update-listing` + `unpublish-listing` + `delete-listing` use cases full), Story 3.7 (Meilisearch indexer — implement `ISearchIndexer` port + subscribe `catalog.listing.*` events outbox), Story 3.10 (listing detail public — consume `get-listing-detail.usecase` full), Story 3.11 (pro public profile — consume `list-pro-listings.usecase` filtered status='published'), Story 6.2 (admin moderation — consume `pending_moderation` status + `approveModeration()`/`rejectModeration()` méthodes), Story 6.4 (reports — consume `incrementReportsCount()`))

### File List

(à remplir au fil de l'implémentation par le dev agent)

---

## Story Completion Status

- **Story Status** : `ready-for-dev`
- **Created** : 2026-05-09
- **Created by** : `bmad-create-story` workflow
- **Epic** : Epic 3 — Catalog Publication & Discovery (MVP)
- **Sprint cible** : Sprint 4 (2ᵉ story Epic 3 après 3.1 foundation)
- **Estimation effort** : 5-7 jours (1 dev senior — story backbone backend complète : aggregate + 6 VOs + 8 use cases + DB tables + repo + identity-svc client + tests exhaustifs, ~55 fichiers, lint boundaries strict, coverage ≥ 95% aggregate critical)
- **Dépendances upstream** : Stories 0.2 (contracts events), 0.6 (Pretre + boundaries lint), 0.7 (outbox + IEventPublisher), 0.10 (docker-compose tukio_catalog DB), 1.2 (gateway-api forwarder pattern reference), 1.3 (TypeORM repo + soft-delete + cascade), 1.10 (`/internal/pros/by-id/:id` endpoint), 2.5 (state machine canTransitionTo pattern + tukio_status='active' enum), 2.6 (catalog.listing.published.v1 event schema déjà livré), 3.1 (catalog-svc baseline + category + service_type tables + ICategoryRepository)
- **Dépendances downstream** :
  - Story 3.3 (wizard frontend) — consume `create-listing` + `update-listing` use cases via gateway endpoints à wirer
  - Story 3.4 (photo upload pipeline) — implement `IPhotoStorage` port livré Story 3.2 + media-svc scaffolding
  - Story 3.5 (publish workflow) — finalise `publish-listing.usecase` skeleton + `compute-median-price.usecase` skeleton + cron
  - Story 3.6 (edit/unpublish/delete) — consume use cases full
  - Story 3.7 (Meilisearch indexer) — implement `ISearchIndexer` port + subscribe events outbox
  - Story 3.10 (listing detail) — consume `get-listing-detail.usecase`
  - Story 3.11 (pro public profile) — consume `list-pro-listings.usecase` filtered
  - Story 3.12 (page catégorie générale) — utilise category data Story 3.1 + listings count Story 3.2
  - Story 6.2 (admin moderation queue) — consume `pending_moderation` status + méthodes
  - Story 6.4 (reports) — consume `incrementReportsCount()`
- **FRs covered** :
  - **FR23** ✅ catalog data model — Listing aggregate + photos + Pricing + ServiceArea
  - **FR25** ✅ pricing unit/package MVP via Pricing VO discriminated union
  - **FR26** ✅ service area via ServiceArea VO (originPostalCode + radius + leadTime)
  - **FR99** ✅ FR obligatoire enforced via TitleMultilang + DescriptionMultilang VO invariants
  - **FR30 partial** ✅ auto-publish criteria via ListingPublicationService (Story 3.5 wire complet)
  - **FR32 partial** ✅ price deviation soft-warning via ListingPublicationService (Story 3.5 wire complet)
- **NFRs touchés** :
  - **NFR50** ✅ a11y altText sur Photo VO
  - **NFR71** ✅ coverage ≥ 95 % aggregate + VOs + ≥ 90 % use cases + ≥ 80 % infra
  - **NFR58** ✅ URLs EN strict via Slug VO regex
  - **NFR60** ✅ locale fallback FR via TitleMultilang.getFor (mirror Story 3.1 pattern)

> **Prochaine story → Story 3.3** (Pro create listing wizard frontend multi-step — consume `create-listing` + `update-listing` use cases Story 3.2 via gateway-api endpoints à wirer)

---

**Dev agent next steps :**
1. Lire ce file complètement
2. Vérifier upstream Stories 0.2, 0.6, 0.7, 0.10, 1.2, 1.3, 1.10, 2.5, 2.6, 3.1 implémentées
3. Implémenter Tasks 1-10 dans l'ordre (events Task 1 → VOs Task 2 → aggregate Task 3 → ports/exceptions Task 4 → service Task 5 → migration Task 6 → repo+mapper Task 7 → use cases Task 8 → identity-svc client Task 9 → lint+coverage+commit Task 10)
4. Lancer `pnpm vitest --filter=catalog-svc test/aggregate` après chaque jalon (state machine critical) + `pnpm test:integration --filter=catalog-svc` après Task 7
5. Commit Story 3.2 quand : 30+/30+ aggregate tests + 6/6 VOs tests ≥ 95% + 8/8 use cases ≥ 90% + 8/8 repo integration + 6/6 migration testcontainer + 0 violations boundaries CI + identity-svc client tests
6. Update sprint-status : `3-2-...: review` puis `done`
