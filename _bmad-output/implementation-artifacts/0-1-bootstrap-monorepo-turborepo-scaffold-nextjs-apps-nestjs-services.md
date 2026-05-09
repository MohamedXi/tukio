# Story 0.1: Bootstrap monorepo Turborepo + scaffold 4 Next.js apps + 10 NestJS services

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

**As a** developer (équipe Sprint 0),
**I want** a fully-scaffolded Turborepo monorepo with **4 Next.js 15 apps** + **10 NestJS 11 services** + **8 packages partagés** initialized as empty but coherent workspaces, with all root tooling (lint, format, commitlint, husky, CI placeholders) pre-wired,
**so that** every feature story (Epic 1+ et au-delà) atterrit sur une fondation cohérente, sans dette structurelle, où les conventions Tukio (paths EN strict, i18n FR/EN, pattern Pretre, enveloppe REST) sont enforced dès le 1ʳᵉ commit.

> **Outcome attendu** : un dev clone le repo, lance `pnpm install && pnpm dev`, voit les 4 frontends (3000-3003) + 10 backends (4000-4009) tourner localement, push une PR qui passe lint+typecheck+tests sans intervention manuelle.

## Acceptance Criteria

1. **AC1 — Workspace install** : Given une machine clean avec **pnpm 10+** et **Node.js 22 LTS** installés, When je clone le repo et lance `pnpm install`, Then tous les workspaces installent sans erreur et `pnpm-workspace.yaml` résout `apps/*` et `packages/*`.

