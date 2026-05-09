# Story 2.4: Admin KYC review detail screen + signed URL preview

Status: ready-for-dev

## Story

**As an** Admin (`admin-support` / `admin-modo` / `admin-super`) sortant de la queue Story 2.3,
**I want** une **page admin detail** sur `admin.tukio.one/{locale}/verifications/{proProfileId}` qui affiche le **dossier KYC complet** d'un Pro `pending_admin_review` (sortant Story 1.3 register + Story 2.1 Stripe Connect submit) — exposée via gateway-api `GET /v1/admin/verifications/:proProfileId` qui forward identity-svc internal endpoint, retourne enveloppe ADR-014 `{ method:'GET', code:200, data: { proProfile: { id, userProfileId, companyName, siret, siretFormatted, vatNumber?, address: {...}, contactPhone, kycStatus, submittedAt, ageInHours, slaExceeded }, userProfile: { firstName, lastName, email, locale, createdAt }, kycDocs: [{ type: 'idCard'|'rib'|'kbisOrInsee', signedUrl, expiresAt, uploadedAt, mimeType, sizeBytes }], inseeSnapshot: { unitLegale: { siren, denomination, etatAdministratifUniteLegale, dateCreation, categorieJuridique }, etablissement: { siret, etatAdministratifEtablissement, adresse: {...}, dateCreation, activitePrincipaleEtablissement }, retrievedAt, source: 'live'|'cached', addressMatchesSubmitted: boolean, etablissementClosed: boolean }, stripeSnapshot: { stripeAccountId, status, chargesEnabled, payoutsEnabled, requirementsCurrentlyDue, lastSyncedAt, source: 'cached'|'live' } | null, history: [{ at, actor: { adminId, adminName, role }, action: 'admin.verification.viewed' | 'admin.verification.note-added' | 'admin.verification.accepted' | 'admin.verification.rejected', reason?, message? }] } }` ; **fetching strategy** : `proProfile + userProfile + kycDocs` lus en DB identity-svc (Story 1.3 R2 keys + Story 2.1 stripeStatus cached fields) ; **INSEE snapshot fetched live** via existing `IInseeSiretValidator` port Story 1.3 (NEW méthode `getEstablishmentSnapshot(siret)` Story 2.4 — cache Redis 1h key `tukio:insee:siret:{siret}` pour éviter spam API INSEE NFR79) — fallback gracieux si INSEE down (`source: 'cached'` + dernière snapshot stockée en `pro_profiles.insee_snapshot` JSONB NEW colonne Story 2.4) ; **Stripe snapshot** : cached state Story 2.1 (`pro_profiles.stripe_*` fields synced par webhooks `account.updated`) — bouton UI "Actualiser Stripe" déclenche `POST /v1/admin/verifications/:id/sync-stripe` qui forward payment-svc internal `POST /internal/stripe/accounts/sync-status` (réutilise SyncStripeStatusUseCase Story 2.1) → updated state retourné + UI re-fetch ; **history timeline** lue depuis `audit_log` table Story 1.10 (filter `aggregate_id = proProfileId AND aggregate_type = 'ProProfile' ORDER BY at DESC`) — montre toutes les actions admin précédentes (vues, notes, validate/reject) cohérent NFR82 audit trail ; **signed URLs KYC docs** générés via `IMediaStorage.getSignedDownloadUrl({ bucket: 'tukio-kyc', key, expiresInSeconds: 300 })` Story 1.3 (3 docs idCard + rib + kbisOrInsee?) — TTL 5 min strict NFR15 — chaque doc préviewé en `<KycDocLightbox>` (Story 2.4 NEW pattern) avec PDF.js ou `<img>` selon mimeType + bouton "Télécharger" + warning "Expire dans 5 min" ; **regenerate signed URLs** : si admin ferme tab + revient 6 min plus tard, page Server Component re-fetch automatiquement → nouveaux signed URLs (TTL court NFR15) ; **UI 4 sections** rendues `<VerificationDetailLayout>` (Story 2.4 NEW pattern) :
- (1) **Section "Société"** = `<CompanyInfoCard>` companyName + SIRET formaté + lien externe INSEE `https://avis-situation-sirene.insee.fr/{siren}` (target=_blank rel=noopener) + denomination INSEE + etablissementClosed banner danger si `etatAdministratifEtablissement === 'F'` ("⚠️ Établissement fermé selon INSEE — recommandation : Rejeter") + addressMatchesSubmitted banner warning orange si false (highlight les 2 adresses pour comparison visuelle)
- (2) **Section "Documents KYC"** = `<KycDocsSection>` 3 cards (idCard, rib, kbisOrInsee?) avec preview thumbnail (img ou icon PDF) + click → `<KycDocLightbox>` modale full-screen + bouton "Télécharger" (signed URL forced download avec `?download=1` query param)
- (3) **Section "Stripe"** = `<StripeSnapshotCard>` avec badges `chargesEnabled`/`payoutsEnabled` (vert/rouge) + status (`submitted`/`pending`/`requires_action`/`restricted`) + `requirementsCurrentlyDue` chips si non vide + bouton "Actualiser depuis Stripe" + lien externe Stripe Dashboard `https://dashboard.stripe.com/connect/accounts/{stripeAccountId}` (admin-super only — sinon hidden)
- (4) **Section "Historique"** = `<HistoryTimeline>` horizontal vertical timeline avec actions précédentes (mostly empty pour 1ʳᵉ vue, mais permet de voir si un autre admin a déjà vu/noté avant)

**Audit event publish** : à chaque ouverture de la page detail, identity-svc publie `admin.verification.viewed.v1` event NATS via outbox-relay Story 0.7 (payload `{ adminId, adminRole, proProfileId, viewedAt, correlationId }`) consumed par AuditLogConsumer Story 1.10 → INSERT `audit_log` row (NFR82 audit RGPD — qui a vu quoi quand) ; **NOT-publish-on-refresh** : rate-limit 1 audit event par admin × proProfileId × 5 min (utilise inbox idempotence pattern Story 0.7 — clé idempotence `viewed:{adminId}:{proProfileId}:{floor(timestamp/300)}`) pour éviter pollution audit_log si admin refresh la page ; **note pré-screening admin-support** : un admin-support ne peut PAS valider/rejeter (Story 2.5) mais peut ajouter une note interne via `<NoteInput>` (POST `/v1/admin/verifications/:id/notes` body `{ note }` ≤ 500 chars) — note persistée table `admin_notes` (NEW Story 2.4 — `id`, `pro_profile_id`, `actor_id`, `actor_role`, `note`, `created_at`) + publié `admin.verification.note-added.v1` event → audit_log → visible à tous admins dans History timeline pour faciliter handoff support→modo ; **CTAs validate/reject** : Story 2.5 ajoute les boutons (Story 2.4 livre uniquement le layout + sections data — boutons absents Story 2.4) — un admin-modo voit donc Story 2.4 sans actions (juste consultation) jusqu'à Story 2.5 dev, mais le hook `useAdminVerificationDetail` est conçu invalidation-friendly (re-fetch automatique post-Story 2.5 mutation) ; **RBAC** : `admin-support`/`admin-modo`/`admin-super` lecture autorisée + note-add ; **i18n strict** namespace `admin.verifications.detail.*` (~40 keys) ; **accessibility RGAA AA** axe-core 0 violations + `<KycDocLightbox>` focus trap + Esc to close + `<HistoryTimeline>` semantic `<ol>`,
**so that** Léa (admin-support persona Tukio J5 user journey) ouvre un dossier en 30s + scan visuel des 4 sections + cross-check INSEE auto-validé + preview KYC docs sans télécharger + check Stripe status + voir si un autre admin a touché le dossier + ajoute note pré-screening "RIB OK, attends validation pro tente vérifiée" + handoff à admin-modo qui prend décision Story 2.5 ; un admin-modo arrive sur la même page après pré-screen, voit la note, prend décision validate/reject (Story 2.5) en 1 min ; le **pattern `<VerificationDetailLayout>` + `<KycDocLightbox>` + `<HistoryTimeline>`** devient template Stories 6.4 (signalements detail), Story 10.x V1 (dispute detail admin), Story 6.5 (account suspension review).

