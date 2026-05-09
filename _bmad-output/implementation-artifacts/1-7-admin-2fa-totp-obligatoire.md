# Story 1.7: Admin 2FA TOTP obligatoire (`POST /v1/auth/totp/setup` + `POST /v1/auth/totp/verify`)

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

**As an** Admin (rôle `admin-support` / `admin-modo` / `admin-super`) fraîchement créé via `infra/scripts/create-admin.ts` (CLI script Story 1.7) ou via flow "Admin Super invite" (Epic 6 V1) — Keycloak user avec `requiredActions: ['CONFIGURE_TOTP']`,
**I want** un flow de setup 2FA TOTP **obligatoire avant tout accès `admin.tukio.one/admin/*`** (NFR12 + FR9 enforced) en 4 phases : (Phase 1) Story 1.4 login Keycloak detect `amr` sans `totp` claim → redirect `apps/admin/{locale}/auth/totp-setup` ; (Phase 2) la page setup affiche un **QR code généré server-side via `otplib` + `qrcode`** (RFC 6238 — secret 20-byte base32, algorithm SHA-256, digits 6, period 30s, issuer "Tukio"), un **champ 6-digit input** avec auto-advance + paste support + masquage temporaire avant submit, **8 recovery codes** générés post-verification (8 chars alphanumériques uppercase, hashés bcrypt cost 10 dans table `admin_totp_recovery_codes`, single-use, displayed une seule fois avec CTA "Imprimer" + "Télécharger PDF" + checkbox "J'ai sauvegardé ces codes" requise pour terminer setup), et un CTA "Valider" qui appelle `POST /v1/auth/totp/verify` ; (Phase 3) gateway-api `POST /v1/auth/totp/setup` (authenticated admin) génère secret + stocke dans Redis Upstash (clé `totp-setup:{userId}`, TTL 10 min) + retourne `{ secret, otpauthUrl, qrCodeDataUrl }` ; gateway-api `POST /v1/auth/totp/verify` (body `{ code }`) lit secret Redis + verify code via `otplib.authenticator.verify({ token, secret, window: 1 })` (window 1 = ±30s tolerance horloges drift) → si valide, identity-svc Keycloak Admin API `users.resetPassword`-style ajoute credential type `otp` avec `secretData={value: base32Secret}` + génère 8 recovery codes + clear `requiredActions: []` Keycloak + publie `identity.admin.totp.configured.v1` audit event → return 201 enveloppe `{ recoveryCodes: string[] }` ; (Phase 4) post-success, page redirect `admin.tukio.one/{locale}/admin/dashboard` (Story 1.4 force-refresh JWT pattern Story 1.6 — pour propager nouveau `amr.totp` claim), middleware admin (UPDATE Story 1.4) **strict** : tout admin `realm_access.roles` includes `admin-*` mais sans `amr.totp` → redirect `/auth/totp-setup` (zéro bypass), **recovery code flow** : si admin perd son device TOTP, login Story 1.4 → Keycloak login page proposant fallback "Utiliser un code de récupération" → user entre 8 chars → gateway-api `POST /v1/auth/totp/recovery/use` valide le code (bcrypt compare + check `used_at IS NULL`) → mark used + force re-setup TOTP immédiat (set Keycloak `requiredActions: ['CONFIGURE_TOTP']` + clear current OTP credential) + audit event `identity.admin.totp.recovery-used.v1` (alerte security car suspect — Slack notif `#tukio-alerts`),
**so that** les comptes Admin (accès complet plateforme : refunds, ban users, replay events, impersonation, audit log) sont **protégés par 2 facteurs** (password + TOTP device) — vol de password seul = pas d'accès, vol device seul = pas d'accès, NFR12 strictement enforced ; les Stories Epic 6 (Admin moderation console) consomment des Admin sessions garanties MFA-protected ; le **pattern complet "OTP setup avec Redis temp + persistence Keycloak + recovery codes"** devient réutilisable Story 1.10 (Pro 2FA optionnel V1 FR10 — même flow mais opt-in user-initiated), V2 admin Pro Enterprise (Epic 15 SAML SSO with MFA fallback) ; et le **`infra/scripts/create-admin.ts`** devient le seul moyen MVP de bootstrap des admins (V1+ Epic 6 ajoute UI Admin Super invite avec email invitation flow).

> **Outcome attendu** : à la fin de cette story, le founder/tech lead peut bootstrap un Admin via `pnpm admin:create --email=ismael@tukio.one --role=admin-super --first-name=Ismael --last-name=M.` qui (1) crée un user Keycloak avec rôle `admin-super` + `requiredActions: ['CONFIGURE_TOTP']` + email pre-verified true + temporary password généré aléatoirement loggé console (CLI output, jamais persisté), (2) envoie un email transactionnel via Resend template `admin-onboarding` avec lien magic vers `apps/admin/{locale}/auth/login` + temp password ; cet Admin se connecte (Story 1.4 flow) → Keycloak `tukio-admin-mfa-required` flow détecte `requiredActions.CONFIGURE_TOTP` → redirect `apps/admin/{locale}/auth/totp-setup` ; sur la page, l'Admin scanne le QR code dans Google Authenticator / Authy / 1Password / Bitwarden (any RFC 6238 compliant TOTP authenticator) → entre le code 6-digit → success → 8 recovery codes affichés (e.g. `XK4F-9PMQ`, `T8H2-VR3N`, ...) → l'Admin imprime + sauvegarde + check "J'ai sauvegardé" → clic "Continuer" → redirect `admin.tukio.one/{locale}/admin/dashboard` ; au logout puis re-login, le flow Keycloak demande email + password + TOTP code (3 facteurs) ; un Admin qui essaie de bypass middleware (e.g., direct fetch `admin.tukio.one/admin/users` avec un JWT sans `amr.totp` — impossible normalement car Keycloak flow force) → middleware admin redirect `/auth/totp-setup` ; un Admin qui perd son téléphone (lost device) → login → page erreur "Code TOTP invalide" → click "Utiliser un code de récupération" → Keycloak presente input 8-char → user entre `XK4F-9PMQ` → server validates + force re-setup → flow setup re-trigger ; un test `pnpm playwright test --grep "admin totp"` passe en FR ET EN, axe-core 0 violations, 8 scénarios (happy path setup FR + EN, paste code, invalid code, expired secret Redis, recovery code use, post-recovery re-setup forced, middleware bypass attempt, Slack alert on recovery used).

## Acceptance Criteria