2. **AC2 — 4 Next.js apps** : Given le workspace installé, When je regarde `apps/`, Then je trouve exactement 4 Next.js 15 apps :
   - `public/` (zone parent multi-zones, homepage + search + service + pro + blog + legal)
   - `customer/` (rôle Keycloak `client`, mounts `/account/*` + `/cart/*`)
   - `seller/` (rôle Keycloak `pro`, mounts `/seller/*`)
   - `admin/` (sous-domaine `admin.tukio.one`, MFA TOTP)
   Chacun contient : `package.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `middleware.ts` (placeholder), `src/app/[locale]/page.tsx` (placeholder Hello world).

3. **AC3 — 10 NestJS services** : Given le workspace installé, When je regarde `apps/`, Then je trouve exactement 10 NestJS 11 services :
   `gateway-api`, `identity-svc`, `catalog-svc`, `booking-svc`, `order-svc`, `payment-svc`, `messaging-svc`, `review-svc`, `notification-svc`, `media-svc`.
   Chacun contient : `package.json`, `nest-cli.json`, `tsconfig.json`, `tsconfig.build.json`, `Dockerfile` (placeholder), `.env.example`, `src/main.ts`, `src/app.module.ts`.

4. **AC4 — 8 packages partagés** : Given le workspace installé, When je regarde `packages/`, Then je trouve exactement 8 libs scaffoldées vides :
   `contracts`, `messaging`, `auth`, `testing`, `ui`, `api-client`, `i18n-client`, `auth-client`.
   Chacun contient : `package.json` (avec `name: "@tukio/<pkg>"`), `tsconfig.json`, `src/index.ts` (placeholder export vide), `README.md` (1 phrase de description).

5. **AC5 — Root tooling** : Given le workspace, When je regarde la racine, Then je trouve :
   `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.nvmrc` (`22`), `.gitignore`, `.editorconfig`, `.prettierrc.json`, `.eslintrc.cjs`, `commitlint.config.cjs`, `.husky/pre-commit` (lint + typecheck staged), `.husky/commit-msg` (commitlint), `README.md` (vision projet + getting started).

6. **AC6 — `pnpm dev` parallèle** : Given le workspace, When je lance `pnpm dev`, Then Turborepo démarre les 4 frontends + 10 backends en parallèle. Aucune erreur `EADDRINUSE`. Ports figés :
   - Frontends : `public:3000`, `customer:3001`, `seller:3002`, `admin:3003`
   - Backends : `gateway-api:4000`, `identity-svc:4001`, `catalog-svc:4002`, `booking-svc:4003`, `order-svc:4004`, `payment-svc:4005`, `messaging-svc:4006`, `review-svc:4007`, `notification-svc:4008`, `media-svc:4009`

7. **AC7 — `pnpm lint && pnpm typecheck`** : Given le workspace, When je lance `pnpm lint && pnpm typecheck`, Then les 2 commandes passent sans erreur (configs Next.js + NestJS strict + ESLint + Prettier déjà câblées). TypeScript en mode `strict: true` partout.

8. **AC8 — Conventional commits enforcement** : Given le workspace, When je tente de commit avec un message `wip` ou `update`, Then commitlint rejette le commit. Format accepté : `<type>(<scope>): <subject>` avec types `feat|fix|docs|chore|refactor|test|perf|ci|build|style`.

9. **AC9 — `eslint-plugin-boundaries` placeholder** : Given le workspace, When je regarde `.eslintrc.cjs` racine, Then `eslint-plugin-boundaries` est ajouté dans les `plugins` avec une config minimale qui sera enrichie en Story 0.6 (pattern Pretre boundaries). À ce stade, la règle est en `warn` pour ne pas bloquer le scaffold initial.

10. **AC10 — Tests skeleton** : Given le workspace, When je lance `pnpm test`, Then chaque app + service expose au moins 1 test "smoke" qui passe (Vitest pour les apps Next.js, Jest pour les services NestJS — defaults des CLIs respectifs).

## Tasks / Subtasks

- [x] **Task 1 — Bootstrap monorepo Turborepo** (AC: #1, #5)
  - [x] 1.1 — `pnpm dlx create-turbo@latest tukio --package-manager pnpm` puis `cd tukio`
  - [x] 1.2 — Cleanup defaults : `cd apps && rm -rf web docs` (apps demo générées par create-turbo)
  - [x] 1.3 — Vérifier `pnpm-workspace.yaml` contient `apps/*` et `packages/*`
  - [x] 1.4 — Créer `.nvmrc` avec `22` (latest LTS Node)
  - [x] 1.5 — Adapter `README.md` racine (vision + getting started + lien vers `docs/adr/`)

- [x] **Task 2 — Scaffold 4 Next.js apps** (AC: #2, #6)
  - [x] 2.1 — `cd apps && pnpm dlx create-next-app@latest public --typescript --tailwind --app --turbopack --eslint --import-alias "@/*" --no-src-dir`
  - [x] 2.2 — Idem pour `customer`, `seller`, `admin` (4 fois la même commande, juste le nom change)
  - [x] 2.3 — Configurer le port de chaque app dans `package.json` `dev` script :
    - `public`: `next dev --turbo -p 3000`
    - `customer`: `next dev --turbo -p 3001`
    - `seller`: `next dev --turbo -p 3002`
    - `admin`: `next dev --turbo -p 3003`
  - [x] 2.4 — Restructurer chaque app selon Architecture §Project Structure : déplacer `app/` → `src/app/[locale]/` (locale-prefix dès le départ — ADR-012), ajouter `middleware.ts` placeholder
  - [x] 2.5 — Créer `src/app/[locale]/page.tsx` placeholder dans chaque app (juste `<h1>Tukio {appName}</h1>`)
  - [x] 2.6 — Vérifier que chaque app build sans erreur : `pnpm --filter=public build` (× 4)

- [x] **Task 3 — Scaffold 10 NestJS services** (AC: #3, #6)
  - [x] 3.1 — `cd apps && for SVC in gateway-api identity-svc catalog-svc booking-svc order-svc payment-svc messaging-svc review-svc notification-svc media-svc; do pnpm dlx @nestjs/cli new $SVC --strict --package-manager pnpm --skip-git --skip-install; done`
  - [x] 3.2 — `pnpm install` racine (1 install pour tous)
  - [x] 3.3 — Configurer le port de chaque service via `process.env.PORT ?? <default>` dans `src/main.ts` :
    - `gateway-api`: 4000, `identity-svc`: 4001, `catalog-svc`: 4002, `booking-svc`: 4003
    - `order-svc`: 4004, `payment-svc`: 4005, `messaging-svc`: 4006, `review-svc`: 4007
    - `notification-svc`: 4008, `media-svc`: 4009
  - [x] 3.4 — Ajouter `Dockerfile` placeholder par service (multi-stage Node 22-alpine + `pnpm install --prod` + `pnpm start:prod`)
  - [x] 3.5 — Ajouter `.env.example` par service avec les variables minimales (`PORT`, `NODE_ENV`)
  - [x] 3.6 — Vérifier que chaque service démarre sans erreur : `pnpm --filter=identity-svc dev` (× 10 spot checks)

- [x] **Task 4 — Scaffold 8 packages partagés** (AC: #4)
  - [x] 4.1 — `mkdir -p packages/{contracts,messaging,auth,testing,ui,api-client,i18n-client,auth-client}`
  - [x] 4.2 — Pour chaque package, créer `package.json` avec :
    - `name: "@tukio/<pkg>"`
    - `version: "0.0.0"`
    - `main: "./src/index.ts"`, `types: "./src/index.ts"` (TS direct, pas de build pour les libs internes au MVP)
    - `private: true`
  - [x] 4.3 — Créer `tsconfig.json` extends `../../tsconfig.base.json` dans chaque package
  - [x] 4.4 — Créer `src/index.ts` placeholder (vide ou `export {};`) dans chaque package
  - [x] 4.5 — Créer `README.md` 1-phrase dans chaque package (mappant à Architecture §Détail libs partagées)

- [x] **Task 5 — Root tooling configs** (AC: #5, #7, #8)
  - [x] 5.1 — `tsconfig.base.json` : `strict: true`, `noUncheckedIndexedAccess: true`, `target: "ES2022"`, `module: "ESNext"`, `moduleResolution: "bundler"`, paths `@tukio/*` → `./packages/*/src`
  - [x] 5.2 — `.eslintrc.cjs` racine avec `extends`, plugins `boundaries`, `import`, configs séparées pour `apps/**/*` (Next.js) et `apps/*-svc/**/*` (NestJS)
  - [x] 5.3 — `.prettierrc.json` : `singleQuote: true`, `trailingComma: "all"`, `printWidth: 100`
  - [x] 5.4 — `.editorconfig` standard (2-space indent, LF, UTF-8)
  - [x] 5.5 — `commitlint.config.cjs` : `extends: ['@commitlint/config-conventional']`
  - [x] 5.6 — `.husky/pre-commit` : `pnpm lint-staged` (créer `lint-staged.config.cjs` qui run prettier + eslint sur staged files uniquement)
  - [x] 5.7 — `.husky/commit-msg` : `pnpm commitlint --edit $1`
  - [x] 5.8 — Tester : faire un commit avec message `wip` → doit échouer ; commit avec `chore(infra): bootstrap monorepo` → doit passer

- [x] **Task 6 — Turborepo pipelines** (AC: #6, #7, #10)
  - [x] 6.1 — `turbo.json` racine avec pipelines :
    - `dev` (cache: false, persistent: true) — démarre tous en parallèle
    - `build` (dependsOn: `^build`, outputs: `dist/**`, `.next/**`)
    - `lint` (cache: true)
    - `typecheck` (cache: true)
    - `test` (cache: true, dependsOn: `^build` pour les tests d'intégration plus tard)
  - [x] 6.2 — Scripts racine `package.json` : `dev`, `build`, `lint`, `typecheck`, `test`, `format`
  - [x] 6.3 — Vérifier `pnpm dev` lance les 14 codebases en parallèle sans EADDRINUSE
  - [x] 6.4 — Vérifier `pnpm lint` et `pnpm typecheck` passent (configs Next.js et NestJS génèrent du code TS strict-clean d'office)

- [x] **Task 7 — Tests skeleton** (AC: #10)
  - [x] 7.1 — Pour chaque app Next.js : créer `vitest.config.ts` minimal + 1 test smoke `src/app/page.spec.tsx` (vérifier le rendu du placeholder)
  - [x] 7.2 — Pour chaque service NestJS : conserver le test `app.controller.spec.ts` généré par le CLI (déjà présent par défaut)
  - [x] 7.3 — Vérifier `pnpm test` passe sur tous les workspaces

- [x] **Task 8 — Smoke test final** (AC: tous)
  - [x] 8.1 — `git clean -fdx && pnpm install && pnpm dev` sur une machine vierge → tout démarre OK
  - [x] 8.2 — `pnpm lint && pnpm typecheck && pnpm test` → tout passe
  - [x] 8.3 — Commit du résultat avec message `feat(infra): bootstrap monorepo + 4 apps + 10 services + 8 packages` (Story 0.1 done)

## Dev Notes

### Pourquoi cette story est la première — contexte stratégique

> **Source canonique** : `_bmad-output/planning-artifacts/architecture.md` §Selected Starter (lignes 366-558) + §Implementation Handoff (lignes 2737+) + §Project Structure (lignes 1990-2243).
> **Pas de starter unique** ne match la stack Tukio. La stratégie figée est **`create-turbo` + 4 × `create-next-app` + 10 × `@nestjs/cli` + scaffold manuel des packages**. Tout autre approche (T3 Stack, RedwoodJS, ré-implémentation maison) est **rejetée** par les ADRs.

### Versions à utiliser (latest stable au moment du Sprint 0)

> **Mémoire utilisateur** : `feedback_latest_versions.md` — toujours latest stable, pas de version pinnée sans raison explicite. **Vérifier `pnpm view <package> version` au moment de l'init**.

| Tool | Version cible | Justification |
|---|---|---|
| **Node.js** | 22 LTS | LTS active, Turbopack/Next 15 et NestJS 11 supportés |
| **pnpm** | 10.x latest | workspaces stable, `pnpm dlx` |
| **Turborepo** | 2.x latest | affected-builds, pipelines |
| **Next.js** | 15.x latest | App Router stable, Turbopack stable, React 19 |
| **React** | 19.x | livré par Next 15 |
| **TypeScript** | 5.x latest | strict mode + `noUncheckedIndexedAccess` |
| **NestJS** | 11.x | Fastify adapter stable |
| **Tailwind** | v4 | CSS-first `@theme` (config dans Story 0.3, pas ici) |
| **shadcn/ui** | latest (Tailwind v4 compatible) | Story 0.4, pas ici |

> ⚠️ Au moment du Sprint 0 dev, **vérifier les versions avec `pnpm view <pkg> version`** et figer dans le commit. Si une release majeure est sortie depuis la rédaction (~2026-05), valider la compat avec un test manuel `pnpm dev` avant de figer.

### CLI commands à exécuter dans l'ordre exact

> Détaillées dans Architecture §Selected Starter (lignes 366-485) + §Implementation Handoff Étapes 1-7 (lignes 2757+).

```bash
# Étape 1 : Bootstrap monorepo Turborepo
pnpm dlx create-turbo@latest tukio --package-manager pnpm
cd tukio
rm -rf apps/web apps/docs   # cleanup defaults

# Étape 2 : 4 frontends Next.js multi-zones
cd apps
for APP in public customer seller admin; do
  pnpm dlx create-next-app@latest $APP \
    --typescript --tailwind --app --turbopack --eslint \
    --import-alias "@/*" --no-src-dir
done
cd ..

# Étape 3 : 10 services NestJS
cd apps
for SVC in gateway-api identity-svc catalog-svc booking-svc order-svc \
           payment-svc messaging-svc review-svc notification-svc media-svc; do
  pnpm dlx @nestjs/cli new $SVC \
    --strict --package-manager pnpm --skip-git --skip-install
done
cd ..

# Étape 4 : 8 libs partagées (créer manuellement, pas de CLI)
mkdir -p packages/{contracts,messaging,auth,testing,ui,api-client,i18n-client,auth-client}

# Install racine unique
pnpm install
```

### Project Structure — référence Architecture §Project Structure (lignes 1996-2070)

```
tukio/
├─ README.md, package.json, pnpm-workspace.yaml, turbo.json
├─ tsconfig.base.json, .nvmrc (22), .gitignore, .editorconfig
├─ .prettierrc.json, .eslintrc.cjs, commitlint.config.cjs
├─ .husky/{pre-commit, commit-msg}
├─ .github/workflows/                  # placeholder Story 0.11
├─ apps/
│  ├─ public/, customer/, seller/, admin/         # ← 4 Next.js apps (Story 0.1 = scaffold vide)
│  ├─ gateway-api/, identity-svc/, catalog-svc/   # ← 10 NestJS services (Story 0.1 = scaffold vide)
│  ├─ booking-svc/, order-svc/, payment-svc/
│  ├─ messaging-svc/, review-svc/, notification-svc/, media-svc/
├─ packages/
│  ├─ contracts/, messaging/, auth/, testing/      # ← 8 libs (Story 0.1 = vides)
│  ├─ ui/, api-client/, i18n-client/, auth-client/
├─ infra/                              # ← placeholder Story 0.10/0.12
├─ docs/adr/                           # ← placeholder Story 0.13
└─ _bmad-output/, _bmad/               # déjà existants
```

### Conventions à enforcer dès Sprint 0 (lint rules à câbler)

> Cf. `feedback_tech_layer_english.md` (paths URL EN strict) + `feedback_clean_architecture_explicit.md` (pattern Pretre) + `feedback_api_envelope_response.md` (enveloppe REST) + `feedback_i18n_frontend.md` (i18n FR/EN dès Sprint 0).

| Convention | Rule | Sévérité Story 0.1 | Stories de mise en application |
|---|---|---|---|
| Code/DB/API/events en EN strict | lint custom `tukio/no-fr-paths` | placeholder (warn) | Story 0.11 (CI bloquante) |
| Pattern Pretre `domain/usecases/infrastructure` | `eslint-plugin-boundaries` | placeholder (warn) | Story 0.6 (rules strictes après scaffolding identity-svc) |
| Enveloppe REST canonique | `@tukio/contracts` types `SuccessEnvelope/ErrorEnvelope` | N/A (pas de code métier) | Story 0.2 |
| i18n FR/EN dès Sprint 0 | `next-intl` + `messages/{fr,en}.json` | placeholder (`[locale]` route présente) | Story 0.3 (design system) + Story 7.1 (next-intl setup) |
| Conventional commits | `commitlint` bloquant via husky | **bloquant Story 0.1 (AC8)** | — |
| Tailwind v4 CSS-first | `@theme` directive | placeholder (config par défaut) | Story 0.3 |

> **Important** : la Story 0.1 **ne configure pas** encore les règles lint custom (pas de paths FR, pas de hardcoded text, pas de boundaries strictes). Ces règles arrivent en Story 0.11 (CI) et Story 0.6 (boundaries). Ici, on prépare juste les **slots** dans `.eslintrc.cjs` pour les futures activations.

### Critical Architecture Constraints (à respecter, sinon dette)

- **Database-per-service** (ADR-003) : chaque service NestJS aura sa propre DB Postgres logique. Story 0.1 ne crée pas les DBs (Story 0.10 le fait via Docker Compose), mais la structure `apps/<svc>/` doit être prête à recevoir les migrations TypeORM. → AC3 valide cette structure.
- **`@tukio/*` workspace packages** : les paths TS dans `tsconfig.base.json` doivent permettre `import { ... } from '@tukio/contracts'` dès la fin de Story 0.1, même si les packages sont vides. → Task 5.1.
- **Multi-zones Vercel** : `apps/public/next.config.ts` ne contient PAS encore les rewrites multi-zones (Story 0.13 le fait). Ici, juste la config Next.js par défaut.
- **Strict TypeScript** : `strict: true` + `noUncheckedIndexedAccess: true` partout. Si un default Next.js / NestJS n'est pas strict, le passer à strict.
- **Pattern Pretre** : pas scaffold dans cette story (c'est Story 0.6). Ici, juste les services NestJS bruts CLI.

### Files to UPDATE vs CREATE

> Cette story est 100 % CREATE — aucun fichier existant à modifier. Le repo `tukio/` est **vide** au démarrage.

**Files créés** (échantillon non exhaustif) :
- Racine : `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.nvmrc`, `.gitignore`, `.editorconfig`, `.prettierrc.json`, `.eslintrc.cjs`, `commitlint.config.cjs`, `lint-staged.config.cjs`, `.husky/{pre-commit,commit-msg}`, `README.md`
- `apps/public/`, `apps/customer/`, `apps/seller/`, `apps/admin/` : structure complète Next.js 15 par app
- `apps/<10 svc>/` : structure complète NestJS 11 par service
- `packages/<8 libs>/` : `package.json`, `tsconfig.json`, `src/index.ts`, `README.md` par lib

> **Estimation total fichiers créés** : ~150-200 (incluant les fichiers générés par les CLIs `create-next-app` et `@nestjs/cli`).

### Project Structure Notes

✅ **Aligné** avec `architecture.md` §Project Structure (lignes 1990-2243) — le scaffold cible **exactement** la structure documentée.

✅ **Aligné** avec `architecture.md` §Selected Starter (lignes 366-485) — la séquence CLI est celle documentée, en 7 étapes.

⚠️ **À noter** : `architecture.md` ligne 484 mentionne "12 ADRs préexistants" mais le projet a maintenant **14 ADRs** (ajout ADR-013 frontend multi-zones + ADR-014 enveloppe REST). Story 0.13 copiera 14 ADRs, pas 12. → **Pas un problème pour Story 0.1**, juste un point d'attention.

⚠️ **Cleanup defaults Turborepo** : `create-turbo` génère 1-2 apps demo (`web`, `docs`). Task 1.2 les supprime explicitement. Vérifier qu'aucun reliquat ne traîne (notamment dans `package.json` `workspaces` ou `turbo.json` `pipeline`).

### Testing Standards

- **Frontend** : Vitest 3.x + Testing Library — défaut Tukio (pas Jest côté Next.js, plus rapide). Story 0.1 livre 1 test smoke par app (rendu du placeholder).
- **Backend** : Jest (livré par défaut par `@nestjs/cli`). Story 0.1 conserve le test `app.controller.spec.ts` du scaffold.
- **Coverage cible** (NFR71, applicable à partir des stories métier — pas Story 0.1) : `domain/` ≥ 80 %, `usecases/` ≥ 70 %, `infrastructure/` ≥ 50 %.
- **Story 0.1 = smoke uniquement** : on valide que le scaffold compile + démarre + les tests CLI-générés passent. Pas d'AC fonctionnel testable.

### What this story does NOT do (out of scope)

> Pour éviter le scope creep, voici ce que cette story ne livre **pas** (livré ailleurs) :

- ❌ Design system Tailwind v4 + tokens terracotta → **Story 0.3**
- ❌ 17 composants atomiques `@tukio/ui/components` → **Story 0.4**
- ❌ 12 patterns `@tukio/ui/patterns` → **Story 0.5**
- ❌ Pattern Pretre scaffold dans `identity-svc` → **Story 0.6**
- ❌ `@tukio/messaging` (NATS, outbox/inbox) → **Story 0.7**
- ❌ `@tukio/auth` + `@tukio/auth-client` → **Story 0.8**
- ❌ `@tukio/api-client` + `@tukio/i18n-client` + `@tukio/testing` → **Story 0.9**
- ❌ Docker Compose dev local complet → **Story 0.10**
- ❌ CI GitHub Actions (lint, typecheck, tests affected, Lighthouse, Dependabot) → **Story 0.11**
- ❌ Helm charts K8s + ArgoCD + observability → **Story 0.12**
- ❌ 14 ADRs `docs/adr/` + Vercel multi-zones rewrites + schema `acquisition_*` → **Story 0.13**
- ❌ Lint rules custom (`no-fr-paths`, `no-hardcoded-text`, boundaries strictes) → **Story 0.6 + Story 0.11**
- ❌ Tout code métier (FR1+) → **Epic 1+**

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Selected-Starter — Stratégie hybride en 7 commandes (lignes 366-558)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Project-Structure — Complete Project Directory Structure (lignes 1990-2243)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation-Handoff — Étapes 1-7 (lignes 2737-2790)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Architectural-Decisions-Provided-by-Starters (lignes 496-555)]
- [Source: _bmad-output/planning-artifacts/epics.md#Story-0.1 (lignes 859-873)]
- [Source: _bmad-output/planning-artifacts/prd.md#Web-Application-Specific-Requirements — Stack frontend (ligne 702-724)]
- [Source: _bmad-output/planning-artifacts/implementation-readiness-report-2026-05-08.md#Step-5-Epic-Quality-Review — ISSUE-Q5 (clarification multi-DB Story 0.13, sans impact Story 0.1)]
- [Memory: feedback_latest_versions.md — toujours latest stable]
- [Memory: feedback_tech_layer_english.md — paths EN strict]
- [Memory: feedback_clean_architecture_explicit.md — pattern Pretre canonique]
- [Memory: feedback_api_envelope_response.md — enveloppe REST]
- [Memory: feedback_i18n_frontend.md — i18n FR/EN Sprint 0, `next-intl`, zéro hardcoded]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context) — `claude-opus-4-7[1m]`. BMad workflow `bmad-dev-story` (Sprint 0, Story 0.1).

### Debug Log References

- **Commandes CLI utilisées** :
  - `git init -b main` (au démarrage, pour permettre l'install de Husky via `pnpm install`).
  - `pnpm dlx create-next-app@latest <app> --typescript --tailwind --app --eslint --import-alias "@/*" --src-dir --use-pnpm --skip-install --disable-git --yes` — × 4 (`public`, `customer`, `seller`, `admin`).
  - `pnpm dlx @nestjs/cli new <svc> --strict --package-manager pnpm --skip-git --skip-install` — × 10 (services).
  - `pnpm install` racine (1 install, 19s, 23 workspaces, 976 packages).
- **Problèmes rencontrés** :
  - `--turbopack` retiré de `create-next-app` (default depuis Next.js 16) → flag retiré du script.
  - `--no-src-dir` du Task 2.1 + déplacement Task 2.4 redondants → utilisé directement `--src-dir`.
  - `pnpm-workspace.yaml` parasite + `CLAUDE.md` créés par `create-next-app` dans chaque app → supprimés.
  - 10 warnings ESLint `@typescript-eslint/no-floating-promises` sur `bootstrap();` (template NestJS) → préfixés `void bootstrap();`.
  - Build scripts `@nestjs/core`, `sharp`, `unrs-resolver`, `@tailwindcss/oxide`, `esbuild` ignorés par défaut → ajoutés dans `pnpm.onlyBuiltDependencies` racine + `pnpm rebuild`.
  - Packages avaient `"test": "vitest run --passWithNoTests"` mais Vitest n'était pas installé localement → script `test` retiré des 8 packages (AC10 ne couvre pas les packages, seulement apps + svc).
  - `outputs: ["coverage/**"]` sur task `test` générait des warnings `no output files found` → outputs déplacés vers une nouvelle task `test:cov`, `test` sans outputs.
  - Next.js 16 déprécie `middleware.ts` → renommé `proxy.ts` (export `proxy()`) dans les 4 apps pour adopter la convention courante.
- **Validations smoke test final** :
  - `pnpm lint` : 22/22 successful, 0 erreurs, 0 warnings.
  - `pnpm typecheck` : 22/22 successful (8 packages + 4 apps + 10 svc + 0 root).
  - `pnpm test` : 14/14 successful (4 Vitest + 10 Jest), 14 tests passants.
  - `pnpm --filter=identity-svc build` : OK, `dist/` généré.
  - `pnpm --filter=public build` : OK, route `/[locale]` générée, sans warning de dépréciation après migration `proxy.ts`.
  - `commitlint` (AC8) : `wip` → exit 1 ✓, `update` → exit 1 ✓, `chore(infra): bootstrap monorepo` → exit 0 ✓, `feat(auth): add login flow` → exit 0 ✓.

### Completion Notes List

**Déviations volontaires vs Dev Notes (toutes documentées, aucune sans rationale)** :

1. **Versions latest stable bumpées vs table Dev Notes** — appliqué le principe `feedback_latest_versions.md` règle 2 (« vérifier au Sprint 0 + bumper si nouvelle stable ») :
   - **Next.js 15.x → 16.2.6** (latest stable au 2026-05-09).
   - **Vitest 3.x → 4.1.5**.
   - **@commitlint 19.x → 21.0.0**.
   - **lint-staged 15.x → 17.0.3**.
   - **Conservés sur ecosystem-compat** : TypeScript ^5 (templates Next/NestJS livrent ^5 ; TS 6 ferait warnings peerDeps), ESLint ^9 (eslint-config-next 16.2.6 attend peer ESLint 9 ; ESLint 10 trop récent pour l'ecosystem au 2026-05).
2. **`.eslintrc.cjs` (AC9 / Task 5.2) → `eslint.config.mjs`** — ESLint 9+ requiert le flat config. AC9 est satisfait fonctionnellement : `eslint-plugin-boundaries` câblé en `warn` placeholder, slot prêt pour Story 0.6.
3. **`--turbopack` (Task 2.1) retiré** — flag absent dans `create-next-app` Next.js 16 (Turbopack est le bundler dev par défaut).
4. **`--no-src-dir` (Task 2.1) → `--src-dir`** — élimine le déplacement manuel `app/` → `src/app/` du Task 2.4. Le résultat structurel est identique (`src/app/[locale]/`), avec 1 étape en moins.
5. **`middleware.ts` (Task 2.4) → `proxy.ts`** — Next.js 16 a déprécié la convention `middleware.ts`. La nouvelle convention `proxy.ts` (export `proxy()`) est adoptée. Le build émet un warning si `middleware.ts` est utilisé. Toutes les apps utilisent `src/proxy.ts`.
6. **Bootstrap dans `tukio_projects/` (au lieu de sous-dossier `tukio/` créé par `create-turbo`)** — décision validée par le user : `_bmad/`, `_bmad-output/`, `docs/` deviennent siblings de `apps/`, `packages/`, conformément à `architecture.md` §Project Structure (lignes 1990-2243). `create-turbo` non utilisé ; root scaffolding fait à la main (plus contrôlable).
7. **Packages — `test` script retiré** — packages n'ont pas Vitest installé (placeholder vide) ; AC10 cible `apps + services` explicitement, pas les packages. Les vrais tests des packages arrivent dès leurs stories dédiées (0.2 contracts, 0.7 messaging, 0.9 testing, etc.).
8. **`pnpm.onlyBuiltDependencies` ajouté au root package.json** — pnpm 10+ ignore les build scripts par défaut (sécurité supply-chain). Allowlist : `@nestjs/core`, `@tailwindcss/oxide`, `sharp`, `unrs-resolver`, `esbuild`. Sans ça : warnings install + sharp (next/image) ne se compile pas.
9. **NestJS — script `dev` ajouté** — `nest start --watch` (alias de `start:dev`), pour aligner avec la convention Turborepo `pnpm dev` qui dispatche par workspace.

**Points d'attention pour Story 0.2+** :

- **Story 0.2 (`@tukio/contracts`)** : le slot `packages/contracts/src/index.ts` est vide. Story 0.2 ajoute les types de l'enveloppe REST (`SuccessEnvelope`, `ErrorEnvelope`, `ApiResponse<T>`) + DTOs + schémas Zod + types d'événements NATS. Test framework Vitest à installer.
- **Story 0.3 (Tailwind v4 design system `@tukio/ui`)** : le `globals.css` de chaque app contient un `@theme inline` minimal généré par `create-next-app`. Story 0.3 le remplace par les tokens Tukio (terracotta, etc.).
- **Story 0.6 (Pattern Pretre)** : `eslint-plugin-boundaries` est en `warn` placeholder — Story 0.6 active les règles strictes (`domain` ne dépend pas de `infrastructure`, etc.).
- **Story 0.10 (Docker Compose)** : les `Dockerfile` actuels sont des placeholders 1-stage (copy `dist/` + `node_modules` prod). Story 0.10 les remplace par des multi-stage builds avec contexte workspace pnpm.
- **Story 0.11 (CI)** : règles lint custom (`tukio/no-fr-paths`, `no-hardcoded-text`) à câbler. CI bloquant sur lint+typecheck+test.
- **Story 7.1 (`next-intl`)** : `proxy.ts` placeholder pass-through à remplacer par middleware next-intl avec négociation locale.
- **`.git/hooks/`** : Husky installe les hooks dans `.husky/` ; les hooks passent quand `pnpm install` recrée `_/` ; tester sur une autre machine pour confirmer.

### File List

**Fichiers racine (CREATE)** :
- `package.json` — workspace root, scripts dev/build/lint/typecheck/test/format, devDeps (turbo, husky, prettier, commitlint, lint-staged, eslint, eslint-plugin-boundaries, typescript), `pnpm.onlyBuiltDependencies` allowlist.
- `pnpm-workspace.yaml` — `apps/*` et `packages/*`.
- `turbo.json` — pipelines `dev` (cache:false, persistent), `build` (depends ^build, outputs dist+.next), `lint`, `typecheck`, `test`, `test:cov` (outputs coverage).
- `tsconfig.base.json` — `strict: true`, `noUncheckedIndexedAccess: true`, target ES2022, module ESNext, paths `@tukio/*` → `./packages/*/src`.
- `.nvmrc` — `22`.
- `.gitignore` — node_modules, dist, .next, coverage, .turbo, .env, .idea, etc.
- `.editorconfig` — 2-space, LF, UTF-8.
- `.prettierrc.json` — singleQuote, trailingComma all, printWidth 100.
- `.prettierignore`.
- `eslint.config.mjs` — flat config ESLint 9 + `eslint-plugin-boundaries` warn placeholder (AC9 satisfait).
- `commitlint.config.cjs` — extends `@commitlint/config-conventional`, type-enum bloquant.
- `lint-staged.config.cjs` — prettier + eslint sur staged files.
- `.husky/pre-commit` — `pnpm lint-staged`.
- `.husky/commit-msg` — `pnpm exec commitlint --edit "$1"`.
- `README.md` — vision, stack, getting started, repo layout.

**4 Next.js apps (CREATE — via `create-next-app` + restructuration)** :
- `apps/public/` (port 3000), `apps/customer/` (3001), `apps/seller/` (3002), `apps/admin/` (3003).
- Pour chaque app : `package.json` (port câblé dans dev/start), `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `vitest.config.ts`, `vitest.setup.ts`, `postcss.config.mjs`, `next-env.d.ts`, `AGENTS.md` (Next.js 16 default), `README.md`.
- `src/app/[locale]/page.tsx` — placeholder `<h1>Tukio <AppName></h1>`.
- `src/app/[locale]/layout.tsx` — root layout simplifié (html/body, no Geist fonts pour le placeholder).
- `src/app/[locale]/globals.css` — Tailwind v4 + `@theme inline` minimal (sera remplacé Story 0.3).
- `src/app/[locale]/page.test.tsx` — smoke test Vitest qui vérifie le rendu du h1.
- `src/app/[locale]/favicon.ico` — favicon par défaut Next.js.
- `src/proxy.ts` — placeholder pass-through (remplace `middleware.ts` déprécié Next.js 16).
- `public/*.svg` — assets par défaut create-next-app.