> **Outcome attendu** : à la fin de cette story, Léa (admin-support) clique "Examiner" sur la queue Story 2.3 → navigue `/fr/verifications/{proProfileId}` → page Server Component fetch detail → affiche en < 800 ms p90 (NFR48 admin) les 4 sections complètes : Société (Marc Loueur SARL + SIRET 12345678901234 + INSEE actif vert ✓ + adresse correspond ✓), Documents KYC (3 thumbnails preview clickables : idCard JPG, RIB PDF, Kbis PDF), Stripe (badges submitted ✓ chargesEnabled ✓ payoutsEnabled ✓), Historique (vide — 1ʳᵉ vue, mais audit event publié) ; Léa clique sur "RIB" → `<KycDocLightbox>` ouvre PDF preview embed avec PDF.js, badge "Expire dans 4:52" countdown, focus trap activé, Esc ferme ; Léa ajoute une note "SIRET vérifié, RIB OK, KYC complet — prêt pour validation modo" → POST /v1/admin/verifications/.../notes → toast succès + history timeline updates avec sa note ; un admin-modo arrive 10 min plus tard sur la même page, voit la note de Léa + audit event "Léa a consulté le dossier 2026-05-09 14:32" ; un Pro avec INSEE etat='F' (établissement fermé) → banner danger rouge "Établissement fermé selon INSEE" + chip "Recommandation: Rejeter" ; un Pro avec adresse INSEE différente de l'adresse soumise → banner warning orange + 2 adresses side-by-side highlighted ; un admin clique "Actualiser Stripe" → POST sync-stripe → payment-svc retrieve account → re-fetch UI → updated state ; un admin ferme tab + revient 6 min plus tard → page re-fetch → nouveaux signed URLs (les anciens expired) ; un test `pnpm playwright test --grep "admin verification detail"` passe FR/EN axe-core 0 violations 9 scénarios (happy path FR/EN, INSEE closed banner, INSEE address mismatch, signed URL expiry regenerate, KYC doc lightbox PDF preview, KYC doc lightbox image preview, note add admin-support, RBAC admin-support cannot validate (Story 2.5), audit event published rate-limited 5 min) ; coverage ≥ 90 % use case + 80 % gateway + 80 % frontend.

## Acceptance Criteria

1. **AC1 — gateway-api endpoint `GET /v1/admin/verifications/:proProfileId`** : Given gateway-api Story 1.2/2.3, When un admin authentifié appelle `GET /v1/admin/verifications/{proProfileId}`, Then :
   - **Endpoint** :
     ```ts
     @Controller('/v1/admin/verifications')
     export class AdminVerificationsController {
       @Get('/:proProfileId')
       @UseGuards(KeycloakJwtGuard, RolesGuard)
       @Roles('admin-support', 'admin-modo', 'admin-super')
       @HttpCode(200)
       async getDetail(
         @Param('proProfileId', ParseUUIDPipe) proProfileId: string,
         @CurrentActor() actor: Actor,
       ): Promise<VerificationDetail> {
         return this.adminVerificationDetailForwarder.getInstance().getDetail({ proProfileId, actor });
       }
     }
     ```
   - **Validation** : `proProfileId` UUID v4 (Zod / Nest ParseUUIDPipe) — sinon 422 `IDENTITY-VALIDATION-001`
   - **Forwarder** appelle identity-svc `GET /internal/admin/verifications/:proProfileId` avec `X-Actor-Id`/`X-Actor-Role` headers + `X-Internal-Service-Token`
   - **Réponse enveloppe ADR-014** :
     ```json
     {
       "method": "GET",
       "code": 200,
       "data": {
         "proProfile": {
           "id": "uuid",
           "userProfileId": "uuid",
           "companyName": "Marc Loueur SARL",
           "siret": "12345678901234",
           "siretFormatted": "123 456 789 01234",
           "vatNumber": "FR12345678901",
           "address": { "street": "12 rue X", "postalCode": "44000", "city": "Nantes", "country": "FR" },
           "contactPhone": "+33612345678",
           "kycStatus": "pending_review",
           "submittedAt": "2026-05-08T10:00:00Z",
           "ageInHours": 12.5,
           "slaExceeded": false
         },
         "userProfile": {
           "firstName": "Marc",
           "lastName": "Dupont",
           "email": "marc@loueur.fr",
           "locale": "fr",
           "createdAt": "2026-05-08T09:55:00Z"
         },
         "kycDocs": [
           { "type": "idCard", "signedUrl": "https://...", "expiresAt": "2026-05-09T14:30:00Z", "uploadedAt": "2026-05-08T10:00:00Z", "mimeType": "image/jpeg", "sizeBytes": 234567 },
           { "type": "rib", "signedUrl": "https://...", "expiresAt": "...", "uploadedAt": "...", "mimeType": "application/pdf", "sizeBytes": 124567 },
           { "type": "kbisOrInsee", "signedUrl": "https://...", "expiresAt": "...", "uploadedAt": "...", "mimeType": "application/pdf", "sizeBytes": 156789 }
         ],
         "inseeSnapshot": {
           "uniteLegale": { "siren": "123456789", "denomination": "MARC LOUEUR SARL", "etatAdministratifUniteLegale": "A", "dateCreation": "2020-01-15", "categorieJuridique": "5499" },
           "etablissement": { "siret": "12345678901234", "etatAdministratifEtablissement": "A", "adresse": { "numeroVoieEtablissement": "12", "typeVoieEtablissement": "RUE", "libelleVoieEtablissement": "X", "codePostalEtablissement": "44000", "libelleCommuneEtablissement": "NANTES" }, "dateCreation": "2020-01-15", "activitePrincipaleEtablissement": "7721Z" },
           "retrievedAt": "2026-05-09T14:25:00Z",
           "source": "live",
           "addressMatchesSubmitted": true,
           "etablissementClosed": false
         },
         "stripeSnapshot": {
           "stripeAccountId": "acct_xxx",
           "status": "submitted",
           "chargesEnabled": true,
           "payoutsEnabled": true,
           "requirementsCurrentlyDue": [],
           "lastSyncedAt": "2026-05-08T11:00:00Z",
           "source": "cached"
         },
         "history": [
           { "at": "2026-05-09T14:00:00Z", "actor": { "adminId": "uuid", "adminName": "Léa Support", "role": "admin-support" }, "action": "admin.verification.viewed", "reason": null, "message": null },
           { "at": "2026-05-09T14:05:00Z", "actor": { "adminId": "uuid", "adminName": "Léa Support", "role": "admin-support" }, "action": "admin.verification.note-added", "reason": null, "message": "RIB OK, attente validation modo" }
         ]
       },
       "meta": { "timestamp": "...", "correlationId": "...", "locale": "fr" }
     }
     ```
   - **Errors** : `proProfileId` not found → 404 `IDENTITY-NOT-FOUND-002` ; `kycStatus !== 'pending_review' && !== 'under_review'` (déjà décidé) → 200 quand même mais `kycStatus = 'approved'|'rejected'` (admin can review history) — **PAS de redirect** (admin doit pouvoir consulter les anciens dossiers décidés pour audit) ; INSEE down → `inseeSnapshot.source = 'cached'` (fallback `pro_profiles.insee_snapshot`) ou `null` si jamais snapshot stored ; Stripe Account not yet created (Story 2.1 not done par ce Pro) → `stripeSnapshot = null`
   - **Throttle** : 60/min/user (admin browsing courant)
   - **Tests E2E** : query valid → 200 + 4 sections data. UUID malformé → 422. proProfileId inexistant → 404. RolesGuard non-admin → 403. INSEE down (mock) → fallback cached source. Stripe not created → `stripeSnapshot: null`.

