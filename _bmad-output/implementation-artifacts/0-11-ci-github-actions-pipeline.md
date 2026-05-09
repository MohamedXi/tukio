# Story 0.11: CI GitHub Actions pipeline (lint + typecheck + tests affected + Lighthouse 4 apps)

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

**As a** tech lead (équipe Sprint 0),
**I want** **5 workflows GitHub Actions** orchestrant le cycle complet PR → merge → tag : (1) `ci.yml` exécute sur **chaque PR** lint + typecheck + tests affected (Turborepo `--filter=...[origin/main]`) + coverage upload, (2) `lighthouse-ci.yml` Lighthouse + axe-core sur les 4 apps frontend (CWV + a11y ≥ 90, bloquant — NFR54), (3) `build-images.yml` build + push Docker images des 10 services vers `ghcr.io` au merge `main`, (4) `deploy-staging.yml` trigger ArgoCD sync staging Hetzner au merge `main` (placeholder Story 0.12 finalise), (5) `deploy-production.yml` trigger ArgoCD prod sur tag `v*` (placeholder Story 0.12) ; **8 lint rules custom finalisées** dans `eslint-plugin-tukio` (`no-fr-paths`, `no-hardcoded-text`, `no-class-validator`, `error-code-format`, `no-buyer`, `no-bypass-envelope`, `no-pure-black-white`, et **promotion de `warn` à `error` des rules existantes** Stories 0.2/0.3/0.7) ; **Dependabot configuré** avec scan CVE bloquant (NFR18) ; **Turborepo cache distribué** via `actions/cache` (perf CI critique — sinon 10× plus lent),
**so that** chaque PR est validée automatiquement avant merge sans friction (CI < 5 min sur affected-builds), aucune régression Core Web Vitals (RA1 SEO mitigation), aucune introduction de texte FR hardcoded ou path URL FR (i18n NFR56-58 enforced), aucune CVE critique non patchable bloque le merge (NFR18), les 10 images Docker sont versionnées par commit SHA dans `ghcr.io` prêtes pour déploiement K8s (Story 0.12), et le pipeline complet PR → merge → staging deploy → prod deploy est documenté + testé end-to-end.

> **Outcome attendu** : à la fin de cette story, ouvrir une PR qui modifie `apps/customer/src/features/dashboard/Dashboard.tsx` déclenche en < 5 min : (1) lint passe (`tukio/no-hardcoded-text` vérifie aucun string hardcodé), (2) typecheck passe, (3) tests Vitest apps/customer passent (Turborepo affected = uniquement customer + ses deps `@tukio/ui` + `@tukio/i18n-client`), (4) Lighthouse CI sur `apps/customer` retourne LCP/INP/CLS/score 90+ (cf. NFR5/54), (5) coverage upload Codecov montre delta. Si l'un échoue → PR bloquée, comment GitHub clair indique la cause. Au merge `main` → 10 Docker images buildées + pushées `ghcr.io/<org>/tukio/<service>:<sha>` + ArgoCD trigger staging.

## Acceptance Criteria

1. **AC1 — Workflow `.github/workflows/ci.yml` (PR validation)** : Given une PR ouverte sur `main` qui modifie `apps/customer/`, When la CI tourne, Then **uniquement les jobs affected** (Turborepo `--filter=...[origin/main]`) s'exécutent en parallèle : lint apps/customer + typecheck apps/customer + tests Vitest apps/customer + Lighthouse CI apps/customer. **Workflow détaillé** :
   - **Triggers** : `on: pull_request: { branches: [main], paths-ignore: ['**.md', 'docs/**'] }` + `on: push: { branches: [main] }` (post-merge sanity check)
   - **Job `setup`** : checkout (`actions/checkout@v4` + `fetch-depth: 0` pour Turborepo affected detection), setup Node 22 (`actions/setup-node@v4` + `node-version-file: '.nvmrc'`), setup pnpm (`pnpm/action-setup@v4` avec version pinned `package.json#packageManager`), restore pnpm cache (`actions/cache@v4` keyed sur `pnpm-lock.yaml` hash), `pnpm install --frozen-lockfile`, restore Turborepo cache (`actions/cache@v4` keyed sur `turbo` cache directory)
   - **Jobs parallèles** (matrix optionnel sur task) : `lint`, `typecheck`, `test`, `build` — chacun lance `pnpm <task> -- --filter=...[origin/main]` (Turborepo affected detection vs main branch)
   - **Coverage upload** : après `test`, upload coverage report vers Codecov (`codecov/codecov-action@v4`) avec token secret + flag par workspace
   - **Concurrency control** : `concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }` (cancel runs précédents si nouvelle push sur même PR — économise crédits CI)
   - **Permissions** : `contents: read`, `pull-requests: write` (pour comment delta coverage), `actions: read`
   - **Timeout** : `timeout-minutes: 15` (fail-fast si > 15 min — indicateur de pb perf)

2. **AC2 — Workflow `.github/workflows/lighthouse-ci.yml`** : Given une PR qui modifie `apps/{public,customer,seller,admin}/`, When le workflow tourne, Then Lighthouse CI s'exécute sur les apps affected via `lhci autorun` :
   - **Trigger** : `on: pull_request: { paths: ['apps/public/**', 'apps/customer/**', 'apps/seller/**', 'apps/admin/**', 'packages/ui/**'] }` (UI changes Story 0.4/0.5 invalident aussi le score)
   - **Setup** : checkout + Node 22 + pnpm install (cohérent ci.yml setup pattern)
   - **Build** : `pnpm build --filter=...[origin/main]` (build affected apps)
   - **Démarrage des apps** : utilise `pnpm dev:public` (background) puis attend `wait-on http://localhost:3000` (timeout 60s) — repeat pour customer/seller/admin si affected
   - **Lighthouse CI** : `lhci autorun --config=.lighthouserc.json` qui exécute :
     - **Apps publiques** (`apps/public/`) : `mobile` form-factor, `desktop` form-factor — assertions strictes sur `apps/public/` (RA1 SEO critique)
     - **Apps connectées** (`customer`, `seller`, `admin`) : `mobile` form-factor seulement (less critique SEO mais a11y obligatoire)
   - **Assertions par app** dans `.lighthouserc.json` :
     - **`apps/public/` (mobile + desktop)** : `categories.performance: ≥ 0.9` (NFR5), `categories.accessibility: ≥ 0.9` (NFR54), `categories.seo: ≥ 0.95`, `audits.largest-contentful-paint: ≤ 2500` (NFR5 LCP), `audits.cumulative-layout-shift: ≤ 0.1` (NFR5 CLS), `audits.interaction-to-next-paint: ≤ 200` (NFR5 INP)
     - **`apps/{customer,seller,admin}/` (mobile)** : `categories.accessibility: ≥ 0.9`, `audits.largest-contentful-paint: ≤ 4000` (LCP relâché car SEO non-critique), `categories.performance: ≥ 0.7`
   - **Bloquant si fail** : `lhci autorun` retourne exit 1 → CI fail → PR bloquée
   - **GitHub PR Status Check** obligatoire : "Lighthouse CI" doit passer avant merge (configurer dans GitHub branch protection rules — documenté dans Dev Notes)
   - **Régression > 10 % sur `apps/public/`** : Architecture ligne 1034 mention — alerte automatique en commentaire PR si régression LCP/CLS > 10 % vs main

