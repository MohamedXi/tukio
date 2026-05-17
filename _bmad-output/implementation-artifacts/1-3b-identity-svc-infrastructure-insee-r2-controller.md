# Story 1.3b: identity-svc infrastructure (INSEE apiKey + R2 S3 + ProProfile TypeORM + migration + controller `POST /internal/pros`)

Status: done

> 🧩 **Sub-story 2/4 de Story 1.3** (décomposée 2026-05-16 via `/bmad-correct-course`).
> Parent : `_bmad-output/implementation-artifacts/1-3-pro-registration-pending-admin-review.md` (umbrella source-of-truth des ACs/Dev Notes complets).
> Proposal : `_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-16.md`.
> Dépend de : **1.3a livré + mergé** (domain + ports + use case).
> Sub-stories suivantes : `1-3c-gateway-api-pro-register-multipart-forwarder` → `1-3d-frontend-wizard-seller-middleware-e2e-observability`.

## Story

**As a** dev backend qui implémente Epic 1 Story 1.3,
**I want** que toute l'infrastructure identity-svc pour register Pro soit livrée et testée :
1. `InseeSiretValidatorService` adapter `IInseeSiretValidator` (1.3a) — auth **apiKey direct** via header `X-INSEE-Api-Key-Integration` (⚠️ **deviation parent Story 1.3 ligne 768 qui mentionne OAuth2 client_credentials — faux après test live 2026-05-16**) ;
2. `R2MediaStorageService` adapter `IMediaStorage` (1.3a) — AWS SDK S3 v3 (`@aws-sdk/client-s3` + `s3-request-presigner`) wrappant Cloudflare R2 endpoint `https://<account_id>.eu.r2.cloudflarestorage.com` avec server-side encryption AES256 + signed URLs 5 min TTL ;
3. `ProProfileEntity` + `ProProfileMapper` + `ProProfileTypeormRepository` impl `IProProfileRepository` (1.3a) — TypeORM avec `runInTransaction` partageant le QueryRunner avec `OutboxPublisher` Story 0.7 ;
4. Migration TypeORM `1715240000000-CreateProProfilesTable.ts` + ajout au registre `migrations/index.ts` (auto-run boot via `migrationsRun: true` Story 1.2b PR #41) ;
5. UseCasesProxyModule wire `REGISTER_PRO_USECASES_PROXY` (DI 7 ports) ;
6. Controller HTTP `POST /internal/pros` (internal-only `InternalServiceGuard` HMAC Story 1.2b) avec multer multipart parser (3 fichiers max 5 MB each, MIME whitelist) ;
7. Tests integration : `insee-siret-validator.integration.spec.ts` (`nock` mock INSEE API), `r2-media-storage.integration.spec.ts` (`aws-sdk-client-mock`), `pro-profile.typeorm.repository.integration.spec.ts` (Postgres testcontainer Story 0.9), `pro-register.e2e-spec.ts` (Nest e2e harness),
**so that** le sub-story 1.3c (gateway-api BFF) puisse forwarder vers `POST /internal/pros` sur identity-svc avec une garantie infra complète, et que **le pattern "external validation API + S3-compatible storage chiffré"** devienne template canonique copiable par Stories 2.1 (Stripe Connect Express), 3.4 (photo upload listing), 4.x (booking attachments).

> **Outcome attendu** : à la fin de 1.3b, `pnpm --filter=identity-svc test:integration insee-siret-validator` passe (mock nock 200/404/429/5xx), `pnpm --filter=identity-svc test:integration r2-media-storage` passe (mock aws-sdk-client-mock upload/getSignedUrl/delete), `pnpm --filter=identity-svc test:integration pro-profile.typeorm.repository` passe (Postgres testcontainer findBySiret/save/runInTransaction), `pnpm --filter=identity-svc test:e2e pro-register.e2e-spec.ts` passe (6+ cases multipart upload + INSEE mock + R2 mock). 4 secrets droplet provisionnés. Migration appliquée automatiquement au boot. Endpoint `POST /internal/pros` répond 201 enveloppe canonique (via `InternalServiceGuard` HMAC).

## Acceptance Criteria (héritées de Story 1.3)

Cette story couvre **AC5** (infrastructure) et **AC6** (controller interne) intégralement. Les ACs 1, 2, 3, 4, 7, 8, 9, 10 sont couvertes par les autres sub-stories.

### AC1 (1.3b) — `InseeSiretValidatorService` (deviation parent : apiKey direct)

Voir parent ligne 560-643 pour la spec INSEE complète (à ignorer pour l'auth model). Sub-story dévie sur **3 points** :

- ❌ Parent : `OAuth2 client_credentials + cache token + parse V3.11 response` (ligne 768)
- ✅ Sub-story 1.3b : header HTTP `X-INSEE-Api-Key-Integration: <api-key>` direct, **pas de token cache nécessaire**

- `apps/identity-svc/src/infrastructure/external/insee/insee-siret-validator.service.ts` (NEW) — implements `IInseeSiretValidator` :
  ```ts
  // Pseudo-code
  async validate(siret: Siret) {
    const url = `${this.config.inseeApiUrl}/api-sirene/3.11/siret/${siret.value}`;
    const resp = await this.http.get(url, {
      headers: { 'X-INSEE-Api-Key-Integration': this.config.inseeApiKey },
      timeout: 5000,
    });
    if (resp.status === 404) throw new IdentityValidationException('IDENTITY-VALIDATION-003', 'SIRET inconnu INSEE');
    if (resp.status === 429) throw new InseeRateLimitError(parseInt(resp.headers['x-rate-limit-reset']));
    if (resp.status >= 500) throw new InseeUnreachableError();
    const e = resp.data.etablissement;
    return {
      etatAdministratif: e.uniteLegale.etatAdministratifUniteLegale, // 'A' | 'C'
      denomination: e.uniteLegale.denominationUniteLegale,
      dateCreation: e.uniteLegale.dateCreationUniteLegale,
      categorieJuridique: e.uniteLegale.categorieJuridiqueUniteLegale,
      address: Address.create({
        street: `${e.adresseEtablissement.numeroVoieEtablissement} ${e.adresseEtablissement.typeVoieEtablissement} ${e.adresseEtablissement.libelleVoieEtablissement}`.trim(),
        postalCode: e.adresseEtablissement.codePostalEtablissement,
        city: e.adresseEtablissement.libelleCommuneEtablissement,
        country: 'FR',
      }),
    };
  }
  ```
- `apps/identity-svc/src/infrastructure/external/insee/errors.ts` (NEW) — `InseeUnreachableError`, `InseeRateLimitError extends Error { retryAfterMs: number }`
- `apps/identity-svc/src/infrastructure/external/insee/insee.module.ts` (NEW) — NestJS module provider `INSEE_SIRET_VALIDATOR` → `InseeSiretValidatorService`
- `apps/identity-svc/src/infrastructure/external/insee/insee-siret-validator.integration.spec.ts` (NEW) — `nock` mock 7+ cases : 200 active (`etatAdministratifUniteLegale: 'A'`), 200 inactive (`'C'`), 404 SIRET inconnu, 429 rate limit (vérifier retryAfter parsed), 401 apiKey invalid, 5xx retry behavior, timeout
- ⚠️ Pas de `InseeTokenCacheService` (deviation parent — apiKey static, no token)

### AC2 (1.3b) — `R2MediaStorageService` (AWS SDK S3 v3 + SSE AES256 + signed URLs 5 min)

Voir parent ligne 560-643 pour la spec storage.

- `apps/identity-svc/src/infrastructure/external/r2/r2-media-storage.service.ts` (NEW) — implements `IMediaStorage` :
  ```ts
  this.s3 = new S3Client({
    region: 'auto',
    endpoint: this.config.r2Endpoint, // https://<acc>.eu.r2.cloudflarestorage.com
    credentials: { accessKeyId: ..., secretAccessKey: ... },
    forcePathStyle: false,
  });
  // upload : PutObjectCommand avec ServerSideEncryption: 'AES256', ContentType, Metadata
  // getSignedUrl : @aws-sdk/s3-request-presigner getSignedUrl(client, new GetObjectCommand(...), { expiresIn: 300 })
  // delete : DeleteObjectCommand
  ```
- `apps/identity-svc/src/infrastructure/external/r2/r2.module.ts` (NEW) — NestJS module provider `MEDIA_STORAGE` → `R2MediaStorageService`
- `apps/identity-svc/src/infrastructure/external/r2/errors.ts` (NEW) — `R2UploadError`, `R2NotFoundError`
- `apps/identity-svc/src/infrastructure/external/r2/r2-media-storage.integration.spec.ts` (NEW) — `aws-sdk-client-mock` 5+ cases : upload OK avec SSE header, getSignedUrl 5 min TTL, delete OK, upload fail → R2UploadError, getSignedUrl object not found → R2NotFoundError

### AC3 (1.3b) — ProProfile TypeORM persistence + migration auto-run

- `apps/identity-svc/src/infrastructure/persistence/typeorm/entities/pro-profile.entity.ts` (NEW) — table `pro_profiles` colonnes : `id UUID PK`, `user_profile_id UUID FK CASCADE`, `company_name VARCHAR(200)`, `siret VARCHAR(14)` + unique partial index `WHERE deleted_at IS NULL`, `vat_number VARCHAR(15) NULL`, `address_street`, `address_postal_code VARCHAR(5)`, `address_city VARCHAR(100)`, `address_country CHAR(2) DEFAULT 'FR'`, `contact_phone VARCHAR(20)`, `kyc_status VARCHAR(30) DEFAULT 'pending_review'` + CHECK `IN ('pending_review','approved','rejected')`, `kyc_id_card_r2_key TEXT`, `kyc_rib_r2_key TEXT`, `kyc_kbis_r2_key TEXT NULL`, `insee_denomination TEXT`, `insee_date_creation DATE`, `insee_categorie_juridique VARCHAR(10)`, `created_at`, `updated_at`, `deleted_at`
- `apps/identity-svc/src/infrastructure/persistence/typeorm/mappers/pro-profile.mapper.ts` (NEW)
- `apps/identity-svc/src/infrastructure/persistence/typeorm/repositories/pro-profile.typeorm.repository.ts` (NEW) — implements `IProProfileRepository`, `runInTransaction` partage QueryRunner avec `OutboxPublisher` (pattern Story 1.2b)
- `apps/identity-svc/src/infrastructure/persistence/typeorm/migrations/1715240000000-CreateProProfilesTable.ts` (NEW) — voir parent ligne 567-625 SQL exact
- `apps/identity-svc/src/infrastructure/persistence/typeorm/migrations/index.ts` (UPDATE) — ajouter `CreateProProfilesTable1715240000000` à `ALL_MIGRATIONS` (PR #41 pattern auto-run boot)
- `apps/identity-svc/src/app.module.ts` (UPDATE) — ajouter `ProProfileEntity` au `entities` array
- `apps/identity-svc/src/infrastructure/persistence/typeorm/data-source.ts` (UPDATE) — ajouter `ProProfileEntity` à `entities` (CLI)
- `apps/identity-svc/src/infrastructure/persistence/typeorm/pro-profile.typeorm.repository.integration.spec.ts` (NEW) — Postgres testcontainer Story 0.9 + 6+ cases : save crée la ligne, findBySiret retourne null si pas trouvé, findBySiret retourne ProProfile si actif, findBySiret retourne null si soft-deleted, unique constraint siret race violation, runInTransaction rollback

### AC4 (1.3b) — UseCasesProxyModule wire + ProController + tests E2E

- `apps/identity-svc/src/infrastructure/usecases-proxy/usecases-proxy.module.ts` (UPDATE) — ajouter provider `REGISTER_PRO_USECASES_PROXY` qui wire `RegisterProUseCase` avec ses 7 ports (KeycloakAdmin + UserProfileRepo + ProProfileRepo + InseeValidator + MediaStorage + OutboxPublisher + EventPublisher)
- `apps/identity-svc/src/infrastructure/http/controllers/pro.controller.ts` (NEW) — endpoint `POST /internal/pros` (URI versioning `defaultVersion: '1'` → mounted `/v1/internal/pros`), `@UseGuards(InternalServiceGuard)` Story 1.2b HMAC, multer parser :
  ```ts
  @Post()
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'idCard', maxCount: 1 },
    { name: 'rib', maxCount: 1 },
    { name: 'kbisOrInsee', maxCount: 1 },
  ], { limits: { fileSize: 5 * 1024 * 1024 } }))
  async register(@Body() body: RegisterProInputBody, @UploadedFiles() files: { idCard: Express.Multer.File[], rib: Express.Multer.File[], kbisOrInsee?: Express.Multer.File[] }) {
    return this.useCase.execute({ input: body, files: sortFilesByFieldname(files) });
  }
  ```
- `apps/identity-svc/src/infrastructure/http/dtos/register-pro-input.dto.ts` (NEW) — Zod-pipe wrapping `RegisterProInputSchema` `@tukio/contracts`
- `apps/identity-svc/src/infrastructure/http/utils/sort-files-by-fieldname.ts` (NEW) — helper partagé futur 1.3c (gateway-api copy)
- `apps/identity-svc/src/infrastructure/http/http.module.ts` (UPDATE) — ajouter `ProController` à `controllers`
- `apps/identity-svc/.env.example` (UPDATE) — ajouter `INSEE_API_URL=https://api.insee.fr`, `INSEE_API_KEY=` (vide), `R2_KYC_ENDPOINT=`, `R2_KYC_ACCESS_KEY_ID=`, `R2_KYC_SECRET_ACCESS_KEY=`, `R2_KYC_BUCKET=tukio-kyc-staging`
- `apps/identity-svc/src/infrastructure/config/environment-config.service.ts` (UPDATE) — ajouter `getInseeConfig() : { apiUrl, apiKey }` + `getR2KycConfig() : { endpoint, bucket, accessKeyId, secretAccessKey }`, Zod-validated avec prod-required guards (pattern Story 1.2b)
- `apps/identity-svc/src/infrastructure/config/env.schema.ts` (UPDATE) — Zod schema pour les 5 nouvelles env vars
- `apps/identity-svc/test/pro-register.e2e-spec.ts` (NEW) — Nest e2e harness avec testcontainers Keycloak + Postgres + nock INSEE + aws-sdk-client-mock R2, 6+ cases : 201 happy path, 422 INSEE inactive, 422 Luhn invalid, 409 SIRET déjà actif, 409 email conflict (Keycloak race), 502 R2 fail + rollback Keycloak, 502 INSEE 5xx

## Tasks / Subtasks

- [x] **Task 1 — InseeSiretValidator + module + tests integration** (AC: #1) — Story 1.3 parent Task 4.2-4.5 (modifié — pas de OAuth2)
  - [x] 1.1 — Créer `insee-siret-validator.service.ts` (apiKey header direct, **pas** de InseeTokenCacheService)
  - [x] 1.2 — Errors déjà dans `domain/ports/insee-siret-validator.port.ts` (pas de fichier infra séparé)
  - [x] 1.3 — Créer `insee/insee.module.ts`
  - [x] 1.4 — Tests integration `insee-siret-validator.integration.spec.ts` (nock 7+ cases)

- [x] **Task 2 — R2MediaStorage + module + tests integration** (AC: #2) — Story 1.3 parent Task 4.1, 4.6-4.8
  - [x] 2.1 — `pnpm --filter=identity-svc add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`
  - [x] 2.2 — Créer `r2-media-storage.service.ts` (S3Client config R2 + SSE AES256 + signed URLs)
  - [x] 2.3 — Errors dans `domain/ports/media-storage.port.ts` + `r2/r2.module.ts`
  - [x] 2.4 — Tests integration `r2-media-storage.integration.spec.ts` (aws-sdk-client-mock 5+ cases)

- [x] **Task 3 — ProProfile TypeORM persistence + migration auto-run** (AC: #3) — Story 1.3 parent Task 4.9-4.13
  - [x] 3.1 — Créer `pro-profile.entity.ts`
  - [x] 3.2 — Créer `pro-profile.mapper.ts`
  - [x] 3.3 — Créer `pro-profile.typeorm.repository.ts`
  - [x] 3.4 — Créer migration `1715240000000-CreateProProfilesTable.ts`
  - [x] 3.5 — Update `migrations/index.ts` (`ALL_MIGRATIONS` ← `CreateProProfilesTable1715240000000`)
  - [x] 3.6 — Update `app.module.ts` + `data-source.ts` (ajouter `ProProfileEntity` à entities)
  - [x] 3.7 — Tests integration `pro-profile.typeorm.repository.integration.spec.ts` (Postgres testcontainer 6+ cases)

- [x] **Task 4 — UseCasesProxyModule wire + ProController + e2e** (AC: #4) — Story 1.3 parent Task 5
  - [x] 4.1 — Update `usecases-proxy.module.ts` (ajouter `REGISTER_PRO_USECASES_PROXY`)
  - [x] 4.2 — Installé `@fastify/multipart` (Fastify adapter, pas multer/Express)
  - [x] 4.3 — Créer `pro.controller.ts` (structural type MultipartHttpRequest + InternalServiceGuard)
  - [x] 4.4 — Créer `utils/parse-multipart-pro-register.ts` (parse payload + files + MIME whitelist)
  - [x] 4.5 — `parse-multipart-pro-register.ts` inclut la validation payload via `RegisterProInputSchema`
  - [x] 4.6 — Update `http.module.ts` (ajouter `ProController`)
  - [x] 4.7 — Update `.env.example` (6 nouvelles vars INSEE + R2)
  - [x] 4.8 — Update `environment-config.service.ts` + `env.schema.ts` + `config.port.ts`
  - [x] 4.9 — Tests e2e `pro-register.e2e-spec.ts` (5 cases : happy path + inactive + luhn + no hmac + r2 fail)

- [x] **Task 5 — Secrets provisioning + smoke test staging** (PRÉ-REQUIS OPS avant deploy)
  - [ ] 5.1 — Ismael : provisionner 4 secrets dans `/home/tukio/tukio/secrets/` du droplet data : `insee_api_key`, `r2_kyc_endpoint`, `r2_kyc_access_key_id`, `r2_kyc_secret_access_key`. Bucket = `tukio-kyc-staging` (déjà créé)
  - [x] 5.2 — Update `infra/docker-compose/apps.prod.yml` : injecter 5 vars INSEE+R2 dans le service identity-svc
  - [x] 5.3 — Update `.github/workflows/deploy-staging.yml` : export les 4 nouveaux secrets dans les 2 SSH deploy steps
  - [ ] 5.4 — Smoke test live staging : `curl -X POST https://api.tukio.one/v1/auth/pro/register ...` après merge 1.3c (sub-story suivante)

### Review Findings (code-review 2026-05-17)

Parallel adversarial review (Blind Hunter + Edge Case Hunter + Acceptance Auditor) — 68 raw findings → 4 décisions + 25 patches + 7 deferred + 12 dismissed.

#### Decisions (à résoudre par Ismael avant patches)

- [x] [Review][Decision] D1 — InternalServiceGuard cannot validate multipart requests in production [`apps/identity-svc/src/infrastructure/http/guards/internal-service.guard.ts:155-170` + `apps/identity-svc/src/main.ts`] — Fastify ne peuple ni `request.rawBody` ni `request.body` pour multipart (parsing opt-in via `req.parts()` qui est appelé APRÈS le guard). Au moment du guard, `request.body === undefined` → `computeBodySha256` hashe `''`. Le gateway-api computera le hash sur les bytes réels → **chaque POST /internal/pros multipart retourne 403 en production**. Options : (1) ajouter `addContentTypeParser` pour `multipart/form-data` qui capture les raw bytes dans `request.rawBody` avant le guard, (2) skip body-hash binding pour multipart (rely on ts + token alone), (3) faire signer au gateway-api un canonical sans body-hash pour les endpoints multipart.
- [x] [Review][Decision] D2 — ProProfileMapper wipe systématique des `kycDecision*` à null sur chaque save [`apps/identity-svc/src/infrastructure/persistence/typeorm/mappers/pro-profile.mapper.ts:67-69`] — l'aggregate ne porte pas `kycDecisionAt/By/Reason` (write-only-once assumption). Quand Story 2.3/2.4 (admin approval) update kycStatus puis save, le mapper efface silencieusement l'audit trail KYC. Options : (a) étendre `ProProfile` aggregate avec champs `kycDecision*` et round-trip propre (correct mais scope plus large), (b) load-modify-save dans le repo : lire entity existante, ne mettre à jour QUE les champs aggregate, laisser kycDecision intact (plus simple, mais coupe la transparence load→domain→save).
- [x] [Review][Decision] D3 — Column schema deviation vs parent : `insee_naf` supprimé, `incorporation_date` typé VARCHAR au lieu de DATE [`apps/identity-svc/src/infrastructure/persistence/typeorm/migrations/1715240000000-CreateProProfilesTable.ts`] — parent SQL (ligne 625-654) prescrit `insee_naf VARCHAR(10) NULL` + dates en TIMESTAMPTZ. 1.3b a remplacé par `insee_incorporation_date VARCHAR(10)` + `insee_legal_category VARCHAR(10)`, en droppant NAF. AC10 metrics dashboard parent dépend du NAF code. Options : (a) ré-ajouter `insee_naf VARCHAR(10) NULL`, (b) changer `incorporation_date` de VARCHAR(10) à DATE, (c) documenter la déviation dans Change Log et amender parent spec.
- [x] [Review][Decision] D4 — `R2_KYC_BUCKET` hardcoded staging dans `apps.prod.yml` + `INSEE_API_URL` jamais exporté par le workflow [`infra/docker-compose/apps.prod.yml:122` + `.github/workflows/deploy-staging.yml`] — **Decision (Ismael 2026-05-17): Option (b) staging-only jusqu'à go-live prod**. Documenté en defer W8.

#### Patches (corrigeables sans input — appliquer après les décisions)

- [x] [Review][Patch] P1 — E2E HMAC header scheme broken (3 headers attendus, 1 envoyé en ms) [`apps/identity-svc/test/pro-register.e2e-spec.ts:55-72,87-100,164-173,219-238`] — guard attend `x-internal-service-token`, `x-internal-service-timestamp` (Unix secondes), `x-internal-service-body-sha256`. Test envoie `x-tukio-internal-signature: ts=<ms>,sig=<hex>`. **Tous les tests "happy/422/422/502" retournent 401 actuellement**. Aligner sur `customer-register.e2e-spec.ts:63-64`.
- [x] [Review][Patch] P2 — Multipart fileSize silently truncates (no `throwFileSizeLimit`) [`apps/identity-svc/src/main.ts:25` + `apps/identity-svc/src/infrastructure/http/utils/parse-multipart-pro-register.ts:52`] — un upload 100 MB devient un blob 5 MB tronqué, user voit 201 success avec KYC corrompu. Ajouter `throwFileSizeLimit: true` et catch `FST_REQ_FILE_TOO_LARGE` → 413.
- [x] [Review][Patch] P3 — Repo integration test viole FK `user_profile_id REFERENCES user_profiles(id)` [`apps/identity-svc/src/infrastructure/persistence/typeorm/pro-profile.typeorm.repository.integration.spec.ts:111-167`] — `beforeEach` ne crée pas le parent `user_profiles`. **Les 6 tests échouent dès le premier save**. Insérer un `user_profiles` row dans `beforeEach`.
- [x] [Review][Patch] P4 — Test "unique index siret" tape sur `user_profile_id UNIQUE` au lieu de l'index partiel siret [`pro-profile.typeorm.repository.integration.spec.ts:145-154`] — les 2 profiles partagent `TEST_USER_PROFILE_ID`. Utiliser 2 userProfileIds différents (et insérer 2 parents user_profiles).
- [x] [Review][Patch] P5 — INSEE 401/403 wrongly classified as `InseeUnreachableError` [`apps/identity-svc/src/infrastructure/external/insee/insee-siret-validator.service.ts:68-73`] — apiKey expirée = config bug, pas outage réseau. Créer un `InseeAuthFailedError` distinct et un `IDENTITY-EXTERNAL-004` côté contracts, ou logger au moins un warn explicite "INSEE auth failed" pour alerting.
- [x] [Review][Patch] P6 — Production fail-fast sur `INSEE_API_KEY` vide [`apps/identity-svc/src/infrastructure/config/env.schema.ts`] — Zod marque `optional()` donc env-validation passe silencieusement. Premier register pro → 502 wrapped. Ajouter le check au pattern existant `DEV_FALLBACKS` : refuser de booter en production avec `INSEE_API_KEY` vide.
- [x] [Review][Patch] P7 — Multipart parser sans `files`/`parts`/`fieldSize` limits [`apps/identity-svc/src/main.ts:25` + `parse-multipart-pro-register.ts:52`] — spec dit "3 fichiers max" + parent dit `maxCount: 1` par field. Ajouter `limits: { fileSize: 5MB, files: 3, parts: 5, fieldSize: 1MB }` au registration global + au `req.parts()`.
- [x] [Review][Patch] P8 — Unknown file fieldnames silently consumed [`parse-multipart-pro-register.ts:61-65`] — `.resume()` puis `continue` = bandwidth consommé + JSON probing facile. Throw `BadRequestException` pour fieldname inconnu (strict mode).
- [x] [Review][Patch] P9 — Duplicate file fields overwrite silently [`parse-multipart-pro-register.ts:69-73`] — 2× `idCard` → le 2e écrase. Throw `BadRequestException('duplicate file field')`.
- [x] [Review][Patch] P10 — Missing e2e cases (409 SIRET, 409 email race, 502 INSEE 5xx, idempotence) [`apps/identity-svc/test/pro-register.e2e-spec.ts`] — spec exige 6+ cases ; 5 livrés (et P1 dit qu'ils ne run pas vraiment). Après P1, ajouter les 3 cases manquantes + assertion explicite des tukioCodes `IDENTITY-CONFLICT-001/002` + `IDENTITY-EXTERNAL-002`.
- [x] [Review][Patch] P11 — Mapper unsafe `as 'FR'` cast + JSONB address pas validé au boundary [`apps/identity-svc/src/infrastructure/persistence/typeorm/mappers/pro-profile.mapper.ts:30`] — futurs non-FR = invalid VO. Valider la shape JSONB et country dans `toDomain`, throw `CorruptedDataException` si invalide.
- [x] [Review][Patch] P12 — Mapper override de `createdAt`/`updatedAt` (DB default bypassed) [`pro-profile.mapper.ts:74-75`] — UserProfileEntity utilise `@CreateDateColumn`/`@UpdateDateColumn`, ProProfileEntity ne les a pas. Conséquence : `updated_at` ne reflète jamais le dernier write. Migrer ProProfileEntity vers les décorateurs TypeORM + retirer les assignations dans le mapper.
- [x] [Review][Patch] P13 — `inseeCheckedAt` set dans le mapper (mauvais layer + bug sémantique) [`pro-profile.mapper.ts:73`] — réinitialisé à chaque save, devient "quand on a sauvé" au lieu de "quand INSEE a été consulté". Déplacer dans le aggregate (`ProInseeSnapshot.checkedAt`), set par `register()`.
- [x] [Review][Patch] P14 — R2 `MediaStorageNotFoundError` branch is dead code [`apps/identity-svc/src/infrastructure/external/r2/r2-media-storage.service.ts:79-85`] — `getSignedUrl` du presigner signe localement, ne fait jamais d'appel réseau, donc ne throw jamais NoSuchKey. Le test `r2-media-storage.integration.spec.ts:86-99` confirme (assert `typeof url === 'string'`). Soit retirer la branch, soit ajouter un `headObject` explicite avant signing si la détection NotFound est requise.
- [x] [Review][Patch] P15 — INSEE retryAfterMs NaN handling + seconds-vs-ms ambiguity [`insee-siret-validator.service.ts:60-66`] — `parseInt('garbage', 10)` → NaN propagates. Aussi : header pourrait être en secondes (convention). Valider `Number.isFinite(resetMs)` et documenter le format attendu.
- [x] [Review][Patch] P16 — INSEE 2xx non-200 falls through to `.json()` throw [`insee-siret-validator.service.ts:75-91`] — 204 No Content body throws → wrapped en InseeUnreachableError. Ajouter check explicite `response.status === 200`.
- [x] [Review][Patch] P17 — Stale `multer` + `@types/multer` deps [`apps/identity-svc/package.json:42,63`] — pivoté vers `@fastify/multipart`, multer jamais importé. Bundle bloat + audit surface inutile. Retirer.
- [x] [Review][Patch] P18 — IConfigService mocks `getInseeConfig`/`getR2KycConfig` retournent undefined [`keycloak-admin.service.spec.ts:55-57`] — `jest.fn()` sans return → si un test indirect appelle, échec confus. Retourner stubs réalistes.
- [x] [Review][Patch] P19 — R2 partial-failure compensation race in Promise.all [`apps/identity-svc/src/usecases/register-pro.usecase.ts:260-301`] — Promise.all reject sur première erreur ; les `.then()` des autres uploads peuvent ne pas avoir tourné → `uploadedKeys.idCardR2Key === ''` → pas compensé → blob orphelin R2. Migrer vers `Promise.allSettled` + inspect each result.
- [x] [Review][Patch] P20 — `RegisterProProps.inseeAdministrativeStatus: 'active' \| 'ceased'` confusing [`apps/identity-svc/src/domain/model/pro-profile.aggregate.ts:69`] — type union mais factory throw sur non-active. Narrow le type à `'active'` (le caller a déjà la garde).
- [x] [Review][Patch] P21 — Assert TTL=300 dans R2 signed URL test [`r2-media-storage.integration.spec.ts:78-91`] — assertion actuelle = `typeof url === 'string'` only. Ajouter `expect(url).toContain('X-Amz-Expires=300')`.
- [x] [Review][Patch] P22 — INSEE ceased test ne vérifie que `administrativeStatus` [`insee-siret-validator.integration.spec.ts:439-450`] — régression silencieuse possible sur legalName/incorporationDate. Asserter les autres fields.
- [x] [Review][Patch] P23 — e2e ne set pas `TUKIO_INTERNAL_SERVICE_SECRET` explicitement [`apps/identity-svc/test/pro-register.e2e-spec.ts`] — dépend silencieusement de `.env`. Set explicitement dans le setup.
- [x] [Review][Patch] P24 — Story doc dit "5 nouvelles vars" et "6 vars" à 2 endroits — fixer cohérence (6 vars : INSEE_API_URL/KEY + R2_KYC_*).

#### Deferred (pré-existant ou hors scope)

- [x] [Review][Defer] W1 — R2 delete metadata manque `correlationId` (Story 1.10 reconciliation tracera) [`r2-media-storage.service.ts`]
- [x] [Review][Defer] W2 — prom-client counters `tukio_keycloak_orphan_users_total` / `tukio_r2_orphan_kyc_objects_total` / `tukio_insee_rate_limit_total` (Story 1.10 + Story 4.13 observability)
- [x] [Review][Defer] W3 — `ProTransactionContext.tokenRepo` leaky dep (touche le contrat de Story 1.3a)
- [x] [Review][Defer] W4 — `UserProfile.registerPro()` factory dédiée (TODO déjà inline ligne 317 ; Story 1.10)
- [x] [Review][Defer] W5 — INSEE retry on transient blips + circuit breaker (parent story scope, V1+)
- [x] [Review][Defer] W6 — ESLint disable `no-unsafe-*` sur `parse-multipart-pro-register.ts` → fix propre via tsconfig project service (non-bloquant)
- [x] [Review][Defer] W7 — MIME magic-byte validation déplacé en Defer (lib `file-type` à ajouter + admin review Story 2.3-2.4 fera la double-check à retrieve)
- [x] [Review][Defer] W8 — D4 résolu en "staging-only" : `R2_KYC_BUCKET` hardcoded à `tukio-kyc-staging` + `INSEE_API_URL` utilise le default Zod `https://api.insee.fr`. À reprendre dans le sprint dédié post-MVP go-live prod (créer secret droplet `r2_kyc_bucket` + ajouter export `INSEE_API_URL` au workflow).

## Dev Notes

### Deviation INSEE auth — flag CRITIQUE
- Parent Story 1.3 ligne 768 décrit `OAuth2 client_credentials + cache token + parse V3.11 response`
- **FAUX** après test live 2026-05-16 sur `GET https://api.insee.fr/api-sirene/3.11/siret/35600000000048` avec header `X-INSEE-Api-Key-Integration: <key>` → HTTP 200
- Sub-story dévie : pas de InseeTokenCacheService, pas d'OAuth2 endpoint, pas de refresh logic
- Justification : modèle d'auth INSEE Sirene V3.11 simplifié 2024 (token statique au lieu de OAuth2 v2)
- Documenter dans runbook `insee-sirene-integration.md` (1.3d Task 10)

### Rate limit INSEE
- 30 req/min par clé apiKey (`x-rate-limit-limit: 30`, `x-rate-limit-reset` Unix ms)
- 429 → `InseeRateLimitError` avec `retryAfterMs = x-rate-limit-reset - Date.now()`
- Use case mappe à `ExternalServiceException('IDENTITY-EXTERNAL-002')` avec `retryAfter` populated dans envelope (gateway-api forwarde via Retry-After header pattern Story 1.2c)

### R2 staging credentials (provisionnés 2026-05-16 par Ismael, hors repo)
- Endpoint : `https://0e633032f5574da7906045d298e5ee83.eu.r2.cloudflarestorage.com`
- Bucket : `tukio-kyc-staging`
- Access Key ID + Secret Access Key dans `/home/tukio/tukio/secrets/` du droplet data
- AWS SDK S3 v3 compatible avec `region: 'auto'`, `forcePathStyle: false`

### Pattern Pretre réutilisé Story 1.2b
- `InternalServiceGuard` HMAC `${ts}.POST.${path}.${sha256(body)}` — identique signature pour multipart (sha256 du body bytes inclut les files multipart)
- `runInTransaction` partage QueryRunner avec `OutboxPublisher`
- `migrationsRun: true` auto-applique au boot (PR #41)

### Hors scope 1.3b (couvert 1.3c/d)
- Endpoint public `POST /v1/auth/pro/register` (1.3c gateway-api)
- Throttling Redis pro-register 3/min (1.3c)
- Frontend wizard (1.3d)
- E2E Playwright (1.3d)
- Observability + Grafana dashboard + runbooks (1.3d)

## File List

### Nouveaux fichiers
- `apps/identity-svc/src/infrastructure/external/insee/insee-siret-validator.service.ts`
- `apps/identity-svc/src/infrastructure/external/insee/insee.module.ts`
- `apps/identity-svc/src/infrastructure/external/insee/insee-siret-validator.integration.spec.ts`
- `apps/identity-svc/src/infrastructure/external/r2/r2-media-storage.service.ts`
- `apps/identity-svc/src/infrastructure/external/r2/r2.module.ts`
- `apps/identity-svc/src/infrastructure/external/r2/r2-media-storage.integration.spec.ts`
- `apps/identity-svc/src/infrastructure/persistence/typeorm/entities/pro-profile.entity.ts`
- `apps/identity-svc/src/infrastructure/persistence/typeorm/mappers/pro-profile.mapper.ts`
- `apps/identity-svc/src/infrastructure/persistence/typeorm/repositories/pro-profile.typeorm.repository.ts`
- `apps/identity-svc/src/infrastructure/persistence/typeorm/migrations/1715240000000-CreateProProfilesTable.ts`
- `apps/identity-svc/src/infrastructure/persistence/typeorm/pro-profile.typeorm.repository.integration.spec.ts`
- `apps/identity-svc/src/infrastructure/http/controllers/pro.controller.ts`
- `apps/identity-svc/src/infrastructure/http/utils/parse-multipart-pro-register.ts`
- `apps/identity-svc/test/pro-register.e2e-spec.ts`

### Fichiers modifiés
- `apps/identity-svc/src/domain/ports/config.port.ts` — ajout `InseeConfig`, `R2KycConfig`, 3 méthodes IConfigService
- `apps/identity-svc/src/infrastructure/config/env.schema.ts` — ajout 6 vars INSEE + R2
- `apps/identity-svc/src/infrastructure/config/environment-config.service.ts` — implémentation 3 nouveaux getters
- `apps/identity-svc/src/infrastructure/persistence/typeorm/migrations/index.ts` — ajout `CreateProProfilesTable1715240000000`
- `apps/identity-svc/src/infrastructure/persistence/typeorm/typeorm-repositories.module.ts` — ajout `ProProfileEntity` + `ProProfileTypeormRepository`
- `apps/identity-svc/src/app.module.ts` — ajout `ProProfileEntity` à `entities`
- `apps/identity-svc/src/infrastructure/persistence/typeorm/data-source.ts` — ajout `ProProfileEntity`
- `apps/identity-svc/src/infrastructure/usecases-proxy/usecases-proxy.module.ts` — ajout `InseeModule`, `R2Module`, `REGISTER_PRO_USECASES_PROXY`
- `apps/identity-svc/src/infrastructure/http/http.module.ts` — ajout `ProController`
- `apps/identity-svc/src/main.ts` — enregistrement `@fastify/multipart`
- `apps/identity-svc/.env.example` — 6 nouvelles vars
- `apps/identity-svc/eslint.config.mjs` — override `no-unsafe-*` pour `parse-multipart-pro-register.ts`
- `apps/identity-svc/src/infrastructure/external/keycloak/keycloak-admin.service.spec.ts` — mock IConfigService étendu
- `apps/identity-svc/src/infrastructure/external/keycloak/keycloak-admin.service.integration.spec.ts` — mock IConfigService étendu
- `infra/docker-compose/apps.prod.yml` — 5 vars INSEE+R2 dans identity-svc
- `.github/workflows/deploy-staging.yml` — export 4 secrets dans 2 SSH steps

## Change Log

- 2026-05-16 : Story 1.3b implémentée — INSEE adapter (apiKey direct, nock 7 cases), R2 adapter (aws-sdk-client-mock 5 cases), ProProfile TypeORM (entity + mapper + repo + migration 1715240000000), UseCasesProxy REGISTER_PRO wiring 7 ports, ProController multipart via @fastify/multipart (structural type pattern), parse-multipart-pro-register utility + MIME whitelist, env.schema 6 vars + getters IConfigService, compose + workflow OPS. 184 unit tests pass. 0 lint errors. 0 typecheck errors. Integration + e2e specs livrés non-exécutés (require docker:up — accord Ismael pattern Story 1.2b).
- 2026-05-17 : Code-review parallèle (Blind + Edge + Auditor) — 68 findings → 4 décisions résolues + 24 patches appliqués + 7 deferred + 12 dismissed.
  - **D1** (CRITIQUE) : InternalServiceGuard étendu avec sentinel `MULTIPART_BODY_HASH_SENTINEL` pour multipart (Fastify n'expose pas le rawBody multipart). Trade-off documenté : within 5min replay window un attaquant network-internal pourrait re-send avec body modifié, accepté MVP (DO firewall + V1+ mTLS Linkerd).
  - **D2** : `ProProfile` aggregate étendu avec `kycDecision: ProKycDecision` + mapper round-trip propre (Story 2.3-2.4 utilisera des méthodes domaine au lieu de SQL direct).
  - **D3** : Migration `pro_profiles` ajout `insee_naf VARCHAR(10) NULL` + `insee_incorporation_date` typé DATE (était VARCHAR(10)). Index `idx_pro_profiles_siret_active` renommé `uq_pro_profiles_siret`. `ProInseeSnapshot` étendu avec `naf` + `checkedAt`. Event `identity.pro.registered.v1` payload + JSON schema ajout `inseeNaf`.
  - **D4** : Staging-only assumption (W8 defer).
  - **P5** : Nouveau `IdentityErrorCodes.EXTERNAL_INSEE_AUTH_FAILED = 'IDENTITY-EXTERNAL-004'` + classe `InseeAuthFailedError` pour 401/403 distinct de l'outage.
  - **P2 + P7** : main.ts `@fastify/multipart` registered avec `throwFileSizeLimit: true` + `files: 3, parts: 5, fieldSize: 1MB` limits (was : seulement fileSize).
  - **P8 + P9** : parser rejette explicitement (400) les unknown file fieldnames + les duplicate fields.
  - **P3 + P4** : repo integration spec insère `user_profiles` parent rows dans `beforeEach` + utilise 2 userProfileIds distincts pour le test du SIRET unique index (asserte `constraint: 'uq_pro_profiles_siret'`).
  - **P6** : env.schema fail-fast en production sur `INSEE_API_KEY`/`R2_KYC_*` vides — mirror du pattern `DEV_FALLBACKS` existant.
  - **P11** : mapper `address.country` validé via `assertAddressJsonb` + `CorruptedDataException` au lieu de cast `as 'FR'`.
  - **P12 + P13** : entity utilise `@CreateDateColumn`/`@UpdateDateColumn` + mapper ne set plus `createdAt`/`updatedAt`/`inseeCheckedAt = new Date()` (semantic bug fixé).
  - **P14** : retiré dead `MediaStorageNotFoundError` branch de `getSignedUrl` (jamais déclenchée localement).
  - **P15** : INSEE retryAfterMs validé `Number.isFinite` + fallback 60s sur header malformé.
  - **P16** : INSEE check explicite `status === 200` (204/206 vont en InseeUnreachableError au lieu de JSON parse error).
  - **P17** : `multer` + `@types/multer` retirés (dead deps après le pivot Fastify).
  - **P18** : `keycloak-admin.service.spec.ts` mock IConfigService retourne des stubs réalistes pour les 3 nouveaux getters.
  - **P19** : R2 upload compensation utilise `Promise.allSettled` (was: `Promise.all` qui pouvait laisser des `uploadedKeys.*R2Key === ''` sur race → blobs orphelins).
  - **P1 + P10 + P23** : e2e refait — pattern HMAC à 3 headers correct, secret HMAC set explicitement, 7 cases (was: 5 cases + scheme broken), tukioCodes asserted explicitement (`IDENTITY-VALIDATION-003` + `IDENTITY-CONFLICT-002` + `IDENTITY-EXTERNAL-002` + `IDENTITY-EXTERNAL-003` + `IDENTITY-EXTERNAL-004`). Test exclu du run par défaut e2e (pattern Story 1.2b customer-register).
  - **P20** : `RegisterProProps.inseeAdministrativeStatus: 'active'` narrowed (was : `'active' \| 'ceased'` confus).
  - **P21 + P22** : assertions enrichies dans R2/INSEE integration tests (X-Amz-Expires=300 + ceased preserve all fields + 401 InseeAuthFailedError + 204 InseeUnreachableError + 429 NaN fallback).
  - **W1-W8** : 8 items deferred to `deferred-work.md`.
  - 187 unit tests pass (+3 nouveaux). 0 erreurs lint. 0 erreurs typecheck.

## Story Completion Status
- [x] All tasks complete (Task 5.1 et 5.4 : OPS Ismael + smoke post-merge 1.3c)
- [x] 4 tests integration suites livrés (INSEE nock 11 cases + R2 aws-sdk-client-mock 6 cases + ProProfileRepo Postgres 6 cases + e2e 7 cases post-review) — non-exécutés sans docker:up (accord pattern Story 1.2b)
- [x] Migration `CreateProProfilesTable1715240000000` dans `ALL_MIGRATIONS` → auto-run boot
- [x] compose YAML update + workflow SSH step update (Task 5.2-5.3 ✅)
- [x] `pnpm --filter=identity-svc lint && typecheck && test` pass (187 tests, 0 errors post-review)
- [x] Code-review parallèle complète : 4 décisions résolues + 24 patches appliqués + 8 deferred. Status `done`.
