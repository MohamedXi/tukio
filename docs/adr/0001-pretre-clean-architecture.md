# ADR-0001: Pattern Pretre Clean Architecture (strict, NestJS microservices)

- **Status**: ✅ Accepted
- **Date**: 2026-05-09
- **Deciders**: Ismael (founder), tech lead
- **Tags**: `architecture`, `backend`, `pattern`

## Context

Tukio.one deploys 10 NestJS microservices that must evolve over 5+ years with changing teams.
Without an enforced structure from day one, each service drifts toward its own style — a documented
pattern in fast-growing startups that incurs massive refactoring cost after 18 months.

Several forces are in tension:

1. **Short-term productivity vs long-term maintainability**: A strict pattern adds ~20-30 % scaffolding
   overhead upfront but reduces marginal cost of each new feature to near zero after the first service.
2. **Flexibility vs constraint**: Enforcing via ESLint prevents "I know what I'm doing" shortcuts that
   erode the codebase over time.
3. **Pattern choice**: Multiple Clean Architecture variants exist — DDD Tactical, Hexagonal (Cockburn),
   Onion, and Pattern Pretre (a NestJS-specific adaptation of Clean Architecture).

Additional context: the Tukio booking domain is complex (6-state saga, multiple external integrations),
making a framework-free domain layer essential for unit testing without infrastructure setup.

## Decision

All 10 NestJS microservices adopt **Pattern Pretre Clean Architecture** (reference: the Pretre
`clean-architecture-nestjs` repo) with this mandatory folder structure under `apps/<svc>/src/`:

```
<service>/src/
├─ domain/                    # ZERO external dependencies (no NestJS, TypeORM, axios, etc.)
│  ├─ model/                  # Aggregates + Value Objects
│  ├─ ports/                  # Interfaces: IRepository, IEventPublisher, IExternalService
│  ├─ service/                # Stateless domain services (pure functions over aggregates)
│  └─ exception/              # Domain exceptions (extend DomainException from @tukio/contracts)
├─ usecases/                  # One class per use case; single public method execute()
│  └─ <verb>-<noun>.usecase.ts
└─ infrastructure/            # Concrete implementations of domain ports
   ├─ persistence/typeorm/
   │  ├─ entities/            # TypeORM entity classes
   │  ├─ repositories/        # IRepository implementations
   │  ├─ mappers/             # Entity ↔ Aggregate conversions
   │  └─ migrations/          # TypeORM migration files
   ├─ messaging/nats/         # IEventPublisher via @tukio/messaging OutboxPublisher
   ├─ external/<provider>/    # Third-party adapters (Stripe, Keycloak, Meilisearch…)
   ├─ http/                   # NestJS controllers, DTOs, guards, interceptors, filters
   │  ├─ controllers/
   │  ├─ dtos/
   │  ├─ guards/
   │  ├─ interceptors/
   │  └─ filters/
   └─ usecases-proxy/
      └─ usecases-proxy.module.ts   # Central DI wiring: port symbols → implementations
```

**Non-negotiable rules**:

- `domain/` contains no import of any I/O library (enforced by `eslint-plugin-boundaries` and
  `FORBIDDEN_IN_DOMAIN` list in `eslint.config.mjs`).
- All interfaces live in `domain/ports/`; all implementations live in `infrastructure/`.
- Use cases depend on ports exclusively, injected via NestJS DI Symbol tokens.
- Port → implementation binding happens only in `usecases-proxy.module.ts`.
- Each use case is a single class with a single `execute()` method — no service-level God objects.

## Consequences

### Positive

- **Trivial unit tests on the domain layer**: no testcontainers, no NestJS setup, no mocks for
  infrastructure. Pure TypeScript with `Date.now()` as the only seam.
- **Painless provider swap**: replacing TypeORM with Prisma means rewriting one repository class —
  the domain and use cases are untouched.
- **Cross-service consistency**: 10 services, same structure → any developer can navigate any service
  without context-switching. Onboarding time drops from days to hours.
