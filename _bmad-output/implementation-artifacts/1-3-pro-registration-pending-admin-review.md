# Story 1.3: Pro registration with `pending_admin_review` status (`POST /v1/auth/pro/register`)

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

**As a** Visitor (futur Pro / prestataire événementiel),
**I want** to register as a Pro via un wizard frontend 3 steps (`apps/public/{locale}/auth/sign-up?role=pro` — Step 1 Compte `{email, password, firstName, lastName, locale, acceptTerms, acceptMarketing?}`, Step 2 Société `{companyName, siret, vatNumber?, address: {street, postalCode, city, country}, contactPhone}`, Step 3 Documents `{idCard, rib, kbisOrInsee?}` upload — accumulé client-side puis submit final via `POST /v1/auth/pro/register` multipart/form-data avec acquisition tracking auto-captured), avec validation backend complète (Zod input + SIRET 14 digits Luhn algorithm + INSEE SIRENE V3.11 API check `etatAdministratifUniteLegale === 'A'` actif + anti-doublon SIRET FR16 → `IDENTITY-CONFLICT-002` + chiffrement R2 server-side server-side AES-256 NFR15 + signed URLs 5 min admin-only access + rétention 90j post-décision RGPD), création atomique en saga compensable (Keycloak user role `pro` + claim `tukio:status='pending_admin_review'` + `tukio:locale` + UserProfile aggregate `tukio_status='pending_admin_review'` + ProProfile aggregate `kyc_status='pending_review'` + 3 R2 uploads chiffrés + 2 NATS events outbox `identity.pro.registered.v1` + `notification.email.send.v1` template `pro-pending-admin-review` envoyé à l'utilisateur ET à `admin@tukio.one` notif), retour enveloppé `{ method:'POST', code:201, data:{ userId, proProfileId, requiresAdminReview:true, requiresEmailVerification:true } }`, middleware Next.js apps/seller redirige les comptes `tukio_status='pending_admin_review'` vers `/seller/onboarding/pending` (FR17 + UX-DR9), tests Playwright e2e wizard 3 steps FR + EN axe-core 0 violations,
**so that** un Pro peut soumettre son dossier en moins de 5 min (NFR48 étendu pour le multi-step + KYC) sans bypass admin gating (FR3) ; l'admin peut traiter la file `pending_admin_review` Story 2.3 + Story 2.4 (Epic 2 onboarding pro verification queue) avec INSEE SIRENE auto-checked + KYC docs en signed URLs ; les Stories 2.1-2.6 (Stripe Connect Express + 1ère fiche dans le wizard onboarding 4 étapes) consomment un Pro réel avec `kyc_status='pending_review'` ; et le **pattern complet "register pro avec validation externe + uploads R2 + saga compensable"** devient le template canonique pour toute story future qui doit créer une ressource métier impliquant validation API tierce + storage chiffré (e.g., Story 3.4 photo upload listing, Story 4.x document upload booking modification).

> **Outcome attendu** : à la fin de cette story, un Visitor sur `tukio.one/fr/auth/sign-up?role=pro` voit un wizard 3 steps (`<StepIndicator steps={['Compte','Société','Documents']} />` Story 0.5) et complète chaque step avec validation immédiate Zod ; au submit final, `POST /v1/auth/pro/register` (multipart) retourne `201 SuccessEnvelope { method:'POST', code:201, data:{ userId, proProfileId, requiresAdminReview:true, requiresEmailVerification:true }, meta:{ correlationId, locale, timestamp } }` ; le user existe dans Keycloak avec rôle `pro` + `tukio:status='pending_admin_review'` ; un `user_profiles` row avec `tukio_status='pending_admin_review'` + acquisition_* tracké ; un `pro_profiles` row avec `siret`, `company_name`, `kyc_status='pending_review'`, `kyc_id_card_r2_key`, `kyc_rib_r2_key`, `kyc_kbis_r2_key?` (chemins R2 chiffrés) ; 3 fichiers uploadés dans `tukio-kyc-local` bucket Cloudflare R2 (ou MinIO local Story 0.10) avec server-side encryption + metadata `actorId`/`documentType` ; 2 events NATS publiés via outbox-relay (visibles `localhost:8222/jsz`) — un avec template `pro-pending-admin-review` à `admin@tukio.one` (notification admin queue) ET un à l'email du Pro (confirmation reçu) ; un Pro qui essaie de submit avec un SIRET déjà actif en DB → `409 ErrorEnvelope { tukioCode:'IDENTITY-CONFLICT-002' }` (FR16) ; un Pro avec un SIRET valide format mais inactif INSEE → `422 ErrorEnvelope { tukioCode:'IDENTITY-VALIDATION-002', detail:'SIRET inactive at INSEE' }` ; un Pro avec un SIRET malformé → `422 IDENTITY-VALIDATION-001` (Luhn fail) ; le Pro fraîchement registered qui se connecte (Story 1.4) puis navigue `seller.tukio.one/seller/listings/new` → middleware Next.js détecte `tukio_status='pending_admin_review'` dans JWT → redirect `/seller/onboarding/pending` (FR17) ; un test `pnpm playwright test --grep "pro register"` passe en FR ET EN, axe-core 0 violations, perf ≤ 5 min p90 wizard complet ; un Admin qui consulte les KYC docs via Story 2.4 voit les fichiers via signed URLs Cloudflare R2 5 min TTL.

## Acceptance Criteria

1. **AC1 — Frontend wizard 3 steps `apps/public/[locale]/auth/sign-up?role=pro`** : Given un Visitor sur `tukio.one/{fr|en}/auth/sign-up?role=pro` (param query qui switch entre Customer Story 1.2 et Pro Story 1.3), When il consulte la page, Then :
   - **Layout** : Server Component layout (réutilise celui Story 1.2) qui détecte `?role=pro` + rend `<ProSignUpWizard>` (Client Component dans `apps/public/src/features/auth/sign-up-pro/components/ProSignUpWizard.tsx`) au lieu du `<SignUpForm>` Customer
   - **`<StepIndicator>`** (Story 0.5 pattern) en haut du wizard : `<StepIndicator steps={[t('steps.account'), t('steps.company'), t('steps.documents')]} currentStep={currentStep} />` (3 étapes : "Compte", "Société", "Documents" en FR / "Account", "Company", "Documents" en EN)
   - **Step 1 — Compte** : Identique au form Story 1.2 (email + password + firstName + lastName + locale + acceptTerms + acceptMarketing) — **réutilise les mêmes Zod schemas** depuis `@tukio/contracts/dtos/identity/register-customer.dto.ts` AC2 (le Pro ce sont les mêmes champs base + champs Pro spécifiques en plus). CTA "Continuer →" disabled tant que step 1 invalid.
   - **Step 2 — Société** : `<FormField>` × 6 :
     - `<FormField label="Raison sociale (companyName)" type="text" required>` (1-200 chars)
     - `<FormField label="SIRET" type="text" required helper="14 chiffres">` validé Zod : `z.string().regex(/^\d{14}$/, 'SIRET doit contenir exactement 14 chiffres').refine(siretLuhnCheck, 'SIRET invalide (Luhn check failed)')` (function `siretLuhnCheck` exportée depuis `@tukio/contracts/utils/siret.ts` — réutilisée backend AC4)
     - `<FormField label="N° TVA intracommunautaire (optionnel)" type="text" optional>` (FR pattern `FR\d{11}`)
     - `<FormField label="Adresse — Rue" required>` + `<FormField label="Code postal" required>` (5 digits FR) + `<FormField label="Ville" required>` + `<select label="Pays" required>` (default `FR`, `BE/CH/LU` V1 — au MVP `FR` only)
     - `<FormField label="Téléphone professionnel" type="tel" required>` (FR pattern `^(?:\+33|0)[1-9]\d{8}$`)
     - **Validation immédiate Zod** sur blur + bouton "Continuer →" disabled tant que invalid
   - **Step 3 — Documents** : 3 `<FileUpload>` (Story 0.5 pattern) :
     - `<FileUpload label="Pièce d'identité (recto-verso)" accept=".jpg,.jpeg,.png,.pdf" maxSizeMB={5} required>` — fichier unique (utiliser un format combiné PDF si recto-verso scanné séparément)
     - `<FileUpload label="RIB / IBAN" accept=".jpg,.jpeg,.png,.pdf" maxSizeMB={5} required>` — fichier unique
     - `<FileUpload label="Extrait Kbis ou attestation INSEE (optionnel)" accept=".pdf" maxSizeMB={5} optional helper="Recommandé pour accélérer la validation">`
     - **Validation client-side** : taille max 5 MB par fichier (refus avec message clair), MIME type accept whitelist, total upload ≤ 15 MB
     - **Preview** : `<FileUpload>` Story 0.5 affiche thumbnail si image, icône PDF si PDF
     - **CTA final** : `<Button variant="primary" size="lg">Soumettre mon dossier</Button>` — disabled si idCard ou rib manquants
   - **Navigation entre steps** : back button "← Précédent" préserve les données déjà entrées (state in `useReducer` ou `useState` au niveau wizard)
   - **i18n strict** (memory `feedback_i18n_frontend.md`) : zéro hardcoded UI string. Toutes les strings dans `apps/public/messages/{fr,en}.json` sous le namespace `auth.signupPro.*` (~40 keys). Importées via `useTranslations('auth.signupPro')`.
   - **Acquisition tracking** : `useAcquisitionTracking()` hook réutilisé (Story 1.2) — UTM/cookie tk_acq attaché au submit final.
   - **Soumission finale** : multipart/form-data POST `/v1/auth/pro/register` via `useRegisterPro` hook (TanStack Query mutation, NEW Story 1.3) — Form data construite avec `FormData()` API native browser : append champs JSON serialized + 3 files separately
   - **Loading state** : pendant le submit, `<Spinner>` + message `"Vérification du SIRET et upload des documents en cours…"` (peut prendre ~10-15s à cause de l'INSEE call + R2 upload)
   - **Post-success** : redirect `apps/seller/{locale}/seller/onboarding/pending` (cross-zone navigation Vercel rewrites Story 0.13 ADR-013) avec toast succès `"Dossier soumis. Validation sous 24h."`
   - **Post-error mapping** : `IDENTITY-CONFLICT-002` (SIRET déjà utilisé) → message inline sous le champ SIRET `"Ce SIRET est déjà associé à un compte actif. Contactez le support si erreur."`. `IDENTITY-VALIDATION-002` (SIRET inactif INSEE) → `"Le SIRET fourni n'est pas reconnu comme actif au registre INSEE. Vérifiez ou contactez le support."`. `RATE-LIMIT-EXCEEDED-001` → `"Trop de tentatives, réessayez dans Xs"`. Generic 5xx → `"Erreur serveur, réessayez dans quelques minutes."`
   - **Accessibilité RGAA AA** : labels associés, focus visible, navigation Tab/Shift-Tab + Enter, errors via `role="alert"`, axe-core 0 violations critical/serious (Task 9). FileUpload accessible (input file native + drag-drop avec keyboard support).
   - **Test Playwright e2e** (`apps/public/e2e/auth/pro-register.spec.ts`) : remplir wizard 3 steps FR + EN, upload 3 files (fixtures dans `apps/public/e2e/fixtures/`), submit, vérifier redirect + toast + axe-core 0 violations + perf ≤ 5 min p90 (Task 9).

2. **AC2 — DTO + event schemas dans `@tukio/contracts`** : Given la nécessité de partager les types frontend ↔ gateway-api ↔ identity-svc, When je consulte `packages/contracts/src/`, Then je trouve :
   - **`packages/contracts/src/dtos/identity/register-pro.dto.ts`** (NEW) :
     ```ts
     import { z } from 'zod';
     import { LocaleSchema } from '../../types/Locale';
     import { AcquisitionInputSchema } from './acquisition.dto';
     import { siretLuhnCheck } from '../../utils/siret';

     export const ProAddressSchema = z.object({
       street: z.string().min(1).max(200),
       postalCode: z.string().regex(/^\d{5}$/, 'Postal code must be 5 digits (France MVP)'),
       city: z.string().min(1).max(100),
       country: z.literal('FR'), // MVP France only — V1 widen to ['FR','BE','CH','LU']
     });

     export const RegisterProInputSchema = z.object({
       // Step 1 — Account (réutilise schema Customer Story 1.2)
       email: z.string().email().min(5).max(255),
       password: z.string().min(12).regex(/[a-z]/).regex(/[A-Z]/).regex(/\d/).regex(/[!@#$%^&*(),.?":{}|<>]/),
       firstName: z.string().min(1).max(80),
       lastName: z.string().min(1).max(80),
       locale: LocaleSchema,
       acceptTerms: z.literal(true),
       acceptMarketing: z.boolean().optional().default(false),
       // Step 2 — Company
       companyName: z.string().min(1).max(200),
       siret: z.string().regex(/^\d{14}$/, 'SIRET must be exactly 14 digits').refine(siretLuhnCheck, 'Invalid SIRET (Luhn check failed)'),
       vatNumber: z.string().regex(/^FR\d{11}$/, 'VAT number must match FR + 11 digits').optional(),
       address: ProAddressSchema,
       contactPhone: z.string().regex(/^(?:\+33|0)[1-9]\d{8}$/, 'Invalid French phone number'),
       // Cross-cutting
       acquisition: AcquisitionInputSchema.optional(),
       // NB: les 3 fichiers ne sont PAS dans ce schema (ils sont uploadés via multipart/form-data parts séparés `idCard`, `rib`, `kbisOrInsee`)
     });
     export type RegisterProInput = z.infer<typeof RegisterProInputSchema>;

     export const RegisterProResponseSchema = z.object({
       userId: z.string().uuid(),
       proProfileId: z.string().uuid(),
       requiresAdminReview: z.literal(true),
       requiresEmailVerification: z.literal(true),
     });
     export type RegisterProResponse = z.infer<typeof RegisterProResponseSchema>;
     ```
   - **`packages/contracts/src/utils/siret.ts`** (NEW — utility partagée frontend + backend) :
     ```ts
     /**
      * Luhn algorithm check for SIRET (14 digits French company identifier).
      * Implements the standard mod 10 algorithm with double-then-add for odd-positioned digits.
      * Source: https://fr.wikipedia.org/wiki/Formule_de_Luhn — adapted for SIRET (14 digits, 100/100 of digits validated).
      */
     export function siretLuhnCheck(siret: string): boolean {
       if (!/^\d{14}$/.test(siret)) return false;
       let sum = 0;
       for (let i = 0; i < 14; i++) {
         let digit = parseInt(siret[i], 10);
         // Even positions (0-indexed): 1, 3, 5, ... = doubled; odd: as-is
         // Wait — SIRET Luhn: positions paires (1ʳᵉ, 3ᵉ, ...) doublées si on indexe à partir de 1 depuis la droite
         // Reformulé : on inverse + on double les positions impaires (1-indexed)
         if ((14 - i) % 2 === 0) {
           digit *= 2;
           if (digit > 9) digit -= 9;
         }
         sum += digit;
       }
       return sum % 10 === 0;
     }
     ```
     - **NB importante** : la spec SIRET Luhn standard double les **positions paires** (1-indexed depuis la gauche, soit positions 2, 4, 6, ..., 14). Vérifier l'algorithme contre le validateur officiel (e.g. https://avis-situation-sirene.insee.fr/) avec 5+ SIRETs réels avant de commit. Tests unitaires obligatoires (`packages/contracts/src/utils/siret.spec.ts`).
   - **`packages/contracts/src/events/identity/pro-registered.v1.schema.json`** (NEW JSON Schema Draft 7) :
     ```json
     {
       "$schema": "http://json-schema.org/draft-07/schema#",
       "$id": "https://tukio.one/events/identity.pro.registered.v1.json",
       "title": "identity.pro.registered.v1",
       "type": "object",
       "required": ["eventId", "eventType", "eventVersion", "occurredAt", "aggregate", "actor", "payload", "correlationId"],
       "properties": {
         "eventId": { "type": "string", "format": "uuid" },
         "eventType": { "const": "identity.pro.registered" },
         "eventVersion": { "const": "v1" },
         "occurredAt": { "type": "string", "format": "date-time" },
         "aggregate": {
           "type": "object", "required": ["type", "id"],
           "properties": { "type": { "const": "ProProfile" }, "id": { "type": "string", "format": "uuid" } }
         },
         "actor": {
           "type": "object", "required": ["userId", "role"],
           "properties": { "userId": { "type": "string" }, "role": { "const": "pro" } }
         },
         "payload": {
           "type": "object",
           "required": ["userProfileId", "proProfileId", "email", "companyName", "siret", "kycStatus", "registeredAt"],
           "properties": {
             "userProfileId": { "type": "string", "format": "uuid" },
             "proProfileId": { "type": "string", "format": "uuid" },
             "email": { "type": "string", "format": "email" },
             "firstName": { "type": "string" },
             "lastName": { "type": "string" },
             "companyName": { "type": "string" },
             "siret": { "type": "string", "pattern": "^\\d{14}$" },
             "vatNumber": { "type": ["string", "null"] },
             "address": {
               "type": "object",
               "properties": {
                 "street": { "type": "string" },
                 "postalCode": { "type": "string", "pattern": "^\\d{5}$" },
                 "city": { "type": "string" },
                 "country": { "type": "string", "enum": ["FR"] }
               }
             },
             "contactPhone": { "type": "string" },
             "kycStatus": { "const": "pending_review" },
             "kycDocsUploaded": {
               "type": "object",
               "properties": {
                 "idCard": { "type": "boolean" },
                 "rib": { "type": "boolean" },
                 "kbisOrInsee": { "type": "boolean" }
               }
             },
             "locale": { "enum": ["fr", "en"] },
             "acquisitionSource": { "enum": ["organic", "google_ads", "meta_ads", "referral", "direct", "partner", "unknown"] },
             "registeredAt": { "type": "string", "format": "date-time" },
             "inseeCheck": {
               "type": "object",
               "description": "INSEE SIRENE V3.11 verification result snapshot at registration time",
               "properties": {
                 "checkedAt": { "type": "string", "format": "date-time" },
                 "active": { "type": "boolean" },
                 "denomination": { "type": ["string", "null"] },
                 "naf": { "type": ["string", "null"], "description": "NAF code (e.g., '7990Z' for events)" }
               }
             }
           }
         },
         "correlationId": { "type": "string", "format": "uuid" }
       }
     }
     ```
   - **`packages/contracts/src/events/identity/pro-registered.v1.ts`** (NEW — types TS dérivés via build pipeline Story 0.2)
   - **`packages/contracts/src/dtos/identity/pro-profile-response.dto.ts`** (NEW — DTO de retour pour `GET /v1/me` Story 1.8 + admin queue Story 2.3)
   - **`packages/contracts/src/types/error-codes.ts`** (UPDATE Story 1.2) : ajouter `IDENTITY-VALIDATION-002` (SIRET inactif INSEE) + `IDENTITY-VALIDATION-003` (KYC docs missing/invalid) + `IDENTITY-EXTERNAL-002` (INSEE SIRENE DOWN) + `IDENTITY-EXTERNAL-003` (R2 upload fail)
   - **`packages/contracts/src/types/email-templates.ts`** (UPDATE Story 1.2) : ajouter templateId `'pro-pending-admin-review'` (notification au Pro qui s'est registered)
   - **Build pipeline** : `pnpm --filter=@tukio/contracts build` regénère les types TS depuis JSON Schema. Vérifier post-build que `import type { ProRegisteredV1 } from '@tukio/contracts/events/identity'` fonctionne.

3. **AC3 — gateway-api endpoint `POST /v1/auth/pro/register` (multipart, public, rate-limited)** : Given `apps/gateway-api/src/infrastructure/http/controllers/auth-pro.controller.ts` (NEW), When je l'ouvre, Then :
   - **Endpoint multipart/form-data** :
     ```ts
     @Controller('/v1/auth/pro')
     export class AuthProController {
       constructor(
         private readonly registerProForwarder: UseCaseProxy<RegisterProForwarder>,
       ) {}

       @Post('/register')
       @Public() // public endpoint, no JWT required
       @HttpCode(201)
       @Throttle({ default: { limit: 3, ttl: 60_000 } }) // 3/min/IP — plus strict que Customer (5/min) car pro register = lourd côté backend (INSEE + R2)
       @UseInterceptors(FilesInterceptor('files', 3, multerOptions)) // up to 3 files: idCard, rib, kbisOrInsee
       async register(
         @Body('payload') payloadJson: string, // JSON-stringified RegisterProInput
         @UploadedFiles() files: Express.Multer.File[],
         @Ip() clientIp: string,
         @Headers('user-agent') userAgent: string,
         @Cookies('tk_acq') firstTouchAcquisitionCookie: string | undefined,
       ): Promise<RegisterProResponse> {
         const payload = RegisterProInputSchema.parse(JSON.parse(payloadJson));
         const acquisition = mergeAcquisition(payload.acquisition, firstTouchAcquisitionCookie);
         const sortedFiles = sortFilesByFieldname(files); // map fieldname → file: { idCard, rib, kbisOrInsee? }
         if (!sortedFiles.idCard || !sortedFiles.rib) {
           throw new ValidationFailedException([{ path: ['files'], code: 'required', message: 'idCard and rib files are required' }]);
         }
         return this.registerProForwarder.getInstance().execute({
           ...payload,
           acquisition,
           files: sortedFiles,
           clientIp,
           userAgent,
         });
       }
     }
     ```
   - **`multerOptions`** (config dans `apps/gateway-api/src/infrastructure/http/utils/multer.config.ts`) :
     ```ts
     export const multerOptions: MulterOptions = {
       limits: {
         fileSize: 5 * 1024 * 1024, // 5 MB per file (cohérent AC1 frontend)
         files: 3, // max 3 files
         fields: 20, // max 20 form fields
       },
       fileFilter: (req, file, cb) => {
         const allowedMimes = ['image/jpeg', 'image/png', 'application/pdf'];
         if (!allowedMimes.includes(file.mimetype)) {
           return cb(new BadRequestException(`Invalid mime type: ${file.mimetype}`), false);
         }
         cb(null, true);
       },
       storage: multer.memoryStorage(), // store in memory (small files, transient — gateway-api forward to identity-svc immediately)
     };
     ```
   - **Forwarder use case** (`apps/gateway-api/src/usecases/register-pro.forwarder.ts`) — pattern Story 1.2 forward + error mapping :
     ```ts
     export class RegisterProForwarder {
       constructor(private readonly identitySvcClient: IIdentitySvcClient) {}
       async execute(input: RegisterProInput & { acquisition: AcquisitionInput; files: { idCard: Express.Multer.File; rib: Express.Multer.File; kbisOrInsee?: Express.Multer.File }; clientIp: string; userAgent: string }): Promise<RegisterProResponse> {
         try {
           return await this.identitySvcClient.registerPro(input);
         } catch (e) {
           if (e instanceof IdentitySvcConflictError) {
             throw new IdentityConflictException(e.tukioCode, e.message); // IDENTITY-CONFLICT-001 ou 002
           }
           if (e instanceof IdentitySvcValidationError) {
             throw new ValidationFailedException(e.issues);
           }
           if (e instanceof IdentitySvcExternalError) {
             throw new ExternalServiceException(e.tukioCode); // IDENTITY-EXTERNAL-001 (Keycloak), 002 (INSEE), 003 (R2)
           }
           throw e;
         }
       }
     }
     ```
   - **HTTP client identity-svc** (UPDATE `apps/gateway-api/src/infrastructure/external/identity-svc/identity-svc.client.ts` — Story 1.2 a posé `registerCustomer`, Story 1.3 ajoute `registerPro`) :
     - `async registerPro(input)`: POST `${IDENTITY_SVC_URL}/internal/pros` avec multipart/form-data forward (axios + `form-data` npm) — le payload + 3 files re-stream via FormData
     - Headers `X-Internal-Service-Token` (HMAC), `X-Tukio-Correlation-Id`
     - Timeout 30s (plus long que Customer car INSEE + R2 chain)
     - Retry 2x (idempotency-friendly : INSEE est read-only, mais ProProfile create est non-idempotent — donc retry ONLY si IDENTITY-EXTERNAL-001/002/003 codes, pas si IDENTITY-CONFLICT-002)
   - **Tests E2E gateway-api** (`apps/gateway-api/test/auth-pro-register.e2e-spec.ts`) :
     - Body valide + 3 files → 201 enveloppé avec userId + proProfileId
     - Body valide + missing idCard → 422 enveloppé "idCard required"
     - Body invalid SIRET (Luhn fail) → 422 enveloppé `IDENTITY-VALIDATION-001`
     - Body conflit SIRET (mock identity-svc retourne 409) → 409 enveloppé `IDENTITY-CONFLICT-002`
     - File trop gros (> 5 MB) → 413 enveloppé `PAYLOAD-TOO-LARGE-001`
     - File mauvais MIME (.exe) → 400 enveloppé `BAD-REQUEST-001`
     - 4ᵉ register du même IP en 1 min → 429 enveloppé avec `Retry-After`

4. **AC4 — identity-svc `POST /internal/pros` endpoint + use case `RegisterProUseCase`** : Given l'architecture Pretre Story 0.6 + 1.2, When je consulte `apps/identity-svc/src/`, Then je trouve :
   - **Domain ports nouveaux** (NEW) :
     - `domain/ports/insee-siret-validator.port.ts` :
       ```ts
       export interface IInseeSiretValidator {
         validate(siret: string): Promise<{
           active: boolean;
           denomination: string | null;
           naf: string | null;
           legalForm: string | null;
           checkedAt: Date;
         }>;
       }
       export const INSEE_SIRET_VALIDATOR = Symbol('INSEE_SIRET_VALIDATOR');
       ```
     - `domain/ports/media-storage.port.ts` :
       ```ts
       export interface IMediaStorage {
         uploadEncrypted(input: {
           bucket: string;
           key: string;
           buffer: Buffer;
           contentType: string;
           metadata: Record<string, string>;
         }): Promise<{ storageKey: string; etag: string; uploadedAt: Date }>;
         getSignedDownloadUrl(input: { bucket: string; key: string; expiresInSeconds: number }): Promise<string>;
         delete(input: { bucket: string; key: string }): Promise<void>;
       }
       export const MEDIA_STORAGE = Symbol('MEDIA_STORAGE');
       ```
     - `domain/ports/pro-profile.repository.port.ts` :
       ```ts
       export interface IProProfileRepository {
         findBySiret(siret: string): Promise<ProProfile | null>;
         findById(id: string): Promise<ProProfile | null>;
         findByUserProfileId(userProfileId: string): Promise<ProProfile | null>;
         save(proProfile: ProProfile): Promise<void>;
         runInTransaction<T>(callback: (txn: ProProfileTransactionContext) => Promise<T>): Promise<T>;
       }
       export const PRO_PROFILE_REPOSITORY = Symbol('PRO_PROFILE_REPOSITORY');
       ```
   - **Domain aggregate `ProProfile`** (NEW — `apps/identity-svc/src/domain/model/pro-profile.aggregate.ts`) :
     ```ts
     export class ProProfile {
       constructor(private readonly props: ProProfileProps) {}

       static register(input: {
         userProfileId: string;
         companyName: string;
         siret: Siret; // VO
         vatNumber: VatNumber | null;
         address: Address; // VO composite
         contactPhone: PhoneNumber; // VO
         kycDocs: { idCardKey: string; ribKey: string; kbisOrInseeKey: string | null };
         inseeCheck: { active: boolean; denomination: string | null; naf: string | null; checkedAt: Date };
       }): ProProfile {
         // invariants : SIRET valide format + Luhn (déjà validé Zod côté backend, ici on assume Siret VO les a passés)
         // INSEE check actif obligatoire (sinon factory throw — gating métier)
         if (!input.inseeCheck.active) {
           throw new IdentityValidationException('IDENTITY-VALIDATION-002', `SIRET ${input.siret.value} not active at INSEE (denomination: ${input.inseeCheck.denomination ?? 'unknown'})`);
         }
         const id = randomUUID();
         const now = new Date();
         return new ProProfile({
           id,
           userProfileId: input.userProfileId,
           companyName: input.companyName.trim(),
           siret: input.siret,
           vatNumber: input.vatNumber,
           address: input.address,
           contactPhone: input.contactPhone,
           kycIdCardR2Key: input.kycDocs.idCardKey,
           kycRibR2Key: input.kycDocs.ribKey,
           kycKbisR2Key: input.kycDocs.kbisOrInseeKey,
           kycStatus: 'pending_review',
           kycDecisionAt: null,
           kycDecisionBy: null,
           kycDecisionReason: null,
           inseeDenomination: input.inseeCheck.denomination,
           inseeNaf: input.inseeCheck.naf,
           inseeCheckedAt: input.inseeCheck.checkedAt,
           createdAt: now,
           updatedAt: now,
           deletedAt: null,
         });
       }

       // Methods Stories 2.x:
       // approveKyc(adminUserId, reason?): change kycStatus → 'approved'
       // rejectKyc(adminUserId, reason): change kycStatus → 'rejected'
       // markUnderReview(adminUserId): change kycStatus → 'under_review' (Story 2.4 admin starts review)
     }
     ```
   - **Value Objects NEW** :
     - `domain/model/value-objects/siret.value-object.ts` (validation + Luhn — réutilise `siretLuhnCheck` from `@tukio/contracts/utils/siret.ts`)
     - `domain/model/value-objects/vat-number.value-object.ts` (FR pattern + future EU validation V1+)
     - `domain/model/value-objects/address.value-object.ts` (composite : street, postalCode, city, country)
     - `domain/model/value-objects/phone-number.value-object.ts` (FR E.164 normalized)
   - **Use case `RegisterProUseCase`** (NEW — `apps/identity-svc/src/usecases/register-pro.usecase.ts`) :
     ```ts
     @Injectable()
     export class RegisterProUseCase {
       constructor(
         @Inject(USER_PROFILE_REPOSITORY) private readonly userProfileRepo: IUserProfileRepository,
         @Inject(PRO_PROFILE_REPOSITORY) private readonly proProfileRepo: IProProfileRepository,
         @Inject(KEYCLOAK_ADMIN) private readonly keycloakAdmin: IKeycloakAdmin,
         @Inject(INSEE_SIRET_VALIDATOR) private readonly inseeSiret: IInseeSiretValidator,
         @Inject(MEDIA_STORAGE) private readonly mediaStorage: IMediaStorage,
         @Inject(EVENT_PUBLISHER) private readonly eventPublisher: IEventPublisher,
         @Inject(CONFIG_SERVICE) private readonly config: IConfigService,
       ) {}

       async execute(input: RegisterProInput & { acquisition: AcquisitionInput; files: { idCard: FileBuffer; rib: FileBuffer; kbisOrInsee?: FileBuffer } }): Promise<{ userId: string; proProfileId: string; requiresAdminReview: true; requiresEmailVerification: true }> {
         // 1. Pré-checks DB : email + siret pas déjà utilisés
         const [existingByEmail, existingBySiret] = await Promise.all([
           this.userProfileRepo.findByEmail(input.email),
           this.proProfileRepo.findBySiret(input.siret),
         ]);
         if (existingByEmail) throw new IdentityConflictException('IDENTITY-CONFLICT-001', 'Email already registered');
         if (existingBySiret) throw new IdentityConflictException('IDENTITY-CONFLICT-002', `SIRET ${input.siret} already registered`);

         // 2. INSEE SIRENE V3.11 check (NFR79)
         let inseeCheck;
         try {
           inseeCheck = await this.inseeSiret.validate(input.siret);
         } catch (e) {
           if (e instanceof InseeUnreachableError) throw new ExternalServiceException('IDENTITY-EXTERNAL-002', 'INSEE SIRENE unreachable');
           throw e;
         }
         if (!inseeCheck.active) {
           throw new IdentityValidationException('IDENTITY-VALIDATION-002', `SIRET ${input.siret} not active at INSEE`);
         }

         // 3. Keycloak user create (rôle 'pro', email_verified=false, status='pending_admin_review', tukio:locale)
         let keycloakUserId: string;
         try {
           const result = await this.keycloakAdmin.createUser({
             email: input.email,
             firstName: input.firstName,
             lastName: input.lastName,
             password: input.password,
             locale: input.locale,
             emailVerified: false,
             role: 'pro',
             status: 'pending_admin_review', // claim Keycloak tukio:status
           });
           keycloakUserId = result.keycloakUserId;
         } catch (e) {
           if (e instanceof KeycloakUserAlreadyExistsError) throw new IdentityConflictException('IDENTITY-CONFLICT-001', 'Email already registered');
           throw new ExternalServiceException('IDENTITY-EXTERNAL-001', 'Keycloak unreachable');
         }

         // 4. Upload 3 KYC docs to R2 chiffré (saga compensable : si fail, rollback Keycloak)
         const proProfileId = randomUUID();
         const r2Bucket = this.config.getR2KycBucket(); // 'tukio-kyc-{env}'
         const uploadedKeys: string[] = [];
         let kycIdCardKey: string, kycRibKey: string, kycKbisKey: string | null = null;
         try {
           kycIdCardKey = `kyc/${proProfileId}/id-card/${Date.now()}-${randomUUID()}.${getExtension(input.files.idCard.mimetype)}`;
           await this.mediaStorage.uploadEncrypted({
             bucket: r2Bucket, key: kycIdCardKey,
             buffer: input.files.idCard.buffer, contentType: input.files.idCard.mimetype,
             metadata: { actorId: keycloakUserId, documentType: 'id-card', uploadedAt: new Date().toISOString() },
           });
           uploadedKeys.push(kycIdCardKey);

           kycRibKey = `kyc/${proProfileId}/rib/${Date.now()}-${randomUUID()}.${getExtension(input.files.rib.mimetype)}`;
           await this.mediaStorage.uploadEncrypted({ bucket: r2Bucket, key: kycRibKey, buffer: input.files.rib.buffer, contentType: input.files.rib.mimetype, metadata: { actorId: keycloakUserId, documentType: 'rib', uploadedAt: new Date().toISOString() } });
           uploadedKeys.push(kycRibKey);

           if (input.files.kbisOrInsee) {
             kycKbisKey = `kyc/${proProfileId}/kbis-insee/${Date.now()}-${randomUUID()}.${getExtension(input.files.kbisOrInsee.mimetype)}`;
             await this.mediaStorage.uploadEncrypted({ bucket: r2Bucket, key: kycKbisKey, buffer: input.files.kbisOrInsee.buffer, contentType: input.files.kbisOrInsee.mimetype, metadata: { actorId: keycloakUserId, documentType: 'kbis-or-insee', uploadedAt: new Date().toISOString() } });
             uploadedKeys.push(kycKbisKey);
           }
         } catch (e) {
           // Compensation : delete uploaded files + delete Keycloak user
           await Promise.all(uploadedKeys.map(k => this.mediaStorage.delete({ bucket: r2Bucket, key: k }).catch(() => {/* drift: cleanup later */})));
           await this.keycloakAdmin.deleteUser(keycloakUserId).catch(() => {/* drift: reconciliation Story 1.10 */});
           throw new ExternalServiceException('IDENTITY-EXTERNAL-003', 'R2 upload failed');
         }

         // 5. DB transaction: UserProfile + ProProfile + 2 outbox events
         try {
           const userProfile = UserProfile.register({
             keycloakUserId,
             email: Email.of(input.email),
             firstName: input.firstName,
             lastName: input.lastName,
             locale: input.locale,
             role: 'pro',
             status: 'pending_admin_review', // matches Keycloak claim
             marketingOptIn: input.acceptMarketing ?? false,
             acquisition: input.acquisition,
           });
           const proProfile = ProProfile.register({
             userProfileId: userProfile.id,
             // overriding generated id for consistency (passed in input)
             companyName: input.companyName,
             siret: Siret.of(input.siret),
             vatNumber: input.vatNumber ? VatNumber.of(input.vatNumber) : null,
             address: Address.of(input.address),
             contactPhone: PhoneNumber.of(input.contactPhone),
             kycDocs: { idCardKey: kycIdCardKey, ribKey: kycRibKey, kbisOrInseeKey: kycKbisKey },
             inseeCheck,
           });

           // verify token (réutilise pattern Story 1.2)
           const verifyToken = randomUUID();
           const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

           await this.userProfileRepo.runInTransaction(async (txn) => {
             await txn.userProfileRepo.save(userProfile);
             await txn.proProfileRepo.save(proProfile);
             await txn.tokenRepo.save({ token: verifyToken, userId: userProfile.id, expiresAt });

             // Event 1: identity.pro.registered.v1 (business event, consume by admin notif Story 2.3 + analytics V1)
             await txn.eventPublisher.publish({
               eventId: randomUUID(),
               eventType: 'identity.pro.registered',
               eventVersion: 'v1',
               occurredAt: new Date().toISOString(),
               aggregate: { type: 'ProProfile', id: proProfile.id },
               actor: { userId: userProfile.id, role: 'pro' },
               payload: {
                 userProfileId: userProfile.id,
                 proProfileId: proProfile.id,
                 email: userProfile.email.value,
                 firstName: userProfile.firstName,
                 lastName: userProfile.lastName,
                 companyName: proProfile.companyName,
                 siret: proProfile.siret.value,
                 vatNumber: proProfile.vatNumber?.value ?? null,
                 address: proProfile.address.toJSON(),
                 contactPhone: proProfile.contactPhone.value,
                 kycStatus: 'pending_review',
                 kycDocsUploaded: { idCard: true, rib: true, kbisOrInsee: kycKbisKey !== null },
                 locale: userProfile.locale,
                 acquisitionSource: userProfile.acquisitionSource,
                 registeredAt: userProfile.createdAt.toISOString(),
                 inseeCheck: { checkedAt: inseeCheck.checkedAt.toISOString(), active: inseeCheck.active, denomination: inseeCheck.denomination, naf: inseeCheck.naf },
               },
             });

             // Event 2: notification.email.send.v1 — pro confirmation
             await txn.eventPublisher.publish({
               eventId: randomUUID(),
               eventType: 'notification.email.send',
               eventVersion: 'v1',
               occurredAt: new Date().toISOString(),
               aggregate: { type: 'ProProfile', id: proProfile.id },
               actor: { userId: 'system', role: 'system' },
               payload: {
                 templateId: 'pro-pending-admin-review',
                 locale: userProfile.locale,
                 to: { email: userProfile.email.value, userId: userProfile.id, name: `${userProfile.firstName} ${userProfile.lastName}` },
                 params: {
                   firstName: userProfile.firstName,
                   companyName: proProfile.companyName,
                   estimatedReviewTimeHours: 24,
                   verifyUrl: `${this.config.getPublicBaseUrl()}/${userProfile.locale}/auth/email/verify?token=${verifyToken}`,
                 },
               },
             });
           });

           return { userId: userProfile.id, proProfileId: proProfile.id, requiresAdminReview: true, requiresEmailVerification: true };
         } catch (e) {
           // Full saga compensation : delete R2 files + delete Keycloak user
           await Promise.all(uploadedKeys.map(k => this.mediaStorage.delete({ bucket: r2Bucket, key: k }).catch(() => {})));
           await this.keycloakAdmin.deleteUser(keycloakUserId).catch(() => {});
           throw e;
         }
       }
     }
     ```
   - **Tests unitaires use case** (`register-pro.usecase.spec.ts`) avec ≥ 90 % coverage : (1) happy path → 201 + 2 events publiés + 3 R2 uploads + ProProfile en DB, (2) email déjà existant → 409 conflict, (3) SIRET déjà existant → 409 conflict-002, (4) INSEE retourne `active: false` → 422 validation-002, (5) INSEE DOWN → 502 external-002 + Keycloak rollback non appelé (n'avait pas encore été créé), (6) Keycloak DOWN → 502 external-001, (7) R2 upload fail middle → compensation rollback (Keycloak deleted + already-uploaded files deleted), (8) DB transaction fail → full saga compensation (R2 + Keycloak), (9) kbisOrInsee absent → 2 R2 uploads only (idCard + rib), (10) acquisition fields persistance avec defaults

5. **AC5 — Infrastructure : InseeSiretValidatorService + R2MediaStorageService + ProProfileRepo + migration** : Given les ports domain AC4, When je consulte `apps/identity-svc/src/infrastructure/`, Then :
   - **`infrastructure/external/insee/insee-siret-validator.service.ts`** (NEW) :
     - Implements `IInseeSiretValidator`
     - Auth INSEE OAuth2 client_credentials : POST `https://api.insee.fr/token` avec `grant_type=client_credentials` + Basic auth `<INSEE_KEY>:<INSEE_SECRET>` → bearer token (TTL 7 jours, cached in-memory + refresh 1h avant expiration)
     - Endpoint : `GET https://api.insee.fr/entreprises/sirene/V3.11/siret/${siret}` avec `Authorization: Bearer ${token}` + `Accept: application/json`
     - Response parse : extract `etablissement.uniteLegale.{denominationUniteLegale, categorieJuridiqueUniteLegale, etatAdministratifUniteLegale, activitePrincipaleUniteLegale (NAF code)}`
     - **Active check** : `etatAdministratifUniteLegale === 'A'` (A = active, F = fermé/closed)
     - **404 Response** : SIRET inexistant → `{ active: false, denomination: null, naf: null, legalForm: null }` (treated as inactive in domain)
     - **Rate limit** INSEE free tier : 30 req/sec — gateway-api throttling (3/min/IP register pro) garantit qu'on reste largement en-dessous
     - **Error handling** : 429 INSEE → wait + retry 3x exponential ; 5xx → throw `InseeUnreachableError`
     - **Caching** : pas de cache des SIRET checks (chaque check est un point-in-time, et un SIRET peut passer F → A entre register et admin review — au MVP on accept un re-check Story 2.4 admin review)
     - **PII redaction** logs (NFR16) : pas de SIRET en clair dans logs INFO (uniquement DEBUG)
     - **Tests integration** : mock INSEE API via `nock` (intercept `api.insee.fr`) + tester active=true / active=false / 404 / 429 retry / 5xx fail
   - **`infrastructure/external/r2/r2-media-storage.service.ts`** (NEW) :
     - Implements `IMediaStorage`
     - Utilise `@aws-sdk/client-s3` (latest stable) — Cloudflare R2 est S3-compatible
     - Config : `endpoint: ${R2_ENDPOINT}` (cohérent Cloudflare R2 docs `https://<account-id>.r2.cloudflarestorage.com`), `region: 'auto'`, `credentials: { accessKeyId, secretAccessKey }` (Doppler env vars)
     - **`uploadEncrypted`** : `PutObjectCommand` avec `ServerSideEncryption: 'AES256'` (R2 supports SSE) + `Metadata: { actorId, documentType, uploadedAt }` + `ContentType` + `Body: buffer`
     - **`getSignedDownloadUrl`** : `getSignedUrl(s3Client, GetObjectCommand({ Bucket, Key }), { expiresIn: 300 })` → URL signée 5 min (NFR15 + AC1)
     - **`delete`** : `DeleteObjectCommand` (utilisé pour rollback compensation)
     - **Local dev** : utiliser **MinIO** (S3-compatible local) si Story 0.10 le bundle, OU configurer R2 dev account Cloudflare avec un bucket `tukio-kyc-dev`. **Décision Story 1.3** : utiliser un bucket Cloudflare R2 dev shared par tous les devs (free tier R2 = 10 GB storage gratuit, suffisant), credentials dev partagés via Doppler `dev` config. Alternative : MinIO dans Docker Compose Story 0.10 (à wirer Task 5).
     - **Métriques Prom** : `tukio_r2_uploads_total{bucket,status}`, `tukio_r2_upload_duration_seconds`, `tukio_r2_signed_urls_generated_total`
     - **Tests integration** : mocker S3 client via `aws-sdk-client-mock` ou démarrer MinIO testcontainer (Story 0.9 helper à ajouter)
   - **`infrastructure/persistence/typeorm/entities/pro-profile.entity.ts`** (NEW) :
     ```ts
     @Entity('pro_profiles')
     export class ProProfileEntity {
       @PrimaryColumn('uuid') id: string;
       @Column('uuid', { name: 'user_profile_id', unique: true }) userProfileId: string;
       @Column('varchar', { name: 'company_name', length: 200 }) companyName: string;
       @Column('varchar', { length: 14, unique: true }) siret: string; // unique partial: WHERE deleted_at IS NULL
       @Column('varchar', { name: 'vat_number', length: 20, nullable: true }) vatNumber: string | null;
       @Column('jsonb') address: { street: string; postalCode: string; city: string; country: 'FR' };
       @Column('varchar', { name: 'contact_phone', length: 20 }) contactPhone: string;
       @Column('varchar', { name: 'kyc_id_card_r2_key', length: 500 }) kycIdCardR2Key: string;
       @Column('varchar', { name: 'kyc_rib_r2_key', length: 500 }) kycRibR2Key: string;
       @Column('varchar', { name: 'kyc_kbis_r2_key', length: 500, nullable: true }) kycKbisR2Key: string | null;
       @Column('varchar', { name: 'kyc_status', length: 30, default: 'pending_review' }) kycStatus: 'pending_review' | 'under_review' | 'approved' | 'rejected';
       @Column('timestamptz', { name: 'kyc_decision_at', nullable: true }) kycDecisionAt: Date | null;
       @Column('uuid', { name: 'kyc_decision_by', nullable: true }) kycDecisionBy: string | null;
       @Column('text', { name: 'kyc_decision_reason', nullable: true }) kycDecisionReason: string | null;
       @Column('varchar', { name: 'insee_denomination', length: 200, nullable: true }) inseeDenomination: string | null;
       @Column('varchar', { name: 'insee_naf', length: 10, nullable: true }) inseeNaf: string | null;
       @Column('timestamptz', { name: 'insee_checked_at', nullable: true }) inseeCheckedAt: Date | null;
       @Column('timestamptz', { name: 'created_at', default: () => 'NOW()' }) createdAt: Date;
       @Column('timestamptz', { name: 'updated_at', default: () => 'NOW()' }) updatedAt: Date;
       @Column('timestamptz', { name: 'deleted_at', nullable: true }) deletedAt: Date | null;
     }
     ```
   - **`infrastructure/persistence/typeorm/repositories/pro-profile.typeorm.repository.ts`** (NEW) :
     - Implements `IProProfileRepository`
     - Mapper aggregate ↔ entity (`pro-profile.mapper.ts` séparé)
     - `findBySiret`, `findByUserProfileId`, `save` standard + `runInTransaction` qui partage QueryRunner avec UserProfileRepo + EventPublisher (cohérent Story 1.2 pattern)
   - **`infrastructure/persistence/typeorm/migrations/1715240000000-CreateProProfilesTable.ts`** (NEW) :
     ```sql
     CREATE TABLE pro_profiles (
       id UUID PRIMARY KEY,
       user_profile_id UUID NOT NULL UNIQUE REFERENCES user_profiles(id) ON DELETE CASCADE,
       company_name VARCHAR(200) NOT NULL,
       siret VARCHAR(14) NOT NULL,
       vat_number VARCHAR(20) NULL,
       address JSONB NOT NULL,
       contact_phone VARCHAR(20) NOT NULL,
       kyc_id_card_r2_key VARCHAR(500) NOT NULL,
       kyc_rib_r2_key VARCHAR(500) NOT NULL,
       kyc_kbis_r2_key VARCHAR(500) NULL,
       kyc_status VARCHAR(30) NOT NULL DEFAULT 'pending_review'
         CHECK (kyc_status IN ('pending_review', 'under_review', 'approved', 'rejected')),
       kyc_decision_at TIMESTAMPTZ NULL,
       kyc_decision_by UUID NULL,
       kyc_decision_reason TEXT NULL,
       insee_denomination VARCHAR(200) NULL,
       insee_naf VARCHAR(10) NULL,
       insee_checked_at TIMESTAMPTZ NULL,
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       deleted_at TIMESTAMPTZ NULL
     );
     -- Anti-doublon SIRET sur Pros actifs (FR16)
     CREATE UNIQUE INDEX idx_pro_profiles_siret_active ON pro_profiles (siret) WHERE deleted_at IS NULL;
     CREATE INDEX idx_pro_profiles_kyc_status ON pro_profiles (kyc_status) WHERE deleted_at IS NULL;
     CREATE INDEX idx_pro_profiles_insee_checked_at ON pro_profiles (insee_checked_at);
     ```
     - `down()` : DROP TABLE + DROP INDEXes (rollback NFR72)

6. **AC6 — Controller HTTP `POST /internal/pros` (internal-only, multipart)** : Given `apps/identity-svc/src/infrastructure/http/controllers/pro.controller.ts` (NEW), When je l'ouvre, Then :
   ```ts
   @Controller('/internal/pros')
   @UseGuards(InternalServiceGuard) // hmac shared secret Story 1.2
   export class ProController {
     constructor(private readonly registerProUseCaseProxy: UseCaseProxy<RegisterProUseCase>) {}

     @Post()
     @HttpCode(201)
     @UseInterceptors(FilesInterceptor('files', 3, multerOptions))
     async register(
       @Body('payload') payloadJson: string,
       @UploadedFiles() files: Express.Multer.File[],
     ): Promise<{ userId: string; proProfileId: string; requiresAdminReview: true; requiresEmailVerification: true }> {
       const payload = RegisterProInputSchema.parse(JSON.parse(payloadJson));
       const sortedFiles = sortFilesByFieldname(files);
       return this.registerProUseCaseProxy.getInstance().execute({ ...payload, files: sortedFiles });
     }
   }
   ```
   - **Différence vs Customer Story 1.2** : multipart/form-data au lieu de JSON pure (à cause des 3 files KYC)
   - Tests E2E `customer-register` Story 1.2 inspiré pour `pro-register.e2e-spec.ts` :
     - Sans `X-Internal-Service-Token` → 403 enveloppé
     - Avec body invalide Zod (SIRET malformé) → 422 enveloppé
     - Avec body conflit SIRET (mock proRepo retourne existing) → 409 enveloppé `IDENTITY-CONFLICT-002`
     - Avec body OK + 3 files → 201 enveloppé + vérifier UserProfile + ProProfile en DB + 3 R2 uploads + 2 events outbox publiés
     - Test idempotence : 2 calls identiques → 1 succès + 1 conflit (race condition handling)
     - Test compensation : mock R2 fail middle → vérifier rollback Keycloak deleteUser appelé + ne PAS persister UserProfile/ProProfile

7. **AC7 — Middleware Next.js apps/seller redirect `/seller/onboarding/pending` (FR17)** : Given un Pro fraîchement registered avec `tukio_status='pending_admin_review'`, When il se connecte (Story 1.4) et navigue `seller.tukio.one/seller/listings/new` ou tout autre endpoint transactionnel, Then :
   - **Update `apps/seller/src/middleware.ts`** (Story 0.8 squelette) : ajouter logique check `tukio:status` claim JWT + redirect transactional paths
     ```ts
     const TRANSACTIONAL_PATHS = ['/seller/listings', '/seller/bookings', '/seller/messages', '/seller/services'];
     // ...
     if (jwt && jwt.payload['tukio:status'] === 'pending_admin_review') {
       const url = new URL(`/${locale}/seller/onboarding/pending`, request.url);
       url.searchParams.set('next', request.nextUrl.pathname);
       return NextResponse.redirect(url);
     }
     ```
   - **Page `apps/seller/src/app/[locale]/seller/onboarding/pending/page.tsx`** (NEW Story 1.3, finalisé Story 2.x) :
     ```tsx
     export default function ProPendingPage() {
       const t = useTranslations('seller.onboarding.pending');
       return (
         <EmptyState
           variant="info"
           illustration="<HourglassIcon />"
           title={t('title')} // "Votre dossier est en cours de vérification"
           description={t('description')} // "Validation sous 24h ouvrées..."
           cta={<Button variant="secondary" asChild><Link href="/seller/onboarding/track">{t('cta.track')}</Link></Button>} // CTA "Voir l'avancement" — Story 2.x track page
         />
       );
     }
     ```
   - **i18n** : ajouter `apps/seller/messages/{fr,en}.json` namespace `seller.onboarding.pending.*`
   - **Whitelist paths non-transactionnels** : `/seller/profile` (lecture-only), `/seller/onboarding/pending`, `/seller/onboarding/track` (Story 2.x), `/seller/help`, `/seller/settings/account` (lecture-only) — accessibles même `pending_admin_review`
   - **Tests E2E** (`apps/seller/e2e/middleware/pending-redirect.spec.ts`) : se connecter (mock JWT fixture) avec un user `tukio:status='pending_admin_review'` → naviguer `/seller/listings/new` → vérifier redirect vers `/seller/onboarding/pending`. Naviguer `/seller/profile` → pas de redirect (whitelist).

8. **AC8 — Anti-doublon SIRET (FR16) + INSEE rate-limiting + retention RGPD** : Given les contraintes business + RGPD, When un Pro tente de s'inscrire, Then :
   - **Anti-doublon SIRET strict** (FR16) : check `proProfileRepo.findBySiret(input.siret)` — si match `deleted_at IS NULL` → throw `IDENTITY-CONFLICT-002` (cohérent index unique partial AC5 migration). **Cas Enterprise V2** : groupes multi-entités peuvent partager SIRET → exception V2 (Epic 15) qui autorise plusieurs `pro_profiles` même SIRET avec différent `parent_org_id`. Pour MVP : strict 1 SIRET = 1 ProProfile actif.
   - **Rate-limiting INSEE-friendly** : gateway-api throttle 3/min/IP register pro AC3 + INSEE free tier 30 req/sec. Marge 10x. Le throttler protège également contre des attaques par énumération SIRET (probe pour découvrir si un SIRET est déjà registered chez Tukio — protégé en double : IP throttling + message générique côté frontend qui dit "support").
   - **Retention RGPD KYC docs** (NFR15) : les fichiers R2 sont conservés selon la décision admin Story 2.5 :
     - **Si `kyc_status = 'approved'`** : conservés en R2 jusqu'à délétion compte (Story 1.9 RGPD purge complete)
     - **Si `kyc_status = 'rejected'`** : conservés 90 jours post-`kyc_decision_at` puis purgés via cron job nightly Story 1.10 (`purge-rejected-kyc-docs.task.ts`)
     - **Si `kyc_status = 'pending_review'` > 30 jours** : auto-rejection Story 2.8 → cascade vers retention 90j
   - **Cron job purge** (différé Story 1.10 ou Epic 2) : Story 1.3 documente le contrat dans Dev Notes, ne l'implémente pas. Schema DB + R2 keys persistés permettent à Story 1.10/2.8 d'implémenter le cron.
   - **Signed URLs admin Stories 2.4** : la méthode `mediaStorage.getSignedDownloadUrl({ bucket, key, expiresInSeconds: 300 })` est utilisable par `admin-svc` (Story 2.4) pour générer des URLs signées 5 min consultables uniquement par admins authentifiés (`@RequireMfa` + `@Roles('admin-modo', 'admin-super')`).

9. **AC9 — Tests Playwright e2e wizard FR + EN + axe-core (NFR48 + UX-DR9)** : Given `apps/public/e2e/auth/pro-register.spec.ts` (NEW), When je lance `pnpm --filter=apps/public test:e2e --grep "pro register"`, Then :
   - **Test 1 (happy path FR — wizard 3 steps)** : naviguer `localhost:3000/fr/auth/sign-up?role=pro` → step 1 remplir compte → "Continuer →" → step 2 remplir société (SIRET valide fixtures `'12345678901234'` Luhn-OK + INSEE active mock) → "Continuer →" → step 3 upload 3 files (idCard.jpg + rib.pdf + kbis.pdf fixtures dans `apps/public/e2e/fixtures/`) → "Soumettre mon dossier" → vérifier redirect vers `seller.tukio.one/fr/seller/onboarding/pending` + toast `"Dossier soumis. Validation sous 24h."`
   - **Test 2 (happy path EN)** : idem en `/en/auth/sign-up?role=pro` → vérifier UI strings EN
   - **Test 3 (Luhn fail)** : SIRET malformé `'00000000000000'` → step 2 button disabled + message inline `"SIRET invalide (Luhn check failed)"`
   - **Test 4 (anti-doublon SIRET)** : précréer un ProProfile fixture avec SIRET `'12345678901234'` via testcontainers Postgres → soumettre form avec même SIRET → 409 → message UI inline sous champ SIRET `"Ce SIRET est déjà associé à un compte actif"`
   - **Test 5 (INSEE inactif)** : SIRET valid Luhn mais mocké INSEE retourne `etatAdministratifUniteLegale: 'F'` (closed) → 422 → message UI `"Le SIRET fourni n'est pas reconnu comme actif au registre INSEE"`
   - **Test 6 (INSEE DOWN)** : mock INSEE 503 → 502 → message UI `"Service de vérification temporairement indisponible, réessayez dans quelques minutes"`
   - **Test 7 (file too large)** : upload idCard 6 MB → message inline frontend `"Fichier trop volumineux (max 5 MB)"` + button disabled
   - **Test 8 (rate-limit 429)** : 4 register pro depuis même IP en 1 min → 4ᵉ retourne UI message `"Trop de tentatives, réessayez dans Xs"`
   - **Test 9 (FR17 redirect pending)** : se connecter (mock Keycloak fixture) avec un user `tukio:status='pending_admin_review'` → naviguer `seller.tukio.one/seller/listings/new` → vérifier redirect vers `/seller/onboarding/pending` (cross-zone Vercel rewrite Story 0.13)
   - **Test 10 (axe-core a11y)** : `await injectAxe(page); await checkA11y(page);` sur chaque step du wizard — vérifier 0 violations critical/serious (RGAA AA — Story 0.13 lint axe-core). FileUpload accessible.
   - **Test 11 (NFR48 perf wizard complet)** : mesurer temps `page.goto('/fr/auth/sign-up?role=pro')` → submit success → `page.waitForURL('**/onboarding/pending')` → assert ≤ 5 min p90 (10 runs, p9). Marge plus large que Story 1.2 (30s) car wizard 3 steps + INSEE call + R2 uploads.
   - **Coverage** : ≥ 80 % gateway-api endpoint, ≥ 90 % identity-svc use case (NFR71)

10. **AC10 — Documentation runbook + observability + ADR + email template** : Given le scope cross-cutting Story 1.3, When je consulte `docs/`, Then :
    - **`docs/runbook/pro-registration-debug.md`** (NEW ~80 lignes) : flow end-to-end (frontend wizard → gateway multipart → identity-svc → INSEE → Keycloak → R2 → Postgres → NATS), troubleshooting (INSEE DOWN, R2 upload fail middle, Keycloak DOWN, transaction rollback, KYC docs orphelins R2), commandes utiles (`pnpm --filter=identity-svc query:pro-by-siret`, list R2 objects, `pnpm --filter=identity-svc query:outbox-pending`), correlation Loki traces Tempo
    - **`docs/runbook/kyc-docs-retention.md`** (NEW ~40 lignes) : RGPD retention rules (90 jours rejected, jusqu'à délétion approved), cron purge Story 1.10/2.8 contract, signed URLs admin, secret rotation R2 credentials
    - **`docs/runbook/insee-sirene-integration.md`** (NEW ~50 lignes) : INSEE API account setup (https://api.insee.fr/), OAuth2 client_credentials flow, rate limits 30/sec free + paid plans, fallback comportement si INSEE DOWN, cache strategy (none MVP)
    - **`packages/contracts/README.md`** (UPDATE Story 1.2) : section "Identity events" ajouter `identity.pro.registered.v1` + `notification.email.send.v1` template `pro-pending-admin-review`
    - **Email template `pro-pending-admin-review`** (Story 5.4 finalise — Story 1.3 fournit le payload contract) :
      - **FR** : subject "Votre dossier Tukio est en cours de validation", body : "Bonjour {firstName}, votre inscription Pro pour {companyName} a bien été reçue. Validation sous {estimatedReviewTimeHours}h ouvrées. Vous serez notifié par email. CTA: Vérifier mon email + lien de vérification."
      - **EN** : subject "Your Tukio Pro application is being reviewed", body equivalent
    - **Métriques Prometheus** : `tukio_register_pro_attempts_total{result}`, `tukio_register_pro_duration_seconds`, `tukio_insee_calls_total{status}`, `tukio_r2_kyc_uploads_total{document_type,status}`
    - **Dashboard Grafana** (`infra/k8s/grafana-dashboards/pro-registration.json` NEW) : 5 panels (funnel pro register, p95 latency, INSEE failure rate, R2 upload duration, NATS event lag)
    - **ADR** : pas de nouvel ADR Story 1.3 (s'inscrit dans ADR-009 Keycloak split + ADR-007 outbox + ADR-014 envelope existants). Story 0.13 ADR-009 update (Story 1.1 a déjà ajouté Implementation Notes — Story 1.3 ajoute brève mention "Pro registration uses same pattern as Customer Story 1.2 + INSEE + R2")

## Tasks / Subtasks

- [ ] **Task 1 — Étendre `@tukio/contracts` avec DTOs + utils SIRET + events Pro** (AC: #2)
  - [ ] 1.1 — Créer `packages/contracts/src/dtos/identity/register-pro.dto.ts` (Zod schemas + ProAddress)
  - [ ] 1.2 — Créer `packages/contracts/src/utils/siret.ts` (`siretLuhnCheck` function avec tests unit `siret.spec.ts` 5+ SIRETs réels validés)
  - [ ] 1.3 — Créer `packages/contracts/src/events/identity/pro-registered.v1.{schema.json,ts}` (JSON Schema + types TS générés)
  - [ ] 1.4 — Update `packages/contracts/src/types/error-codes.ts` : ajouter codes `IDENTITY-VALIDATION-002`, `IDENTITY-VALIDATION-003`, `IDENTITY-EXTERNAL-002`, `IDENTITY-EXTERNAL-003`
  - [ ] 1.5 — Update `packages/contracts/src/types/email-templates.ts` : ajouter `'pro-pending-admin-review'` templateId
  - [ ] 1.6 — Update `packages/contracts/src/index.ts` : barrel + subpath exports `./dtos/identity`, `./utils`, `./events/identity`
  - [ ] 1.7 — `pnpm --filter=@tukio/contracts build && pnpm --filter=@tukio/contracts test` (vérifier types générés OK + Zod schemas valides + Luhn tests pass)

- [ ] **Task 2 — Étendre identity-svc domain : ProProfile aggregate + VOs + ports** (AC: #4)
  - [ ] 2.1 — Créer `apps/identity-svc/src/domain/model/pro-profile.aggregate.ts` (factory `register()` + invariants)
  - [ ] 2.2 — Créer `apps/identity-svc/src/domain/model/value-objects/{siret,vat-number,address,phone-number}.value-object.ts` (4 VOs)
  - [ ] 2.3 — Créer `apps/identity-svc/src/domain/ports/{insee-siret-validator,media-storage,pro-profile.repository}.port.ts` (3 ports + Symbol tokens)
  - [ ] 2.4 — Update `apps/identity-svc/src/domain/ports/tokens.ts` : ajouter `INSEE_SIRET_VALIDATOR`, `MEDIA_STORAGE`, `PRO_PROFILE_REPOSITORY`
  - [ ] 2.5 — Créer `apps/identity-svc/src/domain/exception/identity-validation.exception.ts` (extends DomainException, httpStatus 422)
  - [ ] 2.6 — Update `apps/identity-svc/src/domain/exception/external-service.exception.ts` (Story 1.2 a posé, étendre pour codes 002 et 003)
  - [ ] 2.7 — Tests unit aggregate `pro-profile.aggregate.spec.ts` : factory register valide, invariants (companyName non vide, siret VO valide, INSEE active obligatoire), VOs validés
  - [ ] 2.8 — Tests VOs : `siret.value-object.spec.ts` (Luhn + format), `phone-number.value-object.spec.ts` (FR E.164 normalize), `address.value-object.spec.ts` (postal code 5 digits)

- [ ] **Task 3 — Implémenter use case `RegisterProUseCase` + tests** (AC: #4)
  - [ ] 3.1 — Créer `apps/identity-svc/src/usecases/register-pro.usecase.ts` (cf. AC4 squelette, ~150 lignes)
  - [ ] 3.2 — Tests unit `register-pro.usecase.spec.ts` (Vitest + mocks ports) — 10+ cases (cf. AC4 fin)
  - [ ] 3.3 — Coverage ≥ 90 % use case (NFR71 + Story 0.6 jest config)

- [ ] **Task 4 — Implémenter infrastructure : InseeSiretValidator + R2MediaStorage + ProProfileRepo + migration** (AC: #5)
  - [ ] 4.1 — Installer `@aws-sdk/client-s3` (latest stable) + `@aws-sdk/s3-request-presigner` : `pnpm --filter=identity-svc add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`
  - [ ] 4.2 — Créer `apps/identity-svc/src/infrastructure/external/insee/insee-siret-validator.service.ts` (OAuth2 client_credentials + cache token + parse V3.11 response)
  - [ ] 4.3 — Créer `apps/identity-svc/src/infrastructure/external/insee/insee-token-cache.service.ts` (cache bearer 7 jours + refresh proactif)
  - [ ] 4.4 — Créer `apps/identity-svc/src/infrastructure/external/insee/errors.ts` (`InseeUnreachableError`, `InseeRateLimitError`)
  - [ ] 4.5 — Créer `apps/identity-svc/src/infrastructure/external/insee/insee.module.ts` (NestJS module)
  - [ ] 4.6 — Créer `apps/identity-svc/src/infrastructure/external/r2/r2-media-storage.service.ts` (implements IMediaStorage, wraps `@aws-sdk/client-s3`, server-side encryption AES256, signed URLs 5 min)
  - [ ] 4.7 — Créer `apps/identity-svc/src/infrastructure/external/r2/r2.module.ts`
  - [ ] 4.8 — Créer `apps/identity-svc/src/infrastructure/external/r2/errors.ts` (`R2UploadError`, `R2NotFoundError`)
  - [ ] 4.9 — Créer `apps/identity-svc/src/infrastructure/persistence/typeorm/entities/pro-profile.entity.ts`
  - [ ] 4.10 — Créer `apps/identity-svc/src/infrastructure/persistence/typeorm/repositories/pro-profile.typeorm.repository.ts` (implements IProProfileRepository, mapper aggregate ↔ entity, runInTransaction partage QueryRunner)
  - [ ] 4.11 — Créer `apps/identity-svc/src/infrastructure/persistence/typeorm/mappers/pro-profile.mapper.ts`
  - [ ] 4.12 — Créer migration `1715240000000-CreateProProfilesTable.ts` (cf. AC5 SQL + index unique partial siret + 3 autres indexes)
  - [ ] 4.13 — Update `apps/identity-svc/src/infrastructure/persistence/typeorm/data-source.ts` : ajouter `ProProfileEntity` à `entities`
  - [ ] 4.14 — Tests integration `insee-siret-validator.integration.spec.ts` : `nock` mock INSEE API + tester active=true / active=false / 404 / 429 retry / 5xx fail
  - [ ] 4.15 — Tests integration `r2-media-storage.integration.spec.ts` : mocker S3 client via `aws-sdk-client-mock` + tester upload / signedUrl / delete
  - [ ] 4.16 — Tests integration `pro-profile.typeorm.repository.integration.spec.ts` : Postgres testcontainer + tester findBySiret/save/runInTransaction

- [ ] **Task 5 — Wirer use case dans UseCasesProxyModule + controller `POST /internal/pros`** (AC: #6)
  - [ ] 5.1 — Update `apps/identity-svc/src/infrastructure/usecases-proxy/usecases-proxy.module.ts` : ajouter provider `REGISTER_PRO_USECASES_PROXY` qui wire `RegisterProUseCase` avec ses 7 ports
  - [ ] 5.2 — Créer `apps/identity-svc/src/infrastructure/http/controllers/pro.controller.ts` (cf. AC6) avec `@UseGuards(InternalServiceGuard)` Story 1.2 réutilisé
  - [ ] 5.3 — Créer `apps/identity-svc/src/infrastructure/http/dtos/register-pro-input.dto.ts` (Zod-pipe wrapping)
  - [ ] 5.4 — Créer `apps/identity-svc/src/infrastructure/http/utils/sort-files-by-fieldname.ts` (partagé avec gateway-api)
  - [ ] 5.5 — Update `apps/identity-svc/src/infrastructure/http/http.module.ts` : ajouter `ProController` à `controllers`
  - [ ] 5.6 — Installer `multer` + `@types/multer` (déjà bundle dans `@nestjs/platform-fastify` ? sinon `pnpm add multer @types/multer`)
  - [ ] 5.7 — Update `apps/identity-svc/.env.example` : ajouter `INSEE_API_URL=https://api.insee.fr`, `INSEE_CLIENT_ID=...`, `INSEE_CLIENT_SECRET=...`, `R2_ACCOUNT_ID=...`, `R2_ACCESS_KEY_ID=...`, `R2_SECRET_ACCESS_KEY=...`, `R2_KYC_BUCKET=tukio-kyc-{env}`
  - [ ] 5.8 — Update `apps/identity-svc/src/infrastructure/config/environment-config.service.ts` : ajouter `getInseeConfig()`, `getR2Config()`, `getR2KycBucket()` (Zod-validated)
  - [ ] 5.9 — Tests E2E `apps/identity-svc/test/pro-register.e2e-spec.ts` (cf. AC6 fin — 6+ cases)

- [ ] **Task 6 — gateway-api endpoint `POST /v1/auth/pro/register` multipart** (AC: #3)
  - [ ] 6.1 — Update `apps/gateway-api/src/domain/ports/identity-svc.port.ts` : ajouter `registerPro(input)` method
  - [ ] 6.2 — Créer `apps/gateway-api/src/usecases/register-pro.forwarder.ts`
  - [ ] 6.3 — Update `apps/gateway-api/src/infrastructure/external/identity-svc/identity-svc.client.ts` : ajouter `registerPro` (multipart forward via `form-data` npm + axios)
  - [ ] 6.4 — Installer `form-data` : `pnpm --filter=gateway-api add form-data`
  - [ ] 6.5 — Créer `apps/gateway-api/src/infrastructure/http/controllers/auth-pro.controller.ts` (cf. AC3 squelette)
  - [ ] 6.6 — Créer `apps/gateway-api/src/infrastructure/http/utils/multer.config.ts` (5 MB limit, 3 files, MIME whitelist)
  - [ ] 6.7 — Créer `apps/gateway-api/src/infrastructure/http/utils/sort-files-by-fieldname.ts` (réutilisé identity-svc)
  - [ ] 6.8 — Update `apps/gateway-api/src/app.module.ts` : ajouter throttler config sensitive `'pro-register'` 3/min
  - [ ] 6.9 — Update `apps/gateway-api/.env.example` : ajouter `THROTTLER_PRO_REGISTER_LIMIT=3`, `THROTTLER_PRO_REGISTER_TTL_MS=60000`
  - [ ] 6.10 — Tests E2E `apps/gateway-api/test/auth-pro-register.e2e-spec.ts` (cf. AC3 fin — 7 cases)

- [ ] **Task 7 — Frontend wizard 3 steps `<ProSignUpWizard>`** (AC: #1)
  - [ ] 7.1 — Créer `packages/api-client/src/hooks/identity/use-register-pro.ts` (TanStack Query mutation, multipart FormData, types `@tukio/contracts`)
  - [ ] 7.2 — Créer `apps/public/src/app/[locale]/auth/sign-up/page.tsx` (UPDATE Story 1.2 ou NEW) : detect `?role=pro` query param + render `<ProSignUpWizard>` ou `<SignUpForm>` (Story 1.2)
  - [ ] 7.3 — Créer `apps/public/src/features/auth/sign-up-pro/components/ProSignUpWizard.tsx` (Client Component, 3 steps state in `useReducer`)
  - [ ] 7.4 — Créer `apps/public/src/features/auth/sign-up-pro/components/{StepAccount,StepCompany,StepDocuments}.tsx` (3 sous-composants forms)
  - [ ] 7.5 — Créer `apps/public/src/features/auth/sign-up-pro/services/sign-up-pro.service.ts` (FormData construction + mutation)
  - [ ] 7.6 — Update `apps/public/messages/{fr,en}.json` : ajouter namespace `auth.signupPro.*` (~40 keys)
  - [ ] 7.7 — Vérifier `<StepIndicator>` Story 0.5 disponible dans `@tukio/ui/patterns` + utiliser
  - [ ] 7.8 — Vérifier `<FileUpload>` Story 0.5 disponible dans `@tukio/ui/patterns` + utiliser
  - [ ] 7.9 — Update `packages/api-client/src/hooks/index.ts` : barrel ajouter `use-register-pro`

- [ ] **Task 8 — Apps/seller middleware redirect pending + page onboarding/pending** (AC: #7)
  - [ ] 8.1 — Update `apps/seller/src/middleware.ts` : ajouter logique check `tukio:status='pending_admin_review'` claim JWT + redirect transactional paths (cf. AC7)
  - [ ] 8.2 — Créer `apps/seller/src/app/[locale]/seller/onboarding/pending/page.tsx` (placeholder Story 1.3, finalisé Story 2.x avec track avancement)
  - [ ] 8.3 — Update `apps/seller/messages/{fr,en}.json` : ajouter namespace `seller.onboarding.pending.*`
  - [ ] 8.4 — Tests E2E `apps/seller/e2e/middleware/pending-redirect.spec.ts` : se connecter mock JWT pending → naviguer transactional → vérifier redirect, naviguer whitelist → pas de redirect

- [ ] **Task 9 — Tests Playwright e2e wizard FR/EN + axe-core + perf NFR48** (AC: #9)
  - [ ] 9.1 — Créer `apps/public/e2e/auth/pro-register.spec.ts` avec 11 tests (cf. AC9)
  - [ ] 9.2 — Créer fixtures `apps/public/e2e/fixtures/{idCard.jpg,rib.pdf,kbis.pdf,idCard-too-large.jpg}` (real-ish files, ~1-2 MB chaque sauf trop-large 6 MB)
  - [ ] 9.3 — Setup mock INSEE API en CI (testcontainer wiremock OU `nock` au niveau identity-svc test) — fixture SIRET `'12345678901234'` actif, `'00000000000000'` inactif
  - [ ] 9.4 — Setup R2 mock en CI : MinIO testcontainer (Story 0.9 helper à ajouter Task 9.4) ou `aws-sdk-client-mock` au niveau identity-svc
  - [ ] 9.5 — Run Playwright en CI (`.github/workflows/e2e.yml` UPDATE Story 1.2) : `pnpm --filter=apps/public test:e2e --project=chromium-fr --project=chromium-en --grep "pro register"`
  - [ ] 9.6 — Vérifier 0 violations axe-core critical/serious sur chaque step du wizard
  - [ ] 9.7 — Vérifier perf NFR48 ≤ 5 min p90 (10 runs p9)

- [ ] **Task 10 — Observability + runbooks + commit** (AC: #10)
  - [ ] 10.1 — Ajouter métriques Prom gateway-api (`tukio_register_pro_*`)
  - [ ] 10.2 — Ajouter métriques Prom identity-svc (`tukio_insee_calls_total`, `tukio_r2_kyc_uploads_total`)
  - [ ] 10.3 — Créer `infra/k8s/grafana-dashboards/pro-registration.json` (5 panels)
  - [ ] 10.4 — Créer `docs/runbook/pro-registration-debug.md` (~80 lignes)
  - [ ] 10.5 — Créer `docs/runbook/kyc-docs-retention.md` (~40 lignes — RGPD)
  - [ ] 10.6 — Créer `docs/runbook/insee-sirene-integration.md` (~50 lignes — OAuth2 + rate limits + fallback)
  - [ ] 10.7 — Update `packages/contracts/README.md` : section "Identity events" ajouter pro-registered.v1
  - [ ] 10.8 — Lint + typecheck + tests : `pnpm lint && pnpm typecheck && pnpm test --filter=...[origin/main]` à la racine — tous passent
  - [ ] 10.9 — Vérifier coverage : ≥ 90 % use case identity-svc, ≥ 80 % gateway-api endpoint, ≥ 80 % frontend wizard (NFR71)
  - [ ] 10.10 — Commit `feat(identity): pro B2B registration end-to-end (wizard 3 steps frontend FR/EN + gateway-api multipart throttled endpoint + identity-svc Pretre saga compensable + INSEE SIRENE V3.11 + Cloudflare R2 chiffré + ProProfile aggregate + 2 NATS events outbox + middleware redirect pending + Playwright e2e)` — Story 1.3 done

## Dev Notes

### Pourquoi cette story est la **2ᵉ template canonique** d'Epic 1

> **Sources canoniques** : `_bmad-output/planning-artifacts/architecture.md` §External Service Pattern (ligne 226) + §Cross-Cutting Audit (lignes 260-266) + §Compliance LCEN/RGPD (NFR21-30) + §Detail libs partagées (lignes 1990+) ; `_bmad-output/planning-artifacts/prd.md` §FR3 (Pro register pending), §FR16 (anti-doublon SIRET), §FR17 (block transactional unverified) + §NFR15 (chiffrement at-rest pièces ID) + §NFR48 (UX) + §NFR71 (coverage) + §NFR79 (INSEE SIRENE) ; `_bmad-output/planning-artifacts/epics.md` §Story 1.3 (lignes 1117-1131) ; `_bmad-output/planning-artifacts/ux-design-specification.md` §UX-DR9 sign-up funnel + §`<StepIndicator>` (ligne 750) + §`<FileUpload>` (ligne 749) ; Story 1.2 (template register Customer) + Story 1.1 (Keycloak realm + claim `tukio:status='pending_admin_review'`).

Story 1.2 a posé le **template "register" simple** (Customer B2C, 1 step form, pas de validation externe). Story 1.3 étend ce template avec **3 dimensions critiques nouvelles** :

1. **Validation externe synchrone** (INSEE SIRENE) → pattern réutilisable Stripe Identity V1, INSEE API SIRENE autres flows V1+, DeepL traduction Story 3.x, etc.
2. **Saga compensable multi-étapes** (INSEE → Keycloak → R2 × 3 → DB) → pattern réutilisable Story 2.1 (Stripe Connect Express creation) qui est encore plus complexe, Story 3.4 (photo upload listing), Stories Epic 4 (booking saga distribuée multi-services).
3. **Storage chiffré at-rest avec signed URLs** (Cloudflare R2 + AES256) → pattern réutilisable Story 2.7 (audit trail KYC docs admin), Story 3.4 (photos listing), Story 4.x (file attachments booking modification V1).

**Story 1.3 = template features avec validation externe + storage + saga compensable.** Le dev qui implémente Story 1.3 doit penser "ce code servira de référence à 5+ stories suivantes plus complexes — investir dans la qualité maintenant".

### Décisions techniques majeures (à acter dans Story 1.3)

1. **ProProfile = aggregate distinct de UserProfile** (pas une extension/héritage). Justification : (a) Architecture ligne 1230 `domain/{model/{user-profile.ts, pro-profile.ts, ...` les liste explicitement comme deux aggregates, (b) séparation concerns : UserProfile = identité de base, ProProfile = données métier Pro (KYC, company, status review), (c) lifecycle distinct : un Customer peut convertir vers Pro V1 (FR13) en ajoutant un ProProfile sans perdre son UserProfile. Relation 1:1 via `pro_profiles.user_profile_id` FK unique.
2. **Multipart endpoint unique `POST /v1/auth/pro/register`** (pas 3 sous-endpoints). Justification : (a) atomicité de la saga — soit tout réussit soit tout rollback, (b) UX wizard simpler (state client-side), (c) cohérent avec Stripe Connect Express Story 2.1 qui utilisera aussi un multipart endpoint, (d) limit upload 5 MB × 3 = 15 MB, gérable en multipart memoryStorage. **Alternative rejetée** : 3 endpoints stagés (saveStep1, saveStep2, saveStep3) — nécessiterait un draft state + plus de complexité.
3. **Library AWS SDK v3 (`@aws-sdk/client-s3`)** pour Cloudflare R2 (S3-compatible). Justification : (a) latest stable, (b) tree-shakeable (vs SDK v2 monolithique), (c) typed, (d) Cloudflare R2 docs officielles montrent usage SDK v3.
4. **Server-side encryption AES256 R2 (SSE-S3)** au MVP. Justification : (a) couvre NFR15 chiffrement at-rest, (b) zéro key management (R2 gère), (c) suffisant pour KYC docs niveau "sensitive but not classified". V1+ : SSE-C (customer-provided keys) ou SSE-KMS pour conformité plus stricte si audit légal le demande.
5. **Signed URLs 5 min TTL admin-only** (NFR15 + AC1). Justification : balance entre security (TTL court) + UX admin (5 min suffit pour télécharger ou previewer un PDF). V1+ : per-admin audit log de chaque signed URL généré (Story 2.7 audit trail).
6. **INSEE SIRENE V3.11 OAuth2 client_credentials** (pas API key simple). Justification : standard INSEE post-2024 transition. Token TTL 7 jours, cached + refresh 1h before expiration.
7. **INSEE checkpoint snapshot dans event** : on stocke `inseeCheck.{denomination, naf, checkedAt}` dans `pro_profiles` ET dans le NATS event payload — permet à l'admin Story 2.4 de voir la denomination INSEE au moment du register (vs re-fetch live qui pourrait avoir changé). Re-check live possible Story 2.4 manual button "Refresh INSEE".
8. **Saga compensable multi-étapes** : ordre INSEE (read-only) → Keycloak (mutable, can rollback) → R2 (mutable, can rollback) → DB transaction (atomic). Si fail à n'importe quelle étape post-Keycloak, on rollback les étapes précédentes. **Drift accepté** : si la compensation R2 ou Keycloak fail (rare), drift reconciliation Story 1.10 daily job + alert Prom counter.
9. **Verify token réutilise table `email_verification_tokens`** Story 1.2 (pas une nouvelle table). Justification : même usage (verify email after register), même schema.
10. **2 events distincts** réutilisent pattern Story 1.2 :
    - `identity.pro.registered.v1` (business — consume Story 2.3 admin verification queue + analytics V1)
    - `notification.email.send.v1` template `pro-pending-admin-review` (technical — consume Story 5.4 notification-svc → Resend) — envoyé au Pro lui-même (pas à l'admin ; l'admin voit la queue Story 2.3 in-app)
    - **Décision MVP** : pas de second event pour notif admin in-app (Epic 11 SSE V1). Au MVP, l'admin consulte la queue Story 2.3 manuellement OU reçoit un email digest quotidien Story 2.8 V1.
11. **Frontend wizard state in `useReducer`** (pas Zustand global) — local au wizard. Justification : state éphémère, pas besoin de partage cross-component, useReducer est plus testable que `useState` × 10 pour des states complexes.
12. **Cross-zone redirect post-register** (`apps/public` → `apps/seller`) via Vercel multi-zones rewrites (Story 0.13 ADR-013). Le redirect `/seller/onboarding/pending` est servi par `apps/seller/`. Cookie session shared `Domain=.tukio.one` (Story 0.8) garantit que le user reste authentifié cross-zone.
13. **i18n strict + EN strict tech** réutilisent memories `feedback_i18n_frontend.md` + `feedback_tech_layer_english.md`.

### Versions à utiliser (latest stable)

| Lib | Rôle | Version cible | Notes |
|---|---|---|---|
| **`@aws-sdk/client-s3`** | R2 client (identity-svc) | latest stable v3 | Tree-shakeable, typed |
| **`@aws-sdk/s3-request-presigner`** | Signed URLs R2 | latest stable v3 | `getSignedUrl` |
| **`form-data`** | Multipart axios forward (gateway-api) | latest stable | Compat Node + browser |
| **`multer`** | Multipart parsing (gateway-api + identity-svc) | latest stable | Bundle dans `@nestjs/platform-fastify` ? sinon explicit |
| **`nock`** | Mock HTTP (tests INSEE) | latest stable | Déjà figé Story 0.8 |
| **`aws-sdk-client-mock`** | Mock S3 client (tests R2) | latest stable | Bibliothèque officielle AWS SDK v3 mocks |
| **`@axe-core/playwright`** | A11y RGAA | latest stable | Déjà figé |
| **`@keycloak/keycloak-admin-client`** | Keycloak Admin (Story 1.2 déjà installé) | latest stable | Réutilisé Story 1.3 |
| **`@nestjs/throttler`** | Rate limiting (Story 1.2 déjà installé) | latest stable v6 | Réutilisé Story 1.3 |
| **`@nest-lab/throttler-storage-redis`** | Redis storage (Story 1.2) | latest stable | Réutilisé Story 1.3 |

### Project Structure cible (fichiers créés/modifiés Story 1.3)

```
packages/contracts/src/
├─ dtos/identity/
│  └─ register-pro.dto.ts                           # NEW Story 1.3 — Zod schemas + ProAddress
├─ utils/
│  ├─ siret.ts                                      # NEW Story 1.3 — Luhn check shared
│  └─ siret.spec.ts                                 # NEW Story 1.3 — 5+ real SIRET tests
├─ events/identity/
│  ├─ pro-registered.v1.schema.json                 # NEW Story 1.3 — JSON Schema
│  └─ pro-registered.v1.ts                          # NEW Story 1.3 — types TS générés
├─ types/error-codes.ts                             # UPDATE Story 1.2 — ajouter codes 002/003
└─ types/email-templates.ts                         # UPDATE Story 1.2 — ajouter pro-pending-admin-review

apps/identity-svc/src/
├─ domain/
│  ├─ model/
│  │  ├─ pro-profile.aggregate.ts                   # NEW Story 1.3 + spec
│  │  └─ value-objects/
│  │     ├─ siret.value-object.ts                   # NEW Story 1.3 + spec
│  │     ├─ vat-number.value-object.ts              # NEW Story 1.3 + spec
│  │     ├─ address.value-object.ts                 # NEW Story 1.3 + spec
│  │     └─ phone-number.value-object.ts            # NEW Story 1.3 + spec
│  ├─ ports/
│  │  ├─ insee-siret-validator.port.ts              # NEW Story 1.3
│  │  ├─ media-storage.port.ts                      # NEW Story 1.3
│  │  ├─ pro-profile.repository.port.ts             # NEW Story 1.3
│  │  └─ tokens.ts                                  # UPDATE Story 0.6 — ajouter 3 Symbols
│  └─ exception/
│     ├─ identity-validation.exception.ts           # NEW Story 1.3
│     └─ external-service.exception.ts              # UPDATE Story 1.2 — codes 002/003
├─ usecases/
│  ├─ register-pro.usecase.ts                       # NEW Story 1.3 + spec
│  └─ register-pro.usecase.spec.ts                  # NEW Story 1.3 — 10+ tests
└─ infrastructure/
   ├─ external/
   │  ├─ insee/                                     # NEW Story 1.3
   │  │  ├─ insee-siret-validator.service.ts
   │  │  ├─ insee-token-cache.service.ts
   │  │  ├─ insee.module.ts
   │  │  ├─ errors.ts
   │  │  └─ insee-siret-validator.integration.spec.ts
   │  └─ r2/                                        # NEW Story 1.3
   │     ├─ r2-media-storage.service.ts
   │     ├─ r2.module.ts
   │     ├─ errors.ts
   │     └─ r2-media-storage.integration.spec.ts
   ├─ persistence/typeorm/
   │  ├─ entities/pro-profile.entity.ts             # NEW Story 1.3
   │  ├─ repositories/pro-profile.typeorm.repository.ts # NEW Story 1.3
   │  ├─ mappers/pro-profile.mapper.ts              # NEW Story 1.3
   │  ├─ migrations/1715240000000-CreateProProfilesTable.ts # NEW Story 1.3
   │  └─ data-source.ts                             # UPDATE — ajouter ProProfileEntity
   ├─ http/
   │  ├─ controllers/pro.controller.ts              # NEW Story 1.3
   │  ├─ dtos/register-pro-input.dto.ts             # NEW Story 1.3
   │  └─ utils/sort-files-by-fieldname.ts           # NEW Story 1.3 (réutilisé gateway-api)
   ├─ usecases-proxy/usecases-proxy.module.ts       # UPDATE — ajouter REGISTER_PRO_USECASES_PROXY
   └─ config/environment-config.service.ts          # UPDATE Story 0.6 — getInseeConfig + getR2Config

apps/identity-svc/test/
└─ pro-register.e2e-spec.ts                          # NEW Story 1.3

apps/identity-svc/.env.example                       # UPDATE — INSEE + R2 env vars

apps/gateway-api/src/
├─ domain/ports/identity-svc.port.ts                 # UPDATE Story 1.2 — ajouter registerPro
├─ usecases/register-pro.forwarder.ts                # NEW Story 1.3
├─ infrastructure/
│  ├─ external/identity-svc/identity-svc.client.ts   # UPDATE — ajouter registerPro multipart
│  └─ http/
│     ├─ controllers/auth-pro.controller.ts          # NEW Story 1.3
│     └─ utils/{multer.config.ts,sort-files-by-fieldname.ts} # NEW Story 1.3
└─ test/auth-pro-register.e2e-spec.ts                # NEW Story 1.3

apps/public/src/
├─ app/[locale]/auth/sign-up/page.tsx                # UPDATE Story 1.2 — detect ?role=pro
├─ features/auth/sign-up-pro/                        # NEW Story 1.3
│  ├─ components/{ProSignUpWizard,StepAccount,StepCompany,StepDocuments}.tsx
│  ├─ services/sign-up-pro.service.ts
│  └─ index.ts
├─ messages/{fr,en}.json                             # UPDATE — namespace auth.signupPro.*
└─ e2e/auth/pro-register.spec.ts                     # NEW Story 1.3
   + e2e/fixtures/{idCard.jpg,rib.pdf,kbis.pdf,idCard-too-large.jpg} # NEW Story 1.3

apps/seller/src/
├─ middleware.ts                                     # UPDATE Story 0.8 — pending redirect
├─ app/[locale]/seller/onboarding/pending/page.tsx   # NEW Story 1.3 (placeholder)
├─ messages/{fr,en}.json                             # UPDATE — namespace seller.onboarding.pending.*
└─ e2e/middleware/pending-redirect.spec.ts           # NEW Story 1.3

packages/api-client/src/hooks/identity/
└─ use-register-pro.ts                               # NEW Story 1.3

infra/k8s/grafana-dashboards/
└─ pro-registration.json                             # NEW Story 1.3 — 5 panels

docs/runbook/
├─ pro-registration-debug.md                         # NEW Story 1.3
├─ kyc-docs-retention.md                             # NEW Story 1.3 (RGPD)
└─ insee-sirene-integration.md                       # NEW Story 1.3 (OAuth2 + rate)

# Estimation total fichiers : ~70 nouveaux + ~15 updates = ~85 fichiers touchés
```

### Pattern code — `RegisterProUseCase` saga compensable (squelette annotated)

```ts
// apps/identity-svc/src/usecases/register-pro.usecase.ts (squelette)
@Injectable()
export class RegisterProUseCase {
  // ... DI 7 ports

  async execute(input: RegisterProInput & { acquisition; files }): Promise<RegisterProResponse> {
    // ─── Phase 1: Validations DB (no side-effects) ─────────────────────
    const [existingByEmail, existingBySiret] = await Promise.all([
      this.userProfileRepo.findByEmail(input.email),
      this.proProfileRepo.findBySiret(input.siret),
    ]);
    if (existingByEmail) throw new IdentityConflictException('IDENTITY-CONFLICT-001');
    if (existingBySiret) throw new IdentityConflictException('IDENTITY-CONFLICT-002');

    // ─── Phase 2: INSEE check (read-only external) ────────────────────
    const inseeCheck = await this.inseeSiret.validate(input.siret); // throws IDENTITY-EXTERNAL-002 if down
    if (!inseeCheck.active) throw new IdentityValidationException('IDENTITY-VALIDATION-002');

    // ─── Phase 3: Keycloak user create (mutable, rollback-able) ───────
    let keycloakUserId: string;
    try {
      ({ keycloakUserId } = await this.keycloakAdmin.createUser({ ...input, role: 'pro', status: 'pending_admin_review', emailVerified: false }));
    } catch (e) {
      if (e instanceof KeycloakUserAlreadyExistsError) throw new IdentityConflictException('IDENTITY-CONFLICT-001');
      throw new ExternalServiceException('IDENTITY-EXTERNAL-001');
    }

    // ─── Phase 4: R2 uploads (mutable, rollback-able) ─────────────────
    const proProfileId = randomUUID();
    const uploadedKeys: string[] = [];
    let kycIdCardKey, kycRibKey, kycKbisKey: string | null = null;
    try {
      kycIdCardKey = `kyc/${proProfileId}/id-card/${Date.now()}-${randomUUID()}.${getExt(input.files.idCard.mimetype)}`;
      await this.mediaStorage.uploadEncrypted({ ...input.files.idCard, key: kycIdCardKey });
      uploadedKeys.push(kycIdCardKey);
      // ... same for rib + kbisOrInsee
    } catch (e) {
      // Compensation: delete uploaded files + delete Keycloak user
      await Promise.all(uploadedKeys.map(k => this.mediaStorage.delete({ bucket, key: k }).catch(noop)));
      await this.keycloakAdmin.deleteUser(keycloakUserId).catch(noop);
      throw new ExternalServiceException('IDENTITY-EXTERNAL-003');
    }

    // ─── Phase 5: Atomic DB transaction (UserProfile + ProProfile + 2 events) ─────
    try {
      const userProfile = UserProfile.register({ keycloakUserId, ...input, role: 'pro', status: 'pending_admin_review' });
      const proProfile = ProProfile.register({ userProfileId: userProfile.id, ...input, kycDocs: { idCardKey: kycIdCardKey, ribKey: kycRibKey, kbisOrInseeKey: kycKbisKey }, inseeCheck });
      await this.userProfileRepo.runInTransaction(async (txn) => {
        await txn.userProfileRepo.save(userProfile);
        await txn.proProfileRepo.save(proProfile);
        await txn.tokenRepo.save({ token: verifyToken, userId: userProfile.id, expiresAt });
        await txn.eventPublisher.publish({ eventType: 'identity.pro.registered', /* ... */ });
        await txn.eventPublisher.publish({ eventType: 'notification.email.send', /* ... */ });
      });
      return { userId: userProfile.id, proProfileId: proProfile.id, requiresAdminReview: true, requiresEmailVerification: true };
    } catch (e) {
      // Full saga compensation
      await Promise.all(uploadedKeys.map(k => this.mediaStorage.delete({ bucket, key: k }).catch(noop)));
      await this.keycloakAdmin.deleteUser(keycloakUserId).catch(noop);
      throw e;
    }
  }
}
```

### Pattern code — `<ProSignUpWizard>` (squelette annotated)

```tsx
// apps/public/src/features/auth/sign-up-pro/components/ProSignUpWizard.tsx
'use client';
import { useReducer } from 'react';
import { StepIndicator, Button } from '@tukio/ui';
import { useTranslations, useLocale } from 'next-intl';
import { useRegisterPro } from '@tukio/api-client/hooks/identity';
import { useAcquisitionTracking } from '@tukio/api-client/hooks';
import { StepAccount, StepCompany, StepDocuments } from './';

type WizardState = {
  currentStep: 0 | 1 | 2;
  account: Partial<StepAccountValues>;
  company: Partial<StepCompanyValues>;
  documents: Partial<StepDocumentsValues>;
};

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'NEXT_STEP': return { ...state, currentStep: Math.min(state.currentStep + 1, 2) as any };
    case 'PREV_STEP': return { ...state, currentStep: Math.max(state.currentStep - 1, 0) as any };
    case 'UPDATE_ACCOUNT': return { ...state, account: { ...state.account, ...action.payload } };
    case 'UPDATE_COMPANY': return { ...state, company: { ...state.company, ...action.payload } };
    case 'UPDATE_DOCUMENTS': return { ...state, documents: { ...state.documents, ...action.payload } };
    default: return state;
  }
}

export function ProSignUpWizard() {
  const t = useTranslations('auth.signupPro');
  const locale = useLocale() as 'fr' | 'en';
  const acquisition = useAcquisitionTracking();
  const [state, dispatch] = useReducer(wizardReducer, { currentStep: 0, account: { locale }, company: {}, documents: {} });
  const registerMutation = useRegisterPro({
    onSuccess: () => { window.location.assign(`https://seller.tukio.one/${locale}/seller/onboarding/pending`); },
    onError: (err) => { /* map error → state, set inline messages step-aware */ },
  });

  const onSubmitFinal = () => {
    const formData = new FormData();
    formData.append('payload', JSON.stringify({ ...state.account, ...state.company, acquisition }));
    formData.append('files', state.documents.idCard!, 'idCard');
    formData.append('files', state.documents.rib!, 'rib');
    if (state.documents.kbisOrInsee) formData.append('files', state.documents.kbisOrInsee, 'kbisOrInsee');
    registerMutation.mutate(formData);
  };

  return (
    <div>
      <StepIndicator steps={[t('steps.account'), t('steps.company'), t('steps.documents')]} currentStep={state.currentStep} />
      {state.currentStep === 0 && <StepAccount values={state.account} onValid={(v) => { dispatch({ type: 'UPDATE_ACCOUNT', payload: v }); dispatch({ type: 'NEXT_STEP' }); }} />}
      {state.currentStep === 1 && <StepCompany values={state.company} onValid={(v) => { dispatch({ type: 'UPDATE_COMPANY', payload: v }); dispatch({ type: 'NEXT_STEP' }); }} onBack={() => dispatch({ type: 'PREV_STEP' })} />}
      {state.currentStep === 2 && <StepDocuments values={state.documents} onChange={(v) => dispatch({ type: 'UPDATE_DOCUMENTS', payload: v })} onSubmit={onSubmitFinal} onBack={() => dispatch({ type: 'PREV_STEP' })} loading={registerMutation.isPending} />}
    </div>
  );
}
```

### Critical Architecture Constraints (rappel non-négociable)

> Cf. Architecture lignes 226 (External Service Pattern) + 234-241 (Auth) + 260-266 (Audit/RGPD) + 1252-1505 (envelope ADR-014) ; Story 1.1 + 1.2 + 0.6 + 0.7 + 0.13 ; memories `feedback_clean_architecture_explicit.md`, `feedback_api_envelope_response.md`, `feedback_tech_layer_english.md`, `feedback_i18n_frontend.md`, `feedback_latest_versions.md`.

1. **Pattern Pretre strict** : `domain/` zéro deps externes (`eslint-plugin-boundaries` enforce — Story 0.6). Use cases dépendent uniquement des ports.
2. **External Service Pattern** (Architecture ligne 226) : INSEE + R2 sont des `domain/ports/` (interfaces) + `infrastructure/external/` (impls). Switch fournisseur (R2 → S3/MinIO/B2) = 1 classe à réécrire.
3. **Symbol DI tokens SCREAMING_SNAKE_CASE** : `PRO_PROFILE_REPOSITORY`, `INSEE_SIRET_VALIDATOR`, `MEDIA_STORAGE`.
4. **Envelope ADR-014** : controllers retournent DTO nu, EnvelopeExceptionFilter wrap (Story 0.6).
5. **Outbox transactional atomicity** (Story 0.7) : 2 events publiés dans la même transaction TypeORM que UserProfile + ProProfile save.
6. **Anti-énumération** (NFR9) : message API distinct (`tukioCode`) vs message UI générique (frontend mappe).
7. **Saga compensable explicite** : chaque mutation externe (Keycloak, R2) est rollback-able. Drift R8 mitigated via Story 1.10 reconciliation.
8. **Chiffrement at-rest R2 SSE-S3 AES256** (NFR15).
9. **Signed URLs 5 min admin-only** (NFR15 + AC1).
10. **Anti-doublon SIRET strict MVP** (FR16) : index unique partiel `WHERE deleted_at IS NULL`.
11. **i18n strict** + EN strict tech (memories).
12. **Rate-limit Redis-backed** : 3/min/IP register pro (plus strict que 5/min Customer car coût backend INSEE+R2).
13. **HTTPS/TLS exclusif** : password en clair via TLS only, jamais loggé.

### Previous Story Intelligence

**Story 0.2** (`@tukio/contracts`) : DTOs DRY frontend ↔ backend. Story 1.3 réutilise `RegisterCustomerInputSchema` partiellement (champs Step 1 Pro) + ajoute `RegisterProInputSchema`. Build pipeline JSON Schema → TS réutilisé.

**Story 0.4 + 0.5** (atomics + patterns UI) : `<FormField>`, `<Input>`, `<Button>`, `<Checkbox>`, `<Spinner>`, `<EmptyState>`, `<StepIndicator>`, `<FileUpload>` — tous consommés Story 1.3.

**Story 0.6** (Pretre identity-svc) : aggregate UserProfile (Story 1.2 a étendu avec factory `register()`), envelope ADR-014, UseCasesProxyModule, DomainException base, EnvironmentConfigService Zod-validated, eslint-plugin-boundaries strict. Story 1.3 ajoute aggregate ProProfile + 4 VOs + 3 ports + 1 use case + 5 fichiers infra + 1 controller.

**Story 0.7** (`@tukio/messaging` outbox) : `runInTransaction` partage QueryRunner (réutilisé Story 1.2 + 1.3). 2 events publiés par Story 1.3 (`identity.pro.registered.v1` + `notification.email.send.v1`).

**Story 0.8** (`@tukio/auth` + auth-client) : `KeycloakJwtGuard` global avec `@Public()` (endpoint Story 1.3 est public). `<AuthProvider>` + middleware Next.js (apps/seller middleware Story 1.3 update pour pending redirect).

**Story 0.9** (`@tukio/testing`) : testcontainers Postgres + Keycloak. Story 1.3 utilise + ajoute helper testcontainer MinIO (R2 mock) Task 9.4.

**Story 0.13** (acquisition schema) : `acquisition_*` columns sur `user_profiles` (Story 1.2 utilise, Story 1.3 réutilise via `UserProfile.register()` factory). Cookie `tk_acq` first-touch (Story 1.2 finalisé wiring frontend).

**Story 1.1** (Keycloak realm) : realm `tukio` + 5 rôles + 4 clients + claim `tukio:status`. Story 1.3 utilise `tukio-api` confidential client (KeycloakAdminService Story 1.2 réutilisé) + role `pro` assigné + claim `tukio:status='pending_admin_review'` set via attributes.

**Story 1.2** (Customer register) : 🔴 **TEMPLATE PRINCIPAL** réutilisé Story 1.3 :
- DTO pattern Zod + types `@tukio/contracts/dtos/identity` (Story 1.2 `register-customer.dto.ts` → Story 1.3 `register-pro.dto.ts` + extends)
- Factory aggregate `UserProfile.register()` Story 1.2 réutilisé Story 1.3 avec `role: 'pro'` + `status: 'pending_admin_review'`
- `KeycloakAdminService` Story 1.2 réutilisé tel quel
- `EmailVerificationTokenRepository` Story 1.2 réutilisé tel quel (même token table)
- `EnvironmentConfigService.getInternalServiceSecret()` + `getKeycloakAdminConfig()` Story 1.2 réutilisés
- Forwarder pattern gateway-api Story 1.2 (`RegisterCustomerForwarder` → Story 1.3 `RegisterProForwarder`)
- Throttler config Story 1.2 (5/min Customer → Story 1.3 ajout 3/min Pro)
- `useAcquisitionTracking` hook Story 1.2 réutilisé tel quel
- `merge-acquisition` util Story 1.2 réutilisé tel quel
- Anti-énumération Story 1.2 pattern réutilisé pour `IDENTITY-CONFLICT-002` SIRET
- 2 events outbox pattern Story 1.2 réutilisé (avec event types et payloads différents)
- Envelope ADR-014 wrap automatique Story 0.6 réutilisé tel quel
- Tests E2E pattern Playwright Story 1.2 + axe-core réutilisé pour wizard
- Compensation Keycloak rollback Story 1.2 étendu Story 1.3 (R2 ajouté à la chain)

### Latest Tech Information

- **Cloudflare R2 SSE-S3** : R2 supports server-side encryption AES256 via `ServerSideEncryption: 'AES256'` header (S3-compatible). Documentation : https://developers.cloudflare.com/r2/api/s3/api/. Pricing free tier 10 GB storage + 1M reads/month + 10M writes/month — sufficient MVP.
- **INSEE SIRENE V3.11** : OAuth2 client_credentials grant, endpoint `https://api.insee.fr/entreprises/sirene/V3.11/siret/{siret}`. Auth : `POST https://api.insee.fr/token` avec Basic auth `<key>:<secret>` → bearer token. Rate limit free tier : 30 req/sec, 10k req/jour. Documentation : https://api.gouv.fr/documentation/sirene_v3.
- **Keycloak Admin API users.create** : POST `/admin/realms/tukio/users` avec `{ enabled: true, emailVerified: false, attributes: { locale: ['fr'], status: ['pending_admin_review'] }, credentials: [{ type: 'password', value: '...', temporary: false }] }`. Response Location header → user UUID. Then `PUT /admin/realms/tukio/users/{id}/role-mappings/realm` avec `[{ name: 'pro', ... }]` pour assigner le rôle.
- **multer + @nestjs/platform-fastify** : multer est compatible Fastify via `@fastify/multipart` adapter, OU NestJS provides `FilesInterceptor` natif. Vérifier au moment du dev (`pnpm view @nestjs/platform-fastify peerDependencies`). Si problèmes Fastify, fallback Express adapter pour endpoints multipart uniquement.

### What this story does NOT do (out of scope)

- ❌ **Stripe Connect Express account creation** → Story 2.1 (Pro Onboarding Epic 2)
- ❌ **Pro onboarding wizard 4 steps complet (Profil + Stripe + KYC + 1ère fiche)** → Story 2.2
- ❌ **Admin verification queue UI** → Story 2.3
- ❌ **Admin KYC review detail screen + signed URL preview** → Story 2.4 (Story 1.3 fournit `mediaStorage.getSignedDownloadUrl` méthode utilisable)
- ❌ **Pro acceptation/rejet workflow + transitions de statut** → Story 2.5
- ❌ **1ère fiche service intégrée wizard onboarding** → Story 2.6
- ❌ **Audit trail actions admin** → Story 2.7
- ❌ **Pro verification reminder + auto-rejection après 30 jours** → Story 2.8
- ❌ **Login flow Keycloak** → Story 1.4 (Story 1.3 ne touche pas le login)
- ❌ **Password reset flow** → Story 1.5
- ❌ **Email verification landing page + endpoint** → Story 1.6
- ❌ **Profile update GET/PATCH /v1/me Pro** → Story 1.8 (étendu pour ProProfile fields)
- ❌ **Pro account deletion soft-delete RGPD avec cascade ProProfile** → Story 1.9
- ❌ **identity-svc Pretre consolidation** → Story 1.10
- ❌ **notification-svc Resend send mail** → Story 5.4 (Story 1.3 publie `notification.email.send.v1`, consume Story 5.4)
- ❌ **B2B Customer Account avec SIRET** → V1 FR2 Epic 8 (réutilisera SIRET validation + Luhn + INSEE infrastructure Story 1.3)
- ❌ **Conversion compte client → Pro** → V1 FR13 (réutilisera factory ProProfile.register()` mais skip `UserProfile.register` car déjà existant)
- ❌ **Stripe Identity KYC complet** → V1 FR12 (remplace MVP KYC manual upload par Stripe Identity)
- ❌ **Cron job purge KYC docs 90 jours rejected** → Story 2.8 ou 1.10 (Story 1.3 documente le contrat dans Dev Notes)
- ❌ **Audit log Pro register** → Story 2.7 (Story 1.3 publie l'event `identity.pro.registered.v1` que Story 2.7 audit consume)
- ❌ **Multi-tenant Pro Enterprise SAML SSO** → V2 Epic 15

### Files to UPDATE vs CREATE

> **À UPDATE** :
> - `packages/contracts/src/types/error-codes.ts` (Story 1.2) — ajouter codes 002/003 INSEE/R2
> - `packages/contracts/src/types/email-templates.ts` (Story 1.2) — ajouter pro-pending-admin-review
> - `packages/contracts/src/index.ts` — barrel + subpath
> - `packages/contracts/README.md` — section Identity events
> - `packages/api-client/src/hooks/index.ts` — barrel use-register-pro
> - `apps/identity-svc/src/domain/ports/tokens.ts` — ajouter 3 Symbol tokens
> - `apps/identity-svc/src/domain/exception/external-service.exception.ts` (Story 1.2) — codes 002/003
> - `apps/identity-svc/src/infrastructure/persistence/typeorm/data-source.ts` — ajouter ProProfileEntity
> - `apps/identity-svc/src/infrastructure/usecases-proxy/usecases-proxy.module.ts` — REGISTER_PRO_USECASES_PROXY
> - `apps/identity-svc/src/infrastructure/http/http.module.ts` — ajouter ProController
> - `apps/identity-svc/src/infrastructure/config/environment-config.service.ts` — getInseeConfig + getR2Config + getR2KycBucket
> - `apps/identity-svc/.env.example` — INSEE + R2 env vars
> - `apps/gateway-api/src/domain/ports/identity-svc.port.ts` (Story 1.2) — ajouter registerPro
> - `apps/gateway-api/src/infrastructure/external/identity-svc/identity-svc.client.ts` (Story 1.2) — ajouter registerPro multipart
> - `apps/gateway-api/src/app.module.ts` — throttler config sensitive pro-register 3/min
> - `apps/gateway-api/.env.example` — throttler env vars
> - `apps/public/src/app/[locale]/auth/sign-up/page.tsx` (Story 1.2) — detect ?role=pro switch
> - `apps/public/messages/{fr,en}.json` — namespace auth.signupPro.*
> - `apps/seller/src/middleware.ts` (Story 0.8) — pending redirect logic
> - `apps/seller/messages/{fr,en}.json` — namespace seller.onboarding.pending.*

> **À CREATE** :
> - `packages/contracts/src/dtos/identity/register-pro.dto.ts` (1)
> - `packages/contracts/src/utils/{siret.ts,siret.spec.ts}` (2)
> - `packages/contracts/src/events/identity/pro-registered.v1.{schema.json,ts}` (2)
> - `apps/identity-svc/src/domain/model/pro-profile.aggregate.ts` + spec (2)
> - `apps/identity-svc/src/domain/model/value-objects/{siret,vat-number,address,phone-number}.value-object.ts` + 4 spec (8)
> - `apps/identity-svc/src/domain/ports/{insee-siret-validator,media-storage,pro-profile.repository}.port.ts` (3)
> - `apps/identity-svc/src/domain/exception/identity-validation.exception.ts` (1)
> - `apps/identity-svc/src/usecases/register-pro.usecase.{ts,spec.ts}` (2)
> - `apps/identity-svc/src/infrastructure/external/insee/{insee-siret-validator.service.ts,insee-token-cache.service.ts,insee.module.ts,errors.ts,insee-siret-validator.integration.spec.ts}` (5)
> - `apps/identity-svc/src/infrastructure/external/r2/{r2-media-storage.service.ts,r2.module.ts,errors.ts,r2-media-storage.integration.spec.ts}` (4)
> - `apps/identity-svc/src/infrastructure/persistence/typeorm/{entities/pro-profile.entity.ts,repositories/pro-profile.typeorm.repository.ts,mappers/pro-profile.mapper.ts,migrations/1715240000000-CreateProProfilesTable.ts}` (4)
> - `apps/identity-svc/src/infrastructure/http/{controllers/pro.controller.ts,dtos/register-pro-input.dto.ts,utils/sort-files-by-fieldname.ts}` (3)
> - `apps/identity-svc/test/pro-register.e2e-spec.ts` (1)
> - `apps/gateway-api/src/usecases/register-pro.forwarder.ts` (1)
> - `apps/gateway-api/src/infrastructure/http/{controllers/auth-pro.controller.ts,utils/multer.config.ts,utils/sort-files-by-fieldname.ts}` (3)
> - `apps/gateway-api/test/auth-pro-register.e2e-spec.ts` (1)
> - `apps/public/src/features/auth/sign-up-pro/{components/{ProSignUpWizard,StepAccount,StepCompany,StepDocuments}.tsx,services/sign-up-pro.service.ts,index.ts}` (6)
> - `apps/public/e2e/auth/pro-register.spec.ts` + 4 fixtures (5)
> - `apps/seller/src/app/[locale]/seller/onboarding/pending/page.tsx` (1)
> - `apps/seller/e2e/middleware/pending-redirect.spec.ts` (1)
> - `packages/api-client/src/hooks/identity/use-register-pro.ts` (1)
> - `infra/k8s/grafana-dashboards/pro-registration.json` (1)
> - `docs/runbook/{pro-registration-debug,kyc-docs-retention,insee-sirene-integration}.md` (3)
> - **Estimation total fichiers** : ~70 nouveaux + ~20 updates = ~90 fichiers touchés.

### Testing Standards

- **Coverage cibles** (NFR71) :
  - identity-svc `usecases/register-pro.usecase`: ≥ 90 %
  - identity-svc `infrastructure/external/insee`: ≥ 80 % (integration tests nock)
  - identity-svc `infrastructure/external/r2`: ≥ 70 % (integration tests aws-sdk-client-mock OU MinIO testcontainer)
  - identity-svc `infrastructure/persistence/pro-profile.typeorm.repository`: ≥ 80 %
  - gateway-api endpoint: ≥ 80 %
  - frontend ProSignUpWizard + step components: ≥ 80 %
- **Tests unit** Vitest mocks ports (cf. AC4 — 10+ cases register-pro use case avec saga compensation)
- **Tests integration** testcontainers (Postgres + Keycloak + MinIO si disponible)
- **Tests E2E** Playwright wizard 3 steps FR + EN + axe-core (cf. AC9 — 11 cases)
- **Performance** : NFR48 ≤ 5 min p90 desktop wizard complet, mesuré CI E2E
- **Tests SIRET Luhn** : `siret.spec.ts` avec 10+ SIRETs réels validés (organisations connues : tukio.one futur, organisations test INSEE) + 5+ SIRETs invalides (Luhn fail, format fail, all zeros)
- **Tests INSEE mock** : nock interceptions pour active=true / active=false / 404 / 429 retry / 5xx fail
- **Tests R2 mock** : aws-sdk-client-mock pour PutObjectCommand / DeleteObjectCommand / GetObjectCommand signed URL

### Project Structure Notes

✅ **Aligné** avec Architecture lignes 226 (External Service Pattern), 234-241 (Auth), 1230 (ProProfile aggregate listed dans `domain/model/`).

✅ **Aligné** avec PRD §FR3, FR16, FR17 + §NFR9-15 + NFR48 + NFR71 + NFR79 (INSEE).

✅ **Aligné** avec UX-DR9 sign-up funnel + `<StepIndicator>` + `<FileUpload>` patterns Story 0.5.

✅ **Aligné** avec memory `feedback_clean_architecture_explicit.md` (Pretre canonique).

✅ **Aligné** avec memory `feedback_api_envelope_response.md` (envelope wrap automatique).

✅ **Aligné** avec memory `feedback_tech_layer_english.md` (TS/DB/API/events EN strict).

✅ **Aligné** avec memory `feedback_i18n_frontend.md` (FR/EN dès maintenant, zéro hardcoded UI).

✅ **Aligné** avec memory `feedback_latest_versions.md` (latest stable AWS SDK v3, Keycloak admin client, etc.).

⚠️ **Décision documentée** : ProProfile = aggregate distinct (cf. Décisions techniques §1).

⚠️ **Décision documentée** : multipart endpoint unique (cf. Décisions techniques §2).

⚠️ **Décision documentée** : SSE-S3 AES256 R2 (cf. Décisions techniques §4).

⚠️ **Décision documentée** : compensation saga 4 phases (validations → INSEE → Keycloak → R2 → DB) (cf. Décisions techniques §8).

⚠️ **Décision documentée** : `wizard state in useReducer` local (pas Zustand global) (cf. Décisions techniques §11).

⚠️ **À noter** : la **page `/seller/onboarding/pending`** Story 1.3 est un **placeholder simple** (Task 8.2). La page complète avec track avancement temps réel + CTA contacter support arrive Story 2.x.

⚠️ **À noter** : le **cron job purge KYC docs 90 jours rejected** est documenté dans `docs/runbook/kyc-docs-retention.md` Story 1.3 mais implémenté Story 1.10 ou Story 2.8 (auto-rejection). Story 1.3 garantit que la DB schema + R2 keys permettent l'implémentation future.

⚠️ **À noter** : la **réutilisation du ProProfile factory pattern** par Story V1 FR13 (Customer → Pro conversion) est planifiée — Story 1.3 doit garder `ProProfile.register()` factory **idempotent** sur `userProfileId` (1 seul ProProfile par UserProfile, FK unique). FR13 V1 ajoutera juste `ProProfile.create({ existingUserProfileId })` qui skip Step 1 mais réutilise Step 2-3.

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#External-Service-Pattern — Line 226 (interface dans domain/ports/, impl dans infrastructure/external/)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Cross-Cutting-Auth — Lines 234-241]
- [Source: _bmad-output/planning-artifacts/architecture.md#Audit-Trail-Compliance — Lines 260-266 (RGPD + soft-delete + chiffrement)]
- [Source: _bmad-output/planning-artifacts/architecture.md#API-Response-Format-Enveloppe — Lines 1252-1505]
- [Source: _bmad-output/planning-artifacts/architecture.md#Project-Structure — Lines 1230 (pro-profile.ts listed)]
- [Source: _bmad-output/planning-artifacts/architecture.md#API-Security — Lines 699-708 (rate limiting sensitive)]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic-1-Story-1.3 — Lines 1117-1131]
- [Source: _bmad-output/planning-artifacts/prd.md#FR3 — Pro registration with KYC docs + pending_admin_review]
- [Source: _bmad-output/planning-artifacts/prd.md#FR16 — Anti-doublon SIRET]
- [Source: _bmad-output/planning-artifacts/prd.md#FR17 — Block transactional unverified Pro pending]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR15 — Chiffrement at-rest pièces ID]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR48 — UX < 30s sign-up (étendu wizard 5min p90)]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR71 — Coverage]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR79 — INSEE SIRENE]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#UX-DR9 — sign-up funnel]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#StepIndicator — Line 750]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#FileUpload — Line 749]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Pro-onboarding-flow — Lines 405-413 (J3 Marc onboarding 4 steps)]
- [Source: _bmad-output/implementation-artifacts/0-2-initialize-tukio-contracts-envelope-nats-events-dtos.md — Story 0.2 (envelope + DomainEvent + JSON Schema build)]
- [Source: _bmad-output/implementation-artifacts/0-4-implement-atomic-components-tukio-ui.md — Story 0.4 (FormField + Input + Button + Checkbox)]
- [Source: _bmad-output/implementation-artifacts/0-5-implement-composite-patterns-tukio-ui.md — Story 0.5 (StepIndicator + FileUpload)]
- [Source: _bmad-output/implementation-artifacts/0-6-pattern-pretre-scaffolding-template-identity-svc.md — Story 0.6 (Pretre + envelope ADR-014 + UseCasesProxyModule + DomainException)]
- [Source: _bmad-output/implementation-artifacts/0-7-setup-tukio-messaging-nats-jetstream.md — Story 0.7 (OutboxPublisher + correlationContext)]
- [Source: _bmad-output/implementation-artifacts/0-8-setup-tukio-auth-backend-frontend.md — Story 0.8 (`@tukio/auth-client` middleware Next.js)]
- [Source: _bmad-output/implementation-artifacts/0-9-setup-tukio-api-client-i18n-client-testing.md — Story 0.9 (testcontainers + e2e helpers)]
- [Source: _bmad-output/implementation-artifacts/0-13-initialize-adrs-vercel-multi-zones-acquisition-schema.md — Story 0.13 (acquisition_* schema + ADRs)]
- [Source: _bmad-output/implementation-artifacts/1-1-provision-keycloak-realm-tukio-roles-clients-phasetwo.md — Story 1.1 (realm tukio + claims tukio:status + tukio-api confidential client)]
- [Source: _bmad-output/implementation-artifacts/1-2-customer-b2c-registration.md — Story 1.2 (TEMPLATE PRINCIPAL — register pattern + KeycloakAdminService + EnvelopeException + outbox events)]
- [External: https://api.gouv.fr/documentation/sirene_v3 — INSEE SIRENE V3.11 docs]
- [External: https://developers.cloudflare.com/r2/api/s3/api/ — Cloudflare R2 S3-compatible API]
- [External: https://www.keycloak.org/docs/26.0/server_admin/#assembly-managing-users — Keycloak Admin Users]
- [External: https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/ — AWS SDK v3 S3 client]
- [External: https://github.com/m-radzikowski/aws-sdk-client-mock — aws-sdk-client-mock]
- [External: https://fr.wikipedia.org/wiki/Formule_de_Luhn — Luhn algorithm]
- [Memory: feedback_clean_architecture_explicit.md]
- [Memory: feedback_api_envelope_response.md]
- [Memory: feedback_tech_layer_english.md]
- [Memory: feedback_i18n_frontend.md]
- [Memory: feedback_latest_versions.md]
- [Memory: feedback_comprehensive_briefs.md]
- [Memory: feedback_trust_docs.md]

## Dev Agent Record

### Agent Model Used

(à remplir par le dev agent au démarrage)

### Debug Log References

(à remplir au cours de l'implémentation — vérification version Cloudflare R2 SDK compat AWS SDK v3 latest, validation INSEE OAuth2 token expiry comportement (cache 7 jours + refresh 1h before), validation Luhn algorithm contre 10+ SIRETs réels via https://avis-situation-sirene.insee.fr/, choix MinIO testcontainer vs aws-sdk-client-mock pour R2 integration tests Story 1.3 (décision recommandée : aws-sdk-client-mock pour CI rapide + MinIO optionnel pour tests manuels), validation `multer` compat `@nestjs/platform-fastify` ou fallback Express adapter, validation transaction TypeORM `runInTransaction` partage QueryRunner correctement avec OutboxPublisher Story 0.7 + ProProfileRepo (3 entités save dans même txn), validation cross-zone redirect Vercel rewrites Story 0.13 fonctionne pour `/auth/sign-up?role=pro` → `/seller/onboarding/pending`, drift R8 si compensation R2 + Keycloak fail simultanément — alerte Prom counter `tukio_pro_orphan_uploads_total` + `tukio_keycloak_orphan_users_total` Story 1.10)

### Completion Notes List

(à remplir à la fin — résumé décisions, déviations vs Dev Notes avec justification, points d'attention pour Story 1.4 (Login PKCE — utilise users created Story 1.2 + 1.3), Story 1.6 (Email verify — consume verify token créé Story 1.2 + 1.3), Story 1.10 (consolidation + reconciliation jobs R8 drift), Story 2.1 (Stripe Connect Express — réutilise compensation saga pattern Story 1.3 + ProProfile.update avec stripeAccountId field future migration), Story 2.3 (Admin verification queue — consume `identity.pro.registered.v1` event), Story 2.4 (Admin KYC review — utilise `mediaStorage.getSignedDownloadUrl` Story 1.3), Story 2.5 (acceptation/rejet — update `pro_profiles.kyc_status`), Story 2.7 (audit trail — log Story 1.3 register dans audit_log), Story 5.4 (notification-svc Resend templates `pro-pending-admin-review`)

### File List

(à remplir à la fin — liste exhaustive des fichiers créés/modifiés/supprimés)

---

## Story Completion Status

- **Story Status** : `ready-for-dev`
- **Created** : 2026-05-09
- **Created by** : `bmad-create-story` workflow
- **Epic** : Epic 1 — Identity & Authentication Backbone (MVP)
- **Sprint cible** : Sprint 1-2 (semaines 4-6 du planning MVP, 3ᵉ story Epic 1)
- **Estimation effort** : 6-9 jours (1 dev fullstack senior — story plus complexe que 1.2 à cause INSEE + R2 + saga compensable + wizard 3 steps frontend + ~90 fichiers touchés)
- **Dépendances upstream** :
  - **Story 0.2** (`ready-for-dev`) — `@tukio/contracts` envelope + DomainEvent + JSON Schema build pipeline
  - **Story 0.4 + 0.5** (`ready-for-dev`) — atomics + patterns UI (`<StepIndicator>`, `<FileUpload>`)
  - **Story 0.6** (`ready-for-dev`) — Pretre identity-svc + envelope ADR-014
  - **Story 0.7** (`ready-for-dev`) — `@tukio/messaging` outbox
  - **Story 0.8** (`ready-for-dev`) — `@tukio/auth` + `@tukio/auth-client` middleware
  - **Story 0.9** (`ready-for-dev`) — `@tukio/testing` testcontainers (incl. MinIO si Task 9.4)
  - **Story 0.10** (`ready-for-dev`) — Docker Compose + MailHog (notifications dev)
  - **Story 0.13** (`ready-for-dev`) — acquisition_* schema + ADRs
  - **Story 1.1** (`ready-for-dev`) — Keycloak realm + role `pro` + claim `tukio:status='pending_admin_review'` + `tukio-api` confidential client
  - **Story 1.2** (`ready-for-dev`) — 🔴 **TEMPLATE PRINCIPAL** : register customer pattern + KeycloakAdminService + email verification token table + UserProfile factory + acquisition tracking + envelope errors + frontend form pattern
- **Dépendances downstream** :
  - **Story 1.4** (Login PKCE) — utilise users created Story 1.2 + 1.3 (Customer + Pro avec rôles distincts JWT)
  - **Story 1.6** (Email verify endpoint) — consume verify token créé Story 1.3 (même table que 1.2)
  - **Story 1.7** (Admin TOTP) — non-impactée Story 1.3
  - **Story 1.8** (Profile update) — pattern réutilisé pour update Pro (companyName, vatNumber, phone)
  - **Story 1.9** (Account delete RGPD) — soft-delete cascade ProProfile + R2 docs purge
  - **Story 1.10** (identity-svc consolidation) — reconciliation job R8 drift (orphan Keycloak users + orphan R2 KYC docs)
  - **Story 2.1** (Stripe Connect Express) — utilise ProProfile + extends avec stripeAccountId field (migration ALTER TABLE Story 2.1)
  - **Story 2.2** (Pro onboarding wizard 4 steps) — orchestre Story 1.3 register + Story 2.1 Stripe + Story 2.6 1ère fiche
  - **Story 2.3** (Admin verification queue) — consume event `identity.pro.registered.v1` + filter `kyc_status='pending_review'`
  - **Story 2.4** (Admin KYC review) — utilise `mediaStorage.getSignedDownloadUrl(5min)` Story 1.3
  - **Story 2.5** (Pro acceptation/rejet) — update `pro_profiles.kyc_status` + `user_profiles.tukio_status` + Keycloak attribute sync
  - **Story 2.7** (Audit trail) — consume `identity.pro.registered.v1` event pour audit log
  - **Story 2.8** (Pro reminder + auto-rejection 30j) — consume `pro_profiles.kyc_status='pending_review'` + `created_at + 30 days` cron
  - **Story 5.4** (notification-svc) — consume `notification.email.send.v1` template `pro-pending-admin-review` → Resend
  - **Story 7.5** (acquisition tracking V1) — multi-touch attribution sur Pros + Customers
  - **Stories Epic 4 (booking)** — fonctionnalités transactionnelles bloquées Story 1.3 middleware FR17 jusqu'à Story 2.5 admin validation
- **FRs covered** :
  - **FR3** ✅ Pro register with `pending_admin_review` (KYC docs + SIRET + RIB + idCard)
  - **FR16** ✅ Anti-doublon SIRET (index unique partial + check + 409 IDENTITY-CONFLICT-002)
  - **FR17** ✅ Block transactional Pro `pending_admin_review` (middleware redirect)
- **NFRs touchés** :
  - **NFR9** ✅ HTTPS/HSTS + password complexity + anti-énumération SIRET
  - **NFR10** ✅ Rate limit 3/min/IP register pro (plus strict que Customer 5/min)
  - **NFR15** ✅ KYC docs encrypted at-rest R2 SSE-S3 AES256 + signed URLs 5 min
  - **NFR21** ✅ LCEN positioning (KYC docs uploadés mais non publiés sans modération admin)
  - **NFR48** ✅ UX wizard ≤ 5 min p90 desktop
  - **NFR71** ✅ Coverage ≥ 80% endpoint + 90% use case + 80% wizard
  - **NFR79** ✅ INSEE SIRENE V3.11 vérification SIRET active
  - **R8** ✅ Drift Keycloak ↔ DB ↔ R2 mitigated via compensation saga + alertes Prom
  - **R10** ✅ RGPD soft-delete préparé (Story 1.9 finalise)

> **Prochaine story (auto-discover via `bmad-create-story`) → Story 1.4** (Login flow Keycloak `POST /v1/auth/login` + Authorization Code + PKCE)

---

**Dev agent next steps :**
1. Lire ce file en entier (Story Foundation + AC + Tasks + Dev Notes + References)
2. Vérifier les artefacts upstream (Stories 0.2, 0.4-0.10, 0.13, 1.1, 1.2) sont bien en `ready-for-dev` ou `done`. **CRITIQUE** : Story 1.2 doit être implémentée AVANT Story 1.3 (Story 1.3 réutilise massivement les patterns Story 1.2)
3. **Préparer un compte INSEE API** (https://api.insee.fr/) en amont — création gratuite mais ~24h validation
4. **Préparer un bucket Cloudflare R2 dev** (`tukio-kyc-dev` shared) + credentials Doppler
5. Implémenter Tasks 1-10 dans l'ordre (Tasks 1-3 indépendantes peuvent paralléliser ; Tasks 7-9 frontend peuvent paralléliser avec Tasks 4-6 backend)
6. Lancer après chaque jalon : `pnpm lint && pnpm typecheck && pnpm test --filter=...[origin/main] && pnpm playwright test --grep "pro register"`
7. Commit Story 1.3 quand : 11/11 e2e tests passent + coverage ≥ thresholds + lint OK + axe-core 0 violations + perf NFR48 OK + saga compensation tests pass
8. Update `_bmad-output/implementation-artifacts/sprint-status.yaml` : `1-3-pro-registration-pending-admin-review: review` (puis `done` après code-review)
