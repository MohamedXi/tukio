# Story 1.5: Password reset flow (`POST /v1/auth/password-reset/request` + `POST /v1/auth/password-reset/confirm`)

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

**As a** Customer / Pro / Admin qui a oublié son mot de passe,
**I want** un flow de reset password en 2 étapes (Step A `apps/public/{locale}/auth/password-reset` formulaire `email` + submit → identity-svc génère un reset token UUID v4 stocké en DB `password_reset_tokens` TTL 30 min + publie NATS `notification.email.send.v1` template `password-reset` localisé FR/EN consume Story 5.4 → Resend → email envoyé avec lien `{PUBLIC_URL}/{locale}/auth/password-reset/confirm?token=<uuid>` + timestamp + IP + lien "Signaler activité suspecte" sécurité utilisateur ; Step B `apps/public/{locale}/auth/password-reset/confirm?token=<uuid>` formulaire `{newPassword, newPasswordConfirm}` validé Zod identique à Story 1.2 register password (12+ chars + maj/min/digit/special) + check `newPassword === newPasswordConfirm` → identity-svc valide token (existence + non-expiré + non-utilisé) → Keycloak Admin API `users.resetPassword({id, credential: { type: 'password', value: newPassword, temporary: false }})` + `users.logout({id})` invalidate toutes sessions existantes NFR12 → mark token `used_at = NOW()` → publie NATS `identity.password.reset.v1` (audit business event consume Story 1.10 / 2.7) → redirect `/auth/login?success=password_reset_complete`), avec **réponse enveloppe générique anti-énumération NFR9** sur Step A `{ code:200, data:{ message:'Si un compte existe pour cet email, un lien a été envoyé' } }` peu importe que l'email existe ou non, **rate-limiting strict** gateway-api `3/heure/IP` request (vs 5/min Story 1.2 register, plus strict pour anti-spam abuse) + `5/min/IP` confirm (token-based, moins abusable), **gestion erreurs token** : token inexistant → 410 enveloppe `IDENTITY-EXPIRED-001` avec CTA UI "Demander un nouveau lien" / token expiré (>30min) → idem 410 / token déjà utilisé → idem 410 (pas de leak entre les 3 cas — uniformité), **invalidation sessions complète** post-reset (Keycloak `users.logout` revokes all refresh tokens session — l'utilisateur doit se re-login partout NFR12), **email template `password-reset.{fr,en}.tsx`** (Resend MJML/React Email Story 5.4 — Story 1.5 fournit le payload contract) avec subject FR `"Réinitialisation de votre mot de passe Tukio"` / EN `"Reset your Tukio password"` + body : préheader + greeting + CTA primary (lien) + small print sécurité (timestamp + IP request + UA + lien report suspicious) + footer Tukio,
**so that** un user qui a oublié son password peut récupérer son compte de manière sécurisée et autonome (NFR9 + UX flow standard 2 emails en moins de 2 min) ; les Customer + Pro + Admin partagent **un seul flow** (rôle-agnostic, Keycloak gère le mapping userId → password update) ; et les **patterns "token-based action 2-step flow"** (request + confirm via email link + token DB UUID + Keycloak Admin update + invalidate sessions + audit event) deviennent réutilisables Story 1.6 (email verify — pattern miroir avec verify token Story 1.2), Story 1.8 (email change — V1 future avec token-based confirmation), Story 1.9 (account delete — token-based confirm pour double-opt-in V1).