3. **AC3 — Lint rules custom finalisées (8 nouvelles + promotion warn → error)** : Given le plugin `eslint-plugin-tukio` (créé Story 0.2, étendu 0.3/0.7), When je l'ouvre, Then je trouve **15 rules au total** (7 existantes + 8 nouvelles), toutes en `error` (sauf exceptions documentées) :
   - **Rules existantes (Stories 0.2/0.3/0.7) — promues warn → error** :
     - `tukio/event-naming` (Story 0.2, déjà `error`) — pas de changement
     - `tukio/no-barrel-import-contracts` (Story 0.2) — `warn` → `error`
     - `tukio/no-barrel-import-ui` (Story 0.3) — `warn` → `error`
     - `tukio/no-direct-event-publish` (Story 0.7) — `warn` → `error`
   - **Rules nouvelles Story 0.11 (8)** :
     - **`tukio/no-fr-paths`** : detect `Link href="/fr/categorie/..."` ou `redirect('/fr/categorie/...')` ou tout path string littéral commençant par `/<locale>/categorie/` / `/profil/` / `/parametres/` / `/aide/` / `/recherche/` / `/panier/` (FR slugs interdits — NFR58). Autofix : suggérer slug EN équivalent (mapping `categorie → category`, `profil → profile`, `parametres → settings`, `aide → help`, `recherche → search`, `panier → cart`)
     - **`tukio/no-hardcoded-text`** : detect strings UI hardcodés dans JSX `<button>Reserver</button>`, `<p>Bonjour</p>`, attributs `aria-label="Fermer"`, `placeholder="Email"` etc. (NFR56). Heuristique : string > 2 chars, contient des lettres alphabet, n'est pas un slug technique (pas de `-` `_` `/` exclusif), pas dans une liste blanche (`{ALL: 'all'}`, `'tukio.one'`, etc.). Autofix : suggérer `useTranslations()` pattern (best-effort)
     - **`tukio/no-class-validator`** : detect `import { IsString, IsEmail, ... } from 'class-validator'` ou `@IsString()` / `@IsEmail()` decorators dans `apps/<svc>/src/infrastructure/http/dtos/`. Message : "Use Zod schema from @tukio/contracts/dtos/* instead". Pas d'autofix automatique (migration manuelle)
     - **`tukio/error-code-format`** : detect strings assignées à `tukioCode` propriété (dans `DomainException` héritées) — match regex `^[A-Z]+(-[A-Z]+)*-\d{3}$` (ex `BOOKING-CONFLICT-001`, `AUTH-FORBIDDEN-001`). Reject `'booking_conflict'`, `'BookingConflict'`, `'BOOKING-CONFLICT'` (manque NNN suffix). Cohérent Architecture lignes 1707-1715 (Error Codes Catalog)
     - **`tukio/no-buyer`** : detect identifiants `buyer`, `Buyer`, `BUYER` dans le code (variables, props, types, file names). Message : "Use 'customer' instead — see PRD §Conventions ('buyer' is forbidden in code)". Memory `feedback_tech_layer_english.md` enforce.
     - **`tukio/no-bypass-envelope`** : detect controllers backend qui retournent `response.json(...)` directement OU `response.send(...)` OR `@Res() res` injection avec call à `.json()` / `.send()`. Pattern : controllers doivent retourner DTO nu (interceptor wrap automatiquement — Story 0.6 ResponseEnvelopeInterceptor). Memory `feedback_api_envelope_response.md` enforce.
     - **`tukio/no-pure-black-white`** : detect Tailwind classes `text-black`, `text-white`, `bg-black`, `bg-white`, `border-black`, `border-white`, OR CSS values `#000`, `#fff`, `#FFFFFF`, `rgb(0,0,0)`, `rgb(255,255,255)`. Message : "Use Tukio tokens : `text-charcoal-700` (text), `bg-cream-50` (bg), `border-cream-300` (border). See @tukio/ui/styles/theme.css". Cohérent UX spec ligne 711.
     - **`tukio/require-correlation-id`** (bonus si temps) : detect outbox-publisher `.publish(event)` calls où `event.correlationId` n'est pas fourni → suggérer `correlationContext.getCorrelationId()` (Story 0.7). MVP : warn-only.
   - **Tests par rule** : `tools/eslint-plugin-tukio/__tests__/` couvre les 8 nouvelles rules (3 valid + 3 invalid par rule = 24+ tests minimum)
   - **Documentation** : `tools/eslint-plugin-tukio/README.md` documente chaque rule avec rationale + exemples bons/mauvais

4. **AC4 — Workflow `.github/workflows/build-images.yml` (merge main)** : Given un merge sur `main`, When le workflow tourne, Then Docker images sont buildées + pushées pour les 10 services backend :
   - **Trigger** : `on: push: { branches: [main], paths: ['apps/*-svc/**', 'apps/gateway-api/**', 'packages/**'] }` + `workflow_dispatch` (manual trigger)
   - **Setup** : checkout + Node 22 + pnpm install + setup Docker Buildx (`docker/setup-buildx-action@v3`) + login `ghcr.io` (`docker/login-action@v3` avec `GITHUB_TOKEN`)
   - **Détection affected services** via Turborepo : `pnpm turbo run build --filter='[origin/main^...HEAD]' --dry-run=json | jq '.tasks[].package'` → liste des services à rebuild
   - **Matrix strategy** sur les 10 services : `gateway-api`, `identity-svc`, `catalog-svc`, `booking-svc`, `order-svc`, `payment-svc`, `messaging-svc`, `review-svc`, `notification-svc`, `media-svc`
   - **Pour chaque service affecté** :
     - `pnpm --filter=<service> build` (NestJS dist)
     - `docker buildx build --platform linux/amd64 --tag ghcr.io/<org>/tukio/<service>:${{ github.sha }} --tag ghcr.io/<org>/tukio/<service>:latest --push apps/<service>/`
     - **Multi-stage Dockerfile** : `apps/<service>/Dockerfile` avec stages `builder` (`node:22-alpine` + pnpm install + build) + `runner` (`node:22-alpine` minimal + non-root user + healthcheck) — cohérent K8s Story 0.12
   - **Vulnerability scan** : `aquasecurity/trivy-action@master` scan chaque image post-build, fail si CVE `CRITICAL` détectée (NFR18 + NFR sécurité)
   - **Output** : Image digests reportés en commentaire PR / commit status (utile pour Story 0.12 ArgoCD sync)
   - **Concurrency** : `concurrency: { group: build-${{ github.ref }}, cancel-in-progress: false }` (PAS cancel-in-progress car push intermédiaires sur main ne sont pas annulables)

