# Story 1.6: Email verification flow (`POST /v1/auth/email/verify` + landing page)

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

**As a** Customer / Pro fraîchement registered (Story 1.2 / 1.3) avec `email_verified=false` dans Keycloak,
**I want** un flow de **vérification email auto-completing** : (a) je clique le lien `${PUBLIC_URL}/{locale}/auth/email/verify?token=<uuid>` reçu par email Resend (template `email-verify` Story 1.2 déjà publié), (b) Server Component pré-valide le token via `GET /v1/auth/email/verify/validate?token=...` (UX fluide — pas de form submit pour découvrir token expiré), (c) si valide, la page auto-trigger `POST /v1/auth/email/verify` avec le token + le user voit immédiatement `<EmptyState variant="success">` (Story 0.5) avec icône check + titre Fraunces "Email vérifié !" + CTA `"Continuer →"` qui redirige selon role/status (Customer → `customer.tukio.one/{locale}/account/dashboard`, Pro pending → `seller.tukio.one/{locale}/seller/onboarding/pending`, Pro active → `seller.tukio.one/{locale}/seller/dashboard`), (d) si token expiré (>7 jours) ou déjà utilisé, la page affiche `<EmptyState variant="warning">` "Lien expiré ou déjà utilisé" + CTA "Renvoyer un email de vérification" qui appelle `POST /v1/auth/email/resend` (rate-limit 1/5 min/IP + 5/heure/email anti-bomb), (e) backend identity-svc côté `POST /v1/auth/email/verify` valide le token DB `email_verification_tokens` Story 1.2 (existence + non-expiré + non-utilisé) → mark `used_at=NOW()` → Keycloak Admin API `users.update({id, emailVerified: true})` → publie NATS event `identity.email.verified.v1` (audit business consume Story 2.7 + analytics V1) → optionnel `notification.email.send.v1` confirmation `"Votre email est maintenant vérifié"` ; et **les pages `verify-email-required` finalisées** (placeholder Story 1.2) pour les 2 zones `apps/customer/[locale]/auth/verify-email-required/page.tsx` (FR17 — Customer non-vérifié essaie de checkout → middleware redirect ici) + `apps/seller/[locale]/auth/verify-email-required/page.tsx` (Pro non-vérifié — `<StepIndicator>` Story 0.5 "Vérification email" non validée, blocking onboarding wizard Story 2.2 steps suivants), avec form "Renvoyer le lien" + CTA secondaire "Modifier mon email" (déféré Story 1.8 V1 — placeholder Story 1.6),
**so that** les Stories 1.2 (Customer register) + 1.3 (Pro register) sont **utilisables end-to-end** (un user peut maintenant compléter le flow register → email reçu → click → vérifié → use platform), les Stories Epic 4-5 (booking, messaging, payment) ont leur **gating FR17 fonctionnel** (middleware Story 1.2 + Story 1.6 redirect), Story 2.2 (Pro onboarding wizard 4 steps) peut bloquer les steps suivants tant que email non vérifié, Story 5.4 (notification-svc Resend) consume le templateId `email-verify-confirmation` (NEW Story 1.6), et le **pattern complet "auto-verify on landing"** (Server Component pre-validate + auto POST + result render — différent de Story 1.5 password reset qui demande user action newPassword) devient template pour V1+ confirmation flows magic-links Phasetwo Story 1.1 AC8 (V2 admin invite via magic-link click).

> **Outcome attendu** : à la fin de cette story, un Customer registered Story 1.2 reçoit l'email Resend (visible MailHog `localhost:8025` en dev) → clique le lien `tukio.one/fr/auth/email/verify?token=<uuid>` → arrive sur la landing page qui montre brièvement un `<Spinner>` + message `"Vérification en cours..."` (~500ms) puis `<EmptyState variant="success">` avec icône check + Fraunces "Email vérifié !" + description + CTA `"Accéder à mon dashboard →"` qui redirige `customer.tukio.one/fr/account/dashboard` ; côté backend, le Keycloak user a `email_verified=true` (vérifiable via `kcadm.sh get users/<id>`), le token DB a `used_at=NOW()`, l'event NATS `identity.email.verified.v1` est publié, le user qui se reconnecte (Story 1.4) reçoit un JWT avec claim `email_verified: true` et peut maintenant accéder à `/customer/bookings/checkout` (FR17 unblocked) ; un Pro Story 1.3 verify son email → redirect `seller.tukio.one/fr/seller/onboarding/pending` (status `pending_admin_review` toujours bloquant — Story 1.6 ne change que `email_verified`, pas `tukio_status`) ; un user qui clique un token expiré (>7 jours) ou déjà utilisé voit la page warning + CTA "Renvoyer" → click → `POST /v1/auth/email/resend` génère un nouveau token + nouveau email → user verify avec nouveau lien ; un user qui spam le bouton "Renvoyer" 2× en 5 min reçoit `429 ErrorEnvelope` + message UI `"Patientez X min avant de demander un nouveau lien"` ; les pages `verify-email-required` finalisées sont fonctionnelles dans customer + seller (Story 1.2 placeholder remplacé) ; un test `pnpm playwright test --grep "email verify"` passe en FR ET EN, axe-core 0 violations, 10 scénarios (happy path Customer FR + EN, happy path Pro pending, token expired, token reused, resend valid, resend rate-limit, FR17 customer redirect, FR17 seller wizard step blocking, JWT claim refresh post-verify, mobile responsiveness).

## Acceptance Criteria

1. **AC1 — Frontend landing page `apps/public/[locale]/auth/email/verify?token=<uuid>` (auto-verify on landing)** : Given un user clique le lien email reçu post-register Story 1.2/1.3, When il arrive sur `tukio.one/{fr|en}/auth/email/verify?token=<uuid>`, Then :
   - **Server Component initial render** :
     - Layout `<PublicHeader>` + center container (réutilise pattern Stories 1.2-1.5)
     - Pré-validation server-side : fetch `GET /v1/auth/email/verify/validate?token=<uuid>` (côté Server Component — server-only fetch, pas exposé au client)
     - Si token invalide/expiré/utilisé → render directement `<EmptyState variant="warning">` Story 0.5 :
       - Title : `"Lien expiré ou déjà utilisé"` (FR) / `"Link expired or already used"` (EN)
       - Description : `"Le lien de vérification n'est plus valide. Demandez un nouveau lien ci-dessous."` (FR) / EN equivalent
       - CTA : `<ResendVerificationButton>` (Client Component) qui input email + appelle `POST /v1/auth/email/resend`
   - **Si token valide pré-validation** : render un `<EmailVerifyAutoTrigger>` (Client Component) qui :
     - Mount → display `<Spinner>` + message `"Vérification en cours..."` (~500ms-1s)
     - Auto-trigger `POST /v1/auth/email/verify` avec `{ token }` body (utilise `useVerifyEmail` mutation hook NEW Story 1.6)
     - Sur success → render `<EmptyState variant="success">` Story 0.5 :
       - Icon : check large terracotta `--color-success-500`
       - Title : `"Email vérifié !"` (FR) / `"Email verified!"` (EN), Fraunces 500
       - Description : `"Votre adresse email a été confirmée. Vous pouvez maintenant accéder à toutes les fonctionnalités de Tukio."` (FR) / EN equivalent
       - CTA primary : `<Button variant="primary" size="lg" asChild><Link href={postVerifyRedirect}>Accéder à mon dashboard →</Link></Button>` — `postVerifyRedirect` calculé dans la response API (cf. AC3) : `/account/dashboard` Customer / `/seller/onboarding/pending` Pro pending / `/seller/dashboard` Pro active
     - Sur error (token déjà invalidé entre pré-validation et POST — race condition rare) → render warning view (cf. ci-dessus)
   - **Pourquoi auto-trigger vs button click ?** : UX optimale — le user a DÉJÀ exprimé son intention en cliquant le lien email. Pas besoin d'un 2ème clic "Confirmer". Différent de Story 1.5 password reset où le user doit ENTRER un nouveau password (action active requise).
   - **i18n strict** (memory) : namespace `auth.emailVerify.*` (~12 keys) dans `apps/public/messages/{fr,en}.json`
   - **Accessibilité RGAA AA** : `role="status"` + `aria-live="polite"` sur le state pendant verification (Spinner + message), focus auto sur CTA après success
   - **Test Playwright e2e** (cf. AC9) : 10 cases dont happy path FR + EN, token expired, token reused, mobile responsiveness

