# Architecture

Monorepo of **14 codebases** (4 frontends + 10 microservices) + **8 shared
packages**, orchestrated by Turborepo + pnpm. Backend services follow
**Pattern Pretre** (Clean Architecture); frontends follow **atomic design**
on top of `@tukio/ui`.

The complete architecture spec lives in
`_bmad-output/planning-artifacts/architecture.md` (14 ADRs as of
2026-05-08). Cross-cutting deepdives in `docs/tukio_*_deepdive.md`
(booking, catalog, paiements). This file is the agent-facing summary.

## Top-level layout

```
tukio_projects/
├── apps/         # 4 Next.js apps + 10 NestJS services (one folder each)
├── packages/     # 8 @tukio/* shared workspaces
├── infra/        # docker-compose dev stack + bootstrap scripts (Story 0.10)
├── tools/        # Custom ESLint plugin (eslint-plugin-tukio)
├── docs/         # Architecture + UX + business deepdives
├── _bmad/        # BMad framework (DO NOT EDIT — upstream)
├── _bmad-output/ # Planning + implementation artifacts (story files, sprint state)
└── .agents/      # ACS — what you're reading now
```

See `.agents/context/directory-layout.md` for the full tree.

## Frontend apps (Next.js 16)

| App      | Port | Hostname           | Audience                                                         | Auth                                                    |
| -------- | ---- | ------------------ | ---------------------------------------------------------------- | ------------------------------------------------------- |
| `public` | 3000 | `tukio.one` (apex) | Visitors + authenticated B2C customers (unified tunnel, ADR-016) | `(authenticated)/*` gated via Keycloak `tukio-web` PKCE |
| `seller` | 3002 | `seller.tukio.one` | Pro dashboard (KYC, listings, bookings)                          | Keycloak `tukio-web` PKCE + role                        |
| `admin`  | 3003 | `admin.tukio.one`  | Moderation console                                               | Keycloak `tukio-admin` + MFA TOTP                       |

All three use `next-intl` for FR/EN routing (`/{locale}/...`), import the
design system from `@tukio/ui`, and talk to the backend through
`gateway-api` (port 4000) via `@tukio/api-client`. Story 0.14 (ADR-016)
merged the previous `apps/customer` (subdomain `customer.tukio.one`) into
`apps/public` — auth-gated routes live under the `(authenticated)` route
group and are protected by the Next.js middleware in
`apps/public/src/middleware.ts`.

## Backend services (NestJS 11)

| Service            | Port | Role                                                                         | DB                   |
| ------------------ | ---- | ---------------------------------------------------------------------------- | -------------------- |
| `gateway-api`      | 4000 | Public REST gateway, validates Keycloak JWT, fans out via NATS request/reply | _none_               |
| `identity-svc`     | 4001 | Users, profiles, OIDC mirror — **canonical Pretre reference**                | `tukio_identity`     |
| `catalog-svc`      | 4002 | Listings, categories, sub-categories, Meilisearch sync                       | `tukio_catalog`      |
| `booking-svc`      | 4003 | Booking saga state machine (Story 4.1)                                       | `tukio_booking`      |
| `order-svc`        | 4004 | Orders, saga consumer                                                        | `tukio_order`        |
| `payment-svc`      | 4005 | Stripe Connect, webhooks, payouts                                            | `tukio_payment`      |
| `messaging-svc`    | 4006 | Customer ↔ pro messaging, rate-limited                                       | `tukio_messaging`    |
| `review-svc`       | 4007 | Reviews, ratings, recency-weighted aggregate                                 | `tukio_review`       |
| `notification-svc` | 4008 | Resend emails (FR/EN templates), in-app feed                                 | `tukio_notification` |
| `media-svc`        | 4009 | Cloudflare Images signed upload URLs                                         | `tukio_media`        |

Each service follows Pattern Pretre. See
`.agents/context/pretre-pattern.md`.

`gateway-api` has no DB — it's a stateless BFF that wraps responses in the
canonical envelope. See `.agents/context/rest-envelope.md`.

## Shared packages (`@tukio/*`)

| Package              | Purpose                                                            |
| -------------------- | ------------------------------------------------------------------ |
| `@tukio/contracts`   | DTOs (Zod), NATS event schemas (versioned), REST envelope types    |
| `@tukio/ui`          | Design system: tokens + components (atoms) + patterns (composites) |
| `@tukio/auth`        | KeycloakJwtGuard, RolesGuard, JWKS cache (backend-side)            |
| `@tukio/auth-client` | next-intl + Keycloak PKCE wiring (frontend-side)                   |
| `@tukio/messaging`   | OutboxRelayService, NatsJetStreamModule, Inbox dedup               |
| `@tukio/api-client`  | Typed REST client targeting `gateway-api` (used by frontends)      |
| `@tukio/i18n-client` | next-intl helpers, locale dispatch                                 |
| `@tukio/testing`     | testcontainers helpers (PG/NATS/Keycloak/Meili/Redis) for CI       |