> **Outcome attendu** : à la fin de cette story, un user (n'importe quel rôle) qui ne se souvient plus de son password va sur `tukio.one/fr/auth/login` → clique "Mot de passe oublié ?" (lien Story 1.4) → arrive sur `/fr/auth/password-reset` → entre son email → clique "Envoyer le lien" → voit page de confirmation `"Si un compte existe pour cet email, un lien a été envoyé. Vérifiez votre boîte de réception (et le dossier spam)."` ; un email arrive via Resend (visible MailHog `localhost:8025` en dev) avec subject + body branded Tukio FR + lien `tukio.one/fr/auth/password-reset/confirm?token=<uuid>` + timestamp + IP + lien report ; le user clique le lien → arrive sur le formulaire `/fr/auth/password-reset/confirm` (pré-rempli avec token caché) → entre nouveau password (validation Zod inline) + confirmation → submit → vérifie token DB → reset Keycloak password → invalidate toutes sessions (token cookies périmés autres devices/onglets) → redirect `/fr/auth/login?success=password_reset_complete` → toast succès `"Mot de passe réinitialisé. Connectez-vous avec votre nouveau mot de passe."` ; un user qui clique un token expiré (>30 min) ou déjà utilisé voit la page 410 `"Lien expiré ou déjà utilisé"` + CTA `"Demander un nouveau lien"` ; le 4ᵉ request password-reset depuis même IP en 1 heure retourne `429 ErrorEnvelope { Retry-After: <secs> }` avec message UI `"Trop de demandes, réessayez dans Xmin"` ; le NATS event `identity.password.reset.v1` est publié à chaque succès (audit consume Story 2.7) ; un test `pnpm playwright test --grep "password reset"` passe en FR ET EN, axe-core 0 violations, 8 scénarios (happy path FR + EN, anti-énumération unknown email, token expired, token reused, token invalid, password complexity, sessions invalidation cross-tabs, rate-limit 4ᵉ request).

## Acceptance Criteria

1. **AC1 — Frontend Step A : page `apps/public/[locale]/auth/password-reset` (request form)** : Given un Visitor sur `tukio.one/{fr|en}/auth/password-reset` (lien depuis Story 1.4 login page "Mot de passe oublié ?"), When il consulte la page, Then :
   - **Layout** : Server Component layout (réutilise pattern Stories 1.2/1.3/1.4 — `<PublicHeader>` + form + footer)
   - **Hero** : `<h1>Mot de passe oublié</h1>` (FR) / `<h1>Forgot password</h1>` (EN), Fraunces 500 charcoal-800
   - **Description** : `<p>Entrez votre email pour recevoir un lien de réinitialisation. Le lien sera valide 30 minutes.</p>` (FR) / `<p>Enter your email to receive a reset link. Valid for 30 minutes.</p>` (EN)
   - **Form fields** :
     - `<FormField label="Email" type="email" required>` validé Zod RFC 5322 (réutilise schema `@tukio/contracts/dtos/identity` Story 1.2)
   - **CTA principal** : `<Button variant="primary" size="lg" type="submit">Envoyer le lien</Button>` — disabled si email invalid, loading state pendant submit
   - **Lien secondaire** : `<Link href="/{locale}/auth/login">← Retour à la connexion</Link>`
   - **Submit handler** : POST `/v1/auth/password-reset/request` avec `{ email }` body
   - **Post-success** : afficher page de confirmation **systématiquement** (anti-énumération NFR9) — peu importe que l'email existe ou non en DB :
     - `<EmptyState variant="info">` Story 0.5
     - Title : `"Vérifiez votre boîte de réception"` (FR) / `"Check your inbox"` (EN)
     - Description : `"Si un compte existe pour cet email, un lien de réinitialisation a été envoyé. Vérifiez aussi votre dossier spam."` (FR) / `"If an account exists for this email, a reset link has been sent. Also check your spam folder."` (EN)
     - CTA : `<Link href="/{locale}/auth/login">Retour à la connexion</Link>`
   - **Post-error mapping** : `RATE-LIMIT-EXCEEDED-001` → message UI inline `"Trop de demandes, réessayez dans X min"` (Retry-After header). Generic 5xx → message UI `"Erreur serveur, réessayez dans quelques minutes"`. **Important** : ne PAS différencier UI entre "email exists" et "email not found" (anti-énumération NFR9 — toujours afficher la page de confirmation succès même sur 200 generic).
   - **i18n strict** (memory `feedback_i18n_frontend.md`) : zéro hardcoded UI string. Toutes les strings dans `apps/public/messages/{fr,en}.json` sous le namespace `auth.passwordReset.*` (~12 keys). Importées via `useTranslations('auth.passwordReset')`.
   - **Accessibilité RGAA AA** : labels associés, focus visible, navigation Tab/Enter, errors via `role="alert"`, axe-core 0 violations critical/serious.
   - **Test Playwright e2e** (`apps/public/e2e/auth/password-reset.spec.ts`) : remplir form FR + EN, submit, vérifier page confirmation rendered, axe-core 0 violations.

2. **AC2 — Frontend Step B : page `apps/public/[locale]/auth/password-reset/confirm?token=<uuid>` (set new password form)** : Given un user qui clique le lien email (token query param), When il arrive sur la page, Then :
   - **Layout** : Server Component layout (pattern réutilisé)
   - **Hero** : `<h1>Réinitialisation du mot de passe</h1>` (FR) / `<h1>Reset your password</h1>` (EN)
   - **Pré-validation token** : Server Component fait un fetch léger `POST /v1/auth/password-reset/validate-token` (GET wouldn't work since token is in body for security — alternative: GET `/v1/auth/password-reset/validate?token=<uuid>` returns 200 OK ou 410). Si token invalide → render directement la page d'erreur "Lien expiré" + CTA "Demander un nouveau lien" → href `/{locale}/auth/password-reset`. **Décision MVP** : Server Component pre-validation pour UX fluide (pas de form submit pour découvrir token expiré).
   - **Form fields** (token caché récupéré depuis query param + 2 password fields) :
     - `<FormField label="Nouveau mot de passe" type="password" required helper="Min 12 caractères, 1 maj, 1 min, 1 chiffre, 1 spécial">` validé Zod (réutilise `password` schema `RegisterCustomerInputSchema` Story 1.2 — same complexity rules)
     - `<FormField label="Confirmer le mot de passe" type="password" required>` validé Zod custom refine `data.newPassword === data.newPasswordConfirm` avec message `"Les mots de passe ne correspondent pas"` (FR) / `"Passwords do not match"` (EN)
     - **Toggle "Afficher le mot de passe"** (UX accessibility) : `<Button variant="ghost" type="button" onClick={() => setShowPassword(!showPassword)}>` qui change `type` entre `password` et `text`. **A11y** : `aria-pressed` + `aria-label` change selon état.
     - **Indicateur force password** (UX) : `<PasswordStrengthIndicator>` simple (4 segments : très faible / faible / moyenne / forte) basé sur Zod schema validation — uniquement informationnel, pas blocking.
   - **CTA principal** : `<Button variant="primary" size="lg" type="submit">Réinitialiser mon mot de passe</Button>` — disabled si form invalid OU si pré-validation token avait failé
   - **Submit handler** : POST `/v1/auth/password-reset/confirm` avec `{ token, newPassword, newPasswordConfirm }` body
   - **Post-success** : redirect `apps/public/{locale}/auth/login?success=password_reset_complete` avec toast succès au login next visit (`useSearchParams` lit `?success=password_reset_complete` côté login page Story 1.4 et affiche toast)
   - **Post-error mapping** :
     - `IDENTITY-EXPIRED-001` (token invalid/expired/used) → render page erreur (cf. AC4) + CTA "Demander un nouveau lien"
     - `VALIDATION-FAILED-001` issues `path: ['newPassword']` → message inline form
     - `VALIDATION-FAILED-001` issues `path: ['newPasswordConfirm']` → message inline form (mismatch case)
     - `RATE-LIMIT-EXCEEDED-001` → message UI `"Trop de tentatives, réessayez dans Xs"`
     - Generic 5xx → message UI `"Erreur serveur"`
   - **i18n strict** : namespace `auth.passwordReset.confirm.*` (~15 keys)
   - **Accessibilité RGAA AA** : labels associés, focus visible, error live region, axe-core 0 violations.
   - **Test Playwright e2e** : (cf. AC9 — happy path FR + EN, password mismatch, password trop court, token expiré pré-validation page direct render erreur)

3. **AC3 — gateway-api endpoint `POST /v1/auth/password-reset/request` (forward + throttle 3/h/IP)** : Given `apps/gateway-api/src/infrastructure/http/controllers/auth-password-reset.controller.ts` (NEW), When un client appelle :
   - **Endpoint** :
     ```ts
     @Controller('/v1/auth/password-reset')
     export class AuthPasswordResetController {
       @Post('/request')
       @Public()
       @HttpCode(200)
       @Throttle({ 'password-reset-request': { limit: 3, ttl: 3_600_000 } }) // 3/heure/IP — NFR10 strict anti-spam
       async request(
         @Body() dto: PasswordResetRequestInput,
         @Ip() clientIp: string,
         @Headers('user-agent') userAgent: string,
       ): Promise<{ message: string }> {
         return this.passwordResetForwarder.getInstance().requestReset({ ...dto, clientIp, userAgent });
       }
     }
     ```
   - **Validation Zod** : `PasswordResetRequestInputSchema` (`{ email: z.string().email().min(5).max(255) }`)
   - **Forwarder** : `PasswordResetForwarder.requestReset()` appelle identity-svc `POST /internal/password-reset/request` avec body + `X-Internal-Service-Token` HMAC + `X-Tukio-Correlation-Id`
   - **Réponse 200 enveloppée générique** (anti-énumération NFR9) — **toujours 200, jamais 404 même si email inconnu** :
     ```json
     {
       "method": "POST",
       "code": 200,
       "data": { "message": "Si un compte existe pour cet email, un lien de réinitialisation a été envoyé." },
       "meta": { "correlationId": "...", "timestamp": "...", "locale": "fr" }
     }
     ```
   - **Rate-limit 429** : `tukioCode: 'RATE-LIMIT-EXCEEDED-001'` + header `Retry-After: <seconds>` (cohérent Story 1.2 pattern)
   - **Tests E2E** : valid email → 200 generic. Inconnu email → 200 generic (même message). Invalid email format → 422 enveloppe. 4ᵉ request même IP en 1h → 429 + Retry-After.

4. **AC4 — gateway-api endpoint `POST /v1/auth/password-reset/confirm` (forward + throttle 5/min/IP)** : Given le controller AC3 (UPDATE), When un client appelle :
   - **Endpoint** :
     ```ts
     @Post('/confirm')
     @Public()
     @HttpCode(200)
     @Throttle({ 'password-reset-confirm': { limit: 5, ttl: 60_000 } }) // 5/min/IP — moins strict (token-based)
     async confirm(@Body() dto: PasswordResetConfirmInput): Promise<{ message: string }> {
       return this.passwordResetForwarder.getInstance().confirmReset(dto);
     }
     ```
   - **Validation Zod** : `PasswordResetConfirmInputSchema` (`{ token: z.string().uuid(), newPassword: <password regex>, newPasswordConfirm: <same regex> }`) avec `.refine(data => data.newPassword === data.newPasswordConfirm, 'Passwords do not match')`
   - **Forwarder** : `PasswordResetForwarder.confirmReset()` appelle identity-svc `POST /internal/password-reset/confirm`
   - **Error mapping** : 410 IDENTITY-EXPIRED-001 → forwarder map en `IdentityExpiredException` → EnvelopeExceptionFilter wrap. 422 validation → `ValidationFailedException`. 502 Keycloak DOWN → `ExternalServiceException` IDENTITY-EXTERNAL-001.
   - **Réponse 200** : `{ method:'POST', code:200, data:{ message:'Password reset successful, please login.' } }`
   - **Tests E2E** : valid token + valid passwords → 200. Token expired → 410 enveloppe. Token reused → 410. Token invalide format → 422. Password trop court → 422. Password mismatch → 422.

5. **AC5 — gateway-api endpoint `GET /v1/auth/password-reset/validate?token=<uuid>` (pré-validation token Server Component)** : Given le controller AC3 (UPDATE), When le frontend Server Component pré-valide le token avant de render le form (UX fluide AC2), Then :
   - **Endpoint** :
     ```ts
     @Get('/validate')
     @Public()
     @HttpCode(200)
     @Throttle({ 'password-reset-validate': { limit: 30, ttl: 60_000 } }) // 30/min/IP — léger
     async validate(@Query('token') token: string): Promise<{ valid: boolean }> {
       return this.passwordResetForwarder.getInstance().validateToken({ token });
     }
     ```
   - **Forwarder** : appelle identity-svc `GET /internal/password-reset/validate?token=...`
   - **Réponse** :
     - Token valide + non expiré + non utilisé → `200 { valid: true }`
     - Token invalide / expiré / utilisé → `200 { valid: false }` (pas 404 — uniformité, anti-énumération minimale + UX simpler)
   - **NB sécurité** : ce endpoint expose juste `{valid: true|false}` — pas de leak info user, pas d'opération sensitive. Rate-limit 30/min/IP suffit.
   - **Tests E2E** : token valide → 200 valid:true. Token expiré → 200 valid:false. Token uuid format invalide → 422 enveloppe.

6. **AC6 — identity-svc `PasswordResetTokenRepository` + migration `password_reset_tokens` table** : Given le scope password reset, When je consulte `apps/identity-svc/src/`, Then :
   - **Domain port `IPasswordResetTokenRepository`** (NEW — `apps/identity-svc/src/domain/ports/password-reset-token-repository.port.ts`) :
     ```ts
     export interface IPasswordResetTokenRepository {
       save(input: { token: string; userProfileId: string; expiresAt: Date; requestedFromIp: string; requestedUserAgent: string; }): Promise<void>;
       findByToken(token: string): Promise<{ userProfileId: string; expiresAt: Date; usedAt: Date | null } | null>;
       markUsed(token: string): Promise<void>;
     }
     export const PASSWORD_RESET_TOKEN_REPOSITORY = Symbol('PASSWORD_RESET_TOKEN_REPOSITORY');
     ```
   - **Domain port extension `IKeycloakAdmin`** (UPDATE Story 1.2) : ajouter méthodes :
     ```ts
     setUserPassword(input: { keycloakUserId: string; password: string; temporary: boolean }): Promise<void>;
     logoutAllSessions(input: { keycloakUserId: string }): Promise<void>; // revoke all refresh tokens session
     findUserByEmail(email: string): Promise<{ keycloakUserId: string; email: string; userProfileId?: string } | null>; // already added Story 1.2 — verify
     ```
     **NB** : `setUserPassword` était déjà dans port interface AC2 IKeycloakAdmin Story 1.2 (cf. Story 1.2 AC5). Story 1.5 utilise + ajoute `logoutAllSessions` (NEW).
   - **Infrastructure impl `KeycloakAdminService`** (UPDATE Story 1.2) : ajouter `logoutAllSessions` méthode utilisant `kcAdminClient.users.logout({ realm: 'tukio', id })`
   - **Infrastructure entity `PasswordResetTokenEntity`** (NEW — `apps/identity-svc/src/infrastructure/persistence/typeorm/entities/password-reset-token.entity.ts`) :
     ```ts
     @Entity('password_reset_tokens')
     export class PasswordResetTokenEntity {
       @PrimaryColumn('uuid') token: string;
       @Column('uuid', { name: 'user_profile_id' }) userProfileId: string;
       @Column('timestamptz', { name: 'expires_at' }) expiresAt: Date;
       @Column('timestamptz', { name: 'used_at', nullable: true }) usedAt: Date | null;
       @Column('inet', { name: 'requested_from_ip' }) requestedFromIp: string;
       @Column('text', { name: 'requested_user_agent' }) requestedUserAgent: string;
       @Column('timestamptz', { name: 'created_at', default: () => 'NOW()' }) createdAt: Date;
     }
     ```
   - **Repository impl `PasswordResetTokenTypeOrmRepository`** (NEW)
   - **Migration `1715250000000-CreatePasswordResetTokensTable.ts`** (NEW) :
     ```sql
     CREATE TABLE password_reset_tokens (
       token UUID PRIMARY KEY,
       user_profile_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
       expires_at TIMESTAMPTZ NOT NULL,
       used_at TIMESTAMPTZ NULL,
       requested_from_ip INET NOT NULL,
       requested_user_agent TEXT NOT NULL,
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     );
     CREATE INDEX idx_password_reset_tokens_user_profile_id ON password_reset_tokens (user_profile_id);
     CREATE INDEX idx_password_reset_tokens_expires_at ON password_reset_tokens (expires_at) WHERE used_at IS NULL;
     ```
     - `down()` : DROP TABLE + INDEXes
   - **Tests integration** : Postgres testcontainer + tester save/findByToken/markUsed
   - **Décision** : table séparée de `email_verification_tokens` (pas merge dans `auth_tokens` polymorphic) — schema diverge potentiellement (request IP/UA pour password reset, pas pour email verify), code clearer, pas de risque cross-purpose token misuse.

7. **AC7 — identity-svc 2 use cases `RequestPasswordResetUseCase` + `ConfirmPasswordResetUseCase`** : Given Pretre architecture, When je consulte `apps/identity-svc/src/usecases/`, Then :
   - **Use case 1 `RequestPasswordResetUseCase`** (NEW — `apps/identity-svc/src/usecases/request-password-reset.usecase.ts`) :
     ```ts
     @Injectable()
     export class RequestPasswordResetUseCase {
       constructor(
         @Inject(USER_PROFILE_REPOSITORY) private readonly userProfileRepo: IUserProfileRepository,
         @Inject(PASSWORD_RESET_TOKEN_REPOSITORY) private readonly tokenRepo: IPasswordResetTokenRepository,
         @Inject(EVENT_PUBLISHER) private readonly eventPublisher: IEventPublisher,
         @Inject(CONFIG_SERVICE) private readonly config: IConfigService,
       ) {}

       async execute(input: { email: string; clientIp: string; userAgent: string }): Promise<{ message: string }> {
         // 1. Lookup user — IF NOT FOUND, return generic success (NFR9 anti-énumération)
         const userProfile = await this.userProfileRepo.findByEmail(input.email);
         const genericResponse = { message: 'If an account exists for this email, a reset link has been sent.' };

         if (!userProfile || userProfile.deletedAt) {
           // Anti-énumération : retourne 200 generic même si email n'existe pas
           // Optionnel : log internal event audit "password_reset_requested_for_unknown_email" pour observabilité (sans leak côté API)
           return genericResponse;
         }

         // 2. Generate reset token
         const token = randomUUID();
         const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min TTL

         // 3. Persist token + publish event in atomic transaction
         await this.userProfileRepo.runInTransaction(async (txn) => {
           await txn.passwordResetTokenRepo.save({
             token,
             userProfileId: userProfile.id,
             expiresAt,
             requestedFromIp: input.clientIp,
             requestedUserAgent: input.userAgent,
           });

           // Event 1: notification.email.send.v1 with template 'password-reset'
           await txn.eventPublisher.publish({
             eventId: randomUUID(),
             eventType: 'notification.email.send',
             eventVersion: 'v1',
             occurredAt: new Date().toISOString(),
             aggregate: { type: 'UserProfile', id: userProfile.id },
             actor: { userId: 'system', role: 'system' },
             payload: {
               templateId: 'password-reset',
               locale: userProfile.locale,
               to: { email: userProfile.email.value, userId: userProfile.id, name: `${userProfile.firstName} ${userProfile.lastName}` },
               params: {
                 firstName: userProfile.firstName,
                 resetUrl: `${this.config.getPublicBaseUrl()}/${userProfile.locale}/auth/password-reset/confirm?token=${token}`,
                 expiresAt: expiresAt.toISOString(),
                 requestedAt: new Date().toISOString(),
                 requestedFromIp: input.clientIp,
                 requestedUserAgent: input.userAgent,
                 reportSuspiciousUrl: `${this.config.getPublicBaseUrl()}/${userProfile.locale}/help/security/suspicious-activity`,
               },
             },
           });

           // Event 2: identity.password-reset-requested.v1 (audit business event — observability)
           await txn.eventPublisher.publish({
             eventId: randomUUID(),
             eventType: 'identity.password-reset-requested',
             eventVersion: 'v1',
             occurredAt: new Date().toISOString(),
             aggregate: { type: 'UserProfile', id: userProfile.id },
             actor: { userId: userProfile.id, role: userProfile.role },
             payload: {
               userProfileId: userProfile.id,
               email: userProfile.email.value,
               requestedFromIp: input.clientIp,
               requestedUserAgent: input.userAgent,
               tokenExpiresAt: expiresAt.toISOString(),
             },
           });
         });

         return genericResponse;
       }
     }
     ```
   - **Use case 2 `ConfirmPasswordResetUseCase`** (NEW — `apps/identity-svc/src/usecases/confirm-password-reset.usecase.ts`) :
     ```ts
     @Injectable()
     export class ConfirmPasswordResetUseCase {
       constructor(
         @Inject(USER_PROFILE_REPOSITORY) private readonly userProfileRepo: IUserProfileRepository,
         @Inject(PASSWORD_RESET_TOKEN_REPOSITORY) private readonly tokenRepo: IPasswordResetTokenRepository,
         @Inject(KEYCLOAK_ADMIN) private readonly keycloakAdmin: IKeycloakAdmin,
         @Inject(EVENT_PUBLISHER) private readonly eventPublisher: IEventPublisher,
       ) {}

       async execute(input: { token: string; newPassword: string }): Promise<{ message: string }> {
         // 1. Validate token
         const tokenRecord = await this.tokenRepo.findByToken(input.token);
         if (!tokenRecord) {
           throw new IdentityExpiredException('IDENTITY-EXPIRED-001', 'Reset link is invalid or has expired');
         }
         if (tokenRecord.usedAt) {
           throw new IdentityExpiredException('IDENTITY-EXPIRED-001', 'Reset link has already been used');
         }
         if (tokenRecord.expiresAt < new Date()) {
           throw new IdentityExpiredException('IDENTITY-EXPIRED-001', 'Reset link has expired');
         }

         // 2. Lookup user
         const userProfile = await this.userProfileRepo.findById(tokenRecord.userProfileId);
         if (!userProfile || userProfile.deletedAt) {
           // Edge case : user deleted between request and confirm
           throw new IdentityExpiredException('IDENTITY-EXPIRED-001', 'Reset link is invalid');
         }

         // 3. Update Keycloak password (compensable failure)
         try {
           await this.keycloakAdmin.setUserPassword({
             keycloakUserId: userProfile.keycloakUserId,
             password: input.newPassword,
             temporary: false,
           });
         } catch (e) {
           if (e instanceof KeycloakUnreachableError) throw new ExternalServiceException('IDENTITY-EXTERNAL-001', 'Keycloak unreachable');
           throw e;
         }

         // 4. Invalidate all sessions (NFR12)
         try {
           await this.keycloakAdmin.logoutAllSessions({ keycloakUserId: userProfile.keycloakUserId });
         } catch (e) {
           // Non-fatal : password is already updated. Log + alert + continue.
           // Drift R8 : if logoutAllSessions fail, sessions may persist with old password validation cache (~5 min) until JWKS refresh — acceptable risk MVP.
         }

         // 5. Mark token used + publish events (atomic)
         await this.userProfileRepo.runInTransaction(async (txn) => {
           await txn.passwordResetTokenRepo.markUsed(input.token);

           // Event: identity.password.reset.v1 (audit business event)
           await txn.eventPublisher.publish({
             eventId: randomUUID(),
             eventType: 'identity.password.reset',
             eventVersion: 'v1',
             occurredAt: new Date().toISOString(),
             aggregate: { type: 'UserProfile', id: userProfile.id },
             actor: { userId: userProfile.id, role: userProfile.role },
             payload: {
               userProfileId: userProfile.id,
               email: userProfile.email.value,
               resetAt: new Date().toISOString(),
               sessionsInvalidated: true,
             },
           });

           // Optionnel: notification.email.send.v1 confirmation "Your password has been changed"
           await txn.eventPublisher.publish({
             eventId: randomUUID(),
             eventType: 'notification.email.send',
             eventVersion: 'v1',
             occurredAt: new Date().toISOString(),
             aggregate: { type: 'UserProfile', id: userProfile.id },
             actor: { userId: 'system', role: 'system' },
             payload: {
               templateId: 'password-reset-confirmation',
               locale: userProfile.locale,
               to: { email: userProfile.email.value, userId: userProfile.id },
               params: { firstName: userProfile.firstName, resetAt: new Date().toISOString(), reportSuspiciousUrl: `${this.config.getPublicBaseUrl()}/${userProfile.locale}/help/security/suspicious-activity` },
             },
           });
         });

         return { message: 'Password reset successful, please login.' };
       }
     }
     ```
   - **Use case 3 `ValidatePasswordResetTokenUseCase`** (NEW — pour endpoint AC5) :
     ```ts
     async execute(input: { token: string }): Promise<{ valid: boolean }> {
       const tokenRecord = await this.tokenRepo.findByToken(input.token);
       if (!tokenRecord) return { valid: false };
       if (tokenRecord.usedAt) return { valid: false };
       if (tokenRecord.expiresAt < new Date()) return { valid: false };
       return { valid: true };
     }
     ```
   - **Tests unit** (`*.usecase.spec.ts`) avec ≥ 90 % coverage : (1) request happy path → token saved + 2 events published, (2) request unknown email → generic response + NO events published (anti-énumération), (3) confirm valid token → password updated + sessions invalidated + token marked used + 2 events, (4) confirm expired token → throw IDENTITY-EXPIRED-001, (5) confirm reused token → throw IDENTITY-EXPIRED-001, (6) confirm Keycloak DOWN → throw IDENTITY-EXTERNAL-001 + token NOT marked used (compensable), (7) confirm logoutAllSessions fail → password updated success (non-fatal), (8) validate token → boolean responses

8. **AC8 — identity-svc controller `POST /internal/password-reset/{request,confirm}` + `GET /internal/password-reset/validate`** : Given AC7 use cases, When je consulte `apps/identity-svc/src/infrastructure/http/controllers/`, Then :
   - **Controller `password-reset.controller.ts`** (NEW) avec 3 endpoints (request, confirm, validate) protégés par `InternalServiceGuard` Story 1.2 (HMAC shared secret)
   - Wired dans `usecases-proxy.module.ts` : ajouter `REQUEST_PASSWORD_RESET_USECASES_PROXY`, `CONFIRM_PASSWORD_RESET_USECASES_PROXY`, `VALIDATE_PASSWORD_RESET_TOKEN_USECASES_PROXY`
   - Tests E2E `apps/identity-svc/test/password-reset.e2e-spec.ts` : 8+ cases (cf. AC7 tests + integration)

9. **AC9 — Tests Playwright e2e password reset flow FR + EN + axe-core (NFR48 + UX)** : Given `apps/public/e2e/auth/password-reset.spec.ts` (NEW), When je lance `pnpm --filter=apps/public test:e2e --grep "password reset"`, Then :
   - **Test 1 (happy path FR)** : précréer user `customer1@tukio.one` Customer email-verified → naviguer `localhost:3000/fr/auth/password-reset` → entrer email → submit → vérifier page confirmation `"Vérifiez votre boîte de réception"` rendered → vérifier email reçu via MailHog API `localhost:8025/api/v2/messages` (filter recent + email matches `password-reset` template) → extract token from email body URL → naviguer `confirm?token=<extracted>` → vérifier form rendered (token pré-validé OK) → entrer newPassword + confirm valides → submit → vérifier redirect `/fr/auth/login?success=password_reset_complete` → toast succès affiché → tenter login avec ancien password → vérifier failure → tenter login avec nouveau password → vérifier success
   - **Test 2 (happy path EN)** : idem en `/en/auth/password-reset` → vérifier email FR... attend EN ! Vérifier `templateId='password-reset'` + `locale='en'` → email body en EN
   - **Test 3 (anti-énumération unknown email)** : entrer email `nonexistent@example.com` → submit → vérifier page confirmation **identique** au happy path (même message UI, NFR9) → vérifier qu'AUCUN email n'est envoyé via MailHog (count messages avant/après identique)
   - **Test 4 (token expired pré-validation)** : précréer un token avec `expires_at = NOW() - 1 hour` (testcontainer Postgres direct insert) → naviguer `confirm?token=<expired-uuid>` → vérifier page Server Component render erreur `"Lien expiré"` + CTA "Demander un nouveau lien" → vérifier form NOT rendered
   - **Test 5 (token reused)** : précréer token avec `used_at = NOW()` → confirm → 410 → page erreur
   - **Test 6 (token UUID format invalide)** : naviguer `confirm?token=not-a-uuid` → 422 → page erreur générique
   - **Test 7 (password complexity)** : valid token → entrer `newPassword: 'short'` → vérifier message inline `"Min 12 caractères"` → ne pas pouvoir submit
   - **Test 8 (password mismatch)** : valid token → entrer `newPassword: 'ValidPass123!'` + `newPasswordConfirm: 'ValidPass123!Diff'` → vérifier message inline `"Les mots de passe ne correspondent pas"`
   - **Test 9 (sessions invalidation cross-tabs)** : login user dans 2 onglets → reset password dans un autre browser/incognito → vérifier que les 2 onglets logged in voient leur next API call retourner 401 (sessions invalidated NFR12) → forced redirect login
   - **Test 10 (rate-limit 4ᵉ request)** : 3 requests password-reset depuis même IP en 1h → 4ᵉ → 429 + UI message `"Trop de demandes, réessayez dans Xmin"`
   - **Test 11 (axe-core a11y)** : axe-core sur les 2 pages (request + confirm) — 0 violations critical/serious
   - **Test 12 (NFR48 perf)** : mesurer temps page.goto request page → submit → email reçu → click link → confirm form → submit → redirect login. Assert ≤ 2 min p90 (incluant délai email + simulation user reading)
   - **Coverage** : ≥ 80 % gateway-api endpoints, ≥ 90 % identity-svc 3 use cases, ≥ 80 % frontend forms

10. **AC10 — Documentation runbook + observability + email template contract** : Given le scope cross-cutting Story 1.5, When je consulte `docs/`, Then :
    - **`docs/runbook/password-reset-debug.md`** (NEW ~70 lignes) : flow end-to-end, troubleshooting (token not found, Keycloak DOWN, NATS event lag, email not received, sessions not invalidated, rate-limit confusion), commandes utiles (Keycloak Admin API list user sessions, query password_reset_tokens, MailHog inbox)
    - **`docs/runbook/password-reset-security.md`** (NEW ~40 lignes) : NFR9 anti-énumération + NFR12 sessions invalidation, attack vectors (timing attack vs response time uniform — gateway-api should add small random delay 50-200ms to /request endpoint to prevent timing-based enumeration), 30 min TTL choice rationale, 3/h/IP rate-limit choice
    - **Update `packages/contracts/README.md`** : section "Identity events" ajouter `identity.password-reset-requested.v1` + `identity.password.reset.v1` + template `password-reset` + `password-reset-confirmation`
    - **Email template contract `password-reset.{fr,en}.tsx`** (Story 5.4 — Story 1.5 fournit le payload contract) :
      - Subject FR : `"Réinitialisation de votre mot de passe Tukio"`
      - Subject EN : `"Reset your Tukio password"`
      - Preheader : `"Lien valide 30 minutes"` (FR) / `"Link valid 30 minutes"` (EN)
      - Body :
        - Greeting `"Bonjour {firstName},"` (FR) / `"Hi {firstName},"` (EN)
        - Body text : `"Vous avez demandé une réinitialisation..."` (FR) / `"You requested a password reset..."` (EN)
        - CTA primary : button `"Réinitialiser mon mot de passe"` → href `{resetUrl}` (FR) / `"Reset my password"` (EN)
        - Small print sécurité : `"Si vous n'avez pas demandé ce lien, ignorez cet email. Demande effectuée le {requestedAt} depuis {requestedFromIp} ({requestedUserAgent}). [Signaler une activité suspecte]({reportSuspiciousUrl})"` (FR) / EN equivalent
        - Footer : Tukio branding + adresse + lien désinscription (transactional → no unsubscribe required RGPD)
    - **Email template contract `password-reset-confirmation.{fr,en}.tsx`** (post-reset success) :
      - Subject FR : `"Votre mot de passe Tukio a été réinitialisé"` / EN : `"Your Tukio password has been reset"`
      - Body : `"Bonjour {firstName}, votre mot de passe a été réinitialisé le {resetAt}. Si ce n'est pas vous, [signalez-le immédiatement]({reportSuspiciousUrl})."` (FR) / EN equivalent
    - **Métriques Prometheus** : `tukio_password_reset_requests_total{result=success|unknown_email|rate_limit}`, `tukio_password_reset_confirms_total{result=success|expired|reused|external_error}`, `tukio_password_reset_token_created_total`, `tukio_password_reset_token_validated_total{result}`
    - **Dashboard Grafana** (`infra/k8s/grafana-dashboards/password-reset.json`) : 4 panels (request rate / success rate / expired/reused token rate / sessions invalidated count) — alerte Slack si reused token rate > 5 / heure (suspect attack)

## Tasks / Subtasks

- [ ] **Task 1 — Étendre `@tukio/contracts` avec DTOs + 2 events password reset + email templates** (AC: #2, #4, #10)
  - [ ] 1.1 — Créer `packages/contracts/src/dtos/identity/password-reset.dto.ts` :
    - `PasswordResetRequestInputSchema` (`{ email }`)
    - `PasswordResetConfirmInputSchema` (`{ token: uuid, newPassword: <complexity>, newPasswordConfirm }` + `.refine(match)`)
    - `PasswordResetValidateResponseSchema` (`{ valid: boolean }`)
  - [ ] 1.2 — Créer `packages/contracts/src/events/identity/password-reset-requested.v1.{schema.json,ts}` (audit event)
  - [ ] 1.3 — Créer `packages/contracts/src/events/identity/password-reset.v1.{schema.json,ts}` (audit event après success)
  - [ ] 1.4 — Update `packages/contracts/src/types/email-templates.ts` : ajouter `'password-reset'` + `'password-reset-confirmation'` templateIds
  - [ ] 1.5 — Update `packages/contracts/src/types/error-codes.ts` : ajouter `IDENTITY-EXPIRED-001`
  - [ ] 1.6 — Update `packages/contracts/src/index.ts` barrel + subpath
  - [ ] 1.7 — `pnpm --filter=@tukio/contracts build && test`

- [ ] **Task 2 — identity-svc : domain ports + KeycloakAdmin extension + exception** (AC: #6, #7)
  - [ ] 2.1 — Créer `apps/identity-svc/src/domain/ports/password-reset-token-repository.port.ts` (cf. AC6)
  - [ ] 2.2 — Update `apps/identity-svc/src/domain/ports/keycloak-admin.port.ts` : ajouter `logoutAllSessions` méthode
  - [ ] 2.3 — Update `apps/identity-svc/src/domain/ports/tokens.ts` : ajouter `PASSWORD_RESET_TOKEN_REPOSITORY` Symbol
  - [ ] 2.4 — Créer `apps/identity-svc/src/domain/exception/identity-expired.exception.ts` (extends DomainException, httpStatus 410, tukioCode IDENTITY-EXPIRED-001)

- [ ] **Task 3 — identity-svc : 3 use cases + tests** (AC: #7)
  - [ ] 3.1 — Créer `apps/identity-svc/src/usecases/request-password-reset.usecase.ts` (cf. AC7)
  - [ ] 3.2 — Créer `apps/identity-svc/src/usecases/confirm-password-reset.usecase.ts`
  - [ ] 3.3 — Créer `apps/identity-svc/src/usecases/validate-password-reset-token.usecase.ts`
  - [ ] 3.4 — Tests unit `*.usecase.spec.ts` (3 fichiers, 8+ cases each minimum, mocks ports)
  - [ ] 3.5 — Coverage ≥ 90 % (NFR71 + Story 0.6 jest config)

- [ ] **Task 4 — identity-svc : infrastructure repositories + KeycloakAdminService update + migration** (AC: #6)
  - [ ] 4.1 — Update `apps/identity-svc/src/infrastructure/external/keycloak/keycloak-admin.service.ts` (Story 1.2) : ajouter `logoutAllSessions` impl utilisant `kcAdminClient.users.logout({ realm, id })`
  - [ ] 4.2 — Créer `apps/identity-svc/src/infrastructure/persistence/typeorm/entities/password-reset-token.entity.ts`
  - [ ] 4.3 — Créer `apps/identity-svc/src/infrastructure/persistence/typeorm/repositories/password-reset-token.typeorm.repository.ts` (implements IPasswordResetTokenRepository)
  - [ ] 4.4 — Créer migration `1715250000000-CreatePasswordResetTokensTable.ts` (cf. AC6 SQL)
  - [ ] 4.5 — Update `apps/identity-svc/src/infrastructure/persistence/typeorm/data-source.ts` : ajouter `PasswordResetTokenEntity` à entities
  - [ ] 4.6 — Update `apps/identity-svc/src/infrastructure/persistence/typeorm/repositories/user-profile.typeorm.repository.ts` (Story 1.2) : étendre `runInTransaction` pour inclure `passwordResetTokenRepo` dans le context txn
  - [ ] 4.7 — Tests integration : Postgres testcontainer + tester save/findByToken/markUsed/expires query

- [ ] **Task 5 — identity-svc : controller `password-reset.controller.ts` + UseCasesProxyModule wiring** (AC: #8)
  - [ ] 5.1 — Créer `apps/identity-svc/src/infrastructure/http/controllers/password-reset.controller.ts` (3 endpoints `/internal/password-reset/{request,confirm,validate}`)
  - [ ] 5.2 — Créer DTO Zod pipes `apps/identity-svc/src/infrastructure/http/dtos/{password-reset-request,password-reset-confirm,password-reset-validate}.dto.ts`
  - [ ] 5.3 — Update `apps/identity-svc/src/infrastructure/usecases-proxy/usecases-proxy.module.ts` : ajouter 3 proxies
  - [ ] 5.4 — Update `apps/identity-svc/src/infrastructure/http/http.module.ts` : ajouter `PasswordResetController`
  - [ ] 5.5 — Tests E2E `apps/identity-svc/test/password-reset.e2e-spec.ts` (8+ cases AC7)

- [ ] **Task 6 — gateway-api : 3 endpoints `/v1/auth/password-reset/{request,confirm,validate}` + forwarder + throttle** (AC: #3, #4, #5)
  - [ ] 6.1 — Update `apps/gateway-api/src/domain/ports/identity-svc.port.ts` (Story 1.2) : ajouter `requestPasswordReset`, `confirmPasswordReset`, `validatePasswordResetToken` methods
  - [ ] 6.2 — Créer `apps/gateway-api/src/usecases/auth/password-reset.forwarder.ts` (3 forwarder methods)
  - [ ] 6.3 — Update `apps/gateway-api/src/infrastructure/external/identity-svc/identity-svc.client.ts` : ajouter 3 méthodes
  - [ ] 6.4 — Créer `apps/gateway-api/src/infrastructure/http/controllers/auth-password-reset.controller.ts` (3 endpoints — cf. AC3, 4, 5)
  - [ ] 6.5 — Update `apps/gateway-api/src/app.module.ts` : ajouter `AuthPasswordResetController` + throttler configs (`'password-reset-request'` 3/h, `'password-reset-confirm'` 5/min, `'password-reset-validate'` 30/min)
  - [ ] 6.6 — Update `apps/gateway-api/.env.example` : `THROTTLER_PASSWORD_RESET_*` env vars
  - [ ] 6.7 — Tests E2E `apps/gateway-api/test/auth/auth-password-reset.e2e-spec.ts` (10+ cases AC3-5)

- [ ] **Task 7 — Frontend : 2 pages (request + confirm) + i18n + tests** (AC: #1, #2)
  - [ ] 7.1 — Créer `packages/api-client/src/hooks/identity/use-password-reset.ts` (3 mutations TanStack Query : request, confirm, validate)
  - [ ] 7.2 — Créer `apps/public/src/app/[locale]/auth/password-reset/page.tsx` (Server Component layout) + `apps/public/src/features/auth/password-reset/components/PasswordResetRequestForm.tsx` (Client Component)
  - [ ] 7.3 — Créer `apps/public/src/app/[locale]/auth/password-reset/confirm/page.tsx` (Server Component avec pré-validation token via fetch `GET /v1/auth/password-reset/validate?token=...`) + `apps/public/src/features/auth/password-reset/components/PasswordResetConfirmForm.tsx` (Client Component)
  - [ ] 7.4 — Créer `apps/public/src/features/auth/password-reset/components/PasswordResetExpiredView.tsx` (rendered if pre-validation fails)
  - [ ] 7.5 — Update `apps/public/messages/{fr,en}.json` : namespace `auth.passwordReset.*` (~30 keys total request + confirm + expired)
  - [ ] 7.6 — Update `apps/public/src/app/[locale]/auth/login/page.tsx` (Story 1.4) : lire `?success=password_reset_complete` query param + afficher toast succès via `useEffect` côté Client Component child
  - [ ] 7.7 — Update `packages/api-client/src/hooks/index.ts` barrel

- [ ] **Task 8 — Tests Playwright e2e flow FR/EN + axe-core + perf** (AC: #9)
  - [ ] 8.1 — Créer `apps/public/e2e/auth/password-reset.spec.ts` avec 12 tests (cf. AC9)
  - [ ] 8.2 — Helper `apps/public/e2e/helpers/mailhog.ts` : utility pour query MailHog API + extract token from email body
  - [ ] 8.3 — Helper `apps/public/e2e/helpers/setup-test-user.ts` (réutilisé Story 1.4) : pré-créer user via Keycloak Admin API + cleanup
  - [ ] 8.4 — Helper testcontainer direct DB insert pour test 4 (token expired) : `apps/public/e2e/helpers/insert-expired-token.ts`
  - [ ] 8.5 — Run Playwright en CI : `pnpm --filter=apps/public test:e2e --grep "password reset"`
  - [ ] 8.6 — Vérifier 0 violations axe-core sur les 2 pages
  - [ ] 8.7 — Vérifier perf NFR48 ≤ 2 min p90 (flow incluant délai email)

- [ ] **Task 9 — Observability + runbooks + commit** (AC: #10)
  - [ ] 9.1 — Ajouter métriques Prom gateway-api + identity-svc (cf. AC10)
  - [ ] 9.2 — Créer `infra/k8s/grafana-dashboards/password-reset.json` (4 panels)
  - [ ] 9.3 — Créer `docs/runbook/password-reset-debug.md` (~70 lignes)
  - [ ] 9.4 — Créer `docs/runbook/password-reset-security.md` (~40 lignes)
  - [ ] 9.5 — Update `packages/contracts/README.md` : section Identity events + email templates
  - [ ] 9.6 — Lint + typecheck + tests : tous passent
  - [ ] 9.7 — Vérifier coverage : thresholds atteints
  - [ ] 9.8 — Commit `feat(auth): password reset flow end-to-end (request + confirm + validate-token endpoints + 2 frontend pages + invalidate-all-sessions + 2 NATS audit events + Resend templates contract + Playwright e2e FR/EN with MailHog)` — Story 1.5 done

## Dev Notes

### Pourquoi Story 1.5 = template "token-based 2-step flow"

> **Sources canoniques** : `_bmad-output/planning-artifacts/architecture.md` §Cross-Cutting Auth (lignes 234-241) + §Authentication & Security (lignes 665-697) + envelope ADR-014 ; `_bmad-output/planning-artifacts/prd.md` §FR7 (password reset link), §NFR9 (anti-énumération + password complexity), §NFR10 (rate limit), §NFR12 (sessions invalidation post-reset), §NFR48 (UX), §NFR71 (coverage) ; `_bmad-output/planning-artifacts/epics.md` §Story 1.5 (lignes 1149-1162) ; Stories 1.1 (Keycloak realm), 1.2 (KeycloakAdminService + email_verification_tokens table pattern), 1.4 (login flow consommé post-reset).

Story 1.2 a posé le **pattern register avec verify token email**. Story 1.5 réplique le **pattern token-based 2-step flow** (request + confirm via lien email + token DB UUID + Keycloak Admin update + audit event) pour le password reset. Ce pattern devient ensuite réutilisable pour :
- **Story 1.6** : Email verify endpoint (déjà préparé Story 1.2 — table `email_verification_tokens` + flow miroir)
- **Story 1.8 V1** : Email change avec confirmation par lien (token-based)
- **Story 1.9 V1** : Account delete avec double-opt-in (token-based)
- **V1+** : N'importe quelle action sensible nécessitant confirmation par email

**Story 1.5 = template à minutie** : NFR9 anti-énumération + NFR12 sessions invalidation + 30 min TTL + rate-limit strict + audit event + email security best practices (timestamp + IP + UA + report link).

### Décisions techniques majeures

1. **Table dédiée `password_reset_tokens`** (pas merge avec `email_verification_tokens` Story 1.2). Justification : (a) schemas peuvent diverger (request IP/UA pertinent pour password reset, pas pour verify email), (b) clearer code, (c) pas de risque cross-purpose token misuse, (d) délétion cascade indépendante (verify token expire après email verified, password reset token expire 30 min ou used).
2. **Anti-énumération NFR9 strict** : la response Step A est **toujours 200 generic**, peu importe que l'email existe. Aucune différence UI/API entre email exists/inconnu. Risk timing-attack mitigé par random delay 50-200ms côté gateway-api OU par identity-svc faisant un sleep proportionnel + random pour égaliser response time happy path / unknown path. **Décision MVP** : pas de delay artificiel (acceptable risk, complexité débordante) — V1+ ajouter delay si audit security flag.
3. **30 min TTL token** : standard industry (vs 7 jours email verify Story 1.2 — verify peut prendre du temps, password reset doit être utilisé rapidement avant que l'attaquant intercepte l'email).
4. **Sessions invalidation NFR12 stricte** : `users.logout` Keycloak revoke ALL refresh tokens — l'utilisateur doit se re-login partout (current device + autres devices). Cohérent avec security best practice OWASP.
5. **`logoutAllSessions` failure non-fatal** : si Keycloak update password OK mais logout fail, on continue (password est déjà reset, sessions actuelles vont expirer naturellement après 5 min via JWKS cache + access token TTL). Drift R8 acceptable MVP.
6. **3 endpoints distincts** (request / confirm / validate) plutôt que 2 :
   - `request` (POST) : initie le flow
   - `confirm` (POST) : finalise le reset
   - `validate` (GET) : permet pré-validation côté Server Component (UX fluide — pas besoin d'attendre form submit pour découvrir token expiré)
7. **Rate-limit 3/h/IP request** (vs 5/min/IP register Story 1.2) : password reset est **moins fréquent** que register, le pattern d'usage justifie un rate-limit horaire au lieu de minute. Empêche spam abuse + email bombing.
8. **2 events identity** publiés (request + reset) : permet observability complète (combien de requests, combien aboutissent à un reset, combien expirent sans usage). Story 2.7 audit consume.
9. **Email confirmation post-reset** : email "Your password has been changed" envoyé après success — security best practice (alerte user en cas de account compromise).
10. **Server Component pré-validation token** (AC2) : UX fluide — pas de "page form qui submit puis dit ah token expiré". L'utilisateur arrive directement sur la page d'erreur si token invalide.
11. **i18n + EN strict** réutilisent memories.

### Versions à utiliser

| Lib | Rôle | Version cible | Notes |
|---|---|---|---|
| **`@keycloak/keycloak-admin-client`** | Story 1.2 already installed | latest stable | Réutilisé Story 1.5 (`setUserPassword` + `logoutAllSessions`) |
| **`@nestjs/throttler`** | Story 1.2 | latest | Réutilisé |
| **TypeORM + Postgres** | Story 0.6 | bundled identity-svc | Réutilisé |
| **MailHog API** (tests) | Story 0.10 dev | latest | Pour e2e Playwright vérification email reçu |

### Project Structure cible

```
packages/contracts/src/
├─ dtos/identity/password-reset.dto.ts                              # NEW Story 1.5
├─ events/identity/{password-reset-requested,password-reset}.v1.{schema.json,ts}  # NEW (4 fichiers)
└─ types/{error-codes,email-templates}.ts                           # UPDATE — IDENTITY-EXPIRED-001 + 2 templateIds

apps/identity-svc/src/
├─ domain/
│  ├─ ports/password-reset-token-repository.port.ts                 # NEW
│  ├─ ports/keycloak-admin.port.ts                                  # UPDATE Story 1.2 — logoutAllSessions
│  ├─ ports/tokens.ts                                               # UPDATE — PASSWORD_RESET_TOKEN_REPOSITORY
│  └─ exception/identity-expired.exception.ts                       # NEW
├─ usecases/
│  ├─ request-password-reset.usecase.ts                             # NEW + spec
│  ├─ confirm-password-reset.usecase.ts                             # NEW + spec
│  └─ validate-password-reset-token.usecase.ts                      # NEW + spec
└─ infrastructure/
   ├─ external/keycloak/keycloak-admin.service.ts                   # UPDATE Story 1.2 — logoutAllSessions impl
   ├─ persistence/typeorm/
   │  ├─ entities/password-reset-token.entity.ts                    # NEW
   │  ├─ repositories/password-reset-token.typeorm.repository.ts    # NEW
   │  ├─ repositories/user-profile.typeorm.repository.ts            # UPDATE — runInTransaction étendu
   │  ├─ migrations/1715250000000-CreatePasswordResetTokensTable.ts # NEW
   │  └─ data-source.ts                                             # UPDATE — entity ajoutée
   ├─ http/
   │  ├─ controllers/password-reset.controller.ts                   # NEW (3 endpoints)
   │  └─ dtos/{password-reset-{request,confirm,validate}}.dto.ts    # NEW (3 fichiers)
   └─ usecases-proxy/usecases-proxy.module.ts                       # UPDATE — 3 proxies

apps/identity-svc/test/password-reset.e2e-spec.ts                   # NEW

apps/gateway-api/src/
├─ domain/ports/identity-svc.port.ts                                # UPDATE Story 1.2 — 3 méthodes ajoutées
├─ usecases/auth/password-reset.forwarder.ts                        # NEW
├─ infrastructure/
│  ├─ external/identity-svc/identity-svc.client.ts                  # UPDATE — 3 méthodes
│  └─ http/controllers/auth-password-reset.controller.ts            # NEW (3 endpoints)
└─ app.module.ts                                                    # UPDATE — controller + throttlers

apps/gateway-api/test/auth/auth-password-reset.e2e-spec.ts          # NEW
apps/gateway-api/.env.example                                       # UPDATE — throttler env vars

apps/public/src/
├─ app/[locale]/auth/
│  ├─ password-reset/page.tsx                                       # NEW
│  └─ password-reset/confirm/page.tsx                               # NEW (Server Component avec pré-validation)
├─ features/auth/password-reset/
│  ├─ components/PasswordResetRequestForm.tsx                       # NEW
│  ├─ components/PasswordResetConfirmForm.tsx                       # NEW
│  ├─ components/PasswordResetExpiredView.tsx                       # NEW
│  ├─ services/password-reset.service.ts                            # NEW
│  └─ index.ts
├─ app/[locale]/auth/login/page.tsx                                 # UPDATE Story 1.4 — read ?success=password_reset_complete
└─ messages/{fr,en}.json                                            # UPDATE — namespace auth.passwordReset.*

apps/public/e2e/auth/password-reset.spec.ts                         # NEW (12 tests)
apps/public/e2e/helpers/{mailhog,insert-expired-token}.ts           # NEW

packages/api-client/src/hooks/identity/use-password-reset.ts        # NEW
packages/api-client/src/hooks/index.ts                              # UPDATE barrel

infra/k8s/grafana-dashboards/password-reset.json                    # NEW

docs/runbook/{password-reset-debug,password-reset-security}.md      # NEW (2)

# Estimation total fichiers : ~45 nouveaux + ~15 updates = ~60 fichiers
```

### Pattern code — `RequestPasswordResetUseCase` anti-énumération + audit (squelette)

(cf. AC7 squelette complet annotated)

### Critical Architecture Constraints

> Cf. Stories 1.2 + 1.4 + memories.

1. **Pattern Pretre strict** + **Symbol DI tokens** + **Envelope ADR-014** + **Outbox transactional** (réutilisés)
2. **Anti-énumération NFR9** : response 200 generic toujours sur Step A
3. **NFR12 sessions invalidation** : `users.logout` Keycloak Admin API
4. **Password complexity** : Zod schema réutilisé Story 1.2 (12+ chars + maj/min/digit/special)
5. **Token UUID v4 + 30 min TTL + single-use** (`used_at` mark)
6. **Rate-limit Redis-backed** : 3/h request + 5/min confirm + 30/min validate (différenciés selon usage)
7. **HTTPS exclusif** : password en clair via TLS uniquement, jamais loggé (PII redaction)
8. **i18n strict** + **EN strict tech**

### Previous Story Intelligence

**Story 0.6** : Pretre + envelope + UseCasesProxyModule + DomainException — réutilisés.

**Story 0.7** : `@tukio/messaging` outbox — réutilisé pour 2 events publish atomiques.

**Story 0.8** : `@tukio/auth-client` — pas directement utilisé Story 1.5 (pas d'auth requise sur endpoints public). Mais Story 1.5 REUTILISE le pattern login Story 1.4 post-reset (redirect vers `/auth/login?success=password_reset_complete`).

**Story 1.1** : Keycloak realm + brute-force protection — Story 1.5 utilise `users.resetPassword` (Keycloak Admin API) + `users.logout` (mêmes credentials `tukio-api` Story 1.1).

**Story 1.2** : 🔴 **TEMPLATE PRINCIPAL** — pattern register/verify token + `KeycloakAdminService` + `EnvironmentConfigService` + 2 events outbox + envelope errors. Story 1.5 :
- **Réutilise** : `KeycloakAdminService.setUserPassword` (déjà dans interface Story 1.2 AC5)
- **Étend** : ajoute `logoutAllSessions` méthode au port + impl
- **Réplique pattern** : table token UUID v4 + use case (mock pattern register-customer Story 1.2)
- **Réplique pattern** : 2 events outbox dans transaction
- **Réutilise** : Zod schema `password` complexity de `RegisterCustomerInputSchema`
- **Réutilise** : envelope error mapping pattern (`IdentityConflictException` Story 1.2 → `IdentityExpiredException` Story 1.5)
- **Réutilise** : forwarder pattern gateway-api (`RegisterCustomerForwarder` → `PasswordResetForwarder`)
- **Réutilise** : `<FormField>` + `<Button>` + `<EmptyState>` atomics Story 0.4

**Story 1.3** : pattern multi-step wizard NOT applicable Story 1.5 (just 1 form per step), mais pattern compensation saga skip (Story 1.5 ne fait pas de saga complexe — juste 1 Keycloak call + 1 transaction DB).

**Story 1.4** : login flow → consommé post-reset. Login page Story 1.4 doit lire `?success=password_reset_complete` query param + afficher toast — **Task 7.6** modifie Story 1.4 page.

### What this story does NOT do (out of scope)

- ❌ **Email verification flow + landing** → Story 1.6 (réutilise pattern Story 1.5 token-based)
- ❌ **Admin TOTP setup** → Story 1.7
- ❌ **Profile update password** → Story 1.8 (V1 — différent flow : user authenticated change own password sans email link)
- ❌ **Account delete avec confirmation email** → Story 1.9 V1 (réutilisera pattern Story 1.5)
- ❌ **2FA TOTP recovery via email** → V2 (out of scope MVP password reset)
- ❌ **notification-svc Resend send mail** → Story 5.4 (Story 1.5 fournit le payload contract `password-reset.{fr,en}.tsx`)
- ❌ **Page "Suspicious activity report"** → Story 6.4 (placeholder Story 1.5 link, finalisé Story 6.4)
- ❌ **Email digest "X password resets this week"** → V1 admin observability

### Files to UPDATE vs CREATE

(cf. Project Structure cible)

### Testing Standards

- **Coverage** : ≥ 90 % use cases, ≥ 80 % endpoints, ≥ 80 % frontend forms (NFR71)
- **Tests unit** Vitest mocks (3 use cases × 8+ cases = 24+ tests)
- **Tests integration** Postgres testcontainer + Keycloak testcontainer
- **Tests E2E** Playwright FR + EN + axe-core (12 cases AC9)
- **MailHog API** pour vérification email reçu en CI
- **Performance** : NFR48 ≤ 2 min p90 (incluant délai email)

### Project Structure Notes

✅ **Aligné** avec Architecture lignes 234-241 + 665-697.

✅ **Aligné** avec PRD §FR7 + §NFR9, NFR10, NFR12, NFR48, NFR71.

✅ **Aligné** avec memories `feedback_clean_architecture_explicit.md`, `feedback_api_envelope_response.md`, `feedback_tech_layer_english.md`, `feedback_i18n_frontend.md`.

⚠️ **Décision documentée** : table séparée `password_reset_tokens` (pas merge avec `email_verification_tokens`) (cf. Décisions techniques §1).

⚠️ **Décision documentée** : sessions invalidation `users.logout` non-fatal post-password-reset (cf. Décisions techniques §5).

⚠️ **Décision documentée** : 3 endpoints distincts (request / confirm / validate) pour UX fluide pré-validation (cf. Décisions techniques §6).

⚠️ **À noter** : la **page "Suspicious activity report"** Story 6.4 est un placeholder dans Story 1.5 (lien dans email template). Story 6.4 finalise.

⚠️ **À noter** : le **timing-attack mitigation** (random delay 50-200ms) est documenté mais non implémenté MVP (cf. Décisions techniques §2 + `docs/runbook/password-reset-security.md`). V1+ si audit security flag.

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Cross-Cutting-Auth — Lines 234-241]
- [Source: _bmad-output/planning-artifacts/architecture.md#Authentication-Security — Lines 665-697]
- [Source: _bmad-output/planning-artifacts/architecture.md#Authentication-Flow — Lines 1731-1738]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic-1-Story-1.5 — Lines 1149-1162]
- [Source: _bmad-output/planning-artifacts/prd.md#FR7 — Password reset email link]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR9 — Anti-énumération + password complexity]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR10 — Rate limit]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR12 — Sessions invalidation post-reset]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR48 — UX]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR71 — Coverage]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — UX-DR9 password reset pattern]
- [Source: _bmad-output/implementation-artifacts/0-2-initialize-tukio-contracts-envelope-nats-events-dtos.md — Story 0.2 (envelope + DomainEvent)]
- [Source: _bmad-output/implementation-artifacts/0-6-pattern-pretre-scaffolding-template-identity-svc.md — Story 0.6 (Pretre + envelope ADR-014)]
- [Source: _bmad-output/implementation-artifacts/0-7-setup-tukio-messaging-nats-jetstream.md — Story 0.7 (NATS audit event)]
- [Source: _bmad-output/implementation-artifacts/0-8-setup-tukio-auth-backend-frontend.md — Story 0.8 (login flow consommé post-reset)]
- [Source: _bmad-output/implementation-artifacts/1-1-provision-keycloak-realm-tukio-roles-clients-phasetwo.md — Story 1.1 (realm + brute-force)]
- [Source: _bmad-output/implementation-artifacts/1-2-customer-b2c-registration.md — 🔴 TEMPLATE PRINCIPAL (Pretre register pattern + KeycloakAdminService + email-verification-tokens table pattern + envelope errors)]
- [Source: _bmad-output/implementation-artifacts/1-4-login-flow-keycloak-authorization-code-pkce.md — Story 1.4 (login consommé post-reset)]
- [External: https://www.keycloak.org/docs-api/26.0/rest-api/index.html#_users_resource — Keycloak Admin API users.resetPassword + users.logout]
- [External: https://datatracker.ietf.org/doc/html/rfc6238 — TOTP standard (réf Story 1.7)]
- [External: https://owasp.org/www-community/attacks/Account_Enumeration — OWASP anti-énumération]
- [Memory: feedback_clean_architecture_explicit.md]
- [Memory: feedback_api_envelope_response.md]
- [Memory: feedback_tech_layer_english.md]
- [Memory: feedback_i18n_frontend.md]
- [Memory: feedback_latest_versions.md]

## Dev Agent Record

### Agent Model Used

(à remplir)

### Debug Log References

(à remplir — vérification Keycloak `users.logout` API behavior cohérent attendu, validation rate-limit Redis-backed cross-replicas K8s, validation MailHog testcontainer fonctionne en CI, validation Server Component pré-validation token ne crée pas de boucle redirect, drift R8 si `logoutAllSessions` fail post-`setUserPassword` — accepted MVP)

### Completion Notes List

(à remplir — résumé décisions, points d'attention pour Story 1.6 (email verify pattern miroir), Story 5.4 (notification-svc Resend templates `password-reset` + `password-reset-confirmation`), Story 2.7 (audit consume `identity.password.reset.v1` event), Story 6.4 (page "Suspicious activity report"))

### File List

(à remplir)

---

## Story Completion Status

- **Story Status** : `ready-for-dev`
- **Created** : 2026-05-09
- **Created by** : `bmad-create-story` workflow
- **Epic** : Epic 1 — Identity & Authentication Backbone (MVP)
- **Sprint cible** : Sprint 2 (semaine 5-6 du planning MVP, 5ᵉ story Epic 1)
- **Estimation effort** : 4-6 jours (1 dev fullstack senior — story moins complexe que 1.2/1.3 grâce aux patterns réutilisés massivement, ~60 fichiers touchés)
- **Dépendances upstream** :
  - **Story 0.2** (envelope + DomainEvent)
  - **Story 0.4** (atomics FormField + Input + Button + EmptyState)
  - **Story 0.6** (Pretre + envelope ADR-014 + EnvironmentConfigService)
  - **Story 0.7** (NATS outbox)
  - **Story 0.10** (Docker Compose + MailHog dev)
  - **Story 1.1** (Keycloak realm + tukio-api confidential client)
  - **Story 1.2** (🔴 TEMPLATE PRINCIPAL — KeycloakAdminService + email_verification_tokens pattern réutilisé)
  - **Story 1.4** (login flow — page login consume `?success=password_reset_complete`)
- **Dépendances downstream** :
  - **Story 1.6** (Email verify) — pattern miroir
  - **Story 1.7** (Admin TOTP setup) — non-impactée
  - **Story 1.8** (Profile update password authenticated) — différent flow V1
  - **Story 1.9** (Account delete) — V1 réutilisera pattern token confirmation
  - **Story 1.10** (identity-svc consolidation) — consume audit events
  - **Story 2.7** (Audit trail) — consume `identity.password.reset.v1`
  - **Story 5.4** (notification-svc) — consume templates `password-reset` + `password-reset-confirmation` → Resend
  - **Story 6.4** (Suspicious activity report page) — link dans email template
- **FRs covered** :
  - **FR7** ✅ Password reset via email link
- **NFRs touchés** :
  - **NFR9** ✅ Anti-énumération + password complexity
  - **NFR10** ✅ Rate limit 3/h request + 5/min confirm
  - **NFR12** ✅ Sessions invalidation post-reset (users.logout Keycloak)
  - **NFR48** ✅ UX ≤ 2 min p90
  - **NFR71** ✅ Coverage thresholds

> **Prochaine story (auto-discover via `bmad-create-story`) → Story 1.6** (Email verification flow `POST /v1/auth/email/verify` + landing page)

---

**Dev agent next steps :**
1. Lire ce file en entier
2. Vérifier upstream (Stories 0.2, 0.4, 0.6, 0.7, 0.10, 1.1, 1.2, 1.4) ready-for-dev ou done
3. **CRITIQUE** : Story 1.2 doit être implémentée AVANT Story 1.5 (massive réutilisation patterns)
4. Implémenter Tasks 1-9 dans l'ordre (Task 1 indépendante, Tasks 2-5 backend séquentielles, Tasks 6-7 frontend peuvent paralléliser, Tasks 8-9 finalize)
5. Lancer après chaque jalon : `pnpm lint && pnpm typecheck && pnpm test --filter=...[origin/main] && pnpm playwright test --grep "password reset"`
6. Commit Story 1.5 quand : 12/12 e2e tests passent + coverage ≥ thresholds + axe-core 0 violations + perf NFR48 OK
7. Update sprint-status : `1-5-password-reset-flow: review` (puis `done` après code-review)
