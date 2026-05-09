# Story 2.1: Stripe Connect Express account creation + onboarding link

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

**As a** Pro `pending_admin_review` (sortant Epic 1 Story 1.3 register),
**I want** créer mon compte Stripe Connect Express (`type: 'express'`, country `FR`, business_type `company`, MCC `7299` Personal Services Other) via gateway-api `POST /v1/seller/onboarding/stripe/create-account` qui forward à payment-svc (NEW service Pretre Story 2.1) → `Stripe.accounts.create({...})` → persiste `stripeAccountId` dans `ProProfile.stripeAccountId` (migration Story 2.1 ajoute colonne) → `Stripe.accountLinks.create({ refresh_url, return_url, type: 'account_onboarding' })` → return URL hosted Stripe → frontend `apps/seller/{locale}/seller/onboarding/stripe` redirect window.location vers cette URL ; **return URL handler** `apps/seller/{locale}/seller/onboarding/stripe/return` (NEW page Server Component) → call `POST /v1/seller/onboarding/stripe/sync-status` → payment-svc `Stripe.accounts.retrieve(stripeAccountId)` → check `details_submitted = true` + `charges_enabled = true` + `payouts_enabled = true` + `requirements.currently_due` array → update `ProProfile.stripeStatus` (enum `'not_started' | 'pending' | 'requires_action' | 'submitted' | 'restricted'`) + `stripeRequirementsCurrentlyDue` (jsonb) + `stripeChargesEnabled` (bool) + `stripePayoutsEnabled` (bool) → publie `payment.stripe-account.submitted.v1` (consume notification-svc Story 5.4 → email Pro confirmation) ou `payment.stripe-account.requires-action.v1` (avec list `currently_due` payload) → frontend render `<StripeStatusCard>` avec status + CTA "Compléter votre dossier" si requires_action (regenerate accountLink, TTL Stripe ~5min) ; **webhook endpoint** `POST /v1/webhooks/stripe` (gateway-api → payment-svc) handler `account.updated` event Stripe HMAC-signed (header `Stripe-Signature` verify via `Stripe.webhooks.constructEvent` SDK natif), idempotency via `stripe_events_inbox` table (event_id PK), upsert ProProfile.stripeStatus + publie `payment.stripe-account.updated.v1` ; **chargesAllowed gating** : middleware seller (UPDATE Story 1.4) check `proProfile.stripeStatus === 'submitted' && proProfile.stripeChargesEnabled && proProfile.stripePayoutsEnabled` — sinon banner danger sur `/seller/dashboard` "Compléter votre compte Stripe pour pouvoir recevoir des résa" (Story 2.5 admin valide kyc_status `approved` ≠ stripe submitted — les 2 sont indépendants jusqu'à ce que les 2 soient OK pour activation pleine) ; **PII redaction strict** (NFR15 + NFR16) : webhook payload jamais loggé en entier (uniquement `eventId`, `type`, `accountId` + `requirements.currently_due` summary) ; **test mode sandbox** : env var `STRIPE_MODE='test'|'live'` switch entre clés Stripe `STRIPE_SECRET_KEY_TEST` / `STRIPE_SECRET_KEY_LIVE` (Doppler), badge UI `<Badge>TEST</Badge>` sur `/seller/dashboard` si mode test — utile dev + staging,
**so that** un Pro peut **délégué son KYC financier à Stripe** (faster que KYC manual Tukio Story 1.3 qui est pour identity legal — Stripe gère banking compliance + AML + identity verification financial), recevoir des **payouts automatiques J+1** sur son compte bancaire après chaque booking confirmed (Story 4.10 wire payouts), et la **Story 2.2** (wizard 4 steps Profil + Stripe + KYC + 1ère fiche) consume le state `stripeStatus` pour marquer la step 2 complète ; **Story 5.4** (notification-svc) consume les 4 events `payment.stripe-account.{created,submitted,requires-action,updated}.v1` pour emails transactionnels ; **Stories Epic 4** (booking saga) consument `chargesAllowed` flag avant de tenter PaymentIntent ; et le **pattern complet "external service onboarding via hosted URL + webhook sync"** devient template Story 9.x V1 (subscription tier upgrade Stripe Billing — même pattern Account Links + webhook), Story 12.x V1+ (Stripe Identity KYC complet FR12 — réutilise infrastructure Story 2.1 stripe SDK + webhook + idempotency).

> **Outcome attendu** : à la fin de cette story, **payment-svc est scaffoldé Pretre** (1ʳᵉ service Epic 2 — réutilise template Story 0.6 via `replicate-pretre-structure.sh --target=payment-svc`), un Pro `pending_admin_review` Story 1.3 navigue `seller.tukio.one/fr/seller/onboarding/stripe` → click "Connecter mon compte Stripe" → frontend POST → payment-svc create Stripe account `acct_xxx` (Stripe test mode local dev) + persist DB + generate accountLink → 302 redirect window.location vers `https://connect.stripe.com/express/onboarding/...` (Stripe hosted) → user complète KYC Stripe (5-10 min, formulaire Stripe avec input bank account, ID upload, business info) → return `seller.tukio.one/fr/seller/onboarding/stripe/return` → page Server Component fetch sync → render success `<EmptyState variant="success">` "Compte Stripe configuré ✓" + bouton "Continuer vers KYC Tukio" (Story 2.4 admin review) ; côté DB, `pro_profiles.stripe_account_id = 'acct_xxx'`, `stripe_status = 'submitted'`, `stripe_charges_enabled = true`, `stripe_payouts_enabled = true` ; côté Stripe, l'account est en mode `restricted` (requires_due empty) prêt à recevoir paiements ; un webhook `account.updated` arrive (e.g., user updates bank account post-onboarding) → payment-svc verify HMAC + idempotency check → update DB + publie NATS event ; un Pro qui revient avec `requires_action` (Stripe demande pièce ID supplémentaire) voit UI banner + CTA regenerate accountLink ; un test `pnpm playwright test --grep "stripe connect"` passe en FR ET EN axe-core 0 violations 8 scénarios (happy path FR/EN, requires_action, webhook signature mismatch → 403, idempotent webhook, test mode badge, banner sur dashboard si non-submitted, error Stripe API down, return URL avec stripeAccountId mismatch security).

## Acceptance Criteria

1. **AC1 — payment-svc Pretre scaffolding (1ʳᵉ Epic 2 prereq)** : Given Story 0.6 a livré le replication script `infra/scripts/replicate-pretre-structure.sh`, When je lance `bash infra/scripts/replicate-pretre-structure.sh --target=payment-svc`, Then la structure Pretre canonique est répliquée dans `apps/payment-svc/src/` (cohérent Architecture lignes 2120-2164 — `domain/usecases/infrastructure/usecases-proxy/` + `eslint-plugin-boundaries` enforce + Symbol DI tokens + envelope ADR-014 + Outbox transactional Story 0.7 wired). Service exposé sur port `4006` (cohérent infra Story 0.10 docker-compose). Migration baseline `1715270000000-CreatePaymentSvcBaseline.ts` crée :
   - Table `outbox` (Story 0.7 template — pattern PG LISTEN/NOTIFY relay)
   - Table `inbox` (Story 0.7 idempotence pattern)
   - Table `stripe_events_inbox` (Story 2.1 Stripe webhook idempotency, similar à `keycloak_events_inbox` Story 1.10)
   - **PAS de PaymentIntent / Order tables** Story 2.1 (Stories 4.x posent Booking saga). Story 2.1 = uniquement Stripe Connect account onboarding.
   - **Tests health/ready** : `pnpm --filter=payment-svc test` passe (lint boundaries 0 violations)

2. **AC2 — `pro_profiles` migration + extends domain** (UPDATE Story 1.3) : Given Story 1.10 handoff Epic 2 docs, When je consulte les migrations identity-svc, Then je trouve `1715270000001-AddStripeFieldsToProProfiles.ts` (NEW Story 2.1) qui ajoute :
   ```sql
   ALTER TABLE pro_profiles ADD COLUMN stripe_account_id VARCHAR(50) NULL;
   CREATE UNIQUE INDEX idx_pro_profiles_stripe_account_id ON pro_profiles (stripe_account_id) WHERE deleted_at IS NULL AND stripe_account_id IS NOT NULL;
   
   ALTER TABLE pro_profiles ADD COLUMN stripe_status VARCHAR(30) NOT NULL DEFAULT 'not_started'
     CHECK (stripe_status IN ('not_started', 'pending', 'requires_action', 'submitted', 'restricted'));
   ALTER TABLE pro_profiles ADD COLUMN stripe_charges_enabled BOOLEAN NOT NULL DEFAULT false;
   ALTER TABLE pro_profiles ADD COLUMN stripe_payouts_enabled BOOLEAN NOT NULL DEFAULT false;
   ALTER TABLE pro_profiles ADD COLUMN stripe_requirements_currently_due JSONB NULL;
   ALTER TABLE pro_profiles ADD COLUMN stripe_account_created_at TIMESTAMPTZ NULL;
   ALTER TABLE pro_profiles ADD COLUMN stripe_last_synced_at TIMESTAMPTZ NULL;
   ```
   - Update `kyc_status` enum check constraint Story 1.3 — **PAS de modification** (Stripe status est indépendant de kyc_status admin Tukio)
   - Update `ProProfile` aggregate (Story 1.3) : ajouter méthodes domain `linkStripeAccount(stripeAccountId)`, `updateStripeStatus({ status, chargesEnabled, payoutsEnabled, requirementsCurrentlyDue })`, getter `chargesAllowed: boolean` (= `stripeStatus === 'submitted' && stripeChargesEnabled && stripePayoutsEnabled && kycStatus === 'approved'`)
   - Update `ProProfileEntity` (Story 1.3) + repo : 6 nouvelles colonnes mappées
   - Tests aggregate : `linkStripeAccount` idempotent, `updateStripeStatus` invariants, `chargesAllowed` logique combinée

3. **AC3 — payment-svc domain + use cases** : Given Pretre architecture AC1, When je consulte `apps/payment-svc/src/`, Then je trouve :
   - **Domain ports** :
     - `domain/ports/stripe-connect.port.ts` (`IStripeConnect` interface — méthodes `createAccount`, `createAccountLink`, `retrieveAccount`, `verifyWebhookSignature`)
     - `domain/ports/pro-profile-syncer.port.ts` (`IProProfileSyncer` interface — méthode `syncStripeStatus(proProfileId, stripeStatus)` qui appelle identity-svc HTTP `POST /internal/pros/by-id/{id}/sync-stripe`)
     - `domain/ports/event-publisher.port.ts` (Story 0.7 réutilisé)
     - `domain/ports/stripe-events-inbox-repository.port.ts` (idempotency Story 1.10 pattern)
   - **Domain aggregates** :
     - `domain/model/stripe-connect-account.aggregate.ts` (NEW — minimal aggregate Story 2.1, étendu Stories 4.x avec PaymentIntent) avec `id` (Tukio internal UUID), `stripeAccountId`, `proProfileId`, `status`, `chargesEnabled`, `payoutsEnabled`, `requirementsCurrentlyDue`, `createdAt`, `lastSyncedAt`
     - **Décision MVP** : duplicate du state Stripe dans payment-svc DB (table `stripe_connect_accounts` minimal — Story 2.1 ne crée PAS cette table, juste référence le state Stripe via `stripeAccountId` stocké dans identity-svc.pro_profiles. Future Stories 4.x créeront la table pour PaymentIntent state local). Pour MVP Story 2.1, **payment-svc ne persiste pas le state account Stripe localement** — uniquement audit via `stripe_events_inbox` + identity-svc.pro_profiles fait office de source of truth.
   - **Use cases** :
     - `usecases/create-stripe-account.usecase.ts` (handle "Connecter mon compte" click)
     - `usecases/sync-stripe-status.usecase.ts` (handle return URL after Stripe hosted onboarding)
     - `usecases/handle-stripe-webhook.usecase.ts` (handle `account.updated` event)
     - `usecases/regenerate-account-link.usecase.ts` (handle "Compléter votre dossier" CTA si requires_action)
   - Tests unit ≥ 90 % each

4. **AC4 — Stripe SDK integration via `IStripeConnect` port + `StripeConnectService`** : Given AC3, When je consulte `apps/payment-svc/src/infrastructure/external/stripe/`, Then :
   - **Lib** : `stripe` npm package (latest stable v14+ supports modern Account Links API)
   - **Service** `stripe-connect.service.ts` implements `IStripeConnect` :
     ```ts
     @Injectable()
     export class StripeConnectService implements IStripeConnect {
       private readonly stripe: Stripe;
       constructor(@Inject(CONFIG_SERVICE) config: IConfigService) {
         const secretKey = config.getStripeMode() === 'test' ? config.getStripeSecretKeyTest() : config.getStripeSecretKeyLive();
         this.stripe = new Stripe(secretKey, { apiVersion: '2024-11-20.acacia' /* latest stable Stripe API version */, typescript: true });
       }
       
       async createAccount(input: { proProfileId: string; email: string; companyName: string; siret: string; locale: 'fr' | 'en' }): Promise<{ stripeAccountId: string }> {
         const account = await this.stripe.accounts.create({
           type: 'express',
           country: 'FR',
           email: input.email,
           business_type: 'company',
           business_profile: {
             mcc: '7299', // Personal Services Other (events providers)
             url: `https://tukio.one/${input.locale}/pro/${input.proProfileId}`,
             name: input.companyName,
           },
           company: { tax_id: input.siret }, // SIRET pre-filled
           metadata: { proProfileId: input.proProfileId, source: 'tukio.one' },
           capabilities: { card_payments: { requested: true }, transfers: { requested: true } }, // required FR Connect
           default_currency: 'eur',
         });
         return { stripeAccountId: account.id };
       }
       
       async createAccountLink(input: { stripeAccountId: string; returnUrl: string; refreshUrl: string }): Promise<{ url: string; expiresAt: Date }> {
         const link = await this.stripe.accountLinks.create({
           account: input.stripeAccountId,
           return_url: input.returnUrl,
           refresh_url: input.refreshUrl,
           type: 'account_onboarding',
         });
         return { url: link.url, expiresAt: new Date(link.expires_at * 1000) };
       }
       
       async retrieveAccount(stripeAccountId: string): Promise<{ detailsSubmitted: boolean; chargesEnabled: boolean; payoutsEnabled: boolean; requirementsCurrentlyDue: string[]; capabilities: any }> {
         const account = await this.stripe.accounts.retrieve(stripeAccountId);
         return {
           detailsSubmitted: account.details_submitted,
           chargesEnabled: account.charges_enabled,
           payoutsEnabled: account.payouts_enabled,
           requirementsCurrentlyDue: account.requirements?.currently_due ?? [],
           capabilities: { card_payments: account.capabilities?.card_payments, transfers: account.capabilities?.transfers },
         };
       }
       
       verifyWebhookSignature(rawBody: string, signature: string, webhookSecret: string): Stripe.Event {
         // Stripe SDK natif HMAC-SHA256 verify avec timing-safe equal
         return this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
       }
     }
     ```
   - **Errors mapping** : `StripeUnreachableError` (5xx Stripe), `StripeRateLimitError` (429), `StripeInvalidRequestError` (400), `StripeAccountNotFoundError` (404)
   - **PII redaction logger** : tous logs Stripe API calls → `pino` redact `request.body`, `response.data` complets — uniquement log `accountId`, `eventType`, `requestId` Stripe
   - **Tests integration** : mock Stripe API via `stripe-mock` Docker testcontainer (officiel Stripe pour tests) + tester `createAccount` / `retrieveAccount` / `verifyWebhookSignature` happy + edge cases

5. **AC5 — gateway-api endpoints `/v1/seller/onboarding/stripe/{create-account,return,sync-status,regenerate-link}`** : Given AC3, When je consulte `apps/gateway-api/src/infrastructure/http/controllers/seller-onboarding.controller.ts` (NEW), Then :
   - **Endpoints** :
     ```ts
     @Controller('/v1/seller/onboarding/stripe')
     export class SellerOnboardingStripeController {
       @Post('/create-account')
       @UseGuards(KeycloakJwtGuard, RolesGuard)
       @Roles('pro')
       @HttpCode(200)
       async createAccount(@CurrentActor() actor: Actor, @Body() dto: CreateStripeAccountInput): Promise<{ url: string }> {
         return this.stripeOnboardingForwarder.getInstance().createAccount({ actor, returnUrl: dto.returnUrl, refreshUrl: dto.refreshUrl });
       }
       
       @Post('/sync-status')
       @UseGuards(KeycloakJwtGuard, RolesGuard)
       @Roles('pro')
       @HttpCode(200)
       async syncStatus(@CurrentActor() actor: Actor): Promise<StripeStatusResponse> {
         return this.stripeOnboardingForwarder.getInstance().syncStatus({ actor });
       }
       
       @Post('/regenerate-link')
       @UseGuards(KeycloakJwtGuard, RolesGuard)
       @Roles('pro')
       @HttpCode(200)
       async regenerateLink(@CurrentActor() actor: Actor, @Body() dto: RegenerateLinkInput): Promise<{ url: string }> {
         return this.stripeOnboardingForwarder.getInstance().regenerateLink({ actor, returnUrl: dto.returnUrl, refreshUrl: dto.refreshUrl });
       }
     }
     ```
   - **Webhook endpoint** `/v1/webhooks/stripe` (gateway-api separate controller `webhooks.controller.ts` NEW) :
     ```ts
     @Controller('/v1/webhooks/stripe')
     export class StripeWebhooksController {
       @Post('/')
       @Public() // pas de JWT — Stripe-signed
       @HttpCode(204)
       @SkipThrottle() // Stripe peut burst — ne pas throttle webhook
       async handleStripeWebhook(@RawBody() rawBody: Buffer, @Headers('stripe-signature') signature: string): Promise<void> {
         return this.stripeWebhookForwarder.getInstance().handle({ rawBody: rawBody.toString('utf-8'), signature });
       }
     }
     ```
   - **NB raw body** : Stripe webhook signature verification REQUIRES raw body (pas parsed JSON). NestJS Fastify config : `bodyLimit` + `addContentTypeParser` for `application/json` raw retain
   - **Throttle** : create-account 5/heure/user (anti-spam create accounts), sync-status 30/min/user, regenerate-link 10/heure/user
   - **Forwarder** appelle payment-svc `POST /internal/stripe-onboarding/{create,sync,regenerate,webhook}` via HTTP avec `X-Internal-Service-Token` Story 1.2 + actor propagation
   - **Webhook NOT proxied via internal-service-token** : webhook endpoint reçoit Stripe direct depuis Internet via gateway-api, qui forward le rawBody à payment-svc avec `X-Stripe-Signature` propagé. payment-svc verify la signature finale.
   - **Tests E2E** : Pro avec stripeAccountId existant → `POST /create-account` → 409 conflict (already created). `POST /sync-status` → 200 + status. `POST /regenerate-link` → 200 + new URL. Customer (rôle client) → 403. Webhook valid signature → 204. Webhook invalid signature → 403.

6. **AC6 — Frontend `apps/seller/[locale]/seller/onboarding/stripe` + return page** : Given AC5, When un Pro navigue `seller.tukio.one/{fr|en}/seller/onboarding/stripe`, Then :
   - **Page principal** (Server Component) fetch `GET /v1/me` (Story 1.8) pour récupérer Pro profile + `prosFields.stripeStatus`. Render selon état :
     - **`stripeStatus === 'not_started'`** :
       - Hero `<h1>Configurer Stripe Connect</h1>` (FR) / `<h1>Set up Stripe Connect</h1>` (EN)
       - Description `"Pour recevoir vos paiements, connectez votre compte Stripe. Vous serez redirigé vers Stripe pour compléter votre KYC bancaire (~5-10 min)."`
       - Info box `<Alert variant="info">Stripe gère la conformité bancaire (KYC, AML). Tukio ne stocke jamais vos coordonnées bancaires.</Alert>`
       - CTA `<Button variant="primary" size="lg" onClick={handleConnectStripe}>Connecter mon compte Stripe</Button>` → POST `/v1/seller/onboarding/stripe/create-account` body `{ returnUrl: '${SELLER_URL}/{locale}/seller/onboarding/stripe/return', refreshUrl: '${SELLER_URL}/{locale}/seller/onboarding/stripe' }` → response `{ url }` → `window.location.assign(url)`
     - **`stripeStatus === 'pending'`** : Pro vient de cliquer mais pas encore complété — `<Spinner>` + message "Configuration en cours..."
     - **`stripeStatus === 'requires_action'`** :
       - `<Alert variant="warning">` "Stripe demande des informations supplémentaires" + list `requirementsCurrentlyDue` traduits FR/EN (ex: `'individual.verification.document'` → "Document d'identité supplémentaire requis")
       - CTA `<Button variant="primary">Compléter mon dossier Stripe</Button>` → POST `/regenerate-link` → redirect Stripe
     - **`stripeStatus === 'submitted'`** :
       - `<EmptyState variant="success">` "Compte Stripe configuré ✓" avec icone check
       - CTA secondaire `<Link href="/{locale}/seller/onboarding">Continuer vers la vérification Tukio</Link>` (Story 2.2 wizard step 3 : KYC admin)
     - **`stripeStatus === 'restricted'`** :
       - `<Alert variant="error">` "Compte Stripe restreint - contactez le support" + lien support
       - audit log event publié
   - **Page return** `apps/seller/src/app/[locale]/seller/onboarding/stripe/return/page.tsx` (Server Component) :
     - URL receive `?stripeAccountId=acct_xxx` query param (security check : compare avec `proProfile.stripeAccountId` — sinon log + redirect security warning)
     - Auto-trigger sync : Server Component calls `POST /v1/seller/onboarding/stripe/sync-status` (cookies forwarded) au mount
     - Render selon réponse status (cf. états au-dessus)
   - **Banner danger sur `/seller/dashboard`** (UPDATE Story 1.4 dashboard placeholder) : si `proProfile.kycStatus === 'approved' && !proProfile.chargesAllowed` → afficher banner top-page warning "Compte Stripe non configuré — vous ne pouvez pas recevoir de réservations" + CTA "Configurer Stripe"
   - **Badge TEST** : si frontend lit env var `NEXT_PUBLIC_STRIPE_MODE === 'test'` → afficher `<Badge variant="warning">TEST</Badge>` dans header `/seller/*`
   - **i18n** : namespace `seller.onboarding.stripe.*` + `seller.dashboard.banner.stripeRequired.*` (~20 keys)
   - **Hooks** : `packages/api-client/src/hooks/seller/use-stripe-onboarding.ts` (NEW) avec 3 mutations (create, sync, regenerate)
   - **Tests E2E** : (cf. AC9)

7. **AC7 — `@tukio/contracts` 4 events Stripe + DTOs** : Given AC3-5, When je consulte `packages/contracts/src/`, Then :
   - **NEW events** `payment/`:
     - `stripe-account-created.v1.{schema.json,ts}` : payload `{ proProfileId, stripeAccountId, createdAt }`
     - `stripe-account-submitted.v1.{schema.json,ts}` : payload `{ proProfileId, stripeAccountId, chargesEnabled, payoutsEnabled, submittedAt }`
     - `stripe-account-requires-action.v1.{schema.json,ts}` : payload `{ proProfileId, stripeAccountId, requirementsCurrentlyDue: string[], deadline?: string }`
     - `stripe-account-updated.v1.{schema.json,ts}` : payload `{ proProfileId, stripeAccountId, status, chargesEnabled, payoutsEnabled, requirementsCurrentlyDue, updatedAt }`
   - **NEW DTOs** `dtos/seller-onboarding/stripe.dto.ts` (CreateStripeAccountInputSchema + StripeStatusResponseSchema + RegenerateLinkInputSchema)
   - **NEW types** `types/stripe.ts` : enum `StripeStatus`, type `StripeRequirements`
   - **Update error codes** : `PAYMENT-EXTERNAL-001` (Stripe DOWN), `PAYMENT-VALIDATION-001` (Stripe rejected create), `PAYMENT-CONFLICT-001` (already has Stripe account), `WEBHOOK-INVALID-SIGNATURE-001`
   - **Update email templates** : `stripe-account-submitted` + `stripe-account-requires-action` (Story 5.4 consume)

8. **AC8 — Webhook idempotency + audit + Phasetwo-pattern bridge** : Given Stripe webhooks Story 2.1, When un webhook arrive sur `POST /v1/webhooks/stripe`, Then :
   - **Migration `1715270000002-CreateStripeEventsInboxTable.ts`** :
     ```sql
     CREATE TABLE stripe_events_inbox (
       event_id VARCHAR(100) PRIMARY KEY, -- Stripe event ID format 'evt_xxx'
       event_type VARCHAR(100) NOT NULL,
       account_id VARCHAR(50) NULL, -- 'acct_xxx' if account event
       received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       processed_at TIMESTAMPTZ NULL,
       payload_summary JSONB -- only summary, NEVER full payload (NFR15+16)
     );
     CREATE INDEX idx_stripe_events_inbox_received_at ON stripe_events_inbox (received_at DESC);
     ```
   - **Use case `HandleStripeWebhookUseCase`** :
     1. Verify HMAC signature via `stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)` — si fail → throw `WebhookInvalidSignatureException` → 403 + alerte Slack `#tukio-security`
     2. Check idempotency : `SELECT 1 FROM stripe_events_inbox WHERE event_id = $1` — si existe → 204 idempotent
     3. Switch sur event.type :
        - `account.updated` → call `SyncStripeStatusUseCase` (réutilisation use case AC3)
        - `account.application.deauthorized` → mark proProfile `stripeStatus = 'not_started'` + alerte
        - `payout.failed`, `payout.paid` → V1 (Story 4.10 wire payouts)
        - Other events → log + skip
     4. Insert `stripe_events_inbox` + outbox publish event (atomic transaction Story 0.7)
     5. Return 204
   - **Audit log consumer** Story 1.10 audit_log consume tous `payment.stripe-account.*` events automatiquement (via Story 1.10 audit_log.consumer subscribe `payment.*`)
   - **Tests E2E webhook** : valid signature + new event → 204 + DB row + NATS event. Invalid signature → 403. Duplicate event_id → 204 (idempotent). Unknown event type → 204 + skip log.

9. **AC9 — Tests Playwright e2e + integration tests** : Given AC1-8, When je lance `pnpm playwright test --grep "stripe connect"`, Then 8 tests :
   - **Test 1 (happy path FR)** : Pro `pending_admin_review` (fixture Story 1.3) → naviguer `/fr/seller/onboarding/stripe` → click "Connecter mon compte Stripe" → vérifier redirect URL contient `connect.stripe.com/express/onboarding/...` → mock Stripe hosted page (testcontainer `stripe-mock`) → return URL avec `?stripeAccountId=acct_test_xxx` → vérifier sync render success EmptyState
   - **Test 2 (happy path EN)** : idem `/en/`
   - **Test 3 (requires_action)** : mock Stripe `requirementsCurrentlyDue: ['individual.verification.document']` → return URL → vérifier UI render Alert warning + CTA regenerate
   - **Test 4 (regenerate link)** : status requires_action → click "Compléter mon dossier" → POST regenerate → vérifier nouveau URL Stripe
   - **Test 5 (webhook signature)** : POST `/v1/webhooks/stripe` avec `Stripe-Signature` invalide → 403
   - **Test 6 (webhook idempotent)** : POST same event_id 2x → 204 + 204 + DB row inserted only once
   - **Test 7 (test mode badge)** : login Pro avec `STRIPE_MODE=test` env → naviguer dashboard → vérifier `<Badge>TEST</Badge>` rendered
   - **Test 8 (banner dashboard non-submitted)** : Pro `kycStatus=approved && stripeStatus=not_started` → naviguer `/seller/dashboard` → vérifier banner danger "Compte Stripe non configuré"
   - **Test axe-core** : 0 violations sur 2 pages stripe + dashboard banner
   - **Coverage** : ≥ 80 % gateway endpoints, ≥ 90 % payment-svc 4 use cases, ≥ 80 % frontend hooks

10. **AC10 — Documentation runbook + observability + Story 5.4 templates contract** :
    - **`docs/runbook/stripe-connect-onboarding-debug.md`** (NEW ~80 lignes) : flow + troubleshooting (Stripe DOWN, webhook signature mismatch, idempotency drift, requirements_due localization mapping FR, account.application.deauthorized handling, test vs live mode switch)
    - **`docs/runbook/stripe-webhooks-security.md`** (NEW ~50 lignes) : HMAC verify SDK natif, raw body retention, PII redaction logs, secret rotation Doppler, Stripe Dashboard webhooks setup local + staging
    - **Update `packages/contracts/README.md`** : section Payment events + 2 templates Resend (`stripe-account-submitted`, `stripe-account-requires-action`)
    - **Métriques Prom** : `tukio_stripe_account_create_total{result}`, `tukio_stripe_sync_total{stripe_status}`, `tukio_stripe_webhook_received_total{event_type}`, `tukio_stripe_webhook_signature_failures_total`, `tukio_stripe_account_link_generated_total{type}`
    - **Dashboard Grafana** (`infra/k8s/grafana-dashboards/stripe-connect-onboarding.json`) : 5 panels (onboarding funnel, p95 sync latency, webhook success rate, requires_action stuck count, signature failures)
    - **Slack alerts** : webhook signature failures > 5 / 5 min (suspected attack), requires_action stuck > 7 days (Pro lockout warning), Stripe DOWN > 1 min

## Tasks / Subtasks

- [ ] **Task 1 — payment-svc Pretre scaffolding via replication script** (AC: #1)
  - [ ] 1.1 — `bash infra/scripts/replicate-pretre-structure.sh --target=payment-svc`
  - [ ] 1.2 — Verify structure créée + lint boundaries 0 violations
  - [ ] 1.3 — Update `apps/payment-svc/.env.example` : `PORT=4006`, `DB_NAME=tukio_payment`, `STRIPE_SECRET_KEY_TEST`, `STRIPE_SECRET_KEY_LIVE`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_MODE=test|live`, `IDENTITY_SVC_URL`
  - [ ] 1.4 — Migration `1715270000000-CreatePaymentSvcBaseline.ts` (outbox + inbox + stripe_events_inbox tables)
  - [ ] 1.5 — Update `infra/docker-compose/docker-compose.dev.yml` : ajouter `payment-svc` service + `tukio_payment` DB
  - [ ] 1.6 — Update `infra/scripts/bootstrap-databases.sh` : ajouter `tukio_payment` DB

- [ ] **Task 2 — `@tukio/contracts` extensions** (AC: #7)
  - [ ] 2.1 — Créer 4 events `payment/stripe-account-{created,submitted,requires-action,updated}.v1.{schema.json,ts}`
  - [ ] 2.2 — Créer DTOs + types Stripe
  - [ ] 2.3 — Update error codes + email templates
  - [ ] 2.4 — Build + test

- [ ] **Task 3 — identity-svc migration ProProfile + extends domain** (AC: #2)
  - [ ] 3.1 — Migration `1715270000001-AddStripeFieldsToProProfiles.ts`
  - [ ] 3.2 — Update `ProProfile` aggregate : 3 méthodes domain + getter `chargesAllowed`
  - [ ] 3.3 — Update `ProProfileEntity` + repo + mapper (6 colonnes)
  - [ ] 3.4 — NEW endpoint identity-svc `POST /internal/pros/by-id/{id}/sync-stripe` (consumed by payment-svc)
  - [ ] 3.5 — Tests aggregate + integration

- [ ] **Task 4 — payment-svc domain ports + 4 use cases** (AC: #3)
  - [ ] 4.1 — Domain ports : IStripeConnect, IProProfileSyncer, IStripeEventsInboxRepository
  - [ ] 4.2 — Use cases create-stripe-account + sync-stripe-status + handle-stripe-webhook + regenerate-account-link
  - [ ] 4.3 — Tests unit ≥ 90 % each (mocks ports)

- [ ] **Task 5 — payment-svc infrastructure (Stripe SDK + identity-svc client + webhook endpoint)** (AC: #4, #5, #8)
  - [ ] 5.1 — Installer `stripe` (latest stable v14+)
  - [ ] 5.2 — `infrastructure/external/stripe/{stripe-connect.service.ts,errors.ts,stripe.module.ts}`
  - [ ] 5.3 — `infrastructure/external/identity-svc/identity-svc.client.ts` (HTTP call sync stripe status)
  - [ ] 5.4 — Entity + repo `stripe-events-inbox`
  - [ ] 5.5 — Controllers : `stripe-onboarding.controller.ts` + `stripe-webhooks.controller.ts` (avec `@RawBody()` Fastify)
  - [ ] 5.6 — UseCasesProxyModule wire 4 proxies
  - [ ] 5.7 — Tests integration via `stripe-mock` testcontainer

- [ ] **Task 6 — gateway-api endpoints + forwarder + webhook proxy** (AC: #5)
  - [ ] 6.1 — Forwarder `usecases/seller-onboarding/stripe-onboarding.forwarder.ts`
  - [ ] 6.2 — Controller `infrastructure/http/controllers/seller-onboarding.controller.ts` (4 endpoints)
  - [ ] 6.3 — Controller `infrastructure/http/controllers/stripe-webhooks.controller.ts` (raw body forward)
  - [ ] 6.4 — Throttle config
  - [ ] 6.5 — Tests E2E (8+ cases)

- [ ] **Task 7 — Frontend pages + hooks + dashboard banner** (AC: #6)
  - [ ] 7.1 — `packages/api-client/src/hooks/seller/use-stripe-onboarding.ts` (3 mutations)
  - [ ] 7.2 — `apps/seller/src/app/[locale]/seller/onboarding/stripe/page.tsx` (Server Component multi-state)
  - [ ] 7.3 — `apps/seller/src/app/[locale]/seller/onboarding/stripe/return/page.tsx`
  - [ ] 7.4 — `apps/seller/src/features/seller/onboarding/stripe/components/{StripeStatusCard,RequirementsList,TestModeBadge}.tsx`
  - [ ] 7.5 — Update `apps/seller/src/app/[locale]/seller/dashboard/page.tsx` (Story 1.4 placeholder) : ajouter banner conditional
  - [ ] 7.6 — Update messages FR/EN + Stripe requirements localization map (~30 keys)

- [ ] **Task 8 — Tests Playwright e2e + axe-core + perf** (AC: #9)
  - [ ] 8.1 — `apps/seller/e2e/onboarding/stripe.spec.ts` (8 tests cf. AC9)
  - [ ] 8.2 — Setup `stripe-mock` testcontainer + helpers
  - [ ] 8.3 — Run en CI + axe-core + perf NFR48 ≤ 3s p90 sync

- [ ] **Task 9 — Observability + runbooks + commit** (AC: #10)
  - [ ] 9.1 — Métriques Prom + Grafana dashboard
  - [ ] 9.2 — Slack alerts setup (signature failures, stuck requires_action, Stripe DOWN)
  - [ ] 9.3 — 2 runbooks `docs/runbook/stripe-connect-onboarding-debug.md` + `stripe-webhooks-security.md`
  - [ ] 9.4 — Update README + ADR-009 implementation notes (Story 1.10 Epic 1 close + Stripe Story 2.1 addendum)
  - [ ] 9.5 — Lint + typecheck + tests + coverage thresholds
  - [ ] 9.6 — Commit `feat(payment): Stripe Connect Express account creation + onboarding (payment-svc Pretre + Stripe SDK + 4 endpoints + 2 frontend pages + ProProfile stripe fields + webhook idempotent + 4 NATS events + Playwright e2e)` — Story 2.1 done

## Dev Notes

### Pourquoi Story 2.1 = 1ʳᵉ Epic 2 + payment-svc bootstrap

Story 2.1 ouvre Epic 2 (Pro Onboarding & Admin Verification) et **scaffolde payment-svc** (3ᵉ service Pretre after identity-svc Story 0.6 + gateway-api Story 1.2). Pattern réutilisable Stories 4.x (booking-svc) + 5.x (notification-svc) + 3.x (catalog-svc) — chaque epic ouvre généralement avec scaffolding du service primaire.

**Story 2.1 = template "external service onboarding via hosted URL + webhook"** — réutilisable :
- Story 9.x V1 (Stripe Billing subscription tier upgrade)
- Story 12.x V1+ (Stripe Identity KYC complet FR12 — réutilise stripe SDK + webhook)
- V2 SAML SSO (similaire pattern hosted URL + redirect + sync state)

### Décisions techniques majeures actées

1. **payment-svc state minimal Story 2.1** — pas de table `stripe_connect_accounts` locale, `stripeAccountId` stocké dans identity-svc.pro_profiles (cross-service field via sync HTTP). Stories 4.x créeront `payment_intents` table pour booking saga.
2. **Stripe SDK natif** : `stripe.webhooks.constructEvent` (HMAC verify built-in, timing-safe), `stripe.accounts.*` typed.
3. **Raw body Fastify** : webhook endpoint REQUIRES raw body (Stripe signature verify). Configure `addContentTypeParser` keep raw.
4. **PII redaction logger pino** : redact paths `request.body`, `response.data.account.individual.*`, `response.data.requirements.*` complets — log uniquement IDs + types + counts.
5. **idempotency via `stripe_events_inbox`** (pattern Story 1.10 `keycloak_events_inbox`).
6. **Account Link short TTL** (~5 min Stripe) : regenerate à chaque return / requires_action.
7. **Test mode** via `STRIPE_MODE=test|live` switch keys Doppler — badge UI.
8. **chargesAllowed combined check** : `kyc_status='approved' && stripe_status='submitted' && chargesEnabled && payoutsEnabled` — les 2 axes (Tukio admin KYC Story 2.5 + Stripe banking) doivent être OK.

### Versions à utiliser

| Lib | Rôle | Version |
|---|---|---|
| **`stripe`** | SDK officiel | latest stable v14+ (API version `2024-11-20.acacia` ou + récente) |
| **`stripe-mock`** | Testcontainer | latest (Stripe officiel) |
| Existing : pino + Story 0.7 outbox + Story 0.8 KeycloakJwtGuard | — | — |

### Project Structure cible

```
apps/payment-svc/                                      # NEW Story 2.1 (Pretre scaffolded)
├─ src/
│  ├─ domain/
│  │  ├─ model/stripe-connect-account.aggregate.ts    # minimal MVP
│  │  ├─ ports/{stripe-connect,pro-profile-syncer,stripe-events-inbox-repository}.port.ts
│  │  ├─ exception/{stripe-unreachable,webhook-invalid-signature,payment-conflict}.exception.ts
│  │  └─ value-objects/{stripe-account-id,stripe-status}.value-object.ts
│  ├─ usecases/{create-stripe-account,sync-stripe-status,handle-stripe-webhook,regenerate-account-link}.usecase.ts + spec
│  └─ infrastructure/
│     ├─ external/stripe/{stripe-connect.service.ts,errors.ts,stripe.module.ts}
│     ├─ external/identity-svc/identity-svc.client.ts
│     ├─ persistence/typeorm/{entities/stripe-events-inbox.entity.ts,repositories/stripe-events-inbox.typeorm.repository.ts,migrations/...}
│     └─ http/controllers/{stripe-onboarding.controller.ts,stripe-webhooks.controller.ts}

apps/identity-svc/src/
├─ infrastructure/persistence/typeorm/migrations/1715270000001-AddStripeFieldsToProProfiles.ts  # NEW
├─ domain/model/pro-profile.aggregate.ts             # UPDATE Story 1.3 — 3 méthodes + getter chargesAllowed
└─ infrastructure/http/controllers/pro.controller.ts # UPDATE Story 1.3 — endpoint POST /internal/pros/by-id/{id}/sync-stripe

apps/gateway-api/src/
├─ usecases/seller-onboarding/stripe-onboarding.forwarder.ts        # NEW
├─ usecases/webhooks/stripe-webhook.forwarder.ts                    # NEW
└─ infrastructure/http/controllers/{seller-onboarding,stripe-webhooks}.controller.ts  # NEW (2)

apps/seller/src/
├─ app/[locale]/seller/onboarding/stripe/{page.tsx,return/page.tsx}  # NEW (2)
├─ features/seller/onboarding/stripe/components/{StripeStatusCard,RequirementsList,TestModeBadge}.tsx  # NEW (3)
├─ app/[locale]/seller/dashboard/page.tsx                            # UPDATE — banner conditional
└─ messages/{fr,en}.json                                             # UPDATE — namespaces

packages/contracts/src/events/payment/stripe-account-{created,submitted,requires-action,updated}.v1.{schema.json,ts}  # NEW (8)
packages/contracts/src/dtos/seller-onboarding/stripe.dto.ts          # NEW
packages/contracts/src/types/stripe.ts                               # NEW

packages/api-client/src/hooks/seller/use-stripe-onboarding.ts        # NEW

infra/docker-compose/docker-compose.dev.yml                          # UPDATE — payment-svc + tukio_payment DB
infra/scripts/bootstrap-databases.sh                                 # UPDATE — tukio_payment DB

infra/k8s/grafana-dashboards/stripe-connect-onboarding.json          # NEW
docs/runbook/{stripe-connect-onboarding-debug,stripe-webhooks-security}.md  # NEW (2)

# Estimation total fichiers : ~70 nouveaux + ~10 updates = ~80 fichiers
```

### Critical Architecture Constraints

> Cf. Stories 0.6, 0.7, 1.2, 1.3, 1.10 + memories.

1. **Pretre strict** + boundaries lint enforced (réutilisé Story 0.6)
2. **Outbox transactional** + inbox idempotency (réutilisé Story 0.7 + 1.10)
3. **PII redaction logger pino** (NFR15+16)
4. **HMAC verify natif Stripe SDK** (security best practice)
5. **Raw body retention Fastify** webhook endpoint
6. **Envelope ADR-014** controllers retournent DTO nu
7. **EN strict** + **i18n strict** (memories)
8. **Latest stable Stripe SDK + API version** (memory `feedback_latest_versions.md`)

### Previous Story Intelligence

**Stories 0.6 + 0.7** : Pretre scaffolding template + outbox/inbox patterns — réutilisés payment-svc.

**Story 1.2** : KeycloakJwtGuard + RolesGuard + envelope errors — réutilisés gateway-api endpoints AC5.

**Story 1.3** : ProProfile aggregate + ProProfileEntity (Story 2.1 étend) + ProProfileRepo (Story 2.1 ajoute méthode update stripe fields).

**Story 1.10** : 🔴 audit_log NATS consumer (subscribe `payment.*`) + Phasetwo webhook bridge pattern (Story 2.1 réutilise pour Stripe webhooks idempotency `stripe_events_inbox` mirror `keycloak_events_inbox`).

**Story 1.10 handoff Epic 2** : doc déjà documente que Story 2.1 doit ajouter `pro_profiles.stripe_account_id` + extends `kyc_status` enum (AC2 livre la migration).

### What this story does NOT do (out of scope)

- ❌ **PaymentIntent creation booking saga** → Stories 4.x (Booking + Order + Payment saga)
- ❌ **Payouts UI** (`/seller/billing/payouts`) → Stories Epic 4 (Story 4.10 wire payouts cron)
- ❌ **Stripe Identity KYC complet** → V1 FR12 (réutilise Story 2.1 SDK)
- ❌ **Stripe Billing subscription tiers** → Story 9.x V1
- ❌ **Refunds + disputes** → Stories Epic 4 + Epic 10 V1
- ❌ **Multi-vendor splits** → Story 8.x V1 B2B Multi-vendor cart
- ❌ **3DS Secure / SCA** → Stories Epic 4 (PaymentIntent flow)
- ❌ **Cron sync Stripe daily reconciliation** → V1 (similar pattern Story 1.10 reconciliation)

### Files to UPDATE vs CREATE

(cf. Project Structure cible)

### Testing Standards

- Coverage ≥ 90 % use cases payment-svc + 80 % gateway endpoints + 80 % frontend
- Tests unit Vitest mocks + integration `stripe-mock` testcontainer + e2e Playwright
- Performance NFR48 ≤ 3s p90 sync-status
- Tests security : webhook signature mismatch, raw body integrity, PII redaction logs

### Project Structure Notes

✅ Aligné avec architecture lignes 135-136, 299, 2030, 2152-2164, 2383 + Stories 0.6/0.7/1.2/1.3/1.10 + memories.

⚠️ **Décision** : payment-svc state minimal MVP (no local stripe_connect_accounts table) — Stories 4.x créeront tables PaymentIntent.

⚠️ **Décision** : webhook endpoint = gateway-api proxied (pas direct payment-svc public) — cohérent ADR-008 gateway seul accès public + sécurité.

⚠️ **Décision** : 4 use cases distincts (create + sync + webhook + regenerate) — séparation concerns Pretre.

### References

- [Source: epics.md#Epic-2-Story-2.1 — Lines 1254-1268]
- [Source: prd.md#FR3, FR55-66, NFR15, NFR48, NFR75-79]
- [Source: architecture.md#Stripe-Connect-Express, lines 135, 299, 2030, 2152, 2383]
- [Source: 1-3-...md (ProProfile aggregate), 1-4-...md (middleware seller), 1-10-...md (audit consumer + webhook idempotency pattern + handoff Epic 2)]
- [External: https://docs.stripe.com/connect/express-accounts — Stripe Connect Express docs]
- [External: https://docs.stripe.com/api/account_links/create — Account Links API]
- [External: https://docs.stripe.com/connect/account-capabilities — capabilities (card_payments, transfers)]
- [External: https://docs.stripe.com/webhooks/signatures — Stripe webhook signature verification]
- [External: https://github.com/stripe/stripe-mock — stripe-mock testcontainer]
- [Memory: feedback_latest_versions.md, feedback_clean_architecture_explicit.md, feedback_api_envelope_response.md, feedback_tech_layer_english.md, feedback_i18n_frontend.md]

## Dev Agent Record

(à remplir)

---

## Story Completion Status

- **Story Status** : `ready-for-dev`
- **Created** : 2026-05-09
- **Created by** : `bmad-create-story` workflow
- **Epic** : Epic 2 — Pro Onboarding & Admin Verification (MVP)
- **Sprint cible** : Sprint 3 (1ʳᵉ story Epic 2)
- **Estimation effort** : 6-8 jours (1 dev fullstack senior — payment-svc scaffolding + Stripe SDK + 4 use cases + 2 frontend pages + webhook idempotent + extensive tests, ~80 fichiers)
- **Dépendances upstream** :
  - **Stories 0.6** (Pretre scaffolding template + replicate script)
  - **Story 0.7** (outbox/inbox patterns)
  - **Story 0.10** (Docker Compose update payment-svc + DB)
  - **Story 1.2** (gateway-api scaffolding + KeycloakJwtGuard)
  - **Story 1.3** (ProProfile aggregate)
  - **Story 1.4** (middleware seller dashboard banner ajout)
  - **Story 1.10** (audit_log consumer subscribe `payment.*` + handoff Epic 2 doc)
- **Dépendances downstream** :
  - **Story 2.2** (wizard 4 steps) — consume stripe_status pour step 2 complete
  - **Story 2.5** (Pro acceptation/rejet) — verifier stripe_status='submitted' avant acceptation
  - **Stories Epic 4** (booking saga) — consume `chargesAllowed` flag avant PaymentIntent
  - **Story 4.10** (payouts cron) — wire `payment.payout.*` events
  - **Story 5.4** (notification-svc) — consume 2 templates (`stripe-account-submitted`, `stripe-account-requires-action`)
  - **Story 9.x V1** (Stripe Billing subscription) — réutilise SDK + webhook pattern
  - **V1 FR12** (Stripe Identity KYC complet) — réutilise infra Story 2.1
- **FRs covered** :
  - **FR3 partial** ✅ KYC financier délégué Stripe (KYC docs Tukio Story 1.3 separate axis)
  - **FR55-56 partial** ✅ Pro reçoit payouts (mécanisme posé, payouts wire Story 4.10)
- **NFRs touchés** :
  - **NFR15** ✅ PII redaction webhook payload + logs
  - **NFR16** ✅ Pino redact PII config
  - **NFR48** ✅ UX onboarding < 30 min cumulatif
  - **NFR71** ✅ Coverage thresholds
  - **NFR75** ✅ Stripe webhooks unique endpoint payment-svc proxy gateway-api
  - **NFR81** ✅ payment-svc split deployment unit dès V0 prod (Helm chart Story 0.12)

> **Prochaine story → Story 2.2** (Pro onboarding wizard frontend 4 steps)

---

**Dev agent next steps :**
1. Lire ce file en entier
2. Vérifier upstream Stories 0.6/0.7/0.10/1.2/1.3/1.4/1.10 implémentées
3. **CRITIQUE Task 1** : lancer `replicate-pretre-structure.sh --target=payment-svc` AVANT Tasks 2-9
4. **PRÉREQ DEV** : créer compte Stripe Connect dev (https://dashboard.stripe.com/register) + récupérer keys test/live + configurer webhook endpoint dans Stripe Dashboard pointing vers `https://api.staging.tukio.one/v1/webhooks/stripe` (staging) — webhook secret généré par Stripe
5. Implémenter Tasks 1-9 dans l'ordre
6. Lancer après chaque jalon : `pnpm lint && pnpm typecheck && pnpm test --filter=payment-svc --coverage && pnpm playwright test --grep "stripe connect"`
7. Commit Story 2.1 quand : 8/8 e2e + coverage thresholds + axe-core 0 + perf OK + webhook signature security validé
8. Update sprint-status : `2-1-...: review` puis `done`