2. **AC2 — Frontend pages finalisées `verify-email-required`** (apps customer + seller) : Given Story 1.2 a posé un placeholder dans `apps/customer/src/app/[locale]/auth/verify-email-required/page.tsx`, When je consulte cette page (et idem `apps/seller/`), Then :
   - **Layout** : Server Component qui détecte le user actuel via `getCurrentUser()` helper (lit JWT cookie `tukio-access-token` Story 1.4 + decode) — si pas authentifié, redirect `/auth/login?next={current}`. Si authentifié + `email_verified=true` (cas où middleware avait redirected mais user a verified depuis dans un autre tab), redirect dashboard direct.
   - **Hero** : `<EmptyState variant="warning">` (Story 0.5) :
     - Icon : envelope clock terracotta
     - Title : `"Vérifiez votre email pour continuer"` (FR) / `"Verify your email to continue"` (EN)
     - Description : `"Un email de vérification a été envoyé à <strong>{userEmail}</strong>. Cliquez le lien pour activer votre compte et accéder à {nextFeatureLabel}."` (FR) / EN — `nextFeatureLabel` dépend de `?next` query param ("la réservation" pour `/cart/checkout`, "votre dashboard" default, "les messages" pour `/messages`, etc.)
   - **CTA primary** : `<Button>Renvoyer le lien</Button>` (Client Component qui appelle `POST /v1/auth/email/resend` avec rate-limit 1/5 min/IP + 5/h/email — voir AC5)
   - **Footer secondary** : `<small>Pas reçu ? Vérifiez votre dossier spam ou <Link href="/{locale}/help/email-not-received">consultez l'aide</Link>.</small>`
   - **Lien tertiaire** (V1 placeholder) : `<small>Mauvais email ? <Link href="/{locale}/account/profile">Modifier mon email</Link></small>` — Story 1.8 V1 finalise email change flow ; au MVP, ce lien renvoie vers la page profil (Story 1.8) qui aura un message "Email change disponible V1, contactez le support".
   - **Display state post-resend** : après click "Renvoyer", afficher inline `<Toast variant="success">Email renvoyé. Vérifiez votre boîte.</Toast>` (Story 0.4 atomic) + désactiver le bouton 5 min (countdown timer client-side)
   - **i18n** : namespace `auth.verifyEmailRequired.*` (Story 1.2 placeholder a posé partial — Story 1.6 finalise)
   - **Différence Customer vs Seller pages** :
     - **Customer page** : standalone EmptyState (cf. ci-dessus)
     - **Seller page** : intégrée dans le wizard Pro onboarding (Story 2.2 V1) — au MVP Story 1.6 c'est juste une page standalone similaire à customer ; Story 2.2 wrappera cette page dans un `<StepIndicator>` "Step 1 - Vérification email" (non validée) + steps suivants greyed out
     - **Décision MVP** : Story 1.6 livre 2 pages standalone avec wording légèrement différent (customer mentionne "réservations + messages + favoris", seller mentionne "publier services + recevoir des demandes")
   - **Tests E2E** : naviguer apps/customer/cart sans email_verified → middleware redirect ici (Story 1.2 wired) → vérifier page rendered + CTA fonctionnel + click resend → POST appelé + toast → 2ème click avant 5 min → bouton disabled

3. **AC3 — gateway-api endpoint `POST /v1/auth/email/verify` + `GET /v1/auth/email/verify/validate`** : Given `apps/gateway-api/src/infrastructure/http/controllers/auth-email-verify.controller.ts` (NEW), When un client appelle :
   - **Endpoint `POST /v1/auth/email/verify`** :
     ```ts
     @Controller('/v1/auth/email/verify')
     export class AuthEmailVerifyController {
       @Post('/')
       @Public()
       @HttpCode(200)
       @Throttle({ 'email-verify-confirm': { limit: 10, ttl: 60_000 } }) // 10/min/IP — token-based, peu abusable
       async verify(@Body() dto: EmailVerifyInput): Promise<EmailVerifyResponse> {
         return this.emailVerifyForwarder.getInstance().verify(dto);
       }

       @Get('/validate')
       @Public()
       @HttpCode(200)
       @Throttle({ 'email-verify-validate': { limit: 30, ttl: 60_000 } })
       async validate(@Query('token') token: string): Promise<{ valid: boolean }> {
         return this.emailVerifyForwarder.getInstance().validate({ token });
       }
     }
     ```
   - **Validation Zod** : `EmailVerifyInputSchema` = `z.object({ token: z.string().uuid() })`
   - **Réponse success** :
     ```json
     {
       "method": "POST",
       "code": 200,
       "data": {
         "userId": "uuid",
         "email": "user@example.com",
         "emailVerified": true,
         "postVerifyRedirect": "https://customer.tukio.one/fr/account/dashboard",
         "role": "client",
         "tukioStatus": "active"
       },
       "meta": { ... }
     }
     ```
   - **postVerifyRedirect computed côté gateway-api** (after identity-svc verify) basé sur user JWT claims fresh-fetched via `GET /internal/users/by-keycloak-id/{id}` ou directement depuis le user_profile retourné par identity-svc : Customer → `${CUSTOMER_BASE_URL}/{locale}/account/dashboard`, Pro pending → `${SELLER_BASE_URL}/{locale}/seller/onboarding/pending`, Pro active → `${SELLER_BASE_URL}/{locale}/seller/dashboard`
   - **Réponse error** :
     - Token invalide/expiré/utilisé → `410 ErrorEnvelope { tukioCode: 'IDENTITY-EXPIRED-001' }` (réutilise code Story 1.5)
     - Token UUID format invalide → `422 ErrorEnvelope { tukioCode: 'VALIDATION-FAILED-001' }`
     - Keycloak DOWN → `502 ErrorEnvelope { tukioCode: 'IDENTITY-EXTERNAL-001' }`
   - **Endpoint `GET /v1/auth/email/verify/validate?token=<uuid>`** : retourne `{ valid: true }` ou `{ valid: false }` (200 toujours, pas 404 — pattern Story 1.5 AC5)
   - **Tests E2E** : valid token → 200 + emailVerified true + redirect URL. Token expiré → 410. Token reused → 410. Token UUID invalid → 422. Keycloak DOWN (mock) → 502.