5. **AC5 — Workflows `.github/workflows/deploy-{staging,production}.yml`** : Given un build d'images réussi, When le déploiement tourne, Then ArgoCD sync est déclenché :
   - **`deploy-staging.yml`** :
     - **Trigger** : `on: workflow_run: { workflows: [Build Images], types: [completed], branches: [main] }` (chained avec build-images.yml)
     - **Job** : utilise `argoproj/argo-cd-action@v3` ou simple `curl` POST sur webhook ArgoCD avec token `ARGOCD_STAGING_TOKEN` (secret) → `argocd app sync tukio-staging`
     - **Validation post-deploy** : `wait-on https://staging.tukio.one/health` + smoke test E2E minimal (1 endpoint)
     - **Notification Slack** : `slackapi/slack-github-action@v2` post message dans `#tukio-deploys` (success ou failure)
   - **`deploy-production.yml`** :
     - **Trigger** : `on: push: { tags: ['v*'] }` (tag SemVer prod)
     - **Approval manuel** : utilise `environment: production` GitHub Environment qui requiert approbation manuelle d'1 reviewer (cohérent prod safety)
     - **Job** : idem staging mais cible `tukio-production` ArgoCD app + token `ARGOCD_PRODUCTION_TOKEN`
     - **Notification Slack** : post `#tukio-deploys-prod`
     - **Rollback automatique** si healthcheck post-deploy fail dans 5 min : trigger `argocd app rollback tukio-production`
   - **NB** : ces 2 workflows sont **placeholders Story 0.11** (CI logic posée). **Story 0.12** finalise avec ArgoCD config, secrets, environment variables Hetzner, etc.

6. **AC6 — `.github/dependabot.yml` configuration** : Given `.github/dependabot.yml`, When je l'ouvre, Then je trouve la config Dependabot :
   - **Ecosystem `npm`** : monitor `package.json` racine + `apps/*/package.json` + `packages/*/package.json` + `tools/eslint-plugin-tukio/package.json`, schedule `weekly`, `groups` (combine minor + patch updates en 1 PR par groupe), `target-branch: main`, `labels: ['dependencies', 'auto']`, `assignees: [<tech-lead-handle>]`, `open-pull-requests-limit: 10` (max 10 PRs Dependabot ouvertes simultanément, évite spam)
   - **Ecosystem `github-actions`** : monitor `.github/workflows/*.yml`, schedule `weekly`
   - **Ecosystem `docker`** : monitor `apps/*/Dockerfile`, schedule `weekly` (alerte si nouvelle base image disponible — postgres:16, node:22, etc.)
   - **Security updates** : Dependabot security alerts auto (toujours actif via GitHub native, pas de config nécessaire)
   - **CVE bloquant** : ce comportement (CVE critique non patchable bloque le merge) est géré par `trivy-action` dans `build-images.yml` (AC4) — Dependabot fait juste les PR de bump

7. **AC7 — Tests E2E Stories 0.6 + 0.7 + 0.8 + 0.10 dans CI** : Given le workflow `ci.yml`, When une PR modifie `apps/identity-svc/`, Then les tests E2E identity-svc s'exécutent contre `docker-compose.test.yml` (Story 0.10) démarré dans le job CI :
   - **Job dédié `e2e-tests`** dans `ci.yml` qui ne tourne que sur affected services backend
   - **Setup** : `pnpm docker:test:up --wait` (60s timeout) — démarre PG/NATS/Keycloak/Meilisearch/Redis test containers
   - **Run** : `pnpm --filter=<service> test:e2e`
   - **Teardown** : `pnpm docker:test:down` (cleanup même si tests fail)
   - **Tests chaos en CI nightly séparé** (NFR46) : workflow `chaos-tests.yml` séparé qui tourne `0 2 * * *` (2h du matin UTC) sur main, exécute `pnpm chaos:test` (Story 0.10 task 6) — NE BLOQUE PAS les PRs (slow + flaky par nature)

8. **AC8 — Coverage report + thresholds** : Given le job `test` du `ci.yml`, When les tests passent, Then :
   - **Coverage upload** vers Codecov via `codecov/codecov-action@v4` avec `flags` par workspace (`@tukio/contracts`, `@tukio/messaging`, `apps/identity-svc`, etc.)
   - **Comment PR automatique** : Codecov post un comment PR avec delta coverage (e.g., "+2.3% coverage" ou "-0.5% coverage")
   - **Thresholds par workspace** (cohérent NFR71 + Stories 0.4/0.6/0.7/0.8/0.9) :
     - `@tukio/contracts` : `lines: 95` (lib pure types)
     - `@tukio/messaging` : `lines: 80`
     - `@tukio/auth` : `lines: 85`
     - `@tukio/auth-client` : `lines: 85`
     - `@tukio/api-client` : `lines: 80`
     - `@tukio/i18n-client` : `lines: 80`
     - `@tukio/testing` : `lines: 70` (containers réels)
     - `@tukio/ui` : `lines: 80`
     - `apps/<service>` : `lines: 50` infrastructure / `70` usecases / `80` domain
   - **Bloquant** : si coverage < threshold sur les fichiers modifiés → CI fail (`codecov.yml` config `coverage.status.patch.target: <threshold>` + `coverage.status.project.target: auto`)

9. **AC9 — Caching pour perf CI** : Given le workflow `ci.yml`, When la CI tourne, Then les caches sont utilisés agressivement pour rester < 5 min :
   - **pnpm store cache** : `actions/cache@v4` keyed sur `pnpm-lock.yaml` hash, restore via `~/.local/share/pnpm/store` (cohérent pnpm 10 default)
   - **Turborepo remote cache** : `actions/cache@v4` keyed sur `turbo` cache directory `.turbo/` — partagé entre les jobs lint/typecheck/test
   - **Next.js build cache** : `actions/cache@v4` keyed sur `apps/<app>/.next/cache` pour accélérer les rebuilds Lighthouse CI
   - **Docker layer cache** : `cache-from` + `cache-to` sur `docker buildx build` via GitHub Actions cache (`type=gha`) — accélère les builds d'images successives
   - **Métriques target** : CI pipeline `ci.yml` sur PR avec uniquement `apps/customer/` modifié → < 5 min total. Pipeline complet `ci.yml + lighthouse-ci.yml + build-images.yml` sur merge main → < 12 min total.

10. **AC10 — GitHub Branch Protection rules documentées** : Given le repo GitHub, When je configure les règles de protection branche `main`, Then les règles documentées dans `.github/README.md` sont appliquables :
    - **Required status checks before merging** (tous les workflows `ci.yml` jobs + `lighthouse-ci.yml` doivent passer)
    - **Required pull request reviews** : 1 reviewer minimum (peut être Bot Dependabot pour les PR auto)
    - **Dismiss stale pull request approvals when new commits are pushed**
    - **Require linear history** (no merge commits, rebase-merge ou squash-merge uniquement)
    - **Require signed commits** : V1+ (GPG keys setup tech lead)
    - **Restrict who can push to matching branches** : tech lead + admins uniquement
    - **NB** : Story 0.11 livre la **documentation** + un script `gh repo set-branch-protection` optionnel. Application réelle = action manuelle GitHub UI (1× setup) — NE PEUT PAS être automatisée pleinement (admin permissions requises).

