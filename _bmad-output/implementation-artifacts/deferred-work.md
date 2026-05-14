# Deferred Work

## Deferred from: code review of 0-1-bootstrap-monorepo-turborepo-scaffold-nextjs-apps-nestjs-services (2026-05-09)

- **W1** — `@tukio/*` path mapping dans `tsconfig.base.json` ne résout pas correctement depuis les sous-dossiers des workspaces NestJS. Sera résolu dès le 1er import réel dans Story 0.2 (contracts).
- **W2** — Les 8 packages partagés exposent `./src/index.ts` comme `main`, incompatible avec la résolution `nodenext` de NestJS. Ne casse rien tant que les packages sont vides ; à corriger avant Story 0.2.
- **W3** — Les Dockerfiles sont des placeholders 1-stage sans contexte workspace pnpm. Scope Story 0.10 (Docker Compose + multi-stage builds).
- **W4** — `turbo.json` n'a pas de `globalEnv` pour les variables `NEXT_PUBLIC_*`. À ajouter quand les `.env` sont introduits en Story 0.2+.
- **W5** — `packages/ui/tsconfig.json` n'inclut pas `lib: ["dom"]` ni `jsx: "react-jsx"`. Bloquant pour les premiers composants React. Scope Story 0.4 (composants atomiques).
- **W6** — `process.env.PORT` sans validation `@nestjs/config`/Joi/Zod dans tous les services. Pas de déploiement en Story 0.1 ; ajouter avec la config applicative en Epic 1.
- **W7** — Les fichiers `*.tsbuildinfo` ne sont pas déclarés dans les `outputs` de `turbo.json`, ce qui invalide la compilation incrémentale sur les restore de cache CI. Optimisation à adresser en Story 0.11 (CI pipeline).
- **W8** — Les 8 packages partagés n'ont pas d'`eslint.config.mjs` local et utilisent le config racine sans parser TypeScript dédié. Les règles boundaries strictes arrivent en Story 0.6.

## Deferred from: code review of 0-2-initialize-tukio-contracts-envelope-nats-events-dtos (2026-05-09)

- **D1** — `tukioCode` dans `ErrorBody` est typé `string` libre. Story 0.6 (Pretre + envelope interceptor) ajoutera un regex (ex: `^[A-Z]+-[A-Z0-9]+-\d{3}$` type `AUTH-001`).
- **D2** — `format: "uuid"` JSON Schema accepte v1-v5. Acceptable car Keycloak/Stripe émettent diverses versions. Validation v4-strict possible côté consommateur si besoin (Story Epic 1+).
- **D3** — `Money.amount` typé `number` permet les floats au compile-time (JSON Schema runtime exige integer). Branded type `Cents` à introduire en Story 0.7 (messaging) avec validation publish-side.
- **D4** — `@tukio/*: ["./packages/*/src"]` résout vers un dossier (pas index.ts explicite). Fonctionne sous bundler resolution, fragile sous nodenext. À durcir quand les packages auront leur `dist/` (Story 0.6).
- **D5** — Pas de check automatique que les 14 tsconfigs apps/services restent en sync sur les paths `@tukio/contracts`. Script de vérification à ajouter en Story 0.11 (CI pipeline).
- **D6** — Lint rule `tukio/event-naming` couvre uniquement les `Property` AST nodes. N'attrape pas template literals, `publish('event')`, `subscribe('event')`, `@Subject('event')`. À étendre en Story 0.7 quand le wrapper NATS est livré.
- **D7** — `RegisterCustomerSchema.password` n'a que `min(12).max(128)`, pas de complexité (regex caractères spéciaux/chiffres) ni normalisation NFKC. À durcir en Epic 1 (Story 1.2 customer registration).
- **D8** — `@tukio/contracts` expose ses sources `.ts` directement via `exports` field. Fonctionne sous bundler (Next.js, Vitest) mais Node ne peut pas exécuter `.ts` sans loader. Story 0.6 ajoutera un script `build` qui émet `dist/` + mettra à jour `exports` pour pointer vers `dist/` quand les services NestJS commenceront à consommer au runtime.

## Deferred from: code review of 0-3-setup-design-system-tailwind-v4-tukio-ui (2026-05-09)