4. **AC4 — gateway-api endpoint `POST /v1/auth/email/resend` (rate-limit strict)** : Given le user demande un nouveau token, When il appelle `POST /v1/auth/email/resend` :
   - **Endpoint** :
     ```ts
     @Post('/resend')
     @Public()
     @HttpCode(200)
     @Throttle({ 'email-resend-ip': { limit: 1, ttl: 5 * 60_000 } }) // 1/5min/IP
     // NB : limit complementary 5/hour/email enforced côté identity-svc (anti-bomb à un user spécifique)
     async resend(@Body() dto: EmailResendInput): Promise<{ message: string }> {
       return this.emailVerifyForwarder.getInstance().resend(dto);
     }
     ```
   - **Validation Zod** : `EmailResendInputSchema` = `z.object({ email: z.string().email() })`
   - **Réponse 200 enveloppée générique** (anti-énumération NFR9 même pattern Story 1.5 AC3) — toujours 200 même si email inconnu :
     ```json
     {
       "method": "POST",
       "code": 200,
       "data": { "message": "Si un compte existe pour cet email, un nouveau lien de vérification a été envoyé." },
       "meta": { ... }
     }
     ```
   - **Behavior backend** (cf. AC7) :
     - Si email inconnu → 200 generic + ne rien faire (aucun email envoyé)
     - Si user déjà email_verified → 200 generic + ne rien faire (pas la peine de renvoyer)
     - Si user existe + non-vérifié → invalider tous tokens existants `email_verification_tokens` du user (set `used_at = NOW()`) + créer un NOUVEAU token UUID v4 + 7 jours TTL + publier NATS event `notification.email.send.v1`
   - **Rate-limit dual-axis** :
     - Per-IP : `1/5 min` (gateway-api throttler Redis)
     - Per-email : `5/hour` (identity-svc business logic — count rows in `email_verification_tokens` for user_profile_id WHERE created_at > NOW() - 1 hour) — si dépassé, return 200 generic (anti-énumération + anti-bomb)
   - **429 response** : header `Retry-After: <seconds>` + tukioCode `RATE-LIMIT-EXCEEDED-001`
   - **Tests E2E** : valid email + non-verified user → 200 + nouveau token créé + email re-envoyé. Inconnu email → 200 generic (no email sent). Email déjà verified → 200 generic (no action). 2ᵉ resend même IP en 5min → 429. 6ᵉ resend même email en 1h → 200 generic (silent block).

5. **AC5 — identity-svc `VerifyEmailUseCase` + `ResendEmailVerificationUseCase` + `ValidateEmailVerificationTokenUseCase`** : Given Pretre architecture, When je consulte `apps/identity-svc/src/usecases/`, Then 3 use cases :
   - **`VerifyEmailUseCase`** (NEW — `apps/identity-svc/src/usecases/verify-email.usecase.ts`) :
     ```ts
     @Injectable()
     export class VerifyEmailUseCase {
       constructor(
         @Inject(USER_PROFILE_REPOSITORY) private readonly userProfileRepo: IUserProfileRepository,
         @Inject(EMAIL_VERIFICATION_TOKEN_REPOSITORY) private readonly tokenRepo: IEmailVerificationTokenRepository, // Story 1.2 a posé
         @Inject(KEYCLOAK_ADMIN) private readonly keycloakAdmin: IKeycloakAdmin,
         @Inject(EVENT_PUBLISHER) private readonly eventPublisher: IEventPublisher,
       ) {}

       async execute(input: { token: string }): Promise<{ userId: string; email: string; emailVerified: true; role: Role; tukioStatus: TukioStatus }> {
         // 1. Validate token
         const tokenRecord = await this.tokenRepo.findByToken(input.token);
         if (!tokenRecord) throw new IdentityExpiredException('IDENTITY-EXPIRED-001', 'Verification link is invalid');
         if (tokenRecord.usedAt) throw new IdentityExpiredException('IDENTITY-EXPIRED-001', 'Verification link has already been used');
         if (tokenRecord.expiresAt < new Date()) throw new IdentityExpiredException('IDENTITY-EXPIRED-001', 'Verification link has expired');

         // 2. Lookup user
         const userProfile = await this.userProfileRepo.findById(tokenRecord.userId);
         if (!userProfile || userProfile.deletedAt) throw new IdentityExpiredException('IDENTITY-EXPIRED-001', 'User not found');
         if (userProfile.emailVerified) {
           // Idempotent : user déjà vérifié (cas edge) — mark token used + return success
           await this.tokenRepo.markUsed(input.token);
           return { userId: userProfile.id, email: userProfile.email.value, emailVerified: true, role: userProfile.role, tukioStatus: userProfile.tukioStatus };
         }

         // 3. Update Keycloak emailVerified=true (compensable)
         try {
           await this.keycloakAdmin.updateUser({
             keycloakUserId: userProfile.keycloakUserId,
             updates: { emailVerified: true },
           });
         } catch (e) {
           if (e instanceof KeycloakUnreachableError) throw new ExternalServiceException('IDENTITY-EXTERNAL-001', 'Keycloak unreachable');
           throw e;
         }

         // 4. Update local user_profiles.email_verified mirror + mark token used + publish events (atomic)
         await this.userProfileRepo.runInTransaction(async (txn) => {
           userProfile.markEmailVerified(); // domain method — sets emailVerified=true + updatedAt
           await txn.userProfileRepo.save(userProfile);
           await txn.emailVerificationTokenRepo.markUsed(input.token);

           // Event 1 — audit business event
           await txn.eventPublisher.publish({
             eventType: 'identity.email.verified',
             eventVersion: 'v1',
             aggregate: { type: 'UserProfile', id: userProfile.id },
             actor: { userId: userProfile.id, role: userProfile.role },
             payload: {
               userProfileId: userProfile.id,
               email: userProfile.email.value,
               role: userProfile.role,
               tukioStatus: userProfile.tukioStatus,
               verifiedAt: new Date().toISOString(),
             },
             // ...
           });

           // Event 2 — confirmation email (optionnel)
           await txn.eventPublisher.publish({
             eventType: 'notification.email.send',
             eventVersion: 'v1',
             // ...
             payload: {
               templateId: 'email-verify-confirmation',
               locale: userProfile.locale,
               to: { email: userProfile.email.value, userId: userProfile.id, name: `${userProfile.firstName} ${userProfile.lastName}` },
               params: { firstName: userProfile.firstName, verifiedAt: new Date().toISOString() },
             },
           });
         });

         return { userId: userProfile.id, email: userProfile.email.value, emailVerified: true, role: userProfile.role, tukioStatus: userProfile.tukioStatus };
       }
     }
     ```
   - **`ResendEmailVerificationUseCase`** (NEW — `apps/identity-svc/src/usecases/resend-email-verification.usecase.ts`) :
     ```ts
     async execute(input: { email: string }): Promise<{ message: string }> {
       const genericResponse = { message: 'If an account exists for this email and is not yet verified, a new verification link has been sent.' };

       const userProfile = await this.userProfileRepo.findByEmail(input.email);

       if (!userProfile || userProfile.deletedAt) return genericResponse; // anti-énumération
       if (userProfile.emailVerified) return genericResponse; // already verified — silent
       
       // Per-email rate-limit check (5/hour)
       const recentTokensCount = await this.tokenRepo.countRecentTokens(userProfile.id, 60); // last 60 min
       if (recentTokensCount >= 5) return genericResponse; // silent rate-limit
       
       // Generate new token + invalidate previous unused tokens
       const newToken = randomUUID();
       const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

       await this.userProfileRepo.runInTransaction(async (txn) => {
         await txn.emailVerificationTokenRepo.invalidateAllForUser(userProfile.id); // mark all unused as used
         await txn.emailVerificationTokenRepo.save({ token: newToken, userId: userProfile.id, expiresAt });
         await txn.eventPublisher.publish({
           eventType: 'notification.email.send',
           // ... template 'email-verify' (réutilise template Story 1.2)
           payload: {
             templateId: 'email-verify',
             locale: userProfile.locale,
             to: { email: userProfile.email.value, userId: userProfile.id, name: `${userProfile.firstName} ${userProfile.lastName}` },
             params: {
               firstName: userProfile.firstName,
               verifyUrl: `${this.config.getPublicBaseUrl()}/${userProfile.locale}/auth/email/verify?token=${newToken}`,
               expiresAt: expiresAt.toISOString(),
             },
           },
         });
       });

       return genericResponse;
     }
     ```
   - **`ValidateEmailVerificationTokenUseCase`** (NEW) — pour endpoint AC3 GET /validate :
     ```ts
     async execute(input: { token: string }): Promise<{ valid: boolean }> {
       const t = await this.tokenRepo.findByToken(input.token);
       if (!t || t.usedAt || t.expiresAt < new Date()) return { valid: false };
       return { valid: true };
     }
     ```
   - **Tests unit** (`*.usecase.spec.ts`) avec ≥ 90 % coverage : 8+ cases per use case (happy path, token invalid/expired/used, user already verified, Keycloak DOWN, anti-énumération, rate-limit per-email)