1. **AC1 — `infra/scripts/create-admin.ts` CLI script** : Given le besoin de bootstrap des Admin sans UI Story 6 (V1+), When un dev/founder lance `pnpm admin:create --email=<email> --role=<admin-support|admin-modo|admin-super> --first-name=<fn> --last-name=<ln> [--locale=fr|en]` (default `fr`), Then :
   - **Script bash + TypeScript** : `infra/scripts/create-admin.ts` (Node.js executable via `pnpm tsx infra/scripts/create-admin.ts ...`)
   - **Validations CLI args** : email RFC 5322, role enum strict, names 1-80 chars, locale enum
   - **Workflow** :
     1. Connect Keycloak Admin API (Story 1.1 service-account `tukio-api` via env Doppler)
     2. Generate temp password : 16 chars random alphanumeric + 1 special (cohérent password complexity Story 1.2)
     3. `kcAdminClient.users.create({ email, firstName, lastName, enabled: true, emailVerified: true, attributes: { locale: [locale], status: ['active'] }, requiredActions: ['CONFIGURE_TOTP'], credentials: [{ type: 'password', value: tempPassword, temporary: true /* force change */ }] })` — `temporary: true` force le user à changer son password au 1ᵉʳ login
     4. Assign rôle realm-level via `kcAdminClient.users.addRealmRoleMappings({ id, roles: [{ id: <admin-role-id>, name: <role> }] })`
     5. Create UserProfile aggregate via identity-svc HTTP call `POST /internal/admins` (NEW endpoint Story 1.7) avec body `{ keycloakUserId, email, firstName, lastName, role, locale }` — identity-svc crée le row `user_profiles` avec `role=<role>`, `tukio_status='active'`, `email_verified=true`
     6. Optionally publish NATS `identity.admin.created.v1` audit event
     7. Output console (PII-redacted save for first_login_url) :
        ```
        ✅ Admin created successfully
           email: ismael@tukio.one
           role: admin-super
           userId: <uuid>
           keycloakUserId: <kc-uuid>
           
        🔑 First-login credentials (PRINTED ONCE — save to a password manager):
           email: ismael@tukio.one
           temporary password: XYZ#abc123!def
           
        📧 Onboarding email sent to ismael@tukio.one (template: admin-onboarding)
        
        Next: admin must visit https://admin.tukio.one/fr/auth/login, change password, then setup TOTP.
        ```
   - **Idempotency** : si email existe déjà → script error "Admin already exists" (no overwrite — security)
   - **Email transactionnel optionnel** : `--send-email=true|false` (default `true`) — si true, publish `notification.email.send.v1` template `admin-onboarding` avec preheader, greeting, CTA login, temp password (NB : password en clair dans email = compromis security/UX accepté pour MVP — V1 amélioration via magic-link 1-click setup avec temp token)
   - **Tests** : tests CLI dry-run (`--dry-run`) qui simule sans toucher Keycloak/DB, + tests integration testcontainer Keycloak + Postgres
   - **Add to `package.json` racine** : `"admin:create": "tsx infra/scripts/create-admin.ts"`

2. **AC2 — Frontend page `apps/admin/[locale]/auth/totp-setup`** : Given un Admin authentifié sans TOTP, When il arrive sur `admin.tukio.one/{fr|en}/auth/totp-setup` (redirect par middleware Story 1.4 ou Story 1.7 enforce), Then :
   - **Layout** : Server Component `<AdminAuthLayout>` (NEW Story 1.7 ou réutilise pattern apps/admin Story 1.4)
   - **Hero** : `<h1>Activer la double authentification</h1>` (FR) / `<h1>Set up two-factor authentication</h1>` (EN), Fraunces 500 charcoal-800
   - **Description** : `<p>Pour la sécurité de votre compte admin, vous devez configurer une application d'authentification (Google Authenticator, Authy, 1Password, Bitwarden...).</p>` (FR) / EN equivalent
   - **Phase setup state machine** (Client Component `<TotpSetupWizard>`) :
     - **Phase A — Initiate** : auto-trigger `POST /v1/auth/totp/setup` au mount → display `<Spinner>` brief
     - **Phase B — Scan QR** : render après response setup OK :
       - QR code `<img src={qrCodeDataUrl} alt="TOTP QR code" width={240} height={240}>` (data URL PNG base64)
       - **Fallback manuel** : `<details>` collapsible `"Saisie manuelle (si scan impossible)"` → affiche secret base32 formaté `XXXX-XXXX-XXXX-XXXX-XXXX` (groupes de 4 pour readability) + indication `"Algorithme : SHA-256, Digits : 6, Période : 30s, Issuer : Tukio"`
       - Description : `"Scannez ce QR code dans votre application d'authentification, puis entrez le code à 6 chiffres ci-dessous."`
       - **Input 6-digit** : `<TotpCodeInput>` (Story 0.4 atomic ou créé Story 1.7) — 6 sub-inputs `<input inputMode="numeric" pattern="\d" maxLength="1">` avec auto-advance focus next + paste support (intercept paste, distribue chars sur les 6 inputs) + arrow keys navigation
       - CTA `<Button variant="primary" size="lg" type="submit">Valider</Button>` — disabled jusqu'à 6 chiffres entrés
       - Lien secondaire : `<button type="button" onClick={refreshSecret}>Générer un nouveau QR code</button>` — renew secret (re-call POST /setup, invalidate previous Redis secret)
     - **Phase C — Verify** : au submit, appelle `POST /v1/auth/totp/verify` avec `{ code }` → loading state → si success, transition vers Phase D ; si error, message inline `"Code incorrect, vérifiez votre application"` + reset input
     - **Phase D — Recovery codes** : render après response verify OK :
       - Title : `"Sauvegardez vos codes de récupération"` (FR) / `"Save your recovery codes"` (EN)
       - Description : `"<strong>Imprimez ou sauvegardez ces codes en lieu sûr.</strong> Ils vous permettront d'accéder à votre compte si vous perdez votre appareil. Chaque code est utilisable une seule fois."`
       - Display 8 codes en monospace 2 colonnes : `<pre><code>XK4F-9PMQ\nT8H2-VR3N\n...\n</code></pre>`
       - Buttons : `<Button variant="secondary" onClick={print}>Imprimer</Button>` (utilise `window.print()` natif) + `<Button variant="ghost" onClick={downloadPdf}>Télécharger PDF</Button>` (V1+ feature, MVP affiche un fallback "Capture d'écran recommandée")
       - Checkbox required : `<Checkbox label="J'ai sauvegardé ces codes en lieu sûr" required>`
       - CTA final : `<Button variant="primary" size="lg" type="submit" disabled={!checkboxChecked}>Continuer vers le dashboard</Button>` → click → redirect `admin.tukio.one/{locale}/admin/dashboard` (avec force-refresh JWT pattern Story 1.6 pour propager `amr.totp` claim)
   - **i18n strict** : namespace `admin.auth.totpSetup.*` (~25 keys)
   - **Accessibilité RGAA AA** : 6-digit input keyboard navigable (Arrow keys, Tab, Backspace), focus management entre inputs, `<img>` alt + fallback text, `role="alert"` pour erreurs, axe-core 0 violations
   - **Mobile responsive** : QR code 240x240 (suffisant scan smartphone), 6-digit input large `min-h-12 text-2xl` (touch-friendly)
   - **Test Playwright e2e** : (cf. AC9) — happy path FR + EN, paste code, invalid code, expired secret, refresh secret