- **W1** — Full-height flex shell `min-h-full flex flex-col` retiré de `<body>` (apps/*/layout.tsx). Décision intentionnelle pour les apps placeholder ; les pages gèrent leur propre hauteur (`min-h-screen`). À revisiter si un layout composite a besoin d'un shell fixe.
- **W2** — `h5`, `h6` absents du heading reset globals.css. Spec AC3 définit h1-h4 uniquement. À inclure explicitement si des composants Story 0.4+ utilisent h5/h6.
- **W3** — `a { text-decoration: none; color: inherit }` WCAG 1.4.1 (globals.css). Requis par spec AC3, tradeoff connu. Chaque composant doit restaurer le soulignement ou un contraste suffisant. À documenter dans la contribution guide Story 0.4.
- **W4** — `--animate-modal-enter` / `--animate-shimmer` absents de `@theme{}` — pas de utility class Tailwind générée. Keyframes définis pour usage manuel CSS direct. Ajouter `--animate-*` en Story 0.5 quand les patterns consomment ces animations.
- **W5** — `--breakpoint-xs: 0px` always-active (theme.css + breakpoints.ts). Spécifié AC1. Tradeoff sémantique : `xs:` utility = toujours vrai. Documenter dans le guide tokens Story 0.4 : "xs: base mobile — pas de guard min-width".
- **W6** — Fraunces `weight: 'variable'` au lieu du weight array (apps/*/layout.tsx). Déviation documentée dans le Dev Agent Record, forcée par Next.js validation (axes + weight array incompatibles). Valide techniquement.
- **W7** — `tsd` absent des devDependencies (packages/ui/package.json). Alternative inline `AssertEqual<A, B>` choisie. Équivalent fonctionnel per spec "tsd ou expect-type".
- **W8** — Bouton placeholder sans `onClick` (apps/public/page.tsx). Placeholder cosmétique pour Lighthouse. Remplacé par vrai composant Button en Story 0.4.
- **W9** — `text-wrap: balance/pretty` support partiel (~75% / Chrome-only). Requis par spec. Progressive enhancement acceptable pour Sprint 0 placeholder.

## Deferred from: code review of 0-6-pattern-pretre-scaffolding-template-identity-svc (2026-05-10)

- **D1** — `ResponseEnvelopeInterceptor` statusCode hardcodé 200 si un futur controller uses `@HttpCode(201)` avec Express adapter — pas de controller non-200 actuellement, aucun impact.
- **D2** — `EMAIL_REGEX` permissif (accepte double dots, leading hyphens dans domain part) — acceptable MVP, à durcir si conformité RFC 5321 stricte requise en Epic 1+.
- **D3** — `Email.create` avec TypeORM partial hydration (`select()` sans `email`) retourne 422 au lieu de 500 — colonne `email NOT NULL`, cas pratiquement impossible sans requête explicitement partielle.
- **D4** — `sed_inplace` détection BSD/GNU fragile sur Linux exotique (Nix, etc.) — fonctionne macOS + Linux standard (Ubuntu, Alpine CI).
- **D5** — Script `--force` ne nettoie pas les fichiers orphelins d'un run `replicate-pretre-structure.sh` partiel interrompu — à améliorer si le script est utilisé fréquemment (Story 0.7+).
- **D6** — `buildMeta` locale non-supportée silencieusement mappée à `'fr'` sans log ni warning — acceptable tant que seuls FR/EN sont supportés (Story 7.1 next-intl ajoutera routing locale).
- **D7** — `asEnvelopeMethod` mappe `OPTIONS/HEAD` → `'GET'` dans l'enveloppe — pas d'endpoints CORS/HEAD actuels, à corriger quand CORS sera configuré (Story 0.11 CI ou Epic 7).
- **D8** — AC6: `toUserProfileResponseDto()` standalone function vs `UserProfileMapper.toResponseDto()` static method (spec) — fonctionnellement identique, renommage cosmétique.
- **D9** — AC9: Index UNIQUE séparé vs contrainte `UNIQUE` inline dans la migration — fonctionnellement identique au niveau DB PostgreSQL.
- **D10** — AC9: Scripts migration `tsx ./node_modules/typeorm/cli.js` vs `typeorm-ts-node-esm` — fonctionnellement équivalent, à standardiser lors de la Story 0.11 CI setup.
- **D11** — AC12: `jest.config.ts` sans threshold `infrastructure/` (couvert par `pnpm test:e2e:cov`) — threshold séparé pragmatique, à consolider en mono-run Jest dans Story 0.11.
- **D12** — AC13: `tokens.template.ts` sentinel/fichier virtuel dans `REPLICATE_FILES` — fonctionne mais design inhabituel ; remplacer par un vrai fichier template si le script est étendu.

## Deferred from: code review of 0-7-setup-tukio-messaging-nats-jetstream (2026-05-10)