2. **AC2 — identity-svc use case `GetVerificationDetailUseCase` + repos extensions** : Given Pretre architecture, When je consulte `apps/identity-svc/src/`, Then :
   - **NEW use case** `apps/identity-svc/src/usecases/get-verification-detail.usecase.ts` :
     ```ts
     @Injectable()
     export class GetVerificationDetailUseCase {
       constructor(
         @Inject(PRO_PROFILE_REPO) private readonly proProfileRepo: IProProfileRepository,
         @Inject(USER_PROFILE_REPO) private readonly userProfileRepo: IUserProfileRepository,
         @Inject(MEDIA_STORAGE) private readonly mediaStorage: IMediaStorage,
         @Inject(INSEE_SIRET_VALIDATOR) private readonly insee: IInseeSiretValidator,
         @Inject(PAYMENT_SVC_CLIENT) private readonly paymentSvc: IPaymentSvcClient,
         @Inject(AUDIT_HISTORY_REPO) private readonly auditHistoryRepo: IAuditHistoryRepository,
         @Inject(ADMIN_NOTE_REPO) private readonly adminNoteRepo: IAdminNoteRepository,
         @Inject(EVENT_PUBLISHER) private readonly eventPublisher: IEventPublisher,
         @Inject(IDEMPOTENCY_REPO) private readonly idempotencyRepo: IIdempotencyRepository,
         @Inject(LOGGER) private readonly logger: ILogger,
       ) {}

       async execute(input: { proProfileId: string; actor: { adminId: string; adminRole: 'admin-support' | 'admin-modo' | 'admin-super'; adminName: string }; correlationId: string }): Promise<VerificationDetail> {
         const proProfile = await this.proProfileRepo.findByIdWithUserProfile(input.proProfileId);
         if (!proProfile) throw new ProProfileNotFoundError(input.proProfileId);

         // 1. Generate 3 signed URLs (5 min TTL) — Story 1.3 IMediaStorage
         const kycDocs = await this.generateKycSignedUrls(proProfile);

         // 2. Fetch INSEE snapshot (live + cache 1h fallback to stored snapshot)
         const inseeSnapshot = await this.fetchInseeSnapshot(proProfile);

         // 3. Stripe snapshot (cached fields from pro_profiles — Story 2.1)
         const stripeSnapshot = proProfile.stripeAccountId ? this.buildStripeSnapshot(proProfile) : null;

         // 4. History from audit_log + admin_notes
         const history = await this.fetchHistory(proProfile.id);

         // 5. Audit event published with idempotency 5 min window (anti-refresh spam)
         await this.publishViewedEventWithIdempotency(proProfile.id, input.actor, input.correlationId);

         return { proProfile: this.toProDto(proProfile), userProfile: this.toUserDto(proProfile.userProfile!), kycDocs, inseeSnapshot, stripeSnapshot, history };
       }

       private async fetchInseeSnapshot(proProfile: ProProfile): Promise<InseeSnapshot | null> {
         try {
           const live = await this.insee.getEstablishmentSnapshot(proProfile.siret.value); // NEW Story 2.4 method, 1h Redis cache
           const addressMatches = this.compareAddresses(proProfile.address, live.etablissement.adresse);
           // Persist snapshot to pro_profiles.insee_snapshot for fallback (best-effort)
           await this.proProfileRepo.updateInseeSnapshot(proProfile.id, live).catch(err => this.logger.warn({ err }, 'insee_snapshot persist failed'));
           return { ...live, source: 'live', addressMatchesSubmitted: addressMatches, etablissementClosed: live.etablissement.etatAdministratifEtablissement === 'F' };
         } catch (err) {
           this.logger.warn({ err, siret: proProfile.siret.value }, 'INSEE live fetch failed, fallback cached');
           if (proProfile.inseeSnapshot) {
             return { ...proProfile.inseeSnapshot, source: 'cached', addressMatchesSubmitted: this.compareAddresses(proProfile.address, proProfile.inseeSnapshot.etablissement.adresse), etablissementClosed: proProfile.inseeSnapshot.etablissement.etatAdministratifEtablissement === 'F' };
           }
           return null; // Pas de snapshot ever
         }
       }

       private async publishViewedEventWithIdempotency(proProfileId: string, actor: { adminId: string; adminRole: string; adminName: string }, correlationId: string): Promise<void> {
         const window5min = Math.floor(Date.now() / (5 * 60 * 1000));
         const idempotencyKey = `admin.verification.viewed:${actor.adminId}:${proProfileId}:${window5min}`;
         const alreadyPublished = await this.idempotencyRepo.tryReserve(idempotencyKey, 5 * 60); // 5 min TTL
         if (!alreadyPublished) return; // Skip if same admin viewed within last 5 min
         await this.eventPublisher.publish({
           eventType: 'admin.verification.viewed',
           eventVersion: 'v1',
           aggregate: { type: 'ProProfile', id: proProfileId },
           actor: { userId: actor.adminId, role: actor.adminRole },
           correlationId,
           payload: { proProfileId, viewedAt: new Date().toISOString(), adminName: actor.adminName },
           occurredAt: new Date(),
         });
       }
     }
     ```
   - **NEW repository methods** :
     - `IProProfileRepository.findByIdWithUserProfile(id)` (JOIN `user_profiles` ON `pro_profiles.user_profile_id`)
     - `IProProfileRepository.updateInseeSnapshot(id, snapshot)` (UPDATE pro_profiles SET insee_snapshot = $jsonb WHERE id = $id — best-effort)
     - `IAuditHistoryRepository.findByAggregateId(aggregateId, aggregateType)` (NEW Story 2.4 — read-only query on `audit_log` table Story 1.10 — filter `aggregate_id = ? AND aggregate_type = ?` ORDER BY at DESC LIMIT 50)
     - `IAdminNoteRepository.findByProProfileId(proProfileId)` (NEW Story 2.4 — query `admin_notes` table NEW Story 2.4 AC4)
     - `IIdempotencyRepository.tryReserve(key, ttlSeconds)` (réutilisé Story 1.3 anti-refresh pattern — generic Redis SET NX EX)
   - **NEW DB columns** (migration `1715290100000-AddInseeSnapshotToProProfiles.ts`) :
     ```sql
     ALTER TABLE pro_profiles ADD COLUMN insee_snapshot JSONB NULL;
     -- No index needed (JSONB queried only by id lookup, not searched)
     ```
   - Tests unit ≥ 90 % use case (happy path + INSEE down fallback + Stripe null + idempotency window + signed URLs generated 3x)

3. **AC3 — INSEE port extended `getEstablishmentSnapshot(siret)` + Redis cache 1h** : Given Story 1.3 a livré `IInseeSiretValidator.checkActive(siret)` (boolean check), When Story 2.4 étend, Then :
   - **UPDATE port** `apps/identity-svc/src/domain/ports/insee-siret-validator.port.ts` :
     ```ts
     export interface IInseeSiretValidator {
       checkActive(siret: string): Promise<boolean>; // Story 1.3
       getEstablishmentSnapshot(siret: string): Promise<InseeEstablishmentSnapshot>; // NEW Story 2.4
     }
     export interface InseeEstablishmentSnapshot {
       uniteLegale: { siren: string; denomination: string; etatAdministratifUniteLegale: 'A' | 'C'; dateCreation: string; categorieJuridique: string };
       etablissement: { siret: string; etatAdministratifEtablissement: 'A' | 'F'; adresse: InseeAdresse; dateCreation: string; activitePrincipaleEtablissement: string };
       retrievedAt: string;
     }
     ```
   - **UPDATE service** `apps/identity-svc/src/infrastructure/external/insee/insee-siret-validator.service.ts` :
     ```ts
     async getEstablishmentSnapshot(siret: string): Promise<InseeEstablishmentSnapshot> {
       const cacheKey = `tukio:insee:siret:${siret}`;
       const cached = await this.cache.get<InseeEstablishmentSnapshot>(cacheKey);
       if (cached) return cached;

       const token = await this.getOAuthToken(); // OAuth2 client_credentials Story 1.3
       const [siretResp, sirenResp] = await Promise.all([
         this.http.get(`${this.config.inseeBaseUrl}/siret/${siret}`, { headers: { Authorization: `Bearer ${token}` } }),
         this.http.get(`${this.config.inseeBaseUrl}/siren/${siret.slice(0, 9)}`, { headers: { Authorization: `Bearer ${token}` } }),
       ]);
       const snapshot: InseeEstablishmentSnapshot = {
         uniteLegale: this.mapUniteLegale(sirenResp.data.uniteLegale),
         etablissement: this.mapEtablissement(siretResp.data.etablissement),
         retrievedAt: new Date().toISOString(),
       };
       await this.cache.set(cacheKey, snapshot, 60 * 60); // 1h TTL — INSEE data change rarely (NFR79 quota concern)
       return snapshot;
     }
     ```
   - **Errors** : 404 INSEE → throw `InseeSiretNotFoundError` ; 5xx INSEE → throw `InseeUnavailableError` (handled fallback in use case AC2) ; 429 throttled → exponential backoff retry max 2x then throw
   - **Quota awareness NFR79** : INSEE SIRENE API V3.11 free tier = 30 req/min. Cache 1h éliminé 99 % du trafic répété. Métrique `tukio_insee_api_calls_total{cache_hit}` (Prom) pour monitor quota.
   - Tests integration : mock INSEE HTTP via `nock` ou MSW → snapshot returned + cache hit on 2nd call same SIRET + INSEE down → throws expected error

