# Story 1.2: Customer B2C registration (`POST /v1/auth/customer/register`)

Status: ready-for-dev

> ⚠️ **ADR-016 / Story 0.14 (2026-05-15) — frontend topology pivot**
> `apps/customer` a été mergé dans `apps/public`. Toute référence ci-dessous à
> `apps/customer/[locale]/<route>/` se traduit par `apps/public/[locale]/(authenticated)/<route>/`
> (route group Next.js, voir `apps/public/src/middleware.ts` pour le gate
> session). Hostname: `customer.tukio.one` → `tukio.one` (apex). Voir
> `docs/adr/0016-frontend-topology-pivot-apex-unified.md` et Story 0.14.

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

**As a** Visitor (futur Customer B2C),
**I want** to register as a Customer B2C (rôle Keycloak `client`) en moins de 30 s, en soumettant un formulaire `apps/public/{locale}/auth/sign-up` (champs : email + password + firstName + lastName + locale + acceptTerms + acceptMarketing? + acquisition UTM auto-captured), avec validation Zod côté frontend ET côté backend (ADR-014), création atomique via `identity-svc` (Keycloak Admin API user + `UserProfile` aggregate Postgres + outbox event NATS `identity.user.registered.v1` + outbox event `notification.email.send.v1` pour le mail de vérification), retour enveloppé `{ method:'POST', code:201, data:{ userId, requiresEmailVerification:true } }`, anti-énumération sur conflit (409 + `IDENTITY-CONFLICT-001`, message UI générique), rate-limiting `gateway-api` 5 inscriptions/min/IP avec 429 enveloppé `Retry-After`, persistence acquisition tracking (`acquisition_source`, `acquisition_campaign`, `acquisition_first_touch`, `acquisition_last_touch` columns Story 0.13 + cookie `tk_acq` lecture côté gateway-api), middleware Next.js qui redirige les comptes `email_verified=false` vers `/auth/verify-email-required` (FR17), tests Playwright e2e FR + EN sans erreur axe-core, accessibilité RGAA AA, NFR48 < 30 s pour 90 % desktop,
**so that** je peux commencer à explorer le catalogue (search, filters, fiches, marquer favoris) immédiatement après inscription, avant même la vérification email (FR1) ; je suis bloqué de tout flow transactionnel (booking, checkout, messaging) tant que mon email n'est pas vérifié (FR17 — gating contrôlé via claim JWT `email_verified` + middleware Next.js) ; mon UTM/referral est tracké dès le 1ᵉʳ touch (K-04 acquisition retro-fit impossible) ; et le **pattern complet "register customer" devient le template canonique** pour les Stories 1.3 (Pro register pending), 1.5 (password reset), 1.6 (email verify), 1.8 (profile update), 1.9 (account delete) qui répliqueront cette structure Pretre + envelope + outbox events + frontend form + tests e2e.

> **Outcome attendu** : à la fin de cette story, `POST /v1/auth/customer/register` (gateway-api `localhost:4000`) avec body valide retourne `201 SuccessEnvelope { method:'POST', code:201, data:{ userId, requiresEmailVerification:true }, meta:{ correlationId, locale, timestamp } }` ; le user existe dans Keycloak avec rôle `client` + claim `tukio:locale` correct + `tukio:status='active'` + `email_verified=false` ; un row dans `tukio_identity.user_profiles` avec `keycloak_user_id` + `acquisition_source='google_ads'` (si UTM provided) ; 2 events NATS publiés via outbox-relay (`identity.user.registered.v1` + `notification.email.send.v1`) — visibles côté NATS monitoring `localhost:8222/jsz` ; le user fraîchement inscrit qui ouvre `tukio.one/account/dashboard` voit le dashboard (read access OK) mais qui clique "Réserver" est redirigé vers `/auth/verify-email-required` (middleware bloque) ; un test `pnpm playwright test --grep "customer register"` passe en FR ET EN, axe-core 0 violations ; un Visitor avec un email déjà existant reçoit `409 ErrorEnvelope { tukioCode: 'IDENTITY-CONFLICT-001' }` côté API mais le frontend affiche le message générique `"Si un compte existe pour cet email, vérifiez votre boîte de réception"` (anti-énumération NFR9) ; le 6ᵉ register du même IP en 1 min retourne `429 ErrorEnvelope { Retry-After: <secs> }` (gateway-api throttler).

## Acceptance Criteria

1. **AC1 — Frontend sign-up form `apps/public/[locale]/auth/sign-up`** : Given un Visitor sur `tukio.one/{fr|en}/auth/sign-up` (page Server Component qui hydrate un Client Component form), When il consulte la page, Then :
   - **Layout** : Server Component layout qui détecte la locale via `next-intl` middleware (Story 0.9), rend le header `<PublicHeader>` (Story 0.4 atomic) + le `<SignUpForm>` (Client Component dans `apps/public/src/features/auth/sign-up/components/SignUpForm.tsx`) + le footer
   - **Form fields** (alignés UX-DR9 sign-up funnel + UX spec ligne 1479 `<FormField>` standard) :
     - `<FormField label="Email" type="email" required>` validé Zod RFC 5322 (`z.string().email().min(5).max(255)`)
     - `<FormField label="Mot de passe" type="password" required helper="Min 12 caractères, 1 maj, 1 min, 1 chiffre, 1 spécial">` validé Zod (`z.string().regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[\s\S]{12,}$/, 'Mot de passe trop faible')`)
     - `<FormField label="Prénom" type="text" required>` (1-80 chars)
     - `<FormField label="Nom" type="text" required>` (1-80 chars)
     - `<select label="Langue préférée">` 2 options : `Français` / `English` (default = locale courante)
     - `<Checkbox label="J'accepte les CGU et la politique de confidentialité" required>` — link to `/terms` + `/privacy` (Story 7.9)
     - `<Checkbox label="Je veux recevoir les nouveautés Tukio par email" optional>` — opt-in marketing RGPD (NFR27)
   - **Validation** : React Hook Form + Zod resolver (validation immédiate UX + bouton CTA disabled tant que invalid). Schema Zod **importé depuis `@tukio/contracts/dtos/identity/register-customer.dto.ts`** (Story 1.2 ajoute ce DTO — single source of truth frontend ↔ backend).
   - **CTA** : `<Button variant="primary" size="lg">S'inscrire</Button>` (Story 0.4 atomic). Loading state via `<Spinner>` quand pending. Disabled si form invalid.
   - **Acquisition tracking automatique** : au mount du form, le composant `useAcquisitionTracking()` hook (à créer dans `packages/api-client/src/hooks/use-acquisition-tracking.ts`) lit (a) les query params UTM (`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`), (b) le cookie `tk_acq` (set par middleware gateway-api Story 0.13 — first-touch persistant), (c) le `referralId` si présent dans path (`/r/<id>`). L'objet `acquisition: { source, medium?, campaign?, content?, term?, referralId? }` est ajouté au payload submit (champ caché du form, jamais affiché à l'utilisateur).
   - **i18n strict** (memory `feedback_i18n_frontend.md`) : aucun texte hardcodé. Toutes les strings dans `apps/public/messages/{fr,en}.json` sous le namespace `auth.signup.*` (label, placeholder, helper, error, button, success). Importées via `useTranslations('auth.signup')` (next-intl).
   - **Accessibilité RGAA AA** : labels associés via `htmlFor` + `aria-describedby` pour helper/error, `aria-invalid` sur fields invalid, focus visible, navigation keyboard complète (Tab/Shift-Tab/Enter), errors annoncées via `role="alert"`. Tests axe-core obligatoires (Task 9).
   - **Test Playwright e2e** (`apps/public/e2e/auth/customer-register.spec.ts`) : remplir le form FR + EN, soumettre, vérifier redirect vers `/auth/verify-email-required` + toast succès, axe-core 0 violations (Task 9).

2. **AC2 — DTO + event schemas dans `@tukio/contracts`** : Given la nécessité de partager les types frontend ↔ gateway-api ↔ identity-svc, When je consulte `packages/contracts/src/`, Then je trouve :
   - **`packages/contracts/src/dtos/identity/register-customer.dto.ts`** (NOUVEAU) :
     ```ts
     import { z } from 'zod';
     import { LocaleSchema } from '../../types/Locale';
     import { AcquisitionInputSchema } from './acquisition.dto';

     export const RegisterCustomerInputSchema = z.object({
       email: z.string().email().min(5).max(255),
       password: z.string()
         .min(12, 'Password must be at least 12 characters')
         .regex(/[a-z]/, 'Must contain a lowercase letter')
         .regex(/[A-Z]/, 'Must contain an uppercase letter')
         .regex(/\d/, 'Must contain a digit')
         .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Must contain a special character'),
       firstName: z.string().min(1).max(80),
       lastName: z.string().min(1).max(80),
       locale: LocaleSchema,
       acceptTerms: z.literal(true, { message: 'You must accept the terms' }),
       acceptMarketing: z.boolean().optional().default(false),
       acquisition: AcquisitionInputSchema.optional(),
     });
     export type RegisterCustomerInput = z.infer<typeof RegisterCustomerInputSchema>;

     export const RegisterCustomerResponseSchema = z.object({
       userId: z.string().uuid(),
       requiresEmailVerification: z.literal(true),
     });
     export type RegisterCustomerResponse = z.infer<typeof RegisterCustomerResponseSchema>;
     ```
   - **`packages/contracts/src/dtos/identity/acquisition.dto.ts`** (NOUVEAU — réutilisable Stories 1.3, 4.x) :
     ```ts
     export const AcquisitionSourceSchema = z.enum([
       'organic', 'google_ads', 'meta_ads', 'referral', 'direct', 'partner', 'unknown',
     ]); // align Story 0.13 ENUM
     export const AcquisitionInputSchema = z.object({
       source: AcquisitionSourceSchema.default('unknown'),
       medium: z.string().max(50).optional(),
       campaign: z.string().max(100).optional(),
       content: z.string().max(100).optional(),
       term: z.string().max(100).optional(),
       referralId: z.string().uuid().optional(),
     });
     export type AcquisitionInput = z.infer<typeof AcquisitionInputSchema>;
     ```
   - **`packages/contracts/src/events/identity/user-registered.v1.schema.json`** (NOUVEAU JSON Schema Draft 7) — contrat formel NATS event :
     ```json
     {
       "$schema": "http://json-schema.org/draft-07/schema#",
       "$id": "https://tukio.one/events/identity.user.registered.v1.json",
       "title": "identity.user.registered.v1",
       "type": "object",
       "required": ["eventId", "eventType", "eventVersion", "occurredAt", "aggregate", "actor", "payload", "correlationId"],
       "properties": {
         "eventId": { "type": "string", "format": "uuid" },
         "eventType": { "const": "identity.user.registered" },
         "eventVersion": { "const": "v1" },
         "occurredAt": { "type": "string", "format": "date-time" },
         "aggregate": {
           "type": "object",
           "required": ["type", "id"],
           "properties": {
             "type": { "const": "UserProfile" },
             "id": { "type": "string", "format": "uuid" }
           }
         },
         "actor": {
           "type": "object",
           "required": ["userId", "role"],
           "properties": {
             "userId": { "type": "string" },
             "role": { "enum": ["client", "pro", "admin-support", "admin-modo", "admin-super", "system"] }
           }
         },
         "payload": {
           "type": "object",
           "required": ["userId", "email", "role", "locale", "acquisitionSource", "marketingOptIn", "registeredAt"],
           "properties": {
             "userId": { "type": "string", "format": "uuid" },
             "email": { "type": "string", "format": "email" },
             "firstName": { "type": "string" },
             "lastName": { "type": "string" },
             "role": { "const": "client" },
             "locale": { "enum": ["fr", "en"] },
             "acquisitionSource": { "enum": ["organic", "google_ads", "meta_ads", "referral", "direct", "partner", "unknown"] },
             "acquisitionMedium": { "type": ["string", "null"] },
             "acquisitionCampaign": { "type": ["string", "null"] },
             "acquisitionReferralId": { "type": ["string", "null"], "format": "uuid" },
             "marketingOptIn": { "type": "boolean" },
             "registeredAt": { "type": "string", "format": "date-time" }
           }
         },
         "correlationId": { "type": "string", "format": "uuid" }
       }
     }
     ```
   - **`packages/contracts/src/events/identity/user-registered.v1.ts`** (NOUVEAU — types TS dérivés du JSON Schema via `json-schema-to-typescript` Story 0.2 build pipeline)
   - **`packages/contracts/src/events/notification/email-send.v1.schema.json`** (NOUVEAU — réutilisable Stories 1.5/1.6 + Epic 5) avec types template :
     ```json
     {
       "title": "notification.email.send.v1",
       "type": "object",
       "required": ["templateId", "locale", "to", "params"],
       "properties": {
         "templateId": { "enum": ["email-verify", "password-reset", "booking-confirmed", "booking-accepted", "review-request", "..."] },
         "locale": { "enum": ["fr", "en"] },
         "to": {
           "type": "object",
           "required": ["email"],
           "properties": {
             "email": { "type": "string", "format": "email" },
             "userId": { "type": "string", "format": "uuid" },
             "name": { "type": "string" }
           }
         },
         "params": { "type": "object", "additionalProperties": true }
       }
     }
     ```
   - **`packages/contracts/src/types/error-codes.ts`** (UPDATE — Story 0.2 a posé les codes auth, Story 1.2 ajoute identity codes) :
     ```ts
     export const IdentityErrorCodes = {
       VALIDATION_INPUT_INVALID: 'IDENTITY-VALIDATION-001',
       CONFLICT_EMAIL_EXISTS: 'IDENTITY-CONFLICT-001',
       CONFLICT_SIRET_EXISTS: 'IDENTITY-CONFLICT-002', // Story 1.3
       CONFLICT_ACTIVE_BOOKINGS: 'IDENTITY-CONFLICT-003', // Story 1.9
       NOT_FOUND_USER: 'IDENTITY-NOT-FOUND-001',
       FORBIDDEN_KEYCLOAK_FAIL: 'IDENTITY-FORBIDDEN-001',
       EXTERNAL_KEYCLOAK_DOWN: 'IDENTITY-EXTERNAL-001',
       EXTERNAL_INSEE_DOWN: 'IDENTITY-EXTERNAL-002', // Story 1.3
     } as const;
     export type IdentityErrorCode = typeof IdentityErrorCodes[keyof typeof IdentityErrorCodes];
     ```
   - **Build pipeline** : `pnpm --filter=@tukio/contracts build` regenerate les types TS depuis JSON Schema (Story 0.2 wired ce pipeline). Vérifier que `import type { UserRegisteredV1 } from '@tukio/contracts/events/identity'` fonctionne post-build.