3. **AC3 — gateway-api endpoint `POST /v1/auth/totp/setup` (authenticated admin)** : Given `apps/gateway-api/src/infrastructure/http/controllers/auth-totp.controller.ts` (NEW), When un admin authentifié appelle :
   - **Endpoint** :
     ```ts
     @Controller('/v1/auth/totp')
     export class AuthTotpController {
       @Post('/setup')
       @UseGuards(KeycloakJwtGuard, RolesGuard) // Story 0.8 — requires authenticated user with admin role
       @Roles('admin-support', 'admin-modo', 'admin-super')
       @HttpCode(200)
       async setup(@CurrentActor() actor: Actor): Promise<{ secret: string; otpauthUrl: string; qrCodeDataUrl: string }> {
         return this.totpForwarder.getInstance().setup({ actor });
       }
     }
     ```
   - **Forwarder + identity-svc use case** : génère TOTP secret via `otplib.authenticator.generateSecret()` (RFC 6238 base32 32 chars), construit `otpauthUrl = otplib.authenticator.keyuri(actor.email, 'Tukio', secret)`, génère QR code via `qrcode.toDataURL(otpauthUrl, { width: 240 })` → stocke `{ secret, createdAt }` dans Redis Upstash key `totp-setup:{userId}` TTL 600s (10 min)
   - **Réponse** :
     ```json
     {
       "method": "POST",
       "code": 200,
       "data": {
         "secret": "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",  // base32, 32 chars (NB: exposed for manual entry fallback — acceptable as setup is short-lived)
         "otpauthUrl": "otpauth://totp/Tukio:admin@tukio.one?secret=...&issuer=Tukio&algorithm=SHA256&digits=6&period=30",
         "qrCodeDataUrl": "data:image/png;base64,iVBORw0KG..."
       },
       "meta": { ... }
     }
     ```
   - **Idempotency** : si `totp-setup:{userId}` existe déjà dans Redis (un setup en cours), retourne le même secret/QR (pas de regen). Si user veut regen explicite → `?refresh=true` query param qui force `DEL` + nouveau secret.
   - **Si admin a déjà TOTP configuré** (vérifier via Keycloak `users.get({id}).credentials` includes type 'otp') → `409 ErrorEnvelope { tukioCode: 'IDENTITY-CONFLICT-004', message: 'TOTP already configured. Disable existing TOTP first.' }`
   - **Tests E2E** : valid admin → 200 + secret + QR. Non-admin (rôle `client`) → 403. Already configured → 409. Idempotent (2 calls back-to-back) → same secret returned.

4. **AC4 — gateway-api endpoint `POST /v1/auth/totp/verify` (authenticated admin)** : Given AC3 controller (UPDATE), When :
   - **Endpoint** :
     ```ts
     @Post('/verify')
     @UseGuards(KeycloakJwtGuard, RolesGuard)
     @Roles('admin-support', 'admin-modo', 'admin-super')
     @HttpCode(201)
     async verify(@Body() dto: TotpVerifyInput, @CurrentActor() actor: Actor): Promise<{ recoveryCodes: string[] }> {
       return this.totpForwarder.getInstance().verify({ actor, code: dto.code });
     }
     ```
   - **Validation Zod** : `TotpVerifyInputSchema` = `z.object({ code: z.string().regex(/^\d{6}$/, 'TOTP code must be 6 digits') })`
   - **identity-svc use case `VerifyTotpUseCase`** :
     1. Read secret from Redis `totp-setup:{userId}` — si absent (TTL expiré) → throw `IdentityExpiredException('IDENTITY-EXPIRED-002', 'Setup secret expired, restart setup')`
     2. Verify code via `otplib.authenticator.verify({ token: code, secret })` (window 1 = ±30s tolerance horloge drift) — si invalid → throw `IdentityValidationException('IDENTITY-VALIDATION-004', 'Invalid TOTP code')`
     3. Persist credential to Keycloak via Admin API : `kcAdminClient.users.addCredential({ id: actor.userId, type: 'otp', secretData: JSON.stringify({ value: secret }), credentialData: JSON.stringify({ subType: 'totp', period: 30, digits: 6, algorithm: 'HmacSHA256' }), userLabel: 'Authenticator app' })`
     4. Clear required action : `kcAdminClient.users.update({ id: actor.userId }, { requiredActions: [] })`
     5. Generate 8 recovery codes : `crypto.randomBytes(4).toString('hex').toUpperCase()` × 8 (8 chars each, format `XXXX-XXXX` for readability)
     6. Hash chaque code avec bcrypt (cost 10) + persist dans `admin_totp_recovery_codes` table (NEW Story 1.7)
     7. DEL Redis `totp-setup:{userId}` (cleanup post-success)
     8. Publish NATS `identity.admin.totp.configured.v1` audit event
     9. Return `{ recoveryCodes: string[] }` (8 codes en clair — affichés une seule fois)
   - **Réponse 201** :
     ```json
     {
       "method": "POST",
       "code": 201,
       "data": {
         "recoveryCodes": ["XK4F-9PMQ", "T8H2-VR3N", ...]
       },
       "meta": { ... }
     }
     ```
   - **Tests E2E** : valid code → 201 + 8 codes. Invalid code → 422 IDENTITY-VALIDATION-004. Expired secret → 410 IDENTITY-EXPIRED-002. Non-admin → 403. Already configured → 409.

5. **AC5 — gateway-api endpoint `POST /v1/auth/totp/recovery/use` (lost device flow)** : Given `apps/gateway-api/src/infrastructure/http/controllers/auth-totp.controller.ts` (UPDATE), When un admin a perdu son device et utilise un recovery code lors du login :
   - **Flow user-side** : Story 1.4 login flow → Keycloak demande TOTP → user clique "J'ai perdu mon appareil" → Keycloak page propose input 8-char recovery code (Keycloak natif via `Recovery Authentication Code` Required Action Story 1.1) — **NB IMPORTANT** : Keycloak gère NATIVEMENT les recovery codes via le Required Action `CONFIGURE_RECOVERY_AUTHN_CODES` qu'on a configuré Story 1.1 AC3. **Décision Story 1.7** : on utilise les recovery codes Keycloak natifs (pas notre table `admin_totp_recovery_codes` séparée).
   - **Réécriture AC5** : **Story 1.7 ne crée PAS de endpoint `/recovery/use` séparé** — Keycloak gère le flow recovery code complet via son Required Action `CONFIGURE_RECOVERY_AUTHN_CODES` Story 1.1.
   - **Ce que Story 1.7 fait** : pendant le setup TOTP (AC4 use case), juste après le step `users.addCredential type='otp'`, ajouter un step Keycloak `kcAdminClient.users.addCredential({ id, type: 'recovery-authn-codes', credentialData: JSON.stringify({ ... }) })` qui génère natively les 8 recovery codes côté Keycloak. **Réponse Story 1.7 retourne les 8 codes** retournés par cette call Keycloak (pas générés nous-mêmes).
   - **Clean-up décision Story 1.7** : **PAS de table `admin_totp_recovery_codes`** Story 1.7 (révision de la décision initiale). Keycloak `recovery-authn-codes` credential type natively :
     - Hashes les codes côté Keycloak (PBKDF2 par défaut)
     - Marks single-use
     - Allows lookup + verify + mark used
     - Provide audit via Keycloak events
   - **Avantage** : moins de code custom Tukio, alignement avec Keycloak best practices, sécurité robuste (hashing PBKDF2 par défaut Keycloak ≥ bcrypt cost 10).
   - **Login flow recovery use** : Keycloak login page Story 1.1 themed gère le UI fallback `"Use a recovery code"` après échec TOTP — **Story 1.7 ne touche pas ce flow**, juste configure le Required Action côté Keycloak realm Story 1.1 AC3.
   - **Audit recovery code used** : Phasetwo Webhooks Extension Story 1.1 AC5 capture les events `RECOVERY_AUTHN_CODE_USED` (si Phasetwo le supporte) → publish vers identity-svc → publie NATS `identity.admin.totp.recovery-used.v1` → alerte Slack `#tukio-alerts` (suspect activity — admin device perdu ou compromise)
   - **Tests E2E** : recovery code use happy path = test côté Keycloak natif (Playwright with Keycloak login page interaction)