4. **AC4 — Table `admin_notes` + use case `AddAdminNoteUseCase` + endpoint** : Given pattern admin pre-screening, When je consulte les nouveaux fichiers, Then :
   - **NEW migration** `1715290200000-CreateAdminNotesTable.ts` :
     ```sql
     CREATE TABLE admin_notes (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       pro_profile_id UUID NOT NULL REFERENCES pro_profiles(id) ON DELETE CASCADE,
       actor_id UUID NOT NULL,
       actor_role VARCHAR(30) NOT NULL CHECK (actor_role IN ('admin-support', 'admin-modo', 'admin-super')),
       actor_name VARCHAR(120) NOT NULL,
       note TEXT NOT NULL CHECK (LENGTH(note) BETWEEN 1 AND 500),
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     );
     CREATE INDEX idx_admin_notes_pro_profile_id_created_at ON admin_notes (pro_profile_id, created_at DESC);
     ```
   - **NEW domain aggregate** `apps/identity-svc/src/domain/model/admin-note.aggregate.ts` (lightweight VO + invariants — note 1-500 chars)
   - **NEW use case** `apps/identity-svc/src/usecases/add-admin-note.usecase.ts` :
     - INSERT note in DB transaction + outbox publish `admin.verification.note-added.v1` (consumed by AuditLogConsumer Story 1.10 → audit_log INSERT)
     - Invariants : `note.length BETWEEN 1 AND 500`, `actor_role IN admin-*`, `proProfile must exist + kycStatus ∈ {pending_review, under_review}` (no notes after final decision)
   - **NEW gateway endpoint** `POST /v1/admin/verifications/:proProfileId/notes` :
     ```ts
     @Post('/:proProfileId/notes')
     @UseGuards(KeycloakJwtGuard, RolesGuard)
     @Roles('admin-support', 'admin-modo', 'admin-super')
     @HttpCode(201)
     async addNote(
       @Param('proProfileId', ParseUUIDPipe) proProfileId: string,
       @Body() body: AddNoteInput,
       @CurrentActor() actor: Actor,
     ): Promise<{ noteId: string; createdAt: string }> {
       return this.adminNoteForwarder.getInstance().addNote({ proProfileId, note: body.note, actor });
     }
     ```
   - **Validation Zod** `AddNoteInputSchema` : `note: z.string().trim().min(1).max(500)`
   - **NEW NATS event schema** `packages/contracts/src/events/admin/verification-note-added.v1.{schema.json,ts}` (cohérent Story 0.2 envelope) — payload `{ noteId, proProfileId, actorId, actorRole, actorName, note, createdAt }`
   - Tests : note add happy path → 201 + audit event + history timeline updated. Note > 500 chars → 422. Pro `kycStatus='approved'` → 422 `ADMIN-NOTE-INVALID-001` "Cannot add note after final decision". Non-admin → 403.

5. **AC5 — Stripe sync endpoint `POST /v1/admin/verifications/:id/sync-stripe`** : Given admin clic "Actualiser depuis Stripe", When le forwarder tape payment-svc internal, Then :
   - **NEW gateway endpoint** :
     ```ts
     @Post('/:proProfileId/sync-stripe')
     @UseGuards(KeycloakJwtGuard, RolesGuard)
     @Roles('admin-modo', 'admin-super') // admin-support readonly
     @HttpCode(200)
     async syncStripe(
       @Param('proProfileId', ParseUUIDPipe) proProfileId: string,
       @CurrentActor() actor: Actor,
     ): Promise<StripeSnapshotDto> {
       return this.adminStripeSyncForwarder.getInstance().syncStripe({ proProfileId, actor });
     }
     ```
   - **Forwarder flow** :
     1. Fetch ProProfile via identity-svc `GET /internal/pros/by-id/:id` → get `stripeAccountId`
     2. If `stripeAccountId == null` → 404 `STRIPE-ACCOUNT-NOT-FOUND-001`
     3. Call payment-svc internal `POST /internal/stripe/accounts/:stripeAccountId/sync-status` (réutilise SyncStripeStatusUseCase Story 2.1 logic — `Stripe.accounts.retrieve` + persist updated state)
     4. Return updated snapshot
   - **Throttle** : 10/min/user (anti-Stripe-API-spam — Stripe quota concern)
   - **Audit event** : `admin.stripe.synced.v1` published (NFR82) — payload `{ proProfileId, stripeAccountId, actorId, syncedAt }`
   - **payment-svc UPDATE** Story 2.1 : exposes `POST /internal/stripe/accounts/:stripeAccountId/sync-status` (RBAC `X-Internal-Service-Token` check) — réutilise `SyncStripeStatusUseCase` Story 2.1 (idempotent — calls `stripe.accounts.retrieve` + updates pro_profiles via internal identity-svc call)
   - Tests E2E : admin-modo sync OK → 200 + updated state. admin-support → 403. Stripe API down → 503 `STRIPE-UNAVAILABLE-001`. ProProfile sans stripeAccountId → 404.

6. **AC6 — Frontend page `apps/admin/[locale]/verifications/[proProfileId]/page.tsx` + 4 sections** : Given AC1-5, When un admin navigue, Then :
   - **Layout Server Component** : fetch `GET /v1/admin/verifications/:id` server-side avec cookies → render `<VerificationDetailLayout>` (Story 2.4 NEW pattern réutilisable Stories 6.4, 10.x)
   - **Hero** : `<h1>Vérification {companyName}</h1>` + breadcrumb `<Link href="/{locale}/verifications">← Retour à la file</Link>` + badge SLA si exceeded
   - **4 sections rendues sous-composants** :
     - **`<CompanyInfoCard>`** :
       - Layout 2 colonnes : (L) Tukio submitted data (companyName, SIRET, address, contactPhone, vatNumber?), (R) INSEE snapshot data (denomination, adresse INSEE, dateCreation, activitePrincipaleEtablissement, etat)
       - Banner danger rouge si `etablissementClosed === true` : "⚠️ Établissement fermé selon INSEE — recommandation : Rejeter"
       - Banner warning orange si `addressMatchesSubmitted === false` : "Adresse INSEE diffère de l'adresse soumise" + 2 adresses highlighted side-by-side
       - Lien externe "Vérifier sur INSEE ↗" → `https://avis-situation-sirene.insee.fr/{siren}` (target=_blank rel=noopener)
       - Badge `<Badge variant={inseeSnapshot.source === 'live' ? 'success' : 'warning'}>INSEE {source}</Badge>` (warning si cached fallback)
     - **`<KycDocsSection>`** :
       - Grid 3 cards (idCard, rib, kbisOrInsee?) — kbisOrInsee absent si non uploaded
       - Chaque card : icon type (📷 image / 📄 PDF) + label localisé + thumbnail preview (image ou first page PDF rendered) + click → ouvre `<KycDocLightbox>` modale + bouton "Télécharger" (signed URL forced download)
       - Empty state si kbisOrInsee absent : "Document Kbis/INSEE non fourni (optionnel)"
     - **`<StripeSnapshotCard>`** :
       - Si `stripeSnapshot == null` → empty state "Compte Stripe non créé" + lien vers Story 2.1 onboarding
       - Sinon : badges chargesEnabled/payoutsEnabled (vert/rouge) + status badge + chips `requirementsCurrentlyDue` (si non vide)
       - Bouton "Actualiser depuis Stripe" (admin-modo+ uniquement — admin-support disabled avec tooltip "Lecture seule")
       - Lien externe `https://dashboard.stripe.com/connect/accounts/{stripeAccountId}` (admin-super only — sinon hidden)
     - **`<HistoryTimeline>`** :
       - Timeline vertical (or horizontal mobile) — semantic `<ol>` + chaque event = `<li>` avec timestamp, actor avatar + nom, action localisée, message si note
       - Empty state "Aucune action historique sur ce dossier" si `history.length === 0`
       - Filtre subtle : par action type (V1+) — MVP affiche tout
   - **`<NoteInput>`** : textarea limit 500 chars (live counter) + submit "Ajouter une note" → POST AC4 → toast succès + history re-fetch (TanStack Query invalidation)
   - **CTAs validate/reject** : **PAS DE BOUTONS** Story 2.4 (Story 2.5 ajoute) — placeholder div `data-test="actions-zone"` pour Story 2.5
   - **i18n** : namespace `admin.verifications.detail.*` (~40 keys)
   - **Mobile responsive** : sections stack verticalement, KYC cards 1-col stack
   - **A11y RGAA AA** : `<KycDocLightbox>` focus trap + Esc to close + aria-label modal + aria-describedby pour countdown timer + axe-core 0 violations
   - **Loading state** : `<DetailSkeleton>` (Story 2.4 NEW — placeholder atomic) durant fetch
   - **Error state** : `<ErrorPage>` Story 0.5 si 404/500 + bouton retry
   - **Tests E2E** : (cf. AC9)

7. **AC7 — `<KycDocLightbox>` pattern @tukio/ui** : Given pattern réutilisable Stories Epic 6 (signalements docs), When je consulte `packages/ui/src/patterns/`, Then :
   - **NEW pattern** `packages/ui/src/patterns/KycDocLightbox/KycDocLightbox.tsx` :
     - Props : `signedUrl: string, mimeType: string, expiresAt: string, label: string, onClose: () => void`
     - Render PDF.js viewer (latest stable v4+ — `pdfjs-dist`) si `mimeType === 'application/pdf'`
     - Render `<img>` natif si mimeType image (jpg/png/webp)
     - Countdown timer "Expire dans X:XX" (live update toutes 1s) — devient warning rouge < 30s + ferme automatiquement à 0:00
     - Bouton "Télécharger" (signed URL forced download via `<a download>`)
     - Focus trap (`focus-trap-react` latest stable) + Esc to close + click outside to close + `aria-modal="true"` + initial focus on close button
     - Body scroll lock pendant ouverture (`overflow:hidden` body + restore on close)
     - Mobile responsive : full-screen modal + pinch-zoom enabled pour images
   - **Tests Storybook** : 4 stories (PDF preview, image preview, countdown < 30s warning, expired auto-close) + axe-core a11y test
   - Tests unit `@testing-library/react` : focus trap + Esc handler + countdown progression