All shared packages export via **subpaths** in `package.json#exports`. Barrel
imports of named values are forbidden by `tukio/no-barrel-import-contracts`
and `tukio/no-barrel-import-ui` (warn at MVP, error at Story 0.11 CI).

## Cross-service communication

- **NATS JetStream events** for fire-and-forget integration. Producers use
  `OutboxPublisher` (transactional outbox in PG, relayed by
  `OutboxRelayService` listening on PG LISTEN/NOTIFY). Consumers use
  `Inbox` for dedup. Stream naming: one stream per service
  (`TUKIO_IDENTITY`, `TUKIO_CATALOG`, …). See
  `.agents/context/messaging.md`.
- **NATS request/reply** for synchronous BFF calls (gateway-api → svc).
- **No direct service-to-service HTTP** in the hot path. Intra-cluster
  HTTP is reserved for health probes and admin operations.

## Database strategy

- **One logical DB per service** (`tukio_<svc>`) on a shared Postgres 16
  instance at MVP. V1+ may split to dedicated instances.
- **TypeORM** is the default ORM, with **raw SQL `*.query.ts`** files for
  read-heavy paths (search facets, aggregates).
- **Migrations** live in `apps/<svc>/src/infrastructure/persistence/typeorm/migrations/`.
  Run via `pnpm --filter=<svc> migration:run`. Migration order is
  critical — `bootstrap-databases.sh` runs them in service order.
- **Outbox/inbox tables** are created by Story 0.7's
  `1715210000000-AddOutboxInboxTables.ts` migration in every service that
  emits or consumes events.

## Auth

- **Keycloak 25** is the IdP. In dev: docker-compose `tukio_keycloak` on
  port 8080. In prod: **Phasetwo managed**.
- **Realm `tukio`** with 5 realm roles (`client`, `pro`, `admin-support`,
  `admin-modo`, `admin-super`) and 4 OIDC clients (`tukio-web`,
  `tukio-admin`, `tukio-api`, `tukio-mobile`).
- **PKCE S256** mandatory on public clients. `tukio-api` is confidential
  (M2M, service accounts).
- **MFA TOTP** required for admins (FR9 + NFR12). Wired partial in Story
  0.10 (Conditional OTP elevated realm-wide); per-client scoping +
  required-action seeding land in **Story 1.7**.
- **JWT validation** in `gateway-api` and per-service via
  `@tukio/auth/guards/keycloak-jwt.guard.ts`. JWKS cached.
- **Frontend OIDC dance** via `@tukio/auth-client` (PKCE).

## Existing ADRs

The 14 ADRs live in `_bmad-output/planning-artifacts/architecture.md`.
Highlights:

- ADR-001 — Monorepo Turborepo + pnpm
- ADR-002 — NestJS Fastify (not Express)
- ADR-003 — Pattern Pretre (Clean Architecture) per service
- ADR-004 — Database-per-service (logical DBs at MVP, instances V1+)
- ADR-005 — TypeORM + raw SQL for read paths
- ADR-006 — NATS JetStream + transactional outbox + inbox dedup
- ADR-007 — Keycloak (Phasetwo managed prod)
- ADR-008 — Stripe Connect Express + Billing
- ADR-009 — Cloudflare R2 + Images
- ADR-010 — Resend (transactional) + Brevo (marketing V1+)
- ADR-011 — Upstash Redis (locks + sessions)
- ADR-012 — Vercel (frontend) + Kubernetes (backend)
- ADR-013 — `next-intl` for i18n FR/EN
- ADR-014 — REST envelope canonical shape

When proposing a deviation from any ADR, **add a new ADR** rather than
quietly diverging.

## Where to look before writing code

- **PRD** → `_bmad-output/planning-artifacts/prd.md` (130 FRs + 84 NFRs)
- **Architecture** → `_bmad-output/planning-artifacts/architecture.md`
- **UX spec** → `_bmad-output/planning-artifacts/ux-spec.md`
- **Epics & Stories** → `_bmad-output/planning-artifacts/epics.md`
- **Active story spec** → `_bmad-output/implementation-artifacts/<X-Y>-<slug>.md`
- **Sprint state ledger** → `_bmad-output/implementation-artifacts/sprint-status.yaml`
- **Pretre canonical reference** → `apps/identity-svc/src/`
- **Atomic design canonical reference** → `packages/ui/src/components/Button/`
- **REST envelope** → `packages/contracts/src/envelope/`
- **Custom ESLint rules** → `tools/eslint-plugin-tukio/src/`
