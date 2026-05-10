# identity-svc

User & identity management microservice for Tukio (FR1–17 — registration, authentication context, profile management, RGPD soft-delete). NestJS 11 + Fastify on port `4001`, persisted on Postgres `tukio_identity`.

This service is the **canonical Pattern Pretre template** (Clean Architecture). All other backend services (`catalog-svc`, `booking-svc`, `order-svc`, `payment-svc`, `messaging-svc`, `review-svc`, `notification-svc`, `media-svc`, `gateway-api`) inherit this exact layout via `infra/scripts/replicate-pretre-structure.sh`.

## Pattern Pretre — directory layout

```
apps/identity-svc/src/
├─ main.ts                        # bootstrap NestJS Fastify (port 4001)
├─ app.module.ts                  # imports ConfigurationModule, LoggerModule, TypeOrm, HttpModule
├─ domain/                        # ZERO I/O lib import (no @nestjs/*, no typeorm, no axios)
│  ├─ model/                      # aggregates + value objects + enums
│  │  ├─ user-profile.aggregate.ts
│  │  ├─ user-role.enum.ts
│  │  └─ email.value-object.ts
│  ├─ ports/                      # interfaces ONLY (impls live in infrastructure/)
│  │  ├─ user-profile.repository.port.ts
│  │  ├─ keycloak-sync.port.ts          # placeholder — Story 1.1
│  │  ├─ event-publisher.port.ts        # placeholder — Story 0.7
│  │  ├─ logger.port.ts
│  │  ├─ config.port.ts
│  │  └─ tokens.ts                       # SCREAMING_SNAKE_CASE Symbol DI tokens
│  ├─ service/                    # domain services (stateless, currently empty)
│  └─ exception/                  # DomainException base + concrete exceptions
├─ usecases/                      # 1 file per use case, single .execute() entrypoint
│  ├─ get-user-profile.usecase.ts
│  └─ get-user-profile.usecase.spec.ts   # mocks ports, ≥ 90 % coverage
└─ infrastructure/                # implementations of the ports + framework wiring
   ├─ persistence/typeorm/        # entity, mapper, repository, DataSource, migrations
   ├─ messaging/nats/             # IEventPublisher placeholder (Story 0.7)
   ├─ external/keycloak/          # IKeycloakSync placeholder (Story 1.1)
   ├─ http/                       # controllers, DTOs, interceptors (envelope ADR-014), filters
   ├─ logger/                     # pino adapter for ILogger
   ├─ config/                     # IConfigService + Zod env validation
   └─ usecases-proxy/             # central wiring: ports → impls (only place they meet)
```

> Reference repo (Pattern Pretre canonical): https://github.com/jonathanPretre/clean-architecture-nestjs
>
> Architecture Decision Record: [`docs/adr/0001-pretre-clean-architecture.md`](../../docs/adr/0001-pretre-clean-architecture.md) _(formalized Story 0.13)_
>
> Boundaries enforced by `eslint-plugin-boundaries` — see root `eslint.config.mjs` and local `eslint.config.mjs`. A PR that imports `typeorm` or `@nestjs/*` inside `domain/` will fail CI.

## Scripts

| Command                                       | Description                                                                      |
| --------------------------------------------- | -------------------------------------------------------------------------------- |
| `pnpm --filter=identity-svc dev`              | Start with `nest start --watch` on port `$PORT` (4001 by default)                |
| `pnpm --filter=identity-svc build`            | Compile to `dist/`                                                               |
| `pnpm --filter=identity-svc test`             | Unit + integration tests with Jest (NFR71 thresholds enforced)                   |
| `pnpm --filter=identity-svc test:cov`         | Coverage report (`domain/` ≥ 80 %, `usecases/` ≥ 70 %, `infrastructure/` ≥ 50 %) |
| `pnpm --filter=identity-svc test:e2e`         | E2E tests against the Fastify app (envelope, health, user routes)                |
| `pnpm --filter=identity-svc lint`             | ESLint with Pattern Pretre boundaries strict                                     |
| `pnpm --filter=identity-svc typecheck`        | `tsc --noEmit`                                                                   |
| `pnpm --filter=identity-svc migration:run`    | Apply pending TypeORM migrations                                                 |
| `pnpm --filter=identity-svc migration:revert` | Roll back last migration                                                         |

## How do I add a new use case?

1. **Define the aggregate** in `domain/model/<aggregate>.aggregate.ts`. Make every field `readonly`. Validate invariants in `static create(...)`. Throw a `DomainException` (subclass) when an invariant is violated.
2. **Define the port** in `domain/ports/<aggregate>.repository.port.ts` (e.g. `IUserProfileRepository`) and add its DI token to `domain/ports/tokens.ts` (`SCREAMING_SNAKE_CASE`).
3. **Implement the use case** in `usecases/<verb-object>.usecase.ts`. No NestJS decorators — the use case is plain TypeScript that depends on ports through its constructor. Co-locate `.spec.ts` with mocked ports (`jest.fn()`).
4. **Implement the repository** in `infrastructure/persistence/typeorm/repositories/<aggregate>.typeorm.repository.ts`. Apply `@Injectable()`. Use a mapper (`infrastructure/persistence/typeorm/mappers/`) to translate between the TypeORM entity and the aggregate.
5. **Wire it up** in `infrastructure/usecases-proxy/usecases-proxy.module.ts`: add a static name (e.g. `static GET_LISTING_USECASES_PROXY = 'GET_LISTING_USECASES_PROXY'`) and a provider with `inject` + `useFactory` that returns `new UseCaseProxy(new MyUseCase(repo))`. **This is the only place where `domain/` and `infrastructure/` meet.**

The controller injects the use case proxy via `@Inject(UseCasesProxyModule.GET_LISTING_USECASES_PROXY)` and calls `proxy.getInstance().execute(...)`. Return the bare DTO — `ResponseEnvelopeInterceptor` wraps it automatically (ADR-014).

## How do I add a migration?

```bash
pnpm --filter=identity-svc migration:generate src/infrastructure/persistence/typeorm/migrations/<TimestampName>
pnpm --filter=identity-svc migration:run
```

Migrations must be **backward-compatible** (NFR83): drop columns in two steps (mark nullable + backfill in N, drop in N+1). Never run `synchronize: true` against any environment. The DataSource intentionally leaves `migrationsRun: false` so deploys are explicit.

## Environment

Copy `.env.example` to `.env.local` and edit the values for your machine. Postgres, Keycloak and NATS dependencies will be provided by Story 0.10 (`docker-compose.dev.yml`).

## Replicating this template into another service

```bash
bash infra/scripts/replicate-pretre-structure.sh --target=<svc> [--dry-run]
```

The script copies framework-only files (interceptors, filters, `UseCaseProxy`, logger, config, exception base, gitkeeps, module shells) and rewrites identity-specific labels. It deliberately skips identity domain logic (the target service must define its own aggregates and use cases).
