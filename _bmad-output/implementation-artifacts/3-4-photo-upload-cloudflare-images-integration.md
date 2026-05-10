# Story 3.4: Photo upload + Cloudflare Images integration (media-svc + signed PUT URL R2 + R2→CF Images pipeline)

Status: ready-for-dev

## Story

**As a** Pro `verified` (sortant Story 3.3 wizard step 2 Photos OU Story 3.6 edit listing),
**I want** **uploader 3-15 photos** avec **resize automatique + conversion WebP/AVIF + delivery via CDN Cloudflare** depuis le wizard listing — Story 3.3 a livré le **contrat UX** (`<FileUpload>` Story 0.5 + `<PhotoGrid>` drag&drop reorder + altText inline + `useUploadPhoto` hook MOCK pipeline). Story 3.4 livre maintenant la **pipeline réelle production-ready** : (1) **scaffolding media-svc Pretre** (5ᵉ service Pretre via `replicate-pretre-structure.sh --target=media-svc` Story 0.6) — port `4009` cohérent docker-compose Story 0.10 ; (2) **DB tukio_media** avec table `media` (NEW Story 3.4 — pattern aligned with Story 3.2 catalog-svc.listing_photo qui référence ces media par `cloudflare_image_id` + `r2_key`) ; (3) **Domain `Media` aggregate** (média entity cross-service réutilisable Stories Epic 4 attachments + Stories Epic 12 V1 booking modification file attachments + Stories Epic 5 messaging attachments V1+) ; (4) **2 ports backend** `IR2Storage` (signed PUT URL TTL 5 min + DELETE soft-delete + signed READ URL TTL 1h pour CF Images upload-from-URL) + `ICloudflareImagesService` (upload-from-URL via `cf.images.upload({ url: r2SignedReadUrl, requireSignedURLs: false, metadata })` + variant URLs gen + DELETE) ; (5) **3 endpoints gateway-api** consumed par Story 3.3 frontend remplaçant MOCK :
  - `POST /v1/listings/photos/upload-url` → media-svc `generate-signed-upload-url.usecase.ts` génère R2 signed PUT URL `tukio-media-listings/temp/{photoTempId}/{nanoidR2Key}.{ext}` TTL 5 min + persist `media` row status='pending' + returns `{ uploadUrl, r2Key, photoTempId }`. Frontend PUT directement sur R2 (zéro charge backend Tukio — economie cost + scalability)
  - `POST /v1/listings/photos/finalize` body `{ r2Key, photoTempId, listingId? }` → media-svc `finalize-photo-upload.usecase.ts` génère R2 signed READ URL TTL 1h + appelle `cloudflare.images.upload({ url: r2SignedReadUrl, metadata: { listingId, proProfileId, photoTempId } })` → persiste `media` row status='ready' + `cloudflare_image_id` + `variants: ['thumbnail', 'card', 'detail']` (3 variants Cloudflare Images standards configured account-level) + retourne `{ photoId, urls: { thumbnail, card, detail }, altText: null }` → consumed Story 3.3 wizard pour ajouter dans `<PhotoGrid>` + binding au listing draft via Story 3.2 `Listing.addPhoto()` use case (frontend Story 3.3 wire `PATCH /v1/listings/:id` adding photo to listing.photos array)
  - `DELETE /v1/listings/photos/:photoId` → media-svc `soft-delete-photo.usecase.ts` (soft-delete + outbox publish `media.photo.deleted.v1`) — Story 3.4 cron 7j post-delete purge R2 + CF Images
- (6) **Cron `purge-soft-deleted-photos.task.ts`** (`@nestjs/schedule` `@Cron('0 3 * * *')` 3am UTC daily — pattern Stories 1.9/2.6 réutilisé) qui détecte `media WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '7 days'` → pour chaque batch (LIMIT 1000) : (a) `cloudflareImages.delete(cloudflareImageId)`, (b) `r2Storage.deleteObject(bucket, r2Key)`, (c) hard DELETE `media` row (post-purge, retention compliance NFR1 RGPD + audit_log capture deletion event Story 2.7) ;
- (7) **NATS events** : `media.photo.uploaded.v1` (NEW Story 3.4 — payload `{ photoId, r2Key, cloudflareImageId, listingId?, proProfileId, mimeType, sizeBytes, variants, uploadedAt }`) consumed Story 3.7 future Meilisearch indexer (photo metadata for search results) + Story 3.10 future listing detail public page (preload `<picture>` srcset). `media.photo.deleted.v1` (NEW Story 3.4 — payload `{ photoId, r2Key, cloudflareImageId, listingId?, deletedAt }`) consumed Story 3.7 indexer remove + audit_log Story 2.7 ;
- (8) **NFR15 chiffrement at-rest R2** : bucket `tukio-media-listings` server-side encryption AES-256 (réutilise pattern Story 1.3 KYC bucket + Story 2.7 audit-archive bucket) ; **lifecycle policy** R2 : objects `temp/*` auto-expire 24h (anti-orphan si frontend PUT R2 succeed mais Story 3.4 finalize endpoint never called — e.g., Pro abandons wizard step 2) — pattern protection coût ;
- (9) **Cloudflare Images variants account-level config** : Story 3.4 documente les 3 variants à configurer une fois côté Cloudflare Dashboard `Images > Variants` (NOT in code — config infra) :
  - `thumbnail` : 200×200 fit=cover, q=80, f=auto (WebP/AVIF/JPG fallback browser-negotiated)
  - `card` : 600×400 fit=cover, q=85, f=auto (search results card display)
  - `detail` : 1600×1200 fit=scale-down, q=90, f=auto (listing detail hero photo + carousel)
  - **NB** : Cloudflare Images `f=auto` négocie WebP/AVIF/JPG selon `Accept` header browser → garantit NFR3 LCP < 2.5s ;
- (10) **Frontend Story 3.3 update** : `useUploadPhoto` hook MOCK Story 3.3 → **REPLACE par implementation réelle** :
```ts
export const useUploadPhoto = () => useMutation({
  mutationFn: async (file: File) => {
    // 1. Get signed PUT URL
    const { uploadUrl, r2Key, photoTempId } = await apiClient.post('/v1/listings/photos/upload-url', { mimeType: file.type, sizeBytes: file.size });
    // 2. PUT directement sur R2 (no backend bandwidth)
    await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
    // 3. Finalize : R2 → CF Images upload + persist media row
    const { photoId, urls, altText } = await apiClient.post('/v1/listings/photos/finalize', { r2Key, photoTempId });
    return { photoId, urls, r2Key, cloudflareImageId: photoId, altText };
  },
  // Optimistic UI update via TanStack Query setQueryData
});
```
- (11) **Sécurité** : (a) **Magic bytes validation** côté Cloudflare Images natif (rejette PHP/JS renommés en .jpg) → Story 3.4 catch error `cloudflareImages.upload throws InvalidImageFormatError` → return 422 enveloppe `MEDIA-INVALID-FILE-001` "Format d'image invalide" ; (b) **MIME type whitelist** côté upload-url endpoint : `accept: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic'` (cohérent Story 3.3 frontend validation) — endpoint reject autres MIME types 422 `MEDIA-INVALID-MIME-001` ; (c) **Size limit** : 10 MB max par file (cohérent Story 3.3 frontend) — R2 signed PUT URL configured avec `Content-Length-Range: 1, 10485760` strict ; (d) **Rate limiting** : 30 uploads/hour/proProfileId (anti-abuse — un Pro normal upload max 15 photos × max 5 listings/jour = 75/jour, 30/h cap raisonnable). Throttle gateway endpoint `POST /v1/listings/photos/upload-url`. ; (e) **NFR16 PII redaction** : log uploads avec `proProfileId, listingId?, r2Key, sizeBytes, mimeType, ipAddress` — JAMAIS le contenu du fichier ni signed URL complet (token sensitive) ;
- (12) **Métriques + alerts Prom** : `tukio_media_uploads_total{result, mime_type}` (counter), `tukio_media_upload_duration_seconds` (histogram p50/p90/p99), `tukio_media_cf_images_api_errors_total{error_type}` (counter — alert > 10/min), `tukio_media_r2_signed_urls_generated_total{type}` (counter — type='put'|'get'), `tukio_media_purged_photos_total` (counter daily), `tukio_media_orphan_temp_objects_count` (gauge — temp objects R2 > 24h count, doit rester ~0 grâce à lifecycle policy) ; alert `MediaCloudflareImagesAPIDown` `rate(tukio_media_cf_images_api_errors_total[5m]) > 0.5/sec for 2m` → Slack `#tukio-alerts-ops` (CF Images SLA breach impacte Pro UX) ; alert `MediaUploadFailureRateHigh` `rate(tukio_media_uploads_total{result='failure'}[10m]) > 5%` for 5m → Slack ;

