# Story 0.10: Docker Compose dev local complet + scripts bootstrap

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

**As a** developer (équipe Sprint 0 + tout nouveau dev qui rejoint l'équipe),
**I want** un **Docker Compose dev local complet** (`infra/docker-compose/docker-compose.dev.yml`) qui démarre en 1 commande **6 services backing** (Postgres 16 avec 10 DBs logiques + NATS JetStream 2.10 + Keycloak 25 + Meilisearch + Redis 7 + MailHog), accompagné de **4 scripts bootstrap** idempotents (`bootstrap-keycloak-realm.sh` provisionne realm `tukio` + 4 clients + 5 rôles, `bootstrap-databases.sh` crée les 10 DBs + joue les migrations TypeORM de chaque service, `seed-categories.ts` seed les 2 catégories pilotes MVP, `run-chaos-tests.sh` orchestre les tests chaos NATS/DB de Stories 0.7+0.9), et **`docker-compose.test.yml`** dédié aux tests d'intégration CI (perf-tunée, idempotent, healthchecks stricts),
**so that** un nouveau dev qui clone le repo a un environnement complet **fonctionnel en < 5 minutes** (`pnpm install && pnpm docker:up && pnpm docker:bootstrap && pnpm dev`), les 4 frontends + 10 services NestJS peuvent communiquer avec Postgres/NATS/Keycloak/Meilisearch/Redis localement sans dépendance cloud, les emails transactionnels Resend sont visibles dans MailHog `localhost:8025` (zéro Resend prod credentials nécessaire), les tests testcontainers Story 0.9 ont une référence de stack pour aligner versions, et **Story 0.6 + 0.7 + 0.8 deviennent réellement testables end-to-end**.

> **Outcome attendu** : à la fin de cette story, `pnpm docker:up` démarre les 6 services en parallèle (~30-45 s, dominés par Keycloak boot), `pnpm docker:bootstrap` provisionne tout (realm + DBs + seed) en ~10 s, `pnpm dev` lance les 14 codebases qui se connectent réellement à PG/NATS/Keycloak/Meilisearch local, `curl http://localhost:4001/v1/users/abc` retourne 401 enveloppé (KeycloakJwtGuard Story 0.8 actif validant contre Keycloak local), et `curl http://localhost:8025` montre l'UI MailHog où apparaîtront les emails transactionnels des stories Epic 1+.

## Acceptance Criteria

1. **AC1 — `infra/docker-compose/docker-compose.dev.yml` complet avec 6 services + healthchecks** : Given `infra/docker-compose/docker-compose.dev.yml`, When je l'ouvre, Then je trouve **exactement** 6 services configurés avec healthchecks stricts (essentiel pour `depends_on: condition: service_healthy`) :
   - **`postgres`** : image `postgres:16-alpine` (cohérent Architecture ligne 602 + Story 0.6 DataSource), expose port `5432:5432`, env `POSTGRES_USER=tukio`, `POSTGRES_PASSWORD=tukio_dev_password`, `POSTGRES_DB=tukio_meta` (default DB pour bootstrap), volume nommé `tukio_postgres_data`, healthcheck `pg_isready -U tukio` (interval 5s, timeout 5s, retries 10)
   - **`nats`** : image `nats:2.10-alpine`, expose ports `4222:4222` (clients), `8222:8222` (monitoring HTTP), command `["-js", "-m", "8222", "--store_dir=/data"]` (JetStream activé + monitoring + persistence), volume `tukio_nats_data:/data`, healthcheck `wget -q -O- http://localhost:8222/healthz | grep -q 'ok'` (interval 5s)
   - **`keycloak`** : image `quay.io/keycloak/keycloak:25.0` (cohérent Architecture ligne 122/669 + Phasetwo managé prod), expose port `8080:8080`, env `KC_BOOTSTRAP_ADMIN_USERNAME=admin`, `KC_BOOTSTRAP_ADMIN_PASSWORD=admin`, `KC_DB=postgres`, `KC_DB_URL=jdbc:postgresql://postgres:5432/keycloak` (DB séparée dédiée — créée par `bootstrap-databases.sh`), `KC_DB_USERNAME=tukio`, `KC_DB_PASSWORD=tukio_dev_password`, `KC_HOSTNAME=localhost`, `KC_HTTP_ENABLED=true`, command `["start-dev"]` (mode dev, NE PAS utiliser en prod), `depends_on: postgres: { condition: service_healthy }`, healthcheck `curl -f http://localhost:8080/health/ready` (start_period 30s, interval 10s, retries 12 — Keycloak boot lent ~20-30s)
   - **`meilisearch`** : image `getmeili/meilisearch:v1.x` (latest stable, vérifier `pnpm view meilisearch version` pour SDK match), expose port `7700:7700`, env `MEILI_MASTER_KEY=tukio_dev_master_key_change_in_prod`, `MEILI_ENV=development`, volume `tukio_meilisearch_data:/meili_data`, healthcheck `curl -f http://localhost:7700/health` (interval 5s)
   - **`redis`** : image `redis:7-alpine` (cohérent Upstash compat), expose port `6379:6379`, command `["redis-server", "--appendonly", "yes"]` (AOF persistence), volume `tukio_redis_data:/data`, healthcheck `redis-cli ping | grep -q PONG` (interval 5s)
   - **`mailhog`** : image `mailhog/mailhog:latest`, expose ports `1025:1025` (SMTP), `8025:8025` (web UI), pas de healthcheck nécessaire (boot instantané, pas d'état)
   - **Network** : tous les services sur `tukio_dev_network` (driver `bridge`) pour permettre la résolution DNS inter-containers (les apps backend `apps/<svc>/.env.example` peuvent utiliser `postgres`, `nats`, `keycloak` comme hostnames si le service NestJS tourne aussi en container ; sinon `localhost` depuis l'host)
   - **Volumes nommés** déclarés en bas du fichier : `tukio_postgres_data`, `tukio_nats_data`, `tukio_meilisearch_data`, `tukio_redis_data`

2. **AC2 — `docker-compose.test.yml` dédié aux tests CI** : Given `infra/docker-compose/docker-compose.test.yml`, When je l'ouvre, Then je trouve une variante allégée optimisée pour les tests d'intégration CI :
   - **Mêmes 6 services** que `docker-compose.dev.yml` MAIS :
     - Volumes **anonymes** (pas nommés) — chaque test run repart de zéro, pas de pollution entre runs
     - `tmpfs` mount pour Postgres `/var/lib/postgresql/data` → I/O en RAM, ~3-5× plus rapide pour tests
     - Ports mappés sur `localhost` random (`5433:5432`, `4223:4222`, etc.) pour permettre coexistence avec `docker-compose.dev.yml` running
     - Healthchecks plus agressifs (interval 2s, retries 5) — fail-fast pour CI
     - Pas de MailHog (tests E2E utilisent mocks plutôt que SMTP réel)
   - **Profil Keycloak** : possibilité d'activer/désactiver via `--profile slow-services` (Keycloak 20-30s boot pénalise CI rapide). CI workflows par défaut SANS Keycloak ; CI nightly AVEC Keycloak (cohérent Story 0.9 strategy)
   - **Network** : `tukio_test_network` (séparé du dev pour éviter conflits)

3. **AC3 — Script `bootstrap-keycloak-realm.sh` idempotent** : Given `infra/scripts/bootstrap-keycloak-realm.sh`, When je l'exécute (après `pnpm docker:up` que `keycloak` soit `healthy`), Then :
   - **Préreq** : check Keycloak UP via `curl -f http://localhost:8080/health/ready` (sinon exit avec message clair "wait for keycloak to be healthy first")
   - **Authentification admin** : utilise `kcadm.sh config credentials` avec admin/admin (env vars `KEYCLOAK_ADMIN_USER` + `KEYCLOAK_ADMIN_PASSWORD` overrideables)
   - **Realm `tukio` créé** (idempotent : si existe déjà → `update` au lieu de `create`) avec :
     - `enabled: true`
     - `displayName: "Tukio.one"`
     - `loginTheme`, `accountTheme`, `adminTheme`, `emailTheme` : `keycloak` (default Tukio en V1)
     - `internationalizationEnabled: true`, `supportedLocales: ['fr', 'en']`, `defaultLocale: 'fr'`
     - `registrationAllowed: true` (B2C self-service)
     - `verifyEmail: true` (FR8 email verification obligatoire)
     - `resetPasswordAllowed: true` (FR5 password reset)
     - `bruteForceProtected: true`, `permanentLockout: false`, `maxFailureWaitSeconds: 900`, `failureFactor: 5` (anti-brute-force NFR sécurité)
     - `accessTokenLifespan: 900` (15 min — équilibre UX vs sécurité)
     - `ssoSessionMaxLifespan: 28800` (8 heures), `ssoSessionIdleTimeout: 7200` (2 heures)
     - `passwordPolicy: 'length(12) and notUsername and notEmail and specialChars(1) and upperCase(1) and digits(1)'`
   - **5 rôles realm-level créés** (idempotent) : `client`, `pro`, `admin-support`, `admin-modo`, `admin-super` (cohérent Architecture ligne 695 + Story 0.8 `Role` type)
   - **4 clients OIDC créés** (idempotent) :
     - **`tukio-web`** : public client (PKCE), redirectUris `['https://*.tukio.one/*', 'http://localhost:3000/*', 'http://localhost:3001/*', 'http://localhost:3002/*', 'http://localhost:3003/*']`, webOrigins `['+']`, `directAccessGrantsEnabled: false` (PKCE only), `serviceAccountsEnabled: false`, `attributes: { 'pkce.code.challenge.method': 'S256' }` (PKCE obligatoire NFR sécurité Story 0.8)
     - **`tukio-admin`** : public client séparé (sécurité accrue admin), redirectUris `['https://admin.tukio.one/*', 'http://localhost:3003/*']`, **`requiredCredentials: ['totp']`** (MFA TOTP obligatoire admin — NFR12 + FR9), `attributes: { 'pkce.code.challenge.method': 'S256' }`
     - **`tukio-api`** : confidential client (machine-to-machine pour gateway-api validation JWT), `serviceAccountsEnabled: true` (pour future option), `secret: 'tukio_api_dev_secret'` (env var override)
     - **`tukio-mobile`** : public client préparé V2 (React Native), redirectUris `['tukio://callback']` (deep link), `attributes: { 'pkce.code.challenge.method': 'S256' }`
   - **MFA TOTP authenticator config** : pour `tukio-admin` client, lier l'authenticator `OTP` au flow `browser` (forcer TOTP requis pour admin)
   - **Output** : log par étape (✅ realm created, ✅ 5 roles created, ✅ 4 clients configured), summary final avec next steps
   - **Cohabitation** : si script relancé sur realm existant, `update` au lieu de `create` (utilisation de `kcadm.sh get realms/tukio` pour test d'existence)
   - **Bash POSIX** (compatible macOS + Linux), shebang `#!/usr/bin/env bash`, `set -euo pipefail`

4. **AC4 — Script `bootstrap-databases.sh` crée 10 DBs + Keycloak DB + joue migrations** : Given `infra/scripts/bootstrap-databases.sh`, When je l'exécute (après `pnpm docker:up` que `postgres` soit `healthy`), Then :
   - **Préreq** : check Postgres UP via `pg_isready -h localhost -p 5432 -U tukio` (sinon exit avec message clair)
   - **11 databases créées** (idempotent : `CREATE DATABASE ... IF NOT EXISTS` pas natif PG → utiliser pattern `SELECT 'CREATE DATABASE ...' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '...')` puis `\gexec`) :
     - `keycloak` (séparée pour Keycloak service — Architecture ne le mentionne pas explicitement mais nécessaire pour `KC_DB=postgres`)
     - `tukio_identity`
     - `tukio_catalog`
     - `tukio_booking`
     - `tukio_order`
     - `tukio_payment`
     - `tukio_messaging`
     - `tukio_review`
     - `tukio_notification`
     - `tukio_media`
     - `tukio_meta` (DB metadata Tukio — feature flags, audit centralized, etc. — usage défini Story Epic 6+)
   - **Pour chaque DB Tukio** (10) : check si le service correspondant a des migrations → si oui, run `pnpm --filter=<service-name> migration:run` pour jouer les migrations TypeORM (cohérent Story 0.6 baseline + Story 0.7 outbox/inbox)
   - **Pas de seed ici** (le seed est dans `seed-categories.ts` — script séparé pour permettre re-seed sans recréer DBs)
   - **Permissions** : `GRANT ALL PRIVILEGES ON DATABASE tukio_<svc> TO tukio;` pour chaque DB (au MVP, 1 user `tukio` accède à tout — V1+ envisager 1 user par service avec PostgreSQL native row-level security)
   - **Output** : log par DB créée + log par migration jouée
   - **Bash POSIX**, idempotent, `set -euo pipefail`

5. **AC5 — Script `seed-categories.ts` seed 2 catégories pilotes MVP** : Given `infra/scripts/seed-categories.ts` (TypeScript pour bénéficier du typage `@tukio/contracts/dtos/catalog`), When je l'exécute via `tsx infra/scripts/seed-categories.ts` (après `bootstrap-databases.sh`), Then :
   - **Connexion** à `tukio_catalog` DB via `pg` ou TypeORM DataSource (pattern Story 0.6)
   - **2 catégories pilotes MVP créées** (cohérent PRD §Pilotes MVP — tentes/chapiteaux + mobilier événementiel) :
     - **Catégorie 1** : `tents-marquees` (slug FR `tentes-chapiteaux` + EN `tents-marquees` dans `category_translations`)
       - Sub-categories : `wedding-marquees`, `professional-marquees`, `garden-tents`, `pop-up-tents`
       - Service types par sub-cat : `delivery`, `setup`, `dismantling`, `lighting`
     - **Catégorie 2** : `event-furniture` (slug FR `mobilier-evenementiel` + EN `event-furniture`)
       - Sub-categories : `chairs`, `tables`, `linens`, `bars`, `dance-floors`
       - Service types par sub-cat : `delivery`, `setup`, `cleaning`
   - **Idempotent** : check `SELECT EXISTS(SELECT FROM categories WHERE slug = '...')` avant INSERT
   - **Translations** insérées dans `category_translations` (ID FR + ID EN par catégorie, slug + name + description par locale)
   - **Output** : log par catégorie/sub-cat seedée + résumé final (X catégories, Y sub-catégories, Z service types)
   - **TypeScript strict** + use `@tukio/contracts/dtos/catalog/CategoryDto` pour typage
   - Script exécutable directement : `pnpm seed:categories` racine alias

6. **AC6 — Script `run-chaos-tests.sh` orchestre les tests chaos** : Given `infra/scripts/run-chaos-tests.sh`, When je l'exécute, Then :
   - **Préreq** : démarre `docker-compose.test.yml` (incluant `--profile slow-services` pour Keycloak)
   - **Lance les chaos tests** : `pnpm --filter=@tukio/messaging test --chaos` + `pnpm --filter=identity-svc test --chaos` (et tous les services backend qui ont des `*.chaos-spec.ts` Story Epic 4+)
   - **Tag Vitest `--chaos`** : convention pour filtrer les tests chaos via `vitest run --testNamePattern='@chaos'` (les chaos tests sont marqués `it('...', { tags: ['@chaos'] }, ...)` ou via fichier `*.chaos-spec.ts`)
   - **Cleanup** : `docker compose -f docker-compose.test.yml down -v` après les tests pour libérer les ressources
   - **Exit code** : 0 si tous les chaos tests passent, sinon exit code 1 (CI-friendly)
   - **Bash POSIX**, signal handler `trap cleanup EXIT` pour cleanup propre même si script interrompu

7. **AC7 — Scripts racine `package.json` pour orchestration `pnpm`** : Given `package.json` racine, When je l'ouvre, Then je trouve les scripts suivants ajoutés au bloc `scripts` :
   ```json
   {
     "scripts": {
       "docker:up": "docker compose -f infra/docker-compose/docker-compose.dev.yml up -d",
       "docker:up:wait": "docker compose -f infra/docker-compose/docker-compose.dev.yml up -d --wait",
       "docker:down": "docker compose -f infra/docker-compose/docker-compose.dev.yml down",
       "docker:down:volumes": "docker compose -f infra/docker-compose/docker-compose.dev.yml down -v",
       "docker:logs": "docker compose -f infra/docker-compose/docker-compose.dev.yml logs -f",
       "docker:reset": "pnpm docker:down:volumes && pnpm docker:up:wait && pnpm docker:bootstrap",
       "docker:bootstrap": "bash infra/scripts/bootstrap-databases.sh && bash infra/scripts/bootstrap-keycloak-realm.sh && pnpm seed:categories",
       "docker:test:up": "docker compose -f infra/docker-compose/docker-compose.test.yml up -d --wait",
       "docker:test:down": "docker compose -f infra/docker-compose/docker-compose.test.yml down -v",
       "seed:categories": "tsx infra/scripts/seed-categories.ts",
       "chaos:test": "bash infra/scripts/run-chaos-tests.sh"
     }
   }
   ```
   - **Convention** : `docker:up` rapide (no wait), `docker:up:wait` (--wait flag, attend healthchecks OK), `docker:bootstrap` orchestre les 3 scripts, `docker:reset` est le "nuclear option" qui rebuild tout
   - **Cohérent** avec Story 0.1 task 1.5 (scripts racine) — étendre, pas écraser

8. **AC8 — Documentation README onboarding "5 minutes"** : Given `README.md` racine + `infra/docker-compose/README.md`, When je les ouvre, Then je trouve une section "Quick Start (5 minutes)" :
   ```markdown
   ## Quick Start (5 minutes)
   ### Prérequis
   - Docker Desktop 4.x+ (Mac/Win) ou Docker Engine 24+ (Linux)
   - Node.js 22 LTS (`nvm use 22`)
   - pnpm 10+ (`npm install -g pnpm`)
   ### Installation
   ```bash
   git clone <repo> && cd tukio
   pnpm install                    # ~1 min
   pnpm docker:up:wait             # ~30-45 s (Keycloak boot dominant)
   pnpm docker:bootstrap           # ~10 s (realm + DBs + seed categories)
   pnpm dev                        # Turborepo lance les 14 codebases
   ```
   ### URLs disponibles
   - **Frontends** : http://localhost:{3000,3001,3002,3003}
   - **Services backend** : http://localhost:{4000-4009}
   - **Keycloak admin** : http://localhost:8080 (admin/admin)
   - **MailHog** : http://localhost:8025 (web UI emails)
   - **Postgres** : localhost:5432 (user `tukio`, pwd `tukio_dev_password`)
   - **NATS monitoring** : http://localhost:8222
   - **Meilisearch** : http://localhost:7700 (master key `tukio_dev_master_key_change_in_prod`)
   ### Commandes utiles
   - `pnpm docker:logs <service>` : logs d'un service spécifique
   - `pnpm docker:reset` : nuke tout + redémarre
   - `pnpm chaos:test` : run tests chaos (Story 0.7+0.9)
   ```

9. **AC9 — `.env.example` racine + per-service updated avec hostnames Docker Compose** : Given les fichiers `.env.example`, When je les ouvre, Then :
   - **Racine** `.env.example` créé avec env vars partagées : `KEYCLOAK_ADMIN_USER=admin`, `KEYCLOAK_ADMIN_PASSWORD=admin`, `MEILI_MASTER_KEY=tukio_dev_master_key_change_in_prod`, `KEYCLOAK_REALM=tukio`
   - **Per-service** (`apps/identity-svc/.env.example`, etc.) updated avec les hostnames cohérents Docker Compose :
     - `DB_HOST=localhost` (default — services NestJS tournent en host, pas en container au MVP)
     - `DB_PORT=5432`
     - `DB_USER=tukio`
     - `DB_PASSWORD=tukio_dev_password`
     - `DB_NAME=tukio_<svc>` (ex `tukio_identity`)
     - `NATS_URL=nats://localhost:4222`
     - `KEYCLOAK_URL=http://localhost:8080`
     - `KEYCLOAK_REALM=tukio`
     - `REDIS_URL=redis://localhost:6379`
     - `MEILI_URL=http://localhost:7700` (catalog-svc + search consumers)
     - `SMTP_HOST=localhost` + `SMTP_PORT=1025` + `SMTP_FROM=noreply@tukio.dev` (MailHog en dev — Resend prod credentials en V0+)
   - **Cohérent** avec Stories 0.6 (`.env.example` identity-svc) + 0.7 (NATS_URL) + 0.8 (KEYCLOAK_URL)

10. **AC10 — Tests E2E réels qui démarrent contre Docker Compose** : Given le stack `pnpm docker:up:wait && pnpm docker:bootstrap` UP, When je lance `pnpm --filter=identity-svc test:e2e`, Then les tests E2E Story 0.6 + 0.8 passent maintenant **contre une vraie DB + Keycloak réel** (au lieu de mocks `pg-mem` + `nock`) :
    - **Postgres tukio_identity** : table `user_profiles` créée par migration Story 0.6, table `outbox` + `inbox` par migration Story 0.7
    - **Keycloak realm tukio** : 4 clients + 5 rôles provisionnés (Story 0.8 KeycloakJwtGuard validera contre vrai JWKS)
    - **NATS JetStream** : stream `TUKIO_IDENTITY` créé automatiquement par `OutboxRelayModule.forRoot({ streamName: 'TUKIO_IDENTITY' })` au boot identity-svc
    - **Test création user** : `POST /v1/auth/register` (préparé Stories Epic 1) déclenche : insert user_profiles + insert outbox `identity.user.registered.v1` + outbox-relay publish vers NATS + (Story 5.4 V1 wire) notification-svc consume + envoie email vers MailHog → test E2E peut vérifier MailHog `localhost:8025/api/v2/messages` API qu'1 email a été envoyé
    - **NB** : ces tests E2E full-stack ne sont **PAS livrés Story 0.10** — ils sont préparés (infrastructure en place) et seront ajoutés Stories Epic 1+. Story 0.10 valide juste que `pnpm --filter=identity-svc test:e2e` (Story 0.6 user.e2e-spec) **continue à passer** contre la vraie DB.

11. **AC11 — Script de migration `realm-export.json` réutilisable** : Given `infra/scripts/keycloak/realm-export.json`, When je l'ouvre, Then je trouve un export complet du realm `tukio` (output de `kcadm.sh get realms/tukio` après bootstrap) qui peut être :
    - **Importé via testcontainers** (Story 0.9 `startKeycloakContainer({ realm: 'tukio', importJsonPath: 'infra/scripts/keycloak/realm-export.json' })`) → tests E2E rapides avec realm pré-configuré
    - **Backup-restore en cas de corruption** dev local
    - **Versionné Git** pour tracer les évolutions du realm config

12. **AC12 — Idempotence des scripts (tous appelables 2× sans casse)** : Given le stack démarré + bootstrap appliqué, When je relance `pnpm docker:bootstrap`, Then :
    - `bootstrap-databases.sh` : `IF NOT EXISTS` sur tous les CREATE DATABASE → no-op si déjà créées
    - Migrations TypeORM : `migration:run` skip les migrations déjà appliquées (TypeORM tracking native via `migrations` table)
    - `bootstrap-keycloak-realm.sh` : `kcadm.sh get realms/tukio` → si exists, `update` au lieu de `create` (préserve les users créés via UI test)
    - `seed-categories.ts` : `SELECT EXISTS` avant INSERT → no-op si seedée
    - **Output cohérent** : log clairement "✅ Already exists, skipped" pour les actions idempotentes

13. **AC13 — Cleanup script `docker:reset` validé** : Given le stack avec data corrompue, When je lance `pnpm docker:reset`, Then :
    - `docker compose down -v` → tous containers stoppés + volumes nommés détruits (`tukio_postgres_data`, etc. wiped)
    - `docker compose up -d --wait` → restart fresh
    - `docker:bootstrap` → re-provisionne realm + DBs + seed
    - **Total time** : < 90 secondes (Keycloak dominant)
    - **Use case** : dev veut rollback complet sans `git clean -fdx` du code

## Tasks / Subtasks

- [ ] **Task 1 — Créer `infra/docker-compose/docker-compose.dev.yml`** (AC: #1)
  - [ ] 1.1 — Définir `services` : postgres, nats, keycloak, meilisearch, redis, mailhog (cf. AC1 spec exhaustive)
  - [ ] 1.2 — Healthchecks stricts pour 5 services (mailhog dispensé)
  - [ ] 1.3 — Network `tukio_dev_network` (bridge)
  - [ ] 1.4 — 4 volumes nommés : `tukio_postgres_data`, `tukio_nats_data`, `tukio_meilisearch_data`, `tukio_redis_data`
  - [ ] 1.5 — Vérifier `docker compose -f infra/docker-compose/docker-compose.dev.yml config` (validation YAML)
  - [ ] 1.6 — Smoke test : `docker compose up -d --wait` → tous services `healthy` en < 60s

- [ ] **Task 2 — Créer `infra/docker-compose/docker-compose.test.yml`** (AC: #2)
  - [ ] 2.1 — Variante avec volumes anonymes + tmpfs Postgres
  - [ ] 2.2 — Ports random pour coexistence (5433, 4223, 8081, 7701, 6380)
  - [ ] 2.3 — Healthchecks plus agressifs (interval 2s, retries 5)
  - [ ] 2.4 — Profil `slow-services` pour Keycloak optionnel
  - [ ] 2.5 — Network séparé `tukio_test_network`

- [ ] **Task 3 — Créer `infra/scripts/bootstrap-databases.sh`** (AC: #4, #12)
  - [ ] 3.1 — Bash POSIX, shebang `#!/usr/bin/env bash`, `set -euo pipefail`
  - [ ] 3.2 — Pré-req check `pg_isready` (sortir avec message clair sinon)
  - [ ] 3.3 — Boucle sur 11 DBs (10 Tukio + Keycloak) avec pattern idempotent `SELECT 'CREATE DATABASE...' WHERE NOT EXISTS ... \gexec`
  - [ ] 3.4 — Boucle sur 10 services Tukio : check si `apps/<svc>/src/infrastructure/persistence/typeorm/migrations/` exists → run `pnpm --filter=<svc> migration:run`
  - [ ] 3.5 — Permissions : `GRANT ALL PRIVILEGES ON DATABASE tukio_<svc> TO tukio` pour chacune
  - [ ] 3.6 — Tests : run 2× → idempotent

- [ ] **Task 4 — Créer `infra/scripts/bootstrap-keycloak-realm.sh`** (AC: #3, #12)
  - [ ] 4.1 — Pré-req check Keycloak healthy
  - [ ] 4.2 — Authentification admin via `kcadm.sh config credentials --server http://localhost:8080 --realm master --user admin --password admin` (utilise `kcadm.sh` du container Keycloak via `docker exec`)
  - [ ] 4.3 — Test existence realm `tukio` → create ou update
  - [ ] 4.4 — Configuration realm complète (cf. AC3 spec exhaustive — internationalization, password policy, brute force protection, etc.)
  - [ ] 4.5 — Création/update 5 rôles realm-level
  - [ ] 4.6 — Création/update 4 clients OIDC avec PKCE S256 + redirect URIs corrects
  - [ ] 4.7 — Configuration MFA TOTP authenticator pour `tukio-admin`
  - [ ] 4.8 — Output structuré (✅ logs par étape)
  - [ ] 4.9 — Tests : run 2× → idempotent

- [ ] **Task 5 — Créer `infra/scripts/seed-categories.ts`** (AC: #5, #12)
  - [ ] 5.1 — TypeScript strict, exécuté via `tsx infra/scripts/seed-categories.ts`
  - [ ] 5.2 — Connexion `pg` ou TypeORM DataSource vers `tukio_catalog`
  - [ ] 5.3 — Définir 2 catégories pilotes MVP avec sub-cats + service types (cf. AC5)
  - [ ] 5.4 — Idempotent : check `SELECT EXISTS` avant INSERT pour chaque entité
  - [ ] 5.5 — Translations dans `category_translations` (FR + EN par catégorie)
  - [ ] 5.6 — Cleanup : fermer connexion + log résumé final

- [ ] **Task 6 — Créer `infra/scripts/run-chaos-tests.sh`** (AC: #6)
  - [ ] 6.1 — Démarrer `docker-compose.test.yml --profile slow-services`
  - [ ] 6.2 — Run `pnpm --filter='@tukio/messaging' test --testNamePattern='@chaos'` + `pnpm --filter=identity-svc test:chaos` (etc.)
  - [ ] 6.3 — Cleanup `trap cleanup EXIT` → `docker compose down -v`
  - [ ] 6.4 — Exit code 0 si tous OK, 1 sinon

- [ ] **Task 7 — Mettre à jour `package.json` racine avec scripts `pnpm docker:*`** (AC: #7)
  - [ ] 7.1 — Ajouter scripts `docker:up`, `docker:up:wait`, `docker:down`, `docker:down:volumes`, `docker:logs`, `docker:reset`, `docker:bootstrap`, `docker:test:up`, `docker:test:down`, `seed:categories`, `chaos:test`
  - [ ] 7.2 — Vérifier `pnpm docker:up:wait` retourne exit 0 + tous services healthy

- [ ] **Task 8 — Créer/mettre à jour `.env.example` racine + 10 services** (AC: #9)
  - [ ] 8.1 — Créer `.env.example` racine avec env vars partagées (Keycloak admin, Meili master key, etc.)
  - [ ] 8.2 — Pour chaque service backend (`apps/{gateway-api,identity-svc,catalog-svc,booking-svc,order-svc,payment-svc,messaging-svc,review-svc,notification-svc,media-svc}/.env.example`), updater avec `DB_HOST=localhost`, ports, `NATS_URL`, `KEYCLOAK_URL`, `REDIS_URL`, `MEILI_URL`, `SMTP_HOST`/`SMTP_PORT`/`SMTP_FROM` (MailHog dev)

- [ ] **Task 9 — Créer documentation README** (AC: #8)
  - [ ] 9.1 — `infra/docker-compose/README.md` détaillé (cf. AC8 Quick Start)
  - [ ] 9.2 — Mettre à jour `README.md` racine pour pointer vers `infra/docker-compose/README.md` + section Quick Start condensée
  - [ ] 9.3 — Section Troubleshooting commune (Docker disk full, port conflict, Keycloak boot lent, etc.)

- [ ] **Task 10 — Exporter `realm-export.json` après bootstrap** (AC: #11)
  - [ ] 10.1 — Lancer `bootstrap-keycloak-realm.sh` → realm provisionné
  - [ ] 10.2 — `kcadm.sh get realms/tukio --include-users false > infra/scripts/keycloak/realm-export.json` (export sans users — uniquement config realm + clients + roles)
  - [ ] 10.3 — Versionner ce fichier dans Git (cohérent Story 0.9 testcontainers Keycloak helper consume)

- [ ] **Task 11 — Tests E2E identity-svc contre vraie infra** (AC: #10)
  - [ ] 11.1 — `pnpm docker:up:wait && pnpm docker:bootstrap` (préparation)
  - [ ] 11.2 — `pnpm --filter=identity-svc migration:run` (créer tables `user_profiles`, `outbox`, `inbox` dans `tukio_identity`)
  - [ ] 11.3 — `pnpm --filter=identity-svc test:e2e` → vérifier que les tests E2E Stories 0.6 + 0.8 passent (mockés via nock peuvent rester pour rapidité ; test E2E `realkc` Story 0.8 task 13 doit passer contre vrai Keycloak)
  - [ ] 11.4 — `pnpm --filter=identity-svc dev` → vérifier startup OK (logs structured Pino), `curl http://localhost:4001/health` retourne 200, `curl http://localhost:4001/v1/users/abc` retourne 401 enveloppé (KeycloakJwtGuard valide contre vrai JWKS Keycloak local)

- [ ] **Task 12 — Smoke test final + commit** (AC: tous)
  - [ ] 12.1 — Cleanup local : `pnpm docker:down:volumes` (test depart fresh)
  - [ ] 12.2 — Time : `time pnpm docker:up:wait` → < 60s
  - [ ] 12.3 — Time : `time pnpm docker:bootstrap` → < 15s
  - [ ] 12.4 — Time : total `pnpm install + docker:up:wait + docker:bootstrap + dev startup` → < 5 minutes (cohérent AC8 Quick Start promise)
  - [ ] 12.5 — Vérifier UIs : `curl http://localhost:8025` (MailHog), `curl http://localhost:8080` (Keycloak admin), `curl http://localhost:8222` (NATS monitoring)
  - [ ] 12.6 — `pnpm docker:reset` → cleanup + redémarrage complet OK
  - [ ] 12.7 — Commit `feat(infra): docker-compose dev local complet (PG/NATS/Keycloak/Meilisearch/Redis/MailHog) + 4 bootstrap scripts idempotents + onboarding 5min` — Story 0.10 done

## Dev Notes

### Pourquoi cette story est la 10ᵉ — contexte stratégique

> **Sources canoniques** : Architecture lignes 122-130 (stack figée), 482-485 (infra/docker-compose mention), 552 (Docker Compose à câbler Sprint 0), 2052-2053 (structure infra/), 2460 (`pnpm docker:up` script référencé), 2786 (mkdir infra structure).

Stories 0.6/0.7/0.8/0.9 ont posé toutes les libs + 1 service backend (identity-svc) avec deps vers PG/NATS/Keycloak/Meilisearch/Redis. **Sans Story 0.10, aucune de ces stories ne peut être réellement testée end-to-end** : Story 0.6 OutboxRelayService a besoin d'un vrai PG + NATS, Story 0.8 KeycloakJwtGuard a besoin d'un vrai Keycloak, Story 0.9 testcontainers helpers ont besoin d'un Docker daemon UP.

**Story 0.10 débloque la productivité** : un nouveau dev clone le repo et est productif en 5 minutes. Avant Story 0.10, il fallait soit (a) configurer manuellement chaque service local (galère 1-2 jours), (b) utiliser un cloud dev (lent + coûteux), (c) attendre que tout soit en staging (frustrant).

**C'est aussi le pre-requis Story 0.11 (CI)** : la CI utilise `docker-compose.test.yml` pour les tests d'intégration cross-service.

### Versions à utiliser (latest stable au moment du Sprint 0)

| Service | Image Docker | Version | Rationale |
|---|---|---|---|
| **Postgres** | `postgres:16-alpine` | 16.x latest | Cohérent Architecture ligne 602 + Story 0.6 DataSource |
| **NATS JetStream** | `nats:2.10-alpine` | 2.10+ | Architecture ligne 123 explicite |
| **Keycloak** | `quay.io/keycloak/keycloak:25.0` | 25.0+ | Architecture ligne 122/669 + Phasetwo prod compat |
| **Meilisearch** | `getmeili/meilisearch:v1.x` | latest stable v1 | Architecture ligne 125 |
| **Redis** | `redis:7-alpine` | 7.x | Cohérent Upstash compat (Architecture ligne 129) |
| **MailHog** | `mailhog/mailhog:latest` | n/a | Stand-in Resend en dev (Architecture ligne 128 mention prod Resend) |
| **Docker Compose** | n/a | 2.x+ (`docker compose` plugin, pas `docker-compose` legacy) | Standard 2025+ |

> ⚠️ **`docker compose` (v2 plugin) vs `docker-compose` (v1 standalone)** : utiliser **toujours** `docker compose` (espace, pas tiret) — la v2 est le standard 2025+, v1 est deprecated. Tous les scripts utilisent `docker compose`, pas `docker-compose`.
>
> ⚠️ **Keycloak 25 vs Keycloak 26** : Architecture mentionne Keycloak 25 (Phasetwo MVP). Si Keycloak 26 est disponible au moment du dev, **vérifier compat** avec Phasetwo managé prod (le Phasetwo support typiquement 1-2 versions derrière). Si Phasetwo en est à v25, garder v25 en dev pour parité prod.
>
> ⚠️ **Meilisearch v1.x vs v2.x** : si Meilisearch v2 disponible, vérifier compat SDK `meilisearch` npm package (Story 0.9 testcontainers + Stories Epic 3 catalog-svc consument).

### Project Structure cible

```
infra/
├─ docker-compose/
│  ├─ docker-compose.dev.yml                       # ← cette story (6 services + healthchecks)
│  ├─ docker-compose.test.yml                      # ← cette story (variante CI)
│  └─ README.md                                    # Quick Start + Troubleshooting
└─ scripts/
   ├─ bootstrap-databases.sh                       # 10 DBs Tukio + Keycloak DB + migrations
   ├─ bootstrap-keycloak-realm.sh                  # realm tukio + 4 clients + 5 rôles + MFA
   ├─ seed-categories.ts                           # 2 catégories pilotes MVP
   ├─ run-chaos-tests.sh                           # orchestre chaos tests Stories 0.7+0.9
   └─ keycloak/
      └─ realm-export.json                         # ← export après bootstrap, versionné Git
```

```
apps/<service>/.env.example                       # ← UPDATE — hostnames Docker Compose
.env.example                                       # ← CREATE — env vars racine partagées
README.md                                          # ← UPDATE — section Quick Start
```

### Pattern code — `docker-compose.dev.yml` (squelette structure)

> Le dev agent doit produire un fichier complet de ~150-200 lignes YAML. Voici le squelette de référence.

```yaml
version: '3.9'

services:
  postgres:
    image: postgres:16-alpine
    container_name: tukio_postgres
    environment:
      POSTGRES_USER: tukio
      POSTGRES_PASSWORD: tukio_dev_password
      POSTGRES_DB: tukio_meta
    ports:
      - "5432:5432"
    volumes:
      - tukio_postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U tukio"]
      interval: 5s
      timeout: 5s
      retries: 10
    networks:
      - tukio_dev_network

  nats:
    image: nats:2.10-alpine
    container_name: tukio_nats
    command: ["-js", "-m", "8222", "--store_dir=/data"]
    ports:
      - "4222:4222"
      - "8222:8222"
    volumes:
      - tukio_nats_data:/data
    healthcheck:
      test: ["CMD-SHELL", "wget -q -O- http://localhost:8222/healthz | grep -q 'ok'"]
      interval: 5s
      timeout: 5s
      retries: 10
    networks:
      - tukio_dev_network

  keycloak:
    image: quay.io/keycloak/keycloak:25.0
    container_name: tukio_keycloak
    environment:
      KC_BOOTSTRAP_ADMIN_USERNAME: admin
      KC_BOOTSTRAP_ADMIN_PASSWORD: admin
      KC_DB: postgres
      KC_DB_URL: jdbc:postgresql://postgres:5432/keycloak
      KC_DB_USERNAME: tukio
      KC_DB_PASSWORD: tukio_dev_password
      KC_HOSTNAME: localhost
      KC_HTTP_ENABLED: "true"
      KC_HEALTH_ENABLED: "true"
    command: ["start-dev"]
    ports:
      - "8080:8080"
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:8080/health/ready || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 12
      start_period: 30s
    networks:
      - tukio_dev_network

  meilisearch:
    image: getmeili/meilisearch:v1.13
    container_name: tukio_meilisearch
    environment:
      MEILI_MASTER_KEY: tukio_dev_master_key_change_in_prod
      MEILI_ENV: development
    ports:
      - "7700:7700"
    volumes:
      - tukio_meilisearch_data:/meili_data
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:7700/health || exit 1"]
      interval: 5s
      timeout: 5s
      retries: 10
    networks:
      - tukio_dev_network

  redis:
    image: redis:7-alpine
    container_name: tukio_redis
    command: ["redis-server", "--appendonly", "yes"]
    ports:
      - "6379:6379"
    volumes:
      - tukio_redis_data:/data
    healthcheck:
      test: ["CMD-SHELL", "redis-cli ping | grep -q PONG"]
      interval: 5s
      timeout: 5s
      retries: 10
    networks:
      - tukio_dev_network

  mailhog:
    image: mailhog/mailhog:latest
    container_name: tukio_mailhog
    ports:
      - "1025:1025"  # SMTP
      - "8025:8025"  # Web UI
    networks:
      - tukio_dev_network

volumes:
  tukio_postgres_data:
  tukio_nats_data:
  tukio_meilisearch_data:
  tukio_redis_data:

networks:
  tukio_dev_network:
    driver: bridge
```

### Pattern code — `bootstrap-databases.sh` (squelette)

```bash
#!/usr/bin/env bash
set -euo pipefail

PG_HOST="${PG_HOST:-localhost}"
PG_PORT="${PG_PORT:-5432}"
PG_USER="${PG_USER:-tukio}"
PG_PASSWORD="${PG_PASSWORD:-tukio_dev_password}"
export PGPASSWORD="$PG_PASSWORD"

# Préreq check
if ! pg_isready -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -q; then
  echo "❌ Postgres not ready at $PG_HOST:$PG_PORT. Run 'pnpm docker:up:wait' first."
  exit 1
fi

DBS=(
  "keycloak"
  "tukio_identity"
  "tukio_catalog"
  "tukio_booking"
  "tukio_order"
  "tukio_payment"
  "tukio_messaging"
  "tukio_review"
  "tukio_notification"
  "tukio_media"
  "tukio_meta"
)

echo "📦 Creating databases..."
for db in "${DBS[@]}"; do
  psql -h "$PG_HOST" -U "$PG_USER" -d postgres -tAc \
    "SELECT 1 FROM pg_database WHERE datname='$db'" | grep -q 1 \
    || psql -h "$PG_HOST" -U "$PG_USER" -d postgres -c "CREATE DATABASE \"$db\""
  psql -h "$PG_HOST" -U "$PG_USER" -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE \"$db\" TO $PG_USER"
  echo "  ✅ $db"
done

# Run migrations per service
SERVICES=(identity-svc catalog-svc booking-svc order-svc payment-svc messaging-svc review-svc notification-svc media-svc)

echo "🔧 Running migrations..."
for svc in "${SERVICES[@]}"; do
  if [ -d "apps/$svc/src/infrastructure/persistence/typeorm/migrations" ]; then
    echo "  ⏳ Running migrations for $svc..."
    pnpm --filter="$svc" migration:run || echo "  ⚠️  No migrations or already up to date for $svc"
  fi
done

echo "✅ Databases bootstrapped successfully"
```

### Critical Architecture Constraints

> Cf. Architecture lignes 121-131 (stack figée) + memories `feedback_*.md`.

1. **Versions images Docker exactes** : pas de `:latest` floating tag (sauf MailHog), toujours version explicite pour reproductibilité (`postgres:16-alpine`, `nats:2.10-alpine`, etc.)
2. **Healthchecks stricts non négociables** : sinon `depends_on: condition: service_healthy` ne peut pas garantir l'ordre de boot. Particulièrement critique pour Keycloak (boot lent ~20-30s) → start_period 30s + retries 12.
3. **PG dans 1 instance physique avec 10 DBs logiques** : cohérent Architecture ligne 602 (database-per-service mais 1 instance MVP). V1+ split en instances séparées si scaling.
4. **Volumes nommés en dev (persistence) vs anonymous + tmpfs en test (perf)** : pattern standard CI.
5. **Network bridge dédié** (`tukio_dev_network`) : permet la résolution DNS inter-containers (`postgres`, `nats`, `keycloak` comme hostnames). Crucial pour Keycloak qui doit accéder à Postgres via DNS interne.
6. **Idempotence stricte** : tous les scripts (`bootstrap-databases.sh`, `bootstrap-keycloak-realm.sh`, `seed-categories.ts`) DOIVENT être appelables 2× sans erreur ni effet de bord. Pattern : check existence → skip si exists, ou `update` au lieu de `create`.
7. **PKCE S256 obligatoire** sur les 4 clients OIDC (cohérent NFR sécurité Story 0.8). Pas de `directAccessGrantsEnabled: true` (password grant deprecated).
8. **MFA TOTP `tukio-admin`** : configuration via `kcadm.sh authentication add-execution` pour ajouter OTP au flow `browser` (cohérent NFR12 + FR9).
9. **Resend prod credentials JAMAIS en `.env.example`** : MailHog en dev, Resend en V0+ via Doppler (Architecture ligne 690).
10. **Bash POSIX strict** : pas de zsh-isms, compatible macOS BSD utils + Linux GNU. Tester sur les 2 plateformes.

### What this story does NOT do (out of scope)

- ❌ **Provision Keycloak realm V1+ avec social login** (Google OAuth) → Story Epic 1+ (FR5 V1)
- ❌ **Stripe local CLI / Stripe sandbox setup** → Story 4.5 (Stripe checkout)
- ❌ **Cloudflare R2 mock local** (tests media-svc) → Story 3.4 (photo upload — utilise Cloudflare R2 sandbox prod ou mock S3 type MinIO)
- ❌ **MeiliSearch search index initialization** → Story 3.7 (Meilisearch index per locale)
- ❌ **Seed test users dans Keycloak** (admin, customer, pro de demo) → Stories Epic 1+ stories spécifiques OU script optionnel `seed-users.sh` séparé
- ❌ **Docker Compose pour les services NestJS eux-mêmes** (Dockerfile multi-stage build) → Story 0.12 (K8s + Helm). Au MVP dev, services NestJS tournent en `pnpm dev` sur l'host.
- ❌ **Production-grade docker-compose.prod.yml** → Story 0.12 (K8s remplace Docker Compose en prod)
- ❌ **Backups Postgres dev** → V1+
- ❌ **Volumes externes mountés** (ex code source en bind mount) → MVP utilise volumes nommés Docker (perf + isolation)
- ❌ **Devcontainer VS Code config** → V1+ (devcontainer.json optionnel)

### Files to UPDATE vs CREATE

> **À UPDATE** :
> - `package.json` racine — ajouter scripts `pnpm docker:*` (cf. AC7)
> - `README.md` racine — ajouter section Quick Start
> - `apps/<svc>/.env.example` (× 10 services) — ajouter env vars hostnames Docker Compose
> - `apps/identity-svc/test/user.e2e-spec.ts` (Stories 0.6 + 0.8) — vérifier toujours fonctionnel contre vraie infra (peut nécessiter ajustements env vars)

> **À CREATE** :
> - `infra/docker-compose/docker-compose.dev.yml` (~200 lignes YAML)
> - `infra/docker-compose/docker-compose.test.yml` (~150 lignes YAML)
> - `infra/docker-compose/README.md`
> - `infra/scripts/bootstrap-databases.sh`
> - `infra/scripts/bootstrap-keycloak-realm.sh`
> - `infra/scripts/seed-categories.ts`
> - `infra/scripts/run-chaos-tests.sh`
> - `infra/scripts/keycloak/realm-export.json` (généré post-bootstrap)
> - `.env.example` racine
> - **Estimation total fichiers créés/modifiés** : ~20 fichiers (peu nombreux mais denses)

### Previous Story Intelligence (Stories 0.1 → 0.9)

**Story 0.1** : `package.json` racine avec scripts `dev`, `lint`, `typecheck`, `test`, `format`. Story 0.10 ajoute les scripts `docker:*` et `seed:categories` et `chaos:test`.

**Story 0.6** : `apps/identity-svc/.env.example` avec `DB_HOST=localhost`, `DB_USER=tukio_identity_user`, `DB_NAME=tukio_identity`. **Story 0.10 ajuste** : `DB_USER=tukio` (1 user pour toutes les DBs au MVP, simplifie). Migration baseline `1715200000000-CreateUserProfilesBaseline.ts` utilise ces env vars → joué par `bootstrap-databases.sh`.

**Story 0.7** : `OutboxRelayService` PG LISTEN/NOTIFY connection dédiée + migration `1715210000000-AddOutboxInboxTables.ts`. Story 0.10 `bootstrap-databases.sh` joue cette migration sur `tukio_identity`. NATS_URL env var consommée.

**Story 0.8** : `KEYCLOAK_URL=http://localhost:8080`, `KEYCLOAK_REALM=tukio`, `KEYCLOAK_CLIENT_ID=tukio-api` env vars consommées. Bootstrap-keycloak-realm.sh provisionne ces clients.

**Story 0.9** : `@tukio/testing` testcontainers helpers (PG/NATS/Keycloak/Meilisearch/Redis) — alignés sur les **mêmes versions** que Docker Compose Story 0.10 (cohérence dev local ↔ tests CI). Le `realm-export.json` Story 0.10 est consommé par `startKeycloakContainer({ importJsonPath: 'infra/scripts/keycloak/realm-export.json' })` Story 0.9.

### Conventions à respecter (rappel)

| Convention | Règle | Application Story 0.10 |
|---|---|---|
| EN strict | tous les fichiers + variables en EN | ✅ |
| Naming DBs | `tukio_<service>` | ✅ (10 DBs) |
| Idempotence scripts | callable 2× sans erreur | ✅ AC12 |
| Bash POSIX | compatible macOS + Linux | ✅ tous scripts |
| `docker compose` (v2 plugin) | jamais `docker-compose` legacy | ✅ |
| Healthchecks stricts | `service_healthy` condition | ✅ AC1 |
| Volumes nommés en dev | persistence | ✅ AC1 |
| Anonymous volumes + tmpfs en test | perf CI | ✅ AC2 |
| `realm-export.json` versionné Git | source of truth realm config | ✅ AC11 |
| `.env.example` per-service updated | hostnames cohérents | ✅ AC9 |
| Quick Start < 5 minutes | onboarding nouveau dev | ✅ AC8 |

### Testing Standards

- **Pas de tests unitaires** sur Story 0.10 (scripts shell + YAML, pas de logique applicative testable).
- **Tests d'acceptance manuels** :
  - `pnpm docker:up:wait` → < 60s, tous services `healthy`
  - `pnpm docker:bootstrap` → < 15s, idempotent (run 2× OK)
  - `pnpm docker:reset` → cleanup + recreation OK en < 90s
  - `pnpm --filter=identity-svc test:e2e` → passe contre vraie infra
- **Tests E2E preparés** (livrés Stories Epic 1+) : `apps/identity-svc/test/outbox.e2e-spec.ts` Story 0.7 task 9.7 réactivable maintenant que stack réel dispo.

### Project Structure Notes

✅ **Aligné** avec Architecture lignes 2052-2053 (`infra/docker-compose/{docker-compose.dev.yml,docker-compose.test.yml}` + `infra/scripts/{bootstrap-keycloak-realm,bootstrap-databases,seed-categories,run-chaos-tests}.sh`).

✅ **Aligné** avec Architecture ligne 2460 (`pnpm docker:up` script référencé).

✅ **Cohérent** versions stack avec Stories 0.6/0.7/0.8/0.9 (PG 16, NATS 2.10, Keycloak 25, Meilisearch v1, Redis 7).

⚠️ **Décision documentée** : services NestJS tournent **en `pnpm dev` sur l'host**, pas en containers Docker au MVP dev. Justification : (1) `pnpm dev` Turborepo a HMR + watch mode rapide, perdu en container ; (2) volumes bind mounts cross-platform Docker ralentissent lecture (macOS Docker Desktop file system performance issues bien documentés). En prod (Story 0.12 K8s), services tournent en containers via Helm.

⚠️ **Décision documentée** : Keycloak utilise sa propre DB `keycloak` dans la même instance Postgres (économie ressources dev). En prod, Keycloak Phasetwo managé a sa propre DB séparée (Architecture ligne 122 `Phasetwo managé MVP`). Documenter dans le commit que la DB `keycloak` côté Tukio est uniquement pour le **dev local** ; en staging/prod, Phasetwo gère sa propre infra.

⚠️ **Décision documentée** : Resend mocké via MailHog au dev. Pour les tests E2E qui vérifient l'envoi d'email, utiliser MailHog API `http://localhost:8025/api/v2/messages` qui retourne tous les emails reçus (cohérent Story 5.4 V1 templates Resend FR/EN). En prod, Resend remplace MailHog (config via env var `SMTP_HOST=smtp.resend.com`).

⚠️ **Décision documentée** : `realm-export.json` est exporté **après** le premier bootstrap réussi et **versionné Git** (cohérent Story 0.9 testcontainers Keycloak helper consume). Si le realm config évolue (Story Epic 1+ ajoute des Identity Providers, des claims customs, etc.), **re-export obligatoire** + commit.

⚠️ **À noter** : le bootstrap script Keycloak utilise `kcadm.sh` du container Keycloak via `docker exec tukio_keycloak /opt/keycloak/bin/kcadm.sh ...`. Cette dépendance container-name est explicite et robuste (vs un `kcadm.sh` standalone qui demanderait d'installer Keycloak CLI sur l'host).

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Stack-figée — Lines 121-131 (Postgres 16, NATS 2.10, Keycloak 25, Meilisearch, Redis Upstash, Resend)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Selected-Starter-Infra — Lines 482-485 (mkdir infra structure)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Détail-Apps-Services — Lines 2052-2053 (`infra/docker-compose/{dev,test}.yml` + scripts)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Development-Workflow — Lines 2460 (`pnpm docker:up` script + 6 services référencés)]
- [Source: _bmad-output/planning-artifacts/architecture.md#What-Starters-Do-NOT-Provide — Line 552 (Docker Compose dev local à câbler Sprint 0)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Authentication-Security — Lines 665-697 (Keycloak realm config, 5 rôles, 4 clients, MFA admin)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Database — Lines 600-606 (PG 16, 1 instance + 10 DBs MVP)]
- [Source: _bmad-output/planning-artifacts/epics.md#Story-0.10 — Lines 1002-1015 (6 ACs originaux : Docker Compose 6 services, 3 bootstrap scripts, MailHog, 4 frontends + 10 services connectés)]
- [Source: _bmad-output/planning-artifacts/prd.md#Pilotes-MVP — 2 catégories tentes/chapiteaux + mobilier événementiel (cohérent seed-categories.ts)]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR12 — MFA TOTP admin obligatoire (cohérent bootstrap-keycloak-realm tukio-admin client)]
- [Source: _bmad-output/planning-artifacts/prd.md#FR9 — Admin 2FA TOTP (cohérent même)]
- [Source: _bmad-output/implementation-artifacts/0-6-pattern-pretre-scaffolding-template-identity-svc.md — Story 0.6 dev context (DataSource env vars, migration baseline `tukio_identity`)]
- [Source: _bmad-output/implementation-artifacts/0-7-setup-tukio-messaging-nats-jetstream.md — Story 0.7 dev context (NATS_URL, migration outbox/inbox)]
- [Source: _bmad-output/implementation-artifacts/0-8-setup-tukio-auth-backend-frontend.md — Story 0.8 dev context (KEYCLOAK_URL, 4 clients, 5 rôles, MFA admin)]
- [Source: _bmad-output/implementation-artifacts/0-9-setup-tukio-api-client-i18n-client-testing.md — Story 0.9 dev context (testcontainers helpers alignés sur mêmes versions, realm-export.json consommé)]
- [External: https://hub.docker.com/_/postgres (Postgres 16-alpine image)]
- [External: https://hub.docker.com/_/nats (NATS 2.10-alpine image)]
- [External: https://quay.io/repository/keycloak/keycloak (Keycloak 25.0 image)]
- [External: https://hub.docker.com/r/getmeili/meilisearch (Meilisearch v1.x image)]
- [External: https://hub.docker.com/_/redis (Redis 7-alpine image)]
- [External: https://hub.docker.com/r/mailhog/mailhog (MailHog image)]
- [External: https://www.keycloak.org/server/configuration-cli (kcadm.sh CLI reference for bootstrap script)]
- [External: https://www.postgresql.org/docs/16/sql-createdatabase.html (Postgres 16 CREATE DATABASE syntax)]
- [Memory: feedback_latest_versions.md — vérifier `pnpm view <pkg> version` pour SDK alignement]
- [Memory: feedback_tech_layer_english.md — naming DBs/scripts/vars EN strict]

## Dev Agent Record

### Agent Model Used

(à remplir par le dev agent)

### Debug Log References

(à remplir — versions exactes images Docker retenues, decisions Keycloak 25 vs 26, decisions Meilisearch v1 vs v2, problèmes éventuels boot Keycloak slow, solutions cross-platform Bash macOS + Linux)

### Completion Notes List

(à remplir — résumé décisions, déviations, points d'attention pour Story 0.11 (CI utilise docker-compose.test.yml), Story 0.12 (K8s remplace Docker Compose en prod), Stories Epic 1+ qui consomment l'infra dev)

### File List

(à remplir)

---

## Story Completion Status

- **Story Status** : `ready-for-dev`
- **Created** : 2026-05-09
- **Created by** : `bmad-create-story` workflow
- **Epic** : Epic 0 — Sprint 0 Foundation (MVP, foundational)
- **Sprint cible** : Sprint 0 (semaines 1-3 du planning MVP)
- **Estimation effort** : 2-3 jours (~20 fichiers denses : Docker Compose YAML + 4 scripts shell/TS + README + .env.example × 10 services)
- **Dépendances upstream** :
  - Story 0.1 (`ready-for-dev`) — `package.json` racine + structure `infra/`
  - Story 0.6 (`ready-for-dev`) — migration `tukio_identity` baseline (joué par bootstrap-databases)
  - Story 0.7 (`ready-for-dev`) — migration `outbox/inbox` (joué par bootstrap-databases)
  - Story 0.8 (`ready-for-dev`) — `tukio-api` + `tukio-web` + `tukio-admin` + `tukio-mobile` clients spécifiés (provisionnés par bootstrap-keycloak)
- **Dépendances downstream** :
  - **Story 0.9** (`@tukio/testing`) — testcontainers helpers utilisent **mêmes versions** images Docker que Story 0.10 (synchro versions critique)
  - **Story 0.11** (CI) — utilise `docker-compose.test.yml` pour tests d'intégration
  - **Story 0.12** (K8s + Helm) — remplace Docker Compose en staging/prod, mais Docker Compose reste pour dev local
  - **Stories Epic 1+ (toutes)** — consomment l'infra dev (PG/NATS/Keycloak/Meilisearch/Redis local)
  - **Tests E2E identity-svc Story 0.7 task 9.7 (`outbox.e2e-spec`)** — réactivable maintenant que stack réel dispo
- **FRs covered** : aucun FR direct (foundational, prerequis to all dev productivity)
- **NFRs touchés** :
  - **NFR67** — patterns infra figés (Docker Compose comme dev environment standard)
  - **NFR74** — naming + scripts conventions enforced ✅
  - **R12 + R13** — chaos tests setup permettant de valider mitigation NATS/outbox
  - **MFA admin (NFR12 + FR9)** — préparé via `tukio-admin` client TOTP requis ✅