- **D1** — `NatsJetStreamClient.subscribe()` retourne void sans handle de stop — aucun moyen d'arrêter la consumer loop ou de détecter son arrêt silencieux. Architectural decision Sprint 0 ; à adresser avec lifecycle management des consumers (Epic 5+, notification-svc).
- **D2** — LISTEN failure silencieuse : aucun log/metric si `LISTEN tukio_outbox_new` échoue au boot — relay tombe en polling-only sans signal opérateur. Story 0.12 (structured logging + Alertmanager).
- **D3** — DLQ = status `failed` en DB uniquement, pas un subject NATS actif — AC4 et commentaire TODO code explicitent que DLQ routing (stream `tukio.dlq`) est out-of-scope Story 0.7. Story 0.12.
- **D4** — `notifyPool` optionnel : si wired, `pg_notify` fire avant commit tx externe → spurious wakeups (pas de corruption, relay SKIP LOCKED couvre). Code path mort car `OUTBOX_NOTIFY_POOL` jamais wired actuellement. À corriger si pool activé.
- **D5** — Race onModuleDestroy : pollTimer peut firer entre start de destroy et clearInterval — fenêtre ~0ms en Node.js event loop, SKIP LOCKED + NATS drain couvrent la cohérence. Très faible impact.
- **D6** — DB password visible dans options du module si `DEBUG=*` NestJS — convient Sprint 0 (pas de prod). Story 0.12 secrets management (Vault / K8s sealed secrets).

## Deferred from: code review of 0-8-setup-tukio-auth-backend-frontend (2026-05-10)

- **D-F1** — Marker cookie `tukio-session-active` non-validé côté frontend (anyone can set marker) — déférée : mitigée par enforcement JWT côté backend (cookie HttpOnly access-token est source-of-truth, marker = hint UX). Re-revue si gateway-api change le contract Story Epic 1+.
- **D-F2** — `prom-client` Counter au module-load level (collision risk hot-reload) — déférée : pattern figé Story 0.7 (mêmes specs ont passé code review). Fix global si problème survient en CI.
- **D-F3** — WebAuthn / FIDO2 / `mfa` amr non accepté (TOTP-only) — déférée : MVP TOTP-only par décision Story 1.7. Ré-évaluer V2 quand WebAuthn est mis en production.
- **D-F4** — `<AuthProvider>` config change ignoré post-mount (multi-tenant scenario) — déférée : multi-tenant pas au scope MVP.
- **D-F5** — `hasSessionCookie()` exact match `=1` — déférée : cohérent avec set côté gateway-api Story Epic 1+.
- **D-F6** — SSR hydration mismatch (flash unauth content au mount) — déférée : UX-only, à traiter avec Suspense + skeleton dans Story Epic 1+ (gateway-api SSR-safe cookies).
- **D-F7** — `jwks-rsa` mock test pas de cache — déférée : tests E2E uniquement, ré-évaluer Story 0.9 (testcontainers Keycloak réel).
- **D-F8** — Public-key rotation race window — déférée : Keycloak grace period standard, doc Story 1.1.
- **D-F9** — Infinite redirect loop quand `loginRedirectUri` matches `protectedPaths: ['/']` — déférée : edge case opérationnel, à wirer Story Epic 1+ avec Keycloak réel.

## Deferred from: dev-mode runtime fix for identity-svc (2026-05-10)

> **Contexte** : `pnpm dev` cassait sur identity-svc avec `Cannot find module dist/main`. Cause profonde : path mapping `@tukio/*` → `./packages/*/src` (sources TS) + `package.json` `exports` qui pointent vers TS sources → Node ne peut pas exécuter au runtime. Fix appliqué : NestJS webpack mode + custom `webpack.config.js` qui (a) ajoute `extensionAlias: { '.js': ['.ts', '.js'] }` pour nodenext imports, (b) bundle les `@tukio/*` packages au lieu de les externalize. dist/main.js redevient flat. Tests + builds OK.

