# Story 1.1: Provision Keycloak realm `tukio` with 5 roles + 4 clients + Phasetwo extension

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

**As a** tech lead (équipe Sprint 0 → Epic 1),
**I want** the **Keycloak 26 (latest stable)** realm `tukio` provisioned end-to-end via the **idempotent script `infra/scripts/bootstrap-keycloak-realm.sh`** that targets **2 environments** (`--env=local` against Docker Compose Story 0.10 / `--env=staging` against the staging Phasetwo instance), with **5 realm-level roles** (`client`, `pro`, `admin-support`, `admin-modo`, `admin-super`) carrying **FR + EN descriptions** in role attributes, **4 OIDC clients** (`tukio-web` public PKCE, `tukio-admin` public PKCE + TOTP enforcement, `tukio-api` confidential service-account, `tukio-mobile` public PKCE deep-link `tukio://`), the **Phasetwo orgs extension** installed (open-source SPI for local, managed SaaS for staging — exposes `/realms/tukio/portal` API reserved V2 enterprise SSO B2B), **Brute-Force Detection** active (5 fails / 5 min → 15 min lock + NATS event `identity.login.error.v1` published via outbox-relay Story 0.7 for audit), **custom Tukio Keycloak themes** (`login` + `email` types) matching `tokens.css` brand palette (terracotta `#C2410C` + Fraunces display + Inter body) bilingual FR/EN selected via `kc_locale` query param, a **custom user claim `tukio:locale`** (default `fr`) emitted in JWT for the 4 OIDC clients, **realm-export JSON** versioned in `infra/keycloak/realm-export/tukio.realm.json` (single source of truth for staging GitOps), and a **smoke test suite** (`infra/scripts/smoke-test-keycloak-realm.sh`) that verifies all 7 epic ACs in CI nightly,
**so that** the auth backbone is live MVP-ready (`@tukio/auth-client` Story 0.8 can effectively redirect to `auth.tukio.one/realms/tukio/protocol/openid-connect/auth` and obtain valid JWTs, `@tukio/auth` Story 0.8 can validate JWT RS256 signatures via the realm's JWKS endpoint, `KeycloakJwtGuard` enforces RBAC via `realm_access.roles`, `@RequireMfa()` Story 0.8 detects admin TOTP via `payload.amr`), Stories 1.2 (B2C register), 1.3 (Pro register `pending_admin_review`), 1.4 (Login PKCE), 1.5 (Password reset), 1.6 (Email verification), 1.7 (Admin TOTP), 1.8 (Profile), 1.9 (Account delete) and **all subsequent epics** consume a stable, reproducible Keycloak surface with deterministic claims and zero post-MVP migration cost when activating Phasetwo orgs B2B Enterprise V2.

> **Outcome attendu** : à la fin de cette story, `pnpm docker:up && infra/scripts/bootstrap-keycloak-realm.sh --env=local` (idempotent) provisionne en **< 30 s** un realm complet ; `curl http://localhost:8080/realms/tukio/.well-known/openid-configuration` retourne le JSON OIDC discovery valide ; un user créé avec rôle `pro` voit son JWT contenir `realm_access.roles: ["pro"]` + `tukio:locale: "fr"` (vérifiable via `https://jwt.io`) ; la page `http://localhost:8080/realms/tukio/account/` rend en branding terracotta + Fraunces FR (et EN avec `?kc_locale=en`) ; 5 tentatives login fail en 5 min lockent le compte 15 min ET publient un événement `identity.login.error.v1` consommable par `notification-svc` audit + `messaging-svc` rate-limit ; `infra/scripts/smoke-test-keycloak-realm.sh --env=local` retourne 0 ; `infra/keycloak/realm-export/tukio.realm.json` est commité (export source-of-truth) ; le même script `--env=staging` joue contre l'instance Phasetwo SaaS managée et provisionne le realm staging (DNS `auth.tukio.one`).

## Acceptance Criteria

1. **AC1 — Realm `tukio` créé idempotemment + 5 rôles avec descriptions FR + EN** : Given Keycloak 26 (latest stable) running (Docker Compose `local` ou Phasetwo SaaS `staging`), When je lance `infra/scripts/bootstrap-keycloak-realm.sh --env=<local|staging>` (avec credentials admin via env vars `KEYCLOAK_ADMIN_USERNAME` + `KEYCLOAK_ADMIN_PASSWORD` ou Doppler `keycloak_admin_*`), Then :
   - Le script vérifie d'abord la disponibilité de Keycloak via `curl -fsS ${KEYCLOAK_URL}/health/ready` (timeout 60 s, retries 12 — sinon exit 1 avec message clair `"keycloak not ready, run 'pnpm docker:up' first or check staging DNS"`)
   - Le realm `tukio` est créé via `kcadm.sh create realms` avec le payload **figé** suivant (JSON file `infra/keycloak/realm-config/realm-base.json` versioned) :
     ```json
     {
       "realm": "tukio",
       "enabled": true,
       "displayName": "Tukio",
       "displayNameHtml": "<strong>Tukio</strong> — Marketplace événementielle",
       "loginTheme": "tukio",
       "accountTheme": "tukio",
       "adminTheme": "keycloak.v2",
       "emailTheme": "tukio",
       "internationalizationEnabled": true,
       "supportedLocales": ["fr", "en"],
       "defaultLocale": "fr",
       "registrationAllowed": true,
       "registrationEmailAsUsername": true,
       "rememberMe": true,
       "verifyEmail": true,
       "loginWithEmailAllowed": true,
       "duplicateEmailsAllowed": false,
       "resetPasswordAllowed": true,
       "editUsernameAllowed": false,
       "bruteForceProtected": true,
       "permanentLockout": false,
       "maxFailureWaitSeconds": 900,
       "minimumQuickLoginWaitSeconds": 60,
       "waitIncrementSeconds": 60,
       "quickLoginCheckMilliSeconds": 1000,
       "maxDeltaTimeSeconds": 43200,
       "failureFactor": 5,
       "passwordPolicy": "length(12) and digits(1) and lowerCase(1) and upperCase(1) and specialChars(1) and notUsername(undefined) and passwordHistory(3)",
       "sslRequired": "external",
       "accessTokenLifespan": 300,
       "accessTokenLifespanForImplicitFlow": 900,
       "ssoSessionIdleTimeout": 1800,
       "ssoSessionMaxLifespan": 36000,
       "offlineSessionIdleTimeout": 2592000,
       "offlineSessionMaxLifespanEnabled": true,
       "offlineSessionMaxLifespan": 5184000,
       "smtpServer": { "host": "<env-overridable>", "port": "<env-overridable>", "from": "no-reply@tukio.one", "fromDisplayName": "Tukio", "ssl": "true", "starttls": "true", "auth": "true", "user": "<env>", "password": "<env>" }
     }
     ```
   - Idempotence : si le realm existe déjà, le script appelle `kcadm.sh update realms/tukio -f realm-base.json` (pas d'erreur, log `"realm tukio already exists, updating config"`)
   - Les **5 rôles** suivants sont créés idempotemment, chacun avec **description i18n** stockée dans les `attributes` (Keycloak ne supporte pas nativement les role descriptions par locale — pattern : `attributes.description.fr` + `attributes.description.en`) :
     | Role name | `description.fr` | `description.en` |
     |---|---|---|
     | `client` | "Client B2C/B2B — peut réserver des prestations" | "B2C/B2B Customer — can book services" |
     | `pro` | "Prestataire — publie des prestations et gère les réservations" | "Service Provider — publishes services and manages bookings" |
     | `admin-support` | "Admin Support — répond aux tickets, lit l'audit trail" | "Support Admin — answers tickets, reads audit trail" |
     | `admin-modo` | "Admin Modération — valide pros, modère contenus, suspend comptes" | "Moderation Admin — validates pros, moderates content, suspends accounts" |
     | `admin-super` | "Admin Super — accès complet plateforme, replay events, impersonation" | "Super Admin — full platform access, replay events, impersonation" |
   - Le script log par étape (✅ realm created/updated, ✅ role `client` created, ...) et termine sur un summary final `"Realm 'tukio' provisioned: 5 roles, 4 clients, brute-force ON, themes wired"`
   - **Cohérence** : ces 5 noms de rôles **doivent strictement matcher** `Role` type `@tukio/auth/types/role.ts` Story 0.8 et `Role` type `@tukio/contracts/types/Actor.ts` Story 0.2 (lint `tukio/role-name-consistency` à venir Story Epic 1+ — flagué dans Debug Log References).

2. **AC2 — 4 OIDC clients configurés (`tukio-web`, `tukio-admin`, `tukio-api`, `tukio-mobile`)** : Given le realm `tukio` provisionné, When je liste les clients via `kcadm.sh get clients -r tukio`, Then je trouve **exactement 4 clients custom** (en plus des clients système Keycloak comme `account`, `admin-cli`, etc.) :
   - **`tukio-web`** (public, OIDC, PKCE S256 obligatoire) — le client utilisé par les **3 frontends multi-zones publics** `apps/{public,customer,seller}/` (Architecture ligne 1995-2118) :
     - `clientId`: `tukio-web`
     - `publicClient`: `true` (PKCE → pas de client secret)
     - `protocol`: `openid-connect`
     - `standardFlowEnabled`: `true` (Authorization Code + PKCE)
     - `directAccessGrantsEnabled`: `false` (pas de Resource Owner Password Credentials — anti-OWASP)
     - `implicitFlowEnabled`: `false` (legacy)
     - `serviceAccountsEnabled`: `false`
     - `redirectUris`:
       - **local** : `["http://localhost:3000/*", "http://localhost:3001/*", "http://localhost:3002/*"]` (public + customer + seller)
       - **staging** : `["https://*.staging.tukio.one/*"]`
       - **production** : `["https://*.tukio.one/*"]` mais **excluant** `https://admin.tukio.one/*` (séparation client admin)
     - `webOrigins`: identique aux `redirectUris` (CORS)
     - `attributes.pkce.code.challenge.method`: `S256`
     - `attributes.access.token.lifespan`: `300` (5 min — NFR12)
     - `attributes.client.session.idle.timeout`: `1800` (30 min)
     - `attributes.use.refresh.tokens`: `true`
     - `attributes.refresh.token.max.reuse`: `0` (rotation stricte — NFR12)
     - `attributes.client_session_max_lifespan`: `36000` (10 h — cohérent NFR13 cookie session)
     - `defaultClientScopes`: `["openid", "profile", "email", "tukio-locale-scope", "roles"]` (cf. AC4)
   - **`tukio-admin`** (public client séparé, sécurité accrue) — utilisé par `apps/admin/` UNIQUEMENT (Architecture ligne 1995-2118) :
     - `clientId`: `tukio-admin`
     - `publicClient`: `true`, `standardFlowEnabled`: `true`, `directAccessGrantsEnabled`: `false`
     - `redirectUris`:
       - **local** : `["http://localhost:3003/*"]`
       - **staging** : `["https://admin.staging.tukio.one/*"]`
       - **production** : `["https://admin.tukio.one/*"]`
     - `webOrigins`: identique
     - `attributes.pkce.code.challenge.method`: `S256`
     - `attributes.access.token.lifespan`: `300` (5 min, idem)
     - **Authentication flow override** : `browserFlow` pointant vers le flow custom `tukio-admin-mfa-required` (cf. AC3) qui force TOTP — implémenté via authenticator binding au client
   - **`tukio-api`** (confidential, service account M2M) — utilisé par `gateway-api` Story Epic 1+ pour token introspection éventuelle et par les services backend pour validation JWT audience :
     - `clientId`: `tukio-api`
     - `publicClient`: `false` (confidential — nécessite secret)
     - `secret`: fourni via env var `KEYCLOAK_CLIENT_SECRET_TUKIO_API` (jamais en clair dans le repo — Doppler en staging/prod, `tukio_api_dev_secret` en local cohérent Story 0.10 ligne 56)
     - `serviceAccountsEnabled`: `true`
     - `standardFlowEnabled`: `false`, `directAccessGrantsEnabled`: `false`
     - `serviceAccountClientRoles`: peut être étendu V1+ pour appels admin API
     - **Audience claim** : `tukio-api` apparaît dans le claim `aud` des JWT émis pour `tukio-web` et `tukio-admin` (mapper `audience-mapper`) → permet à `KeycloakJwtGuard` Story 0.8 de valider `aud === 'tukio-api'`
     - `attributes.access.token.lifespan`: `300` (cohérent)
   - **`tukio-mobile`** (public, PKCE, deep-link V2 prêt) — préparé pour React Native V2 (Story 14.x) :
     - `clientId`: `tukio-mobile`
     - `publicClient`: `true`, `standardFlowEnabled`: `true`, `directAccessGrantsEnabled`: `false`
     - `redirectUris`: `["tukio://callback", "tukio://login-callback"]` (deep-link app native)
     - `webOrigins`: `[]` (pas pertinent pour mobile)
     - `attributes.pkce.code.challenge.method`: `S256`
     - **Status MVP** : `enabled: true` mais **non utilisé MVP** (juste provisionné pour permettre tests V2 sans re-toucher le realm)
   - Idempotence : si un client existe déjà, le script appelle `kcadm.sh update clients/<uuid> -f client-config.json`. Source-of-truth dans `infra/keycloak/realm-config/clients/{tukio-web,tukio-admin,tukio-api,tukio-mobile}.json` (4 fichiers).
   - **Tests smoke** : pour chaque client, vérifier `${KEYCLOAK_URL}/realms/tukio/.well-known/openid-configuration` expose les bons endpoints + `kcadm.sh get clients?clientId=<id>` retourne le client avec `enabled: true`.

3. **AC3 — MFA TOTP enforcé sur le client `tukio-admin` (NFR12 + FR9)** : Given le client `tukio-admin` configuré, When un user avec rôle `admin-*` tente de s'authentifier sur `apps/admin/`, Then le flow Keycloak **force le step TOTP** avant émission du JWT :
   - **Flow Keycloak custom `tukio-admin-mfa-required`** créé via `kcadm.sh create authentication/flows` :
     - Cloné depuis le `browser` flow standard
     - Le subflow "Browser - Conditional OTP" passé en `REQUIRED` (au lieu de `CONDITIONAL`) → forcer OTP pour tout user de ce flow
     - Configuration OTP : `OtpFormAuthenticatorFactory` avec `otpType: "totp"`, `algorithm: "HmacSHA256"`, `digits: 6`, `period: 30`, `lookAheadWindow: 1`, `initialCounter: 0`
     - Required Action `CONFIGURE_TOTP` activé pour tous les users `admin-*` au premier login (Story 1.7 finalize l'enrollment UI)
   - Le flow `tukio-admin-mfa-required` est lié au client `tukio-admin` via `kcadm.sh update clients/<uuid>` avec `authenticationFlowBindingOverrides.browser = <flow-uuid>`
   - **Mapping `amr` claim** : Keycloak Built-in `Authentication Methods Reference` mapper activé sur `tukio-admin` → JWT contient `amr: ["pwd", "totp"]` après MFA réussie ; `payload.amr.includes('totp')` consommé par `RolesGuard` Story 0.8 AC3
   - **Fallback `acr` claim** : si une version Keycloak future change le format `amr`, mapper aussi `acr` (Authentication Context Class Reference) où `acr === '2'` = MFA — Story 0.8 Dev Notes ligne 700 documente ce fallback. **Au MVP : on émet les deux** pour résilience.
   - **Recovery codes** : feature Keycloak `Recovery Authentication Code` activée pour `admin-*` (8 codes générés au TOTP setup Story 1.7) — ajout du Required Action `CONFIGURE_RECOVERY_AUTHN_CODES` au flow `tukio-admin-mfa-required`
   - **Tests smoke** : vérifier `kcadm.sh get clients/<uuid>` montre `authenticationFlowBindingOverrides.browser != null` ; vérifier `kcadm.sh get authentication/flows | jq '.[] | select(.alias == "tukio-admin-mfa-required")'` retourne le flow

4. **AC4 — Custom claim `tukio:locale` + `tukio:status` (Pro pending) émis dans JWT** : Given le client `tukio-web` (et `tukio-admin`, `tukio-mobile`), When un user authentifié récupère son JWT (via Authorization Code + PKCE Story 1.4), Then le payload JWT contient :
   - **`tukio:locale`** : valeur tirée d'un user attribute `locale` (Keycloak built-in) avec **default `fr`** si absent. Mapping :
     - **Protocol Mapper Type** : `User Attribute`
     - **User Attribute** : `locale`
     - **Token Claim Name** : `tukio:locale` (notation namespacée, séparateur `:` accepté par Keycloak — alternative `tukio.locale` rejetée car Keycloak la transforme en objet imbriqué)
     - **Add to ID token** : `true`, **Add to Access token** : `true`, **Add to Userinfo** : `true`
     - **Default value** : `fr` (Story Epic 7 i18n alignment)
   - **`tukio:status`** : valeur tirée d'un user attribute `status` (Keycloak custom — défini par `identity-svc` Story 1.10 lors du register) — utile pour le claim Pro `pending_admin_review` (FR3) :
     - Valeurs possibles : `active`, `pending_admin_review` (Pro non validé), `rejected`, `suspended`
     - **Default** : `active` (Customer B2C standard)
     - **Add to Access token** : `true`, **Add to Userinfo** : `true`
   - **Mapping role precedence** : assurer que `realm_access.roles` est inclus dans tous les JWT (mapper Keycloak `realm-roles` activé par défaut, vérifier qu'il l'est)
   - **Email + email_verified** : claim Keycloak natif déjà présent (utilisé par `KeycloakJwtGuard` Story 0.8 + `@RequireEmailVerified()` Story 0.8)
   - **Source-of-truth des mappers** : fichier `infra/keycloak/realm-config/protocol-mappers.json` (1 fichier consolidé qui décrit les 4 mappers : `tukio-locale-mapper`, `tukio-status-mapper`, `audience-mapper-tukio-api`, `amr-mapper`) — appliqués via `kcadm.sh` aux 3 clients publics (`tukio-web`, `tukio-admin`, `tukio-mobile`)
   - **Client scope `tukio-locale-scope`** : créé pour regrouper `tukio-locale-mapper` + `tukio-status-mapper`, assigné en `defaultClientScope` aux 3 clients publics (modulaire — permet d'override par client futur)
   - **Tests smoke** : créer un user test `smoke-test-customer@tukio.one` avec attributes `locale: 'en'` + `status: 'active'` → décoder le JWT obtenu (via `direct-access-grants` temporairement activé sur un client de test, désactivé après) → vérifier `payload['tukio:locale'] === 'en'` et `payload['tukio:status'] === 'active'`

5. **AC5 — Brute-Force Detection actif + événement NATS `identity.login.error.v1` publié (NFR10 + R8 audit)** : Given un user créé dans le realm `tukio`, When 5 tentatives login fail consécutives en moins de 5 minutes, Then :
   - Le compte user passe en état `temporarilyDisabled` (champ Keycloak `bruteForceMap`) pour **15 minutes** (`maxFailureWaitSeconds: 900` cohérent realm config AC1)
   - Une réponse 401 enveloppée est retournée à l'utilisateur (gateway-api Story Epic 1+ wrap, message générique `"Too many failed attempts, account temporarily locked"`)
   - **Event NATS publié** : `identity.login.error.v1` via le bridge **Keycloak Event Listener SPI → identity-svc inbox → outbox-relay Story 0.7** :
     - **Pattern technique** : un Event Listener Keycloak SPI custom (`infra/keycloak/spi/tukio-event-listener/`) écoute les events `LOGIN_ERROR`, `USER_DISABLED_BY_PERMANENT_LOCKOUT`, `USER_DISABLED_BY_TEMPORARY_LOCKOUT` et POST vers `${IDENTITY_SVC_URL}/internal/keycloak-events` (HMAC-signed avec secret partagé `KEYCLOAK_WEBHOOK_SECRET` — vérifié côté identity-svc)
     - **Alternative MVP simplifiée** : si le SPI custom est trop coûteux à scaffolder Story 1.1, utiliser **Phasetwo Webhooks Extension** (déjà incluse dans l'image `quay.io/phasetwo/phasetwo-keycloak`) qui expose une API admin pour créer des webhooks `POST /realms/tukio/webhooks` — configurer via `kcadm.sh` ou directement Phasetwo Portal API
     - **Décision Story 1.1** : **Phasetwo Webhooks Extension** (alternative simplifiée) — moins de code custom, opérationnel out-of-the-box, cohérent avec le choix Phasetwo SaaS staging. Documenté en Dev Notes §Décisions techniques.
   - L'event payload émis vers `identity-svc.POST /internal/keycloak-events` (puis transformé en NATS event `identity.login.error.v1` par identity-svc Story 1.10) contient :
     ```json
     {
       "schemaVersion": "v1",
       "eventType": "LOGIN_ERROR",
       "realm": "tukio",
       "userId": "<keycloak-uuid|null si user inconnu>",
       "username": "<email-attempted>",
       "ipAddress": "<source-ip>",
       "userAgent": "<UA-header>",
       "error": "invalid_user_credentials",
       "details": { "auth_method": "openid-connect", "client_id": "tukio-web" },
       "occurredAt": "<ISO-8601>",
       "correlationId": "<uuid>"
     }
     ```
   - **Webhook security** : HMAC-SHA256 signature dans le header `X-Phasetwo-Signature` vérifiée par `identity-svc` (Story 1.10 implémentera le verifier — Story 1.1 documente le contrat). Si signature invalide → 401, event drop, alerte Prom.
   - **Tests smoke** : 5 tentatives `curl -X POST ${KC}/realms/tukio/protocol/openid-connect/token` avec mauvais password → vérifier 6ᵉ tentative retourne `error: invalid_grant` + `error_description: "Invalid user credentials. The account is temporarily locked"` ; vérifier que le webhook a été reçu côté MailHog ou un mock-server (Story 1.10 finalisera l'intégration réelle)

6. **AC6 — Custom Tukio Keycloak themes (login + email) terracotta + Fraunces FR/EN** : Given les thèmes custom Keycloak `tukio` (types `login`, `account`, `email`) packagés dans `infra/keycloak/themes/tukio/`, When je consulte `${KEYCLOAK_URL}/realms/tukio/protocol/openid-connect/auth?...&kc_locale=fr` (ou `en`), Then la page rendue :
   - Utilise la **palette terracotta** : background `--color-cream-50 #FFF7F1`, primary CTA `--color-brand-500 #C2410C`, text `--color-charcoal-700`, border `--color-charcoal-200` (mêmes valeurs que `packages/ui/src/styles/theme.css` Story 0.3 — copiées en CSS vanilla dans `infra/keycloak/themes/tukio/login/resources/css/login.css`)
   - Utilise la **typographie Tukio** : `<h1>` en Fraunces 500 charcoal-800, body en Inter 400 charcoal-700 — fonts chargées via **Google Fonts CSS import** (`@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..700&family=Inter:wght@300..700&display=swap');`) car Keycloak themes ne supportent pas `next/font`
   - Affiche les labels FR ou EN selon `kc_locale` (Keycloak Theme i18n built-in via `messages_fr.properties` + `messages_en.properties` files)
     - Exemples FR : `"Se connecter"`, `"Mot de passe oublié ?"`, `"Pas de compte ? S'inscrire"`, `"Vérifiez votre email"`, `"Réinitialiser le mot de passe"`
     - Exemples EN : `"Sign in"`, `"Forgot password?"`, `"No account? Sign up"`, `"Verify your email"`, `"Reset password"`
   - Le **logo Tukio** (SVG `tukio-logo.svg` dans `infra/keycloak/themes/tukio/login/resources/img/`) apparaît en haut de la page (~120 px height)
   - **Templates email** (theme type `email`) : `email-verification.ftl`, `password-reset.ftl`, `executions.ftl` (8 templates standards Keycloak override) → wrapped dans un layout HTML responsive avec branding Tukio (header logo, footer "Tukio — Marketplace événementielle"). Localisés via `messages_fr.properties` + `messages_en.properties` dans `infra/keycloak/themes/tukio/email/messages/`. **NB** : ces emails Keycloak sont distincts des emails transactionnels Resend (Story 0.8 / Story 1.5 / Story 1.6) — Keycloak emails sont uniquement pour les flows internes (verify email if `verifyEmail: true`, password reset link). En MVP, on délègue les emails à `notification-svc` via NATS events (Story 1.5 / 1.6) → désactiver l'envoi natif Keycloak `verifyEmail` au profit de notification-svc + Resend pour cohérence locale FR/EN. Mais on **garde les templates email Tukio** dans le theme pour les cas où Keycloak doit envoyer (e.g., admin invite via Keycloak account console).
   - **Loading + accessibility** : LCP < 1,5 s sur `/realms/tukio/login-actions/registration` (NFR5), navigable au clavier, axe-core sans erreur (test smoke optionnel via `playwright + @axe-core/playwright` dans Story 1.4)
   - **Packaging** : le theme est packagé en JAR (`tukio-keycloak-themes.jar`) déployé dans `/opt/keycloak/providers/` (volume mount Docker Compose `infra/docker-compose/docker-compose.dev.yml`) — **bonus pour Story 0.10** : ajouter ce volume au service `keycloak`. Pour staging Phasetwo SaaS, upload via Phasetwo Portal Themes API.
   - **Build script** : `infra/scripts/build-keycloak-themes.sh` qui (1) lint les .ftl, (2) zip le theme, (3) renomme en .jar, (4) copie vers le volume Keycloak

7. **AC7 — Multi-env support `--env=local|staging|production` + realm-export JSON versioné** : Given `infra/scripts/bootstrap-keycloak-realm.sh`, When je l'exécute avec différents flags d'environnement, Then :
   - **`--env=local`** (default) : pointe vers `KEYCLOAK_URL=http://localhost:8080`, credentials `admin:admin` (Story 0.10 boot), client secrets en clair pour dev (`tukio_api_dev_secret`)
   - **`--env=staging`** : pointe vers `KEYCLOAK_URL=https://auth.staging.tukio.one`, credentials lus depuis Doppler (`KEYCLOAK_ADMIN_USERNAME=$(doppler secrets get KC_ADMIN_USERNAME --plain)`), client secrets depuis Doppler. **Phasetwo SaaS** est l'instance Keycloak staging (PRD ligne 621).
   - **`--env=production`** : (préparé, désactivé MVP — block exit 1 avec `"production env requires manual approval, see runbook/keycloak-prod-bootstrap.md"`)
   - **Realm export JSON** : à la fin de chaque exécution `bootstrap-keycloak-realm.sh`, le script exporte le realm provisionné via `kcadm.sh get realms/tukio --no-config -r tukio --fields '<full-fields-list>'` → `infra/keycloak/realm-export/tukio.realm.json` (committed). Cet export sert de :
     - **Source-of-truth diff** entre staging et local (commit diff visible en PR)
     - **Backup** réutilisable pour restore d'urgence (`kcadm.sh import realms tukio.realm.json`)
     - **Tests smoke** comparison golden file (NFR test reproducibility)
   - **Commande `pnpm keycloak:export`** ajoutée à `package.json` racine (alias du script export-only)
   - **Commande `pnpm keycloak:bootstrap`** ajoutée (alias du script bootstrap, default `--env=local`)
   - **`bootstrap-keycloak-realm.sh` doit être idempotent** : exécuté 2x consécutivement, l'output est identique (vérifié par `diff -q tukio.realm.json.run1 tukio.realm.json.run2`).

8. **AC8 — Phasetwo orgs extension installée + endpoint `/realms/tukio/portal` opérationnel (V2 prep)** : Given Keycloak 26 + Phasetwo bundle installé (image `quay.io/phasetwo/phasetwo-keycloak:<latest-stable>` en local Docker Compose ; instance Phasetwo SaaS managée en staging), When je consulte `${KEYCLOAK_URL}/realms/tukio/portal` ou `${KEYCLOAK_URL}/realms/tukio/orgs`, Then :
   - L'API Phasetwo Orgs répond `200 OK` avec un JSON listant les organisations (vide MVP : `[]`)
   - L'API Phasetwo Webhooks répond sur `${KEYCLOAK_URL}/realms/tukio/webhooks` (utilisée AC5 pour bridge LOGIN_ERROR → identity-svc)
   - L'API Phasetwo Magic Links répond sur `${KEYCLOAK_URL}/realms/tukio/magic-link` (réservé V2 admin invite flow)
   - **Important MVP** : ces APIs sont **provisionnées mais NON exposées publiquement** au MVP (whitelist côté `gateway-api` Story Epic 1+ pour bloquer `/portal` et `/orgs` jusqu'à V2 SAML SSO B2B Enterprise — cf. Epic 15 Story 15.1)
   - **Tests smoke** : `curl -fsS ${KEYCLOAK_URL}/realms/tukio/orgs` retourne `[]` (200 + empty array), `curl ${KEYCLOAK_URL}/realms/tukio/webhooks` retourne `[]`
   - Documentation V2 enterprise SSO : ajouter `docs/runbook/keycloak-phasetwo-orgs-v2.md` (placeholder ~30 lignes avec lien Phasetwo docs https://phasetwo.io/docs/api)

9. **AC9 — Smoke tests `infra/scripts/smoke-test-keycloak-realm.sh` automatisés** : Given le script `infra/scripts/smoke-test-keycloak-realm.sh`, When je le lance après `bootstrap-keycloak-realm.sh`, Then il vérifie **automatiquement les 8 ACs ci-dessus** et exit 0 si tout passe, exit 1 + log clair sur le 1ᵉʳ failure :
   - **Test 1** (AC1) : `curl -fsS ${KC}/realms/tukio/.well-known/openid-configuration | jq -e '.issuer == "${KC}/realms/tukio"'`
   - **Test 2** (AC1) : `kcadm.sh get roles -r tukio --fields name | jq -e 'map(.name) | contains(["client","pro","admin-support","admin-modo","admin-super"])'`
   - **Test 3** (AC2) : pour chacun des 4 clients, `kcadm.sh get "clients?clientId=<id>" -r tukio | jq -e '.[0].enabled == true'`
   - **Test 4** (AC2) : verify PKCE S256 enabled : `kcadm.sh get "clients?clientId=tukio-web" -r tukio | jq -e '.[0].attributes."pkce.code.challenge.method" == "S256"'`
   - **Test 5** (AC4) : créer un user temp `smoke-test@tukio.one`, set attribute `locale: 'en'`, obtenir un JWT (via direct-access-grants temp activé sur `tukio-api` ou un client de test), décoder + vérifier `payload['tukio:locale'] === 'en'`, supprimer le user temp
   - **Test 6** (AC5) : 5x `curl -X POST ${KC}/realms/tukio/protocol/openid-connect/token -d "grant_type=password&username=smoke-test@tukio.one&password=WRONG&client_id=tukio-api&client_secret=$KEYCLOAK_CLIENT_SECRET_TUKIO_API"` → vérifier 6ᵉ retourne `account temporarily locked`
   - **Test 7** (AC6) : `curl -fsS "${KC}/realms/tukio/login-actions/registration?client_id=tukio-web&kc_locale=fr"` → vérifier le HTML contient `"Pas de compte"` (FR), idem `kc_locale=en` → vérifier `"No account"`
   - **Test 8** (AC8) : `curl -fsS ${KC}/realms/tukio/orgs` retourne `200 + []` (Phasetwo orgs accessible)
   - **Sortie** : tableau récap `✅ test1 (200ms) ... ✅ test8 (150ms) — 8/8 passed`
   - **CI hook** : ce script est exécuté en CI nightly via `.github/workflows/keycloak-smoke.yml` (workflow nouveau, MVP nightly schedule `cron: '0 4 * * *'`) — **bonus pour Story 0.11** : ajouter ce workflow.

10. **AC10 — Documentation runbook + ADR addendum** : Given le scope cross-cutting de cette story, When je consulte `docs/`, Then je trouve :
    - **`docs/runbook/keycloak-realm-bootstrap.md`** : runbook opérationnel (~80 lignes) — comment provisionner local + staging + restore from realm-export JSON + rotation client secrets + ajout d'un admin user manuel via `kcadm.sh create users`
    - **`docs/runbook/keycloak-realm-recovery.md`** : runbook RPO/RTO (~50 lignes) — restore depuis `tukio.realm.json` last-known-good si Keycloak crash, validation post-restore via smoke tests
    - **`docs/adr/0009-keycloak-identity-svc-split.md` updated** (Story 0.13 ADR-009) : ajout d'une section "Implementation Notes" qui référence Story 1.1 implementation + Phasetwo webhooks decision + theme packaging strategy
    - **`packages/auth/README.md` updated** (Story 0.8) : section "Realm dependency" qui dit "ce package nécessite le realm `tukio` provisionné via Story 1.1 — voir `infra/scripts/bootstrap-keycloak-realm.sh`"

## Tasks / Subtasks

- [ ] **Task 1 — Préparer les configs JSON realm + clients + protocol-mappers** (AC: #1, #2, #4)
  - [ ] 1.1 — Créer `infra/keycloak/realm-config/realm-base.json` avec la config realm complète (cf. AC1 payload figé). Variables `${SMTP_HOST}`, `${SMTP_USER}`, `${SMTP_PASSWORD}`, `${SMTP_FROM}`, `${SMTP_PORT}` à substituer par `envsubst` selon `--env=<local|staging>` au runtime du script bootstrap.
  - [ ] 1.2 — Créer `infra/keycloak/realm-config/clients/tukio-web.json` avec config complète (cf. AC2). RedirectUris substitués via envsubst (`${REDIRECT_URIS_TUKIO_WEB}`) selon env.
  - [ ] 1.3 — Créer `infra/keycloak/realm-config/clients/tukio-admin.json` (PKCE + flow MFA binding défini AC3 — UUID flow résolu dynamiquement par le script bootstrap après création du flow).
  - [ ] 1.4 — Créer `infra/keycloak/realm-config/clients/tukio-api.json` (confidential, secret via `${KEYCLOAK_CLIENT_SECRET_TUKIO_API}` envsubst).
  - [ ] 1.5 — Créer `infra/keycloak/realm-config/clients/tukio-mobile.json` (deep-link `tukio://`).
  - [ ] 1.6 — Créer `infra/keycloak/realm-config/protocol-mappers.json` (4 mappers : `tukio-locale-mapper`, `tukio-status-mapper`, `audience-mapper-tukio-api`, `amr-mapper`).
  - [ ] 1.7 — Créer `infra/keycloak/realm-config/client-scopes/tukio-locale-scope.json` (regroupe les 2 mappers tukio:* — assigné en defaultClientScope aux 3 clients publics).
  - [ ] 1.8 — Créer `infra/keycloak/realm-config/roles.json` (5 rôles avec attributes `description.fr` + `description.en` cf. AC1 tableau).

- [ ] **Task 2 — Implémenter `infra/scripts/bootstrap-keycloak-realm.sh` idempotent multi-env** (AC: #1, #2, #3, #4, #5, #7, #8)
  - [ ] 2.1 — Header bash strict : `#!/usr/bin/env bash`, `set -euo pipefail`, parse args `--env=<local|staging|production>` via getopts ou case statement (default `local`).
  - [ ] 2.2 — Charger les env vars selon flag : `local` → hardcoded fallback values; `staging` → `doppler secrets download --no-file --format env --project tukio --config staging` + sourcing; `production` → exit 1 avec message "manual approval required".
  - [ ] 2.3 — Healthcheck Keycloak : `curl -fsS --max-time 5 ${KEYCLOAK_URL}/health/ready` avec retry loop (12 tentatives, 5 s entre chacune). Sinon exit 1.
  - [ ] 2.4 — Login admin via `kcadm.sh config credentials --server ${KEYCLOAK_URL} --realm master --user ${KEYCLOAK_ADMIN_USERNAME} --password ${KEYCLOAK_ADMIN_PASSWORD}`.
  - [ ] 2.5 — Créer/Update realm via `kcadm.sh create realms --file infra/keycloak/realm-config/realm-base.json` (catch existence: `|| kcadm.sh update realms/tukio --file ...`). Substituer env vars via `envsubst < realm-base.json | sponge` ou tmp file.
  - [ ] 2.6 — Créer/Update les 5 rôles via `kcadm.sh create roles -r tukio --file ...` (loop sur rôles avec attributs FR/EN).
  - [ ] 2.7 — Créer le flow custom `tukio-admin-mfa-required` (clone `browser`, force OTP step) via `kcadm.sh create authentication/flows -r tukio` + step bindings.
  - [ ] 2.8 — Créer/Update les 4 clients via `kcadm.sh create clients` (loop sur les 4 fichiers JSON, lookup UUID si exist puis update). Pour `tukio-admin`, après création, update avec `authenticationFlowBindingOverrides.browser=<flow-uuid>` du flow custom Task 2.7.
  - [ ] 2.9 — Créer client scope `tukio-locale-scope` + 4 protocol mappers, assigner le scope en defaultClientScope aux 3 clients publics.
  - [ ] 2.10 — Configurer Phasetwo Webhook (bridge LOGIN_ERROR → identity-svc) via `curl -X POST ${KEYCLOAK_URL}/realms/tukio/webhooks ...` avec HMAC secret. Conditional : skip si `--skip-phasetwo-webhook` flag (utile en CI sans identity-svc).
  - [ ] 2.11 — Trigger l'export realm via `kcadm.sh get realms/tukio --fields '*'` → écrire dans `infra/keycloak/realm-export/tukio.realm.json` (overwrite). Sanitize : retirer les champs sensibles (`smtpServer.password`, `clients[].secret`) avant commit. Marquer en haut du fichier `<!-- AUTO-GENERATED, DO NOT EDIT MANUALLY, run pnpm keycloak:bootstrap -->`.
  - [ ] 2.12 — Final summary log : `"✅ Realm 'tukio' provisioned: 5 roles, 4 clients, MFA flow ✓, Phasetwo webhook ✓, themes wired ✓ (env=$env)"`.

- [ ] **Task 3 — Build + package custom Tukio Keycloak themes (login + email + account)** (AC: #6)
  - [ ] 3.1 — Créer `infra/keycloak/themes/tukio/login/theme.properties` (parent: `keycloak.v2`, styles, scripts, locales).
  - [ ] 3.2 — Créer `infra/keycloak/themes/tukio/login/resources/css/login.css` : copier les CSS variables terracotta + Fraunces depuis `packages/ui/src/styles/theme.css` (Story 0.3 ligne 515-562). Override styles Keycloak `.kc-login-tooltip`, `.form-group`, `.btn-primary`, etc. pour matcher branding.
  - [ ] 3.3 — Créer `infra/keycloak/themes/tukio/login/resources/img/tukio-logo.svg` (placeholder SVG terracotta — design final Story 0.4 ou design system Cloud bundle).
  - [ ] 3.4 — Créer `infra/keycloak/themes/tukio/login/messages/messages_fr.properties` + `messages_en.properties` avec strings localisés (login, register, password reset, verify email, etc. — ~30 keys).
  - [ ] 3.5 — Override les .ftl templates principaux : `login.ftl`, `register.ftl`, `verify-email.ftl`, `login-reset-password.ftl` (copie depuis `keycloak.v2` parent + branding header/footer Tukio + classes terracotta).
  - [ ] 3.6 — Créer `infra/keycloak/themes/tukio/account/theme.properties` (parent: `keycloak.v3`, hérite des styles login).
  - [ ] 3.7 — Créer `infra/keycloak/themes/tukio/email/theme.properties` (parent: `base`).
  - [ ] 3.8 — Créer `infra/keycloak/themes/tukio/email/html/email-verification.ftl` + `email/text/email-verification.ftl` + `email/messages/messages_{fr,en}.properties`.
  - [ ] 3.9 — Créer `infra/scripts/build-keycloak-themes.sh` : (a) lint les .properties via `iconv -f utf-8 -t utf-8` (vérif encoding), (b) zip `infra/keycloak/themes/tukio/` → `dist/tukio-keycloak-themes.jar` (Keycloak themes JARs sont juste des ZIPs avec extension .jar), (c) optionnel : copy vers volume Docker Compose si `--deploy-local` flag.
  - [ ] 3.10 — Update `infra/docker-compose/docker-compose.dev.yml` (Story 0.10) : ajouter `volumes: - ./keycloak/themes:/opt/keycloak/providers:ro` au service `keycloak` + démarrer Keycloak avec `start-dev --features=preview` pour permettre les themes custom.

- [ ] **Task 4 — Implémenter `infra/scripts/smoke-test-keycloak-realm.sh`** (AC: #9)
  - [ ] 4.1 — Header bash strict + parse `--env`. Login admin via `kcadm.sh`.
  - [ ] 4.2 — Test 1 (OIDC discovery) : `curl -fsS ${KC}/realms/tukio/.well-known/openid-configuration | jq -e '.issuer == "${KC}/realms/tukio"'`
  - [ ] 4.3 — Test 2 (5 rôles existent) : `kcadm.sh get roles -r tukio --fields name | jq -e 'map(.name) | contains(["client","pro","admin-support","admin-modo","admin-super"])'`
  - [ ] 4.4 — Test 3 (4 clients enabled) : loop sur `["tukio-web","tukio-admin","tukio-api","tukio-mobile"]` + `kcadm.sh get "clients?clientId=$id" -r tukio | jq -e '.[0].enabled'`
  - [ ] 4.5 — Test 4 (PKCE S256 sur tukio-web) : `kcadm.sh get "clients?clientId=tukio-web" -r tukio | jq -e '.[0].attributes."pkce.code.challenge.method" == "S256"'`
  - [ ] 4.6 — Test 5 (claim `tukio:locale`) : créer user temp via `kcadm.sh create users -r tukio -s "username=smoke-test-$$@tukio.one" -s "email=smoke-test-$$@tukio.one" -s "enabled=true" -s "emailVerified=true" -s "attributes.locale=[\"en\"]" -s "attributes.status=[\"active\"]"`. Set password via `kcadm.sh set-password`. Obtenir JWT via `curl -X POST ${KC}/realms/tukio/protocol/openid-connect/token -d "grant_type=password&..."` (nécessite directAccessGrants temporairement activé sur `tukio-api` pour le smoke ou un 5ᵉ client de test `tukio-smoke-test` confidential avec direct grants — décision Story 1.1 : créer un 5ᵉ client `tukio-smoke-test` non listé AC2 mais documenté Dev Notes pour usage smoke tests CI). Décoder JWT (jq + base64 decode middle segment), vérifier `payload['tukio:locale'] == "en"` + `payload['tukio:status'] == "active"`. Supprimer user temp via `kcadm.sh delete`.
  - [ ] 4.7 — Test 6 (brute-force lock) : 5x `curl -X POST .../token` avec mauvais password → vérifier 6ᵉ retourne `error_description` contains `"locked"` ou `"disabled"`. Reset le user après (admin unlock via `kcadm.sh update users/<id> -s "enabled=true"`).
  - [ ] 4.8 — Test 7 (themes FR/EN) : `curl -fsS "${KC}/realms/tukio/login-actions/registration?client_id=tukio-web&kc_locale=fr"` | grep `"Pas de compte"` ; idem `?kc_locale=en` | grep `"No account"`.
  - [ ] 4.9 — Test 8 (Phasetwo orgs) : `curl -fsS ${KC}/realms/tukio/orgs` retourne `200` + body `[]`.
  - [ ] 4.10 — Output récap tableau coloré avec timing par test, exit 0/1 selon failures.

- [ ] **Task 5 — Update Docker Compose (Story 0.10) pour Keycloak 26 + themes volume + Phasetwo image** (AC: #6, #8)
  - [ ] 5.1 — Mettre à jour `infra/docker-compose/docker-compose.dev.yml` : remplacer `image: quay.io/keycloak/keycloak:25.0` par `image: quay.io/phasetwo/phasetwo-keycloak:<latest-stable>` (vérifier via `docker pull quay.io/phasetwo/phasetwo-keycloak:latest && docker inspect ... | jq '.[].Config.Labels' | grep version`). À l'écriture de cette story (2026-05-09) : Phasetwo bundle Keycloak 26.x.
  - [ ] 5.2 — Update env vars Keycloak : ajouter `KC_FEATURES=preview,scripts,token-exchange,admin-fine-grained-authz`, `KC_PROXY_HEADERS=xforwarded` (pour future setup ingress staging), `KC_HEALTH_ENABLED=true` (déjà présent).
  - [ ] 5.3 — Ajouter le volume themes : `volumes: - ../keycloak/themes:/opt/keycloak/themes:ro`.
  - [ ] 5.4 — Ajouter le volume realm-export : `volumes: - ../keycloak/realm-export:/opt/keycloak/data/import:ro`. Si Keycloak boot avec `start-dev --import-realm`, il importera automatiquement `tukio.realm.json` au boot suivant — utile en CI ephemeral.
  - [ ] 5.5 — Bumper le healthcheck `start_period: 60s` (Phasetwo image plus lourde que vanilla — boot ~40-50 s).

- [ ] **Task 6 — Update Story 0.10 bootstrap script + add `pnpm keycloak:*` aliases** (AC: #7)
  - [ ] 6.1 — Si Story 0.10 a déjà créé `infra/scripts/bootstrap-keycloak-realm.sh` (placeholder basique 5 rôles + 4 clients), Story 1.1 le **remplace** avec la version comprehensive (cf. Task 2). Sinon, Story 1.1 le crée from scratch.
  - [ ] 6.2 — Ajouter à `package.json` racine :
    ```json
    {
      "scripts": {
        "keycloak:bootstrap": "infra/scripts/bootstrap-keycloak-realm.sh --env=local",
        "keycloak:bootstrap:staging": "infra/scripts/bootstrap-keycloak-realm.sh --env=staging",
        "keycloak:export": "infra/scripts/bootstrap-keycloak-realm.sh --env=local --export-only",
        "keycloak:smoke": "infra/scripts/smoke-test-keycloak-realm.sh --env=local",
        "keycloak:themes:build": "infra/scripts/build-keycloak-themes.sh"
      }
    }
    ```
  - [ ] 6.3 — Update `pnpm docker:bootstrap` (Story 0.10) pour appeler `pnpm keycloak:bootstrap` après `pnpm keycloak:themes:build` :
    ```sh
    pnpm keycloak:themes:build && infra/scripts/bootstrap-databases.sh && pnpm keycloak:bootstrap && pnpm keycloak:smoke
    ```

- [ ] **Task 7 — Ajouter CI workflow `.github/workflows/keycloak-smoke.yml`** (AC: #9, bonus Story 0.11)
  - [ ] 7.1 — Workflow nightly cron `0 4 * * *` UTC qui : (a) start Keycloak via Docker Compose `--profile slow-services`, (b) exécute `pnpm keycloak:themes:build`, (c) exécute `pnpm keycloak:bootstrap`, (d) exécute `pnpm keycloak:smoke`, (e) export realm + diff vs `tukio.realm.json` committed (alerte si drift), (f) upload `tukio-keycloak-themes.jar` artifact.
  - [ ] 7.2 — Slack notification `#tukio-alerts` si smoke fail.

- [ ] **Task 8 — Documentation runbook + ADR addendum** (AC: #10)
  - [ ] 8.1 — Créer `docs/runbook/keycloak-realm-bootstrap.md` (~80 lignes) : prereq, étapes local, étapes staging, troubleshooting (Keycloak DOWN, Phasetwo SaaS auth fail, theme build fail), rotation client secrets, ajout admin user manuel via kcadm.
  - [ ] 8.2 — Créer `docs/runbook/keycloak-realm-recovery.md` (~50 lignes) : restore depuis `tukio.realm.json`, validation post-restore, RPO/RTO targets.
  - [ ] 8.3 — Update `docs/adr/0009-keycloak-identity-svc-split.md` (Story 0.13 ADR-009) : section "Implementation Notes" qui référence Story 1.1 + Phasetwo webhooks bridge + theme JAR packaging.
  - [ ] 8.4 — Update `packages/auth/README.md` (Story 0.8) : ajouter section "Realm dependency" qui dit "ce package nécessite le realm `tukio` provisionné via Story 1.1 — voir `infra/scripts/bootstrap-keycloak-realm.sh`. Le JWT contient les claims custom `tukio:locale` (default 'fr') et `tukio:status` (default 'active') — wired via mappers Story 1.1.".

- [ ] **Task 9 — Tests d'intégration end-to-end (`@tukio/auth` Story 0.8 contre realm Story 1.1)** (AC: #1-#9)
  - [ ] 9.1 — Update `apps/identity-svc/test/user.e2e-spec.ts` : remplacer le mock `nock` JWKS par un appel réel au realm Keycloak local (boot via Docker Compose Story 0.10 + bootstrap Story 1.1) → générer un JWT via Resource Owner Password (temp activé sur `tukio-api` test client) + vérifier `KeycloakJwtGuard` valide bien la signature RS256 + `RolesGuard` enforce le RBAC.
  - [ ] 9.2 — Tests d'intégration multi-zones (préparation Story 1.4) : vérifier qu'un cookie session posé par `tukio-web` redirect URI `http://localhost:3000/auth/callback` (apps/public) est consommable par `apps/customer/` (`http://localhost:3001`) — *NB* : ce test sera finalisé Story 1.4. Story 1.1 vérifie juste que les redirect URIs sont configurés correctement.
  - [ ] 9.3 — Lint validation : `infra/scripts/bootstrap-keycloak-realm.sh` passe `shellcheck -x` sans warnings, `infra/scripts/smoke-test-keycloak-realm.sh` idem.

- [ ] **Task 10 — Commit + final validation** (AC: all)
  - [ ] 10.1 — `pnpm keycloak:themes:build && pnpm keycloak:bootstrap && pnpm keycloak:smoke` passe en local (8/8 tests).
  - [ ] 10.2 — `pnpm lint && pnpm typecheck` à la racine → tous passent.
  - [ ] 10.3 — Vérifier que `infra/keycloak/realm-export/tukio.realm.json` est commité + lisible humainement (formatted JSON, sensitive fields stripped).
  - [ ] 10.4 — Commit `feat(auth): provision Keycloak realm tukio (5 roles + 4 clients + Phasetwo + themes terracotta + brute-force LOGIN_ERROR webhook + multi-env bootstrap script + smoke tests)` — Story 1.1 done, Epic 1 démarré.

## Dev Notes

### Pourquoi cette story ouvre Epic 1 — contexte stratégique

> **Sources canoniques** : `_bmad-output/planning-artifacts/architecture.md` §Cross-Cutting Auth (lignes 234-241) + §Authentication & Security (lignes 665-697) + §Detail libs partagées (lignes 2195-2200, 2235-2240) + §Authentication Flow (lignes 1731-1738) ; `_bmad-output/planning-artifacts/prd.md` §FR1, FR3, FR4, FR7, FR8, FR9, FR14-17 + §NFR9-13, NFR15, NFR48, NFR71 ; `_bmad-output/planning-artifacts/epics.md` §Epic 1 (lignes 1075-1242) ; `_bmad-output/planning-artifacts/ux-design-specification.md` §Auth screens (lignes 277-281, 951) ; ADR-009 Keycloak split (Story 0.13).

Sprint 0 (13 stories) a livré la **fondation technique** : monorepo Turborepo, contracts events, design system Tailwind v4, atomics + patterns UI, Pattern Pretre identity-svc scaffolding, NATS messaging, **`@tukio/auth` + `@tukio/auth-client` libs (Story 0.8) qui sont en attente d'un realm Keycloak réel pour fonctionner**, Docker Compose dev, CI/CD, Helm + ArgoCD staging, ADRs. Story 1.1 est la **1ʳᵉ story Epic 1 — elle débloque tout l'Epic 1** :

- **Story 1.2** (Customer B2C register) consomme directement le realm `tukio` provisionné ici (pour créer un user via Keycloak Admin API + assigner rôle `client`).
- **Story 1.3** (Pro register pending) idem + utilise le claim custom `tukio:status='pending_admin_review'` AC4.
- **Story 1.4** (Login PKCE) consomme directement les 4 clients OIDC + les redirect URIs définis ici.
- **Story 1.5** (Password reset) consomme l'endpoint Keycloak `/account/password-reset` + les templates email theme `tukio` AC6.
- **Story 1.6** (Email verification) consomme `verifyEmail: true` + theme email `tukio`.
- **Story 1.7** (Admin TOTP) consomme le flow custom `tukio-admin-mfa-required` AC3 + Required Action `CONFIGURE_TOTP`.
- **Story 1.8 / 1.9** (Profile / delete) consomment les claims `tukio:locale` + email + status.
- **Story 1.10** (identity-svc Pretre) consomme le webhook bridge AC5 pour sync user mirror via NATS event `identity.login.error.v1`.
- **Tous les Epics 2-7+** : consomment `KeycloakJwtGuard` + `RolesGuard` Story 0.8 qui valident contre ce realm (JWKS `${KC}/realms/tukio/protocol/openid-connect/certs`).

**Story 1.1 = source-of-truth opérationnelle du realm tukio.** Tout changement ultérieur (V1+ social login, V2 SAML, V2 Phasetwo orgs B2B Enterprise) passe par modification de ce realm via le même script `bootstrap-keycloak-realm.sh`.

### Décisions techniques majeures (à acter dans Story 1.1)

1. **Keycloak 26 (latest stable) — override Architecture.md ligne 122/669 + Story 0.10 ligne 20 qui mentionnent Keycloak 25.** Justification : memory `feedback_latest_versions.md` "latest stable versions toujours". Keycloak 26.x est la branche LTS stable au moment de Story 1.1 (2026-05-09). Action : update `docker-compose.dev.yml` (Task 5.1) pour utiliser `quay.io/phasetwo/phasetwo-keycloak:<26-bundled-tag>` (la version Phasetwo elle-même bundle Keycloak 26.x — vérifier `docker pull && docker inspect`). Fail-fast en CI si version Keycloak < 26.0.
2. **Phasetwo Webhooks Extension** pour bridge `LOGIN_ERROR` → `identity-svc` (AC5) — alternative au Keycloak Event Listener SPI custom. Justification : (a) Phasetwo bundle déjà cette extension officiellement (cohérent choix Phasetwo SaaS staging), (b) zéro code custom Java/Maven, (c) configuration via API REST `kcadm` ou Phasetwo Portal, (d) HMAC signature out-of-the-box. Documenté Tradeoff : si Phasetwo open-source ne ship plus webhooks dans une version future, fallback Keycloak Event Listener SPI Java. **Plan B documenté** dans `docs/runbook/keycloak-realm-bootstrap.md`.
3. **Themes Tukio packagés en JAR** (volume mount Docker `/opt/keycloak/providers/`). Justification : pattern Keycloak standard (https://www.keycloak.org/docs/latest/server_development/#_themes), permet hot-reload en dev (`--features=preview` + theme cache disabled), portable vers Phasetwo SaaS staging via Phasetwo Portal Themes API.
4. **Custom claim namespace `tukio:`** (notation Keycloak supportée — séparateur `:`). Justification : (a) lisibilité côté JWT (`tukio:locale` clair vs `locale` ambigu avec built-in Keycloak), (b) éviter collision avec claims OIDC standards, (c) cohérent avec event names `identity.user.registered.v1` (tukio namespace partout). Alternative rejetée : `tukio.locale` qui aurait créé un objet imbriqué `{tukio: {locale: "fr"}}` moins ergonomique côté JS.
5. **Realm export JSON committed dans le repo** (`infra/keycloak/realm-export/tukio.realm.json`). Justification : (a) source-of-truth diff visible en PR, (b) restore d'urgence via `kcadm.sh import`, (c) cohérent GitOps Story 0.12 ArgoCD pattern (déclarer la cible, machine appliquer). **Champs sensibles strippés** avant commit (smtp password, client secrets — ces valeurs viennent de Doppler en staging/prod, jamais committées).
6. **5ᵉ client `tukio-smoke-test`** confidential avec `directAccessGrantsEnabled: true` créé pour le smoke test script (AC9 Test 5/6) — **non listé AC2** car non utilisé app-side, mais nécessaire pour obtenir des JWT en test sans le flow PKCE complet (qui nécessite un browser). **Désactivé par défaut en production** (`enabled: false` si `--env=production`).
7. **EN strict pour la couche tech** (memory `feedback_tech_layer_english.md`) : noms de rôles `client/pro/admin-{support,modo,super}` (pas `admin-modération`), client IDs `tukio-{web,admin,api,mobile}` (pas `tukio-app`), claim names `tukio:locale` (pas `tukio:langue`), webhook URLs `/realms/tukio/webhooks` (anglais natif Phasetwo).
8. **Bilingue FR/EN dès maintenant** (memory `feedback_i18n_frontend.md`) : role descriptions `attributes.description.fr` + `.en`, themes login + email avec `messages_{fr,en}.properties`, supportedLocales `["fr","en"]` defaultLocale `fr` (cohérent ADR-012).

### Versions à utiliser (latest stable au moment du Sprint 0 / Epic 1)

| Composant | Rôle | Version cible | Vérification |
|---|---|---|---|
| **Keycloak** | IdP server | **26.x latest** (LTS) | `docker pull quay.io/keycloak/keycloak:latest && docker inspect | jq '.[].Config.Labels' | grep version` ou consulter https://www.keycloak.org/downloads |
| **Phasetwo bundle** | Keycloak + Orgs/Webhooks/Magic Links extensions | **Latest stable** bundlée Keycloak 26.x | `docker pull quay.io/phasetwo/phasetwo-keycloak:latest && docker inspect ...` |
| **`kcadm.sh`** | Keycloak Admin CLI | bundle dans Keycloak 26 | distribué via image Docker — utilisé via `docker exec keycloak /opt/keycloak/bin/kcadm.sh ...` ou dump localement via `docker cp` |
| **`jq`** | JSON parsing dans bash scripts | latest système | `apt-get install jq` ou `brew install jq` |
| **`shellcheck`** | Bash lint en CI | latest | `apt-get install shellcheck` ou `brew install shellcheck` |
| **`envsubst`** | Variable substitution dans JSON configs | bundle gettext | system default |
| **`curl`** | HTTP smoke tests | latest | system default |
| **Doppler CLI** (staging) | Secrets management | latest | `brew install dopplerhq/cli/doppler` ou via Doppler GitHub Action |

> ⚠️ **Phasetwo open-source vs SaaS** : `quay.io/phasetwo/phasetwo-keycloak` est l'**image Docker open-source** (Apache 2.0) qui bundle Keycloak + extensions Phasetwo (Orgs, Webhooks, Magic Links). Phasetwo SaaS (https://phasetwo.io/) = même bundle + hosting managé + support entreprise. **MVP local : open-source image Docker. MVP staging : Phasetwo SaaS managé** (PRD ligne 621). API et configuration sont identiques entre les deux — seul le hosting diffère.
>
> ⚠️ **`kcadm.sh` execution** : 2 options. **Option A (recommandée)** : exécuter via `docker compose exec keycloak /opt/keycloak/bin/kcadm.sh ...` — le script bash bootstrap utilise `docker compose exec` partout. Plus simple, pas d'installation locale requise. **Option B** : installer Keycloak CLI standalone localement (`brew install keycloak` ou télécharger zip). **Décision Story 1.1** : Option A (zéro install local pour le dev).
>
> ⚠️ **Keycloak 26 breaking changes vs 25** : refactor `client.attributes.pkce.code.challenge.method` reste OK ; refactor `clientScopes` API (mineure) ; nouveau format `bruteForceProtector` mais ancien compat. **À vérifier au runtime** dans Debug Log References.

### Project Structure cible (fichiers créés/modifiés Story 1.1)

```
infra/
├─ keycloak/                                        # ← NOUVEAU dossier (préparé Story 0.10, peuplé Story 1.1)
│  ├─ realm-config/
│  │  ├─ realm-base.json                            # AC1 — config realm avec envsubst placeholders
│  │  ├─ roles.json                                 # AC1 — 5 rôles + descriptions FR/EN
│  │  ├─ clients/
│  │  │  ├─ tukio-web.json                          # AC2 — public PKCE
│  │  │  ├─ tukio-admin.json                        # AC2 + AC3 — public PKCE + MFA flow binding
│  │  │  ├─ tukio-api.json                          # AC2 — confidential service-account
│  │  │  ├─ tukio-mobile.json                       # AC2 — public PKCE deep-link
│  │  │  └─ tukio-smoke-test.json                   # Smoke tests CI (decision 6 ci-dessus)
│  │  ├─ protocol-mappers.json                      # AC4 — 4 mappers (locale, status, audience, amr)
│  │  ├─ client-scopes/
│  │  │  └─ tukio-locale-scope.json                 # AC4 — regroupe locale + status mappers
│  │  └─ authentication-flows/
│  │     └─ tukio-admin-mfa-required.json           # AC3 — flow custom MFA OBLIGATOIRE
│  ├─ realm-export/
│  │  └─ tukio.realm.json                           # AC7 — auto-generated, committed, sensitive stripped
│  ├─ themes/                                       # AC6 — themes packagés en JAR
│  │  └─ tukio/
│  │     ├─ login/
│  │     │  ├─ theme.properties
│  │     │  ├─ resources/
│  │     │  │  ├─ css/login.css
│  │     │  │  └─ img/tukio-logo.svg
│  │     │  ├─ messages/
│  │     │  │  ├─ messages_fr.properties
│  │     │  │  └─ messages_en.properties
│  │     │  └─ {login,register,verify-email,login-reset-password}.ftl
│  │     ├─ account/
│  │     │  └─ theme.properties
│  │     └─ email/
│  │        ├─ theme.properties
│  │        ├─ html/
│  │        │  ├─ email-verification.ftl
│  │        │  ├─ password-reset.ftl
│  │        │  └─ executions.ftl
│  │        ├─ text/                                # mêmes templates en plain text
│  │        └─ messages/
│  │           ├─ messages_fr.properties
│  │           └─ messages_en.properties
│  └─ spi/                                          # ← VIDE MVP (Phasetwo Webhooks Extension utilisée AC5)
│     └─ README.md                                  # explique pourquoi vide MVP, plan V1+ si Phasetwo Webhooks insuffisant
├─ scripts/
│  ├─ bootstrap-keycloak-realm.sh                   # Task 2 — idempotent multi-env, comprehensive
│  ├─ smoke-test-keycloak-realm.sh                  # Task 4 — 8 smoke tests
│  └─ build-keycloak-themes.sh                      # Task 3.9 — package theme en JAR
└─ docker-compose/
   └─ docker-compose.dev.yml                        # ← UPDATE (Story 0.10) — Phasetwo image + themes volume + Keycloak 26 env vars

docs/
├─ adr/
│  └─ 0009-keycloak-identity-svc-split.md           # ← UPDATE (Story 0.13) — Implementation Notes addendum
└─ runbook/
   ├─ keycloak-realm-bootstrap.md                   # ← NOUVEAU — runbook opérationnel
   ├─ keycloak-realm-recovery.md                    # ← NOUVEAU — runbook RPO/RTO
   └─ keycloak-phasetwo-orgs-v2.md                  # ← NOUVEAU placeholder — V2 enterprise SSO

packages/auth/
└─ README.md                                        # ← UPDATE (Story 0.8) — section "Realm dependency"

.github/workflows/
└─ keycloak-smoke.yml                               # ← NOUVEAU (bonus Story 0.11) — CI nightly smoke

package.json                                        # ← UPDATE racine — ajouter scripts pnpm keycloak:*
```

### Pattern code — `infra/scripts/bootstrap-keycloak-realm.sh` (squelette)

```bash
#!/usr/bin/env bash
# bootstrap-keycloak-realm.sh — provision realm tukio idempotemment
# Usage: bootstrap-keycloak-realm.sh --env=<local|staging|production> [--export-only] [--skip-phasetwo-webhook]
set -euo pipefail
IFS=$'\n\t'

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
readonly KC_CONFIG_DIR="${REPO_ROOT}/infra/keycloak/realm-config"
readonly KC_EXPORT_DIR="${REPO_ROOT}/infra/keycloak/realm-export"

# ─── Args parsing ─────────────────────────────────────────────────────
ENV="local"
EXPORT_ONLY=false
SKIP_PHASETWO_WEBHOOK=false
for arg in "$@"; do
  case $arg in
    --env=*) ENV="${arg#*=}" ;;
    --export-only) EXPORT_ONLY=true ;;
    --skip-phasetwo-webhook) SKIP_PHASETWO_WEBHOOK=true ;;
    *) echo "Unknown arg: $arg" >&2; exit 1 ;;
  esac
done

# ─── Env config ───────────────────────────────────────────────────────
case $ENV in
  local)
    export KEYCLOAK_URL="${KEYCLOAK_URL:-http://localhost:8080}"
    export KEYCLOAK_ADMIN_USERNAME="${KEYCLOAK_ADMIN_USERNAME:-admin}"
    export KEYCLOAK_ADMIN_PASSWORD="${KEYCLOAK_ADMIN_PASSWORD:-admin}"
    export KEYCLOAK_CLIENT_SECRET_TUKIO_API="${KEYCLOAK_CLIENT_SECRET_TUKIO_API:-tukio_api_dev_secret}"
    export KEYCLOAK_WEBHOOK_SECRET="${KEYCLOAK_WEBHOOK_SECRET:-tukio_webhook_dev_secret}"
    export REDIRECT_URIS_TUKIO_WEB='["http://localhost:3000/*","http://localhost:3001/*","http://localhost:3002/*"]'
    export REDIRECT_URIS_TUKIO_ADMIN='["http://localhost:3003/*"]'
    export IDENTITY_SVC_WEBHOOK_URL="${IDENTITY_SVC_WEBHOOK_URL:-http://host.docker.internal:4001/internal/keycloak-events}"
    ;;
  staging)
    # Doppler CLI required
    eval "$(doppler secrets download --no-file --format env --project tukio --config staging)"
    ;;
  production)
    echo "ERROR: production env requires manual approval." >&2
    echo "See docs/runbook/keycloak-realm-bootstrap.md §Production deployment." >&2
    exit 1
    ;;
  *) echo "Unknown env: $ENV" >&2; exit 1 ;;
esac

# ─── Helper: kcadm.sh wrapper ─────────────────────────────────────────
kcadm() {
  if [[ "$ENV" == "local" ]]; then
    docker compose -f "${REPO_ROOT}/infra/docker-compose/docker-compose.dev.yml" exec -T keycloak /opt/keycloak/bin/kcadm.sh "$@"
  else
    # staging/prod: assume kcadm installed locally or use --server flag
    /opt/keycloak/bin/kcadm.sh "$@"
  fi
}

# ─── Healthcheck Keycloak ─────────────────────────────────────────────
log_info "Checking Keycloak readiness at ${KEYCLOAK_URL}/health/ready..."
for i in {1..12}; do
  if curl -fsS --max-time 5 "${KEYCLOAK_URL}/health/ready" >/dev/null 2>&1; then
    log_info "✅ Keycloak is ready"
    break
  fi
  if [[ $i -eq 12 ]]; then
    log_error "Keycloak not ready after 60s. Run 'pnpm docker:up' first."
    exit 1
  fi
  sleep 5
done

# ─── Login admin ──────────────────────────────────────────────────────
kcadm config credentials \
  --server "${KEYCLOAK_URL}" \
  --realm master \
  --user "${KEYCLOAK_ADMIN_USERNAME}" \
  --password "${KEYCLOAK_ADMIN_PASSWORD}"

# ─── Realm create/update ──────────────────────────────────────────────
if [[ "$EXPORT_ONLY" == "false" ]]; then
  envsubst < "${KC_CONFIG_DIR}/realm-base.json" > /tmp/realm-base.json
  if kcadm get "realms/tukio" >/dev/null 2>&1; then
    log_info "Realm tukio exists, updating..."
    kcadm update "realms/tukio" -f /tmp/realm-base.json
  else
    log_info "Creating realm tukio..."
    kcadm create realms -f /tmp/realm-base.json
  fi

  # ─── 5 roles ────────────────────────────────────────────────────────
  for role in client pro admin-support admin-modo admin-super; do
    create_or_update_role "$role"
  done

  # ─── Authentication flow tukio-admin-mfa-required ───────────────────
  setup_mfa_flow

  # ─── 4 + 1 clients ──────────────────────────────────────────────────
  for client in tukio-web tukio-admin tukio-api tukio-mobile tukio-smoke-test; do
    create_or_update_client "$client"
  done

  # ─── Client scope + protocol mappers ───────────────────────────────
  setup_client_scope_locale
  setup_protocol_mappers

  # ─── Phasetwo webhook (optional) ────────────────────────────────────
  if [[ "$SKIP_PHASETWO_WEBHOOK" == "false" ]]; then
    setup_phasetwo_webhook
  fi
fi

# ─── Export realm ─────────────────────────────────────────────────────
log_info "Exporting realm to ${KC_EXPORT_DIR}/tukio.realm.json..."
mkdir -p "${KC_EXPORT_DIR}"
kcadm get "realms/tukio" --fields '*' > /tmp/tukio.realm.json.raw
sanitize_realm_export /tmp/tukio.realm.json.raw "${KC_EXPORT_DIR}/tukio.realm.json"

log_info "✅ Realm 'tukio' provisioned: 5 roles, 5 clients (4 production + 1 smoke-test), MFA flow ✓, Phasetwo webhook ✓, themes wired ✓ (env=$ENV)"
```

### Pattern code — `infra/keycloak/realm-config/protocol-mappers.json` (extrait)

```json
{
  "mappers": [
    {
      "name": "tukio-locale-mapper",
      "protocol": "openid-connect",
      "protocolMapper": "oidc-usermodel-attribute-mapper",
      "consentRequired": false,
      "config": {
        "user.attribute": "locale",
        "claim.name": "tukio:locale",
        "jsonType.label": "String",
        "id.token.claim": "true",
        "access.token.claim": "true",
        "userinfo.token.claim": "true"
      }
    },
    {
      "name": "tukio-status-mapper",
      "protocol": "openid-connect",
      "protocolMapper": "oidc-usermodel-attribute-mapper",
      "consentRequired": false,
      "config": {
        "user.attribute": "status",
        "claim.name": "tukio:status",
        "jsonType.label": "String",
        "id.token.claim": "false",
        "access.token.claim": "true",
        "userinfo.token.claim": "true"
      }
    },
    {
      "name": "audience-mapper-tukio-api",
      "protocol": "openid-connect",
      "protocolMapper": "oidc-audience-mapper",
      "consentRequired": false,
      "config": {
        "included.client.audience": "tukio-api",
        "id.token.claim": "false",
        "access.token.claim": "true"
      }
    },
    {
      "name": "amr-mapper",
      "protocol": "openid-connect",
      "protocolMapper": "oidc-amr-mapper",
      "consentRequired": false,
      "config": {
        "id.token.claim": "true",
        "access.token.claim": "true"
      }
    }
  ]
}
```

### Critical Architecture Constraints (rappel non-négociable)

> Cf. Architecture lignes 234-241 + 665-697 + 1731-1738 + memories `feedback_clean_architecture_explicit.md`, `feedback_tech_layer_english.md`, `feedback_i18n_frontend.md`, `feedback_latest_versions.md`.

1. **Keycloak 26 LTS (latest stable) — pas Keycloak 25** : override Architecture.md ligne 122/669 + Story 0.10 ligne 20. Justification memory `feedback_latest_versions.md`.
2. **JWT RS256 + JWKS endpoint exposé** (NFR11) : `${KEYCLOAK_URL}/realms/tukio/protocol/openid-connect/certs` retourne le JWK Set utilisé par `@tukio/auth` Story 0.8 `JwksCacheService` (cache 10 min).
3. **PKCE S256 obligatoire** sur `tukio-web`, `tukio-admin`, `tukio-mobile` (NFR sécurité OWASP, cohérent Story 0.8 AC6).
4. **MFA TOTP obligatoire pour `admin-*`** (NFR12 + FR9) : enforced via flow custom `tukio-admin-mfa-required` AC3, claim `amr.includes('totp')` consommé par Story 0.8 `RolesGuard`.
5. **5 rôles realm-level figés** : `client`, `pro`, `admin-support`, `admin-modo`, `admin-super` — strict matching avec `Role` type Story 0.2 + Story 0.8.
6. **Brute Force Detection** : 5 fails / 5 min → 15 min lock + event NATS `identity.login.error.v1` via Phasetwo Webhook → identity-svc inbox → outbox-relay (NFR10 rate limit + R8 audit).
7. **`Domain=.tukio.one` cookies** : non-applicable Story 1.1 (Keycloak set ses cookies sur `auth.tukio.one`, c'est `gateway-api` Story Epic 1+ qui set le cookie session `tukio-access-token` Domain=.tukio.one). Story 1.1 garantit juste que les redirect URIs supportent `*.tukio.one`.
8. **i18n FR + EN dès maintenant** (memory `feedback_i18n_frontend.md`) : roles descriptions, themes, `supportedLocales`, default locale FR.
9. **EN strict couche tech** (memory `feedback_tech_layer_english.md`) : noms rôles/clients/claims/paths en anglais.
10. **Realm export JSON committed** : source-of-truth diff visible, pattern GitOps cohérent ArgoCD (Story 0.12).

### Previous Story Intelligence

**Story 0.6** : `apps/identity-svc/src/infrastructure/config/environment-config.service.ts` Zod-validated. Story 1.1 ne modifie PAS identity-svc (c'est Story 1.10) — mais documente les env vars nécessaires (`KEYCLOAK_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_CLIENT_ID`, `KEYCLOAK_AUDIENCE`, `KEYCLOAK_WEBHOOK_SECRET`) qui seront wirées Story 0.8 + Story 1.10.

**Story 0.7** : `correlationContext` (AsyncLocalStorage) + outbox-relay PG LISTEN/NOTIFY. Story 1.1 documente le contrat NATS event `identity.login.error.v1` qui sera publié par identity-svc Story 1.10 (consumant les Phasetwo webhooks AC5). Le schema JSON event est à ajouter Story 1.10 dans `@tukio/contracts/events/identity/login-error.v1.schema.json`.

**Story 0.8** : `@tukio/auth` Backend (`KeycloakJwtGuard`, `RolesGuard`, `JwksCacheService`, `ActorResolver`) + `@tukio/auth-client` Frontend (`KeycloakClient`, `RefreshTokenRotation`, `<AuthProvider>`, hooks). Story 1.1 fournit le **realm Keycloak réel** que ces libs consomment :
- `JwksCacheService` fetch `${KEYCLOAK_URL}/realms/tukio/protocol/openid-connect/certs` → AC1 garantit endpoint disponible.
- `KeycloakJwtGuard` valide `iss = "${KEYCLOAK_URL}/realms/tukio"` + `aud = "tukio-api"` → AC1 + AC4 audience mapper.
- `RolesGuard` lit `realm_access.roles` → AC1 + AC4 default role-mapper.
- `@RequireMfa()` lit `payload.amr.includes('totp')` → AC3 + AC4 amr-mapper.
- `<AuthProvider>` config `realm: 'tukio'`, `clientId: 'tukio-web'` → AC2 client `tukio-web` provisionné.
- `RefreshTokenRotation` consomme `accessTokenLifespan: 300` → AC2 cohérent.
- Les apps frontend doivent placer un fichier `silent-check-sso.html` dans leur `public/` (Story 0.8 AC6) — vérifié par redirect URIs Story 1.1 AC2.

**Story 0.10** : Docker Compose dev local + bootstrap script Keycloak basique (5 rôles + 4 clients minimum). Story 1.1 :
- **Replace** le bootstrap script avec la version comprehensive (Task 6.1).
- **Update** `docker-compose.dev.yml` pour image Phasetwo Keycloak 26 + themes volume + env vars (Task 5).
- **Update** `pnpm docker:bootstrap` script alias pour intégrer themes build + bootstrap + smoke (Task 6.3).

**Story 0.11** : CI GitHub Actions (lint + typecheck + tests affected). Story 1.1 ajoute (bonus) un workflow nightly `keycloak-smoke.yml` (Task 7).

**Story 0.12** : Helm + ArgoCD. Pas de wiring direct Story 1.1 (Keycloak prod hosting = Phasetwo SaaS managé, pas K8s self-host MVP). Le realm-export JSON est compatible avec Phasetwo SaaS (même format Keycloak natif).

**Story 0.13** : 14 ADRs initialisés. Story 1.1 update ADR-009 (Keycloak split) avec section "Implementation Notes" (Task 8.3).

### Latest Tech Information (Phasetwo + Keycloak 26 specifics)

> **Knowledge cutoff** : 2026-01. Vérifier au runtime via `docker pull` + `docker inspect` que Phasetwo image existe et bundle Keycloak 26.x (PR check).

- **Phasetwo Webhooks Extension (open-source)** : https://github.com/p2-inc/keycloak-events — endpoint `POST /realms/{realm}/webhooks` pour créer un webhook, payload JSON envoyé à `webhookUrl` avec header `X-Phasetwo-Signature: sha256=<hmac>` (HMAC-SHA256 secret partagé). Events filtrables : `LOGIN`, `LOGIN_ERROR`, `REGISTER`, `LOGOUT`, `UPDATE_PASSWORD`, `VERIFY_EMAIL`, `USER_DISABLED_BY_*`. Story 1.1 configure `LOGIN_ERROR` + `USER_DISABLED_BY_TEMPORARY_LOCKOUT`.
- **Phasetwo Orgs Extension** : https://github.com/p2-inc/keycloak-orgs — endpoints `/realms/{realm}/orgs` pour multi-tenant logical (V2 enterprise). MVP : provisionné mais non utilisé (whitelist gateway-api).
- **Phasetwo Magic Links Extension** : `/realms/{realm}/magic-link` — V2 admin invite flow.
- **Keycloak 26 breaking changes (vs 25)** :
  - **`@horizon-republic/nestjs-jetstream` est sans rapport** — c'est NATS.
  - **Refactor `bruteForceProtector`** : nouveau format API avec `permanentLockout`, `bruteForceAlgorithm` (legacy "linear" vs nouveau "multi-tier"). Story 1.1 utilise les defaults compat 25/26.
  - **Theme cache** : `--features=preview --spi-theme-cache-themes=false` en dev, prod `true`.
  - **Quarkus runtime** : Keycloak 26 ships Quarkus 3.x — démarrage plus rapide (~10s vs 30s 25).
  - **`KC_HEALTH_ENABLED=true`** : déjà activé Story 0.10. Cohérent.
  - **Liquibase migrations** : Keycloak 26 auto-migre depuis 25 si DB partagée. Story 1.1 ne touche pas DB Keycloak directement (kcadm only).

### Project Structure Notes

✅ **Aligné** avec Architecture lignes 234-241 (Cross-Cutting Auth — Keycloak 25 → bumped 26 latest stable per memory `feedback_latest_versions.md`).

✅ **Aligné** avec Architecture lignes 665-697 (Authentication & Security — JWT RS256 + JWKS + cookies + RBAC + MFA).

✅ **Aligné** avec Architecture lignes 2046-2053 (`infra/keycloak/` dossier prévu, Story 1.1 le peuple).

✅ **Aligné** avec PRD §FR1, FR3, FR4, FR7-9, FR14-17 (Identity user stories MVP).

✅ **Aligné** avec PRD §NFR9-13 (sécurité auth + MFA admin + JWT RS256 + JWKS cache).

✅ **Aligné** avec ADR-009 Keycloak + identity-svc séparés (Story 0.13).

✅ **Aligné** avec memory `feedback_latest_versions.md` (Keycloak 26 latest stable, pas 25).

✅ **Aligné** avec memory `feedback_i18n_frontend.md` (FR + EN dès Sprint 0, role descriptions bilingues, themes bilingues).

✅ **Aligné** avec memory `feedback_tech_layer_english.md` (noms rôles/clients/claims/paths EN strict).

⚠️ **Décision documentée** : choix Phasetwo Webhooks Extension > Keycloak Event Listener SPI custom Java (cf. Décisions techniques majeures §2). Plan B documenté dans `docs/runbook/keycloak-realm-bootstrap.md`.

⚠️ **Décision documentée** : 5ᵉ client `tukio-smoke-test` ajouté pour CI smoke tests (cf. Décisions techniques majeures §6). **Disabled en production**.

⚠️ **Décision documentée** : émission **simultanée** des claims `amr` ET `acr` pour résilience future (cf. Story 0.8 Dev Notes ligne 700 fallback). Si Keycloak 27 change `amr`, `acr === '2'` sera utilisé.

⚠️ **Décision documentée** : la **désactivation native Keycloak `verifyEmail`** au profit de Resend transactionnel (Story 1.5/1.6) est explicitement documentée dans Story 1.6 — **Story 1.1 garde `verifyEmail: true` au realm-level** car certains flows internes Keycloak en ont besoin (admin invite via account console). La duplication (Keycloak email + Resend) sera résolue Story 1.6 par désactivation conditionnelle ou par override des templates Keycloak vers no-op.

⚠️ **À noter** : `gateway-api` n'existe pas encore au scaffolding final (Story 1.1 ne l'utilise pas directement). Les redirect URIs configurés AC2 sont les apps frontend (`apps/{public,customer,seller,admin}`), pas `gateway-api`. `gateway-api` interceptera les callbacks `/auth/callback` Stories Epic 1+ pour échanger le code → tokens (Story 1.4).

⚠️ **À noter** : la **rotation des client secrets `tukio-api`** est manuelle MVP (`pnpm keycloak:bootstrap:staging` re-applique le secret depuis Doppler). V2 : automatisation via Doppler rotation policy + ArgoCD reconciliation.

### Testing Standards

- **Smoke tests CI nightly** : `infra/scripts/smoke-test-keycloak-realm.sh --env=local` (8 tests, exit 0/1).
- **Idempotence** : `bootstrap-keycloak-realm.sh` exécuté 2x consécutivement → diff `tukio.realm.json` = vide.
- **Lint** : `shellcheck -x` sur les 3 scripts bash (Task 9.3).
- **Tests d'intégration end-to-end** : `apps/identity-svc/test/user.e2e-spec.ts` updated pour utiliser le realm réel local au lieu du mock nock JWKS (Task 9.1) — preview de ce que Story 1.10 finalisera.
- **Coverage cible** : N/A pour cette story (pas de code applicatif TS) — la qualité est mesurée par les 8 smoke tests + idempotence + lint shellcheck.
- **Tests perf** : startup `pnpm docker:up && pnpm keycloak:bootstrap` ≤ 60 s en local (Phasetwo image ~20 s boot + bootstrap script ~10 s).

### What this story does NOT do (out of scope)

- ❌ **identity-svc Pretre Clean Arch implementation** (UserProfile aggregate, ports, use cases) → **Story 1.10**
- ❌ **`POST /v1/auth/customer/register` endpoint** → Story 1.2
- ❌ **`POST /v1/auth/pro/register` endpoint avec INSEE SIRENE** → Story 1.3
- ❌ **Login flow UI complet (page `/auth/login`, callback)** → Story 1.4
- ❌ **Password reset flow + email Resend** → Story 1.5
- ❌ **Email verification landing page UX-DR10** → Story 1.6
- ❌ **Admin TOTP setup wizard UI (QR code, recovery codes display)** → Story 1.7 (Story 1.1 provisionne le flow + Required Action, Story 1.7 implémente l'UI)
- ❌ **Profile management `/account/profile` UI** → Story 1.8
- ❌ **Account deletion soft-delete RGPD** → Story 1.9
- ❌ **identity-svc consumer du Phasetwo webhook `LOGIN_ERROR`** → Story 1.10 (Story 1.1 configure juste le webhook côté Keycloak + documente le contrat HMAC)
- ❌ **Schema JSON event `identity.login.error.v1` dans `@tukio/contracts`** → Story 1.10 (consume-side)
- ❌ **`gateway-api` cookie management + CSRF** → Stories Epic 1+
- ❌ **`gateway-api` rate limiting endpoints sensibles login** → Stories Epic 1+
- ❌ **Phasetwo Orgs B2B Enterprise SAML SSO** → V2 Epic 15
- ❌ **Social login Google + Apple** → V1 (FR5)
- ❌ **Keycloak prod hosting (self-host K8s)** → Phasetwo SaaS managé MVP, pas de Helm chart Keycloak Story 0.12
- ❌ **Reset des secrets Keycloak en cas de compromission** → runbook séparé `docs/runbook/keycloak-secret-rotation.md` (V1+)

### Files to UPDATE vs CREATE

> **À UPDATE** :
> - `infra/docker-compose/docker-compose.dev.yml` (Story 0.10) — image Phasetwo + themes volume + env vars Keycloak 26
> - `infra/scripts/bootstrap-keycloak-realm.sh` (Story 0.10) — replace par version comprehensive
> - `package.json` racine — ajouter scripts `keycloak:*`
> - `docs/adr/0009-keycloak-identity-svc-split.md` (Story 0.13) — Implementation Notes addendum
> - `packages/auth/README.md` (Story 0.8) — section "Realm dependency"
> - `apps/identity-svc/test/user.e2e-spec.ts` (Story 0.8) — utilisation realm réel local

> **À CREATE** :
> - `infra/keycloak/realm-config/realm-base.json`
> - `infra/keycloak/realm-config/roles.json`
> - `infra/keycloak/realm-config/clients/{tukio-web,tukio-admin,tukio-api,tukio-mobile,tukio-smoke-test}.json` (5 fichiers)
> - `infra/keycloak/realm-config/protocol-mappers.json`
> - `infra/keycloak/realm-config/client-scopes/tukio-locale-scope.json`
> - `infra/keycloak/realm-config/authentication-flows/tukio-admin-mfa-required.json`
> - `infra/keycloak/realm-export/tukio.realm.json` (auto-generated)
> - `infra/keycloak/themes/tukio/{login,account,email}/...` (~30-40 fichiers)
> - `infra/keycloak/spi/README.md`
> - `infra/scripts/smoke-test-keycloak-realm.sh`
> - `infra/scripts/build-keycloak-themes.sh`
> - `docs/runbook/keycloak-realm-bootstrap.md`
> - `docs/runbook/keycloak-realm-recovery.md`
> - `docs/runbook/keycloak-phasetwo-orgs-v2.md` (placeholder)
> - `.github/workflows/keycloak-smoke.yml`
> - **Estimation total fichiers** : ~50-60 fichiers (dont ~40 dans themes Tukio FreeMarker templates).

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Cross-Cutting-Auth — Lines 234-241 (Keycloak 25→26, RBAC 5 rôles, JWT RS256 JWKS cache 10 min, x-tukio-actor header, sync webhooks)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Authentication-Security — Lines 665-697 (Keycloak Phasetwo, refresh rotation, cookies Domain=.tukio.one, CSRF double-submit, Doppler secrets)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Authentication-Flow — Lines 1731-1738 (workflow login Keycloak Authorization Code + PKCE)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Decision-Priority-Analysis — Line 578 (ADR-009 Keycloak + identity-svc séparés)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Project-Structure — Lines 2046-2053 (infra/keycloak/themes/ + infra/scripts/bootstrap-keycloak-realm.sh prévus)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Detail-libs-partagees-auth — Lines 2195-2200 + 2235-2240 (packages/auth + auth-client structures)]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic-1-Story-1.1 — Lines 1084-1098 (7 ACs originaux : realm + 5 rôles + 4 clients + Phasetwo + brute-force LOGIN_ERROR + themes terracotta + multi-env)]
- [Source: _bmad-output/planning-artifacts/prd.md#FR1 — Visitor inscription Customer B2C 30s]
- [Source: _bmad-output/planning-artifacts/prd.md#FR3 — Visitor inscription Pro pending_admin_review]
- [Source: _bmad-output/planning-artifacts/prd.md#FR4 — Login email + password Keycloak]
- [Source: _bmad-output/planning-artifacts/prd.md#FR7 — Password reset email]
- [Source: _bmad-output/planning-artifacts/prd.md#FR8 — Verify email]
- [Source: _bmad-output/planning-artifacts/prd.md#FR9 — Admin 2FA TOTP obligatoire création]
- [Source: _bmad-output/planning-artifacts/prd.md#FR14 — Profile read+update]
- [Source: _bmad-output/planning-artifacts/prd.md#FR15 — Account delete soft-delete RGPD]
- [Source: _bmad-output/planning-artifacts/prd.md#FR16 — Anti-doublon SIRET Pro]
- [Source: _bmad-output/planning-artifacts/prd.md#FR17 — Block transactional features unverified]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR9 — HTTPS/HSTS]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR10 — mTLS rate limiting]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR11 — JWT RS256 + JWKS cache 10 min + re-validation downstream]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR12 — MFA TOTP admin obligatoire]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR13 — Secrets via Kubernetes Secrets + vault Doppler]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR15 — KYC docs encrypted at-rest R2]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR48 — UX < 30s sign-up]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR71 — Test coverage ≥ 80% domain, ≥ 50% infra]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Auth-screens — Lines 277-281 (mvp-auth.jsx + auth.tukio.one Keycloak themed)]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Theme-Tokens — Lines 511-622 (terracotta + Fraunces + Inter spec)]
- [Source: _bmad-output/implementation-artifacts/0-3-setup-design-system-tailwind-v4-tukio-ui.md — Story 0.3 dev context (theme.css source-of-truth — copié vers infra/keycloak/themes/tukio/login/resources/css/login.css)]
- [Source: _bmad-output/implementation-artifacts/0-8-setup-tukio-auth-backend-frontend.md — Story 0.8 dev context (KeycloakJwtGuard + RolesGuard + RequireMfa + JwksCacheService — Story 1.1 provisionne le realm que ces libs consomment)]
- [Source: _bmad-output/implementation-artifacts/0-10-docker-compose-dev-local-bootstrap-scripts.md — Story 0.10 dev context (docker-compose.dev.yml Keycloak service + bootstrap-keycloak-realm.sh basique — Story 1.1 update et étend)]
- [Source: _bmad-output/implementation-artifacts/0-13-initialize-adrs-vercel-multi-zones-acquisition-schema.md — Story 0.13 dev context (ADR-009 — Story 1.1 ajoute Implementation Notes)]
- [External: https://www.keycloak.org/docs/26.0/server_admin/index.html — Keycloak 26 server admin guide]
- [External: https://www.keycloak.org/docs/26.0/server_development/index.html#_themes — Keycloak themes packaging]
- [External: https://github.com/p2-inc/keycloak-events — Phasetwo Webhooks Extension]
- [External: https://github.com/p2-inc/keycloak-orgs — Phasetwo Orgs Extension (V2 prep)]
- [External: https://phasetwo.io/docs/api — Phasetwo SaaS API reference]
- [External: https://datatracker.ietf.org/doc/html/rfc7636 — PKCE OAuth 2.0]
- [External: https://datatracker.ietf.org/doc/html/rfc8176 — AMR Values for OAuth 2.0]
- [External: https://datatracker.ietf.org/doc/html/rfc6749 — OAuth 2.0]
- [Memory: feedback_latest_versions.md — Keycloak 26 latest stable obligatoire, override Architecture.md]
- [Memory: feedback_tech_layer_english.md — Roles/clients/claims/paths EN strict]
- [Memory: feedback_i18n_frontend.md — FR + EN dès Sprint 0, themes + role descriptions bilingues]
- [Memory: feedback_clean_architecture_explicit.md — pattern Pretre rappelé pour Story 1.10 follow-up]
- [Memory: feedback_api_envelope_response.md — webhook payload `LOGIN_ERROR` consommé par identity-svc Story 1.10 sera transformé en NATS event puis exposé via gateway-api en réponse enveloppée]
- [Memory: feedback_comprehensive_briefs.md — story exhaustive plutôt que pitch synthétique]
- [Memory: feedback_trust_docs.md — confiance dans les artefacts Sprint 0 + planning-artifacts comme source-of-truth]

## Dev Agent Record

### Agent Model Used

(à remplir par le dev agent au démarrage de l'implémentation)

### Debug Log References

(à remplir au cours de l'implémentation — vérification version Phasetwo image bundlée Keycloak 26.x au moment du dev (`docker pull && docker inspect`), validation idempotence script bootstrap (run x2 → `diff tukio.realm.json` empty), choix `kcadm.sh` via `docker compose exec` vs install local (Option A retenue), validation theme JAR loading dans Keycloak `/opt/keycloak/providers/`, cohabitation `verifyEmail: true` Keycloak vs Resend Story 1.6 (à arbitrer Story 1.6), test signing JWT smoke avec `direct-access-grants` activé temporairement sur `tukio-smoke-test` 5ᵉ client, fallback `acr === '2'` documenté Story 0.8 ligne 700)

### Completion Notes List

(à remplir à la fin — résumé décisions, déviations vs Dev Notes avec justification, points d'attention pour Story 0.10 update docker-compose, Story 0.11 ajout workflow CI keycloak-smoke, Story 0.13 ADR-009 update, Story 1.10 webhook consumer + schema event JSON, Story 1.7 admin TOTP setup wizard UI, Story 1.4 login flow PKCE consumer)

### File List

(à remplir à la fin — liste exhaustive des fichiers créés / modifiés / supprimés, avec chemins relatifs depuis la racine du repo)

---

## Story Completion Status

- **Story Status** : `ready-for-dev`
- **Created** : 2026-05-09
- **Created by** : `bmad-create-story` workflow
- **Epic** : Epic 1 — Identity & Authentication Backbone (MVP)
- **Sprint cible** : Sprint 1 (semaines 4-5 du planning MVP, ouvre Epic 1)
- **Estimation effort** : 4-6 jours (1 dev fullstack DevOps-friendly : scripts bash + Keycloak admin API + theme FreeMarker + smoke tests)
- **Dépendances upstream** :
  - Story 0.8 (`ready-for-dev`) — `@tukio/auth` + `@tukio/auth-client` libs en attente du realm réel
  - Story 0.10 (`ready-for-dev`) — Docker Compose Keycloak service + bootstrap script basique (Story 1.1 update et étend)
  - Story 0.11 (`ready-for-dev`) — CI GitHub Actions (Story 1.1 ajoute workflow nightly keycloak-smoke)
  - Story 0.12 (`ready-for-dev`) — Doppler secrets pour staging (Story 1.1 lit `KC_ADMIN_USERNAME`/`PASSWORD` depuis Doppler en `--env=staging`)
  - Story 0.13 (`ready-for-dev`) — ADR-009 (Story 1.1 ajoute Implementation Notes)
- **Dépendances downstream** :
  - **Story 1.2** (Customer B2C register) — consomme realm + role `client` + claim `tukio:locale`/`tukio:status='active'`
  - **Story 1.3** (Pro register pending_admin_review) — consomme realm + role `pro` + claim `tukio:status='pending_admin_review'`
  - **Story 1.4** (Login PKCE) — consomme `tukio-web` client + redirect URIs + claim `realm_access.roles`
  - **Story 1.5** (Password reset) — consomme realm + Resend (override Keycloak email natif)
  - **Story 1.6** (Email verification landing) — consomme realm `verifyEmail: true` + Resend
  - **Story 1.7** (Admin TOTP setup) — consomme flow `tukio-admin-mfa-required` + Required Action `CONFIGURE_TOTP` + Recovery Codes
  - **Story 1.8 / 1.9** (Profile / delete) — consomment claims user + Keycloak Admin API user CRUD
  - **Story 1.10** (identity-svc Pretre + Phasetwo webhook consumer) — consomme webhook `LOGIN_ERROR` AC5 + ajoute schema event `identity.login.error.v1` dans `@tukio/contracts`
  - **Stories Epic 2-7+** — toutes appliquent `@UseGuards(KeycloakJwtGuard, RolesGuard) @Roles(...)` Story 0.8 contre ce realm
- **FRs covered** :
  - **FR1** — Customer B2C register préparé (realm + role `client`) ✅ (réalisé Story 1.2)
  - **FR3** — Pro register préparé (realm + role `pro` + claim `tukio:status`) ✅ (réalisé Story 1.3)
  - **FR4** — Login préparé (4 clients OIDC PKCE) ✅ (réalisé Story 1.4)
  - **FR7** — Password reset préparé (realm `resetPasswordAllowed: true`) ✅ (réalisé Story 1.5)
  - **FR8** — Verify email préparé (realm `verifyEmail: true`) ✅ (réalisé Story 1.6)
  - **FR9** — Admin TOTP préparé (flow `tukio-admin-mfa-required`) ✅ (réalisé Story 1.7)
  - **FR14-17** — Profile / delete / SIRET anti-doublon / block unverified — préparés indirectement (claims + roles)
- **NFRs touchés** :
  - **NFR9** — HTTPS/HSTS (préparé, finalisé Story Epic 1+ gateway-api ingress)
  - **NFR10** — mTLS inter-services (Phasetwo SaaS staging géré par Phasetwo, MVP local Docker Compose insuffisant — ok)
  - **NFR11** — JWT RS256 + JWKS exposé ✅
  - **NFR12** — MFA TOTP admin obligatoire ✅ (flow `tukio-admin-mfa-required` + Required Action)
  - **NFR13** — Secrets via Doppler (staging) + env vars (local) ✅
  - **NFR15** — Pas applicable directement (KYC docs Story 1.3 / 2.x)
  - **NFR48** — UX sign-up < 30s (préparé via realm fluide + themes optimisés LCP < 1.5s, finalisé Story 1.2)
  - **NFR71** — Tests coverage : 8 smoke tests CI nightly ✅
  - **ADR-009** — Implementation Notes addendum (Task 8.3) ✅
  - **R8** — Drift Keycloak ↔ identity-svc mitigated via webhook bridge AC5 + Story 1.10 reconciliation job

> **Prochaine story (auto-discover via `bmad-create-story`) → Story 1.2** (Customer B2C registration `POST /v1/auth/customer/register`)

---

**Dev agent next steps :**
1. Lire ce file en entier (Story Foundation + AC + Tasks + Dev Notes + References)
2. Vérifier les artefacts upstream (Stories 0.8, 0.10, 0.13) sont bien en `ready-for-dev`
3. Implémenter Tasks 1-10 dans l'ordre (ou parallèle sur Tasks 1+3 si DevOps-friendly)
4. Lancer `pnpm keycloak:themes:build && pnpm keycloak:bootstrap && pnpm keycloak:smoke` après chaque jalon
5. Commit Story 1.1 quand 8/8 smoke tests passent + idempotence vérifiée + lint shellcheck OK
6. Update `_bmad-output/implementation-artifacts/sprint-status.yaml` : `1-1-...: review` (puis `done` après code-review)
