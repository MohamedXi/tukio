# Skill: add a new backend service

Scaffold a new NestJS service that follows **Pattern Pretre** end-to-end:
domain (pure), use cases, infrastructure adapters, TypeORM migrations,
outbox/inbox, REST envelope, Pino logging, Keycloak JWT validation.

The canonical reference is **`apps/identity-svc/`**. Mirror its structure.

## Prerequisites

- Story file with the service name + scope clarified
  (`apps/<svc>/` folder name = lowercase, kebab-case, suffixed `-svc`,
  e.g. `catalog-svc`, `booking-svc`).
- Service has its own logical DB (`tukio_<name>`) provisioned by the
  Postgres init SQL — add the line in
  `infra/docker-compose/postgres-init/01-create-tukio-databases.sql`
  **before** running the scaffolding (otherwise Keycloak boots fine but
  your service can't connect on first dev start).
- Read `.agents/context/pretre-pattern.md` in full.
- Read `apps/identity-svc/` end-to-end (skim) to ground the mirror.

## Folder skeleton

```
apps/<svc>/
├── src/
│   ├── domain/
│   │   ├── model/                  Aggregates + value objects (.aggregate.ts, .value-object.ts)
│   │   ├── ports/                  Interfaces (I<Name>Repository, IEventPublisher, ILogger, IConfig)
│   │   │   └── tokens.ts           DI Symbols / constants
│   │   ├── service/                Pure domain services
│   │   └── exception/              DomainException subclasses
│   ├── usecases/
│   │   └── <verb>-<noun>.usecase.ts        (+ .usecase.spec.ts colocated)
│   ├── infrastructure/
│   │   ├── config/
│   │   │   ├── env.schema.ts                Zod schema for env vars
│   │   │   └── environment-config.service.ts implements IConfigService
│   │   ├── http/
│   │   │   ├── controllers/                <name>.controller.ts
│   │   │   ├── dto/                        Zod request DTOs (extend @tukio/contracts when shared)
│   │   │   └── http.module.ts
│   │   ├── persistence/typeorm/
│   │   │   ├── data-source.ts              SINGLE default export — TypeORM CLI hates double exports
│   │   │   ├── entities/                   <name>.entity.ts
│   │   │   ├── repositories/               typeorm-<name>.repository.ts (implements domain port)
│   │   │   ├── migrations/                 <timestamp>-<Name>.ts
│   │   │   └── typeorm.module.ts
│   │   ├── messaging/                      Outbox publisher + Inbox handlers
│   │   ├── external/                       Third-party adapters (Stripe, Keycloak admin, …)
│   │   ├── logger/                         Pino adapter implementing ILogger
│   │   ├── usecases-proxy/                 Factory bindings: domain port → infra impl
│   │   └── exception/                      EnvelopeExceptionFilter
│   ├── app.module.ts                       Wires infrastructure modules
│   └── main.ts                             NestJS bootstrap (Fastify + URI versioning)
├── test/
│   ├── jest-e2e.json                       E2E Jest config (different moduleNameMapper)
│   ├── *.e2e-spec.ts                       E2E specs
│   ├── chaos/*.chaos-spec.ts               Chaos suite (when applicable)
│   ├── __mocks__/                          jwks-rsa nock mock, etc.
│   └── build-test-app.ts                   Helper to spin up the NestJS app for e2e
├── jest.config.ts                          Unit test config
├── nest-cli.json
├── package.json
├── tsconfig.json + tsconfig.build.json
├── webpack.config.cjs                      Inherits from root `webpack.tukio.cjs`
├── Dockerfile                              Multi-stage build (refined in Story 0.12)
├── eslint.config.mjs                       Inherits root + per-service overrides
├── .env.example                            Env template (see existing services)
└── README.md
```

## Step-by-step

1. **Add the DB to the init SQL.** Edit
   `infra/docker-compose/postgres-init/01-create-tukio-databases.sql`
   and add `'tukio_<name>'` to the `unnest(ARRAY[...])` list. Run
   `pnpm docker:down:volumes && pnpm docker:up:wait && pnpm docker:bootstrap`
   to verify Keycloak still boots and the new DB exists
   (`docker exec -i tukio_postgres psql -U tukio -d postgres -c '\l' | grep tukio_<name>`).

2. **Scaffold the folder.** Either copy `apps/identity-svc/` verbatim and
   adjust the names, or run the legacy helper
   `bash infra/scripts/replicate-pretre-structure.sh <new-svc>` (Story 0.6
   legacy script — verify it still matches Story 0.10 conventions before
   trusting blindly). After scaffolding:
   - Rename `UserProfile` everywhere → your aggregate name.
   - Adjust `package.json#name` to `<svc>` (no scope prefix).
   - Add to `pnpm-workspace.yaml` (`apps/<svc>`).

3. **Update `acs.yaml`.** Add the new service to
   `.agents/acs.yaml#codebases.services` with port + role.

4. **Update `.env.example`** for the service. Mirror the per-service
   pattern (`DB_*`, `KEYCLOAK_*`, `NATS_*`, `REDIS_URL`, `SMTP_*` if
   notification-svc-like, etc.). See existing apps for the exact list.
   Pick the next free port in the 4000-4009 range — they're allocated;
   if you're inserting between two services, surface and ask.

5. **Define the domain.**
   - Create `domain/model/<aggregate>.aggregate.ts` with a private
     constructor + static `create(...)` factory + invariants.
   - Create `domain/model/<value-object>.value-object.ts` for primitives
     that have meaning (`Email`, `Money`, `Slug`…).
   - Create `domain/exception/<name>.exception.ts` extending
     `DomainException` with stable `tukioCode`.
   - Create `domain/ports/<name>.repository.port.ts` and
     `domain/ports/tokens.ts`.

6. **Write the use case.**
   - `usecases/<verb>-<noun>.usecase.ts` — constructor takes port
     interfaces, `execute(input)` returns aggregate.
   - Colocate `<verb>-<noun>.usecase.spec.ts` with mocks of the ports.

7. **TypeORM adapter.**
   - `infrastructure/persistence/typeorm/entities/<name>.entity.ts`
   - `infrastructure/persistence/typeorm/repositories/typeorm-<name>.repository.ts`
     implements the domain port; uses the entity; maps to / from
     aggregate.
   - `infrastructure/persistence/typeorm/data-source.ts` — **single
     `export default dataSource`** (TypeORM CLI rejects double exports).
     Mirror identity-svc's `data-source.ts` for env defaults + the
     `NODE_ENV === 'production'` guard on `DB_PASSWORD`.

8. **Initial migration.**

   ```bash
   pnpm --filter=<svc> migration:generate -- -n CreateBaseline
   pnpm --filter=<svc> migration:run
   ```

   The migration creates the aggregate table + indexes. Add the
   `1715210000000-AddOutboxInboxTables.ts` migration from identity-svc
   (or generate equivalent) so the outbox/inbox tables exist before any
   event publishing.

9. **HTTP layer.**
   - `infrastructure/http/controllers/<name>.controller.ts`:
     `@Controller('<plural>')` (no `/v1/` prefix), `@UseGuards(KeycloakJwtGuard, RolesGuard)`,
     `@Roles(...)`, `@Public()` on health / ready only.
   - DTOs as Zod schemas, parsed with `nestjs-zod`.
   - Controller returns the aggregate; `EnvelopeInterceptor` wraps it.
     For collections, return `SuccessEnvelope<T>` explicitly with
     `pagination`.

10. **Outbox + NATS module.**
    - In `app.module.ts`, import
      `OutboxRelayModule.forRoot({ streamName: 'TUKIO_<SERVICE>' })`
      from `@tukio/messaging`.
    - In any use case that emits events, inject the `IEventPublisher`
      port (bound to `OutboxPublisher` via `usecases-proxy/`).
    - Define event schemas in
      `packages/contracts/src/events/<domain>/<event>.v1.ts` (see
      `.agents/skills/add-nats-event.md`).

11. **Wire `@tukio/auth`.** Import `TukioAuthModule.forRootAsync<TDeps>`
    in `app.module.ts`, injecting the `IConfigService` to supply
    `KEYCLOAK_URL` / `REALM` / `CLIENT_ID` / `AUDIENCE`. The module
    registers `KeycloakJwtGuard` + `RolesGuard` + the JWKS cache.

12. **Wire `@tukio/contracts` `EnvelopeInterceptor` + `EnvelopeExceptionFilter`.**
    - Register `EnvelopeInterceptor` globally (`APP_INTERCEPTOR`).
    - Register `EnvelopeExceptionFilter` globally (`APP_FILTER`).

13. **`main.ts`.** Fastify adapter, `app.enableVersioning({ type:
VersioningType.URI, defaultVersion: '1' })`, listen on
    `process.env.PORT ?? <default>`.

14. **Add the service to `bootstrap-databases.sh`** in the `SERVICES`
    array, so its migrations run on `pnpm docker:bootstrap`.

15. **Tests.**
    - Unit: domain + use case (mock ports).
    - E2E: full app boot, GET / POST endpoints, 401 / 403 / 200
      enveloped responses, NATS event flow (via testcontainers when
      applicable).
    - Chaos: if the service produces or consumes events, add at least
      one `*.chaos-spec.ts` per `.agents/context/messaging.md`.

16. **Update Turborepo pipeline** if the service needs custom build /
    typecheck commands (usually not — inherits from root `turbo.json`).

17. **Smoke test.**

    ```bash
    pnpm docker:up:wait && pnpm docker:bootstrap
    pnpm --filter=<svc> dev
    curl http://localhost:<port>/v1/health        # → 200 enveloped
    curl http://localhost:<port>/v1/<resource>    # → 401 enveloped (no token)
    ```

18. **Run `/check`** — `pnpm lint && pnpm typecheck && pnpm test`.

19. **Commit + PR.** Story branch `feature/story-<X.Y>-<slug>`. Commit
    `feat(<svc>): scaffold <name>-svc Pretre baseline — Story <X.Y>`.

## Anti-patterns to refuse

- Skipping the DB add to `01-create-tukio-databases.sql` — your service
  crashes on first dev start, you'll waste 20 min debugging.
- Two `export const dataSource` + `export default dataSource` in the
  same data-source file — TypeORM CLI rejects.
- Importing `@nestjs/*`, `typeorm`, `pg`, `axios`, etc. from `domain/`
  — `eslint.config.mjs#FORBIDDEN_IN_DOMAIN` blocks.
- Returning a TypeORM entity from a use case — map to aggregate.
- Skipping `EnvelopeInterceptor` + `EnvelopeExceptionFilter` — every
  response must be enveloped.
- Skipping `OutboxPublisher` for events — `tukio/no-direct-event-publish`
  flags.
- Allocating a port outside the 4000-4009 range — surface and ask
  before deviating.
- Hardcoding `DB_PASSWORD` fallback without the
  `NODE_ENV !== 'production'` guard.