11. **AC11 — README CI + Troubleshooting** : Given `.github/README.md` et `.github/CI_PIPELINE.md`, When je les ouvre, Then je trouve la documentation complète du pipeline CI :
    - Diagramme texte des 5 workflows + leurs triggers + dépendances
    - Section Troubleshooting :
      - "Lighthouse CI fail with LCP > 2.5s" → vérifier Cloudflare Images, next/image, fonts via next/font
      - "Trivy scan blocks CVE" → check `pnpm audit --fix`, sinon override via `.trivyignore` avec justification commit
      - "Tests E2E fail timeout 60s" → check Docker daemon CI runner, increase timeout via env var
      - "Turborepo affected detection wrong" → vérifier `fetch-depth: 0` dans checkout, vérifier base branch
    - Section "Comment ajouter un nouveau service au pipeline ?" — étapes pour intégrer un service futur (Stories Epic 1+ si nouveau service apparaît)

12. **AC12 — Smoke test pipeline complet sur PR de test** : Given une PR de test (ex `chore(ci): test pipeline`), When je la merge, Then le pipeline complet s'exécute correctement end-to-end :
    - PR ouverte → `ci.yml` + `lighthouse-ci.yml` triggered → tous passent en < 12 min
    - Merge main → `build-images.yml` triggered → images Docker buildées + pushées `ghcr.io`
    - `deploy-staging.yml` triggered (placeholder OK même si ArgoCD pas encore configuré Story 0.12)
    - **Validation manuelle** : check `ghcr.io/<org>/tukio/identity-svc:<sha>` existe via `docker pull`
    - **Time tracker** : noter durations dans Debug Log References pour benchmark futur

## Tasks / Subtasks