6. **AC6 — identity-svc UserProfile aggregate extension `markEmailVerified()` + repository extension** (UPDATE Story 1.2 + Story 0.6) : Given le scope domain, When je consulte `apps/identity-svc/src/domain/`, Then :
   - **Update `apps/identity-svc/src/domain/model/user-profile.aggregate.ts`** (Story 1.2) : ajouter méthode :
     ```ts
     markEmailVerified(): void {
       if (this.emailVerified) return; // idempotent
       this.emailVerified = true;
       this.updatedAt = new Date();
     }
     ```
   - **Update `apps/identity-svc/src/domain/ports/email-verification-token-repository.port.ts`** (Story 1.2) : ajouter méthodes :
     ```ts
     countRecentTokens(userId: string, minutesAgo: number): Promise<number>;
     invalidateAllForUser(userId: string): Promise<void>; // sets used_at=NOW() for all rows where userId match AND used_at IS NULL
     ```
   - **Update `apps/identity-svc/src/domain/ports/keycloak-admin.port.ts`** (Story 1.2) : ajouter méthode `updateUser({ keycloakUserId, updates: Partial<{ emailVerified, firstName, lastName, locale }> })` — generic update method (utilisé Story 1.6 + future Stories 1.8 profile update)

7. **AC7 — identity-svc infrastructure : Keycloak update method + repo extensions + controller** : Given AC5 + AC6, When je consulte `apps/identity-svc/src/infrastructure/`, Then :
   - **Update `apps/identity-svc/src/infrastructure/external/keycloak/keycloak-admin.service.ts`** (Story 1.2) : ajouter `updateUser` impl utilisant `kcAdminClient.users.update({ realm: 'tukio', id: keycloakUserId }, updates)`
   - **Update `apps/identity-svc/src/infrastructure/persistence/typeorm/repositories/email-verification-token.typeorm.repository.ts`** (Story 1.2) : ajouter `countRecentTokens` (SQL `SELECT COUNT(*) WHERE user_id = $1 AND created_at > NOW() - INTERVAL '$2 minutes'`) + `invalidateAllForUser` (UPDATE SET used_at=NOW() WHERE user_id=$1 AND used_at IS NULL)
   - **Créer `apps/identity-svc/src/infrastructure/http/controllers/email-verify.controller.ts`** (NEW) : 3 endpoints `/internal/email-verify/{verify,resend,validate}` protégés par `InternalServiceGuard` Story 1.2
   - **Créer DTOs** `apps/identity-svc/src/infrastructure/http/dtos/{email-verify-input,email-resend-input,email-verify-validate}.dto.ts`
   - **Update `apps/identity-svc/src/infrastructure/usecases-proxy/usecases-proxy.module.ts`** : ajouter 3 proxies (VERIFY, RESEND, VALIDATE)
   - **Update `apps/identity-svc/src/infrastructure/http/http.module.ts`** : ajouter `EmailVerifyController`
   - **Tests integration `email-verify.controller.e2e-spec.ts`** : 8+ cases (cf. AC5 tests)

8. **AC8 — `@tukio/contracts` extensions : event `identity.email.verified.v1` + email template `email-verify-confirmation` + DTOs** : Given AC1-AC5, When je consulte `packages/contracts/src/`, Then :
   - **NEW `events/identity/email-verified.v1.{schema.json,ts}`** : audit event avec payload `{ userProfileId, email, role, tukioStatus, verifiedAt }`
   - **NEW `dtos/identity/email-verify.dto.ts`** :
     - `EmailVerifyInputSchema` = `z.object({ token: z.string().uuid() })`
     - `EmailResendInputSchema` = `z.object({ email: z.string().email() })`
     - `EmailVerifyResponseSchema` = `z.object({ userId: z.string().uuid(), email: z.string().email(), emailVerified: z.literal(true), postVerifyRedirect: z.string().url(), role: RoleSchema, tukioStatus: TukioStatusSchema })`
   - **UPDATE `types/email-templates.ts`** : ajouter `'email-verify-confirmation'` templateId (le `'email-verify'` est déjà ajouté Story 1.2)
   - **Build pipeline** : `pnpm --filter=@tukio/contracts build && test` — vérifier types générés