- **W1** — Story 0.2 D8 (build packages first + dist/ exports) reste **non résolu**. Le webpack bundle est un workaround : il ne propage pas les benefits d'ESM tree-shaking entre packages, et chaque service va dupliquer le bundle de @tukio/* dans son dist/main.js. À résoudre en Story 0.10 (Docker Compose) ou Story 0.11 (CI) — quand on aura plusieurs services réels en prod.
- **W2** — Les 9 autres services NestJS (gateway-api, catalog-svc, booking-svc, payment-svc, order-svc, messaging-svc, notification-svc, review-svc, media-svc) tournent encore avec `nest start --watch` (sans webpack) **uniquement parce qu'ils sont des scaffolds vides** ne consommant pas `@tukio/*` packages. Dès qu'ils commenceront à consommer `@tukio/contracts`, `@tukio/auth`, `@tukio/messaging` (Stories Epic 2-7), ils casseront avec le même symptôme. Migration : copier `webpack.config.js` + `nest-cli.json` updates + scripts `package.json` d'identity-svc lors du scaffolding via `replicate-pretre-structure.sh` (Story 0.6 Task 12).
- **W3** — `webpack.config.js` actuel d'identity-svc inline une regex `/^@tukio\//` pour détecter les workspace packages. À factoriser dans un fichier partagé `webpack.tukio.config.js` au workspace root quand W2 sera traitée.
- **W4** — Mode debug Node DevTools (`--inspect`) a été préservé dans `start:debug` mais pas re-testé. À valider quand on aura un cas concret de debug runtime.

## Deferred from: code review of 0-9-setup-tukio-api-client-i18n-client-testing (2026-05-11)

- **D-09-1** — AC17 migration Story 0.7 chaos test (`it.skip` → `it()` real testcontainer) + Story 0.8 e2e (nock JWKS mock → real Keycloak testcontainer). Infrastructure shipped Story 0.9 (`startNatsContainer`, `startKeycloakContainer`). Migration deferred Story 0.11 quand le tag `@nightly` séparera fast (mocks) / slow (testcontainers) tests CI.
- **D-09-2** — `formatPercent` doesn't validate `value > 1` (caller error : passe `5` au lieu de `0.05`). Caller-responsibility, documenter via JSDoc + types stricter. Pas de fix code.
- **D-09-3** — `meilisearch.helper.ts` utilise `version: 'latest'` (CI flake risk si Meilisearch ships breaking minor). Pin à v1.10 explicite lors de Story 0.10 (Docker Compose pinning).
- **D-09-4** — `nats.helper.ts` `client.drain()` après pause peut laisser connection ouverte. Best-effort cleanup OK pour le MVP, raffiner usage chaos-test réel Story 0.11.
- **D-09-5** — `useCurrentLocale` throws inside React render (no Error Boundary required). Stories Epic 1+ wirent Error Boundary niveau app. Pattern documenté dans `@tukio/i18n-client/README.md`.

## Deferred from: code review of 0-10-docker-compose-dev-local-bootstrap-scripts (2026-05-13)