**so that** Marc Pro (P1 persona Tukio J3 Step 2 wizard) drag-drop 5 photos → frontend Story 3.3 wire chaque file → mutation `useUploadPhoto` (replaced Story 3.4 MOCK par REAL pipeline) → 3 calls : (1) PUT signed URL R2 zero backend bandwidth (~500ms), (2) finalize R2→CF Images (~800ms), (3) PATCH listing photos array (~200ms) → photo apparaît dans `<PhotoGrid>` avec urls thumbnail/card/detail Cloudflare CDN ; un Visitor consulte fiche service Story 3.10 future → 1ère photo `<picture>` WebP/AVIF/JPG fallback `srcset` lazy-load → LCP < 2.5s NFR3 ; un Pro retire une photo → DELETE soft-delete + 7 jours plus tard cron purge R2 + CF Images + audit_log capture ; un Pro abandonne wizard step 2 → R2 lifecycle policy auto-expire `temp/*` 24h → no cost waste ; un attacker upload PHP renommé .jpg → Cloudflare Images magic bytes reject → 422 enveloppe ; le **pattern complet "signed PUT URL R2 client-side direct + finalize R2→CF Images backend + variants account-level + soft-delete cron purge"** devient template Stories Epic 4 V1 (booking modification file attachments FR70), Stories Epic 5 V1 (messaging file attachments), Stories Epic 12 V1 (review photos multi-attachments).