9. **AC9 — Tests Playwright e2e flow FR/EN + axe-core (NFR48 + UX-DR10)** : Given `apps/public/e2e/auth/email-verify.spec.ts` (NEW), When je lance `pnpm --filter=apps/public test:e2e --grep "email verify"`, Then 10 tests :
   - **Test 1 (happy path Customer FR)** : précréer Customer registered Story 1.2 → récupérer le token via testcontainer Postgres direct query (`SELECT token FROM email_verification_tokens WHERE user_id = ?`) → naviguer `localhost:3000/fr/auth/email/verify?token=<uuid>` → vérifier rendering : Spinner brief → success EmptyState `"Email vérifié !"` + CTA `"Accéder à mon dashboard"` → click CTA → redirect `customer.tukio.one/fr/account/dashboard`
   - **Test 2 (happy path Customer EN)** : idem en `/en/auth/email/verify?token=<uuid>` → UI EN + redirect `customer.tukio.one/en/account/dashboard`
   - **Test 3 (happy path Pro pending)** : précréer Pro registered Story 1.3 (status pending_admin_review) → verify → vérifier redirect `seller.tukio.one/fr/seller/onboarding/pending`
   - **Test 4 (token expired)** : insérer token avec `expires_at = NOW() - INTERVAL '1 day'` → naviguer `verify?token=<uuid>` → vérifier render direct warning EmptyState (Server Component pré-validation) + CTA "Renvoyer"
   - **Test 5 (token reused)** : insérer token avec `used_at = NOW()` → vérifier render warning
   - **Test 6 (token UUID invalid)** : naviguer `verify?token=not-a-uuid` → 422 → render warning generic
   - **Test 7 (resend valid)** : précréer Customer non-vérifié + token expiré → naviguer `verify?token=<expired>` → click CTA "Renvoyer un email" → input email → submit → vérifier 200 generic + nouveau token créé en DB + nouveau email reçu via MailHog
   - **Test 8 (resend rate-limit)** : 2 resend même IP en 5 min → 2ème → 429 + UI message countdown
   - **Test 9 (FR17 customer redirect)** : login Customer non-vérifié → naviguer `customer.tukio.one/fr/cart/checkout` → middleware redirect `/fr/auth/verify-email-required?next=...` → vérifier page render avec email du user + CTA fonctionnel
   - **Test 10 (FR17 seller wizard step blocking)** : login Pro non-vérifié → naviguer `seller.tukio.one/fr/seller/onboarding` → vérifier `<StepIndicator>` step "Vérification email" affiché non validé + steps suivants greyed out (NB: Story 2.2 wrappera, Story 1.6 vérifie juste le redirect middleware)
   - **Test axe-core** : sur les 3 pages (verify landing, verify-email-required customer, verify-email-required seller) — 0 violations critical/serious
   - **Test perf** : page.goto verify?token=valid → success rendered → ≤ 2s p90 (10 runs p9)
   - **Coverage** : ≥ 80 % gateway-api endpoints, ≥ 90 % identity-svc 3 use cases, ≥ 80 % frontend pages