- [ ] **Task 1 — Créer `.github/workflows/ci.yml`** (AC: #1, #7, #8, #9)
  - [ ] 1.1 — Header workflow avec `name`, triggers (pull_request + push main), permissions, concurrency control
  - [ ] 1.2 — Job `setup` qui restore caches pnpm + Turborepo + node_modules
  - [ ] 1.3 — Jobs parallèles `lint`, `typecheck`, `test`, `build` avec `pnpm <task> -- --filter=...[origin/main]`
  - [ ] 1.4 — Job `e2e-tests` (services backend affected) qui démarre `pnpm docker:test:up --wait` puis run `pnpm test:e2e --filter=...`
  - [ ] 1.5 — Coverage upload Codecov avec flags par workspace
  - [ ] 1.6 — Test : ouvrir PR test, vérifier tous les jobs passent < 5 min sur affected uniquement

- [ ] **Task 2 — Créer `.github/workflows/lighthouse-ci.yml` + `.lighthouserc.json`** (AC: #2)
  - [ ] 2.1 — Workflow trigger sur PR modifiant `apps/{public,customer,seller,admin}/` ou `packages/ui/`
  - [ ] 2.2 — Setup + build apps affected
  - [ ] 2.3 — Démarrer apps affected en background + `wait-on` healthcheck
  - [ ] 2.4 — Run `lhci autorun --config=.lighthouserc.json`
  - [ ] 2.5 — Créer `.lighthouserc.json` avec assertions strictes par app (cf. AC2)
  - [ ] 2.6 — Bloquant : exit 1 si fail → CI bloque PR
  - [ ] 2.7 — Comment PR auto si régression LCP/CLS > 10 % vs main (extension Story V1)

- [ ] **Task 3 — Étendre `eslint-plugin-tukio` avec 8 rules nouvelles** (AC: #3)
  - [ ] 3.1 — Promouvoir warn → error : `no-barrel-import-contracts` (Story 0.2), `no-barrel-import-ui` (Story 0.3), `no-direct-event-publish` (Story 0.7) dans `.eslintrc.cjs` racine
  - [ ] 3.2 — Implémenter `tools/eslint-plugin-tukio/src/rules/no-fr-paths.js` + tests (3 valid + 3 invalid avec autofix mapping FR → EN)
  - [ ] 3.3 — Implémenter `no-hardcoded-text.js` + tests (heuristique strings UI dans JSX)
  - [ ] 3.4 — Implémenter `no-class-validator.js` + tests
  - [ ] 3.5 — Implémenter `error-code-format.js` + tests (regex `^[A-Z]+(-[A-Z]+)*-\d{3}$`)
  - [ ] 3.6 — Implémenter `no-buyer.js` + tests
  - [ ] 3.7 — Implémenter `no-bypass-envelope.js` + tests
  - [ ] 3.8 — Implémenter `no-pure-black-white.js` + tests
  - [ ] 3.9 — Bonus : `require-correlation-id.js` (warn) + tests
  - [ ] 3.10 — Mettre à jour `tools/eslint-plugin-tukio/src/index.js` qui register les 8 nouvelles rules
  - [ ] 3.11 — Mettre à jour `.eslintrc.cjs` racine avec les 8 rules en `error` (sauf require-correlation-id en warn)
  - [ ] 3.12 — Documenter dans `tools/eslint-plugin-tukio/README.md` chaque rule avec rationale + exemples
  - [ ] 3.13 — `pnpm lint` à la racine : vérifier que le code existant Stories 0.6/0.7/0.8/0.10 passe (sinon fix or `// eslint-disable-next-line` avec commentaire justification)

- [ ] **Task 4 — Créer `.github/workflows/build-images.yml`** (AC: #4)
  - [ ] 4.1 — Workflow trigger merge `main` ou `workflow_dispatch`
  - [ ] 4.2 — Setup Docker Buildx + login `ghcr.io` via `GITHUB_TOKEN`
  - [ ] 4.3 — Détection services affected via Turborepo `--dry-run=json`
  - [ ] 4.4 — Matrix strategy build sur 10 services (`fail-fast: false` — un service KO ne bloque pas les autres)
  - [ ] 4.5 — Pour chaque service : `docker buildx build --tag <ghcr.io>:<sha> --tag <ghcr.io>:latest --push --cache-from type=gha --cache-to type=gha,mode=max`
  - [ ] 4.6 — Trivy scan post-build : `aquasecurity/trivy-action@master` avec `severity: CRITICAL,HIGH` + `exit-code: 1` (fail si CRITICAL)
  - [ ] 4.7 — Output digests dans GitHub Actions summary (utile Story 0.12 ArgoCD)

- [ ] **Task 5 — Créer Dockerfiles multi-stage pour les 10 services backend** (AC: #4)
  - [ ] 5.1 — Template `apps/<service>/Dockerfile` (Story 0.1 a posé un placeholder Dockerfile, Story 0.11 le finalise) :
    ```dockerfile
    # Builder stage
    FROM node:22-alpine AS builder
    WORKDIR /app
    RUN corepack enable && corepack prepare pnpm@10 --activate
    COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
    COPY tsconfig.base.json ./
    COPY packages ./packages
    COPY apps/<service> ./apps/<service>
    RUN pnpm install --frozen-lockfile
    RUN pnpm --filter=<service> build

    # Runner stage
    FROM node:22-alpine AS runner
    WORKDIR /app
    RUN apk add --no-cache curl   # pour healthcheck
    RUN addgroup -g 1001 nodejs && adduser -u 1001 -G nodejs -s /bin/sh -D nestjs
    COPY --from=builder --chown=nestjs:nodejs /app/apps/<service>/dist ./dist
    COPY --from=builder --chown=nestjs:nodejs /app/apps/<service>/package.json ./
    COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
    USER nestjs
    EXPOSE 4001  # ajuster par service (4000-4009)
    HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
      CMD curl -f http://localhost:${PORT:-4001}/health || exit 1
    CMD ["node", "dist/main.js"]
    ```
  - [ ] 5.2 — Dupliquer pour les 10 services avec ports respectifs (Story 0.1 ports figés)
  - [ ] 5.3 — Ajouter `.dockerignore` racine pour exclure `node_modules`, `.git`, `.next`, `dist`, `**/*.spec.ts`, `coverage` (réduit context build)
  - [ ] 5.4 — Test local : `docker buildx build apps/identity-svc/` → image build OK + healthy

- [ ] **Task 6 — Créer `.github/workflows/deploy-staging.yml` + `deploy-production.yml` (placeholders)** (AC: #5)
  - [ ] 6.1 — `deploy-staging.yml` : trigger `workflow_run` après build-images, placeholder action ArgoCD sync (Story 0.12 finalise)
  - [ ] 6.2 — `deploy-production.yml` : trigger sur tag `v*`, GitHub Environment `production` requiring approval, placeholder action
  - [ ] 6.3 — Notification Slack via `slackapi/slack-github-action@v2` (succes + failure)
  - [ ] 6.4 — Documenter secrets nécessaires : `ARGOCD_STAGING_TOKEN`, `ARGOCD_PRODUCTION_TOKEN`, `SLACK_WEBHOOK_URL` (Story 0.12 fournit les values)

- [ ] **Task 7 — Créer `.github/dependabot.yml`** (AC: #6)
  - [ ] 7.1 — Config 3 ecosystems : `npm` (workspaces glob), `github-actions`, `docker`
  - [ ] 7.2 — Schedule weekly + groups (combine minor/patch en 1 PR par groupe pour éviter spam)
  - [ ] 7.3 — Labels + assignees + open-pull-requests-limit
  - [ ] 7.4 — Test : commit + check Dependabot tab GitHub UI active

- [ ] **Task 8 — Configurer Codecov (`codecov.yml`) + thresholds** (AC: #8)
  - [ ] 8.1 — Créer `codecov.yml` racine avec `coverage.status.project.target: auto` + `coverage.status.patch.target: <threshold-per-flag>` + flags par workspace
  - [ ] 8.2 — Connecter Codecov au repo via Codecov GitHub App (manuel — documenter dans README)
  - [ ] 8.3 — Ajouter `CODECOV_TOKEN` secret repo (manuel)
  - [ ] 8.4 — Test : PR test → vérifier comment Codecov apparait + status check OK

- [ ] **Task 9 — Créer `chaos-tests.yml` (workflow nightly)** (AC: #7)
  - [ ] 9.1 — Trigger `schedule: '0 2 * * *'` (2h UTC) + `workflow_dispatch`
  - [ ] 9.2 — Setup + `pnpm docker:test:up --wait --profile slow-services` (Keycloak inclus)
  - [ ] 9.3 — `pnpm chaos:test` (Story 0.10 task 6)
  - [ ] 9.4 — Notification Slack si fail (channel `#tukio-alerts`)
  - [ ] 9.5 — Cleanup `pnpm docker:test:down` même si fail

- [ ] **Task 10 — Documentation `.github/README.md` + `.github/CI_PIPELINE.md`** (AC: #10, #11)
  - [ ] 10.1 — `.github/README.md` : description workflows + branch protection rules à appliquer (UI manuelle GitHub admin)
  - [ ] 10.2 — `.github/CI_PIPELINE.md` : diagramme texte 5 workflows + dépendances + troubleshooting
  - [ ] 10.3 — Section "Comment ajouter un nouveau service au pipeline ?" pour onboarding stories Epic 1+

- [ ] **Task 11 — Smoke test pipeline complet** (AC: #12)
  - [ ] 11.1 — Créer PR test `chore(ci): test pipeline complet`
  - [ ] 11.2 — Vérifier `ci.yml` + `lighthouse-ci.yml` triggered + tous passent < 12 min
  - [ ] 11.3 — Merger la PR
  - [ ] 11.4 — Vérifier `build-images.yml` triggered + 10 images dans `ghcr.io`
  - [ ] 11.5 — Vérifier `deploy-staging.yml` triggered (placeholder mais workflow exécute)
  - [ ] 11.6 — Documenter time tracker dans Debug Log References

- [ ] **Task 12 — Final commit + cleanup** (AC: tous)
  - [ ] 12.1 — `pnpm lint` à la racine → tous les 15 rules en `error` passent (fix code existant si nécessaire)
  - [ ] 12.2 — `pnpm typecheck && pnpm test` → tout passe
  - [ ] 12.3 — Commit `feat(ci): GitHub Actions pipeline complet (5 workflows + 8 lint rules + Dependabot + Codecov)` — Story 0.11 done

## Dev Notes

### Pourquoi cette story est la 11ᵉ — contexte stratégique

> **Sources canoniques** : Architecture lignes 304-312 (CI/CD pipeline), 998-1002 (PR + merge workflows), 2014-2018 (`.github/workflows/` structure), 1816-1832 (lint rules + CI gates), Story 0.10 dev context (`docker-compose.test.yml` consommé en CI).

Stories 0.1-0.10 ont posé tous les libs + services + Docker Compose dev. **Story 0.11 industrialise la qualité** : sans CI automatique, tout le travail Sprint 0 reste fragile (un dev peut merger du code FR hardcodé, casser les CWV, introduire une CVE critique). C'est aussi le **dernier rempart** avant que les Stories Epic 1+ (130 FRs) n'inondent le repo de PRs — il faut avoir la CI prête.

**Décisions techniques majeures** :
1. **Turborepo affected-builds OBLIGATOIRE** — sinon CI prend 30+ min sur 14 codebases (incompatible avec rythme PR). `--filter=...[origin/main]` détecte uniquement les workspaces modifiés depuis main.
2. **Lighthouse CI bloquant sur `apps/public/`** — RA1 SEO mitigation (le SEO est le risque opérationnel #1). Régression CWV impacte le ranking Google immédiatement.
3. **8 lint rules nouvelles + promotion warn → error** des 4 existantes Stories 0.2/0.3/0.7. Sprint 0 c'est le moment où le coût migration est minimal (peu de code). Une fois Epic 1+ ouvert, reverser une rule en error coûte beaucoup plus cher.
4. **Trivy scan CVE bloquant** sur images Docker (NFR18). PR introduisant une dep avec CVE CRITICAL → CI fail → forced upgrade ou explicit `.trivyignore` justification commit.
5. **`build-images.yml` matrix strategy avec `fail-fast: false`** — si identity-svc fail à build, les 9 autres continuent (économie temps + résolution incrémentale).
6. **`deploy-{staging,production}.yml` placeholders Story 0.11** — Story 0.12 finalise avec ArgoCD réel + Hetzner secrets. Story 0.11 pose la structure workflow GitHub Actions.
7. **Coverage thresholds par workspace** — pas de threshold global (différentes natures de code : pure types vs containers réels). Codecov `flags` permet le reporting granular.

### Versions à utiliser (latest stable)

| Action / Tool | Version | Rationale |
|---|---|---|
| **`actions/checkout@v4`** | v4 | Standard 2025+ |
| **`actions/setup-node@v4`** | v4 | Avec `node-version-file: '.nvmrc'` |
| **`pnpm/action-setup@v4`** | v4 | Compatible pnpm 10 |
| **`actions/cache@v4`** | v4 | Pour pnpm store + Turborepo |
| **`docker/setup-buildx-action@v3`** | v3 | Multi-platform builds |
| **`docker/login-action@v3`** | v3 | ghcr.io login |
| **`codecov/codecov-action@v4`** | v4 | Coverage upload |
| **`aquasecurity/trivy-action@master`** | master | Vulnerability scan (master tag stable) |
| **`@lhci/cli`** (Lighthouse CI) | latest stable | `lhci autorun` standard |
| **`slackapi/slack-github-action@v2`** | v2 | Slack notifications |

> ⚠️ **GitHub Actions runners** : utiliser `ubuntu-latest` (Ubuntu 24.04 en 2026). Pour Docker buildx, vérifier que le runner supporte BuildKit (oui par défaut sur ubuntu-latest 2025+).

### Project Structure cible

```
.github/
├─ README.md                                       # ← cette story (description CI + branch protection)
├─ CI_PIPELINE.md                                  # ← cette story (diagramme + troubleshooting)
├─ dependabot.yml                                  # ← cette story
└─ workflows/
   ├─ ci.yml                                       # ← cette story (PR validation)
   ├─ lighthouse-ci.yml                            # ← cette story (CWV + a11y)
   ├─ build-images.yml                             # ← cette story (Docker push ghcr.io)
   ├─ deploy-staging.yml                           # ← cette story (placeholder ArgoCD)
   ├─ deploy-production.yml                        # ← cette story (placeholder ArgoCD)
   └─ chaos-tests.yml                              # ← cette story (nightly)

.lighthouserc.json                                 # ← cette story (assertions LH par app)
codecov.yml                                        # ← cette story (thresholds + flags)
.dockerignore                                      # ← cette story
apps/<service>/Dockerfile                          # ← cette story (multi-stage finalisé) — UPDATE × 10 services

tools/eslint-plugin-tukio/src/rules/
├─ no-fr-paths.js                                  # ← cette story
├─ no-hardcoded-text.js                            # ← cette story
├─ no-class-validator.js                           # ← cette story
├─ error-code-format.js                            # ← cette story
├─ no-buyer.js                                     # ← cette story
├─ no-bypass-envelope.js                           # ← cette story
├─ no-pure-black-white.js                          # ← cette story
└─ require-correlation-id.js                       # ← cette story (warn-only)
```

### Pattern code — `.github/workflows/ci.yml` (squelette)

```yaml
name: CI

on:
  pull_request:
    branches: [main]
    paths-ignore: ['**.md', 'docs/**']
  push:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

env:
  NODE_VERSION_FILE: .nvmrc
  TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
  TURBO_TEAM: ${{ secrets.TURBO_TEAM }}

jobs:
  setup:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    outputs:
      pnpm-store-path: ${{ steps.pnpm-cache-dir.outputs.STORE_PATH }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Pour Turborepo affected detection
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
      - id: pnpm-cache-dir
        run: echo "STORE_PATH=$(pnpm store path --silent)" >> $GITHUB_OUTPUT
      - uses: actions/cache@v4
        with:
          path: ${{ steps.pnpm-cache-dir.outputs.STORE_PATH }}
          key: pnpm-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}
      - run: pnpm install --frozen-lockfile

  lint:
    needs: setup
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: .nvmrc }
      - uses: actions/cache@v4
        with:
          path: ~/.local/share/pnpm/store
          key: pnpm-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo run lint --filter='...[origin/main]'

  typecheck:
    needs: setup
    # ... idem lint mais run `pnpm turbo run typecheck`

  test:
    needs: setup
    # ... idem mais run `pnpm turbo run test --filter='...[origin/main]'` + coverage upload

  build:
    needs: setup
    # ... idem mais run `pnpm turbo run build`

  e2e-tests:
    needs: setup
    runs-on: ubuntu-latest
    timeout-minutes: 10
    if: contains(github.event.pull_request.changed_files, 'apps/identity-svc/') # heuristique simple, à raffiner
    services: {} # On utilise docker compose plutôt
    steps:
      - uses: actions/checkout@v4
      # ... setup + pnpm install
      - run: pnpm docker:test:up --wait
      - run: pnpm --filter=identity-svc test:e2e
      - run: pnpm docker:test:down
        if: always() # Cleanup même si tests fail
```

### Pattern code — `.lighthouserc.json` (squelette)

```json
{
  "ci": {
    "collect": {
      "startServerCommand": "pnpm --filter=public dev",
      "startServerReadyPattern": "ready started server",
      "url": [
        "http://localhost:3000/fr/",
        "http://localhost:3000/en/",
        "http://localhost:3000/fr/search"
      ],
      "settings": {
        "preset": "desktop"
      },
      "numberOfRuns": 3
    },
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.9 }],
        "categories:accessibility": ["error", { "minScore": 0.9 }],
        "categories:seo": ["error", { "minScore": 0.95 }],
        "categories:best-practices": ["warn", { "minScore": 0.9 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }],
        "interaction-to-next-paint": ["error", { "maxNumericValue": 200 }],
        "total-blocking-time": ["warn", { "maxNumericValue": 300 }],
        "first-contentful-paint": ["warn", { "maxNumericValue": 1800 }]
      }
    },
    "upload": {
      "target": "temporary-public-storage"
    }
  }
}
```

### Pattern code — Lint rule `tukio/no-fr-paths.js` (squelette)

```js
// tools/eslint-plugin-tukio/src/rules/no-fr-paths.js
const FR_TO_EN_SLUG_MAPPING = {
  categorie: 'category',
  profil: 'profile',
  parametres: 'settings',
  aide: 'help',
  recherche: 'search',
  panier: 'cart',
  vendeur: 'seller',
  acheteur: 'customer', // 'buyer' interdit memory tech_layer_english
  reservation: 'booking',
  paiement: 'payment',
  message: 'messages', // pluriel EN
};

const FR_PATH_REGEX = new RegExp(
  `^/(fr|en)?/(${Object.keys(FR_TO_EN_SLUG_MAPPING).join('|')})/`,
);

module.exports = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow FR slugs in URL paths (NFR58 — paths EN strict)' },
    fixable: 'code',
    schema: [],
    messages: {
      frPath: 'FR slug "{{ frSlug }}" forbidden in URL path. Use EN equivalent: "{{ enSlug }}". See NFR58 + memory feedback_tech_layer_english.md.',
    },
  },
  create(context) {
    function checkLiteral(node) {
      if (typeof node.value !== 'string') return;
      const match = node.value.match(FR_PATH_REGEX);
      if (match) {
        const frSlug = match[2];
        const enSlug = FR_TO_EN_SLUG_MAPPING[frSlug];
        context.report({
          node,
          messageId: 'frPath',
          data: { frSlug, enSlug },
          fix: (fixer) => {
            const newValue = node.value.replace(`/${frSlug}/`, `/${enSlug}/`);
            return fixer.replaceText(node, JSON.stringify(newValue));
          },
        });
      }
    }
    return { Literal: checkLiteral };
  },
};
```

### Critical Architecture Constraints

> Cf. Architecture lignes 304-312 + 1816-1832 + memories `feedback_*.md`.

1. **Turborepo affected-builds non négociable** — sinon CI prend 30+ min, déraisonnable. Garantir `fetch-depth: 0` dans checkout.
2. **Lighthouse CI bloquant `apps/public/` (RA1 SEO)** — pas optionnel.
3. **15 lint rules en `error`** — Sprint 0 c'est maintenant ou jamais (migration coûte plus cher en V1+).
4. **CVE CRITICAL bloque merge** (NFR18) — Trivy + Dependabot complémentaires.
5. **Coverage thresholds par workspace** — pas de global.
6. **GitHub Branch Protection** : 1 reviewer min + status checks required + linear history. Setup manuel UI (limitation API GitHub).
7. **`fail-fast: false`** sur matrix build-images — service 1 KO ne doit pas annuler les 9 autres.
8. **Approval manuel `production` environment** — protection prod.
9. **Cancel-in-progress** sur PR runs (économie crédits CI), **PAS** sur push main (pas annulable).
10. **Secrets GitHub Actions** : `CODECOV_TOKEN`, `TURBO_TOKEN`/`TURBO_TEAM`, `ARGOCD_*_TOKEN` (Story 0.12), `SLACK_WEBHOOK_URL` — documenter setup dans `.github/README.md`.

### What this story does NOT do (out of scope)

- ❌ **ArgoCD réel + Hetzner secrets** → Story 0.12 (placeholders deploy-staging/prod ici)
- ❌ **Branch protection rules appliquées** → action manuelle GitHub UI (1× setup, documenté)
- ❌ **Storybook deployment automatique** → V1+
- ❌ **PR preview deployments Vercel** → automatique via Vercel GitHub integration (pas de workflow custom nécessaire)
- ❌ **Tests visual regression Chromatic** → V1+
- ❌ **Mutation testing (Stryker)** → V1+
- ❌ **Performance regression monitoring sur services backend** → Story 0.12 (Prometheus + Grafana alerts)
- ❌ **Auto-merge Dependabot PRs** (security patches OK auto-merge) → V1+

### Files to UPDATE vs CREATE

> **À UPDATE** :
> - `.eslintrc.cjs` racine — ajouter 8 rules nouvelles + promouvoir 3 rules existantes warn → error
> - `tools/eslint-plugin-tukio/src/index.js` — register 8 nouvelles rules
> - `tools/eslint-plugin-tukio/README.md` — documenter 8 rules
> - `apps/<service>/Dockerfile` (× 10 services) — finaliser multi-stage (Story 0.1 placeholder)

> **À CREATE** :
> - `.github/workflows/ci.yml`
> - `.github/workflows/lighthouse-ci.yml`
> - `.github/workflows/build-images.yml`
> - `.github/workflows/deploy-staging.yml` (placeholder)
> - `.github/workflows/deploy-production.yml` (placeholder)
> - `.github/workflows/chaos-tests.yml` (nightly)
> - `.github/dependabot.yml`
> - `.github/README.md` + `.github/CI_PIPELINE.md`
> - `.lighthouserc.json` racine
> - `codecov.yml` racine
> - `.dockerignore` racine
> - 8 fichiers rules dans `tools/eslint-plugin-tukio/src/rules/` + 8 specs
> - **Estimation total fichiers créés/modifiés** : ~30 fichiers

### Previous Story Intelligence (Stories 0.1 → 0.10)

**Story 0.1** : `package.json` racine avec scripts `dev`, `build`, `lint`, `typecheck`, `test`, `format`. `.eslintrc.cjs` placeholder avec slot `eslint-plugin-boundaries` (warn). `.husky/pre-commit` lint-staged. `Dockerfile` placeholder par service.

**Story 0.2** : `eslint-plugin-tukio` créé avec rules `event-naming` + `no-barrel-import-contracts`. Story 0.11 promeut `no-barrel-import-contracts` warn → error.

**Story 0.3** : Étendu avec rule `no-barrel-import-ui` (warn). Story 0.11 promeut warn → error.

**Story 0.6** : `eslint-plugin-boundaries` strict pour Pattern Pretre (déjà `error` Story 0.6 task 8.1). Story 0.11 vérifie que ça reste actif + ajoute le test E2E identity-svc en CI.

**Story 0.7** : Étendu avec rule `no-direct-event-publish` (warn). Story 0.11 promeut warn → error. `OutboxPublisher` patterns enforced via lint.

**Story 0.10** : `docker-compose.test.yml` créé. Story 0.11 le consume dans `ci.yml` job `e2e-tests` + `chaos-tests.yml` nightly. `pnpm docker:test:up --wait` script disponible.

### Conventions à respecter (rappel)

| Convention | Règle | Application Story 0.11 |
|---|---|---|
| EN strict | Naming workflows + jobs + steps en EN | ✅ |
| Snake_case YAML keys | GitHub Actions standard | ✅ |
| Lint rules en `error` | Sprint 0 enforce | ✅ AC3 |
| CI < 5 min sur PR affected | Turborepo affected | ✅ AC9 |
| Coverage thresholds par workspace | NFR71 cohérent | ✅ AC8 |
| CVE CRITICAL block merge | NFR18 | ✅ AC4 (Trivy) |
| Lighthouse a11y ≥ 90 | NFR54 | ✅ AC2 |
| LCP/INP/CLS thresholds | NFR5 | ✅ AC2 |
| Linear history (rebase/squash) | Branch protection | ✅ AC10 |
| 1 reviewer minimum | Branch protection | ✅ AC10 |

### Testing Standards

- **Pas de tests unitaires** sur Story 0.11 (workflows YAML + lint rules JS pas testables au sens classique).
- **Tests des lint rules** : `tools/eslint-plugin-tukio/__tests__/<rule>.spec.ts` couvre 3 valid + 3 invalid par rule (cohérent Stories 0.2/0.3/0.7 pattern). Vitest + ESLint `RuleTester`.
- **Test pipeline** : PR test (Task 11) valide end-to-end fonctionnement.

### Project Structure Notes

✅ **Aligné** avec Architecture lignes 304-312 (CI/CD pipeline).

✅ **Aligné** avec Architecture lignes 998-1002 + 2014-2018 (`.github/workflows/` 5 fichiers).

✅ **Aligné** avec Architecture lignes 1816-1832 (lint rules + CI gates).

✅ **Aligné** avec PRD NFR5/18/50/54 + R12/R13 mitigation.

⚠️ **Décision documentée** : `lint-staged` Husky pre-commit (Story 0.1) reste activé MAIS la CI re-vérifie tout (defence in depth). Husky permet feedback rapide local, CI est le source-of-truth blocking.

⚠️ **Décision documentée** : Codecov vs Coveralls — Codecov choisi (UI plus moderne + intégration GitHub Apps native + flags par workspace mieux). Si Codecov pricing devient problématique V1+, fallback Coveralls. Coverage doit être uploaded vers Codecov via `CODECOV_TOKEN` secret manuel.

⚠️ **Décision documentée** : Lighthouse CI utilise `temporary-public-storage` MVP (free tier). V1+ envisager LHCI Server self-hosted pour historique long terme + perf trends.

⚠️ **À noter** : `lighthouse-ci.yml` démarre les apps via `pnpm --filter=public dev` qui prend 30-60s à boot. Pour CI rapide, alternative `pnpm --filter=public build && pnpm --filter=public start` (next.js standalone start, plus rapide). Documenter dans Debug Log References le choix.

⚠️ **À noter** : la rule `no-hardcoded-text` peut générer des **false-positives** (ex `'utf-8'`, `'application/json'`, etc. — strings techniques). Whitelist intelligente nécessaire dans la rule, ou recourir à `// eslint-disable-next-line tukio/no-hardcoded-text` localement avec commentaire justification. Story Epic 1+ raffinera.

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#CI-CD-Pipeline-Turborepo-monorepo — Lines 304-312 (affected-builds, lint, tests, Lighthouse, chaos)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation-Sequence — Lines 998-1002 + 1055 (PR + merge workflows)]
- [Source: _bmad-output/planning-artifacts/architecture.md#GitHub-Workflows — Lines 2014-2018 (5 workflows structure)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Lint-rules — Lines 1816-1832 (eslint-plugin-boundaries + custom rules + CI gates)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Error-Codes-Catalog — Lines 1707-1715 (format `<DOMAIN>-<CATEGORY>-<NNN>`)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Anti-Patterns — Lines 1907-1972 (good vs bad examples enforced via lint)]
- [Source: _bmad-output/planning-artifacts/epics.md#Story-0.11 — Lines 1017-1031 (7 ACs originaux : ci affected, lint custom rules, image build, Lighthouse, Dependabot)]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR5 — Core Web Vitals LCP/INP/CLS]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR18 — Dependabot CVE bloquant]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR50 — alt text obligatoire]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR54 — Lighthouse a11y ≥ 90]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR56 — zero hardcoded text frontend]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR58 — paths URL EN strict + hreflang]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR71 — coverage 80/70/50 thresholds]
- [Source: _bmad-output/implementation-artifacts/0-2-initialize-tukio-contracts-envelope-nats-events-dtos.md — `eslint-plugin-tukio` créé + rule event-naming + no-barrel-import-contracts]
- [Source: _bmad-output/implementation-artifacts/0-3-setup-design-system-tailwind-v4-tukio-ui.md — rule no-barrel-import-ui]
- [Source: _bmad-output/implementation-artifacts/0-7-setup-tukio-messaging-nats-jetstream.md — rule no-direct-event-publish]
- [Source: _bmad-output/implementation-artifacts/0-10-docker-compose-dev-local-bootstrap-scripts.md — `docker-compose.test.yml` consommé en CI]
- [External: https://docs.github.com/en/actions (GitHub Actions docs)]
- [External: https://turbo.build/repo/docs/core-concepts/monorepos/filtering#filter-by-changed-packages (Turborepo affected detection)]
- [External: https://github.com/GoogleChrome/lighthouse-ci (Lighthouse CI)]
- [External: https://aquasecurity.github.io/trivy/ (Trivy vulnerability scanner)]
- [External: https://docs.codecov.com/docs/quick-start (Codecov setup)]
- [Memory: feedback_tech_layer_english.md — paths EN + no `buyer`]
- [Memory: feedback_clean_architecture_explicit.md — `class-validator` interdit, Zod uniquement]
- [Memory: feedback_api_envelope_response.md — no-bypass-envelope rule rationale]
- [Memory: feedback_i18n_frontend.md — no-hardcoded-text rationale]

## Dev Agent Record

### Agent Model Used

(à remplir par le dev agent)

### Debug Log References

(à remplir — versions GitHub Actions retenues, choix Codecov vs Coveralls, fallback temporary-public-storage Lighthouse, durations CI mesurées sur PR test, false-positives no-hardcoded-text rencontrés + whitelist additions)

### Completion Notes List

(à remplir — résumé décisions, déviations, points d'attention pour Story 0.12 (deploy-{staging,production}.yml finalisés avec ArgoCD réel), Stories Epic 1+ qui consomment la CI quotidiennement)

### File List

(à remplir)

---

## Story Completion Status

- **Story Status** : `ready-for-dev`
- **Created** : 2026-05-09
- **Created by** : `bmad-create-story` workflow
- **Epic** : Epic 0 — Sprint 0 Foundation (MVP, foundational)
- **Sprint cible** : Sprint 0 (semaines 1-3 du planning MVP)
- **Estimation effort** : 3-4 jours (~30 fichiers : 6 workflows YAML + 8 lint rules + Dockerfiles + configs)
- **Dépendances upstream** :
  - Stories 0.1-0.9 (toutes les libs + scripts) — code à valider en CI
  - Story 0.2 (eslint-plugin-tukio créé) — étendre avec 8 nouvelles rules
  - Story 0.10 (docker-compose.test.yml + scripts pnpm) — consommé par `e2e-tests` job + `chaos-tests.yml`
- **Dépendances downstream** :
  - **Story 0.12** (Helm + observability) — finalise `deploy-staging.yml` + `deploy-production.yml` placeholders avec ArgoCD réel
  - **Stories Epic 1+ (toutes)** — chaque PR validée par cette CI
- **FRs covered** : aucun FR direct
- **NFRs touchés** :
  - **NFR5** — Core Web Vitals LCP/INP/CLS enforced via Lighthouse CI ✅
  - **NFR18** — Dependabot + Trivy CVE bloquant ✅
  - **NFR50** — alt text via lint accessibility ✅
  - **NFR54** — Lighthouse a11y ≥ 90 ✅
  - **NFR56** — no-hardcoded-text rule ✅
  - **NFR58** — no-fr-paths rule ✅
  - **NFR71** — coverage thresholds par workspace via Codecov ✅
  - **NFR74** — naming + conventions enforced via 15 lint rules ✅