8. **AC8 — `useAdminVerificationDetail` + `useAddAdminNote` + `useSyncStripe` hooks + DTOs** : Given AC1-5, When je consulte `packages/`, Then :
   - **NEW DTOs** `packages/contracts/src/dtos/admin/verification-detail.dto.ts` :
     - `VerificationDetailSchema` (Zod) — full shape AC1
     - `KycDocSchema` (`type`, `signedUrl`, `expiresAt`, `mimeType`, `sizeBytes`, `uploadedAt`)
     - `InseeSnapshotSchema` (uniteLegale, etablissement, source, addressMatchesSubmitted, etablissementClosed)
     - `StripeSnapshotSchema` (stripeAccountId, status, chargesEnabled, payoutsEnabled, requirementsCurrentlyDue, lastSyncedAt, source)
     - `HistoryEntrySchema` (at, actor, action, reason?, message?)
     - `AddNoteInputSchema` (note 1-500)
   - **NEW hooks** `packages/api-client/src/hooks/admin/` :
     - `use-admin-verification-detail.ts` : TanStack Query `useQuery({ queryKey: ['admin', 'verification', proProfileId], queryFn: ..., refetchOnWindowFocus: false, staleTime: 5 * 60 * 1000 /* signed URLs valid 5 min */ })` — auto-refetch après mutations (notes, sync-stripe, validate/reject Story 2.5)
     - `use-add-admin-note.ts` : `useMutation` → invalide query above + toast succès via `Sonner` Story 0.4
     - `use-sync-stripe-account.ts` : `useMutation` → invalide query + toast "Synchronisation Stripe terminée" + spinner pendant 1-3s
   - Tests unit hooks : mock fetch + assert query keys + invalidations

9. **AC9 — Tests Playwright e2e + axe-core + perf** : 9 tests `apps/admin/e2e/verifications/detail.spec.ts` :
   - Test 1 (happy path FR admin-modo) : login admin-modo → naviguer `/fr/verifications/{proId}` (fixture Pro avec INSEE actif + Stripe submitted + 3 KYC docs) → vérifier 4 sections render + signed URLs présents + audit event publié (assert via NATS test consumer or DB query audit_log)
   - Test 2 (happy path EN) : idem `/en/`
   - Test 3 (INSEE closed banner) : fixture Pro avec INSEE etat='F' → vérifier banner danger "Établissement fermé"
   - Test 4 (INSEE address mismatch) : fixture INSEE adresse différente → banner orange + 2 adresses highlighted
   - Test 5 (INSEE down fallback) : mock INSEE 503 → vérifier `inseeSnapshot.source === 'cached'` + badge warning + page render OK (graceful degradation)
   - Test 6 (KYC doc lightbox PDF) : click RIB → lightbox open → PDF preview render + countdown visible + Esc close
   - Test 7 (KYC doc lightbox image) : click idCard JPG → lightbox open → img render + pinch-zoom mobile (Playwright touch)
   - Test 8 (note add admin-support) : login admin-support → add note 100 chars → toast succès + history timeline updates → vérifier note 501 chars → 422 inline error
   - Test 9 (RBAC + audit) : admin-support sync-stripe button disabled (tooltip "Lecture seule") + admin-modo button enabled. Audit event published rate-limited (refresh page 3x → 1 audit event).
   - **Test axe-core** : 0 violations sur page detail + lightbox open + note input focused
   - **Test perf** : page load < 800ms p90 avec 3 KYC docs + INSEE + Stripe (all cached). Live INSEE call < 2s p90.
   - Coverage ≥ 90 % use case + 80 % gateway + 80 % frontend (NFR71)

10. **AC10 — Documentation runbook + observability** :
    - **`docs/runbook/admin-kyc-review-debug.md`** (NEW ~50 lignes) : flow + troubleshooting (INSEE 429 quota, signed URLs expired during admin work, Stripe sync timeout, audit event idempotency window debug, admin_notes invariants check, RBAC matrix admin-support vs modo vs super, KYC docs lightbox PDF.js worker config)
    - **Métriques Prom** :
      - `tukio_admin_verification_detail_views_total{actor_role}` (counter)
      - `tukio_admin_verification_detail_load_duration_seconds` (histogram p50/p90/p99)
      - `tukio_insee_api_calls_total{cache_hit, status}` (counter — quota tracking NFR79)
      - `tukio_signed_urls_kyc_generated_total{doc_type}` (counter)
      - `tukio_admin_notes_added_total{actor_role}` (counter)
      - `tukio_stripe_sync_admin_triggered_total{result}` (counter)
    - **Dashboard Grafana** `infra/k8s/grafana-dashboards/admin-kyc-review.json` (NEW ~3 panels) : detail page load latency, INSEE cache hit ratio, signed URLs generation rate
    - **Alert Prometheus** : INSEE cache hit ratio < 80% (quota risk) → Slack `#tukio-alerts-ops`

## Tasks / Subtasks

