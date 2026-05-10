# Story 0.6: Pattern Pretre scaffolding template in identity-svc + replication script

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

**As a** tech lead (équipe Sprint 0),
**I want** the **Pattern Pretre Clean Architecture** scaffolded **canoniquement** dans `apps/identity-svc/` (premier service backend), avec une démonstration end-to-end du pattern via 1 aggregate (`UserProfile`), 3 ports (repository + KeycloakSync + EventPublisher) + leurs implémentations placeholder, 1 use case réel (`GetUserProfileById`) testé en isolation (mocks ports), 1 controller HTTP exposant l'endpoint `/v1/users/:id` qui consomme le use case via `UseCaseProxy`, configuration TypeORM + DataSource + 1 migration baseline, configuration `eslint-plugin-boundaries` strict qui rejette toute violation domain → infrastructure, ET un **script de replication** `infra/scripts/replicate-pretre-structure.sh --target=<service>` qui copie la structure (sans logique métier) dans les 9 autres services en une commande,
**so that** les 10 microservices backend partent de la **même structure exacte** (cohérence maximum, dette technique zéro), un dev qui ouvre n'importe quel service trouve `domain/`, `usecases/`, `infrastructure/` aux mêmes endroits avec les mêmes conventions, le `eslint-plugin-boundaries` rejette toute PR qui pollue le `domain/` avec un `import { Repository } from 'typeorm'`, et la story 1.1 (Provision Keycloak realm) peut commencer immédiatement avec un service `identity-svc` fonctionnel + l'endpoint health/ready exposé.

> **Outcome attendu** : à la fin de cette story, `pnpm --filter=identity-svc dev` démarre le service sur port 4001 avec `/health` 200 OK + `/ready` 200 OK + `/v1/users/test-uuid` retourne 404 (pas de user en DB) ou 200 avec UserProfile mock, `pnpm --filter=identity-svc test` passe avec ≥ 80 % coverage `domain/`, ≥ 70 % `usecases/`, ≥ 50 % `infrastructure/` (NFR71), et `bash infra/scripts/replicate-pretre-structure.sh --target=catalog-svc --dry-run` affiche la liste des fichiers qu'il créerait dans `apps/catalog-svc/`.

## Acceptance Criteria

1. **AC1 — Structure dossiers Pattern Pretre exacte dans identity-svc** : Given `apps/identity-svc/src/`, When je l'ouvre, Then je trouve **strictement** cette arborescence (alignée avec Architecture lignes 168-216 + 1161-1208) :
   ```
   apps/identity-svc/src/
   ├─ main.ts                                          # bootstrap NestJS Fastify adapter (port 4001)
   ├─ app.module.ts                                    # imports + UseCasesProxyModule.register()
   ├─ domain/                                          # ZERO dépendance externe (NestJS, TypeORM, axios, etc.)
   │  ├─ model/                                        # Aggregates + Value Objects
   │  │  ├─ user-profile.aggregate.ts                  # Aggregate root avec invariants métier
   │  │  ├─ user-role.enum.ts                          # client | pro | admin-support | admin-modo | admin-super
   │  │  └─ email.value-object.ts                      # Value Object immutable + validation
   │  ├─ ports/                                        # INTERFACES (jamais implémentations)
   │  │  ├─ user-profile.repository.port.ts            # interface IUserProfileRepository
   │  │  ├─ keycloak-sync.port.ts                      # interface IKeycloakSync (placeholder pour Story 1.1)
   │  │  ├─ event-publisher.port.ts                    # interface IEventPublisher (placeholder pour Story 0.7)
   │  │  └─ tokens.ts                                  # Symbol DI tokens SCREAMING_SNAKE_CASE
   │  ├─ service/                                      # Domain services stateless (vide au scaffolding, exemple posé)
   │  │  └─ .gitkeep
   │  └─ exception/                                    # Domain exceptions (héritent de DomainException base)
   │     ├─ domain.exception.ts                        # base class — `tukioCode`, `httpStatus`, `title`
   │     └─ user-profile-not-found.exception.ts        # exemple concret (404 + USER-NOT-FOUND-001)
   ├─ usecases/                                        # 1 classe par use case, méthode .execute()
   │  ├─ get-user-profile.usecase.ts                   # 1 use case démonstratif
   │  └─ get-user-profile.usecase.spec.ts              # tests unit avec mocks ports (≥ 90 % coverage)
   └─ infrastructure/                                  # IMPLEMENTATIONS concrètes des ports
      ├─ persistence/
      │  └─ typeorm/
      │     ├─ entities/
      │     │  └─ user-profile.entity.ts               # Entity TypeORM avec décorateurs
      │     ├─ repositories/
      │     │  └─ user-profile.typeorm.repository.ts   # implements IUserProfileRepository
      │     ├─ mappers/
      │     │  └─ user-profile.mapper.ts               # entity ↔ aggregate
      │     ├─ migrations/
      │     │  └─ 1715200000000-CreateUserProfilesBaseline.ts
      │     ├─ data-source.ts                          # TypeORM DataSource + config
      │     └─ typeorm-repositories.module.ts          # NestJS module qui wire entités + repos
      ├─ messaging/
      │  └─ nats/
      │     ├─ nats.publisher.ts                       # implements IEventPublisher (placeholder Story 0.7)
      │     └─ nats-publisher.module.ts
      ├─ external/
      │  └─ keycloak/
      │     ├─ keycloak.service.ts                     # implements IKeycloakSync (placeholder Story 1.1)
      │     └─ keycloak.module.ts
      ├─ http/
      │  ├─ controllers/
      │  │  ├─ user.controller.ts                      # GET /v1/users/:id consume UseCaseProxy
      │  │  └─ health.controller.ts                    # /health (liveness) + /ready (readiness)
      │  ├─ dtos/
      │  │  └─ user-profile-response.dto.ts            # Zod schema depuis @tukio/contracts si dispo, sinon local
      │  ├─ guards/
      │  │  └─ .gitkeep                                # KeycloakJwtGuard arrive en Story 0.8 via @tukio/auth
      │  ├─ interceptors/
      │  │  └─ response-envelope.interceptor.ts        # ADR-014 — wrap responses en SuccessEnvelope
      │  ├─ filters/
      │  │  └─ envelope-exception.filter.ts            # ADR-014 — wrap exceptions en ErrorEnvelope
      │  └─ http.module.ts                             # NestJS module qui wire controllers + interceptor + filter
      ├─ logger/
      │  └─ pino-logger.service.ts                     # adapter ILogger (Pino, Fastify-friendly)
      ├─ config/
      │  ├─ environment-config.service.ts              # adapter IConfigService (lit env vars typées)
      │  └─ config.module.ts                           # NestJS ConfigModule wired global
      ├─ exception/
      │  └─ .gitkeep                                   # cross-cutting exceptions (rare)
      └─ usecases-proxy/
         ├─ usecases-proxy.ts                          # generic class UseCaseProxy<T>
         └─ usecases-proxy.module.ts                   # DynamicModule centrale wire ports → impls
   ```
   **Aucun** fichier supplémentaire au scaffolding. Aucun fichier manquant.

2. **AC2 — Aucune pollution `domain/` (lint enforce)** : Given `apps/identity-svc/src/domain/`, When je le scanne via `pnpm --filter=identity-svc lint`, Then **aucun import** de :
   - `@nestjs/*` (pas de décorateurs `@Injectable()`, `@Module()` dans `domain/`)
   - `typeorm` (aucun import `Repository`, `EntityManager`, `@Column`, etc.)
   - `axios`, `fetch`, `node:http`, `pg`, `keycloak-connect`, `stripe`, etc. (aucun SDK / lib I/O)
   - `@tukio/messaging` ou `@tukio/auth` (libs infrastructure-only)
   - **Seuls imports autorisés dans `domain/`** : `@tukio/contracts/types/*` (types Actor, Locale, Money, DomainEvent — purs TS), autres modules `domain/*` du même service, dépendances Node natives type-only (`type { ReadonlyDeep }`, `import type {...}`)
   - **Vérifié par `eslint-plugin-boundaries`** (config Tukio en AC8) → toute violation → CI rejette la PR

3. **AC3 — Symbol DI tokens nommés SCREAMING_SNAKE_CASE** : Given `apps/identity-svc/src/domain/ports/tokens.ts`, When je l'ouvre, Then je trouve **exactement** ces tokens exportés :
   ```ts
   export const USER_PROFILE_REPOSITORY = Symbol('USER_PROFILE_REPOSITORY');
   export const KEYCLOAK_SYNC = Symbol('KEYCLOAK_SYNC');
   export const EVENT_PUBLISHER = Symbol('EVENT_PUBLISHER');
   export const LOGGER = Symbol('LOGGER');
   export const CONFIG_SERVICE = Symbol('CONFIG_SERVICE');
   ```
   - Convention nommage strict (Architecture ligne 1141 + memory `feedback_clean_architecture_explicit.md`) : nom du token = nom du port en SCREAMING_SNAKE_CASE
   - `Symbol(...)` (et non `Symbol.for(...)`) pour garantir l'unicité absolue (chaque service a ses propres tokens, pas de risque de collision cross-service)

4. **AC4 — `UseCaseProxy<T>` + `UseCasesProxyModule` (DynamicModule central)** : Given `apps/identity-svc/src/infrastructure/usecases-proxy/`, When je l'ouvre, Then je trouve :
   - `usecases-proxy.ts` :
     ```ts
     export class UseCaseProxy<T> {
       constructor(private readonly useCase: T) {}
       getInstance(): T { return this.useCase; }
     }
     ```
   - `usecases-proxy.module.ts` (DynamicModule NestJS) :
     ```ts
     @Module({})
     export class UseCasesProxyModule {
       static GET_USER_PROFILE_USECASES_PROXY = 'GET_USER_PROFILE_USECASES_PROXY';

       static register(): DynamicModule {
         return {
           module: UseCasesProxyModule,
           imports: [TypeORMRepositoriesModule, NatsPublisherModule, KeycloakModule, ConfigurationModule, LoggerModule],
           providers: [
             {
               inject: [USER_PROFILE_REPOSITORY],
               provide: UseCasesProxyModule.GET_USER_PROFILE_USECASES_PROXY,
               useFactory: (userProfileRepo: IUserProfileRepository) =>
                 new UseCaseProxy(new GetUserProfileByIdUseCase(userProfileRepo)),
             },
           ],
           exports: [UseCasesProxyModule.GET_USER_PROFILE_USECASES_PROXY],
         };
       }
     }
     ```
   - Le **wiring port → impl** se fait UNIQUEMENT ici (pas dans les use cases, pas dans les controllers). C'est le **seul endroit** où le domaine touche l'infrastructure.

5. **AC5 — Use case `GetUserProfileById` 100 % testé via mocks ports** : Given `apps/identity-svc/src/usecases/get-user-profile.usecase.ts`, When je l'ouvre, Then je trouve :
   - Classe `GetUserProfileByIdUseCase` avec constructeur `constructor(private readonly userProfileRepo: IUserProfileRepository)` (DI via Symbol)
   - Méthode `async execute(input: { userId: string }): Promise<UserProfile>` qui :
     - Délègue à `this.userProfileRepo.findById(input.userId)`
     - Throw `UserProfileNotFoundException(input.userId)` si retour `null`
     - Return l'aggregate `UserProfile` directement (le mapper DTO se fait dans le controller)
   - **Aucune dépendance NestJS** dans le fichier (pas de `@Injectable()`, le wiring est dans `usecases-proxy.module.ts`)
   - Tests `get-user-profile.usecase.spec.ts` :
     - **2 tests minimum** : (1) found case → retourne UserProfile, (2) not-found case → throw `UserProfileNotFoundException` avec `tukioCode: USER-NOT-FOUND-001`
     - Mock `IUserProfileRepository` : `const repo: IUserProfileRepository = { findById: vi.fn() }` (Jest fn ou Vitest fn — voir versions)
     - **Pas de testcontainers** (`@tukio/testing` arrive Story 0.9, ici pure TS isolation)
     - Coverage du use case ≥ 90 %