3. **AC3 — gateway-api endpoint `POST /v1/auth/customer/register` (public, rate-limited, envelope)** : Given `apps/gateway-api/src/infrastructure/http/controllers/auth.controller.ts` (NOUVEAU ou UPDATE — gateway-api Pretre structure répliquée Story 0.6 si pas encore fait, sinon scaffolding minimal Story 1.2 — voir Tasks), When je l'ouvre, Then :
   - **Endpoint** :
     ```ts
     @Controller('/v1/auth/customer')
     @UseGuards() // public, mais rate-limited (cf. AC4)
     export class AuthCustomerController {
       constructor(
         private readonly registerCustomerForwarder: UseCaseProxy<RegisterCustomerForwarder>,
       ) {}

       @Post('/register')
       @Public() // @tukio/auth bypass JWT guard (endpoint public)
       @HttpCode(201)
       @Throttle({ default: { limit: 5, ttl: 60_000 } }) // 5/min/IP — NFR10
       async register(
         @Body() dto: RegisterCustomerInput, // Zod-validated via NestJS pipe (cf. AC4)
         @Ip() clientIp: string,
         @Headers('user-agent') userAgent: string,
         @Cookies('tk_acq') firstTouchAcquisitionCookie: string | undefined,
       ): Promise<RegisterCustomerResponse> {
         const acquisition = mergeAcquisition(dto.acquisition, firstTouchAcquisitionCookie); // first-touch wins, last-touch update
         return this.registerCustomerForwarder.getInstance().execute({
           ...dto,
           acquisition,
           clientIp,
           userAgent,
         });
       }
     }
     ```
   - **Forwarder use case** (`apps/gateway-api/src/usecases/register-customer.forwarder.ts`) — pas un domain use case (gateway-api a un domain léger BFF) mais une simple classe qui compose validation + appel HTTP downstream + mapping erreur :
     ```ts
     export class RegisterCustomerForwarder {
       constructor(private readonly identitySvcClient: IIdentitySvcClient) {}
       async execute(input: RegisterCustomerInput & { acquisition: AcquisitionInput; clientIp: string; userAgent: string }): Promise<RegisterCustomerResponse> {
         try {
           return await this.identitySvcClient.registerCustomer(input);
         } catch (e) {
           if (e instanceof IdentitySvcConflictError) {
             throw new IdentityConflictException(e.tukioCode, e.message);
           }
           if (e instanceof IdentitySvcValidationError) {
             throw new ValidationFailedException(e.issues);
           }
           if (e instanceof IdentitySvcUnreachableError) {
             throw new ExternalServiceException('IDENTITY-EXTERNAL-001');
           }
           throw e; // fall-through to InternalServerError
         }
       }
     }
     ```
   - **HTTP client identity-svc** (`apps/gateway-api/src/infrastructure/external/identity-svc/identity-svc.client.ts`) :
     - Implements `IIdentitySvcClient` (port dans `apps/gateway-api/src/domain/ports/identity-svc.port.ts`)
     - Wrapper axios qui POST `${IDENTITY_SVC_URL}/internal/customers` avec body + header `X-Internal-Service-Token: <hmac-shared-secret>` + header `X-Tukio-Correlation-Id` propagé (Story 0.7)
     - Timeout 5 s, retry 3x avec exponential backoff (axios-retry), si toujours fail → `IdentitySvcUnreachableError`
     - Error mapping : 409 → `IdentitySvcConflictError`, 422 → `IdentitySvcValidationError`, 5xx → `IdentitySvcUnreachableError`
   - **Réponse réussie wrappée par `ResponseEnvelopeInterceptor` ADR-014** (cohérent Story 0.6 AC10) : `{ method:'POST', code:201, data:{ userId, requiresEmailVerification:true }, meta:{ timestamp, correlationId, locale } }`
   - **Réponse erreur wrappée par `EnvelopeExceptionFilter`** : `{ method:'POST', code:409, error:{ type:'https://tukio.one/errors/identity-conflict-001', title:'Email already registered', detail:'Email déjà utilisé', instance:'/v1/auth/customer/register', tukioCode:'IDENTITY-CONFLICT-001' }, meta:{ ... } }`

4. **AC4 — Validation Zod via NestJS pipe + rate-limiting `@nestjs/throttler` + 429 enveloppé** : Given le gateway-api endpoint, When un client soumet :
   - **Body invalide** (email malformé, password trop court, missing required field) → `ZodValidationPipe` (NestJS pipe wrapping `RegisterCustomerInputSchema.parse(body)`) throw `ZodError` → `EnvelopeExceptionFilter` map en `422 ErrorEnvelope` :
     ```json
     {
       "method": "POST",
       "code": 422,
       "error": {
         "type": "https://tukio.one/errors/validation-failed",
         "title": "Validation failed",
         "detail": "Request body did not match expected schema",
         "instance": "/v1/auth/customer/register",
         "tukioCode": "VALIDATION-FAILED-001",
         "issues": [
           { "path": ["email"], "code": "invalid_string", "message": "Invalid email" },
           { "path": ["password"], "code": "too_small", "message": "Password must be at least 12 characters" }
         ]
       },
       "meta": { ... }
     }
     ```
   - **Body conflit (email déjà existant)** → identity-svc retourne 409 → forwarder map en `IdentityConflictException` → `EnvelopeExceptionFilter` map en `409 ErrorEnvelope` avec `tukioCode: 'IDENTITY-CONFLICT-001'`. **Anti-énumération NFR9** : message API distinct (`'Email already registered'`) mais frontend affiche message générique (`'Si un compte existe pour cet email, vérifiez votre boîte de réception'`) — frontend NE EXPOSE PAS le `tukioCode` à l'UI dans ce cas spécifique.
   - **Rate-limit dépassé** (> 5 register/min sur même IP) → `@nestjs/throttler` ThrottlerGuard intercepte → throw `ThrottlerException` → `EnvelopeExceptionFilter` map en `429 ErrorEnvelope` avec header HTTP `Retry-After: <seconds>` :
     ```json
     {
       "method": "POST",
       "code": 429,
       "error": {
         "type": "https://tukio.one/errors/rate-limit-exceeded",
         "title": "Too many requests",
         "detail": "Maximum 5 registrations per minute per IP",
         "instance": "/v1/auth/customer/register",
         "tukioCode": "RATE-LIMIT-EXCEEDED-001",
         "retryAfter": 47
       },
       "meta": { ... }
     }
     ```
   - **Throttler config** (`apps/gateway-api/src/app.module.ts`) :
     ```ts
     ThrottlerModule.forRoot([
       { name: 'default', ttl: 60_000, limit: 60 }, // anonymous default 60/min/IP — Architecture ligne 704
       { name: 'sensitive', ttl: 60_000, limit: 5 }, // sensitive endpoints (login, register, payment) 5-10/min/IP
     ]),
     ```
   - **Storage Redis** : `@nestjs/throttler` avec `ThrottlerStorageRedisService` pointant vers Upstash Redis (Story 0.10 Redis container) — permet rate-limit cross-replicas en prod K8s.
   - **Tests E2E gateway-api** (`apps/gateway-api/test/auth-customer-register.e2e-spec.ts`) :
     - Body valide → 201 enveloppé avec userId
     - Body invalid (email malformé) → 422 enveloppé avec `issues` array
     - Body conflit (mock identity-svc retourne 409) → 409 enveloppé avec `IDENTITY-CONFLICT-001`
     - 6ᵉ register du même IP en 1 min → 429 enveloppé avec `Retry-After`
     - Vérifier `correlationId` propagé header `X-Tukio-Correlation-Id` au identity-svc