> **Outcome attendu** : à la fin de cette story, **media-svc est scaffoldé Pretre** (5ᵉ service Pretre after identity-svc/gateway-api/payment-svc/catalog-svc — port 4009 docker-compose) ; `pnpm seed:media-buckets` (NEW alias) appelle script provisioning R2 buckets `tukio-media-listings` (server-side encryption AES-256 + lifecycle 24h temp/*) + Cloudflare Images variants `thumbnail` + `card` + `detail` (config dashboard manuelle documentée runbook) ; un dev frontend Story 3.3 consume `useUploadPhoto` réel : PUT R2 signed URL + finalize → photo upload pipeline complete < 2s p90 ; un test `pnpm playwright test --grep "photo upload"` passe FR/EN axe-core 0 violations 10 scénarios (happy upload 5 photos FR + EN, upload reject MIME image/gif → 422, upload size > 10MB → 422 + UI error, finalize 2x same r2Key idempotent, malicious PHP renamed .jpg → CF Images reject 422, alt text save, drag&drop reorder PATCH, delete photo + cron purge after 7d simulation, R2 lifecycle 24h temp expire orphan cleanup, NFR3 LCP < 2.5s assert via Lighthouse) ; coverage ≥ 90 % use cases + 80 % infra R2/CF Images + 80 % gateway endpoints ; replace Story 3.3 MOCK pipeline → 14 e2e Story 3.3 still pass avec REAL pipeline (regression check).

## Acceptance Criteria

1. **AC1 — `media-svc` Pretre scaffolding (5ᵉ service Pretre)** : Given Story 0.6 livré, When je lance `bash infra/scripts/replicate-pretre-structure.sh --target=media-svc`, Then la structure Pretre est répliquée dans `apps/media-svc/src/` (cohérent Architecture). Service exposé port `4009` (docker-compose Story 0.10 UPDATE). Migration baseline `1715320000000-CreateMediaSvcBaseline.ts` crée `outbox` + `inbox` tables (Story 0.7 pattern). Tests health/ready + lint boundaries 0 violations.

2. **AC2 — DB migration `media` table + indexes** : Given AC1, When je consulte `apps/media-svc/src/infrastructure/persistence/typeorm/migrations/1715320100000-CreateMediaTable.ts`, Then :
   ```sql
   CREATE TABLE media (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     pro_profile_id UUID NOT NULL, -- FK logique vers identity-svc.pro_profiles.id (cross-svc no DB FK)
     listing_id UUID NULL, -- FK logique vers catalog-svc.listing.id (cross-svc) — NULL si pas encore bound (during draft creation step 2 wizard before binding)
     r2_key VARCHAR(500) NOT NULL UNIQUE, -- e.g., "tukio-media-listings/temp/{photoTempId}/{nanoid}.jpg" or final path post-finalize
     cloudflare_image_id VARCHAR(100) NULL UNIQUE, -- populated post-finalize (status transitions 'pending' → 'ready')
     mime_type VARCHAR(50) NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp', 'image/heic')),
     size_bytes BIGINT NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760), -- 10 MB max
     status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'failed')),
     alt_text VARCHAR(125) NULL, -- NFR50 a11y, populated by Story 3.3 frontend PATCH
     metadata JSONB NULL, -- { width, height, originalFileName, etc. } populated post-finalize
     uploaded_at TIMESTAMPTZ NULL, -- populated post-finalize
     deleted_at TIMESTAMPTZ NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   );
   CREATE INDEX idx_media_listing_id ON media (listing_id) WHERE deleted_at IS NULL AND status = 'ready';
   CREATE INDEX idx_media_pro_profile_id_status ON media (pro_profile_id, status) WHERE deleted_at IS NULL;
   CREATE INDEX idx_media_purge_candidates ON media (deleted_at) WHERE deleted_at IS NOT NULL; -- cron purge 7j query
   CREATE INDEX idx_media_orphan_temp ON media (created_at, status) WHERE status = 'pending'; -- alert metric tukio_media_orphan_temp_objects_count
   ```
   - **down()** : DROP cascade
   - Tests integration testcontainer Postgres : 5 cases (INSERT happy + check constraints + soft-delete preserve + index used EXPLAIN ANALYZE on cron query + uniqueness r2_key)

3. **AC3 — Domain `Media` aggregate + 2 ports + exceptions** : Given Pretre architecture AC1, When je consulte `apps/media-svc/src/domain/`, Then :
   - **Aggregate `Media`** (`apps/media-svc/src/domain/model/media.aggregate.ts`) :
     ```ts
     export class Media {
       readonly id: MediaId;
       readonly proProfileId: string; readonly listingId: string | null;
       readonly r2Key: string; cloudflareImageId: string | null;
       readonly mimeType: string; readonly sizeBytes: number;
       status: 'pending' | 'ready' | 'failed';
       altText: string | null;
       metadata: MediaMetadata | null; uploadedAt: Date | null;
       readonly createdAt: Date; updatedAt: Date; deletedAt: Date | null;

       static initiate(input: { proProfileId, listingId?, r2Key, mimeType, sizeBytes }): Media { /* status='pending' */ }
       finalize(input: { cloudflareImageId, metadata, uploadedAt }): void { /* invariant: status === 'pending' → 'ready' */ }
       fail(reason: string): void { /* invariant: status === 'pending' → 'failed' */ }
       updateAltText(altText: string | null): void { /* invariant: altText.length <= 125 NFR50 */ }
       softDelete(): void { /* invariant: deletedAt === null ; sets deletedAt = NOW */ }
     }
     ```
   - **NEW value object** `media-id.vo.ts`, `media-metadata.vo.ts` `{ width, height, originalFileName }`
   - **NEW ports** `apps/media-svc/src/domain/ports/` :
     - `media-repository.port.ts` (`IMediaRepository` — `findById`, `findByR2Key`, `findByListingId({ listingId, status?, includeSoftDeleted? })`, `findPurgeCandidates({ olderThanDays: 7 })`, `save(media)`, `softDelete(id)`, `hardDelete(id)`)
     - `r2-storage.port.ts` (`IR2Storage` — `generateSignedPutUrl({ key, contentType, contentLengthRange, expiresInSeconds: 300 })`, `generateSignedGetUrl({ key, expiresInSeconds: 3600 })`, `deleteObject(key)`, `headObject(key)` for verifyChecksum reuse Story 2.7 pattern)
     - `cloudflare-images-service.port.ts` (`ICloudflareImagesService` — `uploadFromUrl({ sourceUrl, metadata })` returns `{ cloudflareImageId, variants: { thumbnail, card, detail }, width, height }`, `delete(cloudflareImageId)`, `getVariantUrls(cloudflareImageId)`)
     - `event-publisher.port.ts` (Story 0.7 réutilisé)
   - **NEW exceptions** :
     - `media-validation.exception.ts` (codes : `INVALID_MIME`, `INVALID_SIZE`, `INVALID_ALT_TEXT_LENGTH`)
     - `media-not-found.exception.ts`
     - `media-status-invalid-transition.exception.ts`
     - `cloudflare-images-upload-failed.exception.ts` (wraps `InvalidImageFormatError` magic bytes reject)
   - Tests aggregate ≥ 95 % : initiate happy + finalize transitions + fail + updateAltText invariants 0/125/126 chars + softDelete idempotent

4. **AC4 — `IR2Storage` infra impl `r2-storage.service.ts`** : Given AC3, When je consulte `apps/media-svc/src/infrastructure/external/r2/r2-storage.service.ts`, Then :
   - **Lib** : `@aws-sdk/client-s3` v3 latest stable (Story 1.3 + 2.7 réutilisé) + `@aws-sdk/s3-request-presigner` latest
   - **Implementation** :
     ```ts
     @Injectable()
     export class R2StorageService implements IR2Storage {
       constructor(@Inject(CONFIG_SERVICE) config: IConfigService) {
         this.s3 = new S3Client({ region: 'auto', endpoint: config.getR2Endpoint(), credentials: { accessKeyId: config.getR2AccessKey(), secretAccessKey: config.getR2SecretKey() }, forcePathStyle: true });
         this.bucket = 'tukio-media-listings';
       }
       async generateSignedPutUrl(input: { key, contentType, contentLengthRange, expiresInSeconds }): Promise<string> {
         const cmd = new PutObjectCommand({ Bucket: this.bucket, Key: input.key, ContentType: input.contentType, ServerSideEncryption: 'AES256', Metadata: { uploadedBy: 'tukio-media-svc' } });
         return getSignedUrl(this.s3, cmd, { expiresIn: input.expiresInSeconds, signableHeaders: new Set(['content-length-range']) });
       }
       async generateSignedGetUrl(input: { key, expiresInSeconds }): Promise<string> { ... }
       async deleteObject(key: string): Promise<void> { ... }
     }
     ```
   - **Doppler secrets** : `R2_ACCESS_KEY`, `R2_SECRET_KEY`, `R2_ENDPOINT`, `R2_BUCKET_LISTINGS=tukio-media-listings`
   - **Server-side encryption AES-256** strict (NFR15)
   - **Tests integration** : LocalStack S3 (`localstack/localstack` testcontainer ou local docker-compose Story 0.10) — 4 scenarios (signed PUT URL valid + content-length-range enforce + signed GET URL valid + deleteObject)

5. **AC5 — `ICloudflareImagesService` infra impl + variants config** : Given AC3, When je consulte `apps/media-svc/src/infrastructure/external/cloudflare/cloudflare-images.service.ts`, Then :
   - **Lib** : `cloudflare` npm package latest stable v4+ (official Cloudflare SDK)
   - **Implementation** :
     ```ts
     @Injectable()
     export class CloudflareImagesService implements ICloudflareImagesService {
       constructor(@Inject(CONFIG_SERVICE) config: IConfigService) {
         this.cf = new Cloudflare({ apiToken: config.getCloudflareApiToken() });
         this.accountId = config.getCloudflareAccountId();
         this.deliveryDomain = config.getCloudflareImagesDeliveryDomain(); // e.g., 'imagedelivery.net' or custom
       }
       async uploadFromUrl(input: { sourceUrl, metadata }): Promise<{ cloudflareImageId, variants, width, height }> {
         try {
           const response = await this.cf.images.v1.create({ account_id: this.accountId, url: input.sourceUrl, metadata: JSON.stringify(input.metadata), requireSignedURLs: false });
           return {
             cloudflareImageId: response.id,
             variants: this.getVariantUrls(response.id),
             width: response.metadata?.width ? Number(response.metadata.width) : undefined,
             height: response.metadata?.height ? Number(response.metadata.height) : undefined,
           };
         } catch (err) {
           if (err.message?.includes('invalid image format')) throw new CloudflareImagesUploadFailedException({ code: 'INVALID_FORMAT', cause: err });
           throw new CloudflareImagesUploadFailedException({ code: 'UPLOAD_ERROR', cause: err });
         }
       }
       getVariantUrls(cloudflareImageId: string): { thumbnail: string; card: string; detail: string } {
         return {
           thumbnail: `https://${this.deliveryDomain}/${this.accountId}/${cloudflareImageId}/thumbnail`,
           card: `https://${this.deliveryDomain}/${this.accountId}/${cloudflareImageId}/card`,
           detail: `https://${this.deliveryDomain}/${this.accountId}/${cloudflareImageId}/detail`,
         };
       }
       async delete(cloudflareImageId: string): Promise<void> { await this.cf.images.v1.delete(cloudflareImageId, { account_id: this.accountId }); }
     }
     ```
   - **Doppler secrets** : `CLOUDFLARE_API_TOKEN` (scope: `Account.Cloudflare Images:Edit`), `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_IMAGES_DELIVERY_DOMAIN`
   - **Variants config** documenté dans `docs/runbook/cloudflare-images-setup.md` (NEW Story 3.4) — admin doit créer 3 variants Cloudflare dashboard une fois (Images > Variants) avec specs cf. story body section (9). Sans ces variants côté Cloudflare, les URLs `/thumbnail` `/card` `/detail` retournent 404. Setup runbook étape par étape.
   - **PII redaction logger** : Pino redact `apiToken`, `metadata.proProfileId` partial (last 4 chars only — for traceability without full ID leak in logs)
   - Tests integration : mock `cloudflare` SDK via `nock` ou test doubles — 4 scenarios (uploadFromUrl happy, magic bytes reject InvalidImageFormatError, getVariantUrls returns correct shape, delete success)

6. **AC6 — 3 use cases media-svc** : Given AC3-5, When je consulte `apps/media-svc/src/usecases/`, Then :
   - **`generate-signed-upload-url.usecase.ts`** :
     ```ts
     async execute(input: { proProfileId, mimeType, sizeBytes }): Promise<{ uploadUrl, r2Key, photoTempId }> {
       // Validate MIME whitelist + size <= 10 MB
       if (!ALLOWED_MIMES.includes(input.mimeType)) throw new MediaValidationException({ code: 'INVALID_MIME', mimeType: input.mimeType });
       if (input.sizeBytes > 10485760) throw new MediaValidationException({ code: 'INVALID_SIZE', actual: input.sizeBytes, max: 10485760 });

       const photoTempId = nanoid();
       const r2Key = `temp/${photoTempId}/${nanoid()}.${getExtFromMime(input.mimeType)}`;
       const media = Media.initiate({ proProfileId: input.proProfileId, r2Key, mimeType: input.mimeType, sizeBytes: input.sizeBytes });
       await this.mediaRepo.save(media);

       const uploadUrl = await this.r2Storage.generateSignedPutUrl({ key: r2Key, contentType: input.mimeType, contentLengthRange: [1, 10485760], expiresInSeconds: 300 });
       return { uploadUrl, r2Key, photoTempId };
     }
     ```
   - **`finalize-photo-upload.usecase.ts`** :
     ```ts
     async execute(input: { proProfileId, r2Key, photoTempId, listingId? }): Promise<{ photoId, urls, altText }> {
       const media = await this.mediaRepo.findByR2Key(input.r2Key);
       if (!media) throw new MediaNotFoundException(input.r2Key);
       if (media.proProfileId !== input.proProfileId) throw new MediaForbiddenException(); // cross-pro RBAC
       if (media.status === 'ready') return this.toResponse(media); // idempotent re-call
       if (media.status !== 'pending') throw new MediaStatusInvalidTransitionException({ from: media.status, to: 'ready' });

       const sourceUrl = await this.r2Storage.generateSignedGetUrl({ key: input.r2Key, expiresInSeconds: 3600 });
       try {
         const cfResult = await this.cloudflareImages.uploadFromUrl({ sourceUrl, metadata: { proProfileId: input.proProfileId, listingId: input.listingId, photoTempId: input.photoTempId } });
         media.finalize({ cloudflareImageId: cfResult.cloudflareImageId, metadata: { width: cfResult.width, height: cfResult.height }, uploadedAt: new Date() });
         await this.mediaRepo.save(media);
         await this.eventPublisher.publish({ eventType: 'media.photo.uploaded', eventVersion: 'v1', aggregate: { type: 'Media', id: media.id }, actor: { userId: input.proProfileId, role: 'pro' }, payload: { photoId: media.id, r2Key: media.r2Key, cloudflareImageId: cfResult.cloudflareImageId, listingId: input.listingId, proProfileId: input.proProfileId, mimeType: media.mimeType, sizeBytes: media.sizeBytes, variants: cfResult.variants, uploadedAt: media.uploadedAt!.toISOString() }, occurredAt: new Date() });
         return { photoId: media.id, urls: cfResult.variants, altText: null };
       } catch (err) {
         media.fail(err.message);
         await this.mediaRepo.save(media);
         throw err;
       }
     }
     ```
   - **`soft-delete-photo.usecase.ts`** :
     ```ts
     async execute(input: { photoId, proProfileId }): Promise<void> {
       const media = await this.mediaRepo.findById(input.photoId);
       if (!media) throw new MediaNotFoundException(input.photoId);
       if (media.proProfileId !== input.proProfileId) throw new MediaForbiddenException();
       media.softDelete();
       await this.mediaRepo.save(media);
       await this.eventPublisher.publish({ eventType: 'media.photo.deleted', eventVersion: 'v1', aggregate: { type: 'Media', id: media.id }, actor: { userId: input.proProfileId, role: 'pro' }, payload: { photoId: media.id, r2Key: media.r2Key, cloudflareImageId: media.cloudflareImageId, listingId: media.listingId, deletedAt: media.deletedAt!.toISOString() }, occurredAt: new Date() });
     }
     ```
   - **NEW use case `update-photo-alt-text.usecase.ts`** (consumed Story 3.3 frontend altText inline edit) — `media.updateAltText(altText)` + persist + outbox publish `media.photo.alt-text-updated.v1`
   - Tests unit ≥ 90 % each + integration testcontainer LocalStack S3 + nock CF Images mock

7. **AC7 — gateway-api endpoints + forwarders + RBAC** : Given AC6 + Story 1.2 patterns, When je consulte `apps/gateway-api/src/`, Then :
   - **NEW controller** `apps/gateway-api/src/infrastructure/http/controllers/listings-photos.controller.ts` :
     ```ts
     @Controller('/v1/listings/photos')
     @UseGuards(KeycloakJwtGuard, RolesGuard)
     @Roles('pro')
     export class ListingsPhotosController {
       @Post('/upload-url')
       @HttpCode(200)
       @Throttle({ short: { limit: 30, ttl: 3600 * 1000 } }) // 30 uploads/hour/user
       async getUploadUrl(@Body() body: GetUploadUrlInput, @CurrentActor() actor: Actor): Promise<{ uploadUrl: string; r2Key: string; photoTempId: string }> {
         return this.photosForwarder.getInstance().getUploadUrl({ proProfileId: actor.proProfileId, ...body });
       }

       @Post('/finalize')
       @HttpCode(200)
       async finalize(@Body() body: FinalizePhotoInput, @CurrentActor() actor: Actor): Promise<{ photoId: string; urls: { thumbnail: string; card: string; detail: string }; altText: string | null }> {
         return this.photosForwarder.getInstance().finalize({ proProfileId: actor.proProfileId, ...body });
       }

       @Patch('/:photoId/alt-text')
       @HttpCode(200)
       async updateAltText(@Param('photoId', ParseUUIDPipe) photoId: string, @Body() body: { altText: string | null }, @CurrentActor() actor: Actor): Promise<{ ok: true }> {
         return this.photosForwarder.getInstance().updateAltText({ photoId, proProfileId: actor.proProfileId, altText: body.altText });
       }

       @Delete('/:photoId')
       @HttpCode(200)
       async softDelete(@Param('photoId', ParseUUIDPipe) photoId: string, @CurrentActor() actor: Actor): Promise<{ ok: true }> {
         return this.photosForwarder.getInstance().softDelete({ photoId, proProfileId: actor.proProfileId });
       }
     }
     ```
   - **Validation Zod** `GetUploadUrlInputSchema` : `{ mimeType: z.enum(['image/jpeg','image/png','image/webp','image/heic']), sizeBytes: z.number().int().min(1).max(10485760) }`
   - **Forwarder** `apps/gateway-api/src/usecases/media/photos.forwarder.ts` (NEW) — appelle media-svc internal `POST /internal/media/upload-url`, etc.
   - **Errors mapping** : 422 `MEDIA-INVALID-MIME-001` / `MEDIA-INVALID-SIZE-001` / `MEDIA-INVALID-FILE-001` (CF reject magic bytes) ; 403 `MEDIA-FORBIDDEN-001` cross-pro ; 404 `MEDIA-NOT-FOUND-001` ; 429 throttle
   - Tests E2E gateway 8 scénarios

8. **AC8 — Cron `purge-soft-deleted-photos.task.ts`** : Given AC2 partial index `idx_media_purge_candidates`, When je consulte `apps/media-svc/src/infrastructure/tasks/purge-soft-deleted-photos.task.ts`, Then :
   ```ts
   @Cron('0 3 * * *', { timeZone: 'UTC' }) // 3am UTC daily
   async run(): Promise<void> {
     const candidates = await this.mediaRepo.findPurgeCandidates({ olderThanDays: 7, limit: 1000 });
     this.metrics.gauge('tukio_media_purge_candidates_count').set(candidates.length);
     for (const media of candidates) {
       try {
         if (media.cloudflareImageId) await this.cloudflareImages.delete(media.cloudflareImageId);
         await this.r2Storage.deleteObject(media.r2Key);
         await this.mediaRepo.hardDelete(media.id);
         this.metrics.counter('tukio_media_purged_photos_total').inc();
       } catch (err) {
         this.logger.error({ err, mediaId: media.id }, 'photo purge failed — skip, retry next day');
         this.metrics.counter('tukio_media_purge_failed_total').inc();
       }
     }
   }
   ```
   - Tests integration testcontainer LocalStack S3 + nock CF Images : 3 scenarios (happy purge 5 photos > 7d, partial fail R2 → next day retry, idempotent re-run)

9. **AC9 — NATS event schemas + Story 3.3 MOCK replacement** : Given AC6 + Story 0.2 contracts, When :
   - **NEW event schemas** `packages/contracts/src/events/media/` :
     - `photo-uploaded.v1.{schema.json,ts}` (payload cf. story body)
     - `photo-deleted.v1.{schema.json,ts}` (payload cf. story body)
     - `photo-alt-text-updated.v1.{schema.json,ts}` (`{ photoId, listingId?, proProfileId, altText, updatedAt }`)
   - **Story 3.3 frontend UPDATE** : replace `useUploadPhoto` MOCK Story 3.3 par implementation réelle (cf. story body section (10)) — file `apps/seller/src/features/seller/listings/hooks/use-upload-photo.ts` REPLACE
   - **Regression check** : Story 3.3's 14 e2e Playwright tests still pass with REAL pipeline (no test refactor needed — same UX contract)

10. **AC10 — Métriques + alerts + runbooks + tests E2E + commit** :
    - **Métriques Prom NEW** (cf. story body section 12) — 6 nouvelles
    - **Prometheus rules** `infra/k8s/prometheus-rules/media-svc.yaml` (NEW) — 2 alerts (CF Images down + upload failure rate)
    - **Dashboard Grafana** `infra/k8s/grafana-dashboards/media-pipeline.json` (NEW ~5 panels) : uploads/min, p90 latency, CF Images error rate, R2 orphan temp count, daily purge count
    - **NEW runbooks** :
      - `docs/runbook/cloudflare-images-setup.md` (~50 lignes — admin setup variants Cloudflare dashboard)
      - `docs/runbook/photo-upload-debug.md` (~40 lignes — debug pipeline R2 → CF Images, test mode local LocalStack, signed URL TTL issues, magic bytes reject false-positives)
      - `docs/runbook/r2-bucket-provisioning.md` (~30 lignes — provision tukio-media-listings bucket + lifecycle 24h temp/* policy)
    - **Tests Playwright e2e** 10 scénarios (cf. story body Outcome) :
      - T1-2 happy upload 5 photos FR + EN → variants thumbnail/card/detail render
      - T3 upload reject MIME image/gif → 422 + UI inline error
      - T4 upload size > 10MB → 422 + UI error message
      - T5 finalize idempotent (call 2x same r2Key) → 200 same response
      - T6 malicious PHP renamed .jpg → CF Images magic bytes reject → 422
      - T7 alt text save via PATCH endpoint
      - T8 drag&drop reorder via PATCH listing photos reorder (Story 3.3 endpoint integration)
      - T9 delete photo + cron purge 7d simulation testcontainer
      - T10 R2 lifecycle 24h temp expire orphan cleanup + NFR3 LCP < 2.5s assert via Lighthouse audit
    - **Coverage** : ≥ 90 % use cases + 80 % infra R2/CF Images + 80 % gateway endpoints + 90 % cron
    - **Story 3.3 regression** : 14/14 e2e Story 3.3 still pass with REAL pipeline
    - **Commit** `feat(media,seller): Story 3.4 photo upload pipeline + media-svc Pretre + R2 signed PUT URL + Cloudflare Images integration + soft-delete + cron purge 7d + NFR3 LCP variants + replace Story 3.3 MOCK`

## Tasks / Subtasks

- [ ] **Task 1 — `@tukio/contracts` event schemas + DTOs media** (AC: #9)
  - [ ] 1.1-1.3 — Event schemas (photo-uploaded, photo-deleted, photo-alt-text-updated)
  - [ ] 1.4 — DTOs `dtos/media/photo.dto.ts` (GetUploadUrlInput + FinalizePhotoInput + PhotoUrls + UpdateAltTextInput)
- [ ] **Task 2 — `media-svc` Pretre scaffolding** (AC: #1)
  - [ ] 2.1 — `bash infra/scripts/replicate-pretre-structure.sh --target=media-svc`
  - [ ] 2.2 — UPDATE `docker-compose.yml` Story 0.10 — add media-svc port 4009 + DB tukio_media
  - [ ] 2.3 — Migration baseline `1715320000000-CreateMediaSvcBaseline.ts` (outbox + inbox)
- [ ] **Task 3 — DB migration `media` table + indexes** (AC: #2)
  - [ ] 3.1 — Migration `1715320100000-CreateMediaTable.ts`
  - [ ] 3.2 — Tests integration testcontainer 5 cases
- [ ] **Task 4 — Domain `Media` aggregate + 4 ports + 4 exceptions** (AC: #3) — coverage ≥ 95 %
  - [ ] 4.1 — Aggregate + 2 VOs + state machine + invariants
  - [ ] 4.2 — 4 ports interfaces
  - [ ] 4.3 — 4 exceptions
  - [ ] 4.4 — Tests aggregate 15+ cases
- [ ] **Task 5 — `IR2Storage` infra impl + LocalStack tests** (AC: #4) — coverage ≥ 80 %
  - [ ] 5.1 — `r2-storage.service.ts` (`@aws-sdk/client-s3` v3 + presigner)
  - [ ] 5.2 — Doppler secrets provisioned
  - [ ] 5.3 — Tests integration LocalStack 4 scenarios
- [ ] **Task 6 — `ICloudflareImagesService` infra impl + tests** (AC: #5) — coverage ≥ 80 %
  - [ ] 6.1 — `cloudflare-images.service.ts` (`cloudflare` SDK v4+)
  - [ ] 6.2 — Doppler secrets provisioned
  - [ ] 6.3 — Variants config Cloudflare dashboard (manual one-time setup documented runbook)
  - [ ] 6.4 — Tests integration nock + 4 scenarios
- [ ] **Task 7 — Use cases media-svc + internal controllers** (AC: #6) — coverage ≥ 90 %
  - [ ] 7.1-7.4 — 4 use cases (generateSignedUploadUrl, finalizePhotoUpload, updatePhotoAltText, softDeletePhoto)
  - [ ] 7.5 — Internal controllers `internal-media.controller.ts` (4 endpoints)
  - [ ] 7.6 — Wire usecases-proxy module
  - [ ] 7.7 — Tests unit + integration
- [ ] **Task 8 — gateway-api 4 endpoints + forwarder + RBAC + throttle** (AC: #7) — coverage ≥ 80 %
  - [ ] 8.1 — `listings-photos.controller.ts` (4 endpoints)
  - [ ] 8.2 — `photos.forwarder.ts`
  - [ ] 8.3 — Throttle 30 uploads/hour/user
  - [ ] 8.4 — Tests E2E gateway 8 scénarios
- [ ] **Task 9 — Cron `purge-soft-deleted-photos.task.ts`** (AC: #8) — coverage ≥ 90 %
  - [ ] 9.1 — Task `@Cron 0 3 * * *` UTC
  - [ ] 9.2 — Tests integration testcontainer 3 scenarios
- [ ] **Task 10 — Replace Story 3.3 MOCK pipeline** (AC: #9)
  - [ ] 10.1 — UPDATE `apps/seller/src/features/seller/listings/hooks/use-upload-photo.ts` REAL impl
  - [ ] 10.2 — Regression run Story 3.3 14 e2e tests pass with REAL pipeline
- [ ] **Task 11 — R2 bucket provisioning + Cloudflare Images variants setup** (AC: #4, #5)
  - [ ] 11.1 — UPDATE `infra/scripts/provision-r2-buckets.sh` Story 0.10 — add `tukio-media-listings` bucket + AES-256 + lifecycle 24h temp/*
  - [ ] 11.2 — Manual setup Cloudflare Images variants `thumbnail` + `card` + `detail` (admin one-time, runbook documenté)
- [ ] **Task 12 — Métriques Prom + alerts + Grafana dashboard** (AC: #10)
  - [ ] 12.1 — 6 nouvelles métriques
  - [ ] 12.2 — Prometheus rules `media-svc.yaml` 2 alerts
  - [ ] 12.3 — Dashboard Grafana `media-pipeline.json` 5 panels
  - [ ] 12.4 — Slack routing `#tukio-alerts-ops`