6. **AC6 — Controller HTTP `GET /v1/users/:id` avec UseCaseProxy + envelope ADR-014** : Given `apps/identity-svc/src/infrastructure/http/controllers/user.controller.ts`, When je l'ouvre, Then je trouve :
   ```ts
   @Controller('/v1/users')
   export class UserController {
     constructor(
       @Inject(UseCasesProxyModule.GET_USER_PROFILE_USECASES_PROXY)
       private readonly getUserProfileUseCaseProxy: UseCaseProxy<GetUserProfileByIdUseCase>,
     ) {}

     @Get(':id')
     async getUser(@Param('id') id: string): Promise<UserProfileResponseDto> {
       const userProfile = await this.getUserProfileUseCaseProxy.getInstance().execute({ userId: id });
       return UserProfileMapper.toResponseDto(userProfile);
     }
   }
   ```
   - Retourne **directement le DTO nu** (pas d'enveloppe wrap manuelle) — l'interceptor global `ResponseEnvelopeInterceptor` (AC10) wrap automatiquement en `SuccessEnvelope` (cohérent ADR-014 + memory `feedback_api_envelope_response.md`)
   - Si throw `UserProfileNotFoundException` → l'`EnvelopeExceptionFilter` global (AC10) wrap en `ErrorEnvelope` avec `httpStatus: 404`, `tukioCode: USER-NOT-FOUND-001`
   - **Pas de `KeycloakJwtGuard`** appliqué à ce stade (Story 0.8 le fournira via `@tukio/auth`, Story 1.4 l'appliquera aux endpoints sensibles)
   - **Smoke test E2E** : `apps/identity-svc/test/user.e2e-spec.ts` (NestJS standard) qui démarre l'app + appelle `GET /v1/users/test-uuid` → vérifie `404` enveloppé `{ method: 'GET', code: 404, error: { tukioCode: 'USER-NOT-FOUND-001', ... }, meta: { ... } }`

7. **AC7 — Health/Ready endpoints** : Given `apps/identity-svc/src/infrastructure/http/controllers/health.controller.ts`, When je l'ouvre, Then je trouve :
   - `GET /health` : retourne `{ status: 'ok' }` immédiatement (liveness probe K8s — Story 0.12)
   - `GET /ready` : check que la connexion DB Postgres est UP (via `dataSource.isInitialized`) + retourne `{ status: 'ready', dependencies: { postgres: 'up' } }`. Si DB DOWN → 503 + `{ status: 'not-ready', dependencies: { postgres: 'down' } }`
   - **Pas de `/metrics`** dans cette story (Story 0.12 cable Prometheus)
   - Test E2E : `health.e2e-spec.ts` vérifie `/health` retourne 200 même sans DB, `/ready` retourne 503 si DB DOWN

8. **AC8 — `eslint-plugin-boundaries` config strict pour Pattern Pretre** : Given `.eslintrc.cjs` racine (étendu Story 0.1 avec slot `eslint-plugin-boundaries` warn placeholder), When je l'ouvre, Then la config Pattern Pretre **STRICTE** est en place :
   ```js
   {
     plugins: ['boundaries', /* ...autres plugins existants */],
     settings: {
       'boundaries/elements': [
         { type: 'domain', pattern: 'apps/*-svc/src/domain/**', mode: 'folder' },
         { type: 'usecases', pattern: 'apps/*-svc/src/usecases/**', mode: 'folder' },
         { type: 'infrastructure', pattern: 'apps/*-svc/src/infrastructure/**', mode: 'folder' },
         { type: 'app', pattern: ['apps/*-svc/src/app.module.ts', 'apps/*-svc/src/main.ts'], mode: 'file' },
       ],
       'boundaries/include': ['apps/*-svc/src/**'],
     },
     rules: {
       'boundaries/element-types': ['error', {
         default: 'disallow',
         rules: [
           { from: 'domain', allow: ['domain'] },                          // domain → domain ONLY
           { from: 'usecases', allow: ['domain', 'usecases'] },            // usecases → domain + usecases
           { from: 'infrastructure', allow: ['domain', 'infrastructure'] },// infrastructure → domain + infrastructure (NE PAS importer usecases !)
           { from: 'app', allow: ['domain', 'usecases', 'infrastructure'] },// app/main.ts → tout
         ],
       }],
       'boundaries/external': ['error', {
         default: 'allow',
         rules: [
           {
             from: 'domain',
             disallow: ['@nestjs/*', 'typeorm', 'axios', 'pg', 'keycloak-connect', 'stripe', '@tukio/messaging', '@tukio/auth', /* libs I/O interdites */],
             message: '🚫 Pattern Pretre violation: domain/ must not import I/O libs. Move to infrastructure/.',
           },
         ],
       }],
     },
   }
   ```
   - **Frontend boundaries** (features) : pas dans cette story (Story 0.4 a déjà câblé les imports tree-shaking via `tukio/no-barrel-import-ui`, et Story 0.13 ajoutera `eslint-plugin-boundaries` côté `apps/<app>/src/features/*`)
   - **Test de la rule** : créer un fichier de test temporaire `apps/identity-svc/src/domain/test-violation.ts` avec `import { Repository } from 'typeorm';` → `pnpm lint` DOIT failer → SUPPRIMER le fichier après vérification (pas de commit)

9. **AC9 — Configuration TypeORM + DataSource + 1 migration baseline** : Given `apps/identity-svc/src/infrastructure/persistence/typeorm/data-source.ts`, When je l'ouvre, Then je trouve :
   - `DataSource` TypeORM configuré avec :
     - `type: 'postgres'`, `host`/`port`/`username`/`password`/`database` lus depuis `EnvironmentConfigService` (env vars `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` — defaults pour Story 0.10 Docker Compose : `localhost:5432`, `tukio_identity` DB, user `tukio_identity_user`)
     - `entities: [UserProfileEntity]` (path-based glob OK aussi : `entities: [join(__dirname, 'entities/*.entity.{ts,js}')]`)
     - `migrations: [join(__dirname, 'migrations/*.{ts,js}')]`
     - `migrationsRun: false` (run via `pnpm --filter=identity-svc migration:run`, jamais auto au boot)
     - `synchronize: false` (NEVER sync prod, migrations only — NFR83)
     - `logging: ['error', 'warn', 'migration']` (verbose `query` uniquement en dev via env var `DB_VERBOSE=true`)
   - 1 migration `1715200000000-CreateUserProfilesBaseline.ts` qui crée la table `user_profiles` avec :
     - `id UUID PRIMARY KEY`
     - `keycloak_user_id UUID UNIQUE NOT NULL` (lien vers Keycloak — réf : `tukio_identity_user_id`)
     - `email VARCHAR(255) UNIQUE NOT NULL` (validated VO `Email`)
     - `first_name VARCHAR(80) NOT NULL`, `last_name VARCHAR(80) NOT NULL`
     - `role VARCHAR(20) NOT NULL CHECK (role IN ('client', 'pro', 'admin-support', 'admin-modo', 'admin-super'))`
     - `locale VARCHAR(2) NOT NULL DEFAULT 'fr' CHECK (locale IN ('fr', 'en'))`
     - `created_at TIMESTAMPTZ DEFAULT NOW()`, `updated_at TIMESTAMPTZ DEFAULT NOW()`
     - `deleted_at TIMESTAMPTZ NULL` (soft-delete RGPD — Story 1.9 V1)
     - Index : `idx_user_profiles_keycloak_user_id`, `idx_user_profiles_email_active` (où `deleted_at IS NULL`)
   - **Pas encore d'`outbox` ni d'`inbox` tables** dans cette migration (Story 0.7 `@tukio/messaging` les ajoutera via une migration `1715210000000-CreateOutboxInboxTables.ts` séparée)
   - Scripts `apps/identity-svc/package.json` : `"migration:generate"`, `"migration:run"`, `"migration:revert"` (cohérent NFR72 rollback obligatoire)

10. **AC10 — Interceptor + Filter ADR-014 enveloppe REST canonique** : Given `apps/identity-svc/src/infrastructure/http/interceptors/response-envelope.interceptor.ts` + `filters/envelope-exception.filter.ts`, When je les ouvre, Then ils implémentent **strictement** la spec ADR-014 (Architecture lignes 1408-1470 + memory `feedback_api_envelope_response.md`) :
   - `ResponseEnvelopeInterceptor` :
     - Wrap toute response success en `SuccessEnvelope` (`{ method, code, data, pagination?, meta }`) — type importé depuis `@tukio/contracts/envelope` (Story 0.2)
     - `meta.timestamp` = ISO 8601 UTC, `meta.correlationId` = lit depuis `request.correlationId` (placeholder middleware Story 0.7 `@tukio/messaging` ajoutera la propagation), `meta.locale` = lit depuis header `X-Tukio-Locale` ou default `'fr'`
     - Si retour est array → injecter `pagination` depuis `response.locals.pagination` (set par le controller si applicable)
     - Si retour est `null`/`undefined` → `data: null` (cohérent spec)
   - `EnvelopeExceptionFilter` :
     - Catch toute exception (`@Catch()` global)
     - Si exception est `DomainException` (ou héritée) → utiliser `exception.tukioCode`, `exception.httpStatus`, `exception.title`, sérialiser en `ErrorBody` avec `type: 'https://tukio.one/errors/<slug>'`, `instance: request.url`
     - Si exception est `ZodError` (validation) → `httpStatus: 422`, `tukioCode: VALIDATION-FAILED-001`, attacher `error.issues = exception.issues.map(i => ({ path: i.path, code: i.code, message: i.message }))`
     - Sinon (exception non-domain) → `httpStatus: 500`, `tukioCode: INTERNAL-SERVER-ERROR-001`, **PII redaction** sur `detail` (NFR16 — pas d'objet user dans le message d'erreur)
     - Wrap en `ErrorEnvelope` avec mêmes champs `meta` que success
   - **Branchés globalement dans `main.ts`** :
     ```ts
     app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
     app.useGlobalFilters(new EnvelopeExceptionFilter());
     ```
   - Tests E2E `apps/identity-svc/test/envelope.e2e-spec.ts` :
     - `GET /v1/users/test-uuid` → response body match strictement `{ method: 'GET', code: 404, error: { type, title, detail, instance, tukioCode: 'USER-NOT-FOUND-001' }, meta: { timestamp, correlationId, locale } }`
     - `GET /health` → response body match `{ method: 'GET', code: 200, data: { status: 'ok' }, meta: { ... } }`

11. **AC11 — Logger Pino + ConfigService typés** : Given les adapters logger + config, When je les ouvre, Then :
    - `infrastructure/logger/pino-logger.service.ts` : adapter `ILogger` (interface dans `domain/ports/logger.port.ts`), implémente méthodes `info(msg, metadata?)`, `warn`, `error`, `debug`. Format JSON structuré avec champs `timestamp`, `level`, `service: 'identity-svc'`, `version` (lu env), `correlationId` (placeholder), `message`, `metadata` (cohérent Architecture lignes 1762-1778)
    - `infrastructure/config/environment-config.service.ts` : adapter `IConfigService` (interface dans `domain/ports/config.port.ts`), expose getters typés `getDatabaseConfig()`, `getKeycloakConfig()` (URL realm), `getPort()`, etc. Validation des env vars au démarrage via Zod schema (fail-fast si env mal configuré)
    - **NestJS `ConfigModule`** branché global avec `validationSchema` Zod (cf. `nestjs-zod`) + `validate` callback qui throw si env vars manquantes/invalides
    - **PII redaction** active sur logger : si `metadata.email`, `metadata.phone`, `metadata.password` détectés → masqués (`'***@***.com'`, `'***'`)

12. **AC12 — `package.json` identity-svc complet + scripts** : Given `apps/identity-svc/package.json`, When je l'ouvre, Then je trouve :
    - Dépendances :
      - `runtime` : `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-fastify`, `@nestjs/typeorm`, `@nestjs/config`, `typeorm`, `pg`, `pino`, `nestjs-pino`, `nestjs-zod`, `zod`, `reflect-metadata`, `rxjs`
      - `workspace` : `@tukio/contracts: workspace:*` (pour types envelope + DomainEvent)
      - `dev` : `@nestjs/cli`, `@nestjs/testing`, `@types/node`, `typescript`, `tsx` (dev mode), `jest`, `supertest` (E2E HTTP)
    - Scripts :
      - `"dev": "nest start --watch"` (port 4001 via env PORT)
      - `"build": "nest build"`
      - `"start:prod": "node dist/main"`
      - `"test": "jest"`, `"test:watch": "jest --watch"`, `"test:cov": "jest --coverage"`
      - `"test:e2e": "jest --config ./test/jest-e2e.json"`
      - `"migration:generate": "typeorm-ts-node-esm migration:generate -d src/infrastructure/persistence/typeorm/data-source.ts"`
      - `"migration:run": "typeorm-ts-node-esm migration:run -d src/infrastructure/persistence/typeorm/data-source.ts"`
      - `"migration:revert": "typeorm-ts-node-esm migration:revert -d src/infrastructure/persistence/typeorm/data-source.ts"`
      - `"lint": "eslint src --ext .ts"`, `"typecheck": "tsc --noEmit"`
    - **Coverage thresholds** dans `jest.config.ts` (cohérent NFR71) :
      - `domain/`: `lines: 80, functions: 80, branches: 75`
      - `usecases/`: `lines: 70, functions: 70, branches: 65`
      - `infrastructure/`: `lines: 50, functions: 50, branches: 45`
      - Glob exclude : `*.spec.ts`, `*.entity.ts`, `migrations/`, `*.module.ts`

13. **AC13 — Script de replication `replicate-pretre-structure.sh`** : Given `infra/scripts/replicate-pretre-structure.sh`, When je l'exécute via `bash infra/scripts/replicate-pretre-structure.sh --target=catalog-svc`, Then :
    - Vérifie que `apps/<target>/` existe (si non → exit 1 avec message clair)
    - Vérifie que `apps/<target>/src/domain/` n'existe PAS encore (si oui → demande confirmation `--force` flag)
    - **Copie** la structure `apps/identity-svc/src/{domain,usecases,infrastructure}/` vers `apps/<target>/src/` AVEC :
      - **Tous les fichiers `.gitkeep`** copiés tels quels
      - **Tous les dossiers vides** créés
      - **Pour les fichiers `.ts` "génériques"** (template patterns) : `usecases-proxy.ts`, `pino-logger.service.ts` (renommer `service: 'identity-svc'` → `service: '<target>'`), `environment-config.service.ts`, interceptors/filters → COPIE avec **regex replace** :
        - `identity-svc` → `<target>` (dans paths, log labels)
        - `IdentitySvc` → `<TargetSvc>` PascalCase (dans class names si présent)
        - `'tukio_identity'` → `'tukio_<target_normalized>'` (DB name) — `<target_normalized>` = `target.replace(/-svc$/, '').replace(/-/g, '_')` (ex: `catalog-svc` → `catalog`)
      - **Pour les fichiers métier identity-svc** (`user-profile.aggregate.ts`, `user-profile.entity.ts`, `get-user-profile.usecase.ts`, etc.) : **PAS COPIÉS** (logique métier propre à identity, le dev du service cible créera les siens)
      - **`tokens.ts`** : copie un template avec **uniquement** les tokens cross-service (`EVENT_PUBLISHER`, `LOGGER`, `CONFIG_SERVICE`) — les tokens spécifiques (`USER_PROFILE_REPOSITORY`, `KEYCLOAK_SYNC`) sont retirés
    - **Flags** :
      - `--target=<service>` (obligatoire) — nom du service cible parmi : `gateway-api`, `catalog-svc`, `booking-svc`, `order-svc`, `payment-svc`, `messaging-svc`, `review-svc`, `notification-svc`, `media-svc` (tous SAUF `identity-svc`, le source)
      - `--dry-run` (optionnel) — affiche les fichiers qui seraient créés sans rien écrire
      - `--force` (optionnel) — overwrite si la structure existe déjà
    - **Output** : log par fichier créé, summary final `✅ Created X files in apps/<target>/src/. Next steps: 1) Define your aggregates in domain/model/, 2) Create your ports in domain/ports/, 3) Wire your use cases in usecases-proxy.module.ts.`
    - Script en **bash POSIX** (compatible macOS + Linux), **PAS de zsh-isms** ni `gnu-coreutils-only` (utiliser `find` + `sed` + `cp` portables)
    - Tests : `bash infra/scripts/replicate-pretre-structure.sh --target=catalog-svc --dry-run` retourne exit 0 + liste des fichiers prévus ; vrai `--target=catalog-svc` puis `pnpm --filter=catalog-svc lint && pnpm --filter=catalog-svc typecheck` doivent passer (config héritée OK, structure conforme)

14. **AC14 — Tests E2E health + envelope contre service réel** : Given `apps/identity-svc/test/`, When je lance `pnpm --filter=identity-svc test:e2e`, Then :
    - Test 1 (`health.e2e-spec.ts`) : `app.init() → supertest GET /health → expect 200 { method: GET, code: 200, data: { status: 'ok' }, meta: {...} }` — PAS de besoin de DB UP
    - Test 2 (`user.e2e-spec.ts`) : `GET /v1/users/non-existent-uuid → expect 404 { method: GET, code: 404, error: { tukioCode: 'USER-NOT-FOUND-001', ... }, meta: {...} }` — utilise un mock du `IUserProfileRepository` injecté via NestJS testing module override (pas de DB réelle au MVP, testcontainers arrive Story 0.9)
    - Test 3 (`envelope.e2e-spec.ts`) : appelle un endpoint qui throw `ZodError` (via un controller test temporaire OR un endpoint simulé) → vérifie `httpStatus: 422`, `tukioCode: VALIDATION-FAILED-001`, `error.issues` array peuplé
    - Coverage de l'infrastructure couverte par ces E2E ≥ 50 % (objectif NFR71)

15. **AC15 — Documentation README spécifique identity-svc + référence Pretre** : Given `apps/identity-svc/README.md`, When je l'ouvre, Then je trouve (≤ 2 pages) :
    - Description du service (User & Identity Management — FR1-17)
    - Diagramme texte de la structure Pattern Pretre (extrait de la spec, ~30 lignes)
    - **Lien vers le repo de référence** : https://github.com/jonathanPretre/clean-architecture-nestjs (canonique)
    - **Lien vers l'ADR-001** (à créer Story 0.13) : `docs/adr/0001-pretre-clean-architecture.md`
    - Section "Comment ajouter un nouveau use case ?" en 5 étapes :
      1. Définir l'aggregate dans `domain/model/<aggregate>.aggregate.ts` (si pas déjà existant)
      2. Définir le port dans `domain/ports/<aggregate>.repository.port.ts` + ajouter le token dans `tokens.ts`
      3. Implémenter le use case dans `usecases/<verb-object>.usecase.ts` avec sa spec colocalisée
      4. Implémenter le repository dans `infrastructure/persistence/typeorm/<aggregate>.typeorm.repository.ts`
      5. Wire dans `infrastructure/usecases-proxy/usecases-proxy.module.ts` (provider + token + factory)
    - Section "Comment ajouter une migration ?" : `pnpm migration:generate src/infrastructure/persistence/typeorm/migrations/<TimestampName> -- --dataSource src/infrastructure/persistence/typeorm/data-source.ts`

## Tasks / Subtasks

- [x] **Task 1 — Installer les deps NestJS + TypeORM + utils** (AC: #12)
  - [x] 1.1 — `pnpm --filter=identity-svc add @nestjs/core@latest @nestjs/common@latest @nestjs/platform-fastify@latest @nestjs/typeorm@latest @nestjs/config@latest typeorm@latest pg@latest pino@latest nestjs-pino@latest nestjs-zod@latest zod@latest reflect-metadata rxjs@latest`
  - [x] 1.2 — `pnpm --filter=identity-svc add -D @nestjs/cli @nestjs/testing @types/node typescript tsx jest@latest @types/jest ts-jest supertest @types/supertest`
  - [x] 1.3 — `pnpm --filter=identity-svc add @tukio/contracts@workspace:*`
  - [x] 1.4 — Mettre à jour `apps/identity-svc/package.json` scripts (cf. AC12)

- [x] **Task 2 — Configurer eslint-plugin-boundaries Pattern Pretre strict** (AC: #2, #8)
  - [x] 2.1 — Mettre à jour `.eslintrc.cjs` racine avec config `boundaries/elements` + `boundaries/element-types` + `boundaries/external` (cf. AC8 — bloc complet)
  - [x] 2.2 — Tester la rule : créer `apps/identity-svc/src/domain/_test-violation.ts` avec `import { Repository } from 'typeorm';` → `pnpm --filter=identity-svc lint` doit failer avec message Pattern Pretre violation → SUPPRIMER le fichier
  - [x] 2.3 — Vérifier que `apps/identity-svc/src/usecases/get-user-profile.usecase.ts` qui importe depuis `domain/` passe la rule → OK
  - [x] 2.4 — Vérifier que `apps/identity-svc/src/infrastructure/persistence/typeorm/user-profile.typeorm.repository.ts` qui importe `typeorm` + `domain/` passe → OK

- [x] **Task 3 — Créer les fichiers `domain/`** (AC: #1, #3, #5)
  - [x] 3.1 — `domain/model/user-profile.aggregate.ts` :
    ```ts
    import type { Locale } from '@tukio/contracts/types/Locale';
    import { Email } from './email.value-object';
    import type { UserRole } from './user-role.enum';
    export class UserProfile {
      constructor(
        public readonly id: string,
        public readonly keycloakUserId: string,
        public readonly email: Email,
        public readonly firstName: string,
        public readonly lastName: string,
        public readonly role: UserRole,
        public readonly locale: Locale,
        public readonly createdAt: Date,
        public readonly updatedAt: Date,
        public readonly deletedAt: Date | null,
      ) {}
      static create(props: { /* ... */ }): UserProfile { /* validation invariants */ }
      isDeleted(): boolean { return this.deletedAt !== null; }
    }
    ```
  - [x] 3.2 — `domain/model/user-role.enum.ts` :
    ```ts
    export const UserRole = { CLIENT: 'client', PRO: 'pro', ADMIN_SUPPORT: 'admin-support', ADMIN_MODO: 'admin-modo', ADMIN_SUPER: 'admin-super' } as const;
    export type UserRole = typeof UserRole[keyof typeof UserRole];
    ```
  - [x] 3.3 — `domain/model/email.value-object.ts` : Value Object immutable avec validation regex email + `toString()`
  - [x] 3.4 — `domain/ports/user-profile.repository.port.ts` :
    ```ts
    import type { UserProfile } from '../model/user-profile.aggregate';
    export interface IUserProfileRepository {
      findById(id: string): Promise<UserProfile | null>;
      findByKeycloakUserId(keycloakUserId: string): Promise<UserProfile | null>;
      save(userProfile: UserProfile): Promise<void>;
    }
    ```
  - [x] 3.5 — `domain/ports/keycloak-sync.port.ts` (placeholder) :
    ```ts
    export interface IKeycloakSync {
      syncUserFromKeycloak(keycloakUserId: string): Promise<void>;
    }
    ```
  - [x] 3.6 — `domain/ports/event-publisher.port.ts` (placeholder) :
    ```ts
    import type { DomainEvent } from '@tukio/contracts/types/DomainEvent';
    export interface IEventPublisher {
      publish<TPayload>(event: DomainEvent<TPayload>): Promise<void>;
    }
    ```
  - [x] 3.7 — `domain/ports/logger.port.ts` + `domain/ports/config.port.ts` (interfaces basiques)
  - [x] 3.8 — `domain/ports/tokens.ts` (cf. AC3 — bloc complet)
  - [x] 3.9 — `domain/exception/domain.exception.ts` (base class abstraite avec `tukioCode`, `httpStatus`, `title`)
  - [x] 3.10 — `domain/exception/user-profile-not-found.exception.ts` :
    ```ts
    export class UserProfileNotFoundException extends DomainException {
      readonly tukioCode = 'USER-NOT-FOUND-001';
      readonly httpStatus = 404;
      readonly title = 'User profile not found';
      constructor(public readonly userId: string) {
        super(`UserProfile with id ${userId} not found`);
      }
    }
    ```

- [x] **Task 4 — Créer le use case `GetUserProfileById` + tests** (AC: #5)
  - [x] 4.1 — `usecases/get-user-profile.usecase.ts` (cf. AC5 squelette)
  - [x] 4.2 — `usecases/get-user-profile.usecase.spec.ts` :
    - Test "found case" : mock `repo.findById.mockResolvedValue(userProfileFixture)` → `execute({ userId })` retourne userProfile, `repo.findById` called with `userId`
    - Test "not-found case" : mock `repo.findById.mockResolvedValue(null)` → `execute({ userId })` throw `UserProfileNotFoundException` avec `tukioCode === 'USER-NOT-FOUND-001'` et `httpStatus === 404`
    - Coverage ≥ 90 % vérifié via `pnpm --filter=identity-svc test:cov`

- [x] **Task 5 — Créer les implémentations infrastructure (TypeORM, NATS placeholder, Keycloak placeholder)** (AC: #1, #9)
  - [x] 5.1 — `infrastructure/persistence/typeorm/entities/user-profile.entity.ts` (TypeORM Entity avec décorateurs)
  - [x] 5.2 — `infrastructure/persistence/typeorm/mappers/user-profile.mapper.ts` (entity ↔ aggregate, méthodes `toDomain` + `toEntity`)
  - [x] 5.3 — `infrastructure/persistence/typeorm/repositories/user-profile.typeorm.repository.ts` (`@Injectable()` + `implements IUserProfileRepository`, inject `@InjectRepository(UserProfileEntity)`)
  - [x] 5.4 — `infrastructure/persistence/typeorm/data-source.ts` (cf. AC9 — config TypeORM complète, env vars typées)
  - [x] 5.5 — `infrastructure/persistence/typeorm/typeorm-repositories.module.ts` (NestJS module qui wire `TypeOrmModule.forFeature([UserProfileEntity])` + provider `{ provide: USER_PROFILE_REPOSITORY, useClass: UserProfileTypeormRepository }`)
  - [x] 5.6 — `infrastructure/messaging/nats/nats.publisher.ts` (placeholder Story 0.7) : implémente `IEventPublisher`, méthode `publish` log + no-op (TODO comment Story 0.7 branchera @tukio/messaging)
  - [x] 5.7 — `infrastructure/messaging/nats/nats-publisher.module.ts` (provider `{ provide: EVENT_PUBLISHER, useClass: NatsPublisher }`)
  - [x] 5.8 — `infrastructure/external/keycloak/keycloak.service.ts` (placeholder Story 1.1) : implémente `IKeycloakSync`, méthode `syncUserFromKeycloak` log + no-op
  - [x] 5.9 — `infrastructure/external/keycloak/keycloak.module.ts` (provider `{ provide: KEYCLOAK_SYNC, useClass: KeycloakService }`)
  - [x] 5.10 — Migration baseline `migrations/1715200000000-CreateUserProfilesBaseline.ts` (cf. AC9 — schema complet user_profiles)

- [x] **Task 6 — Créer le `UseCaseProxy<T>` + `UseCasesProxyModule`** (AC: #4)
  - [x] 6.1 — `infrastructure/usecases-proxy/usecases-proxy.ts` (generic class, cf. AC4)
  - [x] 6.2 — `infrastructure/usecases-proxy/usecases-proxy.module.ts` (DynamicModule avec `static register()`, cf. AC4 — bloc complet)

- [x] **Task 7 — Créer interceptor + filter ADR-014 enveloppe REST** (AC: #10)
  - [x] 7.1 — `infrastructure/http/interceptors/response-envelope.interceptor.ts` (cf. AC10 + Architecture lignes 1414-1442)
  - [x] 7.2 — `infrastructure/http/filters/envelope-exception.filter.ts` (cf. AC10 + Architecture lignes 1446-1464). Map :
    - `DomainException` (et héritées) → utilise `tukioCode`, `httpStatus`, `title`
    - `ZodError` → 422 + `tukioCode: VALIDATION-FAILED-001` + `issues`
    - Reste → 500 + `tukioCode: INTERNAL-SERVER-ERROR-001` + PII redaction sur `detail`
  - [x] 7.3 — Brancher globalement dans `main.ts` : `app.useGlobalInterceptors(new ResponseEnvelopeInterceptor()); app.useGlobalFilters(new EnvelopeExceptionFilter());`

- [x] **Task 8 — Créer controllers HTTP (UserController + HealthController)** (AC: #6, #7)
  - [x] 8.1 — `infrastructure/http/dtos/user-profile-response.dto.ts` :
    - Si Story 0.2 a déjà ajouté un `UserProfileResponseSchema` dans `@tukio/contracts/dtos/auth.dto.ts` → l'importer
    - Sinon, créer un Zod schema local `UserProfileResponseSchema` (sera migré vers `@tukio/contracts` plus tard)
  - [x] 8.2 — `infrastructure/http/controllers/user.controller.ts` (cf. AC6 — bloc complet, inject UseCaseProxy via `@Inject(UseCasesProxyModule.GET_USER_PROFILE_USECASES_PROXY)`)
  - [x] 8.3 — `infrastructure/http/controllers/health.controller.ts` :
    ```ts
    @Controller()
    export class HealthController {
      constructor(@Inject(getDataSourceToken()) private readonly dataSource: DataSource) {}
      @Get('/health') health() { return { status: 'ok' }; }
      @Get('/ready') async ready() {
        const dbUp = this.dataSource.isInitialized;
        if (!dbUp) throw new HttpException({ status: 'not-ready', dependencies: { postgres: 'down' } }, 503);
        return { status: 'ready', dependencies: { postgres: 'up' } };
      }
    }
    ```
  - [x] 8.4 — `infrastructure/http/http.module.ts` : NestJS module qui wire `UserController`, `HealthController`

- [x] **Task 9 — Créer logger + config services** (AC: #11)
  - [x] 9.1 — `infrastructure/logger/pino-logger.service.ts` : implémente `ILogger`, formatte JSON structuré, hooks PII redaction (`pino`'s `redact` option avec paths `['email', 'password', 'phone', 'metadata.email', 'metadata.password']`)
  - [x] 9.2 — `infrastructure/config/environment-config.service.ts` : implémente `IConfigService`, valide env vars via Zod schema au boot (throw si mal configuré)
  - [x] 9.3 — `infrastructure/config/config.module.ts` : NestJS `ConfigModule.forRoot({ isGlobal: true, validate: zodValidate, envFilePath: '.env' })`
  - [x] 9.4 — `.env.example` à jour avec : `PORT=4001`, `NODE_ENV=development`, `LOG_LEVEL=info`, `DB_HOST=localhost`, `DB_PORT=5432`, `DB_USER=tukio_identity_user`, `DB_PASSWORD=changeme`, `DB_NAME=tukio_identity`, `KEYCLOAK_URL=http://localhost:8080` (placeholder), `NATS_URL=nats://localhost:4222` (placeholder)

- [x] **Task 10 — Créer `app.module.ts` + `main.ts`** (AC: #1, #6, #7, #10)
  - [x] 10.1 — `app.module.ts` :
    ```ts
    @Module({
      imports: [
        ConfigurationModule,
        LoggerModule,
        TypeOrmModule.forRootAsync({ useFactory: (config: IConfigService) => config.getDatabaseConfig(), inject: [CONFIG_SERVICE] }),
        UseCasesProxyModule.register(),
        HttpModule,
      ],
    })
    export class AppModule {}
    ```
  - [x] 10.2 — `main.ts` :
    ```ts
    async function bootstrap() {
      const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter({ logger: false }));
      app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
      app.useGlobalFilters(new EnvelopeExceptionFilter());
      app.useLogger(app.get(LOGGER));
      const port = app.get<IConfigService>(CONFIG_SERVICE).getPort();
      await app.listen(port, '0.0.0.0');
    }
    bootstrap();
    ```

- [x] **Task 11 — Tests E2E (health, user, envelope)** (AC: #14)
  - [x] 11.1 — `test/health.e2e-spec.ts` : démarrer app via `Test.createTestingModule(...).compile()` + `app.init()`, supertest GET `/health` → 200, GET `/ready` → 200 ou 503 selon DB
  - [x] 11.2 — `test/user.e2e-spec.ts` : override `USER_PROFILE_REPOSITORY` provider avec mock `{ findById: () => Promise.resolve(null) }` → GET `/v1/users/test-uuid` → 404 enveloppé
  - [x] 11.3 — `test/envelope.e2e-spec.ts` : créer un endpoint test temporaire qui throw `ZodError` (ou reuse user controller avec un mock qui throw) → vérifier 422 + `error.issues`
  - [x] 11.4 — `test/jest-e2e.json` config Jest spécifique E2E (rootDir parent `test/`, testRegex `.e2e-spec.ts$`)
  - [x] 11.5 — `pnpm --filter=identity-svc test:e2e` passe les 3 tests

- [x] **Task 12 — Créer le script de replication** (AC: #13)
  - [x] 12.1 — Créer `infra/scripts/replicate-pretre-structure.sh` (bash POSIX, shebang `#!/usr/bin/env bash`, `set -euo pipefail`)
  - [x] 12.2 — Implémenter parsing arguments `--target=<svc>`, `--dry-run`, `--force`
  - [x] 12.3 — Implémenter validation : `[[ -d "apps/$TARGET" ]]` sinon exit 1, `[[ -d "apps/$TARGET/src/domain" && ! -n "$FORCE" ]]` sinon prompt confirm
  - [x] 12.4 — Implémenter copie : utiliser `find apps/identity-svc/src -type d` pour les dossiers + `find ... -type f -name '*.ts'` pour les fichiers, filtrer hors fichiers métier identity (whitelist : `usecases-proxy.ts`, `*.module.ts`, `pino-logger.service.ts`, `environment-config.service.ts`, `data-source.ts`, `domain.exception.ts`, `tokens.ts` template, intercepteurs/filters)
  - [x] 12.5 — Implémenter regex replace : `sed -i.bak 's/identity-svc/'"$TARGET"'/g; s/IdentitySvc/'"$TARGET_PASCAL"'/g; s/tukio_identity/tukio_'"$TARGET_DBNAME"'/g'` (compatible macOS BSD sed via `.bak` suffix)
  - [x] 12.6 — Cleanup `.bak` files après sed
  - [x] 12.7 — Test : `bash infra/scripts/replicate-pretre-structure.sh --target=catalog-svc --dry-run` → liste fichiers, pas d'écriture, exit 0
  - [x] 12.8 — Test : `bash infra/scripts/replicate-pretre-structure.sh --target=catalog-svc` (réel) → puis `pnpm --filter=catalog-svc lint && pnpm --filter=catalog-svc typecheck` doivent passer (config héritée OK)
  - [x] 12.9 — **NB** : ne PAS commit la structure répliquée dans catalog-svc dans cette story — la valider en local puis revert (`git checkout apps/catalog-svc/`). Les autres stories Epic 3 (catalog-svc) feront la replication officielle.

- [x] **Task 13 — Créer README identity-svc** (AC: #15)
  - [x] 13.1 — `apps/identity-svc/README.md` (≤ 2 pages) avec : description, structure Pattern Pretre, lien repo Pretre, lien ADR-001 (Story 0.13), 5 étapes "ajouter use case", 1 étape "ajouter migration"

- [x] **Task 14 — Smoke test final + commit** (AC: tous)
  - [x] 14.1 — `pnpm --filter=identity-svc lint` passe (boundaries OK, pas de violation domain)
  - [x] 14.2 — `pnpm --filter=identity-svc typecheck` passe
  - [x] 14.3 — `pnpm --filter=identity-svc test --coverage` passe avec thresholds ≥ NFR71 (domain ≥ 80, usecases ≥ 70, infrastructure ≥ 50)
  - [x] 14.4 — `pnpm --filter=identity-svc test:e2e` passe (3 tests)
  - [x] 14.5 — `pnpm --filter=identity-svc dev` démarre sur port 4001, `curl http://localhost:4001/health` retourne 200 enveloppé
  - [x] 14.6 — `pnpm dev` (racine) démarre les 14 codebases sans erreur
  - [x] 14.7 — `bash infra/scripts/replicate-pretre-structure.sh --target=catalog-svc --dry-run` valide
  - [x] 14.8 — Commit `feat(identity-svc): scaffold Pattern Pretre canonical template + replication script + ESLint boundaries strict + envelope ADR-014` — Story 0.6 done

### Review Findings (AI — 2026-05-10)

**Patch (à corriger avant merge)**
- [x] [Review][Patch] P1 — `DB_PASSWORD` has `.default('changeme')` — doit être `.min(1)` sans default [`apps/identity-svc/src/infrastructure/config/env.schema.ts:19`]
- [x] [Review][Patch] P2 — `PinoLoggerService` lit `process.env` directement, bypasse `IConfigService` validé Zod [`apps/identity-svc/src/infrastructure/logger/pino-logger.service.ts:22-26`]
- [x] [Review][Patch] P3 — `UserProfileMapper.toEntity` écrase `@CreateDateColumn/@UpdateDateColumn` gérés par TypeORM [`apps/identity-svc/src/infrastructure/persistence/typeorm/mappers/user-profile.mapper.ts:42-43`]
- [x] [Review][Patch] P4 — Pas de validation UUID sur `GET /v1/users/:id` avant DB query → `QueryFailedError` retourne 500 au lieu de 422 [`apps/identity-svc/src/infrastructure/http/controllers/user.controller.ts:16`]
- [x] [Review][Patch] P5 — `UserProfileMapper.toDomain` throw `new Error(...)` au lieu d'une `DomainException` sur donnée DB corrompue [`apps/identity-svc/src/infrastructure/persistence/typeorm/mappers/user-profile.mapper.ts:13-18`]
- [x] [Review][Patch] P6 — `abortOnError: false` dans `buildTestApp` swallow silencieusement les erreurs DI dans les tests [`apps/identity-svc/test/helpers/build-test-app.ts:76`]
- [x] [Review][Patch] P7 — Test E2E ZodError path est artificiel — aucun `ZodValidationPipe` câblé, la vraie path production ne peut être atteinte [`apps/identity-svc/test/envelope.e2e-spec.ts:14-19`]
- [x] [Review][Patch] P8 — Env vars chaîne vide (`""`) bypassent la validation Zod — ajouter `.min(1)` sur `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `SERVICE_NAME` [`apps/identity-svc/src/infrastructure/config/env.schema.ts`]
- [x] [Review][Patch] P9 — `UserProfile.assertName` trim pour valider mais stocke la valeur non-trimmée → whitespace en DB et dans les réponses API [`apps/identity-svc/src/domain/model/user-profile.aggregate.ts:77-86`]
- [x] [Review][Patch] P10 — `to_db_name "gateway-api"` produit `gateway_api` (pas de `-svc` suffix → sed ne strip rien) → DB name incorrect [`infra/scripts/replicate-pretre-structure.sh:111-113`]
- [x] [Review][Patch] P11 — `AppModule` n'importe pas `UseCasesProxyModule.register()` — wiring use-case dans `HttpModule`, violation Pattern Pretre "single wiring point" [`apps/identity-svc/src/app.module.ts`]
- [x] [Review][Patch] P12 — `TypeOrmModule.forRootAsync` injecte la classe concrète `EnvironmentConfigService` au lieu du token `CONFIG_SERVICE` [`apps/identity-svc/src/app.module.ts:14-15`]
- [x] [Review][Patch] P13 — Regex PII phone trop large : matche les port numbers, codes erreur, timestamps dans les messages d'erreur [`apps/identity-svc/src/infrastructure/http/filters/envelope-exception.filter.ts:26`]
- [x] [Review][Patch] P14 — `usecases-proxy.module.ts` dans `REPLICATE_FILES` contient imports identity-spécifiques — le service cible ne compilera pas sans édition manuelle [`infra/scripts/replicate-pretre-structure.sh:58`]
- [x] [Review][Patch] P15 — `Number(process.env.DB_PORT)` peut retourner `NaN` pour `DB_PORT=abc` → port 0 dans Node.js [`apps/identity-svc/src/infrastructure/persistence/typeorm/data-source.ts:11`]
- [x] [Review][Patch] P16 — Column `email VARCHAR(255)` mais domaine enforce 254 chars max → 255-char email inséré en SQL direct rend le user inaccessible (422 sur GET) [`apps/identity-svc/src/infrastructure/persistence/typeorm/entities/user-profile.entity.ts:9`]
- [x] [Review][Patch] P17 — `main.ts` absent de `app.useLogger(app.get(LOGGER))` → logs NestJS bootstrap ne passent pas par Pino [`apps/identity-svc/src/main.ts`]

**Defer (signalés, pas bloquants)**
- [x] [Review][Defer] D1 — `ResponseEnvelopeInterceptor` statusCode hardcodé 200 si futur controller uses `@HttpCode(201)` avec Express adapter — pas de controller non-200 actuellement [deferred, pre-existing]
- [x] [Review][Defer] D2 — `EMAIL_REGEX` permissif (accepte double dots, leading hyphens) — acceptable MVP [deferred, pre-existing]
- [x] [Review][Defer] D3 — `Email.create` avec TypeORM partial hydration retourne 422 au lieu de 500 — colonne non-nullable, cas pratiquement impossible [deferred, pre-existing]
- [x] [Review][Defer] D4 — `sed_inplace` détection fragile sur Linux exotique — fonctionne macOS + Linux standard [deferred, pre-existing]
- [x] [Review][Defer] D5 — `--force` ne nettoie pas les fichiers orphelins d'un run partiel interrompu [deferred, pre-existing]
- [x] [Review][Defer] D6 — `buildMeta` locale non-supportée silencieusement mappée à `'fr'` sans log [deferred, pre-existing]
- [x] [Review][Defer] D7 — `asEnvelopeMethod` mappe `OPTIONS/HEAD` → `'GET'` dans l'enveloppe — pas d'endpoints CORS/HEAD actuels [deferred, pre-existing]
- [x] [Review][Defer] D8 — AC6: `toUserProfileResponseDto()` standalone vs `UserProfileMapper.toResponseDto()` static (spec) — fonctionnellement équivalent [deferred, pre-existing]
- [x] [Review][Defer] D9 — AC9: Index UNIQUE séparé vs contrainte `UNIQUE` inline — fonctionnellement identique au niveau DB [deferred, pre-existing]
- [x] [Review][Defer] D10 — AC9: Scripts migration `tsx` vs `typeorm-ts-node-esm` — fonctionnellement équivalent [deferred, pre-existing]
- [x] [Review][Defer] D11 — AC12: `jest.config.ts` sans threshold infrastructure (couvert par `test:e2e:cov`) [deferred, pre-existing]
- [x] [Review][Defer] D12 — AC13: `tokens.template.ts` sentinel/fichier virtuel dans `REPLICATE_FILES` — fonctionne mais design inhabituel [deferred, pre-existing]

## Dev Notes

### Pourquoi cette story est la 6ᵉ — contexte stratégique

> **Sources canoniques** : `_bmad-output/planning-artifacts/architecture.md` §Cross-Cutting Concerns #1 Clean Architecture (lignes 168-232) + §Backend service structure Pattern Pretre (lignes 1161-1208) + §Détail booking-svc (lignes 2120-2164) + §Pattern Pretre scaffold manuel Sprint 0 (lignes 444-461) + repo référence https://github.com/jonathanPretre/clean-architecture-nestjs.

Story 0.6 est le **tournant Sprint 0** : le passage du frontend (Stories 0.3-0.5 = design system + composants) au backend (Stories 0.6-0.13 = services + infra). C'est la première fois qu'on **scaffolde un service NestJS réel** avec le Pattern Pretre. Tous les autres services (`gateway-api`, `catalog-svc`, `booking-svc`, `order-svc`, `payment-svc`, `messaging-svc`, `review-svc`, `notification-svc`, `media-svc`) hériteront de ce template via le script de replication (Task 12).

**Sans ce scaffold cohérent, les 130 FRs ne peuvent pas être implémentés selon les patterns figés** (Architecture ligne 494). Si la PR Story 0.6 introduit une déviation (ex : oublie le `usecases-proxy.module.ts`, met les ports dans `infrastructure/`, mélange `domain/` avec `typeorm`), tous les services suivants hériteront du même défaut → dette technique structurelle.

**Décision technique majeure (à acter dans Story 0.6)** : la lib **`@tukio/auth`** (KeycloakJwtGuard) et **`@tukio/messaging`** (NATS wrapper) ne sont **PAS encore livrées** (Stories 0.7 et 0.8). Story 0.6 utilise donc des **placeholders** :
- `KeycloakService` (implémentation `IKeycloakSync`) : log + no-op au scaffolding, sera remplacé Story 1.1 (Provision Keycloak realm)
- `NatsPublisher` (implémentation `IEventPublisher`) : log + no-op au scaffolding, sera remplacé Story 0.7 quand `@tukio/messaging` sera dispo
- `KeycloakJwtGuard` : pas appliqué dans Story 0.6 (Story 0.8 le fournit, Story 1.4 l'applique aux endpoints sensibles)

Cette stratégie permet à Story 0.6 d'avoir un service **fonctionnel end-to-end** (HTTP → controller → use case → repository → DB) sans dépendre de stories futures. Les placeholders sont **explicitement marqués TODO** dans le code.

### Versions à utiliser (latest stable au moment du Sprint 0)

> **Mémoire utilisateur** : `feedback_latest_versions.md` — toujours latest stable, vérifier `pnpm view <package> version` au moment de l'init.

| Lib | Rôle | Version cible |
|---|---|---|
| **NestJS** (`@nestjs/core`, `@nestjs/common`, `@nestjs/platform-fastify`) | Framework backend | 11.x latest (cohérent Story 0.1) |
| **Fastify adapter** (`@nestjs/platform-fastify`) | HTTP server (vs Express, perfs +30%) | latest stable |
| **TypeORM** (`typeorm`, `@nestjs/typeorm`) | ORM | latest stable (3.x — vérifier compat NestJS 11) |
| **pg** | Driver Postgres | latest stable |
| **pino** + **nestjs-pino** | Logger structuré JSON | latest stable |
| **nestjs-zod** + **zod** | Validation env vars + DTOs | latest stable (cohérent Story 0.2) |
| **eslint-plugin-boundaries** | Pattern Pretre enforce | latest stable |
| **Jest** + **ts-jest** + **supertest** | Tests unit + E2E | latest stable |

> ⚠️ **NestJS 11 + TypeORM compat** : vérifier au moment du dev que `@nestjs/typeorm` supporte bien la version Nest 11 + TypeORM 3.x. Si breaking, fallback `@nestjs/typeorm@10` ou `typeorm@0.3.x`.
>
> ⚠️ **Fastify vs Express** : Architecture ligne 121 figée sur **Fastify adapter**. Avantages : perfs +30 %, plugins Fastify nativement supportés. Vérifier que toutes les libs (interceptors, guards) sont Fastify-compatibles (NestJS abstrait la majorité, mais quelques edge cases existent).

### Project Structure cible (cohérent Architecture lignes 2120-2164 — booking-svc référence)

```
apps/identity-svc/
├─ package.json, nest-cli.json, tsconfig.json, tsconfig.build.json, Dockerfile, .env.example, README.md
├─ jest.config.ts                                          # coverage thresholds NFR71
└─ src/
   ├─ main.ts, app.module.ts                              # bootstrap + root module
   ├─ domain/                                              # ZERO I/O lib import
   │  ├─ model/{user-profile.aggregate,user-role.enum,email.value-object}.ts
   │  ├─ ports/{user-profile.repository,keycloak-sync,event-publisher,logger,config,tokens}.ts
   │  ├─ service/.gitkeep                                  # vide au scaffolding
   │  └─ exception/{domain.exception,user-profile-not-found.exception}.ts
   ├─ usecases/
   │  ├─ get-user-profile.usecase.ts
   │  └─ get-user-profile.usecase.spec.ts                  # mocks ports, ≥ 90 % coverage
   └─ infrastructure/
      ├─ persistence/typeorm/
      │  ├─ entities/user-profile.entity.ts
      │  ├─ mappers/user-profile.mapper.ts
      │  ├─ repositories/user-profile.typeorm.repository.ts
      │  ├─ migrations/1715200000000-CreateUserProfilesBaseline.ts
      │  ├─ data-source.ts
      │  └─ typeorm-repositories.module.ts
      ├─ messaging/nats/{nats.publisher,nats-publisher.module}.ts # placeholder Story 0.7
      ├─ external/keycloak/{keycloak.service,keycloak.module}.ts # placeholder Story 1.1
      ├─ http/
      │  ├─ controllers/{user.controller,health.controller}.ts
      │  ├─ dtos/user-profile-response.dto.ts
      │  ├─ guards/.gitkeep                                # KeycloakJwtGuard arrive Story 0.8
      │  ├─ interceptors/response-envelope.interceptor.ts  # ADR-014
      │  ├─ filters/envelope-exception.filter.ts           # ADR-014
      │  └─ http.module.ts
      ├─ logger/pino-logger.service.ts
      ├─ config/{environment-config.service,config.module}.ts
      ├─ exception/.gitkeep
      └─ usecases-proxy/{usecases-proxy,usecases-proxy.module}.ts
└─ test/
   ├─ jest-e2e.json                                        # config Jest E2E
   ├─ health.e2e-spec.ts
   ├─ user.e2e-spec.ts
   └─ envelope.e2e-spec.ts

infra/scripts/
└─ replicate-pretre-structure.sh                            # script bash POSIX (Task 12)
```

### Pattern Pretre — règles non négociables (rappel exhaustif)

> Cf. Architecture lignes 218-227 + memory `feedback_clean_architecture_explicit.md`.

1. **`domain/` = ZÉRO dépendance externe** : pas de `@nestjs/*`, `typeorm`, `axios`, `pg`, `keycloak-connect`, `stripe`, `@tukio/messaging`, `@tukio/auth`. Seules autorisées : autres modules `domain/*` du même service + types-only depuis `@tukio/contracts/types/*`. **Lint enforce via `eslint-plugin-boundaries`** (AC8).
2. **Interfaces (ports) dans `domain/ports/`** + implémentations dans `infrastructure/`. **Jamais l'inverse.** Une PR qui met une interface dans `infrastructure/` est rejetée en code review.
3. **Use cases dépendent UNIQUEMENT des ports** (via Symbol DI tokens). Aucun use case ne référence directement TypeORM, Stripe, axios, pg, Keycloak SDK, etc.
4. **Wiring port → impl UNIQUEMENT dans `usecases-proxy.module.ts`** (DynamicModule). C'est le seul endroit du service où le domaine et l'infrastructure se rencontrent.
5. **Repository Pattern** : pour chaque aggregate persisté, **1 interface** dans `domain/ports/<aggregate>.repository.port.ts` + **1 implémentation TypeORM** dans `infrastructure/persistence/typeorm/repositories/<aggregate>.typeorm.repository.ts`. Migration vers Prisma future = écrire une nouvelle classe d'implémentation, le use case ne change pas.
6. **External Service Pattern** : pour chaque service tiers (Stripe, Keycloak, Resend, Meilisearch, R2, INSEE, DeepL), **1 interface** dans `domain/ports/<service>.service.port.ts` + **1 implémentation** dans `infrastructure/external/<service>/<service>.service.ts`. Switch de fournisseur (Stripe → Mangopay) = une seule classe à réécrire.
7. **Aggregates : invariants dans `static create(...)` + méthodes métier** (`accept()`, `cancel()`, `transitionTo(...)`). Throw `DomainException` (héritée) si invariant violé. **Pas de setters publics** (immutabilité préférée).
8. **Value Objects immutables** (Email, Money, etc.) : tous les champs `readonly`, validation dans le constructeur, méthode `equals(other)` obligatoire si comparaison nécessaire.
9. **Domain Exceptions héritent de `DomainException` base** : doivent exposer `tukioCode`, `httpStatus`, `title` (utilisés par `EnvelopeExceptionFilter` AC10).
10. **DTOs HTTP dans `infrastructure/http/dtos/`** (Zod schemas), JAMAIS dans `domain/`. Mappers `entity ↔ aggregate` dans `infrastructure/persistence/typeorm/mappers/`. Mappers `aggregate ↔ DTO response` dans le controller ou un `infrastructure/http/dtos/<entity>.mapper.ts`.

### `eslint-plugin-boundaries` — config détaillée (extension Story 0.1 placeholder)

> Story 0.1 a posé un placeholder `eslint-plugin-boundaries` en `warn`. Story 0.6 le **bascule en `error` sur backend** + ajoute la config Pattern Pretre stricte.

```js
// .eslintrc.cjs (extension)
module.exports = {
  // ...config existante (Story 0.1 + 0.2 + 0.3 + 0.4 + 0.5)
  plugins: ['boundaries', 'tukio', /* autres */],
  settings: {
    'boundaries/elements': [
      // Pattern Pretre backend (cette story)
      { type: 'domain', pattern: 'apps/*-svc/src/domain/**', mode: 'folder' },
      { type: 'usecases', pattern: 'apps/*-svc/src/usecases/**', mode: 'folder' },
      { type: 'infrastructure', pattern: 'apps/*-svc/src/infrastructure/**', mode: 'folder' },
      { type: 'app', pattern: ['apps/*-svc/src/app.module.ts', 'apps/*-svc/src/main.ts'], mode: 'file' },
      // gateway-api spécifique (a la même structure mais sans `*-svc` suffix — TODO Story 0.6 task additional)
      { type: 'domain', pattern: 'apps/gateway-api/src/domain/**', mode: 'folder' },
      { type: 'usecases', pattern: 'apps/gateway-api/src/usecases/**', mode: 'folder' },
      { type: 'infrastructure', pattern: 'apps/gateway-api/src/infrastructure/**', mode: 'folder' },
    ],
    'boundaries/include': ['apps/*-svc/src/**', 'apps/gateway-api/src/**'],
  },
  rules: {
    'boundaries/element-types': ['error', {
      default: 'disallow',
      rules: [
        { from: 'domain', allow: ['domain'] },
        { from: 'usecases', allow: ['domain', 'usecases'] },
        { from: 'infrastructure', allow: ['domain', 'infrastructure'] },
        { from: 'app', allow: ['domain', 'usecases', 'infrastructure'] },
      ],
    }],
    'boundaries/external': ['error', {
      default: 'allow',
      rules: [
        {
          from: 'domain',
          disallow: [
            '@nestjs/*',
            'typeorm',
            'axios',
            'pg',
            'keycloak-connect',
            'stripe',
            '@tukio/messaging',
            '@tukio/auth',
            'pino',
            'nestjs-pino',
            'rxjs',
          ],
          message: '🚫 Pattern Pretre violation: domain/ must not import I/O libs. Move to infrastructure/.',
        },
      ],
    }],
  },
};
```

### Critical Architecture Constraints

> Cf. Architecture lignes 168-232 + 1799-1853 + memories `feedback_clean_architecture_explicit.md`, `feedback_api_envelope_response.md`, `feedback_tech_layer_english.md`.

1. **Symbol DI tokens** : `Symbol(...)` PAS `Symbol.for(...)` (unicité absolue, pas de risque de collision cross-service)
2. **Aggregate constructor** : tous champs `readonly`, immutable. Si modification, return `new UserProfile(...)` avec champs mis à jour.
3. **Use case unique méthode `.execute(input)`** : input typé strictement (interface dérivée), output typé strictement (aggregate ou DTO domain). Pas de méthodes secondaires.
4. **Use case sans NestJS decorators** : pas de `@Injectable()`. C'est le `usecases-proxy.module.ts` qui instancie via `useFactory`.
5. **Controllers bind UseCaseProxy** : `@Inject(UseCasesProxyModule.GET_USER_PROFILE_USECASES_PROXY) private readonly proxy: UseCaseProxy<...>`. Toujours `proxy.getInstance().execute(...)`.
6. **Enveloppe REST canonique** : controllers retournent **DTO nu**, jamais `response.json(...)` direct. L'interceptor wrap automatiquement (memory `feedback_api_envelope_response.md`).
7. **`additionalProperties: false`** sur tous les Zod schemas DTOs (cohérent ADR-014 + JSON Schemas events Story 0.2).
8. **Migrations backward-compatible** (NFR83) : pas de DROP COLUMN sans rolling migration en 2 étapes (add nullable → backfill → drop). Cette story = migration baseline initial → no constraint.
9. **EN strict** : tous les noms de fichiers, classes, ports, tokens en EN. Pas de FR (`utilisateur` interdit, `user` OK).
10. **PII redaction logger** : `pino` `redact` paths configurés pour masquer `email`, `password`, `phone`, `metadata.*` selon NFR16.

### What this story does NOT do (out of scope)

- ❌ **Implémentation Keycloak réelle** (login, JWT validation, sync user) → **Story 1.1** + **Story 0.8** (`@tukio/auth`)
- ❌ **Wiring NATS JetStream réel** (publisher avec outbox PG LISTEN/NOTIFY) → **Story 0.7** (`@tukio/messaging`)
- ❌ **Outbox/Inbox tables** dans la migration baseline → **Story 0.7** (migration séparée `1715210000000-CreateOutboxInboxTables.ts`)
- ❌ **`KeycloakJwtGuard` appliqué** sur les endpoints → **Story 0.8** (lib) + **Story 1.4** (apply sur endpoints sensibles)
- ❌ **Replication réelle** dans les 9 autres services → **stories Epic 1+** (chaque service est répliqué quand sa première story commence). Story 0.6 livre **uniquement le script** + le test dry-run.
- ❌ **Use cases métier identity** (RegisterCustomer, GetMyProfile, UpdateProfile, etc.) → **Stories Epic 1** (Identity & Auth Backbone)
- ❌ **Aggregates KYC, Subscription** → Story 1.3 (Pro registration) + Story 9.1 (Subscriptions V1)
- ❌ **Audit trail `admin_actions` table** → **Story 2.7** (audit trail complète)
- ❌ **Tests d'intégration testcontainers** (vrai Postgres + vrai NATS) → **Story 0.9** (`@tukio/testing` testcontainers helpers)
- ❌ **Configuration K8s + Helm chart identity-svc** → **Story 0.12**
- ❌ **CI workflow GitHub Actions identity-svc** → **Story 0.11**
- ❌ **Observability OpenTelemetry tracing** → **Story 0.12**

### Files to UPDATE vs CREATE

> **À UPDATE** (existants depuis Story 0.1) :
> - `apps/identity-svc/package.json` — placeholder Story 0.1 (NestJS scaffold CLI default), cette story ajoute deps + scripts complets
> - `apps/identity-svc/tsconfig.json`, `tsconfig.build.json`, `nest-cli.json` — créés Story 0.1, ajustements mineurs si besoin
> - `apps/identity-svc/src/main.ts` — placeholder Story 0.1 (Hello World), cette story le remplace par bootstrap Pattern Pretre complet
> - `apps/identity-svc/src/app.module.ts` — placeholder Story 0.1, cette story le remplace
> - `apps/identity-svc/.env.example` — placeholder Story 0.1, étendre avec DB/Keycloak/NATS env vars
> - `apps/identity-svc/Dockerfile` — placeholder Story 0.1, cette story laisse intact (Story 0.10 le finalise)
> - `.eslintrc.cjs` racine — Story 0.1 a un slot `eslint-plugin-boundaries` en `warn` (frontend features). Cette story ajoute la config Pattern Pretre **strict** backend en `error`.

> **À CREATE** (nouveaux fichiers) :
> - **40-50 fichiers** dans `apps/identity-svc/src/{domain,usecases,infrastructure}/`
> - 3 fichiers tests E2E dans `apps/identity-svc/test/`
> - `apps/identity-svc/jest.config.ts` (coverage thresholds NFR71)
> - `apps/identity-svc/README.md`
> - `infra/scripts/replicate-pretre-structure.sh` + permissions exécutables (`chmod +x`)
> - **Estimation total fichiers créés** : ~50-55 fichiers

### Previous Story Intelligence (Stories 0.1 + 0.2 + 0.3 + 0.4 + 0.5)

**Story 0.1** :
- `apps/identity-svc/` scaffoldé via `@nestjs/cli new` avec `--strict`
- Port figé à 4001
- TypeScript strict + `noUncheckedIndexedAccess` (Story 0.1 task 5.1)
- `eslint-plugin-boundaries` posé en placeholder warn — Story 0.6 bascule en `error` strict avec config Pattern Pretre

**Story 0.2** :
- `@tukio/contracts` livré avec subpath exports : `@tukio/contracts/envelope` (SuccessEnvelope, ErrorEnvelope, ErrorBody, ValidationIssue, Pagination, Meta), `@tukio/contracts/types/{Actor,Locale,Currency,Money,DomainEvent}`
- **Story 0.6 consomme** : `import { SuccessEnvelope, ErrorEnvelope } from '@tukio/contracts/envelope'` dans interceptor + filter ADR-014, `import type { DomainEvent } from '@tukio/contracts/types/DomainEvent'` dans `IEventPublisher` port
- Lint custom `tukio/event-naming` actif → tout `eventType` qu'identity-svc publie via NatsPublisher (placeholder) doit respecter format `<service>.<aggregate>.<event>.v<n>`. Pas de publication active dans Story 0.6 mais futurs use cases doivent être prêts.

**Stories 0.3 + 0.4 + 0.5** :
- Frontend uniquement, **aucun impact** sur `identity-svc` backend.

**Pattern emerging across Sprint 0** :
- **Pattern subpath `exports`** dans tous les packages `@tukio/*` (Stories 0.2/0.3/0.4/0.5)
- **Anti-barrel** lint custom (`tukio/no-barrel-import-contracts`, `tukio/no-barrel-import-ui`) — Story 0.6 ne touche pas (pas de nouveau anti-barrel sur backend, le `eslint-plugin-boundaries` suffit)
- **Tests coverage NFR71** : 80/70/50 par layer Pattern Pretre

### Conventions à respecter (rappel)

| Convention | Règle | Application Story 0.6 |
|---|---|---|
| EN strict (paths, code) | Files PascalCase ou kebab-case selon type | ✅ tous les fichiers |
| camelCase JSON (DTOs) | `userId`, `keycloakUserId`, `firstName` | ✅ tous les DTOs |
| `<entity>.aggregate.ts`, `.entity.ts`, `.repository.port.ts`, etc. | Naming TypeScript Files (Architecture ligne 1145-1150) | ✅ structure folders |
| Symbol DI tokens SCREAMING_SNAKE_CASE | `USER_PROFILE_REPOSITORY` | ✅ tokens.ts |
| Interfaces préfixe `I` | `IUserProfileRepository`, `IEventPublisher` | ✅ tous les ports |
| Domain exceptions héritent base | `extends DomainException`, expose `tukioCode`/`httpStatus`/`title` | ✅ user-profile-not-found |
| Migrations backward-compat | `<timestamp>-<description>.ts` | ✅ baseline migration |
| Coverage NFR71 | domain ≥ 80, usecases ≥ 70, infrastructure ≥ 50 | ✅ jest.config.ts thresholds |
| Enveloppe REST | Controllers retournent DTO nu, interceptor wrap | ✅ AC10 |
| `Money` = `{ amount: cents, currency }` | Pas applicable identity, mais pattern à respecter futurs services | ⏸ futur |

### Testing Standards

- **Coverage cible** (NFR71) :
  - `domain/` ≥ 80 % (aggregates, value objects, exceptions — facile à 100 %)
  - `usecases/` ≥ 70 % (mocks ports, tests isolation)
  - `infrastructure/` ≥ 50 % (controllers + interceptor + filter via E2E, repositories partiellement testés)
- **Framework backend** : **Jest** (par défaut `@nestjs/cli`, cohérent Story 0.1 task 7.2)
- **Tests E2E** : NestJS `Test.createTestingModule(...).overrideProvider(...).compile()` + supertest
- **Pas de testcontainers** dans Story 0.6 (`@tukio/testing` arrive Story 0.9)
- **Pas de tests Playwright** (frontend uniquement, Story 0.5)

### Project Structure Notes

✅ **Aligné** avec Architecture §Cross-Cutting Concerns #1 lignes 168-232 (structure Pattern Pretre exacte).

✅ **Aligné** avec Architecture §Backend service structure lignes 1161-1208 (template booking-svc, transposable identity-svc).

✅ **Aligné** avec Architecture §Détail booking-svc lignes 2120-2164 (exemple concret avec aggregates/ports/use cases booking, transposable users).

✅ **Aligné** avec Architecture §Pattern Pretre scaffold manuel Sprint 0 lignes 444-461 (script de réplication mentionné).

⚠️ **À noter** : `gateway-api` n'a PAS le suffix `-svc` (ligne 2025 architecture). Story 0.6 inclut une entrée spécifique dans la config `eslint-plugin-boundaries` pour `apps/gateway-api/src/**` afin que la config Pattern Pretre s'applique aussi (gateway-api suit le même pattern). Le script de replication ne propose PAS `gateway-api` comme target (BFF spécifique, structure légèrement adaptée — sera traitée à part dans une story Epic 1 ou 2).

⚠️ **À noter** : `tukio_booking_svc_deepdive.md` est mentionné dans Architecture comme référence canonique customisée Tukio. Si ce doc existe physiquement dans `docs/`, le dev agent peut s'y référer pour des exemples plus concrets de booking-svc. **Vérifier** : `ls docs/tukio_booking_svc_deepdive.md`.

⚠️ **À noter** : la migration baseline `1715200000000-CreateUserProfilesBaseline.ts` utilise un timestamp arbitraire (correspond approximativement à mai 2024 epoch — placeholder). Le dev agent devra **regénérer le timestamp réel** au moment de l'exécution (`Date.now()` ou via `pnpm typeorm migration:generate`). Convention TypeORM = `<unix_timestamp_ms>-<PascalCaseName>.ts`.

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Cross-Cutting-Concerns-Clean-Architecture — Lines 168-232 (structure Pattern Pretre, règles non-négociables)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Backend-service-structure-Pattern-Pretre — Lines 1161-1208 (structure folders + naming)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Détail-booking-svc — Lines 2120-2164 (exemple concret structure complète)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Pattern-Pretre-scaffold-manuel-Sprint-0 — Lines 444-461 (commandes shell, repo Pretre référence)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Code-Naming-TypeScript — Lines 1131-1150 (file naming conventions)]
- [Source: _bmad-output/planning-artifacts/architecture.md#API-Response-Format-Enveloppe-REST-canonique-ADR-014 — Lines 1252-1505 (interceptor + exception filter)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Communication-Patterns-Event-Payload-Structure — Lines 1572-1611 (DomainEvent structure pour IEventPublisher port)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Outbox-Inbox-Tables — Lines 632-663 (schema outbox/inbox — différé Story 0.7)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Enforcement-Guidelines — Lines 1799-1853 (eslint-plugin-boundaries + lint custom)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Logging-Format — Lines 1762-1778 (pino structured JSON + PII redaction)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Pattern-Examples — Lines 1856-1972 (good vs anti-patterns Pattern Pretre + envelope)]
- [Source: _bmad-output/planning-artifacts/epics.md#Story-0.6 — Lines 939-953 (7 ACs originaux : structure dossier, no domain pollution, tokens SCREAMING_SNAKE, usecases-proxy DynamicModule, replication script, mocks ports tests, lint enforcement)]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR67 — pattern Pretre Clean Architecture]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR71 — coverage thresholds 80%/70%/50%]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR16 — PII redaction logs]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR83 — migrations backward-compatible]
- [Source: _bmad-output/implementation-artifacts/0-1-bootstrap-monorepo-turborepo-scaffold-nextjs-apps-nestjs-services.md — Story 0.1 dev context (apps/identity-svc placeholder, port 4001)]
- [Source: _bmad-output/implementation-artifacts/0-2-initialize-tukio-contracts-envelope-nats-events-dtos.md — Story 0.2 dev context (envelope types, DomainEvent, eventType lint)]
- [Source: External: https://github.com/jonathanPretre/clean-architecture-nestjs (repo référence Pattern Pretre canonique — cloner pour étudier `usecases-proxy.module.ts` exact)]
- [Memory: feedback_clean_architecture_explicit.md — interfaces dans domain/ports, impls dans infrastructure/, expliciter dans tous les artefacts]
- [Memory: feedback_api_envelope_response.md — enveloppe REST canonique sur toutes les responses gateway-api (étendu ici à identity-svc)]
- [Memory: feedback_tech_layer_english.md — code/files/folders en EN strict]
- [Memory: feedback_latest_versions.md — NestJS 11, TypeORM latest, Fastify, latest stable]

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (Claude Code CLI, mode dev-story bmad). Démarrage 2026-05-10 sur branche `feature/story-0.6-pattern-pretre-identity-svc` (depuis `develop@98703cb`).

### Debug Log References

- **Versions retenues (latest stable au 2026-05-10)** : `@nestjs/common@11`, `@nestjs/platform-fastify@11.1.19`, `@nestjs/typeorm@11.0.1`, `typeorm@0.3.29`, `pg@8.20`, `pino@10.3.1`, `nestjs-pino@4.6`, `nestjs-zod@5.3`, `zod@4.4.3`, `eslint-plugin-boundaries@6.0.2`, `@nestjs/config@4.0.4`. Pas de conflit de compat ; la combinaison a été validée par `pnpm typecheck` + `pnpm build` + `pnpm test:e2e`.
- **Fastify vs Express** : suppression de `@nestjs/platform-express` (scaffold Story 0.1 par défaut), ajout `@nestjs/platform-fastify`. Fastify accepte `app.inject()` pour les tests E2E sans serveur HTTP réel — utilisé dans `test/health.e2e-spec.ts` etc.
- **ESLint flat config (`eslint.config.mjs`)** : la spec AC8 décrit du legacy `.eslintrc.cjs`. Adaptée à la flat config existante (Story 0.1) avec un block dédié `pretre-domain` / `pretre-usecases` / `pretre-infrastructure` / `pretre-app` (préfixe `pretre-` pour ne pas collider avec le block workspace `app`/`package`/`tool`). Warnings de dépréciation `boundaries/element-types` et `boundaries/external` (v6) tolérés — fonctionnels mais syntaxe legacy. Migration vers `boundaries/dependencies` à planifier en Sprint 0 cleanup ou Story 0.11. Bug cosmétique : le placeholder `{{dependency}}` dans le message d'erreur affiche `[object Object]` au lieu du nom de lib (toujours bloquant en CI, juste le message qui est moche).
- **Couverture coverage NFR71** : pour respecter les seuils 80/70/50 par layer sans run combiné Jest + E2E, le `jest.config.ts` se limite à `domain/` + `usecases/` (couverture unit-test, ≥ 80/70). Les seuils `infrastructure/` ≥ 50 sont enforced via `pnpm test:e2e:cov` (nouveau script ajouté). Story 0.11 (CI) consolidera les deux runs.
- **NodeNext ESM + ts-jest CJS** : `moduleNameMapper` ajouté dans `jest.config.ts` et `test/jest-e2e.json` pour stripper les extensions `.js` des imports relatifs (`'^(\\.{1,2}/.*)\\.js$': '$1'`) — ts-jest run en CJS context, le code source utilise NodeNext convention.
- **Bug pré-existant `@tukio/contracts/types/Actor.ts`** : import `./Locale` sans extension `.js` (Story 0.2 ne l'avait pas attrapé car aucun consommateur strict NodeNext). Fix appliqué (`./Locale.js`) — les autres fichiers contracts étaient déjà OK.
- **`data-source.ts` import.meta.url** : remplacé par un glob string relatif au cwd CLI (`'src/infrastructure/persistence/typeorm/migrations/*.{ts,js}'`) car `identity-svc/package.json` n'est pas `type:module` (CJS build context), `import.meta` interdit par tsc.
- **Live smoke test `pnpm dev`** : non exécuté faute de Postgres local (Story 0.10 le provisionnera). Le bootstrap NestJS arrive jusqu'à TypeOrmModule, qui bloque sur le connect — comportement attendu, validé indirectement via le build (`nest build` OK) et les tests E2E (qui mockent le repository et bypass TypeORM).

### Completion Notes List

**Décisions clés**
1. Le scaffold du Pattern Pretre est en place dans `apps/identity-svc/src/` avec **toute** la structure exigée par AC1 (domain/model + ports + service + exception, usecases + spec, infrastructure/persistence/typeorm + messaging/nats + external/keycloak + http + logger + config + exception + usecases-proxy). 1 use case démonstratif (`GetUserProfileById`) traversant les 3 couches end-to-end.
2. **DI Symbol tokens** SCREAMING_SNAKE_CASE (AC3) : `USER_PROFILE_REPOSITORY`, `KEYCLOAK_SYNC`, `EVENT_PUBLISHER`, `LOGGER`, `CONFIG_SERVICE`. Tous via `Symbol(...)`, pas `Symbol.for(...)`.
3. **`UseCaseProxy<T>` + `UseCasesProxyModule.register()` DynamicModule** (AC4) — wiring port → impl centralisé en un seul endroit.
4. **Enveloppe REST ADR-014** (AC10) : `ResponseEnvelopeInterceptor` global wrap success en `SuccessEnvelope` (`method, code, data | data[], pagination?, meta`). `EnvelopeExceptionFilter` global mappe `DomainException` → `tukioCode/httpStatus/title`, `ZodError` → 422 `VALIDATION-FAILED-001 + issues[]`, autres → 500 `INTERNAL-SERVER-ERROR-001` avec PII redact (regex emails/téléphones FR).
5. **PII redaction** sur Pino logger (NFR16) : `redact.paths` configuré pour masquer `email`, `password`, `phone`, `metadata.*`, censor `***`.
6. **Migration baseline** (AC9) : `1715200000000-CreateUserProfilesBaseline.ts` crée `user_profiles` (id UUID PK, keycloak_user_id UNIQUE, email UNIQUE conditionnel `WHERE deleted_at IS NULL`, role/locale CHECK constraints, soft-delete via `deleted_at`). Migrations en mode `migrationsRun: false` + `synchronize: false` (NFR83).
7. **Lint enforcement Pattern Pretre** (AC2/AC8) : ESLint flat config (root + identity-svc local) avec `boundaries/elements` et `boundaries/external` strict. Vérifié manuellement : un fichier `domain/_test-violation.ts` important `typeorm` fail bien le lint avec un message Pattern Pretre (puis supprimé, pas committé).
8. **Script de replication `infra/scripts/replicate-pretre-structure.sh`** (AC13) : bash POSIX, BSD-sed compatible (macOS/Linux). Flags `--target` / `--dry-run` / `--force`. Whitelist 26 fichiers framework-only ; rewrites `identity-svc → <target>`, `IdentitySvc → <TargetPascal>`, `tukio_identity → tukio_<target_db>`. `tokens.ts` rendu en template (sans tokens identity-spécifiques). Vérifié dry-run sur catalog-svc → 26 fichiers prévus, exit 0.
9. **Tests** : 25 unit tests (Jest, all pass) + 7 E2E tests (Fastify `app.inject()`, mocks via `MockRepoModule.global=true`, all pass). Coverage : domain 97.95% / usecases 100% (test:cov) ; infrastructure 72.24% statements / 70.79% lines (test:e2e:cov) — **NFR71 ≥ 80/70/50 satisfait**.
10. **README identity-svc** (AC15) : description service, structure Pattern Pretre, lien repo Pretre, lien ADR-001 (à formaliser Story 0.13), 5 étapes "ajouter use case", 1 étape "ajouter migration", section replication.

**Déviations vs spec**
- **AC8 ESLint config** : la spec décrit du legacy `.eslintrc.cjs`. Le repo utilise déjà la flat config (Story 0.1). Adapté à la flat config sans changer la sémantique des règles (mêmes targets `domain/usecases/infrastructure/app`, mêmes deny lists I/O dans `domain/`).
- **`test:e2e:cov`** : ajout d'un script séparé pour la couverture infrastructure (la spec assumait un seul `test:cov` couvrant tout, mais Jest unit + E2E ne partagent pas le même runner — Story 0.11 CI les agrégera).
- **`HealthController`** : `@InjectDataSource()` rendu `@Optional()` pour permettre les E2E sans TypeOrmModule. En prod, `dataSource.isInitialized` reste source de vérité.
- **`tokens.ts` exclu de la couverture unit-test** : c'est un fichier de constantes Symbol pures, importé seulement par l'infrastructure (couvert par E2E indirectement via le wiring).

**Points d'attention pour stories suivantes**
- **Story 0.7 (`@tukio/messaging`)** : la classe `NatsPublisher` (`apps/identity-svc/src/infrastructure/messaging/nats/nats.publisher.ts`) est un placeholder qui log + no-op via `IEventPublisher.publish`. Story 0.7 doit (1) la remplacer par un vrai wrapper NATS JetStream + outbox PG LISTEN/NOTIFY, (2) ajouter une migration `1715210000000-CreateOutboxInboxTables.ts` séparée, (3) garder l'interface `IEventPublisher` stable (le port reste).
- **Story 0.8 (`@tukio/auth`)** : la lib doit fournir `KeycloakJwtGuard` qu'on appliquera aux endpoints sensibles à partir de Story 1.4. Le dossier `infrastructure/http/guards/.gitkeep` est déjà en place (slot prêt).
- **Story 1.1 (Provision Keycloak realm)** : `KeycloakService` (`infrastructure/external/keycloak/keycloak.service.ts`) est un placeholder no-op. Story 1.1 le remplace par des appels Keycloak Admin API réels (sync user attributes, locale, roles).
- **Stories Epic 1+** : ajouter aggregates/use cases métier identity (RegisterCustomer, GetMyProfile, UpdateProfile, DeleteAccountSoftDelete RGPD, etc.) en suivant exactement la convention Pattern Pretre + le wiring centralisé dans `UseCasesProxyModule.register()` (ajouter une `static <NAME>_USECASES_PROXY` constant + un provider).
- **Stories Epic 2-7 (catalog-svc, booking-svc, ...)** : utiliser `bash infra/scripts/replicate-pretre-structure.sh --target=<svc>` AVANT de commencer à coder, puis ajouter les aggregates spécifiques. Ne JAMAIS dériver du Pattern Pretre canonique.
- **`boundaries/external` deprecated** : à migrer vers `boundaries/dependencies` v6 syntax dans une story de cleanup Sprint 0 (Story 0.11 CI ?). Le bug cosmétique `[object Object]` dans le message d'erreur sera corrigé par la même migration.
- **Migration vers `@nestjs/platform-fastify`** : si une story Epic 1+ a besoin de body parsing avancé, vérifier la compat Fastify (cookies, multipart). NestJS abstrait la majorité, mais quelques edge cases Fastify-specific peuvent surgir.

### File List

**Créés (`apps/identity-svc/src/`)**
- `domain/model/user-profile.aggregate.ts`
- `domain/model/user-profile.aggregate.spec.ts`
- `domain/model/user-role.enum.ts`
- `domain/model/user-role.enum.spec.ts`
- `domain/model/email.value-object.ts`
- `domain/model/email.value-object.spec.ts`
- `domain/ports/user-profile.repository.port.ts`
- `domain/ports/keycloak-sync.port.ts`
- `domain/ports/event-publisher.port.ts`
- `domain/ports/logger.port.ts`
- `domain/ports/config.port.ts`
- `domain/ports/tokens.ts`
- `domain/service/.gitkeep`
- `domain/exception/domain.exception.ts`
- `domain/exception/user-profile-not-found.exception.ts`
- `domain/exception/invalid-email.exception.ts`
- `domain/exception/invalid-user-profile.exception.ts`
- `usecases/get-user-profile.usecase.ts`
- `usecases/get-user-profile.usecase.spec.ts`
- `infrastructure/persistence/typeorm/entities/user-profile.entity.ts`
- `infrastructure/persistence/typeorm/mappers/user-profile.mapper.ts`
- `infrastructure/persistence/typeorm/repositories/user-profile.typeorm.repository.ts`
- `infrastructure/persistence/typeorm/data-source.ts`
- `infrastructure/persistence/typeorm/typeorm-repositories.module.ts`
- `infrastructure/persistence/typeorm/migrations/1715200000000-CreateUserProfilesBaseline.ts`
- `infrastructure/messaging/nats/nats.publisher.ts`
- `infrastructure/messaging/nats/nats-publisher.module.ts`
- `infrastructure/external/keycloak/keycloak.service.ts`
- `infrastructure/external/keycloak/keycloak.module.ts`
- `infrastructure/http/dtos/user-profile-response.dto.ts`
- `infrastructure/http/controllers/user.controller.ts`
- `infrastructure/http/controllers/health.controller.ts`
- `infrastructure/http/envelope/envelope.helpers.ts`
- `infrastructure/http/interceptors/response-envelope.interceptor.ts`
- `infrastructure/http/filters/envelope-exception.filter.ts`
- `infrastructure/http/guards/.gitkeep`
- `infrastructure/http/http.module.ts`
- `infrastructure/logger/pino-logger.service.ts`
- `infrastructure/logger/logger.module.ts`
- `infrastructure/config/env.schema.ts`
- `infrastructure/config/environment-config.service.ts`
- `infrastructure/config/config.module.ts`
- `infrastructure/exception/.gitkeep`
- `infrastructure/usecases-proxy/usecases-proxy.ts`
- `infrastructure/usecases-proxy/usecases-proxy.module.ts`

**Créés (`apps/identity-svc/test/`)**
- `test/jest-e2e.json` *(remplacé)*
- `test/health.e2e-spec.ts`
- `test/user.e2e-spec.ts`
- `test/envelope.e2e-spec.ts`
- `test/helpers/build-test-app.ts`

**Créés (`apps/identity-svc/`)**
- `jest.config.ts`

**Créés (autres)**
- `infra/scripts/replicate-pretre-structure.sh` *(chmod +x)*

**Modifiés**
- `apps/identity-svc/package.json` *(deps + scripts complets, swap platform-express → platform-fastify, +tsx, +eslint-plugin-boundaries, +typeorm, +pg, +pino, +nestjs-pino, +pino-pretty, +nestjs-zod, +zod, +@tukio/contracts workspace, +@types/pg)*
- `apps/identity-svc/src/main.ts` *(remplacement complet — bootstrap Fastify + envelope global + logger Pino)*
- `apps/identity-svc/src/app.module.ts` *(remplacement complet — ConfigurationModule, LoggerModule, TypeOrmModule.forRootAsync, HttpModule)*
- `apps/identity-svc/.env.example` *(extension : DB_*, KEYCLOAK_*, NATS_*, LOG_LEVEL, SERVICE_*)*
- `apps/identity-svc/eslint.config.mjs` *(ajout block Pattern Pretre boundaries strict)*
- `apps/identity-svc/README.md` *(remplacement complet — description Pattern Pretre + comment ajouter use case/migration)*
- `eslint.config.mjs` *(racine — ajout block Pattern Pretre boundaries pour `apps/*-svc/src/**` + `apps/gateway-api/src/**`)*
- `packages/contracts/src/types/Actor.ts` *(fix bug NodeNext : `./Locale` → `./Locale.js`)*
- `_bmad-output/implementation-artifacts/sprint-status.yaml` *(0-6-… : ready-for-dev → in-progress → review)*

**Supprimés (placeholders Story 0.1)**
- `apps/identity-svc/src/app.controller.ts`
- `apps/identity-svc/src/app.controller.spec.ts`
- `apps/identity-svc/src/app.service.ts`
- `apps/identity-svc/test/app.e2e-spec.ts`

### Change Log

| Date | Auteur | Modification |
| --- | --- | --- |
| 2026-05-10 | claude-opus-4-7 (dev agent) | Implémentation complète Story 0.6 — Pattern Pretre canonique scaffolded dans `apps/identity-svc/`, 14 tasks done, 25 unit tests + 7 E2E tests passing, NFR71 coverage thresholds respectés (domain 97.95% / usecases 100% / infrastructure 72.24%), `infra/scripts/replicate-pretre-structure.sh` POSIX bash livré + dry-run validé sur catalog-svc. Status moved to `review`. |

---

## Story Completion Status

- **Story Status** : `review`
- **Originally created** : 2026-05-09
- **Created** : 2026-05-09
- **Created by** : `bmad-create-story` workflow
- **Epic** : Epic 0 — Sprint 0 Foundation (MVP, foundational)
- **Sprint cible** : Sprint 0 (semaines 1-3 du planning MVP)
- **Estimation effort** : 5-7 jours (premier service backend complet, scaffolding lourd : 50+ fichiers + DataSource + interceptor/filter envelope + eslint-plugin-boundaries config + script replication + tests E2E + README)
- **Dépendances upstream** :
  - Story 0.1 (`ready-for-dev`) — `apps/identity-svc/` scaffoldé via `@nestjs/cli`, port 4001 figé
  - Story 0.2 (`ready-for-dev`) — `@tukio/contracts/envelope` + `@tukio/contracts/types/DomainEvent` consommés
- **Dépendances downstream** :
  - **Story 0.7** (`@tukio/messaging`) — replace NatsPublisher placeholder par real wrapper NATS JetStream + outbox/inbox tables migration
  - **Story 0.8** (`@tukio/auth`) — fournit KeycloakJwtGuard à appliquer sur endpoints sensibles
  - **Story 0.9** (`@tukio/testing`) — fournit testcontainers helpers (Postgres) pour tests d'intégration repositories
  - **Story 0.10** (Docker Compose) — fournit Postgres `tukio_identity` DB + NATS + Keycloak local
  - **Story 0.11** (CI) — branche `pnpm --filter=identity-svc lint && test` en CI obligatoire
  - **Story 0.12** (Helm + observability) — finalise Dockerfile + ajoute K8s manifests + Prometheus metrics
  - **Story 0.13** (ADRs) — documente formellement ADR-001 (Pattern Pretre)
  - **Stories Epic 1** (Identity & Auth Backbone) — toutes les stories ajoutent des aggregates/use cases dans `apps/identity-svc/src/`
  - **Stories Epic 2-7** (catalog-svc, booking-svc, etc.) — utilisent le script `replicate-pretre-structure.sh` pour leur scaffolding
- **FRs covered** : aucun FR direct (foundational, prerequis to all backend services)
- **NFRs touchés** :
  - **NFR67** — Pattern Pretre figé + enforced via lint ✅
  - **NFR71** — coverage 80/70/50 thresholds par layer ✅
  - **NFR16** — PII redaction logger ✅
  - **NFR83** — migrations backward-compatible (baseline + futures) ✅
  - **NFR74** — conventions naming + structure enforced via lint ✅
  - **ADR-001** — préparé (formalisé Story 0.13)
  - **ADR-014** — enveloppe REST appliquée localement (sera répliquée gateway-api Story Epic 1+) ✅