- **D-10-1** — Keycloak healthcheck dépend du whitespace JSON littéral (`grep -q '"status": "UP"'`). Fragile mais fonctionne ; refactor attendra que Keycloak 26+ offre un endpoint plus standardisé. [`infra/docker-compose/docker-compose.dev.yml:81-85`]
- **D-10-2** — `KC_HOSTNAME=localhost` bake une assumption host-only. Tokens issued avec `iss: http://localhost:8080`. Si un service backend doit tourner en container (Story 0.12+), JWT validation casse sur mismatch. Intentionnel pour le workflow Sprint 0 (services en host via `pnpm dev`). [`infra/docker-compose/docker-compose.dev.yml:69`]
- **D-10-3** — Pre-existing identity-svc unit-test bug : `apps/identity-svc/jest.config.ts` manque le mapping `^@tukio/contracts/exceptions/domain$` (présent dans `test/jest-e2e.json`). Vérifié sur baseline `develop`, même échec — pas une régression Story 0.10. Hors scope ; à fixer en code review identity-svc dédiée.
- **D-10-4** — Race concurrente bootstrap-databases / bootstrap-keycloak-realm (deux devs ou dev+CI sur même DB). Pas réaliste en pratique ; advisory_lock à ajouter si CI/CD parallélise un jour.
- **D-10-5** — `kcadm.sh update realms/{name}` patche les fields fournis mais ne supprime pas les fields retirés du JSON local. Quirk Keycloak documenté ; idempotence partielle.
- **D-10-6** — `$PSQL` interpolé non-quoté dans bootstrap-databases.sh. Fonctionne pour les paramètres connus ; refactor en bash array serait plus propre. [`infra/scripts/bootstrap-databases.sh:34`]
- **D-10-7** — Migration Ctrl-C laisse état half-applied. Concern TypeORM-level (pas de migrations transactionnelles all-or-nothing natives), pas réglable côté script.
- **D-10-8** — README `Conventional commits` indentation potentiellement régressée par le diff Story 0.10. À re-vérifier visuellement, cosmétique. [`README.md` Conventions]
- **D-10-9** — `seed-categories.ts` UPDATE service_types est destructif (clobbers manual additions dev). Acceptable pour un seed dev ; `array_cat` + `DISTINCT` serait plus respectueux mais YAGNI MVP. [`infra/scripts/seed-categories.ts:168-171`]
- **D-10-10** — `echo $REALM_JSON | kcadm -f -` SIGPIPE truncation possible si kcadm fail-fast. Refactor en mktemp file serait propre ; pas observé en pratique. [`infra/scripts/bootstrap-keycloak-realm.sh:64-72`]
- **D-10-11** — `COMPOSE_PROFILE` env override non validé contre les profils déclarés. Si typo, stack démarre incomplet. Defensive coding à ajouter Story 0.11. [`infra/scripts/run-chaos-tests.sh:11-12`]
- **D-10-12** — `tukio_test_postgres` collision avec stack pré-existant `pnpm docker:test:up`. CI runners fresh, dev rare ; warning serait nice-to-have.
- **D-10-13** — Pas de doctor script pour détecter un `.env.local` Story 0.6 obsolète (`tukio_identity_user`/`changeme`). Le `pnpm dev` échouera de manière confuse pour ces devs. À ajouter Story 0.11 (CI doctor) ou Story 1.10.
- **D-10-14** — `KCADM` string interp re-exec `docker exec` à chaque iter (~20 fois). Optimisation mineure (~200ms total) ; refactor en function avec one-time check possible. [`infra/scripts/bootstrap-keycloak-realm.sh:24`]
- **D-10-15** — `tmpfs:512m` pour Postgres test peut OOM sur runners CI petits (< 4 GB RAM). Documenter min-RAM dans Story 0.11 README CI. [`infra/docker-compose/docker-compose.test.yml:21-22`]
- **D-10-16** — Admin TOTP MFA non effectivement enforcé pour `tukio-admin`. Conditional OTP élevée à REQUIRED **realm-wide** (pas per-client) + sans seeding admin user avec required-action `configure-totp`, les admins peuvent toujours se connecter sans TOTP. Spec FR9 + NFR12 partiellement délivré. **→ Story 1.7** wire auth flow override per-client + admin user seeding. [`infra/scripts/bootstrap-keycloak-realm.sh:213-225`]
- **D-10-17** — Wildcard redirect URI `https://*.tukio.one/*` committé dans `realm-export.json` (consommé par Story 0.9 testcontainers). Vecteur de phishing si subdomain compromis. **Kept intentionnellement** pour preview envs Vercel (`pr-*.tukio.one`) + staging. **→ Story 0.12** override prod plus strict via Phasetwo. [`infra/scripts/bootstrap-keycloak-realm.sh:128`]
- **D-10-18** — `seed-categories.ts` service_types curated divergent du spec littéral (pop-up tents sans lighting/dismantling, linens sans setup, dance-floors avec dismantling). **Kept curated** comme MVP réaliste. **→ Story 3.1** valide les service_types canoniques avec product owner. [`infra/scripts/seed-categories.ts:60-220`]

## Deferred from: code review of 0-11-ci-github-actions-pipeline (2026-05-14)

- **DF1** — Dockerfile `pnpm deploy --legacy /deploy` may miss runtime files (`nest-cli.json`, `.env.example`, `tsconfig.<svc>.json`). Validated locally for identity-svc (462 MB image, healthcheck OK), but full coverage on the 9 other services pends live Story 0.12 K8s rollout. Re-validate during 0.12.
- **DF2** — `HEALTHCHECK curl /health` baked into all 10 Dockerfiles, but only identity-svc currently implements `/health` (Story 0.8). Other services will add it in their Epic 1+ stories. Containers may stay `unhealthy` in K8s until each service ships its endpoint.
- **DF3** — `lighthouse-ci.yml` does not yet emit a PR comment when LCP/CLS regresses > 10 % vs `main` (AC2 last sub-bullet). Dev Notes mark this as V1+ extension; reopen as a follow-up story when historical Lighthouse baselines stabilise (LHCI Server self-hosted, post-MVP).
- **DF4** — `tukio/no-hardcoded-text` has no autofix (AC3 said "best-effort"). Add `suggest` for `useTranslations()` wrapping in a future iteration when typed `t()` patterns are settled.
- **DF5** — `deploy-staging.yml` + `deploy-production.yml` are placeholders per Story 0.11 scope; Story 0.12 finalises ArgoCD wiring. The `workflow_run` chain from Build Images means frontend-only merges currently skip the staging trigger — to be revisited in 0.12 with separate frontend deploy paths or unified `push: main` trigger.
