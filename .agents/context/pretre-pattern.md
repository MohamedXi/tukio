# Pattern Pretre — Clean Architecture for backend services

Every NestJS service in `apps/<svc>/` follows **Pattern Pretre**, a
hexagonal Clean Architecture layout where the domain is pure TypeScript
and frameworks live at the edges. **`apps/identity-svc/src/`** is the
canonical reference — mirror its structure for every new service.

## Folder skeleton

```
apps/<svc>/src/
├── domain/                          PURE TypeScript. NO I/O, NO frameworks.
│   ├── model/                       Aggregates + value objects + entities (rich domain)
│   │   ├── <name>.aggregate.ts      e.g. user-profile.aggregate.ts
│   │   └── <name>.value-object.ts   e.g. email.value-object.ts
│   ├── ports/                       Interfaces — what the domain needs from the outside
│   │   ├── <name>.repository.port.ts
│   │   ├── <name>.service.port.ts
│   │   ├── event-publisher.port.ts
│   │   ├── logger.port.ts
│   │   ├── config.port.ts
│   │   └── tokens.ts                DI tokens (Symbol or string constants)
│   ├── service/                     Pure domain services (compose aggregates)
│   └── exception/                   Domain-level exceptions extending DomainException
│
├── usecases/                        Orchestration. Depends ONLY on domain/ports/.
│   └── <verb>-<noun>.usecase.ts     e.g. get-user-profile.usecase.ts
│
├── infrastructure/                  Adapters. Implements domain ports. Talks to PG/NATS/etc.
│   ├── config/                      env.schema.ts (Zod) + EnvironmentConfigService
│   ├── http/                        NestJS controllers, DTOs, ValidationPipes
│   │   ├── controllers/
│   │   ├── dto/
│   │   └── http.module.ts
│   ├── persistence/
│   │   └── typeorm/
│   │       ├── data-source.ts       Standalone DataSource for migrations CLI (single export!)
│   │       ├── entities/
│   │       ├── repositories/        Implements domain ports
│   │       ├── migrations/
│   │       └── typeorm.module.ts
│   ├── messaging/                   NatsPublisher, OutboxRelay, Inbox dedup
│   ├── external/                    Third-party adapters (Keycloak admin, Stripe, …)
│   ├── logger/                      Pino adapter implementing ILogger
│   ├── usecases-proxy/              Wraps usecases for DI (factory pattern)
│   └── exception/                   EnvelopeExceptionFilter (catches DomainException)
│
├── app.module.ts                    Wires infrastructure modules + UseCasesProxyModule
└── main.ts                          NestJS bootstrap (Fastify adapter)
```

## Hard rules (enforced by ESLint)

`eslint.config.mjs` enforces these via `boundaries/element-types` and the
`FORBIDDEN_IN_DOMAIN` list. Violations are errors at Story 0.11 (CI).

### `domain/` MUST NOT import:

```
@nestjs/*, typeorm, @nestjs/typeorm, @nestjs/config,
@nestjs/platform-fastify, axios, pg, keycloak-connect, stripe,
@tukio/messaging, @tukio/auth, pino, nestjs-pino, pino-http,
pino-pretty, rxjs
```

The domain only knows about TypeScript primitives, value objects,
aggregates, and **its own port interfaces**.

### `usecases/` may import:

- Anything from `domain/` (aggregates, value objects, ports, exceptions).
- DI tokens from `domain/ports/tokens.ts` (used by `@Inject(...)` decorators
  in `usecases-proxy/` factories — but the use-case itself is constructor-DI
  agnostic).
- Standard library only — no frameworks, no I/O.

### `infrastructure/` may import:

- Anything from `domain/` (to implement ports + handle aggregates).
- Anything from `usecases/` (to inject them into controllers).
- Frameworks (NestJS, TypeORM, Pino, …) and third-party libs (Stripe,
  Keycloak admin, …).

## Pattern: domain port → infrastructure adapter

```ts
// apps/identity-svc/src/domain/ports/user-profile.repository.port.ts
import type { UserProfile } from '../model/user-profile.aggregate.js';

export interface IUserProfileRepository {
  findById(id: string): Promise<UserProfile | null>;
  findByKeycloakUserId(keycloakUserId: string): Promise<UserProfile | null>;
  save(userProfile: UserProfile): Promise<void>;
}
```

```ts
// apps/identity-svc/src/domain/ports/tokens.ts
export const USER_PROFILE_REPOSITORY = Symbol('USER_PROFILE_REPOSITORY');
```

```ts
// apps/identity-svc/src/infrastructure/persistence/typeorm/repositories/typeorm-user-profile.repository.ts
import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import type { IUserProfileRepository } from '../../../../domain/ports/user-profile.repository.port.js';
import type { UserProfile } from '../../../../domain/model/user-profile.aggregate.js';
import { UserProfileEntity } from '../entities/user-profile.entity.js';

@Injectable()
export class TypeormUserProfileRepository implements IUserProfileRepository {
  constructor(private readonly repo: Repository<UserProfileEntity>) {}
  async findById(id: string): Promise<UserProfile | null> {
    /* ... */
  }
  async findByKeycloakUserId(kcId: string): Promise<UserProfile | null> {
    /* ... */
  }
  async save(userProfile: UserProfile): Promise<void> {
    /* ... */
  }
}
```