10. **AC10 — Documentation runbook + observability + email template contract `email-verify-confirmation`** : Given le scope cross-cutting Story 1.6, When je consulte `docs/`, Then :
    - **`docs/runbook/email-verification-debug.md`** (NEW ~70 lignes) : flow end-to-end + troubleshooting (token not found, Keycloak DOWN, JWT pas refreshed après verify — user doit relogin, NATS event lag, MailHog inbox vide)
    - **`docs/runbook/email-verify-vs-keycloak-required-action.md`** (NEW ~30 lignes) : justification de NE PAS utiliser `Required Action: VERIFY_EMAIL` Keycloak (au profit de Resend templates Story 5.4) — cohérent Story 1.1 décision Dev Notes
    - **Update `packages/contracts/README.md`** : section "Identity events" ajouter `identity.email.verified.v1` + section "Email templates" ajouter `email-verify-confirmation`
    - **Email template contract `email-verify-confirmation.{fr,en}.tsx`** (Story 5.4 — Story 1.6 fournit le payload contract) :
      - Subject FR : `"Bienvenue sur Tukio - Email vérifié"` / EN : `"Welcome to Tukio - Email verified"`
      - Body : greeting + confirmation + CTA "Accéder à mon dashboard" + small print
    - **Métriques Prometheus** : `tukio_email_verify_attempts_total{result=success|expired|reused|external_error}`, `tukio_email_resend_attempts_total{result=success|rate_limited|already_verified|unknown_email}`, `tukio_email_verify_latency_seconds`
    - **Dashboard Grafana** (`infra/k8s/grafana-dashboards/email-verification.json`) : 4 panels (verify funnel success rate, resend rate, expired/reused token rate, JWT refresh post-verify lag)
    - **JWT refresh post-verify** : **important UX note** — quand un user verify son email, son JWT actuel a toujours `email_verified=false` (Keycloak update n'invalide pas le JWT). Le user doit soit (a) attendre 5 min token expiry + silent refresh Story 1.4, soit (b) être logged out et re-login. **Décision MVP** : afficher un message inline post-verify "Vous serez automatiquement reconnecté dans quelques secondes..." + force `POST /v1/auth/refresh` côté frontend qui re-fetch JWT incluant nouveau claim `email_verified: true`. Documenter dans runbook.

## Tasks / Subtasks

- [ ] **Task 1 — Étendre `@tukio/contracts` avec event + DTOs + email template** (AC: #8)
  - [ ] 1.1 — Créer `packages/contracts/src/events/identity/email-verified.v1.{schema.json,ts}`
  - [ ] 1.2 — Créer `packages/contracts/src/dtos/identity/email-verify.dto.ts` (3 schemas : input verify, input resend, response)
  - [ ] 1.3 — Update `packages/contracts/src/types/email-templates.ts` : ajouter `'email-verify-confirmation'`
  - [ ] 1.4 — Update barrel exports + `pnpm build && test`

- [ ] **Task 2 — identity-svc : domain extensions** (AC: #6)
  - [ ] 2.1 — Update `apps/identity-svc/src/domain/model/user-profile.aggregate.ts` (Story 1.2) : ajouter `markEmailVerified()` méthode
  - [ ] 2.2 — Update `apps/identity-svc/src/domain/ports/email-verification-token-repository.port.ts` (Story 1.2) : ajouter `countRecentTokens` + `invalidateAllForUser`
  - [ ] 2.3 — Update `apps/identity-svc/src/domain/ports/keycloak-admin.port.ts` (Story 1.2) : ajouter `updateUser` méthode generic
  - [ ] 2.4 — Tests unit aggregate `markEmailVerified` (idempotent, set true, updatedAt updated)

- [ ] **Task 3 — identity-svc : 3 use cases + tests** (AC: #5)
  - [ ] 3.1 — Créer `apps/identity-svc/src/usecases/verify-email.usecase.ts` (cf. AC5 squelette)
  - [ ] 3.2 — Créer `apps/identity-svc/src/usecases/resend-email-verification.usecase.ts`
  - [ ] 3.3 — Créer `apps/identity-svc/src/usecases/validate-email-verification-token.usecase.ts`
  - [ ] 3.4 — Tests unit `*.usecase.spec.ts` (3 fichiers, 8+ cases each, mocks ports) — coverage ≥ 90 %

- [ ] **Task 4 — identity-svc : infrastructure (Keycloak update + repo extensions)** (AC: #7)
  - [ ] 4.1 — Update `apps/identity-svc/src/infrastructure/external/keycloak/keycloak-admin.service.ts` (Story 1.2) : ajouter `updateUser` impl
  - [ ] 4.2 — Update `apps/identity-svc/src/infrastructure/persistence/typeorm/repositories/email-verification-token.typeorm.repository.ts` (Story 1.2) : ajouter `countRecentTokens` + `invalidateAllForUser`
  - [ ] 4.3 — Update `runInTransaction` context type (Story 1.2) : déjà inclut `emailVerificationTokenRepo` — confirmer accès
  - [ ] 4.4 — Tests integration : Postgres testcontainer + Keycloak testcontainer + tester les 3 méthodes ajoutées

- [ ] **Task 5 — identity-svc : controller + DTOs + module wiring** (AC: #7)
  - [ ] 5.1 — Créer `apps/identity-svc/src/infrastructure/http/controllers/email-verify.controller.ts` (3 endpoints)
  - [ ] 5.2 — Créer DTOs Zod pipes (3 fichiers)
  - [ ] 5.3 — Update `usecases-proxy.module.ts` : ajouter 3 proxies
  - [ ] 5.4 — Update `http.module.ts` : ajouter `EmailVerifyController`
  - [ ] 5.5 — Tests E2E `apps/identity-svc/test/email-verify.e2e-spec.ts` (8+ cases)

- [ ] **Task 6 — gateway-api : 3 endpoints + forwarder + throttle** (AC: #3, #4)
  - [ ] 6.1 — Update `apps/gateway-api/src/domain/ports/identity-svc.port.ts` : ajouter 3 méthodes (verify, resend, validate)
  - [ ] 6.2 — Créer `apps/gateway-api/src/usecases/auth/email-verify.forwarder.ts`
  - [ ] 6.3 — Update `apps/gateway-api/src/infrastructure/external/identity-svc/identity-svc.client.ts` : ajouter 3 méthodes
  - [ ] 6.4 — Créer `apps/gateway-api/src/infrastructure/http/controllers/auth-email-verify.controller.ts`
  - [ ] 6.5 — Update `app.module.ts` : ajouter controller + 3 throttler configs (`email-verify-confirm` 10/min, `email-verify-validate` 30/min, `email-resend-ip` 1/5min)
  - [ ] 6.6 — Helper `apps/gateway-api/src/infrastructure/http/utils/post-verify-redirect-resolver.ts` : compute redirect URL based on role + status (réutilise pattern Story 1.4 callback redirect logic)
  - [ ] 6.7 — Tests E2E `apps/gateway-api/test/auth/auth-email-verify.e2e-spec.ts` (10+ cases)

- [ ] **Task 7 — Frontend : landing page + verify-email-required pages finalize** (AC: #1, #2)
  - [ ] 7.1 — Créer `packages/api-client/src/hooks/identity/use-email-verify.ts` (3 mutations + 1 query)
  - [ ] 7.2 — Créer `apps/public/src/app/[locale]/auth/email/verify/page.tsx` (Server Component avec pré-validation token via fetch interne)
  - [ ] 7.3 — Créer `apps/public/src/features/auth/email-verify/components/{EmailVerifyAutoTrigger,EmailVerifyExpiredView,ResendVerificationButton}.tsx`
  - [ ] 7.4 — Update `apps/customer/src/app/[locale]/auth/verify-email-required/page.tsx` (Story 1.2 placeholder) : finalize avec EmptyState + CTA Renvoyer + auth context check
  - [ ] 7.5 — Créer `apps/seller/src/app/[locale]/auth/verify-email-required/page.tsx` (NEW — pattern similaire customer mais wording Pro)
  - [ ] 7.6 — Update `apps/public/messages/{fr,en}.json` : namespace `auth.emailVerify.*` (~20 keys)
  - [ ] 7.7 — Update `apps/customer/messages/{fr,en}.json` : finalize namespace `auth.verifyEmailRequired.*` (Story 1.2 placeholder)
  - [ ] 7.8 — Update `apps/seller/messages/{fr,en}.json` : ajouter namespace `auth.verifyEmailRequired.*`

- [ ] **Task 8 — Frontend : JWT refresh post-verify pour propager email_verified=true claim** (AC: #1, #10)
  - [ ] 8.1 — Update `EmailVerifyAutoTrigger` Component : après success POST /v1/auth/email/verify, trigger `POST /v1/auth/refresh` côté frontend pour obtenir un JWT mis à jour avec `email_verified: true` claim
  - [ ] 8.2 — Helper `packages/auth-client/src/refresh/force-refresh.ts` : utility qui force un refresh avant TTL natural expiry
  - [ ] 8.3 — Tests : vérifier que post-verify, le user peut accéder à `/cart/checkout` (Customer) ou `/seller/listings/new` (Pro active) sans avoir à logout/login

- [ ] **Task 9 — Tests Playwright e2e flow FR/EN + axe-core + perf NFR48** (AC: #9)
  - [ ] 9.1 — Créer `apps/public/e2e/auth/email-verify.spec.ts` avec 10 tests (cf. AC9)
  - [ ] 9.2 — Helper `apps/public/e2e/helpers/get-verify-token-from-db.ts` : query Postgres testcontainer pour obtenir le token from `email_verification_tokens`
  - [ ] 9.3 — Helper `apps/public/e2e/helpers/insert-expired-verify-token.ts` : insérer un token avec expires_at past
  - [ ] 9.4 — Run Playwright en CI : `pnpm --filter=apps/public test:e2e --grep "email verify"`
  - [ ] 9.5 — Vérifier 0 axe-core violations sur 3 pages
  - [ ] 9.6 — Vérifier perf NFR48 ≤ 2s p90 verify

- [ ] **Task 10 — Observability + runbooks + commit** (AC: #10)
  - [ ] 10.1 — Ajouter métriques Prom gateway-api + identity-svc
  - [ ] 10.2 — Créer `infra/k8s/grafana-dashboards/email-verification.json` (4 panels)
  - [ ] 10.3 — Créer `docs/runbook/email-verification-debug.md` (~70 lignes)
  - [ ] 10.4 — Créer `docs/runbook/email-verify-vs-keycloak-required-action.md` (~30 lignes)
  - [ ] 10.5 — Update `packages/contracts/README.md` : section Identity events + email templates
  - [ ] 10.6 — Lint + typecheck + tests
  - [ ] 10.7 — Vérifier coverage thresholds
  - [ ] 10.8 — Commit `feat(auth): email verification flow end-to-end (landing page auto-trigger + 3 endpoints + Resend resend + finalize verify-email-required pages customer/seller + identity.email.verified.v1 audit event + Playwright e2e FR/EN with MailHog)` — Story 1.6 done

## Dev Notes

### Pourquoi Story 1.6 = closing du loop register Stories 1.2/1.3

> **Sources** : `_bmad-output/planning-artifacts/architecture.md` §Auth + §Audit ; `_bmad-output/planning-artifacts/prd.md` §FR8 (verify email required), §FR17 (block transactional unverified), §NFR9, NFR48, NFR71 ; `_bmad-output/planning-artifacts/epics.md` §Story 1.6 (lignes 1163-1176) ; `_bmad-output/planning-artifacts/ux-design-specification.md` UX-DR10 (verification landing page — gap MVP critique flagged) ; Stories 1.1, 1.2, 1.3, 1.4, 1.5 + memories.

Stories 1.2/1.3 register créent les users + génèrent des tokens dans `email_verification_tokens` + publient `notification.email.send.v1` template `email-verify`. Story 5.4 envoie l'email via Resend. **Story 1.6 ferme la boucle** : le user clique le lien → token validé → Keycloak `email_verified=true` → user peut accéder aux fonctionnalités transactionnelles (FR17 unblocked).

**Story 1.6 = pattern miroir Story 1.5** mais :
- **TTL 7 jours** (vs 30 min password reset) — verify peut prendre du temps
- **Auto-trigger on landing** (vs user-action newPassword Story 1.5) — UX optimale, le clic sur le lien email = consentement
- **Pas de password complexity** validation (juste token)
- **Réutilise `email_verification_tokens` table Story 1.2** (pas de nouvelle table)
- **Idempotent re-verify** : si user clique 2x le même lien, le 2ème → success (pas erreur) — UX-friendly
- **JWT refresh nécessaire post-verify** pour propager `email_verified: true` claim (sinon middleware FR17 bloque encore jusqu'à token expiry naturel)

### Décisions techniques majeures actées

1. **Auto-trigger on landing** (pas un form click "Confirmer") — UX optimale, le clic sur le lien email signifie déjà consentement utilisateur. Server Component pré-valide le token + Client Component auto-POST si valide.
2. **Réutilisation table `email_verification_tokens`** Story 1.2 (pas merge avec password_reset_tokens, pas nouvelle table). Story 1.6 ajoute juste 2 méthodes au repo (`countRecentTokens`, `invalidateAllForUser`).
3. **Rate-limit dual-axis resend** : 1/5min/IP (gateway-api Redis) + 5/h/email (identity-svc business logic) — anti-bomb robuste vs protection IP simple.
4. **Idempotent verify** : si user déjà email_verified, return success (pas error) — UX-friendly + cache-friendly (multiple clicks identiques sur lien email).
5. **JWT force-refresh post-verify** : nécessaire pour propager `email_verified: true` claim. Sans ça, le user reste bloqué FR17 jusqu'à 5 min (token expiry naturel + silent refresh Story 1.4). **Décision Story 1.6** : auto-trigger refresh côté frontend après success POST /verify.
6. **Pas de Required Action Keycloak `VERIFY_EMAIL`** : décision Story 1.1 documentée — on délègue les emails à Resend (notification-svc Story 5.4) pour cohérence FR/EN templates Tukio. Keycloak `executeActionsEmail` natif désactivé.
7. **Email template `email-verify-confirmation`** post-verify (security best practice OWASP — alerte user si verify accidentel).
8. **Anti-énumération NFR9** sur resend (200 generic toujours, peu importe email exists/verified).
9. **Token TTL 7 jours** : compromis entre sécurité (court=safe) et UX (long=user a le temps de cliquer même 1 semaine après inscription).
10. **Massive réutilisation Stories 1.2/1.3/1.4/1.5** : KeycloakAdminService, EnvelopeExceptionFilter, EnvironmentConfigService, RoleSchema, atomics UI, anti-énumération pattern, throttle pattern.

### Versions à utiliser

| Lib | Rôle | Version cible | Notes |
|---|---|---|---|
| **`@keycloak/keycloak-admin-client`** | Story 1.2 already installed | latest stable | `users.update` méthode |
| **`@nestjs/throttler`** | Stories 1.2/1.4 | latest | Réutilisé |
| **TypeORM + Postgres** | Story 0.6 | bundled | Réutilisé |
| **MailHog API** (tests) | Story 0.10 dev | latest | E2E vérification email reçu |

### Project Structure cible

```
packages/contracts/src/
├─ dtos/identity/email-verify.dto.ts                         # NEW Story 1.6 (3 schemas)
├─ events/identity/email-verified.v1.{schema.json,ts}        # NEW Story 1.6 (2 fichiers)
└─ types/email-templates.ts                                  # UPDATE — email-verify-confirmation

apps/identity-svc/src/
├─ domain/
│  ├─ model/user-profile.aggregate.ts                        # UPDATE Story 1.2 — markEmailVerified()
│  └─ ports/{email-verification-token-repository,keycloak-admin}.port.ts  # UPDATE — méthodes
├─ usecases/{verify-email,resend-email-verification,validate-email-verification-token}.usecase.ts  # NEW (3) + spec
└─ infrastructure/
   ├─ external/keycloak/keycloak-admin.service.ts            # UPDATE — updateUser impl
   ├─ persistence/typeorm/repositories/email-verification-token.typeorm.repository.ts  # UPDATE — countRecentTokens + invalidateAllForUser
   ├─ http/
   │  ├─ controllers/email-verify.controller.ts              # NEW (3 endpoints)
   │  └─ dtos/{email-verify-input,email-resend-input,email-verify-validate}.dto.ts  # NEW (3)
   └─ usecases-proxy/usecases-proxy.module.ts                # UPDATE — 3 proxies

apps/identity-svc/test/email-verify.e2e-spec.ts              # NEW

apps/gateway-api/src/
├─ domain/ports/identity-svc.port.ts                         # UPDATE Story 1.2 — 3 méthodes
├─ usecases/auth/email-verify.forwarder.ts                   # NEW
├─ infrastructure/
│  ├─ external/identity-svc/identity-svc.client.ts           # UPDATE — 3 méthodes
│  └─ http/
│     ├─ controllers/auth-email-verify.controller.ts         # NEW (3 endpoints)
│     └─ utils/post-verify-redirect-resolver.ts              # NEW
└─ app.module.ts                                             # UPDATE — controller + 3 throttlers

apps/gateway-api/test/auth/auth-email-verify.e2e-spec.ts     # NEW

apps/public/src/
├─ app/[locale]/auth/email/verify/page.tsx                   # NEW Story 1.6 (Server Component pré-validation)
├─ features/auth/email-verify/components/
│  ├─ EmailVerifyAutoTrigger.tsx                             # NEW (Client Component)
│  ├─ EmailVerifyExpiredView.tsx                             # NEW
│  └─ ResendVerificationButton.tsx                           # NEW
└─ messages/{fr,en}.json                                     # UPDATE — namespace auth.emailVerify.*

apps/public/e2e/auth/email-verify.spec.ts                    # NEW (10 tests)
apps/public/e2e/helpers/{get-verify-token-from-db,insert-expired-verify-token}.ts  # NEW (2)

apps/customer/src/app/[locale]/auth/verify-email-required/page.tsx  # UPDATE Story 1.2 — finalize
apps/customer/messages/{fr,en}.json                          # UPDATE — finalize namespace
apps/seller/src/app/[locale]/auth/verify-email-required/page.tsx    # NEW Story 1.6
apps/seller/messages/{fr,en}.json                            # UPDATE — namespace

packages/api-client/src/hooks/identity/use-email-verify.ts   # NEW (3 mutations + 1 query)
packages/auth-client/src/refresh/force-refresh.ts            # NEW (utility post-verify)

infra/k8s/grafana-dashboards/email-verification.json         # NEW
docs/runbook/{email-verification-debug,email-verify-vs-keycloak-required-action}.md  # NEW (2)

# Estimation total fichiers : ~40 nouveaux + ~15 updates = ~55 fichiers
```

### Critical Architecture Constraints

> Cf. Stories 1.2 + 1.4 + 1.5 + memories. Patterns réutilisés (Pretre, envelope, outbox transactional, anti-énumération, EN strict, i18n strict, latest stable libs).

### Previous Story Intelligence

**Story 1.2** : 🔴 **TEMPLATE PRINCIPAL** — table `email_verification_tokens` créée, KeycloakAdminService, EnvironmentConfigService, factory UserProfile.register avec emailVerified=false default. Story 1.6 ajoute 2 méthodes au repo + 1 méthode au KeycloakAdmin port + extends UserProfile aggregate avec `markEmailVerified()`.

**Story 1.3** : Pro register publish event email → token table partage avec Customer (même schema). Story 1.6 verify FONCTIONNE pour Customer ET Pro (rôle-agnostic, juste différent redirect post-verify).

**Story 1.4** : login flow finalisé. Story 1.6 utilise `<AuthProvider>` post-verify pour force-refresh JWT (propager `email_verified: true` claim).

**Story 1.5** : 🔴 **PATTERN MIROIR** — `IdentityExpiredException`, ValidateTokenUseCase, anti-énumération generic response, Server Component pré-validation, EmptyState success/warning views, throttler dual-axis. Story 1.6 réplique ce pattern.

### What this story does NOT do (out of scope)

- ❌ **Email change flow** (V1 Story 1.8) — Story 1.6 propose un lien placeholder vers `/account/profile`
- ❌ **Wizard Pro 4 steps integration** Story 2.2 — Story 1.6 livre juste la page standalone, Story 2.2 wrappera dans `<StepIndicator>`
- ❌ **notification-svc Resend send** Story 5.4 — Story 1.6 fournit le payload contract template `email-verify-confirmation`
- ❌ **Page "Suspicious activity report"** Story 6.4 — placeholder
- ❌ **JWT push notification post-verify** (V1+ in-app notif) — Story 1.6 force-refresh via API uniquement

### Files to UPDATE vs CREATE

(cf. Project Structure cible)

### Testing Standards

- **Coverage** : ≥ 90 % use cases identity-svc, ≥ 80 % gateway-api endpoints, ≥ 80 % frontend pages (NFR71)
- **Tests unit** Vitest mocks (3 use cases × 8+ cases)
- **Tests integration** Postgres + Keycloak testcontainers
- **Tests E2E** Playwright FR + EN + axe-core + MailHog (10 cases AC9)
- **Performance** : NFR48 ≤ 2s p90 verify

### Project Structure Notes

✅ Aligné avec Architecture + PRD §FR8 + FR17 + NFR9 + NFR48 + NFR71. Aligné avec Stories 1.1/1.2/1.3/1.4/1.5 patterns. Aligné avec memories.

⚠️ **Décision documentée** : auto-trigger verify on landing (cf. Décisions §1) — UX optimale.

⚠️ **Décision documentée** : JWT force-refresh post-verify (cf. Décisions §5) — propage claim sinon FR17 bloque encore.

⚠️ **À noter** : la **page email change** Story 1.8 V1 — au MVP, Story 1.6 redirige vers `/account/profile` placeholder.

⚠️ **À noter** : Story 2.2 Pro onboarding wizard wrappera la page seller verify-email-required dans `<StepIndicator>` step 1 — Story 1.6 garde la page standalone, compatible.

### References

- [Source: epics.md#Epic-1-Story-1.6 — Lines 1163-1176]
- [Source: prd.md#FR8, #FR17, #NFR9, #NFR48, #NFR71]
- [Source: ux-design-specification.md#UX-DR10 — verification landing gap MVP]
- [Source: 1-1-provision-keycloak-realm-tukio-roles-clients-phasetwo.md — Story 1.1 (realm + tukio-api client + désactivation Keycloak SMTP au profit Resend)]
- [Source: 1-2-customer-b2c-registration.md — 🔴 TEMPLATE PRINCIPAL : email_verification_tokens table + KeycloakAdminService + verify token generation]
- [Source: 1-3-pro-registration-pending-admin-review.md — Story 1.3 (Pro register émet aussi token email-verify dans même table)]
- [Source: 1-4-login-flow-keycloak-authorization-code-pkce.md — Story 1.4 (force-refresh post-verify)]
- [Source: 1-5-password-reset-flow.md — 🔴 PATTERN MIROIR — Server Component pré-validation, EmptyState views, anti-énumération, IdentityExpiredException, throttle dual-axis]
- [External: https://www.keycloak.org/docs-api/26.0/rest-api/index.html#_users_resource — users.update emailVerified]
- [Memory: feedback_clean_architecture_explicit.md, feedback_api_envelope_response.md, feedback_tech_layer_english.md, feedback_i18n_frontend.md, feedback_latest_versions.md]

## Dev Agent Record

### Agent Model Used

(à remplir)

### Debug Log References

(à remplir — vérification Keycloak `users.update({emailVerified: true})` ne révoque PAS les sessions existantes ≠ Story 1.5 password reset, validation force-refresh post-verify propage bien le claim, validation race condition pré-validation OK / POST verify simultanés (rare), drift R8 si Keycloak update OK + DB update fail — Keycloak considère email verified mais DB pas synced)

### Completion Notes List

(à remplir — points d'attention pour Story 2.2 wizard wrappera seller page, Story 5.4 templates `email-verify-confirmation`, Story 2.7 audit consume `identity.email.verified.v1`)

### File List

(à remplir)

---

## Story Completion Status

- **Story Status** : `ready-for-dev`
- **Created** : 2026-05-09
- **Created by** : `bmad-create-story` workflow
- **Epic** : Epic 1 — Identity & Authentication Backbone (MVP)
- **Sprint cible** : Sprint 2 (semaine 5-6, 6ᵉ story Epic 1)
- **Estimation effort** : 3-5 jours (1 dev fullstack — story plus simple que 1.5 grâce aux patterns massivement réutilisés, ~55 fichiers)
- **Dépendances upstream** :
  - **Stories 0.2, 0.4, 0.6, 0.7, 0.10** (envelope, atomics, Pretre, NATS, Docker)
  - **Story 1.1** (Keycloak realm + tukio-api client + désactivation Keycloak SMTP)
  - **Story 1.2** (🔴 email_verification_tokens table + KeycloakAdminService + factory UserProfile)
  - **Story 1.3** (Pro users tokens dans même table)
  - **Story 1.4** (login + force-refresh)
  - **Story 1.5** (🔴 PATTERN MIROIR — Server Component pré-validation, anti-énumération, IdentityExpiredException)
- **Dépendances downstream** :
  - **Story 1.7** (Admin TOTP) — non-impactée (admin créés via script avec emailVerified=true direct)
  - **Story 1.8** (Profile email change V1) — placeholder lien Story 1.6
  - **Story 1.9** (Account delete) — non-impactée
  - **Story 1.10** (consolidation + reconciliation) — consume `identity.email.verified.v1`
  - **Story 2.2** (Pro onboarding wizard 4 steps) — wrappera seller verify-email-required page
  - **Story 2.7** (Audit) — consume event
  - **Story 5.4** (notification-svc Resend) — consume templates `email-verify` + `email-verify-confirmation`
  - **Story 6.4** (Suspicious activity report) — placeholder lien
  - **Stories Epic 4-5** (booking, messaging) — gating FR17 unblocked post-verify
- **FRs covered** :
  - **FR8** ✅ Verify email required pre-transaction
  - **FR17** ✅ Block transactional unverified (finalize Story 1.2 placeholder pages)
- **NFRs touchés** :
  - **NFR9** ✅ Anti-énumération resend
  - **NFR10** ✅ Rate-limit dual-axis (1/5min/IP + 5/h/email)
  - **NFR48** ✅ UX ≤ 2s p90 verify
  - **NFR71** ✅ Coverage thresholds

> **Prochaine story (auto-discover via `bmad-create-story`) → Story 1.7** (Admin 2FA TOTP obligatoire `POST /v1/auth/totp/setup` + `POST /v1/auth/totp/verify`)

---

**Dev agent next steps :**
1. Lire ce file en entier
2. Vérifier upstream Stories 1.2, 1.5 implémentées (templates principaux réutilisés)
3. Implémenter Tasks 1-10 dans l'ordre
4. Lancer après chaque jalon : `pnpm lint && pnpm typecheck && pnpm test --filter=...[origin/main] && pnpm playwright test --grep "email verify"`
5. Commit Story 1.6 quand : 10/10 e2e tests passent + coverage ≥ thresholds + axe-core 0 violations + perf NFR48 OK + force-refresh JWT post-verify validated
6. Update sprint-status : `1-6-email-verification-flow-landing-page: review` puis `done`