5. **AC5 — identity-svc `POST /internal/customers` endpoint + use case `RegisterCustomerUseCase`** : Given l'architecture Pretre (Story 0.6) avec `domain/ports/` et `usecases/`, When je consulte `apps/identity-svc/src/`, Then je trouve :
   - **Domain ports nouveaux** (NEW) :
     - `domain/ports/keycloak-admin.port.ts` :
       ```ts
       export interface IKeycloakAdmin {
         createUser(input: { email: string; firstName: string; lastName: string; password: string; locale: 'fr' | 'en'; emailVerified: boolean; role: 'client' | 'pro'; status: 'active' | 'pending_admin_review'; }): Promise<{ keycloakUserId: string }>;
         findUserByEmail(email: string): Promise<{ keycloakUserId: string } | null>;
         deleteUser(keycloakUserId: string): Promise<void>; // pour rollback en cas d'échec DB après Keycloak créé
         setUserPassword(keycloakUserId: string, password: string, temporary: boolean): Promise<void>;
         assignRealmRole(keycloakUserId: string, role: 'client' | 'pro' | 'admin-support' | 'admin-modo' | 'admin-super'): Promise<void>;
         setUserAttributes(keycloakUserId: string, attributes: Record<string, string[]>): Promise<void>;
       }
       export const KEYCLOAK_ADMIN = Symbol('KEYCLOAK_ADMIN');
       ```
     - `domain/ports/email-verification-token-repository.port.ts` :
       ```ts
       export interface IEmailVerificationTokenRepository {
         save(token: { token: string; userId: string; expiresAt: Date; }): Promise<void>;
         findByToken(token: string): Promise<{ userId: string; expiresAt: Date; usedAt: Date | null } | null>;
         markUsed(token: string): Promise<void>;
       }
       export const EMAIL_VERIFICATION_TOKEN_REPOSITORY = Symbol('EMAIL_VERIFICATION_TOKEN_REPOSITORY');
       ```
   - **Domain aggregate `UserProfile` extended** (UPDATE — Story 0.6 a posé l'aggregate, Story 1.2 ajoute la factory `register()`) :
     ```ts
     // domain/model/user-profile.aggregate.ts (UPDATE)
     export class UserProfile {
       static register(input: {
         keycloakUserId: string;
         email: Email; // VO
         firstName: string;
         lastName: string;
         locale: Locale;
         role: 'client'; // factory dédiée customer — Story 1.3 fera registerPro
         status: 'active'; // customer toujours active, pas pending_admin_review
         marketingOptIn: boolean;
         acquisition: AcquisitionInput;
       }): UserProfile {
         // invariants métier validés ici (firstName + lastName non vides, etc.)
         const id = randomUUID();
         const now = new Date();
         return new UserProfile({
           id,
           keycloakUserId: input.keycloakUserId,
           email: input.email,
           firstName: input.firstName.trim(),
           lastName: input.lastName.trim(),
           role: input.role,
           locale: input.locale,
           status: input.status,
           marketingOptIn: input.marketingOptIn,
           emailVerified: false,
           acceptTerms: true,
           acceptTermsAt: now,
           acquisitionSource: input.acquisition.source,
           acquisitionMedium: input.acquisition.medium ?? null,
           acquisitionCampaign: input.acquisition.campaign ?? null,
           acquisitionReferralId: input.acquisition.referralId ?? null,
           acquisitionFirstTouch: now,
           acquisitionLastTouch: now,
           createdAt: now,
           updatedAt: now,
           deletedAt: null,
         });
       }
       // existant Story 0.6 : findById, etc.
     }
     ```
   - **Use case `RegisterCustomerUseCase`** (NEW — `apps/identity-svc/src/usecases/register-customer.usecase.ts`) :
     ```ts
     @Injectable()
     export class RegisterCustomerUseCase {
       constructor(
         @Inject(USER_PROFILE_REPOSITORY) private readonly userProfileRepo: IUserProfileRepository,
         @Inject(KEYCLOAK_ADMIN) private readonly keycloakAdmin: IKeycloakAdmin,
         @Inject(EMAIL_VERIFICATION_TOKEN_REPOSITORY) private readonly tokenRepo: IEmailVerificationTokenRepository,
         @Inject(EVENT_PUBLISHER) private readonly eventPublisher: IEventPublisher,
       ) {}

       async execute(input: RegisterCustomerInput & { acquisition: AcquisitionInput }): Promise<{ userId: string; requiresEmailVerification: true }> {
         // 1. Vérifier email pas déjà utilisé (en DB locale identity-svc — source de vérité business)
         const existing = await this.userProfileRepo.findByEmail(input.email);
         if (existing) {
           throw new IdentityConflictException('IDENTITY-CONFLICT-001', 'Email already registered');
         }

         // 2. Créer le user dans Keycloak avec rôle 'client', email_verified=false, status='active'
         let keycloakUserId: string;
         try {
           const result = await this.keycloakAdmin.createUser({
             email: input.email,
             firstName: input.firstName,
             lastName: input.lastName,
             password: input.password,
             locale: input.locale,
             emailVerified: false,
             role: 'client',
             status: 'active',
           });
           keycloakUserId = result.keycloakUserId;
         } catch (e) {
           if (e instanceof KeycloakUserAlreadyExistsError) {
             // Race condition : check business DB OK mais Keycloak déjà a user (cas edge — drift R8)
             throw new IdentityConflictException('IDENTITY-CONFLICT-001', 'Email already registered');
           }
           throw new ExternalServiceException('IDENTITY-EXTERNAL-001', 'Keycloak unreachable');
         }

         // 3. Créer le UserProfile aggregate + transaction TypeORM
         try {
           const userProfile = UserProfile.register({
             keycloakUserId,
             email: Email.of(input.email),
             firstName: input.firstName,
             lastName: input.lastName,
             locale: input.locale,
             role: 'client',
             status: 'active',
             marketingOptIn: input.acceptMarketing ?? false,
             acquisition: input.acquisition,
           });

           // 4. Générer le verify token (UUID v4, expiry 7 jours)
           const verifyToken = randomUUID();
           const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

           // 5. Atomic transaction : save UserProfile + verify token + outbox events
           await this.userProfileRepo.runInTransaction(async (txn) => {
             await txn.userProfileRepo.save(userProfile);
             await txn.tokenRepo.save({ token: verifyToken, userId: userProfile.id, expiresAt });
             await txn.eventPublisher.publish({
               eventType: 'identity.user.registered',
               eventVersion: 'v1',
               aggregate: { type: 'UserProfile', id: userProfile.id },
               actor: { userId: userProfile.id, role: 'client' },
               payload: {
                 userId: userProfile.id,
                 email: userProfile.email.value,
                 firstName: userProfile.firstName,
                 lastName: userProfile.lastName,
                 role: 'client',
                 locale: userProfile.locale,
                 acquisitionSource: userProfile.acquisitionSource,
                 acquisitionMedium: userProfile.acquisitionMedium,
                 acquisitionCampaign: userProfile.acquisitionCampaign,
                 acquisitionReferralId: userProfile.acquisitionReferralId,
                 marketingOptIn: userProfile.marketingOptIn,
                 registeredAt: userProfile.createdAt.toISOString(),
               },
             });
             await txn.eventPublisher.publish({
               eventType: 'notification.email.send',
               eventVersion: 'v1',
               aggregate: { type: 'UserProfile', id: userProfile.id },
               actor: { userId: 'system', role: 'system' },
               payload: {
                 templateId: 'email-verify',
                 locale: userProfile.locale,
                 to: { email: userProfile.email.value, userId: userProfile.id, name: `${userProfile.firstName} ${userProfile.lastName}` },
                 params: {
                   firstName: userProfile.firstName,
                   verifyUrl: `${this.config.getPublicBaseUrl()}/${userProfile.locale}/auth/email/verify?token=${verifyToken}`,
                   expiresAt: expiresAt.toISOString(),
                 },
               },
             });
           });

           return { userId: userProfile.id, requiresEmailVerification: true };
         } catch (e) {
           // Rollback Keycloak user if business DB save failed (compensation pattern)
           await this.keycloakAdmin.deleteUser(keycloakUserId).catch(() => {/* log + alert; manual reconciliation Story 1.10 daily job */});
           throw e;
         }
       }
     }
     ```
   - **Tests unitaires use case** (`register-customer.usecase.spec.ts`) avec ≥ 90 % coverage : (1) happy path → 201, (2) email déjà existant en DB → throw `IdentityConflictException`, (3) Keycloak retourne 409 race → throw `IdentityConflictException`, (4) Keycloak DOWN → throw `ExternalServiceException`, (5) DB save fail après Keycloak créé → vérifier `keycloakAdmin.deleteUser` appelé (rollback compensation), (6) marketing_opt_in `true`/`false`/`undefined` → persistence correcte, (7) acquisition fields → persistence correcte avec defaults `'unknown'` si absent.

6. **AC6 — Infrastructure ports impls : `KeycloakAdminService` + `EmailVerificationTokenTypeOrmRepository`** : Given les ports domain AC5, When je consulte `apps/identity-svc/src/infrastructure/`, Then je trouve les implémentations :
   - **`infrastructure/external/keycloak/keycloak-admin.service.ts`** (NEW) :
     - Implements `IKeycloakAdmin`
     - Utilise **`@keycloak/keycloak-admin-client`** (latest stable, official Keycloak npm) — typed client wrapping Admin REST API
     - Auth via service-account du client `tukio-api` (Story 1.1 AC2 — confidential client) : `clientCredentials` grant avec `client_id: tukio-api` + `client_secret: ${KEYCLOAK_CLIENT_SECRET_TUKIO_API}`
     - Cache du token admin avec refresh automatique avant expiration (le client Keycloak Admin gère ça nativement)
     - **`createUser`** : appelle `kcAdminClient.users.create({ realm: 'tukio', username: email, email, firstName, lastName, enabled: true, emailVerified: false, attributes: { locale: [locale], status: [status] }, credentials: [{ type: 'password', value: password, temporary: false }] })`. Récupère le `keycloakUserId` depuis le header `Location` ou via `findOne({ email })`.
     - Après création, appelle `kcAdminClient.users.addRealmRoleMappings({ realm: 'tukio', id: keycloakUserId, roles: [<role-representation>] })` pour assigner le rôle (cohérent Story 1.1 AC1 5 rôles existants).
     - **`findUserByEmail`** : `kcAdminClient.users.find({ realm: 'tukio', email, exact: true })`.
     - **`deleteUser`** : `kcAdminClient.users.del({ realm: 'tukio', id: keycloakUserId })` (hard delete utilisé uniquement pour rollback compensation).
     - **`setUserPassword` / `assignRealmRole` / `setUserAttributes`** : standard methods kcAdminClient.
     - **Error handling** : 409 Keycloak (email exists) → throw `KeycloakUserAlreadyExistsError`, 5xx ou timeout → throw `KeycloakUnreachableError`.
     - **PII redaction** sur logs (NFR16) : pas de password en clair dans les logs même DEBUG.
     - **Tests integration** : démarrer un Keycloak realm `tukio` éphémère via testcontainers (Story 0.9 keycloak.helper.ts) + bootstrap-realm Story 1.1 + tester createUser/findUser/deleteUser end-to-end.
   - **`infrastructure/persistence/typeorm/repositories/email-verification-token.typeorm.repository.ts`** (NEW) :
     - Implements `IEmailVerificationTokenRepository`
     - TypeORM Entity `EmailVerificationTokenEntity` (table `email_verification_tokens`)
     - Méthodes simples save/findByToken/markUsed
   - **`infrastructure/persistence/typeorm/repositories/user-profile.typeorm.repository.ts`** (UPDATE — Story 0.6 a posé findById, Story 1.2 ajoute) :
     - `findByEmail(email: string): Promise<UserProfile | null>` : query `SELECT * WHERE email = $1 AND deleted_at IS NULL`
     - `save(userProfile: UserProfile): Promise<void>` : insert/upsert mapper aggregate → entity
     - `runInTransaction<T>(callback): Promise<T>` : nouveau helper qui ouvre une transaction TypeORM partagée + expose un context `txn` avec `userProfileRepo`, `tokenRepo`, `eventPublisher` tous wirés sur le même QueryRunner — garantit l'atomicité avec l'outbox.
   - **`infrastructure/persistence/typeorm/migrations/1715230000000-AddCustomerRegistrationFields.ts`** (NEW) — migration Story 1.2 :
     ```sql
     ALTER TABLE user_profiles ADD COLUMN tukio_status VARCHAR(30) NOT NULL DEFAULT 'active'
       CHECK (tukio_status IN ('active', 'pending_admin_review', 'rejected', 'suspended'));
     ALTER TABLE user_profiles ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT false;
     ALTER TABLE user_profiles ADD COLUMN marketing_opt_in BOOLEAN NOT NULL DEFAULT false;
     ALTER TABLE user_profiles ADD COLUMN accept_terms BOOLEAN NOT NULL DEFAULT false;
     ALTER TABLE user_profiles ADD COLUMN accept_terms_at TIMESTAMPTZ NULL;
     ALTER TABLE user_profiles ADD COLUMN phone VARCHAR(20) NULL; -- Story 1.8

     CREATE INDEX idx_user_profiles_tukio_status ON user_profiles (tukio_status) WHERE deleted_at IS NULL;
     CREATE INDEX idx_user_profiles_email_verified ON user_profiles (email_verified) WHERE deleted_at IS NULL;

     CREATE TABLE email_verification_tokens (
       token UUID PRIMARY KEY,
       user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
       expires_at TIMESTAMPTZ NOT NULL,
       used_at TIMESTAMPTZ NULL,
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     );
     CREATE INDEX idx_email_verification_tokens_user_id ON email_verification_tokens (user_id);
     CREATE INDEX idx_email_verification_tokens_expires_at ON email_verification_tokens (expires_at) WHERE used_at IS NULL;
     ```
     - `down()` : DROP TABLE + DROP INDEX + DROP COLUMNs (rollback NFR72).

7. **AC7 — Controller HTTP `POST /internal/customers` (internal-only, mTLS prod / shared secret MVP)** : Given `apps/identity-svc/src/infrastructure/http/controllers/customer.controller.ts` (NEW), When je l'ouvre, Then :
   ```ts
   @Controller('/internal/customers')
   @UseGuards(InternalServiceGuard) // vérifie X-Internal-Service-Token shared secret
   export class CustomerController {
     constructor(private readonly registerCustomerUseCaseProxy: UseCaseProxy<RegisterCustomerUseCase>) {}

     @Post()
     @HttpCode(201)
     async register(@Body() dto: RegisterCustomerInput & { acquisition: AcquisitionInput }): Promise<{ userId: string; requiresEmailVerification: true }> {
       return this.registerCustomerUseCaseProxy.getInstance().execute(dto);
     }
   }
   ```
   - **`InternalServiceGuard`** (`apps/identity-svc/src/infrastructure/http/guards/internal-service.guard.ts`) :
     - Vérifie présence header `X-Internal-Service-Token: <secret>` (HMAC-SHA256 validation)
     - Le secret est partagé entre gateway-api et identity-svc via Doppler (`TUKIO_INTERNAL_SERVICE_SECRET`) — env var unique pour les 10 services backend
     - Si manquant ou invalide → throw `AuthForbiddenException('AUTH-FORBIDDEN-002')` → 403 enveloppé
     - **V1+ migration** : remplacé par mTLS K8s namespace networking (Architecture ligne 702 NFR10) + cert-manager + sidecar Linkerd
   - **Endpoints internes vs publics** :
     - `/internal/*` : protégés par `InternalServiceGuard`, ne sont **JAMAIS** exposés via gateway-api ingress, K8s NetworkPolicy whitelist gateway-api → services
     - `/v1/*` : protégés par `KeycloakJwtGuard` Story 0.8 (sauf `@Public()` decorator)
     - `/health`, `/ready` : `@Public()`
   - **Tests E2E** (`apps/identity-svc/test/customer-register.e2e-spec.ts`) :
     - Sans `X-Internal-Service-Token` → 403 enveloppé
     - Avec mauvais token → 403
     - Avec token valide + body invalide Zod → 422 enveloppé
     - Avec token valide + body conflit (mock repo) → 409 enveloppé `IDENTITY-CONFLICT-001`
     - Avec token valide + body OK → 201 enveloppé + vérifier user créé en DB + 2 events outbox publiés (assert via outbox table query post-test)
     - Test idempotence : 2 calls identiques en parallèle → 1 succès + 1 conflit (race condition handling)

8. **AC8 — Frontend acquisition tracking + cookie `tk_acq` + middleware redirect verify-email-required** : Given le middleware Next.js Story 0.9 (next-intl) + le cookie acquisition Story 0.13, When un user navigue tukio.one, Then :
   - **Cookie `tk_acq`** (set par middleware `apps/public/src/middleware.ts` au 1ᵉʳ touch — Story 0.13 prépare, Story 1.2 finalise wiring frontend) :
     - Lecture des query params UTM au 1ᵉʳ landing
     - Set cookie `tk_acq` avec `Domain=.tukio.one`, `HttpOnly: false` (lisible JS pour acquisition hook), `SameSite=Lax`, `Max-Age: 90 jours`, valeur encodée base64-JSON `{ source, medium?, campaign?, content?, term?, referralId?, firstTouch: ISO }`
     - **Skip overwrite** si `tk_acq` déjà présent (first-touch wins — K-04 acquisition strategy)
     - Middleware exécuté sur `apps/public/`, `apps/customer/`, `apps/seller/` (cookie shared `Domain=.tukio.one` cohérent Story 0.13 ADR-013)
   - **Hook `useAcquisitionTracking`** (`packages/api-client/src/hooks/use-acquisition-tracking.ts` NEW) :
     ```tsx
     'use client';
     export function useAcquisitionTracking(): AcquisitionInput {
       return useMemo(() => {
         const queryParams = new URLSearchParams(window.location.search);
         const cookieTkAcq = readCookie('tk_acq'); // base64-JSON décodé
         return {
           source: (queryParams.get('utm_source') || cookieTkAcq?.source || 'unknown') as AcquisitionSource,
           medium: queryParams.get('utm_medium') || cookieTkAcq?.medium,
           campaign: queryParams.get('utm_campaign') || cookieTkAcq?.campaign,
           content: queryParams.get('utm_content') || cookieTkAcq?.content,
           term: queryParams.get('utm_term') || cookieTkAcq?.term,
           referralId: extractReferralIdFromPath(window.location.pathname) || cookieTkAcq?.referralId,
         };
       }, []);
     }
     ```
   - **Middleware redirect verify-email-required (FR17)** : `apps/customer/src/middleware.ts` (UPDATE — Story 0.8 a posé le squelette `KeycloakAuthMiddleware`, Story 1.2 ajoute la check email_verified) :
     ```ts
     export default async function middleware(request: NextRequest) {
       // existant Story 0.8 : check session cookie, redirect login si manquant
       const sessionCookie = request.cookies.get('tukio-session-active');
       if (!sessionCookie) return redirectLogin(request);

       // NOUVEAU Story 1.2 : check email_verified pour endpoints transactionnels
       const TRANSACTIONAL_PATHS = ['/cart', '/account/bookings/checkout', '/account/messages']; // étendu Stories Epic 4+5
       const isTransactional = TRANSACTIONAL_PATHS.some(p => request.nextUrl.pathname.startsWith(p));
       if (isTransactional) {
         const jwt = await readJwtFromCookie(request); // helper @tukio/auth-client
         if (jwt && !jwt.payload.email_verified) {
           const url = new URL(`/${jwt.payload['tukio:locale'] || 'fr'}/auth/verify-email-required`, request.url);
           url.searchParams.set('next', request.nextUrl.pathname);
           return NextResponse.redirect(url);
         }
       }
       return NextResponse.next();
     }
     ```
   - **Page `/auth/verify-email-required`** (`apps/customer/src/app/[locale]/auth/verify-email-required/page.tsx` NEW) — placeholder simple Story 1.2 (la page complète + CTA "Renvoyer email" arrive Story 1.6) :
     ```tsx
     export default function VerifyEmailRequiredPage() {
       const t = useTranslations('auth.verifyEmailRequired');
       return (
         <EmptyState
           variant="warning"
           title={t('title')}
           description={t('description')}
           cta={<Button variant="primary">{t('cta.resend')}</Button>}
         />
       );
     }
     ```
   - **Strings i18n** ajoutées dans `apps/customer/messages/{fr,en}.json` sous `auth.verifyEmailRequired.*`.

9. **AC9 — Tests Playwright e2e FR + EN + axe-core sans erreur (NFR48 + UX-DR9)** : Given `apps/public/e2e/auth/customer-register.spec.ts` (NEW), When je lance `pnpm --filter=apps/public test:e2e`, Then :
   - **Test 1 (happy path FR)** : naviguer `localhost:3000/fr/auth/sign-up` → remplir form (email valide, password 12+ chars, prénom, nom, locale FR, accept terms) → cliquer "S'inscrire" → vérifier redirect vers `/auth/verify-email-required` ou page d'attente (selon UX) + toast succès `"Compte créé, vérifiez votre boîte"`
   - **Test 2 (happy path EN)** : idem en `/en/auth/sign-up` → vérifier UI strings EN
   - **Test 3 (validation Zod)** : password trop court → message inline `"Min 12 caractères"` (FR) / `"At least 12 characters"` (EN), email malformé → `"Email invalide"` / `"Invalid email"`
   - **Test 4 (anti-énumération conflit)** : précréer un user `existing@tukio.one` (via fixture testcontainers Keycloak Story 0.9) → soumettre form → vérifier message générique `"Si un compte existe pour cet email, vérifiez votre boîte"` affiché (PAS le tukioCode visible côté UI)
   - **Test 5 (rate-limit 429)** : soumettre 6x rapide depuis même IP → 6ᵉ retourne UI message `"Trop de tentatives, réessayez dans 47s"` (lit `Retry-After` du response)
   - **Test 6 (acquisition UTM)** : naviguer `tukio.one/fr/auth/sign-up?utm_source=google_ads&utm_campaign=spring2026` → soumettre → vérifier en DB (via `pnpm --filter=identity-svc test:db-query` post-test) que `acquisition_source='google_ads'` et `acquisition_campaign='spring2026'` persistés
   - **Test 7 (FR17 verify-email-required)** : se connecter (mock Keycloak login fixture Story 0.9) avec un user `email_verified=false` → naviguer `tukio.one/cart` → vérifier redirect vers `/auth/verify-email-required`
   - **Test 8 (axe-core a11y)** : `await injectAxe(page); await checkA11y(page);` sur la page sign-up — vérifier 0 violations critical/serious (RGAA AA — Story 0.13 lint axe-core)
   - **Test 9 (NFR48 perf)** : mesurer le temps entre `page.goto('/fr/auth/sign-up')` et `await page.waitForURL('**/verify-email-required')` après submit → assert ≤ 30 s p90 (run 10 fois, sort, take p9)
   - **Coverage** : ≥ 80 % gateway-api endpoint, ≥ 80 % identity-svc use case (NFR71)

10. **AC10 — Documentation runbook + observability + ADR cohérence** : Given le scope cross-cutting Story 1.2, When je consulte `docs/`, Then :
    - **`docs/runbook/customer-registration-debug.md`** (NEW ~60 lignes) : flow end-to-end (frontend → gateway → identity-svc → Keycloak + Postgres + NATS), troubleshooting (Keycloak DOWN → comportement, DB transaction rollback → Keycloak compensation, NATS DOWN → outbox accumulation), commandes utiles (`pnpm --filter=identity-svc query:user-by-email`, `pnpm --filter=identity-svc query:outbox-pending`), corrélation `correlationId` dans logs Loki + traces Tempo (Story 0.12)
    - **`packages/contracts/README.md`** (UPDATE) : section "Identity events" qui documente `identity.user.registered.v1` payload + downstream consumers (à venir : notification-svc Story 5.4, analytics-svc V1 funnel tracking)
    - **Métriques Prometheus** ajoutées (gateway-api + identity-svc) :
      - `tukio_register_customer_attempts_total{result=success|conflict|validation_error|rate_limit|external_error}` (counter, gateway-api)
      - `tukio_register_customer_duration_seconds` (histogram, gateway-api)
      - `tukio_keycloak_admin_calls_total{operation,status}` (counter, identity-svc)
    - **Dashboard Grafana** (`infra/k8s/grafana-dashboards/identity-registration.json` NEW Story 1.2) : 4 panels (registration funnel, p95 latency, error rate, NATS event lag) — alerte Slack si error rate > 5 % sur 5 min ou p95 > 5 s.
    - **Lint custom rule** `tukio/no-bypass-envelope` (Story 0.13 préparé) : vérifier que le controller AC7 retourne le DTO nu (pas wrap manuel envelope).

## Tasks / Subtasks

- [ ] **Task 1 — Étendre `@tukio/contracts` avec DTOs + events identity** (AC: #2)
  - [ ] 1.1 — Créer `packages/contracts/src/dtos/identity/register-customer.dto.ts` (Zod schema input + response)
  - [ ] 1.2 — Créer `packages/contracts/src/dtos/identity/acquisition.dto.ts` (réutilisable Stories 1.3, 4.x)
  - [ ] 1.3 — Créer `packages/contracts/src/events/identity/user-registered.v1.schema.json` (JSON Schema Draft 7)
  - [ ] 1.4 — Créer `packages/contracts/src/events/identity/user-registered.v1.ts` (types TS dérivés via build pipeline Story 0.2 `pnpm --filter=@tukio/contracts build`)
  - [ ] 1.5 — Créer `packages/contracts/src/events/notification/email-send.v1.schema.json` + `.ts` (réutilisable Stories 1.5/1.6 + Epic 5)
  - [ ] 1.6 — Update `packages/contracts/src/types/error-codes.ts` : ajouter `IdentityErrorCodes` const + types (10+ codes prêts pour Stories 1.x)
  - [ ] 1.7 — Update `packages/contracts/src/index.ts` barrel exports + subpath exports (`./dtos/identity`, `./events/identity`, `./events/notification`)
  - [ ] 1.8 — `pnpm --filter=@tukio/contracts build && pnpm --filter=@tukio/contracts test` (vérifier types générés OK + Zod schemas valides)

- [ ] **Task 2 — Étendre identity-svc domain layer (aggregates, ports, exceptions)** (AC: #5)
  - [ ] 2.1 — Update `apps/identity-svc/src/domain/model/user-profile.aggregate.ts` : ajouter factory static `register()`, propriétés `status`, `marketingOptIn`, `emailVerified`, `acceptTerms`, `acceptTermsAt`, `acquisition*` (8 fields)
  - [ ] 2.2 — Créer `apps/identity-svc/src/domain/model/value-objects/email.value-object.ts` (UPDATE — Story 0.6 placeholder, Story 1.2 ajoute validation RFC 5322)
  - [ ] 2.3 — Créer `apps/identity-svc/src/domain/model/value-objects/locale.value-object.ts` (`'fr' | 'en'` validated)
  - [ ] 2.4 — Créer `apps/identity-svc/src/domain/model/value-objects/acquisition-source.value-object.ts` (enum 7 valeurs)
  - [ ] 2.5 — Créer `apps/identity-svc/src/domain/ports/keycloak-admin.port.ts` (interface IKeycloakAdmin + Symbol token)
  - [ ] 2.6 — Créer `apps/identity-svc/src/domain/ports/email-verification-token-repository.port.ts` (interface + Symbol)
  - [ ] 2.7 — Update `apps/identity-svc/src/domain/ports/user-profile.repository.port.ts` : ajouter méthodes `findByEmail`, `save`, `runInTransaction` au interface
  - [ ] 2.8 — Créer `apps/identity-svc/src/domain/exception/identity-conflict.exception.ts` (extends DomainException, `tukioCode: IDENTITY-CONFLICT-001|002|003`, httpStatus 409)
  - [ ] 2.9 — Créer `apps/identity-svc/src/domain/exception/external-service.exception.ts` (httpStatus 502, `tukioCode: IDENTITY-EXTERNAL-001|002`)
  - [ ] 2.10 — Tests unit aggregate `user-profile.aggregate.spec.ts` : factory `register()` génère un aggregate valide, invariants (firstName non vide, etc.), VOs validés
  - [ ] 2.11 — Tests VO `email.value-object.spec.ts` : RFC 5322 valid/invalid cases, lowercase normalization

- [ ] **Task 3 — Implémenter use case `RegisterCustomerUseCase` + tests** (AC: #5)
  - [ ] 3.1 — Créer `apps/identity-svc/src/usecases/register-customer.usecase.ts` (cf. AC5 squelette)
  - [ ] 3.2 — Tests unit `register-customer.usecase.spec.ts` (Vitest + mocks ports) — 7+ cases (cf. AC5 fin) :
    - happy path → 201 + 2 events publiés via mock IEventPublisher
    - email déjà existant en DB → throw IdentityConflictException
    - Keycloak retourne 409 race → throw IdentityConflictException
    - Keycloak DOWN → throw ExternalServiceException + vérifier rollback non appelé
    - DB save fail après Keycloak créé → vérifier `keycloakAdmin.deleteUser` appelé (rollback)
    - marketing_opt_in `true|false|undefined` → persistence correcte
    - acquisition fields → persistence correcte avec defaults `'unknown'`
  - [ ] 3.3 — Coverage ≥ 90 % use case (cohérent NFR71 + Story 0.6 jest config)

- [ ] **Task 4 — Implémenter infrastructure : KeycloakAdminService + repositories + migration** (AC: #6)
  - [ ] 4.1 — Installer `@keycloak/keycloak-admin-client` (latest stable) : `pnpm --filter=identity-svc add @keycloak/keycloak-admin-client`
  - [ ] 4.2 — Créer `apps/identity-svc/src/infrastructure/external/keycloak/keycloak-admin.service.ts` (implements IKeycloakAdmin, wraps `@keycloak/keycloak-admin-client`, auth via service-account `tukio-api`)
  - [ ] 4.3 — Créer `apps/identity-svc/src/infrastructure/external/keycloak/keycloak-admin.module.ts` (NestJS module qui register `KEYCLOAK_ADMIN` provider)
  - [ ] 4.4 — Créer error classes `apps/identity-svc/src/infrastructure/external/keycloak/errors.ts` (`KeycloakUserAlreadyExistsError`, `KeycloakUnreachableError`)
  - [ ] 4.5 — Créer `apps/identity-svc/src/infrastructure/persistence/typeorm/entities/email-verification-token.entity.ts`
  - [ ] 4.6 — Créer `apps/identity-svc/src/infrastructure/persistence/typeorm/repositories/email-verification-token.typeorm.repository.ts`
  - [ ] 4.7 — Update `apps/identity-svc/src/infrastructure/persistence/typeorm/entities/user-profile.entity.ts` : ajouter colonnes `tukio_status`, `email_verified`, `marketing_opt_in`, `accept_terms`, `accept_terms_at`, `phone`
  - [ ] 4.8 — Update `apps/identity-svc/src/infrastructure/persistence/typeorm/repositories/user-profile.typeorm.repository.ts` : ajouter `findByEmail`, `save`, `runInTransaction` (utilise QueryRunner pour atomicité avec outbox)
  - [ ] 4.9 — Créer migration `1715230000000-AddCustomerRegistrationFields.ts` (cf. AC6 SQL — ALTER TABLE user_profiles + CREATE TABLE email_verification_tokens)
  - [ ] 4.10 — Update `apps/identity-svc/src/infrastructure/persistence/typeorm/data-source.ts` : ajouter `EmailVerificationTokenEntity` à `entities`
  - [ ] 4.11 — Tests integration `keycloak-admin.service.integration.spec.ts` : démarrer Keycloak + bootstrap-realm-tukio (Story 0.9 + Story 1.1 helpers) + tester createUser/findUser/deleteUser/setPassword end-to-end
  - [ ] 4.12 — Tests integration `user-profile.typeorm.repository.integration.spec.ts` : démarrer Postgres testcontainer, run migration, tester `findByEmail`/`save`/`runInTransaction`

- [ ] **Task 5 — Brancher use case dans `UseCasesProxyModule` + controller `POST /internal/customers`** (AC: #7)
  - [ ] 5.1 — Update `apps/identity-svc/src/infrastructure/usecases-proxy/usecases-proxy.module.ts` : ajouter provider `REGISTER_CUSTOMER_USECASES_PROXY` qui wire `RegisterCustomerUseCase` avec ses 4 ports (USER_PROFILE_REPOSITORY, KEYCLOAK_ADMIN, EMAIL_VERIFICATION_TOKEN_REPOSITORY, EVENT_PUBLISHER)
  - [ ] 5.2 — Créer `apps/identity-svc/src/infrastructure/http/controllers/customer.controller.ts` (cf. AC7) avec `@UseGuards(InternalServiceGuard)` + `@HttpCode(201)`
  - [ ] 5.3 — Créer `apps/identity-svc/src/infrastructure/http/guards/internal-service.guard.ts` (vérifie HMAC `X-Internal-Service-Token`)
  - [ ] 5.4 — Créer `apps/identity-svc/src/infrastructure/http/dtos/register-customer-input.dto.ts` (Zod-pipe wrapping `RegisterCustomerInputSchema` from `@tukio/contracts`)
  - [ ] 5.5 — Update `apps/identity-svc/src/infrastructure/http/http.module.ts` : ajouter `CustomerController` à `controllers`
  - [ ] 5.6 — Update `apps/identity-svc/.env.example` : ajouter `TUKIO_INTERNAL_SERVICE_SECRET=<32-byte-base64>`, `KEYCLOAK_CLIENT_SECRET_TUKIO_API=<from-Story-1.1>`, `PUBLIC_BASE_URL=http://localhost:3000`
  - [ ] 5.7 — Update `apps/identity-svc/src/infrastructure/config/environment-config.service.ts` : ajouter `getInternalServiceSecret()`, `getKeycloakAdminConfig()`, `getPublicBaseUrl()` (Zod-validated)
  - [ ] 5.8 — Tests E2E `apps/identity-svc/test/customer-register.e2e-spec.ts` (cf. AC7 fin — 7 cases)

- [ ] **Task 6 — Scaffolder gateway-api Pretre structure (si pas déjà fait)** (AC: #3, prerequisite)
  - [ ] 6.1 — Vérifier état `apps/gateway-api/src/` : si scaffolding minimal Story 0.1 sans Pretre → exécuter `bash infra/scripts/replicate-pretre-structure.sh --target=gateway-api` (Story 0.6 script). Si déjà Pretre → skip.
  - [ ] 6.2 — Customizer la structure répliquée pour BFF : domain léger (juste `domain/ports/<downstream-service>.port.ts`), pas d'aggregates métier (gateway-api ne possède pas de domain métier — il forwarde)
  - [ ] 6.3 — Wirer envelope ADR-014 : `ResponseEnvelopeInterceptor` + `EnvelopeExceptionFilter` globaux dans `apps/gateway-api/src/main.ts` (cohérent Story 0.6 AC10)
  - [ ] 6.4 — Wirer auth lib : `TukioAuthModule.forRoot({ keycloakUrl, realm:'tukio', clientId:'tukio-api', audience:'tukio-api', jwksRefreshIntervalMs:600_000 })` (Story 0.8 AC11) — public endpoints utiliseront `@Public()` decorator
  - [ ] 6.5 — Wirer CSRF + cookies + correlationId middlewares (Architecture lignes 681-686 + Story 0.7 correlationContext)

- [ ] **Task 7 — Implémenter gateway-api `POST /v1/auth/customer/register` + forwarder + throttler** (AC: #3, #4)
  - [ ] 7.1 — Installer `@nestjs/throttler` + `@nest-lab/throttler-storage-redis` (latest stable) : `pnpm --filter=gateway-api add @nestjs/throttler @nest-lab/throttler-storage-redis ioredis`
  - [ ] 7.2 — Créer `apps/gateway-api/src/domain/ports/identity-svc.port.ts` (interface IIdentitySvcClient + Symbol IDENTITY_SVC_CLIENT)
  - [ ] 7.3 — Créer `apps/gateway-api/src/usecases/register-customer.forwarder.ts` (wraps client call + error mapping)
  - [ ] 7.4 — Créer `apps/gateway-api/src/infrastructure/external/identity-svc/identity-svc.client.ts` (axios + axios-retry + HMAC X-Internal-Service-Token + correlation propagation)
  - [ ] 7.5 — Créer `apps/gateway-api/src/infrastructure/external/identity-svc/errors.ts` (`IdentitySvcConflictError`, `IdentitySvcValidationError`, `IdentitySvcUnreachableError`)
  - [ ] 7.6 — Créer `apps/gateway-api/src/infrastructure/http/controllers/auth-customer.controller.ts` (cf. AC3 squelette)
  - [ ] 7.7 — Créer `apps/gateway-api/src/infrastructure/http/utils/merge-acquisition.ts` (helper qui merge cookie tk_acq + body acquisition, first-touch wins)
  - [ ] 7.8 — Update `apps/gateway-api/src/app.module.ts` : ajouter `ThrottlerModule.forRootAsync({ useClass: ThrottlerStorageRedisService, ... })` (config Redis Upstash) + `APP_GUARD ThrottlerGuard` + import du module forwarder
  - [ ] 7.9 — Update `apps/gateway-api/.env.example` : ajouter `IDENTITY_SVC_URL=http://localhost:4001`, `TUKIO_INTERNAL_SERVICE_SECRET=...`, `REDIS_URL=redis://localhost:6379`, `THROTTLER_SENSITIVE_LIMIT=5`, `THROTTLER_SENSITIVE_TTL_MS=60000`
  - [ ] 7.10 — Tests E2E `apps/gateway-api/test/auth-customer-register.e2e-spec.ts` (cf. AC4 fin — 5+ cases : valid, invalid, conflict mock, rate-limit 6th, correlationId propagation)

- [ ] **Task 8 — Implémenter frontend sign-up form + acquisition tracking + middleware** (AC: #1, #8)
  - [ ] 8.1 — Créer `packages/api-client/src/hooks/use-acquisition-tracking.ts` (lit query params UTM + cookie tk_acq, retourne AcquisitionInput typed)
  - [ ] 8.2 — Créer `packages/api-client/src/hooks/use-register-customer.ts` (TanStack Query mutation hook qui POST /v1/auth/customer/register, types depuis @tukio/contracts)
  - [ ] 8.3 — Update `apps/public/src/middleware.ts` : ajouter logique cookie `tk_acq` (lecture UTM query params au 1ᵉʳ touch, set Domain=.tukio.one, first-touch wins)
  - [ ] 8.4 — Créer `apps/public/src/app/[locale]/auth/sign-up/page.tsx` (Server Component layout + dynamic import du Client Component form)
  - [ ] 8.5 — Créer `apps/public/src/features/auth/sign-up/components/SignUpForm.tsx` (Client Component, React Hook Form + Zod resolver, atomics @tukio/ui)
  - [ ] 8.6 — Créer `apps/public/src/features/auth/sign-up/services/sign-up.service.ts` (mutation handler + redirect post-submit)
  - [ ] 8.7 — Update `apps/public/messages/{fr,en}.json` : ajouter namespace `auth.signup.*` (~25 strings)
  - [ ] 8.8 — Créer `apps/customer/src/app/[locale]/auth/verify-email-required/page.tsx` (placeholder Story 1.2, finalisé Story 1.6)
  - [ ] 8.9 — Update `apps/customer/messages/{fr,en}.json` : ajouter namespace `auth.verifyEmailRequired.*`
  - [ ] 8.10 — Update `apps/customer/src/middleware.ts` : ajouter logique check `email_verified` claim JWT + redirect transactional paths (cf. AC8)
  - [ ] 8.11 — Update `packages/auth-client/src/hooks/use-auth.ts` (Story 0.8) : exposer `emailVerified: boolean` dans AuthState (lit `payload.email_verified`)

- [ ] **Task 9 — Tests Playwright e2e + axe-core + perf NFR48** (AC: #9)
  - [ ] 9.1 — Créer `apps/public/e2e/auth/customer-register.spec.ts` avec 9 tests (cf. AC9)
  - [ ] 9.2 — Setup fixture testcontainers : Keycloak avec realm `tukio` bootstrappé Story 1.1 + Postgres + identity-svc + gateway-api démarrés en docker-compose CI mode
  - [ ] 9.3 — Helper `setupTestUser` (`apps/public/e2e/helpers/test-user.ts`) : créer un user via Keycloak Admin API pour les tests qui ont besoin d'un compte préexistant (test 4 anti-énumération + test 7 FR17)
  - [ ] 9.4 — Helper `cleanupTestUsers` : supprimer tous les users créés en test post-suite (idempotence CI)
  - [ ] 9.5 — Run Playwright en CI (`.github/workflows/e2e.yml` UPDATE Story 0.11) : `pnpm --filter=apps/public test:e2e --project=chromium-fr --project=chromium-en`
  - [ ] 9.6 — Vérifier 0 violations axe-core critical/serious sur la page sign-up (FR + EN)
  - [ ] 9.7 — Vérifier perf NFR48 ≤ 30 s p90 (run 10 fois en CI, prendre p9)

- [ ] **Task 10 — Observability + runbook + ADR cohérence + commit** (AC: #10)
  - [ ] 10.1 — Ajouter métriques Prometheus dans gateway-api (`tukio_register_customer_attempts_total`, `tukio_register_customer_duration_seconds`) via `prom-client`
  - [ ] 10.2 — Ajouter métriques Prometheus dans identity-svc (`tukio_keycloak_admin_calls_total`, `tukio_register_customer_external_failures_total`)
  - [ ] 10.3 — Créer `infra/k8s/grafana-dashboards/identity-registration.json` (4 panels Grafana)
  - [ ] 10.4 — Créer `docs/runbook/customer-registration-debug.md` (~60 lignes : flow + troubleshooting + queries utiles)
  - [ ] 10.5 — Update `packages/contracts/README.md` : section "Identity events" avec schema + downstream consumers
  - [ ] 10.6 — Lint + typecheck + tests : `pnpm lint && pnpm typecheck && pnpm test --filter=...[origin/main]` à la racine — tous passent
  - [ ] 10.7 — Vérifier coverage : ≥ 90 % use case identity-svc, ≥ 80 % gateway-api endpoint, ≥ 80 % frontend form (NFR71)
  - [ ] 10.8 — Commit `feat(identity): customer B2C registration end-to-end (frontend sign-up form FR/EN + gateway-api throttled endpoint + identity-svc Pretre use case + Keycloak Admin API + UserProfile aggregate + 2 NATS events outbox + acquisition tracking + Playwright e2e)` — Story 1.2 done

## Dev Notes

### Pourquoi cette story est centrale dans Epic 1 — contexte stratégique

> **Sources canoniques** : `_bmad-output/planning-artifacts/architecture.md` §Cross-Cutting Auth (lignes 234-241) + §API Communication Patterns (lignes 710-720) + §API Response Format ADR-014 (lignes 1252-1505) + §Project Structure (lignes 1990-2241) ; `_bmad-output/planning-artifacts/prd.md` §FR1 (ligne 1103), §FR8, §FR17 + §NFR9-13, NFR48, NFR71 ; `_bmad-output/planning-artifacts/epics.md` §Story 1.2 (lignes 1100-1116) ; `_bmad-output/planning-artifacts/ux-design-specification.md` §UX-DR9 sign-up funnel + §FormField pattern (lignes 1479+) ; Story 0.6 (Pretre identity-svc + envelope ADR-014) + Story 0.7 (outbox NATS) + Story 0.8 (auth libs) + Story 0.13 (acquisition schema) + Story 1.1 (Keycloak realm + claims `tukio:locale`/`tukio:status`).

Story 1.1 a livré le **realm Keycloak provisionné** (5 rôles + 4 clients + Phasetwo + brute-force + themes). Story 0.8 a livré les **libs auth** (`@tukio/auth` backend + `@tukio/auth-client` frontend). Story 0.7 a livré le **messaging NATS + outbox**. Story 0.6 a posé l'**identity-svc Pretre + envelope ADR-014**. Story 1.2 est la **1ʳᵉ vraie story feature user-facing** d'Epic 1 :

- Elle **utilise** tous les Sprint 0 livrables : realm Keycloak Story 1.1 (Admin API + role `client` + claim `tukio:locale`), `@tukio/auth-client` Story 0.8 (hooks `useAuth`, `useRequireRole` à terme — pas direct Story 1.2 mais utilisation post-register), `@tukio/messaging` Story 0.7 (outbox publish events `identity.user.registered.v1` + `notification.email.send.v1`), Pretre identity-svc Story 0.6 (use case + ports + envelope ADR-014), acquisition schema Story 0.13 (6 colonnes UserProfile + cookie `tk_acq`), atomics `<FormField>`/`<Input>`/`<Button>` Story 0.4, design tokens Story 0.3.
- Elle **pose les patterns canoniques** pour Stories 1.3-1.9 + Epic 2-7 :
  - **Pattern "register" dans identity-svc** : factory `UserProfile.register*()` + use case `Register*UseCase` (Story 1.3 répliquera pour Pro avec INSEE SIRENE)
  - **Pattern "gateway-api forward"** : controller public + ZodValidationPipe + throttler + forwarder use case + HTTP client downstream (Stories 1.4-1.9 répliqueront)
  - **Pattern "outbox event publish atomique"** : `runInTransaction(async (txn) => { txn.repo.save(); txn.eventPublisher.publish(); })` (toutes les stories Epic 2-7 qui mutent un aggregate utiliseront ce pattern)
  - **Pattern "frontend form + Zod + acquisition"** : React Hook Form + Zod resolver depuis `@tukio/contracts` + `useAcquisitionTracking` hook (Stories 1.3 register Pro, 1.5 password reset, etc. répliqueront)
  - **Pattern "envelope ADR-014 + tukioCode error"** : forwarder map les erreurs downstream → exceptions domain → EnvelopeExceptionFilter wrap (toutes les Stories répliqueront)
  - **Pattern "anti-énumération NFR9"** : message API distinct (`tukioCode`) vs message UI générique (Stories 1.4 login, 1.5 password reset, 1.7 admin TOTP répliqueront)

> **Story 1.2 = template features user-facing.** Le dev agent qui implémente Story 1.2 doit penser "ce code servira de référence à 9 stories suivantes — le mettre proprement, le tester, le documenter, sera amorti 10x".

### Décisions techniques majeures (à acter dans Story 1.2)

1. **Keycloak gère le password hashing nativement** (pas de port `IPasswordHasher` dans identity-svc). Justification : Keycloak Admin API `users.create({ credentials: [{ type: 'password', value: '<plain>', temporary: false }] })` hash automatiquement avec l'algorithme configuré realm-level (`pbkdf2-sha256` default Keycloak 26 ; Argon2id activable Story 1.1+ via `passwordPolicy` realm — recommandé V1+). Le password en clair transite via HTTPS/TLS uniquement (NFR9), jamais stocké côté identity-svc, jamais loggé (PII redaction NFR16). **Aucune colonne `password_hash` dans `user_profiles`.**
2. **Library Keycloak Admin** : `@keycloak/keycloak-admin-client` (latest stable, official Keycloak npm package, TypeScript-first). Alternative directe via axios rejetée — l'official package gère token refresh, retry, type-safety natifs.
3. **Compensation pattern Keycloak ↔ DB** : si la transaction DB rollback après Keycloak user créé, `keycloakAdmin.deleteUser(keycloakUserId)` est appelé en rollback compensation (ligne 380+ AC5 use case). En cas d'échec de la compensation (Keycloak DOWN au moment du rollback), un **drift R8** apparaît : Keycloak a un user, identity-svc DB n'a rien. **Mitigation** : job de réconciliation quotidien Story 1.10 + alerte Prom `tukio_keycloak_orphan_users_total > 0`. **Ce drift est acceptable** au MVP car rare (DB rollback rare + Keycloak deleteUser rare-de-rare).
4. **Pas de Saga distribuée pour register** : la "saga" register customer est entièrement contenue dans **une seule transaction TypeORM atomique** côté identity-svc (DB + outbox events). Le call Keycloak Admin précède la transaction (compensation manuelle). Pas de saga choréographée NATS ici — les events sont des **side-effects post-commit** (notification-svc consume async). Justification : pas de coordination cross-service nécessaire au register (vs booking saga Epic 4 qui doit synchroniser booking-svc + order-svc + payment-svc).
5. **2 events publiés** :
   - `identity.user.registered.v1` (business event, consommé par analytics-svc V1, identity-svc reconciliation, future referral rewards Story 11.3)
   - `notification.email.send.v1` (technical event, consommé par notification-svc Story 5.4 → Resend send mail)
   - **Justification 2 events distincts** : separation of concerns (1 business + 1 technical infra). Permet de désactiver/retarder l'email (e.g. compliance check) sans toucher au business event. Cohérent avec Architecture ligne 633 ("Webhooks externes : un seul endpoint par fournisseur, transformation en events NATS internes" — pattern similaire ici).
6. **Verify token custom (UUID v4) stocké dans DB identity-svc** (pas Keycloak `Required Action: VERIFY_EMAIL`). Justification : (a) full control sur expiration (7 jours configurable), (b) full control sur templates email FR/EN (Resend via notification-svc, pas Keycloak SMTP), (c) cohérent avec Story 1.1 Dev Notes décision de désactiver Keycloak SMTP au profit de Resend. **Story 1.6 finalise le flow** : landing page + endpoint `POST /v1/auth/email/verify` qui valide le token + set `email_verified=true` dans Keycloak via Admin API.
7. **gateway-api Pretre structure légère** : pas d'aggregates métier (BFF — just forward), juste `domain/ports/<svc>.port.ts` + `usecases/<action>.forwarder.ts` + `infrastructure/external/<svc>/<svc>.client.ts`. Documenté dans `apps/gateway-api/README.md` (Task 6.1).
8. **Endpoint `/internal/customers` non exposé publiquement** : K8s NetworkPolicy (Story 0.12) whitelist `gateway-api → identity-svc:4001` uniquement. Pas de chemin externe `gateway-api → /internal/*`. MVP : protection logicielle via `InternalServiceGuard` HMAC. V1+ : mTLS K8s + service mesh Linkerd (NFR10).
9. **Rate-limiting Redis-backed** : `@nestjs/throttler` + `@nest-lab/throttler-storage-redis` connecté à Upstash Redis (Story 0.10 Redis container local, Upstash prod). Permet rate-limit cross-replicas en prod K8s (3+ pods gateway-api). 5/min/IP est strict pour register (NFR10), pas pour endpoints standards (60/min anonymous, 600/min authenticated — Architecture ligne 703-708).
10. **First-touch acquisition wins (cookie `tk_acq`)** : si le user landed sur tukio.one avec UTM `?utm_source=google_ads` puis revient organic 3 jours plus tard pour s'inscrire, son `acquisition_source` est `google_ads` (first-touch). Cohérent K-04 acquisition retro-fit impossible. Multi-touch attribution V1 (Story 7.5) raffine avec `last_touch` distinct de `first_touch`.
11. **i18n strict frontend** (memory `feedback_i18n_frontend.md`) : zéro string hardcodé. Tout via `useTranslations` next-intl + `messages/{fr,en}.json`. Validation Zod messages d'erreur sont **codes** (`'invalid_string'`) côté contracts, et le frontend les traduit via map `errorCode → t('auth.signup.errors.<code>')`.
12. **EN strict couche tech** (memory `feedback_tech_layer_english.md`) : noms TS/DB/API/events EN — `RegisterCustomerInput`, `tukio_status`, `/v1/auth/customer/register`, `identity.user.registered.v1`. UI labels FR/EN selon locale.

### Versions à utiliser (latest stable au moment d'Epic 1)

| Lib | Rôle | Version cible | Notes |
|---|---|---|---|
| **`@keycloak/keycloak-admin-client`** | Keycloak Admin API typed (identity-svc) | latest stable bundle Keycloak 26 | `pnpm view @keycloak/keycloak-admin-client version` au moment du dev |
| **`@nestjs/throttler`** | Rate limiting (gateway-api) | latest stable (6.x) | Decorator-based, supporte Redis storage |
| **`@nest-lab/throttler-storage-redis`** | Storage Redis pour throttler | latest stable | Cohérent Upstash Redis Story 0.10 |
| **`ioredis`** | Client Redis Node | latest stable (5.x) | Wrapped par throttler-storage-redis |
| **`axios`** | HTTP client gateway-api → identity-svc | latest stable (1.x) | Déjà standard backend |
| **`axios-retry`** | Retry exponential backoff axios | latest stable | Pour idempotency forward retries |
| **`zod`** | Validation schemas (frontend + backend) | latest stable (3.x) | Déjà figé Story 0.2 |
| **`nestjs-zod`** | Zod ↔ NestJS pipe | latest stable | Déjà figé Story 0.6 |
| **`react-hook-form`** | Form state (frontend) | latest stable (7.x) | Déjà figé Story 0.5 patterns |
| **`@hookform/resolvers/zod`** | RHF + Zod resolver | latest stable | Pairing standard |
| **`@playwright/test`** | E2E tests | latest stable | Déjà figé Story 0.9 |
| **`@axe-core/playwright`** | Accessibility tests | latest stable | Déjà figé Story 0.13 lint |
| **`@tukio/contracts`** | DTOs + events (workspace) | workspace:* | Story 0.2 + Story 1.2 ajout DTO register-customer + 2 events JSON Schema |
| **`@tukio/messaging`** | Outbox publish (identity-svc) | workspace:* | Story 0.7 |
| **`@tukio/auth`** | Auth backend libs (gateway-api + identity-svc) | workspace:* | Story 0.8 — `KeycloakJwtGuard` + `RolesGuard` (Story 1.2 utilise `@Public()` car endpoint register est public) |
| **`@tukio/ui`** | Atomics + patterns frontend | workspace:* | Story 0.4 + 0.5 — `<FormField>`, `<Input>`, `<Button>`, `<Checkbox>`, `<EmptyState>` |
| **`@tukio/api-client`** | TanStack Query hooks | workspace:* | Story 0.9 + Story 1.2 ajout `useRegisterCustomer` + `useAcquisitionTracking` |

### Project Structure cible (fichiers créés/modifiés Story 1.2)

```
packages/contracts/src/
├─ dtos/identity/
│  ├─ register-customer.dto.ts                    # NEW Story 1.2 — Zod schemas
│  └─ acquisition.dto.ts                          # NEW Story 1.2 — réutilisable Stories 1.3, 4.x
├─ events/identity/
│  ├─ user-registered.v1.schema.json              # NEW Story 1.2 — JSON Schema
│  └─ user-registered.v1.ts                       # NEW Story 1.2 — types TS dérivés
├─ events/notification/
│  ├─ email-send.v1.schema.json                   # NEW Story 1.2 — réutilisable
│  └─ email-send.v1.ts                            # NEW Story 1.2
└─ types/error-codes.ts                           # UPDATE Story 1.2 — ajouter IdentityErrorCodes

apps/identity-svc/src/
├─ domain/
│  ├─ model/
│  │  ├─ user-profile.aggregate.ts                # UPDATE — factory register() + 8 fields
│  │  └─ value-objects/
│  │     ├─ email.value-object.ts                 # UPDATE Story 1.2 — RFC 5322 validation
│  │     ├─ locale.value-object.ts                # NEW Story 1.2
│  │     └─ acquisition-source.value-object.ts    # NEW Story 1.2
│  ├─ ports/
│  │  ├─ user-profile.repository.port.ts          # UPDATE — findByEmail + save + runInTransaction
│  │  ├─ keycloak-admin.port.ts                   # NEW Story 1.2
│  │  └─ email-verification-token-repository.port.ts # NEW Story 1.2
│  └─ exception/
│     ├─ identity-conflict.exception.ts           # NEW Story 1.2
│     └─ external-service.exception.ts            # NEW Story 1.2
├─ usecases/
│  ├─ register-customer.usecase.ts                # NEW Story 1.2
│  └─ register-customer.usecase.spec.ts           # NEW Story 1.2 — 7+ tests
└─ infrastructure/
   ├─ external/keycloak/
   │  ├─ keycloak-admin.service.ts                # NEW Story 1.2 (replace Story 0.6 placeholder)
   │  ├─ keycloak-admin.module.ts                 # NEW Story 1.2
   │  └─ errors.ts                                # NEW Story 1.2
   ├─ persistence/typeorm/
   │  ├─ entities/
   │  │  ├─ user-profile.entity.ts                # UPDATE — 6 nouvelles colonnes
   │  │  └─ email-verification-token.entity.ts    # NEW Story 1.2
   │  ├─ repositories/
   │  │  ├─ user-profile.typeorm.repository.ts    # UPDATE — findByEmail + save + runInTransaction
   │  │  └─ email-verification-token.typeorm.repository.ts # NEW Story 1.2
   │  └─ migrations/
   │     └─ 1715230000000-AddCustomerRegistrationFields.ts # NEW Story 1.2
   ├─ http/
   │  ├─ controllers/
   │  │  └─ customer.controller.ts                # NEW Story 1.2
   │  ├─ dtos/
   │  │  └─ register-customer-input.dto.ts        # NEW Story 1.2
   │  └─ guards/
   │     └─ internal-service.guard.ts             # NEW Story 1.2
   └─ usecases-proxy/
      └─ usecases-proxy.module.ts                 # UPDATE — ajouter REGISTER_CUSTOMER_USECASES_PROXY

apps/gateway-api/src/                              # ← scaffolding Pretre Story 1.2 (si pas déjà fait Story 0.6 replicate)
├─ main.ts                                         # bootstrap Fastify + envelope interceptor + filter
├─ app.module.ts                                   # ThrottlerModule + TukioAuthModule + UseCasesProxyModule
├─ domain/
│  └─ ports/
│     └─ identity-svc.port.ts                     # NEW Story 1.2
├─ usecases/
│  └─ register-customer.forwarder.ts              # NEW Story 1.2
└─ infrastructure/
   ├─ external/identity-svc/
   │  ├─ identity-svc.client.ts                   # NEW Story 1.2
   │  ├─ identity-svc.module.ts                   # NEW Story 1.2
   │  └─ errors.ts                                # NEW Story 1.2
   ├─ http/
   │  ├─ controllers/
   │  │  └─ auth-customer.controller.ts           # NEW Story 1.2
   │  └─ utils/
   │     └─ merge-acquisition.ts                  # NEW Story 1.2
   └─ usecases-proxy/
      └─ usecases-proxy.module.ts                 # NEW Story 1.2 (gateway-api scaffold)

apps/public/src/
├─ middleware.ts                                   # UPDATE — cookie tk_acq logic
├─ app/[locale]/auth/sign-up/
│  └─ page.tsx                                     # NEW Story 1.2
├─ features/auth/sign-up/
│  ├─ components/
│  │  └─ SignUpForm.tsx                            # NEW Story 1.2
│  ├─ services/
│  │  └─ sign-up.service.ts                        # NEW Story 1.2
│  └─ index.ts                                     # NEW Story 1.2
├─ messages/{fr,en}.json                           # UPDATE — namespace auth.signup.*
└─ e2e/auth/
   └─ customer-register.spec.ts                    # NEW Story 1.2

apps/customer/src/
├─ middleware.ts                                   # UPDATE — check email_verified pour /cart, /account/bookings/checkout
├─ app/[locale]/auth/verify-email-required/
│  └─ page.tsx                                     # NEW Story 1.2 (placeholder, finalisé Story 1.6)
└─ messages/{fr,en}.json                           # UPDATE — namespace auth.verifyEmailRequired.*

packages/api-client/src/hooks/
├─ use-acquisition-tracking.ts                     # NEW Story 1.2
└─ identity/
   └─ use-register-customer.ts                     # NEW Story 1.2

packages/auth-client/src/hooks/
└─ use-auth.ts                                     # UPDATE Story 1.2 — exposer emailVerified

infra/k8s/grafana-dashboards/
└─ identity-registration.json                      # NEW Story 1.2 — 4 panels

docs/runbook/
└─ customer-registration-debug.md                  # NEW Story 1.2

packages/contracts/README.md                       # UPDATE — section "Identity events"

# Estimation total fichiers : ~50-55 nouveaux + ~15 updates
```

### Pattern code — `RegisterCustomerUseCase` (squelette complet annotated)

```ts
// apps/identity-svc/src/usecases/register-customer.usecase.ts
import { Injectable, Inject } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  USER_PROFILE_REPOSITORY,
  KEYCLOAK_ADMIN,
  EMAIL_VERIFICATION_TOKEN_REPOSITORY,
  EVENT_PUBLISHER,
  CONFIG_SERVICE,
} from '../domain/ports/tokens';
import type { IUserProfileRepository } from '../domain/ports/user-profile.repository.port';
import type { IKeycloakAdmin } from '../domain/ports/keycloak-admin.port';
import type { IEmailVerificationTokenRepository } from '../domain/ports/email-verification-token-repository.port';
import type { IEventPublisher } from '../domain/ports/event-publisher.port';
import type { IConfigService } from '../domain/ports/config.port';
import { UserProfile } from '../domain/model/user-profile.aggregate';
import { Email } from '../domain/model/value-objects/email.value-object';
import { IdentityConflictException } from '../domain/exception/identity-conflict.exception';
import { ExternalServiceException } from '../domain/exception/external-service.exception';
import { KeycloakUserAlreadyExistsError, KeycloakUnreachableError } from '../infrastructure/external/keycloak/errors';
import type { RegisterCustomerInput, AcquisitionInput } from '@tukio/contracts/dtos/identity';

@Injectable()
export class RegisterCustomerUseCase {
  constructor(
    @Inject(USER_PROFILE_REPOSITORY) private readonly userProfileRepo: IUserProfileRepository,
    @Inject(KEYCLOAK_ADMIN) private readonly keycloakAdmin: IKeycloakAdmin,
    @Inject(EMAIL_VERIFICATION_TOKEN_REPOSITORY) private readonly tokenRepo: IEmailVerificationTokenRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: IEventPublisher,
    @Inject(CONFIG_SERVICE) private readonly config: IConfigService,
  ) {}

  async execute(input: RegisterCustomerInput & { acquisition: AcquisitionInput }): Promise<{ userId: string; requiresEmailVerification: true }> {
    // 1. Pré-check email pas déjà utilisé en DB locale
    const existing = await this.userProfileRepo.findByEmail(input.email);
    if (existing) {
      throw new IdentityConflictException('IDENTITY-CONFLICT-001', 'Email already registered');
    }

    // 2. Création Keycloak user (rôle 'client', email_verified=false, status='active')
    let keycloakUserId: string;
    try {
      const result = await this.keycloakAdmin.createUser({
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        password: input.password,
        locale: input.locale,
        emailVerified: false,
        role: 'client',
        status: 'active',
      });
      keycloakUserId = result.keycloakUserId;
    } catch (e) {
      if (e instanceof KeycloakUserAlreadyExistsError) {
        throw new IdentityConflictException('IDENTITY-CONFLICT-001', 'Email already registered');
      }
      if (e instanceof KeycloakUnreachableError) {
        throw new ExternalServiceException('IDENTITY-EXTERNAL-001', 'Keycloak unreachable');
      }
      throw e;
    }

    try {
      // 3. Build aggregate via factory (invariants validés)
      const userProfile = UserProfile.register({
        keycloakUserId,
        email: Email.of(input.email),
        firstName: input.firstName,
        lastName: input.lastName,
        locale: input.locale,
        role: 'client',
        status: 'active',
        marketingOptIn: input.acceptMarketing ?? false,
        acquisition: input.acquisition,
      });

      // 4. Verify token (UUID v4, expiry 7 jours)
      const verifyToken = randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      // 5. Atomic transaction : aggregate save + token save + 2 outbox events publish
      await this.userProfileRepo.runInTransaction(async (txn) => {
        await txn.userProfileRepo.save(userProfile);
        await txn.tokenRepo.save({ token: verifyToken, userId: userProfile.id, expiresAt });
        await txn.eventPublisher.publish({
          eventId: randomUUID(),
          eventType: 'identity.user.registered',
          eventVersion: 'v1',
          occurredAt: new Date().toISOString(),
          aggregate: { type: 'UserProfile', id: userProfile.id },
          actor: { userId: userProfile.id, role: 'client' },
          payload: {
            userId: userProfile.id,
            email: userProfile.email.value,
            firstName: userProfile.firstName,
            lastName: userProfile.lastName,
            role: 'client',
            locale: userProfile.locale,
            acquisitionSource: userProfile.acquisitionSource,
            acquisitionMedium: userProfile.acquisitionMedium,
            acquisitionCampaign: userProfile.acquisitionCampaign,
            acquisitionReferralId: userProfile.acquisitionReferralId,
            marketingOptIn: userProfile.marketingOptIn,
            registeredAt: userProfile.createdAt.toISOString(),
          },
        });
        await txn.eventPublisher.publish({
          eventId: randomUUID(),
          eventType: 'notification.email.send',
          eventVersion: 'v1',
          occurredAt: new Date().toISOString(),
          aggregate: { type: 'UserProfile', id: userProfile.id },
          actor: { userId: 'system', role: 'system' },
          payload: {
            templateId: 'email-verify',
            locale: userProfile.locale,
            to: { email: userProfile.email.value, userId: userProfile.id, name: `${userProfile.firstName} ${userProfile.lastName}` },
            params: {
              firstName: userProfile.firstName,
              verifyUrl: `${this.config.getPublicBaseUrl()}/${userProfile.locale}/auth/email/verify?token=${verifyToken}`,
              expiresAt: expiresAt.toISOString(),
            },
          },
        });
      });

      return { userId: userProfile.id, requiresEmailVerification: true };
    } catch (e) {
      // Rollback Keycloak user (compensation pattern — drift R8 mitigation)
      await this.keycloakAdmin.deleteUser(keycloakUserId).catch((rollbackErr) => {
        // Drift accepté MVP — réconciliation Story 1.10 daily job
        // Log + alert Prom counter tukio_keycloak_orphan_users_total
      });
      throw e;
    }
  }
}
```

### Pattern code — `SignUpForm.tsx` (squelette complet annotated)

```tsx
// apps/public/src/features/auth/sign-up/components/SignUpForm.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, FormField, Input, Checkbox } from '@tukio/ui';
import { useRegisterCustomer } from '@tukio/api-client/hooks/identity';
import { useAcquisitionTracking } from '@tukio/api-client/hooks';
import { RegisterCustomerInputSchema, type RegisterCustomerInput } from '@tukio/contracts/dtos/identity';

export function SignUpForm() {
  const t = useTranslations('auth.signup');
  const locale = useLocale() as 'fr' | 'en';
  const router = useRouter();
  const acquisition = useAcquisitionTracking();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<RegisterCustomerInput>({
    resolver: zodResolver(RegisterCustomerInputSchema),
    defaultValues: {
      email: '',
      password: '',
      firstName: '',
      lastName: '',
      locale,
      acceptTerms: false,
      acceptMarketing: false,
    },
    mode: 'onBlur',
  });

  const registerMutation = useRegisterCustomer({
    onSuccess: () => {
      router.push(`/${locale}/auth/sign-up/success`);
    },
    onError: (err) => {
      // Anti-énumération NFR9 : si tukioCode === 'IDENTITY-CONFLICT-001', afficher message générique
      if (err.tukioCode === 'IDENTITY-CONFLICT-001') {
        setSubmitError(t('errors.genericConflict'));
      } else if (err.tukioCode === 'RATE-LIMIT-EXCEEDED-001') {
        setSubmitError(t('errors.rateLimit', { seconds: err.retryAfter ?? 60 }));
      } else if (err.tukioCode === 'VALIDATION-FAILED-001') {
        // Map Zod issues → FormField errors via setError (RHF API)
        err.issues?.forEach((issue) => form.setError(issue.path[0] as keyof RegisterCustomerInput, { message: t(`errors.${issue.code}`) }));
      } else {
        setSubmitError(t('errors.generic'));
      }
    },
  });

  const onSubmit = (data: RegisterCustomerInput) => {
    setSubmitError(null);
    registerMutation.mutate({ ...data, acquisition });
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} aria-label={t('formAriaLabel')} noValidate>
      <FormField
        label={t('fields.email.label')}
        helper={t('fields.email.helper')}
        error={form.formState.errors.email?.message}
        required
      >
        <Input type="email" autoComplete="email" {...form.register('email')} />
      </FormField>
      <FormField
        label={t('fields.password.label')}
        helper={t('fields.password.helper')}
        error={form.formState.errors.password?.message}
        required
      >
        <Input type="password" autoComplete="new-password" {...form.register('password')} />
      </FormField>
      <FormField
        label={t('fields.firstName.label')}
        error={form.formState.errors.firstName?.message}
        required
      >
        <Input type="text" autoComplete="given-name" {...form.register('firstName')} />
      </FormField>
      <FormField
        label={t('fields.lastName.label')}
        error={form.formState.errors.lastName?.message}
        required
      >
        <Input type="text" autoComplete="family-name" {...form.register('lastName')} />
      </FormField>
      <Checkbox label={t('fields.acceptTerms.label')} required {...form.register('acceptTerms')} />
      <Checkbox label={t('fields.acceptMarketing.label')} {...form.register('acceptMarketing')} />
      {submitError && <p role="alert" className="text-error-700">{submitError}</p>}
      <Button type="submit" variant="primary" size="lg" disabled={!form.formState.isValid || registerMutation.isPending}>
        {registerMutation.isPending ? t('cta.submitting') : t('cta.submit')}
      </Button>
    </form>
  );
}
```

### Critical Architecture Constraints (rappel non-négociable)

> Cf. Architecture lignes 234-241 + 665-697 + 1252-1505 + 1731-1738 + Story 0.6 + Story 0.7 + Story 0.8 + Story 0.13 + Story 1.1 + memories `feedback_clean_architecture_explicit.md`, `feedback_api_envelope_response.md`, `feedback_tech_layer_english.md`, `feedback_i18n_frontend.md`.

1. **Pattern Pretre strict** : `domain/` zéro dépendance externe (eslint-plugin-boundaries enforce — Story 0.6 AC8). Use cases dépendent uniquement des ports (interfaces). Implémentations concrètes dans `infrastructure/`.
2. **Symbol DI tokens SCREAMING_SNAKE_CASE** (Story 0.6 AC3) : `KEYCLOAK_ADMIN`, `EMAIL_VERIFICATION_TOKEN_REPOSITORY`, etc.
3. **Envelope ADR-014** : controllers retournent DTO nu, l'interceptor wrap automatiquement (Story 0.6 AC10). EnvelopeExceptionFilter wrap les exceptions.
4. **Outbox transactional atomicity** : tous les events publiés dans la même transaction TypeORM que la mutation aggregate (Story 0.7 AC3). `runInTransaction` helper exposé sur repository.
5. **Anti-énumération NFR9** : message API distinct (`IDENTITY-CONFLICT-001`) vs UI générique. Frontend mappe.
6. **HTTPS/TLS exclusif** (NFR9) : password en clair transite via TLS uniquement, jamais loggé (PII redaction NFR16).
7. **Rate-limiting Redis-backed** (NFR10) : 5/min/IP sur endpoints sensibles, cohérent Architecture ligne 707.
8. **Acquisition first-touch wins** (K-04 Story 0.13) : cookie `tk_acq` + body acquisition merged côté gateway-api, persistence dans `user_profiles.acquisition_*`.
9. **Compensation pattern Keycloak ↔ DB** : `keycloakAdmin.deleteUser` en rollback si DB save fail post-Keycloak. Drift R8 mitigation Story 1.10 reconciliation.
10. **i18n strict** (memory `feedback_i18n_frontend.md`) : zéro hardcoded UI string, FR + EN dès maintenant.
11. **EN strict couche tech** (memory `feedback_tech_layer_english.md`) : code/DB/API/events EN. UI labels FR/EN selon locale.
12. **Email password Keycloak natif** : pas de port `IPasswordHasher` côté identity-svc (cf. Décisions techniques §1).

### Previous Story Intelligence

**Story 0.2** (`@tukio/contracts`) : envelope types + DomainEvent type + `Actor` type + build pipeline JSON Schema → TS. Story 1.2 ajoute :
- DTOs identity (`register-customer.dto.ts` + `acquisition.dto.ts`)
- 2 events JSON Schemas (`user-registered.v1` + `email-send.v1`) + types TS générés
- IdentityErrorCodes const (10+ codes prêts pour Stories 1.x)

**Story 0.6** (Pretre identity-svc + envelope) : aggregate `UserProfile` posé (factory `register()` à ajouter Story 1.2), `ResponseEnvelopeInterceptor` + `EnvelopeExceptionFilter` globaux dans main.ts (cohérent ADR-014), `UseCasesProxyModule.register()` central (Story 1.2 ajoute provider `REGISTER_CUSTOMER_USECASES_PROXY`), `eslint-plugin-boundaries` strict, migration baseline `1715200000000-CreateUserProfilesBaseline.ts` (Story 1.2 ajoute migration `1715230000000-AddCustomerRegistrationFields.ts`). `EnvironmentConfigService` Zod-validated → ajouter `getInternalServiceSecret`, `getKeycloakAdminConfig`, `getPublicBaseUrl`. `DomainException` base class extended par `IdentityConflictException` + `ExternalServiceException` Story 1.2.

**Story 0.7** (`@tukio/messaging` outbox) : `OutboxPublisher` (`IEventPublisher` impl) attaché à la transaction TypeORM (cohérent avec `runInTransaction` Story 1.2). `OutboxRelayService` PG LISTEN/NOTIFY publie vers NATS. Story 1.2 utilise directement (pas de modif lib) — le use case appelle `eventPublisher.publish` 2x dans la même transaction, et l'outbox-relay les pousse vers NATS asynchrone. `correlationContext` AsyncLocalStorage propagé via Story 0.7 middleware.

**Story 0.8** (`@tukio/auth` + `@tukio/auth-client`) : `KeycloakJwtGuard` global avec `@Public()` opt-out (Story 1.2 endpoint `/v1/auth/customer/register` est `@Public()` — pas authentifié). `<AuthProvider>` Context + hooks `useAuth` (Story 1.2 update : exposer `emailVerified` dans AuthState). `KeycloakAuthMiddleware` Next.js (Story 1.2 update apps/customer middleware pour redirect verify-email-required). `@RequireMfa()` non utilisé Story 1.2.

**Story 0.13** (acquisition schema + ADRs) : 6 colonnes `acquisition_*` ajoutées sur `user_profiles` table via migration `<ts>-AddAcquisitionColumns.ts`. **Story 1.2 utilise** ces colonnes via le use case `RegisterCustomerUseCase` (factory `UserProfile.register({ acquisition })`). Cookie `tk_acq` set par middleware gateway-api préparé Story 0.13, **finalisé Story 1.2** dans `apps/public/src/middleware.ts`. ADR-014 envelope canonique référencée Story 1.2.

**Story 1.1** (Keycloak realm) : realm `tukio` + 5 rôles + 4 clients + claims `tukio:locale` + `tukio:status` + brute-force + themes. **Story 1.2 utilise** : `tukio-api` confidential client pour service-account auth (`KeycloakAdminService` Story 1.2), rôle `client` assigné au user créé, claims `tukio:locale` set via user attributes Keycloak (mapper Story 1.1 AC4 émet le claim dans JWT), `tukio:status='active'` set via attributes (cohérent Story 1.1 AC4). Le realm-export `tukio.realm.json` Story 1.1 sert de source-of-truth (pas modifié Story 1.2).

### What this story does NOT do (out of scope)

- ❌ **Pro registration `pending_admin_review` + INSEE SIRENE** → Story 1.3
- ❌ **Login flow Keycloak Authorization Code + PKCE** → Story 1.4 (Story 1.2 ne touche pas le login)
- ❌ **Password reset flow** → Story 1.5
- ❌ **Email verification landing page + endpoint POST /v1/auth/email/verify** → Story 1.6 (Story 1.2 publie le NATS event qui DECLENCHERA l'envoi email mais ne traite pas le clic du lien)
- ❌ **Admin TOTP setup wizard** → Story 1.7
- ❌ **Profile management `GET /v1/me` + `PATCH /v1/me`** → Story 1.8
- ❌ **Account deletion soft-delete RGPD** → Story 1.9
- ❌ **identity-svc full Pretre consolidation (consolidation use cases + tests + reconciliation)** → Story 1.10 (Story 1.2 pose le 1er use case, Story 1.10 ajoute les autres + le reconciliation job R8)
- ❌ **notification-svc Resend send mail** → Story 5.4 (Story 1.2 publie `notification.email.send.v1` mais ne consume pas — l'email réel est envoyé Story 5.4 qui scaffolde notification-svc + Resend SDK)
- ❌ **Login social Google + Apple** → V1 FR5
- ❌ **B2B Customer Account avec SIRET** → V1 FR2 (Epic 8)
- ❌ **In-app notification feed real-time SSE** → V1 Epic 11 (Story 1.2 utilise email transactional uniquement)
- ❌ **Conversion compte client → Pro** → V1 FR13
- ❌ **Funnel analytics PostHog detailed events** → V1 Epic 7 Story 7.4 (Story 1.2 émet juste `identity.user.registered.v1` qui sera consommé V1)
- ❌ **CSRF token generation côté gateway-api** → préparé Story 0.8 mais wired Stories Epic 1+ post-1.2 (Story 1.4 login finalise CSRF flow)

### Files to UPDATE vs CREATE

> **À UPDATE** :
> - `packages/contracts/src/types/error-codes.ts` — ajouter IdentityErrorCodes
> - `packages/contracts/src/index.ts` — barrel + subpath exports
> - `packages/contracts/README.md` — section Identity events
> - `packages/api-client/src/hooks/index.ts` — barrel ajouter use-acquisition-tracking + identity hooks
> - `packages/auth-client/src/hooks/use-auth.ts` (Story 0.8) — exposer emailVerified
> - `apps/identity-svc/src/domain/model/user-profile.aggregate.ts` (Story 0.6) — factory register() + 8 fields
> - `apps/identity-svc/src/domain/model/value-objects/email.value-object.ts` (Story 0.6) — RFC 5322 validation
> - `apps/identity-svc/src/domain/ports/user-profile.repository.port.ts` (Story 0.6) — findByEmail/save/runInTransaction
> - `apps/identity-svc/src/infrastructure/persistence/typeorm/entities/user-profile.entity.ts` (Story 0.6) — 6 colonnes
> - `apps/identity-svc/src/infrastructure/persistence/typeorm/repositories/user-profile.typeorm.repository.ts` (Story 0.6) — méthodes ajoutées
> - `apps/identity-svc/src/infrastructure/persistence/typeorm/data-source.ts` (Story 0.6) — entities array
> - `apps/identity-svc/src/infrastructure/external/keycloak/keycloak.service.ts` (Story 0.6 placeholder) — replace par KeycloakAdminService impl
> - `apps/identity-svc/src/infrastructure/usecases-proxy/usecases-proxy.module.ts` (Story 0.6) — ajouter REGISTER_CUSTOMER_USECASES_PROXY
> - `apps/identity-svc/src/infrastructure/http/http.module.ts` (Story 0.6) — ajouter CustomerController
> - `apps/identity-svc/src/infrastructure/config/environment-config.service.ts` (Story 0.6) — 3 nouveaux getters
> - `apps/identity-svc/.env.example` (Story 0.6) — 3 nouveaux env vars
> - `apps/gateway-api/src/main.ts` (Story 0.1 ou 0.6 replicate) — interceptor + filter + ThrottlerModule wired
> - `apps/gateway-api/src/app.module.ts` (Story 0.1) — ThrottlerModule + TukioAuthModule wired
> - `apps/gateway-api/.env.example` — IDENTITY_SVC_URL + TUKIO_INTERNAL_SERVICE_SECRET + REDIS_URL + throttler config
> - `apps/public/src/middleware.ts` (Story 0.9 next-intl) — cookie tk_acq logic
> - `apps/public/messages/{fr,en}.json` (Story 0.9) — namespace auth.signup.*
> - `apps/customer/src/middleware.ts` (Story 0.8) — check email_verified pour transactional paths
> - `apps/customer/messages/{fr,en}.json` (Story 0.9) — namespace auth.verifyEmailRequired.*

> **À CREATE** :
> - `packages/contracts/src/dtos/identity/{register-customer,acquisition}.dto.ts` (2)
> - `packages/contracts/src/events/identity/user-registered.v1.{schema.json,ts}` (2)
> - `packages/contracts/src/events/notification/email-send.v1.{schema.json,ts}` (2)
> - `apps/identity-svc/src/domain/model/value-objects/{locale,acquisition-source}.value-object.ts` (2)
> - `apps/identity-svc/src/domain/ports/{keycloak-admin,email-verification-token-repository}.port.ts` (2)
> - `apps/identity-svc/src/domain/exception/{identity-conflict,external-service}.exception.ts` (2)
> - `apps/identity-svc/src/usecases/register-customer.usecase.{ts,spec.ts}` (2)
> - `apps/identity-svc/src/infrastructure/external/keycloak/{keycloak-admin.service.ts,keycloak-admin.module.ts,errors.ts}` (3)
> - `apps/identity-svc/src/infrastructure/persistence/typeorm/entities/email-verification-token.entity.ts` (1)
> - `apps/identity-svc/src/infrastructure/persistence/typeorm/repositories/email-verification-token.typeorm.repository.ts` (1)
> - `apps/identity-svc/src/infrastructure/persistence/typeorm/migrations/1715230000000-AddCustomerRegistrationFields.ts` (1)
> - `apps/identity-svc/src/infrastructure/http/{controllers/customer.controller.ts,dtos/register-customer-input.dto.ts,guards/internal-service.guard.ts}` (3)
> - `apps/identity-svc/test/customer-register.e2e-spec.ts` (1)
> - `apps/gateway-api/src/{domain/ports/identity-svc.port.ts,usecases/register-customer.forwarder.ts,infrastructure/external/identity-svc/*,infrastructure/http/controllers/auth-customer.controller.ts,infrastructure/http/utils/merge-acquisition.ts}` (~7)
> - `apps/gateway-api/test/auth-customer-register.e2e-spec.ts` (1)
> - `apps/public/src/app/[locale]/auth/sign-up/page.tsx` (1)
> - `apps/public/src/features/auth/sign-up/{components/SignUpForm.tsx,services/sign-up.service.ts,index.ts}` (3)
> - `apps/public/e2e/auth/customer-register.spec.ts` + helpers (~3)
> - `apps/customer/src/app/[locale]/auth/verify-email-required/page.tsx` (1)
> - `packages/api-client/src/hooks/{use-acquisition-tracking.ts,identity/use-register-customer.ts}` (2)
> - `infra/k8s/grafana-dashboards/identity-registration.json` (1)
> - `docs/runbook/customer-registration-debug.md` (1)
> - **Estimation total fichiers** : ~50-55 nouveaux + ~20 updates = ~75 fichiers touchés.

### Testing Standards

- **Coverage cibles** (NFR71) :
  - identity-svc `usecases/register-customer.usecase`: ≥ 90 %
  - identity-svc `infrastructure/external/keycloak`: ≥ 70 % (integration tests testcontainers Keycloak)
  - identity-svc `infrastructure/persistence`: ≥ 70 % (integration tests testcontainers Postgres)
  - gateway-api endpoint: ≥ 80 %
  - frontend SignUpForm + services: ≥ 80 %
- **Tests unit** Vitest mocks ports (cf. AC5 — 7+ cases)
- **Tests integration** testcontainers (Keycloak + Postgres + NATS) via Story 0.9 helpers
- **Tests E2E** Playwright FR + EN + axe-core (cf. AC9 — 9 cases)
- **Performance** : NFR48 ≤ 30 s p90 desktop, mesuré en CI E2E (10 runs, p9 calc)
- **CI workflow** : `.github/workflows/ci.yml` (Story 0.11) déjà couvre lint + typecheck + tests affected. Story 1.2 ajoute Playwright e2e dans `.github/workflows/e2e.yml` (UPDATE Story 0.11 — bonus Story 1.2).

### Project Structure Notes

✅ **Aligné** avec Architecture lignes 1990-2241 (project structure complète : apps/identity-svc + apps/gateway-api + apps/public + apps/customer + packages/contracts + packages/api-client + packages/auth-client).

✅ **Aligné** avec Architecture lignes 1252-1505 (ADR-014 envelope canonique).

✅ **Aligné** avec Architecture lignes 234-241 (Cross-Cutting Auth — Keycloak + JWT + RBAC).

✅ **Aligné** avec PRD §FR1 (Visitor inscription Customer B2C 30s) + FR8 (verify email) + FR17 (block transactional unverified).

✅ **Aligné** avec PRD §NFR9 (HTTPS/HSTS) + NFR10 (rate limit) + NFR48 (UX < 30s) + NFR71 (coverage).

✅ **Aligné** avec UX-DR9 sign-up funnel + UX `<FormField>` pattern + acquisition tracking K-04.

✅ **Aligné** avec memory `feedback_clean_architecture_explicit.md` (Pretre canonique : interfaces dans domain/ports, impls dans infrastructure).

✅ **Aligné** avec memory `feedback_api_envelope_response.md` (envelope wrap automatique via interceptor + filter).

✅ **Aligné** avec memory `feedback_tech_layer_english.md` (TS/DB/API/events EN strict).

✅ **Aligné** avec memory `feedback_i18n_frontend.md` (FR + EN dès maintenant, zéro hardcoded UI string).

✅ **Aligné** avec memory `feedback_latest_versions.md` (latest stable @keycloak/keycloak-admin-client, @nestjs/throttler, etc.).

⚠️ **Décision documentée** : compensation pattern Keycloak ↔ DB (cf. Décisions techniques §3). Drift R8 résolu Story 1.10 reconciliation daily job.

⚠️ **Décision documentée** : 2 events distincts `identity.user.registered.v1` + `notification.email.send.v1` (cf. Décisions techniques §5). Permet decoupling business / infra notification.

⚠️ **Décision documentée** : verify token custom UUID v4 (pas Keycloak Required Action) (cf. Décisions techniques §6). Full control + cohérence Resend Story 1.6.

⚠️ **Décision documentée** : gateway-api Pretre légère (BFF, pas d'aggregates métier) (cf. Décisions techniques §7). Story 1.2 customize la replication Pretre Story 0.6 pour gateway-api.

⚠️ **À noter** : Story 1.2 dépend de gateway-api scaffold opérationnel. **Si gateway-api n'a pas eu sa replication Pretre Story 0.6**, Story 1.2 doit l'exécuter (Task 6). **Optimisation** : un dev pourrait exécuter le `replicate-pretre-structure.sh --target=gateway-api` à la fin de Story 0.6 (avant de marquer Sprint 0 complet) pour préparer Story 1.2 — c'est documenté dans Story 0.6 Dev Notes mais **non bloquant** (Story 1.2 sait le faire si pas fait).

⚠️ **À noter** : la **désactivation native Keycloak `verifyEmail` SMTP au profit de Resend** (Story 1.1 Dev Notes décision) est implicite Story 1.2 : le user créé a `emailVerified: false` dans Keycloak, mais Keycloak ne tente PAS d'envoyer l'email (car le SMTP local Story 0.10 MailHog est configuré mais on ne déclenche pas le `executeActionsEmail` Keycloak). **Le flow réel** : identity-svc publie `notification.email.send.v1` → notification-svc Story 5.4 consume → Resend envoie via templates FR/EN. Au MVP local, MailHog reçoit l'email Resend (dev mode) — `localhost:8025` UI MailHog visible.

⚠️ **À noter** : la **page `verify-email-required`** Story 1.2 est un **placeholder simple** (Task 8.8). La page **complète** avec CTA "Renvoyer email" qui appelle `POST /v1/auth/email/resend` arrive Story 1.6. Story 1.2 garantit juste que le redirect middleware fonctionne (FR17).

### Latest Tech Information

- **`@keycloak/keycloak-admin-client`** : official npm package Keycloak, latest stable version compat Keycloak 26 (vérifier au moment du dev `pnpm view @keycloak/keycloak-admin-client version`). Documentation : https://github.com/keycloak/keycloak-admin-client. Méthodes utilisées Story 1.2 : `users.create`, `users.find`, `users.del`, `users.addRealmRoleMappings`, `users.resetPassword`. Auth via `clientCredentials` grant (service-account `tukio-api` confidential client Story 1.1 AC2).
- **`@nestjs/throttler` v6** : latest stable, supporte storage adapters (Redis, Memory). Decorator `@Throttle({ default: { limit, ttl } })` + `APP_GUARD ThrottlerGuard`. Documentation : https://docs.nestjs.com/security/rate-limiting. Storage Redis via `@nest-lab/throttler-storage-redis`.
- **`zod` v3** : Schema validation TS-first. Performances OK pour validation DTO < 1ms p99. Inférence type via `z.infer<typeof Schema>`. Compat `nestjs-zod` pipe Story 0.6.
- **`react-hook-form` v7** : Form state management performant (~6KB gzip). `mode: 'onBlur'` + `zodResolver` pour validation immédiate UX. Compat `@hookform/resolvers/zod`.
- **`@playwright/test` v1.40+** : E2E testing parallèle multi-browser. Compat `@axe-core/playwright` v4 pour a11y RGAA AA. CI integration via `.github/workflows/e2e.yml`.

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Cross-Cutting-Auth — Lines 234-241 (Keycloak + JWT + RBAC + sync webhooks)]
- [Source: _bmad-output/planning-artifacts/architecture.md#API-Communication-Patterns — Lines 710-720 (REST gateway-api BFF)]
- [Source: _bmad-output/planning-artifacts/architecture.md#API-Response-Format-Enveloppe-REST — Lines 1252-1505 (ADR-014 envelope canonique)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Authentication-Flow — Lines 1731-1738 (workflow login Keycloak — Story 1.4 finalise)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Project-Structure — Lines 1990-2241 (apps/identity-svc + gateway-api + public + customer)]
- [Source: _bmad-output/planning-artifacts/architecture.md#API-Security — Lines 699-708 (rate limiting 5/min IP sensitive)]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic-1-Story-1.2 — Lines 1100-1116 (8 ACs originaux)]
- [Source: _bmad-output/planning-artifacts/prd.md#FR1 — Visitor inscription Customer B2C 30s]
- [Source: _bmad-output/planning-artifacts/prd.md#FR8 — Verify email required transaction]
- [Source: _bmad-output/planning-artifacts/prd.md#FR17 — Block transactional unverified]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR9 — HTTPS/HSTS + password complexity + anti-énumération]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR10 — mTLS + rate limiting]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR12 — Refresh token rotation]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR48 — UX sign-up < 30s p90]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR71 — Coverage ≥ 80% domain, ≥ 50% infra]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#UX-DR9 — Lines 951+ (sign-up funnel)]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#FormField-pattern — Lines 1479+ (Form components composition)]
- [Source: _bmad-output/implementation-artifacts/0-2-initialize-tukio-contracts-envelope-nats-events-dtos.md — Story 0.2 dev context (envelope types + Actor + DomainEvent + JSON Schema build pipeline)]
- [Source: _bmad-output/implementation-artifacts/0-3-setup-design-system-tailwind-v4-tukio-ui.md — Story 0.3 dev context (theme.css + tokens TS — utilisés Frontend SignUpForm)]
- [Source: _bmad-output/implementation-artifacts/0-4-implement-atomic-components-tukio-ui.md — Story 0.4 atomic components (FormField + Input + Button + Checkbox)]
- [Source: _bmad-output/implementation-artifacts/0-6-pattern-pretre-scaffolding-template-identity-svc.md — Story 0.6 dev context (Pretre canonique + envelope ADR-014 + UseCasesProxyModule + DataSource + DomainException + EnvironmentConfigService)]
- [Source: _bmad-output/implementation-artifacts/0-7-setup-tukio-messaging-nats-jetstream.md — Story 0.7 dev context (OutboxPublisher + OutboxRelayService + correlationContext)]
- [Source: _bmad-output/implementation-artifacts/0-8-setup-tukio-auth-backend-frontend.md — Story 0.8 dev context (`@tukio/auth` + `@tukio/auth-client` — Story 1.2 update use-auth pour exposer emailVerified)]
- [Source: _bmad-output/implementation-artifacts/0-9-setup-tukio-api-client-i18n-client-testing.md — Story 0.9 dev context (api-client + i18n-client + testing testcontainers Keycloak/Postgres)]
- [Source: _bmad-output/implementation-artifacts/0-13-initialize-adrs-vercel-multi-zones-acquisition-schema.md — Story 0.13 dev context (acquisition_* schema users table + cookie tk_acq préparation)]
- [Source: _bmad-output/implementation-artifacts/1-1-provision-keycloak-realm-tukio-roles-clients-phasetwo.md — Story 1.1 dev context (realm tukio + 5 rôles + 4 clients + claims tukio:locale + tukio:status + brute-force)]
- [External: https://www.keycloak.org/docs/26.0/server_admin/#assembly-managing-users_server_administration_guide — Keycloak Admin Users API]
- [External: https://www.npmjs.com/package/@keycloak/keycloak-admin-client — Keycloak Admin npm]
- [External: https://docs.nestjs.com/security/rate-limiting — NestJS Throttler]
- [External: https://zod.dev/ — Zod Validation]
- [External: https://react-hook-form.com/ — React Hook Form v7]
- [External: https://playwright.dev/ — Playwright E2E]
- [External: https://www.deque.com/axe/core-documentation/api-documentation/ — axe-core API]
- [External: https://datatracker.ietf.org/doc/html/rfc5322 — Email format RFC 5322]
- [External: https://datatracker.ietf.org/doc/html/rfc7807 — Problem Details JSON (référence ADR-014 alternative)]
- [Memory: feedback_clean_architecture_explicit.md — Pretre canonique]
- [Memory: feedback_api_envelope_response.md — envelope wrap automatique]
- [Memory: feedback_tech_layer_english.md — code/DB/API/events EN strict]
- [Memory: feedback_i18n_frontend.md — FR/EN dès maintenant, zéro hardcoded UI]
- [Memory: feedback_latest_versions.md — latest stable libs]
- [Memory: feedback_comprehensive_briefs.md — story exhaustive plutôt que pitch synthétique]
- [Memory: feedback_trust_docs.md — confiance dans les artefacts Sprint 0 + planning-artifacts comme source-of-truth]

## Dev Agent Record

### Agent Model Used

(à remplir par le dev agent au démarrage de l'implémentation)

### Debug Log References

(à remplir au cours de l'implémentation — vérification version `@keycloak/keycloak-admin-client` compat Keycloak 26 au moment du dev (`pnpm view`), choix backoff retry axios-retry (default 3 retries exponential), validation transaction TypeORM `runInTransaction` partage QueryRunner correctement avec OutboxPublisher Story 0.7 — vérifier le contract de `IEventPublisher.publish` quand attaché à un txn, validation gateway-api Pretre replication script si pas déjà fait Story 0.6, fallback si `@nest-lab/throttler-storage-redis` n'est plus maintenu (alternative `@nestjs/throttler` v6 + Redis adapter natif), validation Phasetwo Webhooks Story 1.1 ne génère pas d'event LOGIN_ERROR pour les register success (vérifier filtre Phasetwo), test E2E timing NFR48 mesure exacte `page.goto` → redirect verify-email-required, drift R8 si compensation Keycloak fail — alerte Prom counter `tukio_keycloak_orphan_users_total` remonté Story 1.10)

### Completion Notes List

(à remplir à la fin — résumé décisions, déviations vs Dev Notes avec justification, points d'attention pour Story 1.3 (Pro register avec INSEE SIRENE — réutilise quasi tout : factory `UserProfile.registerPro()`, KeycloakAdminService, outbox events `identity.pro.registered.v1`, frontend wizard 3 steps), Story 1.4 (Login PKCE — utilise `tukio-web` client + redirect URIs Story 1.1, AuthProvider Story 0.8), Story 1.6 (Email verify endpoint — consume verify token créé Story 1.2, set `email_verified=true` Keycloak Admin API), Story 5.4 (notification-svc consume `notification.email.send.v1` → Resend SDK templates), Story 1.10 (identity-svc Pretre consolidation + reconciliation job R8 drift)

### File List

(à remplir à la fin — liste exhaustive des fichiers créés / modifiés / supprimés, avec chemins relatifs depuis la racine du repo)

---

## Story Completion Status

- **Story Status** : `ready-for-dev`
- **Created** : 2026-05-09
- **Created by** : `bmad-create-story` workflow
- **Epic** : Epic 1 — Identity & Authentication Backbone (MVP)
- **Sprint cible** : Sprint 1 (semaines 4-5 du planning MVP, 2ᵉ story Epic 1)
- **Estimation effort** : 5-7 jours (1 dev fullstack senior — frontend RHF + Zod + i18n + a11y, gateway-api throttler + forwarder, identity-svc Pretre use case + Keycloak Admin API + transaction outbox, ~75 fichiers touchés, e2e Playwright FR/EN + axe-core)
- **Dépendances upstream** :
  - **Story 0.2** (`ready-for-dev`) — `@tukio/contracts` envelope + DomainEvent types + build pipeline JSON Schema → TS
  - **Story 0.4** (`ready-for-dev`) — atomics `<FormField>`, `<Input>`, `<Button>`, `<Checkbox>`, `<EmptyState>`
  - **Story 0.5** (`ready-for-dev`) — composite patterns
  - **Story 0.6** (`ready-for-dev`) — Pretre identity-svc + envelope ADR-014 + UseCasesProxyModule + DomainException + EnvironmentConfigService
  - **Story 0.7** (`ready-for-dev`) — `@tukio/messaging` outbox + correlationContext
  - **Story 0.8** (`ready-for-dev`) — `@tukio/auth` + `@tukio/auth-client` + middleware Next.js
  - **Story 0.9** (`ready-for-dev`) — `@tukio/api-client` + `@tukio/i18n-client` + testcontainers Keycloak/Postgres helpers
  - **Story 0.10** (`ready-for-dev`) — Docker Compose Postgres + NATS + Keycloak + Redis + MailHog
  - **Story 0.13** (`ready-for-dev`) — acquisition_* schema migration users table
  - **Story 1.1** (`ready-for-dev`) — Keycloak realm `tukio` + rôle `client` + claim `tukio:locale` + `tukio:status` + tukio-api confidential client
- **Dépendances downstream** :
  - **Story 1.3** (Pro register) — pattern register Story 1.2 + INSEE SIRENE + KYC docs upload + `tukio:status='pending_admin_review'`
  - **Story 1.4** (Login PKCE) — utilise users créés Story 1.2 + `<AuthProvider>` Story 0.8 + cookies tukio-access-token Domain=.tukio.one
  - **Story 1.5** (Password reset) — pattern Story 1.2 + verify token table created Story 1.2 (re-utilisée pour password reset tokens — ou table séparée)
  - **Story 1.6** (Email verify endpoint + landing) — consume `verify_token` créé Story 1.2 + set `email_verified=true` via KeycloakAdmin Story 1.2
  - **Story 1.8** (Profile management) — pattern Story 1.2 + GET /v1/me + PATCH /v1/me sur user créé Story 1.2
  - **Story 1.9** (Account delete RGPD) — soft-delete user créé Story 1.2 + anonymisation
  - **Story 1.10** (identity-svc consolidation) — reconciliation job Keycloak ↔ DB drift R8 (orphan users de Story 1.2 compensation fail)
  - **Story 5.4** (notification-svc) — consume event `notification.email.send.v1` publié Story 1.2 → Resend templates FR/EN
  - **Story 7.5** (acquisition tracking enrichment V1) — multi-touch attribution avec `acquisition_first_touch` vs `acquisition_last_touch` (Story 1.2 stocke first_touch = last_touch initialement)
  - **Stories Epic 4 (booking)** — fonctionnalités transactionnelles bloquées Story 1.2 middleware FR17 jusqu'à email verify Story 1.6
- **FRs covered** :
  - **FR1** ✅ Customer B2C register en < 30s (NFR48)
  - **FR8** ✅ Email verification required (preparation : NATS event + token + middleware FR17, finalisation Story 1.6)
  - **FR14** ✅ Profile read (claim JWT consultable, full UI Story 1.8)
  - **FR16** N/A (Pro SIRET anti-doublon Story 1.3)
  - **FR17** ✅ Block transactional unverified (middleware Next.js redirect verify-email-required)
- **NFRs touchés** :
  - **NFR9** ✅ HTTPS/HSTS + password complexity 12+ + anti-énumération
  - **NFR10** ✅ Rate limit 5/min/IP sur register (Redis Upstash)
  - **NFR11** N/A (JWT validation Story 0.8 + 1.4)
  - **NFR12** N/A (refresh rotation Story 1.4)
  - **NFR13** ✅ Secrets via Doppler (TUKIO_INTERNAL_SERVICE_SECRET + KEYCLOAK_CLIENT_SECRET_TUKIO_API)
  - **NFR16** ✅ PII redaction logs (password jamais loggé)
  - **NFR42** ✅ Outbox transactional cohérence (Story 0.7)
  - **NFR48** ✅ UX register < 30s p90 (testé E2E)
  - **NFR71** ✅ Coverage ≥ 80% use case + 80% endpoint + 80% form
  - **R8** ✅ Drift Keycloak ↔ DB mitigated via compensation pattern + alerte Prom

> **Prochaine story (auto-discover via `bmad-create-story`) → Story 1.3** (Pro registration with `pending_admin_review` status `POST /v1/auth/pro/register`)

---

**Dev agent next steps :**
1. Lire ce file en entier (Story Foundation + AC + Tasks + Dev Notes + References)
2. Vérifier les artefacts upstream (Stories 0.2, 0.4-0.10, 0.13, 1.1) sont bien en `ready-for-dev` ou `done`
3. **PRÉREQUIS** : si gateway-api n'a pas encore eu sa replication Pretre Story 0.6, lancer `bash infra/scripts/replicate-pretre-structure.sh --target=gateway-api` AVANT de commencer Task 6
4. Implémenter Tasks 1-10 dans l'ordre (Tasks 1-3 indépendantes peuvent paralléliser)
5. Lancer après chaque jalon : `pnpm lint && pnpm typecheck && pnpm test --filter=...[origin/main] && pnpm playwright test --project=chromium-fr`
6. Commit Story 1.2 quand : 9/9 e2e tests passent + coverage ≥ thresholds + lint OK + axe-core 0 violations + perf NFR48 OK
7. Update `_bmad-output/implementation-artifacts/sprint-status.yaml` : `1-2-customer-b2c-registration: review` (puis `done` après code-review)