6. **AC6 — identity-svc 2 use cases + extensions** (AC: #3, #4, #5) :
   - **`InitiateTotpSetupUseCase`** (NEW — `apps/identity-svc/src/usecases/initiate-totp-setup.usecase.ts`) :
     ```ts
     async execute(input: { userId: string; userEmail: string }): Promise<{ secret: string; otpauthUrl: string; qrCodeDataUrl: string }> {
       // 1. Check user has admin role + no existing TOTP
       const userProfile = await this.userProfileRepo.findById(input.userId);
       if (!userProfile || !userProfile.role.startsWith('admin-')) throw new AuthForbiddenException('AUTH-FORBIDDEN-001', 'TOTP setup is admin-only');
       
       const existingCredentials = await this.keycloakAdmin.listUserCredentials({ keycloakUserId: userProfile.keycloakUserId });
       if (existingCredentials.some(c => c.type === 'otp')) throw new IdentityConflictException('IDENTITY-CONFLICT-004', 'TOTP already configured');

       // 2. Generate secret + QR
       const secret = otplib.authenticator.generateSecret(20); // 20 bytes → 32 chars base32 (RFC 6238)
       const otpauthUrl = otplib.authenticator.keyuri(input.userEmail, 'Tukio', secret);
       const qrCodeDataUrl = await qrcode.toDataURL(otpauthUrl, { width: 240, margin: 2, errorCorrectionLevel: 'M' });

       // 3. Persist secret in Redis (10 min TTL)
       await this.redisCache.set(`totp-setup:${userProfile.keycloakUserId}`, secret, 600);

       return { secret, otpauthUrl, qrCodeDataUrl };
     }
     ```
   - **`VerifyTotpSetupUseCase`** (NEW) :
     ```ts
     async execute(input: { userId: string; code: string }): Promise<{ recoveryCodes: string[] }> {
       const userProfile = await this.userProfileRepo.findById(input.userId);
       if (!userProfile || !userProfile.role.startsWith('admin-')) throw new AuthForbiddenException('AUTH-FORBIDDEN-001');

       // 1. Read secret from Redis
       const secret = await this.redisCache.get(`totp-setup:${userProfile.keycloakUserId}`);
       if (!secret) throw new IdentityExpiredException('IDENTITY-EXPIRED-002', 'Setup expired, restart');

       // 2. Verify code
       const valid = otplib.authenticator.verify({ token: input.code, secret });
       if (!valid) throw new IdentityValidationException('IDENTITY-VALIDATION-004', 'Invalid code');

       // 3. Persist OTP credential to Keycloak
       await this.keycloakAdmin.addOtpCredential({
         keycloakUserId: userProfile.keycloakUserId,
         secret,
         period: 30,
         digits: 6,
         algorithm: 'HmacSHA256',
       });

       // 4. Generate recovery codes via Keycloak native
       const recoveryCodes = await this.keycloakAdmin.generateRecoveryAuthnCodes({ keycloakUserId: userProfile.keycloakUserId, count: 8 });

       // 5. Clear required actions
       await this.keycloakAdmin.updateUser({ keycloakUserId: userProfile.keycloakUserId, updates: { requiredActions: [] } });

       // 6. Cleanup Redis + publish event
       await this.redisCache.del(`totp-setup:${userProfile.keycloakUserId}`);
       await this.eventPublisher.publish({
         eventType: 'identity.admin.totp.configured',
         eventVersion: 'v1',
         aggregate: { type: 'UserProfile', id: userProfile.id },
         actor: { userId: userProfile.id, role: userProfile.role },
         payload: { adminUserId: userProfile.id, role: userProfile.role, configuredAt: new Date().toISOString() },
       });

       return { recoveryCodes };
     }
     ```
   - **Update `IKeycloakAdmin` port** : ajouter `listUserCredentials`, `addOtpCredential`, `generateRecoveryAuthnCodes` méthodes
   - **NEW port `ICacheService`** (`apps/identity-svc/src/domain/ports/cache.port.ts`) : interface abstraction Redis (méthodes `get`, `set`, `del`, `expire`) — implémenté côté infrastructure via `ioredis` (Story 1.4 already installed) wrapping Upstash Redis
   - **Tests unit** : 8+ cases per use case (admin role check, no existing TOTP, secret generation, Redis storage, Keycloak persist, recovery codes, error paths)

7. **AC7 — identity-svc infrastructure : Keycloak Admin API extensions + Redis cache adapter** (AC: #6) :
   - **Update `keycloak-admin.service.ts`** (Story 1.2) : ajouter 3 méthodes :
     - `listUserCredentials({ keycloakUserId })` : `kcAdminClient.users.getCredentials({ id })` — retourne array of credentials avec types
     - `addOtpCredential({ keycloakUserId, secret, period, digits, algorithm })` : `kcAdminClient.users.addCredential({ id, type: 'otp', secretData: JSON.stringify({ value: secret }), credentialData: JSON.stringify({ subType: 'totp', period, digits, algorithm }), userLabel: 'Authenticator app', temporary: false })`
     - `generateRecoveryAuthnCodes({ keycloakUserId, count })` : appelle Keycloak Admin API endpoint `/admin/realms/tukio/users/{id}/credentials` avec `type: 'recovery-authn-codes'` (Keycloak génère natively + retourne en clair les codes once). **NB recherche** : vérifier que cette feature est exposée via `@keycloak/keycloak-admin-client` SDK ou nécessite raw HTTP (pas exposed dans v25/26 client docs — fallback raw axios call si nécessaire)
   - **NEW `apps/identity-svc/src/infrastructure/cache/redis-cache.service.ts`** : adapter `ICacheService` utilisant `ioredis` connecté à Upstash Redis (env vars Story 1.4 `REDIS_URL` réutilisées)
   - **Symbol token `CACHE_SERVICE`** dans `domain/ports/tokens.ts`
   - **Tests integration** : Redis testcontainer + Keycloak testcontainer + tester end-to-end secret save → verify → persist credential

8. **AC8 — identity-svc controller `POST /internal/admin-totp/{setup,verify}` + endpoint `POST /internal/admins`** (AC: #1, #6) :
   - **Créer `apps/identity-svc/src/infrastructure/http/controllers/admin-totp.controller.ts`** (NEW) avec 2 endpoints `/internal/admin-totp/setup` + `/internal/admin-totp/verify` protégés par `InternalServiceGuard` Story 1.2
   - **Créer `apps/identity-svc/src/infrastructure/http/controllers/admin.controller.ts`** (NEW) avec endpoint `POST /internal/admins` (utilisé par `create-admin.ts` script AC1) — body `{ keycloakUserId, email, firstName, lastName, role, locale }` → crée UserProfile aggregate via factory `UserProfile.create({ ...args, role: 'admin-*', emailVerified: true, tukioStatus: 'active' })` + persist + publish `identity.admin.created.v1` event
   - **Update `usecases-proxy.module.ts`** : ajouter proxies (INITIATE_TOTP, VERIFY_TOTP, CREATE_ADMIN)
   - **Tests E2E** : 6+ cases controller TOTP + 4+ cases controller Admin

9. **AC9 — Tests Playwright e2e flow FR/EN + axe-core (NFR48 + accessibility)** : Given `apps/admin/e2e/auth/totp-setup.spec.ts` (NEW), When je lance `pnpm --filter=apps/admin test:e2e --grep "totp"`, Then 8 tests :
   - **Test 1 (happy path FR)** : pré-créer Admin via `admin:create` script (test fixture) → login (Story 1.4 flow) → Keycloak detect requiredAction CONFIGURE_TOTP → redirect `apps/admin/fr/auth/totp-setup` → vérifier QR code rendered + 6-digit input + fallback manual secret display → simuler scan : extract secret via `otpauthUrl` parse OR direct Redis query (testcontainer) → générer code TOTP via `otplib.authenticator.generate(secret)` (test helper) → entrer code via `<TotpCodeInput>` (auto-advance) → submit → vérifier 8 recovery codes affichés + checkbox "J'ai sauvegardé" → check + click "Continuer vers le dashboard" → vérifier redirect `apps/admin/fr/admin/dashboard`
   - **Test 2 (happy path EN)** : idem en `/en/auth/totp-setup` → UI EN
   - **Test 3 (paste code)** : entrer 6-digit code via paste (clipboard simulation) → vérifier auto-distribute sur 6 inputs + auto-submit
   - **Test 4 (invalid code)** : entrer wrong code → vérifier message inline `"Code incorrect, vérifiez votre application"` + reset input + focus first sub-input
   - **Test 5 (expired secret)** : `await page.waitForTimeout(11 * 60 * 1000)` (test long — skip in PR CI, run nightly only) → essayer de submit code → vérifier 410 + message `"Setup expiré, recommencez"` + CTA "Recommencer"
   - **Test 6 (refresh secret)** : clic "Générer un nouveau QR code" → vérifier `POST /v1/auth/totp/setup?refresh=true` appelé + nouveau QR rendered + ancien secret invalidé
   - **Test 7 (middleware bypass attempt)** : simuler request manuelle `admin.tukio.one/admin/dashboard` avec JWT sans `amr.totp` claim → vérifier middleware redirect `/auth/totp-setup`
   - **Test 8 (post-recovery use re-setup forced)** : utiliser un recovery code via Keycloak login page → vérifier login OK → naviguer dashboard → vérifier middleware re-redirect `/auth/totp-setup` (Keycloak `requiredActions: ['CONFIGURE_TOTP']` re-set après recovery use natively)
   - **Test axe-core** : sur la page totp-setup (4 phases A-D) — 0 violations critical/serious — focus management entre 6-digit inputs validé
   - **Test perf** : ≤ 2s p90 entre redirect setup page et QR code rendered (`POST /setup` + `qrcode.toDataURL` server-side)
   - **Coverage** : ≥ 80 % gateway-api endpoints, ≥ 90 % identity-svc 2 use cases, ≥ 80 % frontend wizard

10. **AC10 — Documentation runbook + observability + email template `admin-onboarding`** (AC: all) :
    - **`docs/runbook/admin-totp-debug.md`** (NEW ~80 lignes) : flow end-to-end + troubleshooting (QR code ne scan pas, code invalide horloge drift, Keycloak addCredential fail, recovery code lost, lockout admin sans TOTP setup, role check fail)
    - **`docs/runbook/admin-creation.md`** (NEW ~50 lignes) : usage `pnpm admin:create` CLI, workflow temp password rotation, security best practices (don't share email + password in same channel — V1 magic-link improvement)
    - **`docs/runbook/admin-totp-recovery.md`** (NEW ~40 lignes) : recovery codes Keycloak natif + Phasetwo audit webhook bridge alerte Slack on use, force re-setup post-recovery, V1 admin lockout flow (Epic 6 admin-super peut reset autre admin TOTP)
    - **Email template contract `admin-onboarding.{fr,en}.tsx`** (Story 5.4) :
      - Subject FR : `"Bienvenue sur Tukio Admin - Configuration de votre compte"` / EN : `"Welcome to Tukio Admin - Account setup"`
      - Body : greeting + role + email + temp password + CTA login URL + small print sécurité (changer password + setup TOTP obligatoire)
    - **Métriques Prometheus** : `tukio_admin_totp_setup_attempts_total{result=success|invalid_code|expired|already_configured}`, `tukio_admin_totp_setup_duration_seconds`, `tukio_admin_totp_recovery_codes_used_total{role}`, `tukio_admin_creations_total{role}` (compteur create-admin script)
    - **Dashboard Grafana** (`infra/k8s/grafana-dashboards/admin-totp.json`) : 5 panels (TOTP setup funnel + success rate, recovery code usage rate, admin creation rate, JWT refresh post-setup latency, Slack alerts count)
    - **Slack alerts** :
      - On `identity.admin.totp.recovery-used.v1` event → Slack message `#tukio-alerts` `"⚠️ Admin recovery code used: {role} {email} from IP {ip} at {timestamp}"`
      - On `identity.admin.created.v1` → Slack notif `#tukio-admin-audit` `"✅ New admin created: {email} ({role})"`

## Tasks / Subtasks

- [ ] **Task 1 — `infra/scripts/create-admin.ts` CLI script + `pnpm admin:create` alias + endpoint `POST /internal/admins`** (AC: #1)
  - [ ] 1.1 — Créer `infra/scripts/create-admin.ts` avec args parsing + Keycloak Admin API + identity-svc HTTP call
  - [ ] 1.2 — Créer endpoint identity-svc `POST /internal/admins` (Task 8.2)
  - [ ] 1.3 — Add `package.json` racine alias `"admin:create"`
  - [ ] 1.4 — Tests CLI dry-run + integration testcontainer

- [ ] **Task 2 — `@tukio/contracts` extensions** (AC: #4, #6, #10)
  - [ ] 2.1 — Créer `packages/contracts/src/dtos/identity/totp.dto.ts` (TotpVerifyInputSchema + TotpSetupResponseSchema + TotpVerifyResponseSchema)
  - [ ] 2.2 — Créer events `identity/admin-totp-configured.v1.{schema.json,ts}` + `admin-created.v1.{schema.json,ts}`
  - [ ] 2.3 — Update `types/error-codes.ts` : ajouter `IDENTITY-CONFLICT-004` (TOTP already configured), `IDENTITY-EXPIRED-002` (TOTP setup expired), `IDENTITY-VALIDATION-004` (invalid TOTP code)
  - [ ] 2.4 — Update `types/email-templates.ts` : ajouter `'admin-onboarding'`
  - [ ] 2.5 — Build + test

- [ ] **Task 3 — identity-svc : domain extensions + use cases + tests** (AC: #6)
  - [ ] 3.1 — Créer `domain/ports/cache.port.ts` (ICacheService interface + Symbol CACHE_SERVICE)
  - [ ] 3.2 — Update `domain/ports/keycloak-admin.port.ts` : ajouter `listUserCredentials`, `addOtpCredential`, `generateRecoveryAuthnCodes`
  - [ ] 3.3 — Créer `usecases/initiate-totp-setup.usecase.ts` + spec
  - [ ] 3.4 — Créer `usecases/verify-totp-setup.usecase.ts` + spec
  - [ ] 3.5 — Créer `usecases/create-admin.usecase.ts` + spec (NEW — backing endpoint Task 1)
  - [ ] 3.6 — Tests unit ≥ 90 % coverage

- [ ] **Task 4 — identity-svc : infrastructure (Keycloak extensions + Redis cache adapter + DTOs)** (AC: #7)
  - [ ] 4.1 — Installer `otplib` + `qrcode` + `ioredis` (latest stable) — `pnpm --filter=identity-svc add otplib qrcode ioredis`
  - [ ] 4.2 — Update `infrastructure/external/keycloak/keycloak-admin.service.ts` : ajouter 3 méthodes (listUserCredentials, addOtpCredential, generateRecoveryAuthnCodes)
  - [ ] 4.3 — Créer `infrastructure/cache/redis-cache.service.ts` (implements ICacheService, wraps ioredis, connect Upstash via REDIS_URL Story 1.4)
  - [ ] 4.4 — Créer `infrastructure/cache/cache.module.ts` (NestJS DynamicModule)
  - [ ] 4.5 — Update `app.module.ts` : import `CacheModule.forRoot({ url: REDIS_URL })`
  - [ ] 4.6 — Update `.env.example` : `REDIS_URL` (déjà Story 1.4 — vérifier reuse) + nouveau `TOTP_ISSUER=Tukio`
  - [ ] 4.7 — Tests integration testcontainers Keycloak + Redis

- [ ] **Task 5 — identity-svc : controllers `admin-totp.controller.ts` + `admin.controller.ts`** (AC: #8)
  - [ ] 5.1 — Créer `infrastructure/http/controllers/admin-totp.controller.ts` (2 endpoints internal)
  - [ ] 5.2 — Créer `infrastructure/http/controllers/admin.controller.ts` (1 endpoint internal `POST /internal/admins`)
  - [ ] 5.3 — DTOs Zod pipes
  - [ ] 5.4 — Update `usecases-proxy.module.ts` : 3 proxies (initiateTotp, verifyTotp, createAdmin)
  - [ ] 5.5 — Update `http.module.ts`
  - [ ] 5.6 — Tests E2E

- [ ] **Task 6 — gateway-api : 2 endpoints `/v1/auth/totp/{setup,verify}` + forwarder** (AC: #3, #4)
  - [ ] 6.1 — Créer `apps/gateway-api/src/usecases/auth/totp.forwarder.ts` (2 méthodes)
  - [ ] 6.2 — Update `domain/ports/identity-svc.port.ts` + `identity-svc.client.ts` : ajouter méthodes setup/verify TOTP
  - [ ] 6.3 — Créer `infrastructure/http/controllers/auth-totp.controller.ts` (2 endpoints @UseGuards admin)
  - [ ] 6.4 — Throttler config : `'totp-setup'` 5/min/IP, `'totp-verify'` 10/min/IP (anti-bruteforce TOTP code)
  - [ ] 6.5 — Update `app.module.ts`
  - [ ] 6.6 — Tests E2E (8+ cases AC3+4)

- [ ] **Task 7 — Frontend `apps/admin` : page totp-setup + atomics** (AC: #2)
  - [ ] 7.1 — Créer `packages/api-client/src/hooks/identity/use-totp-setup.ts` (2 mutations setup + verify)
  - [ ] 7.2 — Créer `packages/ui/src/components/TotpCodeInput/` (NEW atomic — 6 sub-inputs auto-advance + paste support — pattern réutilisable)
  - [ ] 7.3 — Créer `apps/admin/src/app/[locale]/auth/totp-setup/page.tsx` (Server Component layout)
  - [ ] 7.4 — Créer `apps/admin/src/features/auth/totp-setup/components/TotpSetupWizard.tsx` (Client Component state machine 4 phases)
  - [ ] 7.5 — Créer `apps/admin/src/features/auth/totp-setup/components/{QrCodeView,RecoveryCodesView}.tsx`
  - [ ] 7.6 — Update `apps/admin/messages/{fr,en}.json` : namespace `admin.auth.totpSetup.*` (~25 keys)
  - [ ] 7.7 — Force-refresh JWT post-success (réutilise pattern Story 1.6 `force-refresh.ts`)

- [ ] **Task 8 — Apps admin middleware enforcement strict** (AC: all middleware)
  - [ ] 8.1 — Update `apps/admin/src/middleware.ts` (Story 1.4) : strict — tout admin sans `amr.includes('totp')` redirect `/auth/totp-setup` (zéro bypass) + check `requiredActions` (si CONFIGURE_TOTP, redirect setup)
  - [ ] 8.2 — Tests E2E middleware bypass attempt → redirect

- [ ] **Task 9 — Tests Playwright e2e flow FR/EN + axe-core + perf** (AC: #9)
  - [ ] 9.1 — Créer `apps/admin/e2e/auth/totp-setup.spec.ts` avec 8 tests (cf. AC9)
  - [ ] 9.2 — Helper `apps/admin/e2e/helpers/setup-test-admin.ts` : utilise `create-admin.ts` script (Task 1) en mode test fixture
  - [ ] 9.3 — Helper `apps/admin/e2e/helpers/generate-totp-code.ts` : `otplib.authenticator.generate(secret)` pour test
  - [ ] 9.4 — Helper `apps/admin/e2e/helpers/extract-secret-from-redis.ts` : query Redis testcontainer
  - [ ] 9.5 — Run Playwright en CI : `pnpm --filter=apps/admin test:e2e --grep "totp"`
  - [ ] 9.6 — Vérifier 0 axe-core violations
  - [ ] 9.7 — Vérifier perf NFR48 ≤ 2s p90

- [ ] **Task 10 — Observability + runbooks + Slack alerts + commit** (AC: #10)
  - [ ] 10.1 — Ajouter métriques Prom gateway-api + identity-svc (5 counters/histograms)
  - [ ] 10.2 — Créer `infra/k8s/grafana-dashboards/admin-totp.json` (5 panels)
  - [ ] 10.3 — Créer 3 runbooks `docs/runbook/admin-{totp-debug,creation,totp-recovery}.md`
  - [ ] 10.4 — Update `packages/contracts/README.md` : section Identity events + email templates `admin-onboarding`
  - [ ] 10.5 — Setup Slack webhook alerts (Story 0.12 alertmanager) sur 2 events (recovery-used + admin-created)
  - [ ] 10.6 — Lint + typecheck + tests
  - [ ] 10.7 — Vérifier coverage thresholds
  - [ ] 10.8 — Commit `feat(auth): admin 2FA TOTP setup obligatoire (CLI create-admin script + 2 frontend pages + 3 endpoints + Keycloak OTP credential + native recovery codes + Phasetwo audit + Slack alerts + Playwright e2e FR/EN)` — Story 1.7 done

## Dev Notes

### Pourquoi Story 1.7 = closing du flow auth admin

> **Sources** : `_bmad-output/planning-artifacts/architecture.md` §Auth + §RBAC (lignes 234-241, 693-697) + NFR12 ; `_bmad-output/planning-artifacts/prd.md` §FR9 (Admin TOTP obligatoire) + NFR12 ; `_bmad-output/planning-artifacts/epics.md` §Story 1.7 (lignes 1178-1191) ; Stories 1.1 (Keycloak realm + flow MFA admin), 1.2 (KeycloakAdminService), 1.4 (login flow + middleware admin redirect TOTP setup).

Stories 1.1 + 1.4 ont préparé les bases :
- Story 1.1 a configuré Keycloak realm avec flow `tukio-admin-mfa-required` qui force TOTP step + Required Action `CONFIGURE_TOTP` + Required Action `CONFIGURE_RECOVERY_AUTHN_CODES`
- Story 1.4 redirect admins sans `amr.totp` claim vers `/auth/totp-setup`

**Story 1.7 implémente** :
- Le **CLI script `create-admin.ts`** (seul moyen MVP de bootstrap admins, V1+ Epic 6 ajoute UI)
- La **page `apps/admin/[locale]/auth/totp-setup`** réelle (Story 1.4 placeholder remplacé)
- Les **2 endpoints gateway-api** (setup + verify TOTP)
- L'**utilisation des recovery codes Keycloak natifs** (pas de table custom Tukio — décision révisée AC5)
- L'**audit Slack alerts** sur events sensibles (admin créé + recovery code utilisé)

**Story 1.7 = pattern réutilisable Story 1.10 V1** (Pro 2FA optionnel FR10 — même flow setup + verify, mais opt-in user-initiated au lieu de forced).

### Décisions techniques majeures actées

1. **`otplib`** côté backend (Node.js library RFC 6238 mainstream, type-safe). Permet generate secret + verify code. Algorithme SHA-256 (vs default SHA-1) — Keycloak supporte SHA-256, plus sécurisé.
2. **`qrcode`** côté backend (server-side data URL PNG). Avantage : QR code généré côté serveur, le frontend juste rend l'`<img>`. Pas besoin de lib QR côté frontend (`react-qr-code` etc.) — simpler.
3. **Redis Upstash** pour stockage temp du secret (TTL 10 min). Réutilise Story 1.4 setup throttler. Avantage : (a) éphémère, (b) pas besoin de table DB pour state transient, (c) auto-cleanup.
4. **Recovery codes via Keycloak natif** (pas table custom Tukio) — décision révisée AC5. Avantage : (a) Keycloak hash natif PBKDF2, (b) Required Action `CONFIGURE_RECOVERY_AUTHN_CODES` Story 1.1 déjà configuré, (c) less custom code Tukio. Le `keycloak-admin-client` v25/26 expose `/admin/realms/{realm}/users/{id}/credentials` avec `type: 'recovery-authn-codes'` — vérifier compat exacte au moment du dev.
5. **Custom Tukio TOTP setup page** (vs Keycloak themed page native) — UX cohérente avec apps/admin Tukio, brand consistent. Trade-off : on duplique légèrement la fonctionnalité Keycloak account console. Justifié pour l'admin app séparée.
6. **6-digit input atomic réutilisable** (`<TotpCodeInput>` Story 0.4 ou créé Story 1.7) — auto-advance focus, paste support, arrow keys, accessible. Réutilisable Story 1.10 V1 Pro 2FA, V2 SMS OTP autres flows.
7. **Throttle anti-bruteforce TOTP** : 10/min/IP sur `/verify` (TOTP a 1M combinaisons possibles avec window 1 = ~1k tentatives/h pour tester toutes — rate-limit empêche). Keycloak natively limite aussi (brute-force protection Story 1.1) — defence in depth.
8. **Slack alerts on recovery-used + admin-created** — security-critical events (recovery use peut signaler compromise account, admin creation doit être tracé).
9. **CLI script `create-admin.ts`** (vs UI admin) — MVP simplification. V1 Epic 6 ajoute UI Admin Super invite (avec email magic-link au lieu de temp password).
10. **EN strict + i18n strict + memories** réutilisés.

### Versions à utiliser

| Lib | Rôle | Version cible |
|---|---|---|
| **`otplib`** | TOTP RFC 6238 | latest stable (12.x) |
| **`qrcode`** | QR code data URL generation | latest stable (1.5.x) |
| **`ioredis`** | Redis client (cache Redis Upstash) | latest stable (Story 1.4 already installed) |
| **`@keycloak/keycloak-admin-client`** | Story 1.2 already installed | latest stable |
| **`@nestjs/throttler`** | Story 1.2 | latest |
| **`bcrypt`** | NOT NEEDED Story 1.7 (recovery codes Keycloak natif gère hash) | — |

### Project Structure cible

```
infra/scripts/create-admin.ts                         # NEW Story 1.7

packages/contracts/src/
├─ dtos/identity/totp.dto.ts                          # NEW Story 1.7
├─ events/identity/{admin-totp-configured,admin-created}.v1.{schema.json,ts}  # NEW (4)
└─ types/{error-codes,email-templates}.ts             # UPDATE — 3 codes + 1 template

packages/ui/src/components/TotpCodeInput/             # NEW atomic — 6-digit input réutilisable
├─ TotpCodeInput.tsx + spec
└─ index.ts

apps/identity-svc/src/
├─ domain/
│  ├─ ports/cache.port.ts                             # NEW Story 1.7
│  ├─ ports/keycloak-admin.port.ts                    # UPDATE — 3 méthodes
│  └─ ports/tokens.ts                                 # UPDATE — CACHE_SERVICE Symbol
├─ usecases/
│  ├─ initiate-totp-setup.usecase.ts                  # NEW + spec
│  ├─ verify-totp-setup.usecase.ts                    # NEW + spec
│  └─ create-admin.usecase.ts                         # NEW + spec
└─ infrastructure/
   ├─ external/keycloak/keycloak-admin.service.ts     # UPDATE — 3 méthodes
   ├─ cache/{redis-cache.service.ts,cache.module.ts}  # NEW (2)
   └─ http/controllers/{admin-totp,admin}.controller.ts  # NEW (2)

apps/identity-svc/test/admin-totp.e2e-spec.ts         # NEW

apps/gateway-api/src/
├─ usecases/auth/totp.forwarder.ts                    # NEW
├─ infrastructure/external/identity-svc/identity-svc.client.ts  # UPDATE — 2 méthodes
└─ infrastructure/http/controllers/auth-totp.controller.ts      # NEW (2 endpoints)

apps/gateway-api/test/auth/auth-totp.e2e-spec.ts      # NEW

apps/admin/src/
├─ middleware.ts                                      # UPDATE Story 1.4 — strict TOTP enforcement
├─ app/[locale]/auth/totp-setup/page.tsx              # NEW Story 1.7 (Story 1.4 placeholder remplacé)
├─ features/auth/totp-setup/components/
│  ├─ TotpSetupWizard.tsx                             # NEW Client Component
│  ├─ QrCodeView.tsx                                  # NEW
│  └─ RecoveryCodesView.tsx                           # NEW
└─ messages/{fr,en}.json                              # UPDATE — namespace admin.auth.totpSetup.*

apps/admin/e2e/auth/totp-setup.spec.ts                # NEW (8 tests)
apps/admin/e2e/helpers/{setup-test-admin,generate-totp-code,extract-secret-from-redis}.ts  # NEW (3)

packages/api-client/src/hooks/identity/use-totp-setup.ts  # NEW

infra/k8s/grafana-dashboards/admin-totp.json          # NEW

docs/runbook/admin-{totp-debug,creation,totp-recovery}.md  # NEW (3)

# Estimation total fichiers : ~50 nouveaux + ~10 updates = ~60 fichiers
```

### Critical Architecture Constraints

> Cf. Stories 1.1 + 1.2 + 1.4 + memories.

1. **Pretre + Symbol DI tokens + Envelope ADR-014 + Outbox** (réutilisés)
2. **Anti-énumération NFR9** : pas applicable Story 1.7 (admin role auth required, pas de path public)
3. **Rate-limit anti-bruteforce TOTP** : 10/min/IP verify
4. **HTTPS exclusif** : secret + code transitent via TLS uniquement
5. **EN strict** + **i18n strict** memories
6. **Recovery codes Keycloak natif** (pas custom Tukio) — déjà configured Story 1.1 AC3 Required Action
7. **Strict middleware admin** : zéro bypass TOTP
8. **Audit Slack alerts** sur events security-critical

### Previous Story Intelligence

**Story 1.1** : 🔴 **dépendance critique** — flow `tukio-admin-mfa-required` configuré + Required Actions `CONFIGURE_TOTP` + `CONFIGURE_RECOVERY_AUTHN_CODES` + claim `amr` mapper. Story 1.7 utilise tous ces hooks.

**Story 1.2** : KeycloakAdminService (extends 3 méthodes Story 1.7) + EnvironmentConfigService (extends env vars) + EnvelopeExceptionFilter.

**Story 1.4** : login flow + middleware admin (UPDATE Story 1.7 strict enforcement) + force-refresh JWT pattern (réutilisé Story 1.7 post-setup).

**Story 1.6** : `force-refresh.ts` utility post-action (réutilisé post-TOTP setup pour propager `amr.totp` claim).

**Stories 0.4** : atomics — Story 1.7 ajoute `<TotpCodeInput>` (NEW atomic réutilisable).

### What this story does NOT do (out of scope)

- ❌ **UI Admin Super invite (email magic-link)** → V1 Epic 6 (Story 1.7 utilise CLI script + temp password en email — security trade-off MVP)
- ❌ **Pro 2FA TOTP optionnel** → V1 FR10 Story 1.10 (pattern Story 1.7 réutilisable)
- ❌ **SMS OTP fallback** → out of scope MVP (TOTP only)
- ❌ **WebAuthn / passkey support** → V2+ (Keycloak supporte natively, pas de scope MVP)
- ❌ **Admin lockout reset par autre admin** → V1 Epic 6 (Admin Super peut reset autre admin TOTP)
- ❌ **Notifications in-app post-recovery use** → V1 Epic 11 (MVP : email + Slack alert seulement)

### Files to UPDATE vs CREATE

(cf. Project Structure cible)

### Testing Standards

- **Coverage** : ≥ 90 % use cases, ≥ 80 % endpoints, ≥ 80 % frontend, ≥ 80 % CLI script
- **Tests unit** Vitest + mocks (3 use cases × 8+ cases)
- **Tests integration** Postgres + Redis + Keycloak testcontainers
- **Tests E2E** Playwright FR + EN + axe-core (8 cases AC9)
- **Performance** : NFR48 ≤ 2s p90

### Project Structure Notes

✅ Aligné avec Architecture, PRD §FR9 + NFR9-13, Stories 1.1/1.2/1.4/1.6, memories.

⚠️ **Décision documentée** : recovery codes Keycloak natif (pas table custom) — cf. AC5 + Décisions §4.

⚠️ **Décision documentée** : custom Tukio TOTP setup page (pas Keycloak themed) — UX cohérente apps/admin (cf. Décisions §5).

⚠️ **À noter** : `keycloak-admin-client` SDK v25/26 peut ne pas exposer `recovery-authn-codes` credential type natively — fallback raw axios call à `${KEYCLOAK_URL}/admin/realms/tukio/users/{id}/credentials` (vérifier au moment du dev).

⚠️ **À noter** : security trade-off MVP — `create-admin.ts` envoie temp password en clair dans email. V1 Epic 6 améliore avec magic-link 1-click setup (token-based, similar Story 1.5/1.6 pattern).

### References

- [Source: epics.md#Epic-1-Story-1.7 — Lines 1178-1191]
- [Source: prd.md#FR9 — Admin TOTP obligatoire]
- [Source: prd.md#NFR9-13]
- [Source: 1-1-provision-keycloak-realm-tukio-roles-clients-phasetwo.md — flow tukio-admin-mfa-required + Required Actions CONFIGURE_TOTP + CONFIGURE_RECOVERY_AUTHN_CODES]
- [Source: 1-2-customer-b2c-registration.md — KeycloakAdminService (Story 1.7 extends)]
- [Source: 1-4-login-flow-keycloak-authorization-code-pkce.md — middleware admin redirect TOTP setup + force-refresh JWT]
- [Source: 1-6-email-verification-flow-landing-page.md — force-refresh.ts utility réutilisé]
- [External: https://datatracker.ietf.org/doc/html/rfc6238 — TOTP RFC 6238]
- [External: https://github.com/yeojz/otplib — otplib library]
- [External: https://github.com/soldair/node-qrcode — qrcode library]
- [External: https://www.keycloak.org/docs/26.0/server_admin/#user-credentials — Keycloak user credentials API]
- [External: https://www.keycloak.org/docs/26.0/server_admin/#recovery-authentication-codes — Keycloak recovery codes natif]
- [Memory: feedback_clean_architecture_explicit.md, feedback_api_envelope_response.md, feedback_tech_layer_english.md, feedback_i18n_frontend.md, feedback_latest_versions.md]

## Dev Agent Record

### Agent Model Used

(à remplir)

### Debug Log References

(à remplir — vérification `keycloak-admin-client` v25/26 expose recovery-authn-codes endpoint OR fallback raw axios, validation `otplib.authenticator.verify` window 1 tolerance horloge drift, validation Redis key collision si user re-trigger setup, drift R8 si Keycloak addCredential OK + Redis cleanup fail — non-fatal MVP, recovery codes affichage UX validé non scrollable mobile)

### Completion Notes List

(à remplir — points d'attention pour Story 1.10 (Pro 2FA optionnel V1 réutilise pattern), Epic 6 (Admin Super invite UI V1), Story 5.4 (notification-svc Resend templates `admin-onboarding`))

### File List

(à remplir)

---

## Story Completion Status

- **Story Status** : `ready-for-dev`
- **Created** : 2026-05-09
- **Created by** : `bmad-create-story` workflow
- **Epic** : Epic 1 — Identity & Authentication Backbone (MVP)
- **Sprint cible** : Sprint 2 (semaine 6, 7ᵉ story Epic 1)
- **Estimation effort** : 4-6 jours (1 dev fullstack senior — story moyenne complexité, otplib + qrcode + Redis + Keycloak credential API + 6-digit atomic + middleware enforcement, ~60 fichiers)
- **Dépendances upstream** :
  - **Stories 0.2, 0.4, 0.6, 0.7, 0.10** (envelope, atomics, Pretre, NATS, Docker)
  - **Story 1.1** (🔴 flow tukio-admin-mfa-required + Required Actions Keycloak)
  - **Story 1.2** (KeycloakAdminService extends)
  - **Story 1.4** (middleware admin redirect TOTP + force-refresh)
  - **Story 1.6** (force-refresh utility)
- **Dépendances downstream** :
  - **Story 1.10** (consolidation + reconciliation) — consume `identity.admin.totp.configured.v1` event
  - **Stories Epic 6** (Admin moderation console) — toutes les pages admin requièrent MFA enforced Story 1.7
  - **Story 1.10 V1** (Pro 2FA optionnel FR10) — réutilise pattern Story 1.7
  - **Story 5.4** (notification-svc Resend) — consume template `admin-onboarding`
  - **Story 2.7** (audit) — consume events `identity.admin.{created,totp.configured,totp.recovery-used}.v1`
- **FRs covered** :
  - **FR9** ✅ Admin 2FA TOTP obligatoire à création
- **NFRs touchés** :
  - **NFR9** ✅ HTTPS + rate-limit + admin role check strict
  - **NFR10** ✅ Rate-limit 10/min/IP TOTP verify (anti-bruteforce)
  - **NFR12** ✅ MFA TOTP admin obligatoire
  - **NFR48** ✅ UX ≤ 2s p90
  - **NFR71** ✅ Coverage thresholds

> **Prochaine story (auto-discover via `bmad-create-story`) → Story 1.8** (Profile management `GET /v1/me` + `PATCH /v1/me`)

---

**Dev agent next steps :**
1. Lire ce file en entier
2. Vérifier upstream Stories 1.1, 1.2, 1.4, 1.6 implémentées (templates clés)
3. Implémenter Tasks 1-10
4. Lancer après chaque jalon : `pnpm lint && pnpm typecheck && pnpm test --filter=...[origin/main] && pnpm playwright test --grep "totp"`
5. Commit Story 1.7 quand : 8/8 e2e tests passent + coverage ≥ thresholds + axe-core 0 violations + perf NFR48 OK + Slack webhook tested
6. Update sprint-status : `1-7-admin-2fa-totp-obligatoire: review` puis `done`
