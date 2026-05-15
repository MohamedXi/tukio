# Architecture Decision Records (ADR)

This directory contains all architecture decisions made for the tukio.one platform.

## Format

Each ADR follows the [MADR / Nygard standard](https://adr.github.io/) with these fixed sections:

```
# ADR-NNNN: <Title>

- Status: ✅ Accepted | Proposed | Deprecated | Superseded by ADR-XXXX
- Date: YYYY-MM-DD (immutable once Accepted)
- Deciders: <names>
- Tags: `architecture`, `<category>`

## Context
## Decision
## Consequences (Positive / Negative / Neutral)
## Alternatives Considered
## References
## Implementation Notes (optional)
```

## Numbering

ADRs are numbered sequentially: `0001`, `0002`, …, `9999`.  
Never reuse a number. Never edit an Accepted ADR — create a new one with
`Status: Superseded by ADR-XXXX` on the old one.

## How to propose a new ADR

1. Duplicate `template.md` → `NNNN-short-title.md`
2. Fill in all sections (Context is mandatory — explain the *why*)
3. Open a PR targeting `develop`, assign the tech lead as reviewer
4. Once merged with `Status: Accepted`, the ADR is immutable

## Index of accepted ADRs

| # | Title | Tags | Date |
|---|-------|------|------|
| [0001](0001-pretre-clean-architecture.md) | Pattern Pretre Clean Architecture | `architecture`, `backend` | 2026-05-09 |
| [0002](0002-nats-jetstream.md) | NATS JetStream as message broker | `architecture`, `backend` | 2026-05-09 |
| [0003](0003-database-per-service.md) | Database per service (Postgres) | `architecture`, `data` | 2026-05-09 |
| [0004](0004-booking-order-split.md) | booking-svc ≠ order-svc split | `architecture`, `backend` | 2026-05-09 |
| [0005](0005-meilisearch-mvp.md) | Meilisearch for full-text search MVP | `architecture`, `data` | 2026-05-09 |
| [0006](0006-saga-choreographed.md) | Choreographed saga over orchestrator | `architecture`, `backend` | 2026-05-09 |
| [0007](0007-outbox-pattern.md) | Transactional outbox + PG LISTEN/NOTIFY | `architecture`, `backend` | 2026-05-09 |
| [0008](0008-gateway-api-public-only.md) | gateway-api as sole public entry point | `architecture`, `security` | 2026-05-09 |
| [0009](0009-keycloak-identity-svc-split.md) | Keycloak + identity-svc dual layer | `architecture`, `security` | 2026-05-09 |
| [0010](0010-typeorm-default-raw-sql-readheavy.md) | TypeORM default + raw SQL for read-heavy | `architecture`, `data` | 2026-05-09 |
| [0011](0011-tukio-contracts-package.md) | @tukio/contracts shared package | `architecture`, `backend`, `frontend` | 2026-05-09 |
| [0012](0012-i18n-fr-en-sprint-zero.md) | i18n FR+EN from Sprint 0 | `architecture`, `frontend` | 2026-05-09 |
| [0013](0013-frontend-multi-zones-feature-based.md) | 4 Next.js apps multi-zones — **superseded by 0016** | `architecture`, `frontend` | 2026-05-09 |
| [0014](0014-api-response-envelope.md) | Canonical REST response envelope | `architecture`, `backend` | 2026-05-09 |
| [0015](0015-mvp-infra-pivot-do-droplets.md) | MVP infra pivot: DO Droplets + docker-compose | `architecture`, `ops` | 2026-05-14 |
| [0016](0016-frontend-topology-pivot-apex-unified.md) | Frontend topology pivot — apex `tukio.one` unified B2C tunnel (supersedes 0013) | `architecture`, `frontend`, `ops` | 2026-05-15 |