- [ ] **Task 1 — `@tukio/contracts` DTOs + types + NATS event schemas** (AC: #8, #4)
  - [ ] 1.1 — DTOs `verification-detail.dto.ts` + Zod schemas (8 schemas)
  - [ ] 1.2 — DTOs `add-note.dto.ts`
  - [ ] 1.3 — Event schema `admin/verification-viewed.v1.{schema.json,ts}`
  - [ ] 1.4 — Event schema `admin/verification-note-added.v1.{schema.json,ts}`
  - [ ] 1.5 — Event schema `admin/stripe-synced.v1.{schema.json,ts}`
- [ ] **Task 2 — identity-svc INSEE port extension + Redis cache** (AC: #3) — coverage ≥ 90 %
  - [ ] 2.1 — Update `IInseeSiretValidator` port + add `getEstablishmentSnapshot`
  - [ ] 2.2 — Update `InseeSiretValidatorService` infra implementation + Redis cache 1h
  - [ ] 2.3 — Tests integration nock mock INSEE
  - [ ] 2.4 — Métrique Prom `tukio_insee_api_calls_total{cache_hit}`
- [ ] **Task 3 — identity-svc migration + ProProfile.inseeSnapshot field** (AC: #2)
  - [ ] 3.1 — Migration `1715290100000-AddInseeSnapshotToProProfiles.ts`
  - [ ] 3.2 — Update `ProProfileEntity` + `ProProfile` aggregate (lightweight VO `InseeSnapshot`)
  - [ ] 3.3 — Update repo `findByIdWithUserProfile` + `updateInseeSnapshot` methods
- [ ] **Task 4 — `admin_notes` table + AdminNote aggregate + AddAdminNoteUseCase** (AC: #4) — coverage ≥ 90 %
  - [ ] 4.1 — Migration `1715290200000-CreateAdminNotesTable.ts`
  - [ ] 4.2 — Domain aggregate `AdminNote` + invariants (note 1-500 chars)
  - [ ] 4.3 — Repository `IAdminNoteRepository` + TypeORM impl
  - [ ] 4.4 — Use case `AddAdminNoteUseCase` + outbox publish
  - [ ] 4.5 — Tests unit ≥ 90 % use case + invariants
- [ ] **Task 5 — identity-svc `GetVerificationDetailUseCase` + audit history repo** (AC: #2) — coverage ≥ 90 %
  - [ ] 5.1 — Use case `get-verification-detail.usecase.ts`
  - [ ] 5.2 — Repo `IAuditHistoryRepository` + TypeORM read-only impl (query `audit_log` table Story 1.10)
  - [ ] 5.3 — Idempotency repo helper `tryReserve(key, ttl)` (Redis SET NX EX)
  - [ ] 5.4 — Tests unit happy + INSEE down fallback + Stripe null + idempotency window
- [ ] **Task 6 — identity-svc internal controllers** (AC: #1, #4)
  - [ ] 6.1 — `GET /internal/admin/verifications/:proProfileId` controller
  - [ ] 6.2 — `POST /internal/admin/verifications/:proProfileId/notes` controller
  - [ ] 6.3 — `X-Internal-Service-Token` guard
  - [ ] 6.4 — Wire usecases-proxy module + Symbol DI tokens (audit Story 0.6 Pretre boundaries — domain pure)
- [ ] **Task 7 — payment-svc internal sync-status endpoint** (AC: #5) UPDATE Story 2.1
  - [ ] 7.1 — `POST /internal/stripe/accounts/:stripeAccountId/sync-status` controller
  - [ ] 7.2 — Réutilise `SyncStripeStatusUseCase` Story 2.1 (idempotent)
  - [ ] 7.3 — Tests integration mock Stripe API
- [ ] **Task 8 — gateway-api 3 endpoints + forwarders + RolesGuard** (AC: #1, #4, #5)
  - [ ] 8.1 — `GET /v1/admin/verifications/:proProfileId` + forwarder
  - [ ] 8.2 — `POST /v1/admin/verifications/:proProfileId/notes` + forwarder
  - [ ] 8.3 — `POST /v1/admin/verifications/:proProfileId/sync-stripe` + forwarder (admin-modo+)
  - [ ] 8.4 — Throttle 60/min detail, 30/min notes, 10/min sync-stripe
  - [ ] 8.5 — Tests E2E gateway 9 scénarios
- [ ] **Task 9 — `<KycDocLightbox>` pattern @tukio/ui + dependencies** (AC: #7)
  - [ ] 9.1 — Install `pdfjs-dist` latest stable + `focus-trap-react` latest stable
  - [ ] 9.2 — Pattern `KycDocLightbox.tsx` + countdown timer + focus trap + Esc handler
  - [ ] 9.3 — Mobile responsive + pinch-zoom + body scroll lock
  - [ ] 9.4 — 4 stories Storybook + a11y axe-core test
  - [ ] 9.5 — Tests `@testing-library/react` (focus trap, Esc, countdown progression)
  - [ ] 9.6 — `<DetailSkeleton>` atomic NEW Story 2.4 (réutilisable Stories 6.4)
  - [ ] 9.7 — `<VerificationDetailLayout>` pattern NEW (réutilisable Stories 6.4 / 10.x)
- [ ] **Task 10 — Frontend page detail + 4 sections components** (AC: #6)
  - [ ] 10.1 — Page `apps/admin/src/app/[locale]/verifications/[proProfileId]/page.tsx` Server Component
  - [ ] 10.2 — `<CompanyInfoCard>` (2 colonnes Tukio vs INSEE + banners)
  - [ ] 10.3 — `<KycDocsSection>` (grid 3 cards + thumbnails + lightbox trigger)
  - [ ] 10.4 — `<StripeSnapshotCard>` (badges + sync button + lien externe admin-super)
  - [ ] 10.5 — `<HistoryTimeline>` (semantic `<ol>` + actor avatar + actions localisées)
  - [ ] 10.6 — `<NoteInput>` (textarea + counter + submit)
  - [ ] 10.7 — Mobile responsive + RGAA AA
- [ ] **Task 11 — Hooks + URL state** (AC: #8)
  - [ ] 11.1 — `useAdminVerificationDetail` (staleTime 5 min)
  - [ ] 11.2 — `useAddAdminNote` (mutation + toast Sonner)
  - [ ] 11.3 — `useSyncStripeAccount` (mutation + spinner + toast)
- [ ] **Task 12 — i18n** : `admin.verifications.detail.*` namespace FR + EN (~40 keys) — `apps/admin/src/messages/{fr,en}.json` UPDATE
- [ ] **Task 13 — Tests Playwright e2e + axe-core + perf** (AC: #9) — 9 tests + coverage ≥ 80 %
- [ ] **Task 14 — Observability + runbook + commit** (AC: #10)
  - [ ] 14.1 — Métriques Prom (6 nouvelles)
  - [ ] 14.2 — Dashboard Grafana `admin-kyc-review.json` (3 panels)
  - [ ] 14.3 — Runbook `admin-kyc-review-debug.md`
  - [ ] 14.4 — Alert Prom INSEE cache hit ratio < 80%
  - [ ] 14.5 — Commit `feat(admin): Story 2.4 admin KYC review detail screen + signed URL preview + INSEE snapshot live + Stripe sync + admin notes + audit trail`

## Dev Notes

### Pourquoi Story 2.4 = pierre angulaire admin verification flow

Story 2.4 livre la **fenêtre de décision admin** (Léa user journey J5). C'est ici qu'un admin **prend la décision** validate/reject (bien que les boutons soient livrés Story 2.5). Donc la qualité de l'information affichée détermine la qualité de la décision : INSEE live + Stripe state + signed URLs sécurisés + history audit. Pattern `<VerificationDetailLayout>` + `<KycDocLightbox>` + `<HistoryTimeline>` réutilisé Stories 6.4 (signalements detail), 10.x V1 (dispute detail admin), 6.5 (account suspension review).

### Décisions techniques majeures actées

1. **INSEE snapshot fetched live + Redis cache 1h** (vs stored only) — admin doit voir données INSEE actuelles (ex: établissement fermé entre register + review). Cache 1h amorti quota NFR79 (30 req/min INSEE free tier). Fallback gracieux à snapshot stored en DB si INSEE down.
2. **Stripe snapshot cached + manual refresh CTA** (vs auto live fetch) — Stripe webhooks Story 2.1 maintiennent state cohérent (event-driven). Refresh manual disponible si admin doute (admin-modo+ only).
3. **Signed URLs 5 min TTL strict NFR15** — generated at page Server Component fetch. Admin qui dépasse 5 min doit refresh la page = nouveaux URLs (pas de "extend TTL" — security tradeoff acceptable car page reload < 1s).
4. **Audit event idempotent 5 min window** — admin qui refresh la page rapidement (testing, debug) ne pollue pas `audit_log` (1 viewed event par admin × pro × 5 min). Pattern `IIdempotencyRepository.tryReserve(key, ttlSeconds)` réutilisable Stories 4.x bookings, 5.x messaging.
5. **`admin_notes` séparée du `audit_log`** (vs storing notes in audit_log message field) — `admin_notes` est mutable in scope (admin pourrait V1 supprimer sa propre note récente) + queryable directement (pas de filtering by event type). `audit_log` reste immuable LCEN-compliant. Note creation publie également `admin.verification.note-added.v1` event → consumed audit_log → traçabilité immutable de la création.
6. **`<KycDocLightbox>` PDF.js dans @tukio/ui pattern** — vs feature-specific dans apps/admin. Justification : Story 6.4 (signalements detail) reutilisera lightbox pour preview signalement attachments. Sortir tôt en pattern partagé.
7. **`<VerificationDetailLayout>` + `<HistoryTimeline>` patterns NEW @tukio/ui** — réutilisables Epic 6 + 10.x.
8. **Story 2.4 NE livre PAS les boutons validate/reject** — Story 2.5 livre. Story 2.4 = data + display + notes. Permet split clear scope responsabilité.
9. **payment-svc internal endpoint sync-status réutilisé** Story 2.1 (DRY). Si Story 2.1 n'a pas exposé l'endpoint internal, Task 7 l'expose.
10. **EN strict + i18n strict + RGAA AA** memories.

### Versions à utiliser

| Lib | Usage | Version | Notes |
|-----|-------|---------|-------|
| `pdfjs-dist` | KYC doc PDF preview lightbox | latest stable v4+ | Mozilla PDF.js — most mature browser PDF rendering. Worker config required (cf. runbook) |
| `focus-trap-react` | Lightbox focus trap RGAA | latest stable v10+ | Standard React focus trap utility |
| `sonner` | Toast notifications | latest stable (Story 0.4 réutilisé) | |

(Autres libs réutilisés Stories 1.x/2.x — TanStack Query, Zod, axios, Stripe SDK, axios INSEE, etc. — no new deps backend)

### Project Structure cible

```
packages/contracts/src/dtos/admin/
├─ verification-detail.dto.ts                                    # NEW Story 2.4
└─ add-note.dto.ts                                               # NEW Story 2.4

packages/contracts/src/events/admin/
├─ verification-viewed.v1.{schema.json,ts}                       # NEW Story 2.4
├─ verification-note-added.v1.{schema.json,ts}                   # NEW Story 2.4
└─ stripe-synced.v1.{schema.json,ts}                             # NEW Story 2.4

packages/api-client/src/hooks/admin/
├─ use-admin-verification-detail.ts                              # NEW
├─ use-add-admin-note.ts                                         # NEW
└─ use-sync-stripe-account.ts                                    # NEW

packages/ui/src/patterns/
├─ KycDocLightbox/                                               # NEW Story 2.4
│  ├─ KycDocLightbox.tsx
│  ├─ KycDocLightbox.spec.tsx
│  ├─ KycDocLightbox.stories.tsx
│  └─ index.ts
├─ VerificationDetailLayout/                                     # NEW Story 2.4
│  ├─ VerificationDetailLayout.tsx + spec + stories + index
└─ HistoryTimeline/                                              # NEW Story 2.4
   └─ HistoryTimeline.tsx + spec + stories + index

packages/ui/src/components/
└─ DetailSkeleton/                                               # NEW Story 2.4
   └─ DetailSkeleton.tsx + spec + index

apps/identity-svc/src/
├─ domain/
│  ├─ ports/
│  │  ├─ insee-siret-validator.port.ts                           # UPDATE — add getEstablishmentSnapshot
│  │  ├─ audit-history-repository.port.ts                        # NEW
│  │  ├─ admin-note-repository.port.ts                           # NEW
│  │  └─ idempotency-repository.port.ts                          # NEW (or réutilisé Story 1.x)
│  ├─ model/
│  │  └─ admin-note.aggregate.ts                                 # NEW Story 2.4
│  └─ exception/
│     ├─ pro-profile-not-found.error.ts                          # NEW (or réutilisé)
│     └─ insee-unavailable.error.ts                              # NEW
├─ usecases/
│  ├─ get-verification-detail.usecase.ts                         # NEW Story 2.4
│  ├─ get-verification-detail.usecase.spec.ts
│  ├─ add-admin-note.usecase.ts                                  # NEW Story 2.4
│  └─ add-admin-note.usecase.spec.ts
├─ usecases-proxy/
│  └─ usecases-proxy.module.ts                                   # UPDATE — wire 2 new use cases + DI tokens
├─ infrastructure/
│  ├─ http/controllers/
│  │  ├─ admin-verifications.controller.ts                       # UPDATE Story 2.3 — add detail endpoint
│  │  └─ admin-notes.controller.ts                               # NEW
│  ├─ persistence/typeorm/
│  │  ├─ entities/
│  │  │  └─ admin-note.entity.ts                                 # NEW
│  │  ├─ repositories/
│  │  │  ├─ pro-profile.typeorm.repository.ts                    # UPDATE — findByIdWithUserProfile + updateInseeSnapshot
│  │  │  ├─ audit-history.typeorm.repository.ts                  # NEW (read-only on audit_log)
│  │  │  └─ admin-note.typeorm.repository.ts                     # NEW
│  │  └─ migrations/
│  │     ├─ 1715290100000-AddInseeSnapshotToProProfiles.ts       # NEW
│  │     └─ 1715290200000-CreateAdminNotesTable.ts               # NEW
│  ├─ external/
│  │  └─ insee/insee-siret-validator.service.ts                  # UPDATE — getEstablishmentSnapshot + Redis cache
│  └─ cache/
│     └─ idempotency-redis.repository.ts                         # NEW (or réutilisé Story 1.5)

apps/payment-svc/src/
├─ infrastructure/http/controllers/
│  └─ internal-stripe-accounts.controller.ts                     # UPDATE Story 2.1 — add sync-status endpoint (or NEW si Story 2.1 not exposed)

apps/gateway-api/src/
├─ usecases/admin/
│  ├─ admin-verification-detail.forwarder.ts                     # NEW
│  ├─ admin-note.forwarder.ts                                    # NEW
│  └─ admin-stripe-sync.forwarder.ts                             # NEW
├─ infrastructure/http/controllers/
│  └─ admin-verifications.controller.ts                          # UPDATE Story 2.3 — add 3 endpoints
└─ infrastructure/external/
   ├─ identity-svc/identity-svc.client.ts                        # UPDATE — getVerificationDetail + addNote
   └─ payment-svc/payment-svc.client.ts                          # UPDATE Story 2.1 — syncStripeAccount

apps/admin/src/
├─ app/[locale]/verifications/[proProfileId]/
│  ├─ page.tsx                                                   # NEW Story 2.4 (Server Component)
│  └─ loading.tsx                                                # NEW (Suspense boundary)
├─ features/admin/verifications/components/
│  ├─ CompanyInfoCard.tsx + spec                                 # NEW
│  ├─ KycDocsSection.tsx + spec                                  # NEW
│  ├─ StripeSnapshotCard.tsx + spec                              # NEW
│  ├─ HistoryTimelineSection.tsx + spec                          # NEW (wraps @tukio/ui pattern)
│  └─ NoteInput.tsx + spec                                       # NEW
└─ messages/{fr,en}.json                                         # UPDATE — admin.verifications.detail.*

apps/admin/e2e/verifications/detail.spec.ts                      # NEW Story 2.4

infra/k8s/grafana-dashboards/admin-kyc-review.json               # NEW
docs/runbook/admin-kyc-review-debug.md                           # NEW

# Estimation : ~45 nouveaux + ~10 updates = ~55 fichiers
```

### Critical Architecture Constraints

> Cf. Stories 0.5 (atomics + patterns), 0.6 (Pretre), 0.7 (outbox/inbox), 1.2 (gateway-api scaffolding), 1.3 (ProProfile + IMediaStorage R2 signed URLs + INSEE port + saga compensable), 1.7 (admin layout + middleware), 1.10 (audit_log table immutable + AuditLogConsumer), 2.1 (payment-svc + ProProfile.stripe* + Stripe webhooks), 2.3 (admin queue + DataTable pattern + RBAC + cursor pagination + admin app structure) + memories.

1. **Pretre architecture stricte** (memory `feedback_clean_architecture_explicit`) : ports dans `domain/ports/`, impls dans `infrastructure/external/` + `infrastructure/persistence/`, eslint-plugin-boundaries enforce. Domain pure (pas d'import `@nestjs/*`, `typeorm`, `axios`, `pdfjs-dist`, etc.).
2. **API responses envelope ADR-014** (memory `feedback_api_envelope_response`) : toutes responses `{ method, code, data | error, meta }`. Pas de retour DTO direct.
3. **EN strict couche tech** (memory `feedback_tech_layer_english`) : paths URL `/admin/verifications/:proProfileId` strict EN, code/DB/events strict EN. UI bilingue FR/EN via i18n keys (memory `feedback_i18n_frontend`).
4. **i18n FR/EN dès Sprint 0** (memory `feedback_i18n_frontend`) : namespace `admin.verifications.detail.*` ~40 keys, zéro texte hardcodé frontend.
5. **Latest stable versions** (memory `feedback_latest_versions`) : `pdfjs-dist` v4+, `focus-trap-react` v10+, Tailwind v4 (CSS-first), Next.js 15, React 19, NestJS 11, pnpm 10.
6. **NFR15 chiffrement at-rest KYC docs + signed URLs 5 min** (Story 1.3 fournit `IMediaStorage.getSignedDownloadUrl`).
7. **NFR79 quota INSEE SIRENE** : Redis cache 1h key `tukio:insee:siret:{siret}` — éviter spam API (30 req/min free tier).
8. **NFR82 audit immutable** : `admin.verification.viewed.v1` event publié à chaque ouverture (idempotent 5 min) + `admin.verification.note-added.v1` à chaque note → consumed AuditLogConsumer Story 1.10 → INSERT audit_log.
9. **RGAA AA accessibility** (NFR47-55) : `<KycDocLightbox>` focus trap + Esc + aria-modal. Sections semantic HTML.
10. **Cursor pagination N/A Story 2.4** (single resource lookup, history < 50 entries — bounded).

### Previous Story Intelligence

**Story 1.3 (Pro registration)** : a livré `IMediaStorage.getSignedDownloadUrl({ bucket, key, expiresInSeconds: 300 })` (5 min TTL admin-only) + `IInseeSiretValidator.checkActive(siret)` (Story 2.4 étend avec `getEstablishmentSnapshot`) + `pro_profiles.kyc_id_card_r2_key` + `kyc_rib_r2_key` + `kyc_kbis_r2_key` columns. Story 2.4 réutilise tout. **Pas de modifications** Story 1.3 nécessaires sauf : **NEW colonne `pro_profiles.insee_snapshot JSONB NULL`** via migration Story 2.4.

**Story 1.7 (admin layout)** : a livré middleware admin + AdminAuthLayout + RBAC roles (`admin-support`, `admin-modo`, `admin-super`). Story 2.4 réutilise wrapping automatique de `apps/admin/src/app/[locale]/verifications/[proProfileId]/page.tsx`.

**Story 1.8 (profile management)** : a livré `get-kyc-doc-signed-url.usecase.ts` (utilisateur self-service, 5 min TTL). Story 2.4 utilise différent use case `GetVerificationDetailUseCase` qui génère 3 signed URLs en bulk côté admin. **Pas de partage de logic** : Story 1.8 = self-service, Story 2.4 = admin-side. Mais sous le hood même `IMediaStorage.getSignedDownloadUrl`.

**Story 1.10 (Pretre consolidation)** : a livré `audit_log` table immutable + AuditLogConsumer + Phasetwo bridge. Story 2.4 INSERT-only via NATS events `admin.verification.viewed.v1` + `admin.verification.note-added.v1` consumed → audit_log INSERT. Story 2.4 ajoute le **read query** `IAuditHistoryRepository.findByAggregateId` pour la timeline UI (read-only — pas de violation immutability).

**Story 2.1 (Stripe Connect)** : a livré `pro_profiles.stripeAccountId` + `stripe_status` + `stripe_charges_enabled` + `stripe_payouts_enabled` + `stripe_requirements_currently_due` + `SyncStripeStatusUseCase` côté payment-svc. Story 2.4 lit depuis pro_profiles cached fields + (admin-modo+ only) clic "Actualiser" → réutilise SyncStripeStatusUseCase via internal endpoint. **Action item Story 2.4 Task 7** : si Story 2.1 n'a pas exposé `POST /internal/stripe/accounts/:id/sync-status` endpoint, Story 2.4 l'expose.

**Story 2.2 (wizard onboarding)** : aucune dépendance directe Story 2.4 (wizard est seller-side, admin detail est admin-side).

**Story 2.3 (admin verification queue)** : a livré `<DataTable>` + `<AdminQueueLayout>` patterns + RBAC granulaire (admin-support read + note-add, admin-modo+ read+actions). Story 2.4 wrap dans `apps/admin/src/app/[locale]/verifications/[proProfileId]/page.tsx` (sibling de queue page). Bouton "Examiner" Story 2.3 → naviguer Story 2.4.

### What this story does NOT do

- ❌ **Boutons validate / reject** → Story 2.5 (Story 2.4 livre placeholder div pour Story 2.5)
- ❌ **Modal "Confirmer la validation"** → Story 2.5
- ❌ **Modal "Raison du rejet" structurée** → Story 2.5
- ❌ **Email transactionnel pro-verified / pro-rejected** → Story 5.4 (consumes events Story 2.5)
- ❌ **Audit log UI** → Story 2.7 (Story 2.4 affiche timeline du dossier courant uniquement, pas global)
- ❌ **Auto-rejection 30j inactivity** → Story 2.8
- ❌ **Bulk actions (validate multiple Pros)** → V1+
- ❌ **Note edit / delete** (immutable MVP, V1+ admin-super peut delete)
- ❌ **PII masking dans logs** (déjà fait Stories 1.3 + 2.1 — pas de regression Story 2.4)
- ❌ **Admin verification queue refresh** post-validate (Story 2.5 invalide TanStack Query keys queue)

### Files to UPDATE vs CREATE

(Cf. Project Structure cible ci-dessus — section "UPDATE" annotée)

### Testing Standards

- Coverage ≥ 90 % use case `GetVerificationDetailUseCase` + `AddAdminNoteUseCase` (NFR71 strict)
- Coverage ≥ 80 % gateway endpoints (3 endpoints)
- Coverage ≥ 80 % frontend (page detail + 5 components)
- E2E Playwright FR/EN axe-core 0 violations 9 tests AC9
- Perf < 800ms p90 page load (3 KYC docs + INSEE cached + Stripe cached)
- Live INSEE call < 2s p90
- Tests integration nock INSEE + stripe-mock testcontainer (Story 2.1 réutilisé)

### Project Structure Notes

✅ **Aligné architecture, PRD §FR3 (KYC validation flow), §FR83 (admin valide/rejette — Story 2.5), §FR94 (audit log toutes actions admin — Story 2.4 publish events), §FR95 (admin Super peut consulter audit trail — Story 2.7), §NFR15 (chiffrement KYC + signed URLs), §NFR48 (UX admin), §NFR79 (INSEE SIRENE quota), §NFR82 (audit immutable), UX-DR10 (admin KYC review detail — gap MVP critique designed Sprint 0), Stories 1.3/1.10/2.1/2.3, memories.**

⚠️ **Décision** : Story 2.4 NE livre PAS validate/reject buttons (Story 2.5 livre). Permet split clear scope responsabilité.

⚠️ **Décision** : INSEE snapshot fetched live + Redis cache 1h (vs stored only) pour fraîcheur des données admin. Fallback gracieux si INSEE down.

⚠️ **Décision** : `<KycDocLightbox>` pattern @tukio/ui (vs feature-specific) — réutilisable Stories 6.4 / 10.x.

⚠️ **Décision** : Audit event idempotent 5 min window (vs every page load) — anti-pollution audit_log + admin refresh sécurisé.

⚠️ **Décision** : `admin_notes` table dédiée (vs storing in audit_log) — permet V1 future delete by admin-super sans toucher audit_log immuable.

### References

- [Source: epics.md#Epic-2-Story-2.4 — Lines 1303-1317]
- [Source: prd.md#FR3, #FR83, #FR94, #FR95, #NFR15 (KYC encryption + signed URLs), #NFR48 (admin SLA UX), #NFR79 (INSEE quota), #NFR82 (audit immutable), #UX-DR10]
- [Source: ux-design-specification.md — admin KYC review detail (gap MVP critique designed Sprint 0)]
- [Source: architecture.md — ADR-014 envelope, Pretre boundaries, audit_log immutability, lines 1252+ envelope, lines 2120-2164 Pretre]
- [Source: Stories 1.3 (ProProfile + IMediaStorage + IInseeSiretValidator + R2), 1.7 (admin layout), 1.10 (audit_log + AuditLogConsumer), 2.1 (Stripe + payment-svc), 2.3 (admin queue + DataTable + RBAC granulaire)]
- [Memory: feedback_clean_architecture_explicit.md, feedback_api_envelope_response.md, feedback_tech_layer_english.md, feedback_i18n_frontend.md, feedback_latest_versions.md]

## Dev Agent Record

### Agent Model Used

(à remplir par dev agent : modèle + version)

### Debug Log References

(à remplir)

### Completion Notes List

(à remplir à la fin — résumé décisions, déviations vs Dev Notes avec justification, points d'attention pour Story 2.5 (validate/reject — utilise `GetVerificationDetailUseCase` + ajoute mutations), Story 2.7 (audit trail UI — query `audit_log` via `IAuditHistoryRepository` Story 2.4), Story 6.4 (signalements detail — réutilise `<VerificationDetailLayout>` + `<KycDocLightbox>` + `<HistoryTimeline>` patterns Story 2.4), Story 10.x V1 (dispute detail — même patterns))

### File List

(à remplir au fil de l'implémentation par le dev agent)

---

## Story Completion Status

- **Story Status** : `ready-for-dev`
- **Created** : 2026-05-09
- **Created by** : `bmad-create-story` workflow
- **Epic** : Epic 2 — Pro Onboarding & Admin Verification (MVP)
- **Sprint cible** : Sprint 3 (4ᵉ story Epic 2 après 2.1, 2.2, 2.3)
- **Estimation effort** : 4-5 jours (1 dev fullstack — story plus complexe que 2.3 à cause INSEE live + lightbox PDF + 5 components frontend + admin_notes + payment-svc internal endpoint, ~55 fichiers)
- **Dépendances upstream** : Stories 0.5 (atomics), 0.6 (Pretre), 0.7 (outbox), 1.2 (gateway-api), 1.3 (ProProfile + IMediaStorage + IInseeSiretValidator + R2), 1.7 (admin layout), 1.10 (audit_log + AuditLogConsumer), 2.1 (Stripe + payment-svc + ProProfile.stripe* fields), 2.3 (admin queue + RBAC granulaire + DataTable pattern + admin app `[locale]/verifications/` routing)
- **Dépendances downstream** :
  - Story 2.5 (admin accept/reject) — consume `GetVerificationDetailUseCase` + ajoute mutations validate/reject + boutons UI dans placeholder Story 2.4
  - Story 2.7 (audit trail UI) — consume `audit_log` table + utilise `IAuditHistoryRepository` Story 2.4 (V1 étendu pour query global, pas par aggregate)
  - Story 6.4 (signalements detail) — réutilise `<VerificationDetailLayout>`, `<KycDocLightbox>`, `<HistoryTimeline>`, `<NoteInput>` patterns
  - Story 10.x V1 (dispute detail admin) — réutilise mêmes patterns
- **FRs covered** :
  - **FR3 partial** ✅ admin examine KYC dossier (validation Story 2.5)
  - **FR94 partial** ✅ admin actions audit log (`admin.verification.viewed`, `admin.verification.note-added` events publiés — consumed audit_log Story 1.10)
- **NFRs touchés** :
  - **NFR15** ✅ KYC docs signed URLs 5 min strict admin-only access
  - **NFR48** ✅ UX admin < 800ms p90 page load (cached Stripe + INSEE Redis 1h)
  - **NFR71** ✅ coverage ≥ 90 % use case + 80 % gateway + 80 % frontend
  - **NFR79** ✅ INSEE SIRENE Redis cache 1h amorti quota free tier
  - **NFR82** ✅ audit fine-grained sur ouverture détail + note add (idempotent 5 min anti-spam)
- **UX-DRs covered** :
  - **UX-DR10** ✅ admin KYC review detail (gap MVP critique designed Sprint 0)

> **Prochaine story → Story 2.5** (Pro acceptation/rejet workflow + transitions de statut — ajoute boutons validate/reject + 2 modales + 2 mutations dans le placeholder Story 2.4)

---

**Dev agent next steps :**
1. Lire ce file complètement
2. Vérifier upstream Stories 0.5, 0.6, 0.7, 1.2, 1.3, 1.7, 1.10, 2.1, 2.3 implémentées (dependencies amont)
3. Implémenter Tasks 1-14 dans l'ordre (DTOs/events Task 1 d'abord — débloque le reste)
4. Lancer `pnpm playwright test --grep "admin verification detail"` après chaque jalon
5. Commit Story 2.4 quand : 9/9 e2e + coverage thresholds NFR71 + axe-core 0 + perf < 800ms p90 + INSEE cache hit ratio > 80% en charge dev local + signed URLs 5 min testés + audit events idempotent vérifiés
6. Update sprint-status : `2-4-...: review` puis `done`