- **Lint-enforced from day one**: PRs violating `domain/` import rules fail CI before review.
- **Replication script**: `infra/scripts/replicate-pretre-structure.sh --target=<svc>` scaffolds the
  9 remaining services from the `identity-svc` canonical template (Story 0.6).
- **Coverage thresholds per layer** (NFR71): `domain/` ≥ 80 %, `usecases/` ≥ 70 %,
  `infrastructure/` ≥ 50 % — enforced in CI per workspace.

### Negative / Trade-offs

- **+20-30 % scaffolding overhead** on the first service vs a flat Express/NestJS structure.
- **Verbosity**: repository pattern + UseCaseProxy + DTO + mapper = significant boilerplate per
  aggregate. Acceptable given the 5-year time horizon.
- **Learning curve**: Pattern Pretre is less familiar than MVC. New developers need an onboarding
  session (mitigated by the detailed `identity-svc` template and this ADR).
- **Indirect instantiation**: Use cases are wired via `UseCasesProxyModule` — tracing
  a call path requires understanding the DI token chain, which IDE tooling handles well.

### Neutral

- Custom `eslint-plugin-boundaries` lint adds friction for reviewers, but this is intentional — the
  constraint is the point.
- `UseCaseProxy<T>` is the only place where domain depends on infrastructure (via factory) — a
  deliberate, bounded coupling.

## Alternatives Considered

### DDD Tactical without Clean Architecture separation

Aggregate Root + Value Objects + Domain Events, but without the strict `domain/`/`infrastructure/`
boundary. **Rejected**: couples the domain to TypeORM decorators and NestJS modules, making pure
domain tests require a running database. Observed in the tukio prototype — reverted after week 2.

### Hexagonal Architecture (Cockburn ports & adapters)

Conceptually equivalent to Pattern Pretre. **Considered equivalent** — the Pretre repo provides a
concrete NestJS template with the exact naming and DI conventions we need. Chose Pretre because the
reference implementation is battle-tested on a similar stack and team documentation is available.

### Layered / NestJS default structure (Module + Service + Controller)

No strict layer boundaries. **Rejected**: every service evolves its own conventions → cross-service
code sharing becomes impossible, and domain logic leaks into controllers. Tukio's 5-year horizon
makes this unacceptable.

### CQRS with separate read models

Explicit command/query segregation with separate read models (e.g., Prisma for reads, TypeORM for
writes). **Deferred to V1+**: adds significant complexity. For MVP with < 10k daily users, a raw SQL
read path in the same service (ADR-0010) covers the performance need without CQRS overhead.

## References

- [External: https://github.com/jonathanPretre/clean-architecture-nestjs — canonical reference]
- [Source: Architecture §Cross-Cutting Concern #1 Clean Architecture — lines 168-232]
- [Source: Architecture §Backend service structure Pattern Pretre — lines 1161-1208]
- [Source: Story 0.6 — Pattern Pretre scaffolding of identity-svc + replication script]
- [Source: PRD §12.8 — locked stack]

## Implementation Notes

- **Lint enforcement**: `eslint-plugin-boundaries` with `FORBIDDEN_IN_DOMAIN` array in
  `eslint.config.mjs`. Any import of `typeorm`, `@nestjs/*`, `axios`, `pg`, etc. from `domain/`
  blocks CI.
- **Coverage**: Jest coverage thresholds set per workspace in `jest.config.ts` with
  `collectCoverageFrom` scoped to layer directories.
- **DI token convention**: `Symbol('<UseCase>UseCaseProxy')` defined in
  `usecases-proxy.module.ts` and injected via `@Inject(TOKEN)` in controllers.
- **Replication**: `infra/scripts/replicate-pretre-structure.sh --target=<svc>` copies
  the `identity-svc` skeleton and rewrites names. Run this before scaffolding Epic 1+ services.
- **identity-svc** is the canonical reference — any pattern clarification resolves to how
  `identity-svc` implements it (Story 0.6).