```ts
// apps/identity-svc/src/usecases/get-user-profile.usecase.ts
import type { IUserProfileRepository } from '../domain/ports/user-profile.repository.port.js';
import type { UserProfile } from '../domain/model/user-profile.aggregate.js';
import { UserNotFoundException } from '../domain/exception/user-not-found.exception.js';

export class GetUserProfileUseCase {
  constructor(private readonly repo: IUserProfileRepository) {}

  async execute(id: string): Promise<UserProfile> {
    const profile = await this.repo.findById(id);
    if (!profile) throw new UserNotFoundException(id);
    return profile;
  }
}
```

The use-case takes the **port interface**, not the concrete implementation.
`usecases-proxy/` is the only place where the two are bound:

```ts
// apps/identity-svc/src/infrastructure/usecases-proxy/usecases-proxy.module.ts
import { GetUserProfileUseCase } from '../../usecases/get-user-profile.usecase.js';
import { TypeormUserProfileRepository } from '../persistence/typeorm/repositories/typeorm-user-profile.repository.js';
// inject TypeormUserProfileRepository where the use case wants IUserProfileRepository
```

## DynamicModules with `forRootAsync<TDeps>`

When a module needs runtime config from another module (e.g. `@tukio/auth`
needs `IConfigService`), expose `forRootAsync<TDeps>(opts)` rather than
`forRoot(staticConfig)`. Pattern reference: `OutboxRelayModule`,
`NatsJetStreamModule`, `TukioAuthModule`.

```ts
@Module({})
export class TukioAuthModule {
  static forRootAsync<TDeps>(opts: ForRootAsyncOptions<TDeps, TukioAuthConfig>): DynamicModule {
    return {
      module: TukioAuthModule,
      imports: opts.imports,
      providers: [
        { provide: 'TUKIO_AUTH_CONFIG', useFactory: opts.useFactory, inject: opts.inject },
        // ... other providers
      ],
      exports: ['TUKIO_AUTH_CONFIG' /* ... */],
    };
  }
}
```

## Controllers + URI versioning

- `@Controller('users')` — **no `/v1/`** prefix in the decorator.
- Versioning is configured globally in `main.ts`:
  `app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })`.
  Every route renders as `/v1/users/...`.
- Use `@Public()` (`@tukio/auth/decorators/public`) on health / ready
  endpoints. Everything else is guarded by `KeycloakJwtGuard` +
  `RolesGuard` + role decorators.

```ts
@Controller('users')
@UseGuards(KeycloakJwtGuard, RolesGuard)
export class UserController {
  @Get(':id')
  @Roles('client', 'pro', 'admin-support', 'admin-modo', 'admin-super')
  async getById(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.useCase.execute(id);
  }
}
```

## DI container shape

- **NestJS `@Injectable()`** for every infrastructure adapter.
- **Domain classes (`UserProfile`, `Email`, …) are NOT `@Injectable()`** —
  they're plain TypeScript constructed by repositories or use cases.
- **Use cases are NOT `@Injectable()`** either — they're constructed by
  `UseCasesProxyModule` factories that inject the right port impls.

## Logger

- **Inject `ILogger`** (the port) into use cases and domain services.
- The infrastructure provides a `PinoLoggerAdapter` that implements
  `ILogger` and wraps `nestjs-pino`. **Never `console.log`.**

## Common file references

- Canonical service: **`apps/identity-svc/`**
- Canonical aggregate: **`apps/identity-svc/src/domain/model/user-profile.aggregate.ts`**
- Canonical port: **`apps/identity-svc/src/domain/ports/user-profile.repository.port.ts`**
- Canonical use case: **`apps/identity-svc/src/usecases/get-user-profile.usecase.ts`**
- Canonical adapter: **`apps/identity-svc/src/infrastructure/persistence/typeorm/repositories/typeorm-user-profile.repository.ts`**
- Canonical migration: **`apps/identity-svc/src/infrastructure/persistence/typeorm/migrations/1715200000000-CreateUserProfilesBaseline.ts`**
- Canonical data-source (TypeORM CLI): **`apps/identity-svc/src/infrastructure/persistence/typeorm/data-source.ts`**
  ⚠️ Single export only (`export default dataSource`) — TypeORM CLI rejects
  files with multiple `DataSource` exports.

## Anti-patterns to refuse

- Importing a TypeORM entity from `domain/`.
- Putting `@Injectable()` on a domain aggregate.
- Returning a TypeORM entity from a use case (return the aggregate).
- Throwing a `QueryFailedError` from a use case (wrap in `DomainException`
  at the infrastructure boundary).
- Two `export const dataSource` + `export default dataSource` in the same
  data-source file.
- Direct `nats.publish()` from a use case — use `OutboxPublisher`.
- `console.log` in a controller, use case, or adapter — use `ILogger`.
- Skipping `@UseGuards(KeycloakJwtGuard, RolesGuard)` on a non-`@Public()`
  controller.
