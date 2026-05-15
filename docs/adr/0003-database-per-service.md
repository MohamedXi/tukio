# ADR-0003: Database per service (Postgres 16, shared instance)

- **Status**: ✅ Accepted
- **Date**: 2026-05-09
- **Deciders**: Ismael (founder), tech lead
- **Tags**: `architecture`, `data`, `backend`

## Context

With 10 microservices and a monorepo, two extremes exist:

1. **Shared schema** (one Postgres DB, all services access any table) — simplest to start, but
   creates hidden coupling: a schema change in `booking-svc` can break `identity-svc` queries.
2. **Strict DB-per-service** (separate Postgres *instances*) — maximum isolation, but €10+/month per
   managed Postgres instance × 10 = prohibitive for MVP.

Forces:

- **Loose coupling**: services must be deployable and testable independently without DB coordination.
- **Budget**: MVP hard cap of €35/month (ADR-0015). Separate managed DB instances are out.
- **Data consistency**: cross-service business operations (booking + payment saga) cannot use
  distributed transactions — they must use eventual consistency via events (ADR-0006, ADR-0007).
- **SQL joins across services**: a common temptation with a shared instance that must be prevented by
  convention + tooling, not just by physical separation.

## Decision

Each of the 10 microservices owns exactly **one logical Postgres database** on the shared Postgres 16
instance (running on the `tukio-data` droplet — ADR-0015):

| Service | Database |
|---------|----------|
| identity-svc | `tukio_identity` |
| catalog-svc | `tukio_catalog` |
| booking-svc | `tukio_booking` |
| order-svc | `tukio_order` |
| payment-svc | `tukio_payment` |
| messaging-svc | `tukio_messaging` |
| review-svc | `tukio_review` |
| notification-svc | `tukio_notification` |
| media-svc | `tukio_media` |
| keycloak | `keycloak` |

**Rules enforced by convention + lint**:

- A service's TypeORM DataSource is configured with `database: process.env.DB_NAME` — only its own DB.
- Cross-service data fetching uses **HTTP** (via gateway-api) or **NATS events** — never direct SQL
  joins across database boundaries.
- Migrations are per-service: `pnpm --filter=<svc> migration:run`. No shared migration runner.
- The `init-databases.sh` script creates all 10 DBs at container startup — only at initialization.

**gateway-api exception**: `gateway-api` uses `tukio_identity` as its DB for auth-related checks
(JWT validation metadata). This is a pragmatic MVP decision — gateway-api is the auth proxy for
identity-svc and reading from its DB avoids a synchronous HTTP call on every request. Documented as
a known coupling to revisit in V1+ if identity-svc scales independently.

## Consequences

### Positive

- **Service independence**: identity-svc schema changes do not require coordination with other services.
- **Isolation in tests**: `@tukio/testing` provides a `startPostgresContainer()` helper that boots an
  isolated Postgres with only the target service's migrations — no cross-service schema pollution.
- **Clear ownership**: each service owns its migrations, its entities, its data retention rules.
- **Budget-compatible**: one shared Postgres instance on the `tukio-data` droplet covers all 10 DBs
  for €0 additional cost (already budgeted in the €22/month droplet pair).

### Negative / Trade-offs

- **No cross-service SQL joins**: analytics or reporting that spans services must use application-level
  joins or a dedicated analytics DB (e.g., BigQuery, PostHog) — deferred to V1+.
- **Eventual consistency**: operations spanning services (e.g., booking + payment) require saga
  choreography (ADR-0006) with compensating transactions — more complex than a 2-phase commit on a
  shared schema.
- **gateway-api/identity-svc DB coupling**: the shared `tukio_identity` DB for gateway-api is a known
  pragmatic exception. Must be documented and tracked.
- **One physical instance = shared resource**: heavy queries in one service can cause I/O contention
  for others on the same Postgres instance. Mitigated by connection pooling per service and index
  hygiene. If contention becomes measurable, isolate high-volume services (booking, catalog) onto a
  separate instance (V1+ option).

### Neutral

- Logical separation (separate DBs on one instance) provides most of the isolation benefits of full
  separation at zero extra cost for MVP traffic levels.

## Alternatives Considered

### Monolithic shared schema

All services read/write to one `tukio` database. **Rejected**: immediate tight coupling — adding a
column to `user_profiles` requires coordination with all consumers. Schema migrations become
cross-team events. Made refactoring to microservices impossible without DB downtime.

### Schema-per-service, same database

All services share one database but use separate Postgres schemas (`identity.user_profiles`,
`booking.bookings`). **Considered**: provides some isolation but Postgres schemas are not enforced
access boundaries — a developer can still write `SELECT * FROM booking.bookings` in `identity-svc`.
Rejected in favor of separate logical databases which make cross-service queries an explicit connection
configuration step, not just a schema prefix.

### Managed Postgres instance per service (Neon, Supabase)

Maximum isolation. **Rejected**: €5-25/month per instance × 10 = €50-250/month — exceeds the MVP
budget hard cap (ADR-0015). Revisit when a specific service needs independent scaling (V1+).

## References

- [Source: Architecture §Data layer — lines 600-606]
- [Source: Story 0.6 — identity-svc baseline migration creating `tukio_identity`]
- [Source: Story 0.10 — `init-databases.sh` creating all 10 logical DBs at container start]
- [Source: Story 0.12 / ADR-0015 — shared Postgres on `tukio-data` droplet]
- [ADR-0006 — Choreographed saga handles cross-service consistency without distributed transactions]
- [ADR-0007 — Outbox pattern ensures event delivery without 2-phase commit]

## Implementation Notes

- Each service's `data-source.ts` reads `DB_NAME` from env — only its own database name.
- TypeORM CLI commands are scoped per workspace: `pnpm --filter=identity-svc migration:generate`.
- Connection pool: `max: 10` per service (configurable via `DB_POOL_SIZE` env). Total connections
  on MVP = 10 services × 10 = 100 max — within Postgres 16 default of 100 concurrent connections.
  Adjust `max_connections` in Postgres config if needed when Epic 1+ services connect simultaneously.
