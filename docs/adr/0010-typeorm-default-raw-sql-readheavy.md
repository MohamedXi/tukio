# ADR-0010: TypeORM by default, raw SQL for read-heavy paths

- **Status**: ✅ Accepted
- **Date**: 2026-05-09
- **Deciders**: Ismael (founder), tech lead
- **Tags**: `architecture`, `data`, `backend`

## Context

With 10 NestJS microservices on Postgres 16, each service needs a database access strategy. The
choices range from pure ORM to pure raw SQL, with hybrid approaches in between.

Forces in tension:

- **Developer productivity**: writing boilerplate SQL for every CRUD operation slows development.
  TypeORM's `@Entity` decorators + `Repository` pattern generate simple queries automatically.
- **Query performance on read-heavy paths**: ORM-generated queries for list endpoints (marketplace
  search results, booking history, analytics) are often suboptimal — N+1 queries, missing indexes,
  unnecessary column fetching.
- **Type safety**: raw SQL strings lose TypeScript type checking at the query level. TypeORM query
  builder provides some type safety; `DataSource.query()` with typed result is a middle ground.
- **Migration portability**: TypeORM's `migration:generate` compares entity decorators to the DB
  schema and generates SQL migrations — a significant productivity boost.
- **Domain purity** (ADR-0001): TypeORM decorators (`@Entity`, `@Column`) must not bleed into the
  `domain/` layer. Entities live in `infrastructure/persistence/typeorm/entities/`.

## Decision

Use **TypeORM as the default** for write operations and simple reads (CRUD on aggregates). Use
**raw SQL** via `DataSource.query<RowType>()` for read-heavy paths where query shape, performance,
or complexity exceeds what the TypeORM query builder handles cleanly.

Guidelines:

- **Write path** (create, update, soft-delete): `TypeORM Repository.save()` / `manager.save()` —
  within the transactional outbox transaction.
- **Simple aggregate reads** (findById, findByKeycloakUserId): `Repository.findOne()` — acceptable
  for single-row lookups.
- **List / pagination / analytics / dashboard queries**: raw SQL in `*.query.ts` files in
  `infrastructure/persistence/typeorm/queries/`. Result typed via a dedicated `Row` interface.
- **Migrations**: generated with TypeORM CLI (`migration:generate` compares entity metadata to
  current schema, producing a SQL diff). Never hand-edit a generated migration's `up()` body —
  only edit the `down()` to ensure correct rollback.

Raw SQL query files follow the naming convention `list-<entity>-by-<criteria>.query.ts` and export
a single function: `listListingsByCategory(ds: DataSource, params: Params): Promise<Row[]>`.

## Consequences

### Positive

- **Fast development**: CRUD operations on aggregates are zero-boilerplate with TypeORM decorators.
- **Type-safe complex reads**: raw SQL with a typed `Row` interface provides TypeScript coverage on
  the result shape without ORM query builder limitations.
- **Optimal query performance on read-heavy paths**: no N+1, no unnecessary `SELECT *`, indexes
  explicitly chosen in the SQL.
- **Migration automation**: `pnpm --filter=<svc> migration:generate` produces accurate SQL diffs.
  No manual schema tracking.
- **Clean domain layer**: `@Entity` / `@Column` decorators live only in `infrastructure/` — `domain/`
  remains framework-free (ADR-0001).

### Negative / Trade-offs

- **Dual mental model**: developers must know when to use the ORM and when to drop to raw SQL.
  Documented by this ADR + the `FORBIDDEN_IN_DOMAIN` lint rule that prevents ORM imports in `domain/`.
- **Raw SQL is string-based**: typos in column names or table names are only caught at runtime
  (no compile-time SQL verification). Mitigated by TypeScript typing of the result and
  `testcontainers`-based integration tests that run actual queries.
- **Prisma's type-safe query builder** would have been cleaner for raw SQL — deferred to V1+
  if the hybrid approach shows friction in practice.

### Neutral

- `DataSource.query<RowType>(sql, params)` uses Postgres parameterized queries (`$1`, `$2`, …) —
  SQL injection-safe by construction.

## Alternatives Considered

### Prisma

Excellent developer experience with a type-safe query builder that bridges ORM and raw SQL.
**Rejected for MVP** because:
- Migration workflow is different from TypeORM (`prisma migrate dev` vs TypeORM `migration:generate`).
- Switching from TypeORM (already scaffolded in identity-svc Story 0.6) mid-sprint would require
  rewriting the migration + entity layer.
- Can be adopted as a V1+ migration for specific services if the TypeORM hybrid shows friction.

### Pure raw SQL (no ORM)

Write all SQL by hand. **Rejected**: 10 services × dozens of tables = thousands of handwritten SQL
queries. No automated migration generation — each schema change requires manual SQL diffs. Acceptable
for a data team; too slow for a product MVP.

### Drizzle ORM

Type-safe SQL ORM, modern API. **Considered** but not chosen: Drizzle is newer (less community
examples), and switching from the TypeORM entity model already used in Story 0.6 would require a
full rewrite of entity + migration tooling. Revisit in V1+.

## References

- [Source: Architecture §Data access — line 603]
- [Source: Story 0.6 — TypeORM entity + repository pattern established in identity-svc]
- [Source: Story 3.7 — raw SQL read path for catalog listing queries]
- [ADR-0001 — domain layer must not import TypeORM]
- [ADR-0003 — one TypeORM DataSource per service database]

## Implementation Notes

- Raw SQL query files live in `apps/<svc>/src/infrastructure/persistence/typeorm/queries/`.
  Each file exports one function and one `Row` interface.
- TypeORM `DataSource` is configured in `apps/<svc>/src/infrastructure/data-source.ts` (used by
  both the NestJS module and the TypeORM CLI).
- `migration:generate` command: `pnpm --filter=<svc> migration:generate -- --name=<Description>`.
  Review the generated SQL before committing — TypeORM occasionally generates suboptimal `DROP`/`ADD`
  instead of `ALTER COLUMN`.
- Never use `synchronize: true` in any environment — always use migrations.