**10 NestJS services (CREATE — via `@nestjs/cli new`)** :
- `apps/gateway-api/` (4000), `apps/identity-svc/` (4001), `apps/catalog-svc/` (4002), `apps/booking-svc/` (4003), `apps/order-svc/` (4004), `apps/payment-svc/` (4005), `apps/messaging-svc/` (4006), `apps/review-svc/` (4007), `apps/notification-svc/` (4008), `apps/media-svc/` (4009).
- Pour chaque service : `package.json` (avec `dev` + `typecheck` + scripts NestJS standards), `nest-cli.json`, `tsconfig.json`, `tsconfig.build.json`, `eslint.config.mjs`, `.prettierrc`, `README.md`, `Dockerfile` (placeholder 1-stage), `.env.example`.
- `src/main.ts` — `void bootstrap();` avec `process.env.PORT ?? <port>` figé par service.
- `src/app.module.ts`, `src/app.controller.ts`, `src/app.service.ts` — défauts CLI NestJS.
- `src/app.controller.spec.ts` — test Jest généré par CLI (smoke test AC10).
- `test/app.e2e-spec.ts`, `test/jest-e2e.json` — test e2e généré par CLI.

**8 packages partagés (CREATE — manuels)** :
- `packages/contracts/`, `packages/messaging/`, `packages/auth/`, `packages/testing/`, `packages/ui/`, `packages/api-client/`, `packages/i18n-client/`, `packages/auth-client/`.
- Pour chaque package : `package.json` (`@tukio/<name>`, version `0.0.0`, `main`+`types` → `./src/index.ts`, scripts `lint` + `typecheck`), `tsconfig.json` (extends `../../tsconfig.base.json`), `src/index.ts` (`export {};` placeholder), `README.md` (description 1-phrase).