- [ ] **Task 13 — Tests Playwright e2e + axe-core + Lighthouse perf** (AC: #10) — 10 tests + Story 3.3 regression
- [ ] **Task 14 — Runbooks + commit**
  - [ ] 14.1 — Runbook `cloudflare-images-setup.md`
  - [ ] 14.2 — Runbook `photo-upload-debug.md`
  - [ ] 14.3 — Runbook `r2-bucket-provisioning.md`
  - [ ] 14.4 — Update `docs/project-context.md` section "Media Pipeline (Story 3.4)"
  - [ ] 14.5 — Commit `feat(media,seller): Story 3.4 photo upload pipeline + media-svc Pretre + R2 + Cloudflare Images + soft-delete cron purge`

## Dev Notes

### Pourquoi Story 3.4 = pierre angulaire pipeline media Epic 3+

Story 3.3 a livré **contrat UX MOCK**. Story 3.4 livre **pipeline réelle production-ready** avec : signed PUT URL R2 client-side direct (zero backend bandwidth — économie cost + scalability), R2→CF Images backend (resize + WebP/AVIF auto + CDN), variants account-level (NFR3 LCP < 2.5s), soft-delete + cron 7j purge. Pattern complet **media pipeline R2 + CF Images + signed URLs + soft-delete cron + cross-svc reference (catalog-svc.listing_photo references media-svc.media)** réutilisé Stories Epic 4 V1 (booking modification file attachments FR70), Stories Epic 5 V1 (messaging file attachments), Stories Epic 12 V1 (review photos multi-attachments).

### Décisions techniques majeures actées

1. **media-svc dédié** (vs catalog-svc owns photos) — DDD bounded context : media = file storage cross-domain (listings + bookings + messaging V1+ + reviews V1+). Évite catalog-svc bloated. Pattern Pretre cohérent.
2. **Signed PUT URL R2 client-side direct** — zero backend bandwidth (Pro upload 50 MB ne traverse pas Tukio backend) → économie cost + scalability + UX rapide.
3. **R2 → CF Images upload-from-URL** (vs Pro upload directly to CF Images) — R2 = source-of-truth raw original (compliance audit + cold storage), CF Images = CDN + variants. Two-tier strategy.
4. **Variants account-level Cloudflare Dashboard** (vs per-image variants in code) — config infra one-time. CF Images negotiates WebP/AVIF/JPG via `Accept` header browser automatically. NFR3 LCP < 2.5s native.
5. **Soft-delete + cron 7j purge** — Pro changes mind + restore window. Audit_log Story 2.7 captures deletion event.
6. **R2 lifecycle 24h auto-expire `temp/*`** — anti-orphan si finalize never called (Pro abandons wizard).
7. **Magic bytes validation Cloudflare native** — defense in depth (vs custom backend validation lib qui peut bypass).
8. **PII redaction logs** — never log full r2Key/signed URL (token sensitive). Pino redact config.
9. **Throttle 30 uploads/hour/user** — anti-abuse cohérent UX réaliste.
10. **Cross-svc references (catalog.listing_photo → media.cloudflare_image_id + r2_key)** — pas de DB FK cross-svc (DDD bounded), références logiques.
11. **`useUploadPhoto` REAL replaces Story 3.3 MOCK** — same hook contract, same TanStack Query mutation, just real backend. UX inchangée.
12. **EN strict + Pretre + envelope ADR-014 + latest stable versions** memories.

### Versions à utiliser

| Lib | Usage | Version | Notes |
|-----|-------|---------|-------|
| `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` | R2 SDK + signed URLs | latest stable v3 | Story 1.3 + 2.7 réutilisé |
| `cloudflare` | Cloudflare Images SDK | latest stable v4+ | Official Cloudflare SDK |
| `nanoid` | r2_key + photoTempId | (Story 3.2 already installed) | |
| `@nestjs/schedule` | cron purge | (Story 1.9 already installed) | |
| `pino` redact | PII logs | (Story 0.7 already installed) | |

### Project Structure cible

```
packages/contracts/src/events/media/
├─ photo-uploaded.v1.{schema.json,ts}                            # NEW Story 3.4
├─ photo-deleted.v1.{schema.json,ts}                             # NEW
└─ photo-alt-text-updated.v1.{schema.json,ts}                    # NEW

packages/contracts/src/dtos/media/
└─ photo.dto.ts                                                  # NEW (GetUploadUrlInput, FinalizePhotoInput, PhotoUrls, UpdateAltTextInput Zod)

apps/media-svc/                                                   # NEW Story 3.4 (5ᵉ Pretre service)
├─ src/
│  ├─ domain/
│  │  ├─ model/
│  │  │  ├─ media.aggregate.ts                                   # NEW
│  │  │  └─ value-objects/{media-id, media-metadata}.vo.ts       # NEW
│  │  ├─ ports/
│  │  │  ├─ media-repository.port.ts                             # NEW
│  │  │  ├─ r2-storage.port.ts                                   # NEW
│  │  │  ├─ cloudflare-images-service.port.ts                    # NEW
│  │  │  └─ event-publisher.port.ts                              # Story 0.7 réutilisé
│  │  └─ exception/
│  │     ├─ media-validation.exception.ts                        # NEW
│  │     ├─ media-not-found.exception.ts                         # NEW
│  │     ├─ media-status-invalid-transition.exception.ts         # NEW
│  │     ├─ media-forbidden.exception.ts                         # NEW
│  │     └─ cloudflare-images-upload-failed.exception.ts         # NEW
│  ├─ usecases/
│  │  ├─ generate-signed-upload-url.usecase.ts + spec            # NEW
│  │  ├─ finalize-photo-upload.usecase.ts + spec                 # NEW
│  │  ├─ update-photo-alt-text.usecase.ts + spec                 # NEW
│  │  └─ soft-delete-photo.usecase.ts + spec                     # NEW
│  ├─ usecases-proxy/usecases-proxy.module.ts                    # NEW (Pretre baseline)
│  ├─ infrastructure/
│  │  ├─ http/controllers/internal-media.controller.ts           # NEW (4 internal endpoints)
│  │  ├─ persistence/typeorm/
│  │  │  ├─ entities/media.entity.ts                             # NEW
│  │  │  ├─ repositories/media.typeorm.repository.ts             # NEW
│  │  │  └─ migrations/
│  │  │     ├─ 1715320000000-CreateMediaSvcBaseline.ts           # NEW (outbox + inbox)
│  │  │     └─ 1715320100000-CreateMediaTable.ts                 # NEW
│  │  ├─ external/
│  │  │  ├─ r2/r2-storage.service.ts                             # NEW
│  │  │  └─ cloudflare/cloudflare-images.service.ts              # NEW
│  │  └─ tasks/purge-soft-deleted-photos.task.ts                 # NEW (cron 3am UTC daily)
│  ├─ main.ts + app.module.ts                                    # NEW (Pretre baseline)
└─ test/
   ├─ aggregate/media.spec.ts                                    # NEW
   ├─ usecases/{4 usecases}.spec.ts                              # NEW
   ├─ integration/
   │  ├─ media-repo.spec.ts                                      # NEW (testcontainer Postgres)
   │  ├─ r2-storage.spec.ts                                      # NEW (LocalStack S3)
   │  ├─ cloudflare-images.spec.ts                               # NEW (nock CF API)
   │  └─ purge-cron.spec.ts                                      # NEW (testcontainer + LocalStack + nock)

apps/gateway-api/src/
├─ usecases/media/photos.forwarder.ts                            # NEW
├─ infrastructure/http/controllers/listings-photos.controller.ts # NEW (4 endpoints)
└─ infrastructure/external/media-svc/media-svc.client.ts         # NEW

apps/seller/src/features/seller/listings/hooks/
└─ use-upload-photo.ts                                            # UPDATE Story 3.3 — REPLACE MOCK with REAL pipeline

apps/seller/e2e/listings/photo-upload.spec.ts                    # NEW Story 3.4 (10 tests)

infra/scripts/provision-r2-buckets.sh                            # UPDATE Story 0.10 — add tukio-media-listings + AES-256 + lifecycle 24h temp/*
infra/docker-compose.yml                                         # UPDATE Story 0.10 — add media-svc:4009 + LocalStack S3 service for dev local

infra/k8s/prometheus-rules/media-svc.yaml                        # NEW
infra/k8s/grafana-dashboards/media-pipeline.json                 # NEW

docs/runbook/cloudflare-images-setup.md                          # NEW (~50 lignes)
docs/runbook/photo-upload-debug.md                               # NEW (~40 lignes)
docs/runbook/r2-bucket-provisioning.md                           # NEW (~30 lignes)

# Estimation : ~50 nouveaux + ~5 updates = ~55 fichiers
```

### Critical Architecture Constraints

> Cf. Stories 0.2 (contracts events), 0.6 (Pretre + replicate script + boundaries lint), 0.7 (outbox/inbox), 0.10 (docker-compose + Doppler + provision-r2-buckets.sh), 1.2 (gateway-api forwarder pattern), 1.3 (IMediaStorage R2 KYC pattern reference — Story 3.4 média = analogue mais cross-bucket distinct), 2.1 (BullMQ pattern V1+ ; MVP no async export), 2.7 (R2 archive bucket pattern réutilisé), 3.2 (Photo VO embedded in Listing aggregate — Story 3.4 owns Media entity dans media-svc séparé, catalog-svc.Listing.photos[].cloudflareImageId + .r2Key sont logical references), 3.3 (useUploadPhoto MOCK pipeline contract).

1. **Pretre architecture stricte** — domain pure no I/O imports `@aws-sdk/*`, `cloudflare`, `axios`, `@nestjs/*`, `typeorm`. Eslint-plugin-boundaries enforce.
2. **Transactional outbox ADR-007** — events single transaction.
3. **API responses envelope ADR-014**.
4. **NFR3 LCP < 2.5s** — variants WebP/AVIF/JPG fallback + lazy-load + CDN Cloudflare Images.
5. **NFR15 chiffrement at-rest R2** — AES-256 server-side encryption.
6. **NFR50 a11y altText** — max 125 chars enforced domain VO.
7. **NFR16 PII redaction** — Pino redact never log full r2Key + signed URL token.
8. **EN strict + Pretre + envelope + latest stable versions** memories.

### Previous Story Intelligence

**Story 0.6 (Pretre scaffolding)** : Story 3.4 invoque `replicate-pretre-structure.sh --target=media-svc` (5ᵉ service Pretre).

**Story 0.10 (docker-compose + Doppler)** : UPDATE — add media-svc port 4009 + DB tukio_media + LocalStack S3 service for dev local + provision-r2-buckets.sh extends.

**Story 1.3 (Pro registration + IMediaStorage KYC bucket)** : reference pattern. Story 3.4 implements separate media-svc service avec own R2 bucket `tukio-media-listings` (vs `tukio-kyc` Story 1.3). Story 1.3 IMediaStorage in identity-svc owns KYC docs + uses different bucket.

**Story 2.1 (Stripe Connect + outbox + BullMQ)** : pattern outbox + Doppler secrets réutilisé.

**Story 2.7 (audit-log archive R2)** : pattern R2 bucket + AES-256 + lifecycle policy réutilisé.

**Story 3.2 (Listing aggregate Photo VO + IPhotoStorage port)** : Story 3.4 implement `IPhotoStorage` port livré Story 3.2 (côté catalog-svc) — la `IPhotoStorage` côté catalog-svc abstracte les calls vers media-svc internal endpoints. Cross-svc référence : `catalog-svc.listing_photo.cloudflare_image_id` + `.r2_key` correspond `media-svc.media.cloudflare_image_id` + `.r2_key`. Pas de DB FK (DDD bounded contexts).

**Story 3.3 (wizard `useUploadPhoto` MOCK)** : Story 3.4 REPLACE MOCK par REAL — same contract, no UX change.

### What this story does NOT do

- ❌ **Image transformations on-the-fly custom (rotate, crop, filter)** — V1+ feature. MVP : 3 variants account-level (thumbnail/card/detail) suffisent.
- ❌ **Image AI moderation (offensive content auto-detect)** — V1+ Stories 6.x.
- ❌ **Bulk upload via API (multi-file in one request)** — V1+ ; MVP single-file flow per call (Pro UX OK pour 15 photos).
- ❌ **Re-upload variants regeneration** — V1+ admin tool si variants account-level changent.
- ❌ **Image SEO metadata (EXIF strip + alt fallback)** — partial MVP (alt_text optional). V1+ EXIF strip privacy.
- ❌ **CDN cache purge endpoint** — Cloudflare Images auto-handle cache via image_id versioning.
- ❌ **Photo upload from URL (vs file)** — V1+ Pro can paste URL (e.g., from existing portfolio).
- ❌ **Backup R2 cross-region** — V1+ disaster recovery pattern. MVP single-region acceptable.

### Files to UPDATE vs CREATE

(Cf. Project Structure cible — annoté UPDATE/NEW)

### Testing Standards

- Coverage ≥ 95 % aggregate Media + state machine — NFR71 strict
- Coverage ≥ 90 % use cases (4)
- Coverage ≥ 80 % infra R2 + CF Images
- Coverage ≥ 80 % gateway endpoints + forwarder
- Coverage ≥ 90 % cron purge
- Tests integration testcontainer LocalStack S3 (R2 mock) + nock CF Images : 4 + 4 = 8 scenarios
- Tests E2E Playwright FR/EN axe-core 0 violations 10 tests AC10
- Tests perf : NFR3 LCP < 2.5s assert via Lighthouse audit on listing detail page mocked Story 3.10
- **Story 3.3 regression** : 14/14 e2e Story 3.3 still pass with REAL pipeline (no test refactor)
- **Lint boundaries** : `pnpm --filter=media-svc lint` 0 violations CI assert

### Project Structure Notes

✅ **Aligné architecture, PRD §FR23 (3-15 photos), §NFR3 (LCP < 2.5s), §NFR15 (R2 encrypted), §NFR50 (a11y altText), §NFR16 (PII redaction), Stories 0.6/0.7/0.10/1.3/2.1/2.7/3.2/3.3, memories.**

⚠️ **Décision** : media-svc dédié (vs catalog-svc owns photos) — DDD bounded context cross-domain.
⚠️ **Décision** : Signed PUT URL R2 client-side direct — zero backend bandwidth.
⚠️ **Décision** : R2 → CF Images upload-from-URL — two-tier (raw R2 + CDN CF).
⚠️ **Décision** : Variants account-level (vs per-image code) — config infra one-time + WebP/AVIF auto.
⚠️ **Décision** : Soft-delete + cron 7j purge — restore window + audit.
⚠️ **Décision** : R2 lifecycle 24h temp auto-expire — anti-orphan abandoned wizard.
⚠️ **Décision** : Throttle 30 uploads/hour/user — anti-abuse réaliste.
⚠️ **Décision** : Cross-svc references logiques (no DB FK) — DDD strict.
⚠️ **Décision** : Replace Story 3.3 MOCK same contract — UX inchangée + regression check.

### References

- [Source: epics.md#Epic-3-Story-3.4 — Lines 1442-1457]
- [Source: prd.md#FR23 (3-15 photos), #NFR3 (LCP), #NFR15 (R2 encrypted), #NFR50 (a11y), #NFR16 (PII redaction)]
- [Source: architecture.md — line 548 IMediaStorage R2 + signed URLs, line 2034 media-svc, line 2322 PII encryption R2 KYC, ADR-007 outbox, ADR-014 envelope]
- [Source: Stories 0.6 (Pretre), 0.7 (outbox), 0.10 (docker-compose + Doppler), 1.3 (KYC R2 pattern), 2.1 (BullMQ + outbox), 2.7 (R2 archive bucket pattern), 3.2 (IPhotoStorage port + Listing.Photo VO logical reference), 3.3 (useUploadPhoto MOCK contract)]
- [Memory: feedback_clean_architecture_explicit.md, feedback_api_envelope_response.md, feedback_tech_layer_english.md, feedback_i18n_frontend.md, feedback_latest_versions.md]

## Dev Agent Record

### Agent Model Used

(à remplir par dev agent)

### Debug Log References

### Completion Notes List

(à remplir à la fin — résumé décisions, déviations vs Dev Notes avec justification, points d'attention pour Story 3.5 (publish workflow — listing photos.length >= 3 invariant validates via finalize endpoint Story 3.4 ready), Story 3.6 (edit/unpublish/delete listing — DELETE listing cascade soft-delete photos via Story 3.4), Story 3.7 (Meilisearch indexer — consume `media.photo.uploaded.v1` + `media.photo.deleted.v1` events Story 3.4 for image url updates in search results), Story 3.10 (listing detail public page — render `<picture>` srcset variants thumbnail/card/detail Story 3.4), Stories Epic 4 V1 (booking attachments réutilise pattern), Stories Epic 5 V1 (messaging attachments))

### File List

(à remplir au fil de l'implémentation par le dev agent)

---

## Story Completion Status

- **Story Status** : `ready-for-dev`
- **Created** : 2026-05-09
- **Created by** : `bmad-create-story` workflow
- **Epic** : Epic 3 — Catalog Publication & Discovery (MVP)
- **Sprint cible** : Sprint 4 (4ᵉ story Epic 3 après 3.1/3.2/3.3)
- **Estimation effort** : 5-7 jours (1 dev senior — story complexité high : 5ᵉ service Pretre + 2 SDK integrations + 4 endpoints + cron + variants Cloudflare config + Story 3.3 MOCK replacement + 10 e2e tests + LocalStack S3 setup, ~55 fichiers)
- **Dépendances upstream** : Stories 0.2 (contracts events), 0.6 (Pretre + replicate script), 0.7 (outbox/inbox), 0.10 (docker-compose + Doppler + provision-r2-buckets.sh), 1.2 (gateway-api forwarder), 1.3 (IMediaStorage KYC pattern reference), 2.1 (outbox + Doppler secrets), 2.7 (R2 archive bucket pattern), 3.2 (IPhotoStorage port + Listing.Photo VO cross-svc reference), 3.3 (useUploadPhoto MOCK contract — Story 3.4 replaces)
- **Dépendances downstream** :
  - Story 3.5 (publish workflow) — `listing.photos.length >= 3` invariant validates via finalize endpoint Story 3.4 ready
  - Story 3.6 (edit/unpublish/delete listing) — DELETE listing cascade soft-delete photos via Story 3.4 endpoint
  - Story 3.7 (Meilisearch indexer) — consume `media.photo.uploaded.v1` + `media.photo.deleted.v1` events
  - Story 3.10 (listing detail public) — render `<picture>` srcset variants thumbnail/card/detail
  - Stories Epic 4 V1 (booking modification attachments FR70) — réutilise pattern
  - Stories Epic 5 V1 (messaging attachments) — réutilise pattern
  - Stories Epic 12 V1 (review photos multi-attachments) — réutilise pattern
- **FRs covered** :
  - **FR23** ✅ photo upload pipeline (3-15 photos validation + R2 + CF Images + CDN)
- **NFRs touchés** :
  - **NFR3** ✅ LCP < 2.5s via variants WebP/AVIF + lazy-load + CDN
  - **NFR15** ✅ R2 server-side encryption AES-256
  - **NFR16** ✅ PII redaction logs (no full r2Key/signed URL token)
  - **NFR50** ✅ a11y altText 125 chars max enforce
  - **NFR71** ✅ coverage thresholds

> **Prochaine story → Story 3.5** (Listing publish workflow + auto-publish FR30 + median price FR31/FR32 — finalise `publish-listing.usecase` skeleton Story 3.2 + `compute-median-price.usecase` skeleton + cron compute-medians + ListingPublicationService.shouldAutoPublish wire — Story 3.4 photos.length >= 3 invariant ready)

---

**Dev agent next steps :**
1. Lire ce file complètement
2. Vérifier upstream Stories 0.2, 0.6, 0.7, 0.10, 1.2, 1.3, 2.1, 2.7, 3.2, 3.3 implémentées
3. Implémenter Tasks 1-14 dans l'ordre (events Task 1 → scaffolding Task 2 → migration Task 3 → domain Task 4 → R2 infra Task 5 → CF Images infra Task 6 → use cases Task 7 → gateway Task 8 → cron Task 9 → Story 3.3 MOCK replace Task 10 → infra provisioning Task 11 → métriques Task 12 → tests Task 13 → docs Task 14)
4. Lancer `pnpm vitest --filter=media-svc` après chaque jalon + `pnpm test:integration --filter=media-svc` (LocalStack + nock) + `pnpm playwright test --grep "photo upload"` après Task 10
5. Commit Story 3.4 quand : 10/10 e2e + 14/14 Story 3.3 regression pass + 8/8 integration testcontainer + coverage NFR71 + lint boundaries 0 + Lighthouse LCP < 2.5s assert + R2 bucket provisioned + CF Images variants configured + métriques validated
6. Update sprint-status : `3-4-...: review` puis `done`