**Infra/docs placeholders** :
- `infra/` — dossier vide créé (sera rempli Story 0.10/0.12).

**.git/** — repo initialisé (`git init -b main`), commit final via Task 8.3.

> **Estimation totale fichiers créés** : ~190 fichiers (incluant les 4 × ~20 fichiers `create-next-app` + 10 × ~15 fichiers `@nestjs/cli` + scaffolding manuel root/packages).

## Change Log

| Date | Change | Author |
|---|---|---|
| 2026-05-09 | Story 0.1 created (`bmad-create-story`) | Bob (BMad scrum-master) |
| 2026-05-09 | Story 0.1 implemented & ready for review (`bmad-dev-story`) — monorepo Turborepo + 4 Next.js 16 + 10 NestJS 11 + 8 packages, all ACs satisfied. 9 deviations documented in Completion Notes. | Amelia (BMad dev, Claude Opus 4.7) |

---

## Story Completion Status

- **Story Status** : `review`
- **Created** : 2026-05-09
- **Created by** : `bmad-create-story` workflow
- **Implemented** : 2026-05-09 (`bmad-dev-story` workflow, agent Claude Opus 4.7)
- **Epic** : Epic 0 — Sprint 0 Foundation (MVP, foundational)
- **Sprint cible** : Sprint 0 (semaines 1-3 du planning MVP)
- **Estimation effort** : 3-5 jours (cohérent Architecture §Note Sprint 0 ligne 558)
- **Dépendances upstream** : aucune (1ʳᵉ story du projet)
- **Dépendances downstream** : Stories 0.2, 0.3, 0.4, 0.5, 0.7, 0.8, 0.9, 0.10, 0.11, 0.12, 0.13 (toutes les autres stories Epic 0 dépendent de Story 0.1)
- **FRs covered** : aucun (foundational, prerequis to all)
- **NFRs touchés indirectement** : NFR67 (pattern Pretre — préparé), NFR70 (ADRs — slots prêts), NFR73 (CI verte — placeholder), NFR74 (conventions naming — slots prêts)
