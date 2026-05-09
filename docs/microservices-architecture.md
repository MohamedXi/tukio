# Tukio.one — NestJS Microservices Architecture Proposal

> Production-ready architecture for the Tukio event-services marketplace API. Targets NestJS 11, PostgreSQL 16, NATS JetStream 2.10+, Keycloak 25+, Stripe Connect, Cloudflare R2, Resend, Upstash Redis. Optimised for a small team that wants to ship fast without painting itself into a corner.

---

## 1. Guiding Principles

1. **One microservice per bounded context, from day 1.** Each service owns its database schema (database-per-service), its domain model, and its deployment lifecycle. No shared tables, no cross-service joins.
2. **Hexagonal layering inside every service** (Pretre's `domain` / `usecases` / `infrastructure` triad), wired with the **`UseCaseProxy`** factory pattern so the domain stays free of NestJS / TypeORM / NATS imports.
3. **Two communication channels, not three.**
   - Synchronous: HTTP/REST through a thin **API Gateway / BFF** (the only public surface).
   - Asynchronous: **NATS JetStream** for domain events, sagas, and side-effects between services. No internal HTTP-to-HTTP service-to-service calls except the gateway → service hop.
4. **"Clean enough to scale, simple enough to ship."** No CQRS, no event sourcing, no DDD aggregates with factories of factories. Use cases are plain TypeScript classes with one public `execute()` method. Add complexity only when a real pain shows up.
5. **English everywhere in code and ADRs.** French is allowed in product specs and end-user copy only.

---

## 2. Macro Architecture — Bounded Contexts

### 2.1 Service Map

| Service | Responsibility | Datastore | Owns events |
|---|---|---|---|
| **gateway-api** | Public REST entry point. JWT validation (Keycloak JWKS), rate-limiting (Redis), request fan-out / aggregation. Acts as a BFF for the `web` and `mobile` clients. | None (stateless) | None — read-only relayer. |
| **identity-svc** | Mirrors Keycloak users into a domain `Profile` (display name, locale, KYC state). Handles user-side preferences not stored in Keycloak. Webhook target for Keycloak events. | `tukio_identity` (PG) | `identity.user.registered`, `identity.profile.updated`, `identity.kyc.verified` |
| **catalog-svc** *(detailed below)* | Service listings (a "service" = a thing a provider sells: DJ, traiteur, photographe, lieu…), categories, availability calendars, pricing rules, geo-search index. | `tukio_catalog` (PG) + Meilisearch | `catalog.listing.published`, `catalog.listing.updated`, `catalog.listing.unpublished`, `catalog.availability.changed` |
| **booking-svc** | Reservation lifecycle: `requested → quoted → accepted → confirmed → completed / cancelled`. Holds availability slots optimistically. Implements the booking saga (see §3). | `tukio_booking` (PG) | `booking.requested`, `booking.quoted`, `booking.accepted`, `booking.confirmed`, `booking.cancelled`, `booking.completed` |
| **order-svc** | Cart, checkout, order header, line items, fees, taxes (TVA FR). Translates a confirmed booking into a payable order. | `tukio_order` (PG) | `order.created`, `order.paid`, `order.refunded`, `order.cancelled` |
| **payment-svc** | Stripe Connect integration: connected accounts (providers), PaymentIntents, escrow, payouts, dispute handling. Owns the Stripe webhook endpoint. | `tukio_payment` (PG) | `payment.intent.created`, `payment.captured`, `payment.failed`, `payment.refunded`, `payment.payout.scheduled` |
| **messaging-svc** | In-app chat between buyer and provider, scoped to a booking thread. WebSocket fan-out via Redis pub/sub. | `tukio_messaging` (PG) + Redis | `messaging.message.sent` |
| **review-svc** | Ratings & reviews after a completed booking. Moderation hooks. | `tukio_review` (PG) | `review.published`, `review.flagged` |
| **notification-svc** | Consumes events from every other service and turns them into emails (Resend), push, or SMS. Owns templates and delivery state. | `tukio_notification` (PG) | `notification.delivered`, `notification.failed` |
| **media-svc** | Issues R2 presigned uploads, virus-scans (async), generates derivatives (image variants), exposes public CDN URLs. | `tukio_media` (PG) + R2 | `media.uploaded`, `media.processed`, `media.rejected` |

This is **10 services** including the gateway. That's the maximum we'd recommend for a starting team. If headcount is < 4 engineers, fold `review-svc` into `booking-svc` and `media-svc` into `catalog-svc`, but keep the rest separate — they have genuinely different scaling profiles and failure modes.

### 2.2 High-level diagram

```
                           ┌────────────────────────┐
   web / mobile  ───TLS──▶ │      gateway-api       │ ◀── Keycloak JWKS (cached)
                           │  (Nest 11 + Fastify)   │
                           └─────────┬──────────────┘
                                     │ HTTP (mTLS in prod, internal DNS)
        ┌────────────┬───────────────┼───────────────┬────────────┐
        ▼            ▼               ▼               ▼            ▼
   catalog-svc  booking-svc     order-svc      payment-svc   identity-svc
     │  ▲         │   ▲            │  ▲            │  ▲          │  ▲
     │  │         │   │            │  │            │  │          │  │
     ▼  │         ▼   │            ▼  │            ▼  │          ▼  │
   Postgres    Postgres         Postgres        Postgres      Postgres
        \           |              |               /             /
         \          |              |              /             /
          \         ▼              ▼             /             /
           ─────────▶  NATS JetStream cluster  ◀───────────────
                        (events + sagas + DLQ)
                              ▲       ▲
                              │       │
                       notification-svc, media-svc, review-svc, messaging-svc
```

Synchronous calls flow **only** gateway → service. Service-to-service is **always** async via NATS, with the rare exception of the saga reply channels (see §3.3).

---

## 3. Communication Patterns

### 3.1 Sync (HTTP/REST through the gateway)

- **Transport:** HTTP/1.1 + JSON, Fastify adapter (faster than Express, native Pino logging, schema validation friendly).
- **Auth:** Keycloak issues RS256 JWTs. The gateway verifies signatures via JWKS (cached 10 min via `jwks-rsa`), then **forwards the raw token plus a signed internal header** (`x-tukio-actor`) to downstream services. Downstream services trust `x-tukio-actor` because it is signed with an internal HMAC and the gateway is the only ingress.
- **Schema:** OpenAPI 3.1 generated from NestJS decorators; published to `/docs` (Swagger UI) per service in dev, only on the gateway in prod.
- **Versioning:** URL-based `/v1/...`. Breaking changes ship under `/v2`.
- **Resilience:** the gateway uses `@nestjs/axios` with **circuit-breaker** (`opossum`) and a **per-route timeout** of 3 s. Anything slower must be async.

### 3.2 Async (NATS JetStream)

- **Why NATS over Kafka or RabbitMQ.**
  - Kafka is excellent but operationally heavy: ZooKeeper/KRaft, schema registry, partition planning, consumer-group lag dashboards. Overkill for a marketplace at < 10 k events/sec.
  - RabbitMQ has great routing primitives but no built-in replay/replication story without plugins, and queue-per-consumer becomes painful at 10+ services.
  - NATS JetStream gives you persistence, replay, at-least-once delivery, replication (R3), DLQ, KV store and Object store from a single 25 MB binary. Works fine in a 3-node cluster for years before you'd need to look elsewhere. This middle-ground positioning is exactly the "Redis isn't enough but Kafka is overkill" sweet spot, which is where a French B2B2C marketplace lives.
  - It also keeps the operational burden low for a small team — no ZooKeeper, no Erlang VM tuning.
- **Library choice in NestJS.** The built-in `Transport.NATS` of `@nestjs/microservices` does **not** speak JetStream — it loses messages on pod restart. Two viable options:
  1. **`@horizon-republic/nestjs-jetstream`** — keeps the familiar `@EventPattern` / `@MessagePattern` ergonomics, adds durable consumers, retries with exponential backoff, DLQ, broadcast, ordered delivery, and tracing hooks. Recommended.
  2. Hand-roll a thin wrapper around the official `nats.js` SDK. More code but zero dependency risk.

  We recommend option 1 for day-to-day work, and isolating the import behind an internal `@tukio/messaging` library so swapping later is mechanical.

- **JetStream topology.**
  - One **stream per service** that emits events: `CATALOG`, `BOOKING`, `ORDER`, `PAYMENT`, `IDENTITY`, etc. Each stream binds to its service's subject prefix (e.g. `BOOKING` ← `booking.>`).
  - Storage: `file`, retention `limits` (`max_age: 14d`, `max_bytes: 5GB`), replicas `3` in prod, `1` in dev.
  - **Consumers are durable** and named after `<service>-<purpose>`, e.g. `notification-booking-confirmed`. One consumer per logical concern — never share consumers across handlers.
  - **DLQ:** `MaxDeliver: 5`, after which the message is `term`-ed and republished onto a `dlq.<service>` subject persisted in a dedicated `DLQ` stream. A small admin UI lets ops requeue.

- **Subject naming convention.** `<service>.<aggregate>.<event-or-command>[.<id>]`, lowercase, dash-separated tokens, dot-separated levels. Examples:
  - `booking.reservation.requested.v1`
  - `booking.reservation.confirmed.v1`
  - `payment.intent.captured.v1`
  - `catalog.listing.published.v1`
  - `cmd.payment.capture.v1` (commands prefixed `cmd.`)
  - `dlq.booking` (dead-letter)
  
  We always include a **version suffix** (`.v1`, `.v2`) so we can ship a v2 contract by emitting on both subjects during migration.

- **Event envelope.** Every published payload follows a CloudEvents-inspired envelope:
  ```json
  {
    "id": "01HXX...",                 // ULID, idempotency key
    "type": "booking.reservation.confirmed.v1",
    "source": "booking-svc",
    "time": "2026-05-06T10:00:00Z",
    "actor": { "type": "user", "id": "kc-uuid" },
    "correlationId": "01HXX...",      // saga / request correlation
    "causationId": "01HXX...",        // id of the event that caused this
    "data": { /* domain-specific payload */ }
  }
  ```
  Plus the NATS message header `Nats-Msg-Id: <envelope.id>` to enable JetStream's built-in deduplication window (default 2 min, configurable per stream). This gives **idempotent producers for free**.

- **Idempotent consumers.** Every consumer service has an `inbox` table:
  ```sql
  CREATE TABLE messaging_inbox (
    message_id  TEXT PRIMARY KEY,
    consumer    TEXT NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  ```
  The handler wraps its work in a single PG transaction that first `INSERT … ON CONFLICT DO NOTHING` into `messaging_inbox`. If the insert hits a conflict, we ack and skip — message already processed. This pairs with the outbox (below) to give exactly-once *effects* on top of at-least-once *delivery*.

- **Transactional outbox.** Every service that emits domain events writes to a local `outbox` table inside the same PG transaction as the business write, then a small in-process relay polls (or uses LISTEN/NOTIFY) and publishes to NATS. Mature open-source options: `pg-transactional-outbox` and `@fullstackhouse/nestjs-outbox` (the latter has a TypeORM driver and works with PG LISTEN/NOTIFY for sub-second latency). For Tukio, we recommend the LISTEN/NOTIFY variant — it removes polling latency without adding a CDC pipeline (Debezium) that would be another moving part to operate.

### 3.3 Sagas — the booking flow

Tukio's hottest cross-service workflow is **booking → payment**, which is exactly the textbook saga case. We use a **choreographed saga** (no central orchestrator) because the steps are few and the language stays inside the events themselves:

```
1. POST /v1/bookings/{id}/confirm                 (gateway → booking-svc, sync)
2. booking-svc commits & emits booking.reservation.confirmed.v1
3. order-svc consumes ↑, creates Order, emits order.created.v1
4. payment-svc consumes ↑, creates Stripe PaymentIntent, emits payment.intent.created.v1
5. Frontend confirms intent client-side; Stripe webhook → payment-svc → emits payment.captured.v1
6. order-svc consumes ↑, marks Order paid, emits order.paid.v1
7. booking-svc consumes ↑, transitions reservation to "paid/confirmed", emits booking.completed.v1 (later, after the event date)
8. notification-svc consumes ↑ at every step, sends emails

# Compensating path
   if payment.failed.v1 → order-svc cancels, emits order.cancelled.v1
                       → booking-svc releases the slot, emits booking.cancelled.v1
```

The compensating actions (`cancel`, `refund`, `release slot`) are **just other event handlers**; they aren't a separate framework. This is the same pattern the NATS community documents for "saga as choreography" and is orders of magnitude simpler than running Temporal or building a Process Manager.

When the workflow gets bigger (e.g. "platform fees + provider payout + invoice generation + accounting export"), introduce a dedicated `saga-svc` running an **orchestrator** (a finite state machine persisted in PG). Don't do it before you need it.

---

## 4. Inside a Service — The Pretre Pattern, Adapted

### 4.1 Recap of the reference pattern

Pretre's `clean-architecture-nestjs` repo splits a Nest service into three top-level folders:

- **`domain/`** — pure TypeScript. Models (no decorators), repository interfaces, logger interface, exceptions interface, config interface. Zero imports from `@nestjs/*`, `typeorm`, or anything stateful.
- **`usecases/`** — one class per use case (≈ one per endpoint). Each use case takes its dependencies via the constructor: a logger, a repository interface, maybe a domain service. Pure TS, no decorators. Exposes `execute(...)` (or sometimes a verb like `addTodo(...)`).
- **`infrastructure/`** — everything that touches a framework: `config/environment-config`, `controllers/`, `repositories/` (TypeORM implementations), `logger/` (NestJS Logger wrapper), `exceptions/`, `services/` (bcrypt, jwt, etc.), `usecases-proxy/` (the glue).

The crucial piece is **`UsecasesProxyModule`** — a `@Module()` that exposes a `register(): DynamicModule` factory. For each use case, it provides:

```ts
{
  inject: [DatabaseTodoRepository, LoggerService],
  provide: UsecasesProxyModule.POST_TODO_USECASES_PROXY,    // string token
  useFactory: (repo, logger) =>
    new UseCaseProxy(new AddTodoUseCases(logger, repo)),
}
```

Where `UseCaseProxy<T>` is a one-liner wrapper:

```ts
export class UseCaseProxy<T> {
  constructor(private readonly useCase: T) {}
  getInstance(): T { return this.useCase; }
}
```

Controllers then `@Inject(UsecasesProxyModule.POST_TODO_USECASES_PROXY)` and call `.getInstance().execute(...)`.

**Why the indirection?** Two concrete benefits:
1. The use case itself is a **plain class** — instantiable with `new` in unit tests, no `Test.createTestingModule`. The proxy is the only NestJS-aware thing.
2. The **wiring is centralised** in one file. When you read `usecases-proxy.module.ts`, you see the entire dependency graph of the service in 200 lines.

The repo has a known criticism (issue #4) that this is heavier than what idiomatic NestJS encourages. That criticism is fair for a small monolith. For **microservices in a marketplace where boundaries genuinely matter**, the discipline is worth it — and we soften it below.

### 4.2 Tukio adaptations (kept simple)

We keep Pretre's spirit but trim:

1. **`domain/` stays pure.** No DI decorators, no `Reflect.metadata`. Models are classes (or pure types) with behaviour where it makes sense, plain DTOs where it doesn't.
2. **`usecases/`** holds one class per use case. We call them `<Verb><Noun>UseCase` (`PublishListingUseCase`) and the method is always `execute(input): Promise<output>`. No `addTodoUseCases` plural-noun naming — we found that confusing in code review.
3. **`infrastructure/`** is split exactly like Pretre's repo, with one extra subfolder: **`messaging/`** for NATS publishers, consumers, and the outbox relay.
4. **Ports** (interfaces) live in `domain/ports/`, separate from `domain/model/`. This makes hexagonal "what's a primary port vs a secondary port" obvious to newcomers.
5. We use **`Symbol`-based DI tokens** for ports (e.g. `export const ListingRepository = Symbol('ListingRepository')`) instead of just static strings on a module. This avoids the `static GET_TODO_USECASES_PROXY = 'getTodoUsecasesProxy'` constant explosion when a service has 30 use cases.
6. **TypeORM** is the default ORM (Pretre uses it). For services where reads are 10× writes (catalog search), we drop down to **raw SQL via `pg`** in a query-side adapter — TypeORM's QueryBuilder gets in the way for complex geo + facet queries.

---

## 5. Worked Example — `catalog-svc`

### 5.1 Responsibility

Owns the `Listing` aggregate (a "service offered by a provider"), the `Category` taxonomy, and per-listing `Availability` rules. Indexes published listings into Meilisearch for the public search endpoint. Emits events when listings are published or availability changes (so `booking-svc` can validate slot requests and `search` can re-index).

### 5.2 Folder tree

```
catalog-svc/
├─ src/
│  ├─ main.ts
│  ├─ app.module.ts
│  │
│  ├─ domain/                              # pure TypeScript, no NestJS imports
│  │  ├─ model/
│  │  │  ├─ listing.ts
│  │  │  ├─ category.ts
│  │  │  ├─ availability.ts
│  │  │  ├─ price.ts
│  │  │  └─ listing-status.ts
│  │  ├─ ports/
│  │  │  ├─ listing.repository.ts          # interface + Symbol token
│  │  │  ├─ category.repository.ts
│  │  │  ├─ availability.repository.ts
│  │  │  ├─ search.indexer.ts              # outbound port to Meilisearch
│  │  │  ├─ event.publisher.ts             # outbound port to NATS
│  │  │  ├─ logger.ts
│  │  │  └─ clock.ts
│  │  └─ exception/
│  │     ├─ listing-not-found.exception.ts
│  │     └─ invalid-availability.exception.ts
│  │
│  ├─ usecases/                            # one file per use case
│  │  ├─ create-listing.usecase.ts
│  │  ├─ update-listing.usecase.ts
│  │  ├─ publish-listing.usecase.ts
│  │  ├─ unpublish-listing.usecase.ts
│  │  ├─ get-listing.usecase.ts
│  │  ├─ search-listings.usecase.ts
│  │  ├─ set-availability.usecase.ts
│  │  └─ on-booking-confirmed.usecase.ts   # consumer-side use case
│  │
│  └─ infrastructure/
│     ├─ config/
│     │  ├─ environment-config.module.ts
│     │  └─ environment-config.service.ts  # implements domain/ports/config
│     ├─ persistence/
│     │  ├─ typeorm.module.ts
│     │  ├─ entities/
│     │  │  ├─ listing.entity.ts
│     │  │  ├─ category.entity.ts
│     │  │  ├─ availability.entity.ts
│     │  │  └─ outbox.entity.ts
│     │  ├─ repositories/
│     │  │  ├─ listing.repository.ts       # implements domain port
│     │  │  ├─ category.repository.ts
│     │  │  └─ availability.repository.ts
│     │  └─ migrations/
│     │     └─ 1715000000000-init.ts
│     ├─ search/
│     │  └─ meilisearch.indexer.ts         # implements SearchIndexer port
│     ├─ messaging/
│     │  ├─ nats.module.ts
│     │  ├─ nats.publisher.ts              # implements EventPublisher port
│     │  ├─ outbox.relay.ts                # PG LISTEN/NOTIFY → NATS
│     │  └─ consumers/
│     │     └─ booking.consumer.ts         # @EventPattern handlers
│     ├─ http/
│     │  ├─ controllers.module.ts
│     │  ├─ controllers/
│     │  │  ├─ listing.controller.ts
│     │  │  ├─ category.controller.ts
│     │  │  └─ availability.controller.ts
│     │  ├─ dto/
│     │  │  ├─ create-listing.dto.ts
│     │  │  ├─ update-listing.dto.ts
│     │  │  └─ search-listings.dto.ts
│     │  ├─ presenters/
│     │  │  └─ listing.presenter.ts
│     │  └─ guards/
│     │     ├─ keycloak-jwt.guard.ts
│     │     └─ roles.guard.ts
│     ├─ logger/
│     │  ├─ logger.module.ts
│     │  └─ logger.service.ts              # Pino-based, implements port
│     ├─ exception/
│     │  ├─ all-exceptions.filter.ts
│     │  └─ exceptions.module.ts
│     └─ usecases-proxy/
│        └─ usecases-proxy.module.ts       # the wiring file
├─ test/
│  ├─ unit/                                # use cases, with mocked ports
│  ├─ integration/                         # adapters with real PG (testcontainers)
│  ├─ contract/                            # Pact consumer + provider
│  └─ e2e/                                 # full service via supertest
├─ Dockerfile
├─ tsconfig.json
├─ nest-cli.json
└─ package.json
```

### 5.3 Key files (full content)

#### 5.3.1 `domain/model/listing.ts`

```ts
import { Price } from './price';
import { ListingStatus } from './listing-status';

export interface ListingProps {
  id: string;
  providerId: string;        // Keycloak sub
  categoryId: string;
  title: string;
  description: string;
  price: Price;
  status: ListingStatus;
  city: string;
  country: 'FR';             // marketplace is FR-only at launch
  geo: { lat: number; lng: number } | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Listing {
  private constructor(private props: ListingProps) {}

  static create(props: Omit<ListingProps, 'status' | 'publishedAt' | 'createdAt' | 'updatedAt'> & { now: Date }): Listing {
    return new Listing({
      ...props,
      status: ListingStatus.Draft,
      publishedAt: null,
      createdAt: props.now,
      updatedAt: props.now,
    });
  }

  static fromPersistence(props: ListingProps): Listing { return new Listing(props); }

  publish(now: Date): void {
    if (this.props.status === ListingStatus.Published) return;
    if (!this.props.title || !this.props.price) {
      throw new Error('Listing not ready to publish');
    }
    this.props.status = ListingStatus.Published;
    this.props.publishedAt = now;
    this.props.updatedAt = now;
  }

  unpublish(now: Date): void {
    this.props.status = ListingStatus.Unpublished;
    this.props.updatedAt = now;
  }

  toPrimitives(): ListingProps { return { ...this.props }; }

  get id() { return this.props.id; }
  get providerId() { return this.props.providerId; }
  get status() { return this.props.status; }
}
```

#### 5.3.2 `domain/ports/listing.repository.ts`

```ts
import { Listing } from '../model/listing';

export interface ListingRepository {
  save(listing: Listing): Promise<void>;
  findById(id: string): Promise<Listing | null>;
  findByProvider(providerId: string, opts?: { limit: number; offset: number }): Promise<Listing[]>;
  delete(id: string): Promise<void>;
}

export const LISTING_REPOSITORY = Symbol('ListingRepository');
```

#### 5.3.3 `domain/ports/event.publisher.ts`

```ts
export interface DomainEvent<T = unknown> {
  type: string;       // e.g. "catalog.listing.published.v1"
  aggregateId: string;
  occurredAt: Date;
  payload: T;
}

export interface EventPublisher {
  /** Writes the event to the local outbox in the same PG transaction. */
  publish(event: DomainEvent, tx?: unknown): Promise<void>;
}

export const EVENT_PUBLISHER = Symbol('EventPublisher');
```

#### 5.3.4 `usecases/publish-listing.usecase.ts`

```ts
import { ListingRepository } from '../domain/ports/listing.repository';
import { EventPublisher } from '../domain/ports/event.publisher';
import { Logger } from '../domain/ports/logger';
import { Clock } from '../domain/ports/clock';
import { ListingNotFoundException } from '../domain/exception/listing-not-found.exception';

export class PublishListingUseCase {
  constructor(
    private readonly logger: Logger,
    private readonly listings: ListingRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(input: { listingId: string; actorProviderId: string }): Promise<void> {
    const listing = await this.listings.findById(input.listingId);
    if (!listing) throw new ListingNotFoundException(input.listingId);
    if (listing.providerId !== input.actorProviderId) {
      throw new Error('Forbidden: actor is not the listing owner');
    }

    listing.publish(this.clock.now());
    await this.listings.save(listing);

    await this.events.publish({
      type: 'catalog.listing.published.v1',
      aggregateId: listing.id,
      occurredAt: this.clock.now(),
      payload: listing.toPrimitives(),
    });

    this.logger.info('Listing published', { listingId: listing.id });
  }
}
```

Notice: **no decorators, no NestJS imports**. This file is pure TypeScript and tested by instantiating with mocks (see §6.1).

#### 5.3.5 `infrastructure/persistence/repositories/listing.repository.ts`

```ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ListingEntity } from '../entities/listing.entity';
import { Listing } from '../../../domain/model/listing';
import { ListingRepository as ListingRepositoryPort } from '../../../domain/ports/listing.repository';

@Injectable()
export class TypeOrmListingRepository implements ListingRepositoryPort {
  constructor(@InjectRepository(ListingEntity) private readonly repo: Repository<ListingEntity>) {}

  async save(listing: Listing): Promise<void> {
    const props = listing.toPrimitives();
    await this.repo.upsert({ ...props, geo: props.geo ? `(${props.geo.lat},${props.geo.lng})` : null }, ['id']);
  }

  async findById(id: string): Promise<Listing | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? Listing.fromPersistence(this.toDomain(row)) : null;
  }

  async findByProvider(providerId: string, opts = { limit: 50, offset: 0 }) {
    const rows = await this.repo.find({ where: { providerId }, take: opts.limit, skip: opts.offset });
    return rows.map((r) => Listing.fromPersistence(this.toDomain(r)));
  }

  async delete(id: string) { await this.repo.delete(id); }

  private toDomain(row: ListingEntity) { /* row → ListingProps */ return row as any; }
}
```

#### 5.3.6 `infrastructure/usecases-proxy/usecases-proxy.module.ts`

This is the central wiring file — the spiritual successor to Pretre's `UsecasesProxyModule`.

```ts
import { DynamicModule, Module, Provider } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ListingEntity } from '../persistence/entities/listing.entity';
import { TypeOrmListingRepository } from '../persistence/repositories/listing.repository';
import { LISTING_REPOSITORY } from '../../domain/ports/listing.repository';

import { NatsEventPublisher } from '../messaging/nats.publisher';
import { EVENT_PUBLISHER } from '../../domain/ports/event.publisher';

import { LoggerModule } from '../logger/logger.module';
import { LoggerService } from '../logger/logger.service';
import { LOGGER } from '../../domain/ports/logger';
import { SystemClock } from '../persistence/system-clock';
import { CLOCK } from '../../domain/ports/clock';

import { CreateListingUseCase } from '../../usecases/create-listing.usecase';
import { PublishListingUseCase } from '../../usecases/publish-listing.usecase';
import { GetListingUseCase } from '../../usecases/get-listing.usecase';
// … other use cases

export class UseCaseProxy<T> {
  constructor(private readonly useCase: T) {}
  getInstance(): T { return this.useCase; }
}

@Module({})
export class UseCasesProxyModule {
  static readonly CREATE_LISTING = 'CreateListingUseCaseProxy';
  static readonly PUBLISH_LISTING = 'PublishListingUseCaseProxy';
  static readonly GET_LISTING = 'GetListingUseCaseProxy';

  static register(): DynamicModule {
    const portProviders: Provider[] = [
      { provide: LISTING_REPOSITORY, useClass: TypeOrmListingRepository },
      { provide: EVENT_PUBLISHER, useClass: NatsEventPublisher },
      { provide: LOGGER, useExisting: LoggerService },
      { provide: CLOCK, useClass: SystemClock },
    ];

    const useCaseProviders: Provider[] = [
      {
        provide: UseCasesProxyModule.CREATE_LISTING,
        inject: [LOGGER, LISTING_REPOSITORY, EVENT_PUBLISHER, CLOCK],
        useFactory: (logger, listings, events, clock) =>
          new UseCaseProxy(new CreateListingUseCase(logger, listings, events, clock)),
      },
      {
        provide: UseCasesProxyModule.PUBLISH_LISTING,
        inject: [LOGGER, LISTING_REPOSITORY, EVENT_PUBLISHER, CLOCK],
        useFactory: (logger, listings, events, clock) =>
          new UseCaseProxy(new PublishListingUseCase(logger, listings, events, clock)),
      },
      {
        provide: UseCasesProxyModule.GET_LISTING,
        inject: [LOGGER, LISTING_REPOSITORY],
        useFactory: (logger, listings) =>
          new UseCaseProxy(new GetListingUseCase(logger, listings)),
      },
    ];

    return {
      module: UseCasesProxyModule,
      imports: [LoggerModule, TypeOrmModule.forFeature([ListingEntity])],
      providers: [...portProviders, ...useCaseProviders],
      exports: [
        UseCasesProxyModule.CREATE_LISTING,
        UseCasesProxyModule.PUBLISH_LISTING,
        UseCasesProxyModule.GET_LISTING,
      ],
    };
  }
}
```

#### 5.3.7 `infrastructure/http/controllers/listing.controller.ts`

```ts
import { Body, Controller, Get, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { UseCasesProxyModule, UseCaseProxy } from '../../usecases-proxy/usecases-proxy.module';
import { CreateListingUseCase } from '../../../usecases/create-listing.usecase';
import { PublishListingUseCase } from '../../../usecases/publish-listing.usecase';
import { CreateListingDto } from '../dto/create-listing.dto';
import { KeycloakJwtGuard } from '../guards/keycloak-jwt.guard';
import { Roles } from '../guards/roles.decorator';
import { CurrentActor, Actor } from '../guards/current-actor.decorator';
import { ListingPresenter } from '../presenters/listing.presenter';

@Controller('v1/listings')
@UseGuards(KeycloakJwtGuard)
export class ListingController {
  constructor(
    @Inject(UseCasesProxyModule.CREATE_LISTING)
    private readonly createListing: UseCaseProxy<CreateListingUseCase>,
    @Inject(UseCasesProxyModule.PUBLISH_LISTING)
    private readonly publishListing: UseCaseProxy<PublishListingUseCase>,
  ) {}

  @Post()
  @Roles('provider')
  async create(@CurrentActor() actor: Actor, @Body() dto: CreateListingDto) {
    const listing = await this.createListing.getInstance().execute({ ...dto, providerId: actor.userId });
    return ListingPresenter.toHttp(listing);
  }

  @Post(':id/publish')
  @Roles('provider')
  async publish(@CurrentActor() actor: Actor, @Param('id') id: string) {
    await this.publishListing.getInstance().execute({ listingId: id, actorProviderId: actor.userId });
    return { ok: true };
  }
}
```

#### 5.3.8 `infrastructure/http/guards/keycloak-jwt.guard.ts`

```ts
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwksClient } from 'jwks-rsa';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class KeycloakJwtGuard implements CanActivate {
  private readonly jwks: JwksClient;
  private readonly issuer: string;
  private readonly audience: string;

  constructor(config: ConfigService) {
    const baseUrl = config.getOrThrow<string>('KEYCLOAK_URL');
    const realm = config.getOrThrow<string>('KEYCLOAK_REALM');
    this.issuer = `${baseUrl}/realms/${realm}`;
    this.audience = config.getOrThrow<string>('KEYCLOAK_AUDIENCE');
    this.jwks = new JwksClient({
      jwksUri: `${this.issuer}/protocol/openid-connect/certs`,
      cache: true,
      cacheMaxAge: 10 * 60 * 1000,
      rateLimit: true,
      jwksRequestsPerMinute: 5,
    });
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const auth = req.headers.authorization as string | undefined;
    if (!auth?.startsWith('Bearer ')) throw new UnauthorizedException('missing bearer token');
    const token = auth.slice(7);

    const decoded: any = await new Promise((resolve, reject) => {
      jwt.verify(
        token,
        (header, cb) => {
          this.jwks.getSigningKey(header.kid!, (err, key) => err ? cb(err) : cb(null, key!.getPublicKey()));
        },
        { algorithms: ['RS256'], issuer: this.issuer, audience: this.audience },
        (err, payload) => err ? reject(new UnauthorizedException(err.message)) : resolve(payload),
      );
    });

    req.actor = {
      userId: decoded.sub,
      email: decoded.email,
      roles: decoded.realm_access?.roles ?? [],
      clientRoles: decoded.resource_access?.[this.audience]?.roles ?? [],
    };
    return true;
  }
}
```

In production the gateway has already done this validation; downstream services validate again as defence-in-depth and as a safety net for direct internal calls during incidents. The double-check is cheap because JWKS is cached.

#### 5.3.9 `infrastructure/messaging/nats.publisher.ts` (outbox-aware)

```ts
import { Injectable } from '@nestjs/common';
import { ulid } from 'ulid';
import { DataSource } from 'typeorm';
import { OutboxEntity } from '../persistence/entities/outbox.entity';
import { DomainEvent, EventPublisher } from '../../domain/ports/event.publisher';

@Injectable()
export class NatsEventPublisher implements EventPublisher {
  constructor(private readonly ds: DataSource) {}

  async publish(event: DomainEvent, tx?: unknown): Promise<void> {
    const manager = (tx as any) ?? this.ds.manager;
    await manager.getRepository(OutboxEntity).insert({
      id: ulid(),
      type: event.type,
      aggregateId: event.aggregateId,
      payload: event.payload,
      occurredAt: event.occurredAt,
      status: 'pending',
    });
    // The outbox.relay.ts service polls (or LISTENs) and publishes to NATS JetStream
    // with Nats-Msg-Id = outbox row id, then marks status = 'sent'.
  }
}
```

#### 5.3.10 `infrastructure/messaging/consumers/booking.consumer.ts`

```ts
import { Controller, Inject } from '@nestjs/common';
import { EventPattern, Payload, Ctx } from '@nestjs/microservices';
import { JetstreamContext } from '@horizon-republic/nestjs-jetstream';
import { UseCasesProxyModule, UseCaseProxy } from '../../usecases-proxy/usecases-proxy.module';
import { OnBookingConfirmedUseCase } from '../../../usecases/on-booking-confirmed.usecase';

@Controller()
export class BookingConsumer {
  constructor(
    @Inject(UseCasesProxyModule.ON_BOOKING_CONFIRMED)
    private readonly onConfirmed: UseCaseProxy<OnBookingConfirmedUseCase>,
  ) {}

  @EventPattern('booking.reservation.confirmed.v1', {
    durable: 'catalog-on-booking-confirmed',
    deliver_policy: 'new',
    ack_policy: 'explicit',
    max_deliver: 5,
    filter_subject: 'booking.reservation.confirmed.v1',
  })
  async handle(@Payload() event: any, @Ctx() ctx: JetstreamContext) {
    try {
      await this.onConfirmed.getInstance().execute(event);
      ctx.message.ack();
    } catch (err) {
      // bounded retry → DLQ on max_deliver exhaustion
      ctx.message.nak();
    }
  }
}
```

The consumer's `OnBookingConfirmedUseCase` first writes to the inbox table (idempotency) and only then locks the listing's availability slot.

### 5.4 `app.module.ts`

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';

import { EnvironmentConfigModule } from './infrastructure/config/environment-config.module';
import { TypeOrmConfigModule } from './infrastructure/persistence/typeorm.module';
import { LoggerModule } from './infrastructure/logger/logger.module';
import { ExceptionsModule } from './infrastructure/exception/exceptions.module';
import { UseCasesProxyModule } from './infrastructure/usecases-proxy/usecases-proxy.module';
import { ControllersModule } from './infrastructure/http/controllers.module';
import { NatsModule } from './infrastructure/messaging/nats.module';
import { AllExceptionsFilter } from './infrastructure/exception/all-exceptions.filter';
import { LoggingInterceptor } from './infrastructure/http/logging.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EnvironmentConfigModule,
    LoggerModule,
    ExceptionsModule,
    TypeOrmConfigModule,
    NatsModule,
    UseCasesProxyModule.register(),
    ControllersModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
```

### 5.5 `main.ts` — hybrid HTTP + JetStream microservice

```ts
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { JetstreamServer } from '@horizon-republic/nestjs-jetstream';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter({ logger: false }));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  app.connectMicroservice({
    strategy: new JetstreamServer({
      connectionOptions: { servers: [process.env.NATS_URL!], name: 'catalog-svc' },
      assertStreams: [{ name: 'BOOKING', subjects: ['booking.>'] }],
    }),
  });

  await app.startAllMicroservices();
  await app.listen(Number(process.env.PORT ?? 3001), '0.0.0.0');
}
bootstrap();
```

---

## 6. Testing Strategy

We use the standard test pyramid, calibrated for hexagonal:

### 6.1 Unit tests — use cases with mocked ports (the bulk)

- Run with `vitest` (faster than Jest for pure TS, no SWC headaches).
- One spec per use case. Mocks are plain object literals satisfying the port interface.
- Should run in **< 50 ms each** because there is no NestJS, no DB, no NATS.

```ts
import { describe, it, expect, vi } from 'vitest';
import { PublishListingUseCase } from '../../src/usecases/publish-listing.usecase';
import { Listing } from '../../src/domain/model/listing';

describe('PublishListingUseCase', () => {
  const now = new Date('2026-05-06T10:00:00Z');
  const clock = { now: () => now };
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

  it('publishes a draft listing and emits the event', async () => {
    const listing = Listing.create({ /* … */ now });
    const listings = { findById: vi.fn().mockResolvedValue(listing), save: vi.fn(), findByProvider: vi.fn(), delete: vi.fn() };
    const events = { publish: vi.fn() };
    const sut = new PublishListingUseCase(logger, listings, events, clock);

    await sut.execute({ listingId: listing.id, actorProviderId: listing.providerId });

    expect(listings.save).toHaveBeenCalledOnce();
    expect(events.publish).toHaveBeenCalledWith(expect.objectContaining({ type: 'catalog.listing.published.v1' }));
  });

  it('forbids publishing a listing the actor does not own', async () => {
    const listing = Listing.create({ /* providerId: "owner-1" … */ now });
    const listings = { findById: vi.fn().mockResolvedValue(listing), save: vi.fn(), findByProvider: vi.fn(), delete: vi.fn() };
    const events = { publish: vi.fn() };
    const sut = new PublishListingUseCase(logger, listings, events, clock);

    await expect(sut.execute({ listingId: listing.id, actorProviderId: 'someone-else' })).rejects.toThrow(/Forbidden/);
  });
});
```

### 6.2 Integration tests — adapters with real PG via testcontainers

- Run repository implementations against a real PostgreSQL spun up with `@testcontainers/postgresql`.
- Validate that domain ↔ entity mapping is faithful and that migrations apply.
- Run on CI with a single shared PG container per file (start in `beforeAll`, truncate between tests).

### 6.3 Contract tests — Pact for HTTP, schema tests for events

- **HTTP**: each gateway-to-service interaction is a Pact contract. The gateway acts as the **consumer**, downstream services as the **provider**. Consumer tests run during gateway CI and publish a Pact JSON to a Pactflow broker (or the open-source `pact-broker` via Docker). Provider verification runs in the catalog-svc CI; if it fails, the build is red.
- **NATS events**: Pact's message-pact mode covers AMQP/Kafka, but for JetStream the cleanest pattern is **JSON Schema contracts kept in a shared package** (`@tukio/contracts`). Each service that emits an event ships a schema `catalog.listing.published.v1.schema.json`; consumers run a "schema compatibility" test in CI that loads the version shipped by the producer and validates a representative sample of the consumer's expected payload against it. This is enough until the team grows beyond ~6 engineers.
- For the `@tukio/contracts` package we use a tiny **TypeScript monorepo** (pnpm workspaces or Turborepo). It also exports the typed envelope `DomainEvent<T>` so producers and consumers share the same shape.

### 6.4 E2E tests — service in isolation

- Use `supertest` against the running NestJS service with a real PG (testcontainers) and an **in-process NATS** (the `nats-server` binary is small enough to embed for tests, or use a single Docker container shared across the suite).
- We do **not** run cross-service E2E in CI — it's flaky and slow. We rely on contract tests to catch interaction bugs and a small staging environment for true end-to-end smoke tests.

### 6.5 Test layout

```
test/
├─ unit/                          # vitest, no infra
├─ integration/                   # vitest, testcontainers
├─ contract/
│  ├─ consumer.pact.spec.ts       # only in gateway-api
│  └─ provider.pact.spec.ts       # in each downstream service
└─ e2e/                           # supertest + testcontainers
```

CI matrix per service: `pnpm lint`, `pnpm test:unit`, `pnpm test:integration`, `pnpm test:contract`, `pnpm test:e2e`.

---

## 7. Local Development — Docker Compose

### 7.1 Project layout (monorepo)

```
tukio-api/
├─ apps/
│  ├─ gateway-api/
│  ├─ catalog-svc/
│  ├─ booking-svc/
│  ├─ order-svc/
│  ├─ payment-svc/
│  ├─ identity-svc/
│  ├─ notification-svc/
│  ├─ media-svc/
│  ├─ messaging-svc/
│  └─ review-svc/
├─ libs/
│  ├─ contracts/                # JSON schemas + TS types for events & DTOs
│  ├─ messaging/                # NATS JetStream wrapper, outbox helpers
│  ├─ auth/                     # KeycloakJwtGuard, Roles decorator, Actor type
│  └─ testing/                  # testcontainers helpers, Pact helpers
├─ infra/
│  ├─ docker-compose.yml
│  ├─ keycloak/
│  │  └─ realm-tukio.json       # bootstrap realm with clients & roles
│  └─ nats/
│     └─ nats.conf
├─ pnpm-workspace.yaml
├─ turbo.json
└─ package.json
```

### 7.2 `infra/docker-compose.yml`

```yaml
version: "3.9"
name: tukio

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: tukio
      POSTGRES_PASSWORD: tukio
      POSTGRES_MULTIPLE_DATABASES: tukio_identity,tukio_catalog,tukio_booking,tukio_order,tukio_payment,tukio_messaging,tukio_review,tukio_notification,tukio_media,tukio_keycloak
    ports: ["5432:5432"]
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./postgres/init-multiple-dbs.sh:/docker-entrypoint-initdb.d/init-multiple-dbs.sh
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U tukio"]
      interval: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s

  nats:
    image: nats:2.10-alpine
    command: ["-js", "-sd", "/data", "-m", "8222"]
    ports: ["4222:4222", "8222:8222"]
    volumes:
      - natsdata:/data
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:8222/healthz"]
      interval: 5s

  keycloak:
    image: quay.io/keycloak/keycloak:25.0
    command: start-dev --import-realm
    environment:
      KC_DB: postgres
      KC_DB_URL: jdbc:postgresql://postgres/tukio_keycloak
      KC_DB_USERNAME: tukio
      KC_DB_PASSWORD: tukio
      KEYCLOAK_ADMIN: admin
      KEYCLOAK_ADMIN_PASSWORD: admin
    ports: ["8080:8080"]
    depends_on:
      postgres: { condition: service_healthy }
    volumes:
      - ./keycloak/realm-tukio.json:/opt/keycloak/data/import/realm-tukio.json

  meilisearch:
    image: getmeili/meilisearch:v1.10
    environment:
      MEILI_MASTER_KEY: dev-master-key
      MEILI_NO_ANALYTICS: "true"
    ports: ["7700:7700"]
    volumes:
      - meili:/meili_data

  mailhog:                          # local stand-in for Resend
    image: mailhog/mailhog
    ports: ["1025:1025", "8025:8025"]

  minio:                            # local stand-in for Cloudflare R2
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: tukio
      MINIO_ROOT_PASSWORD: tukio12345
    ports: ["9000:9000", "9001:9001"]
    volumes: [miniodata:/data]

  # ---------- Application services ----------
  gateway-api:
    build: { context: .., dockerfile: apps/gateway-api/Dockerfile, target: dev }
    env_file: ./env/gateway-api.env
    ports: ["3000:3000"]
    depends_on:
      keycloak: { condition: service_started }
      nats: { condition: service_healthy }
      redis: { condition: service_healthy }

  catalog-svc:
    build: { context: .., dockerfile: apps/catalog-svc/Dockerfile, target: dev }
    env_file: ./env/catalog-svc.env
    ports: ["3001:3001"]
    depends_on:
      postgres: { condition: service_healthy }
      nats: { condition: service_healthy }
      meilisearch: { condition: service_started }

  booking-svc:
    build: { context: .., dockerfile: apps/booking-svc/Dockerfile, target: dev }
    env_file: ./env/booking-svc.env
    ports: ["3002:3002"]
    depends_on:
      postgres: { condition: service_healthy }
      nats: { condition: service_healthy }

  order-svc:    { build: { context: .., dockerfile: apps/order-svc/Dockerfile, target: dev },    ports: ["3003:3003"], env_file: ./env/order-svc.env,    depends_on: [postgres, nats] }
  payment-svc:  { build: { context: .., dockerfile: apps/payment-svc/Dockerfile, target: dev },  ports: ["3004:3004"], env_file: ./env/payment-svc.env,  depends_on: [postgres, nats] }
  identity-svc: { build: { context: .., dockerfile: apps/identity-svc/Dockerfile, target: dev }, ports: ["3005:3005"], env_file: ./env/identity-svc.env, depends_on: [postgres, nats, keycloak] }
  notification-svc: { build: { context: .., dockerfile: apps/notification-svc/Dockerfile, target: dev }, ports: ["3006:3006"], env_file: ./env/notification-svc.env, depends_on: [postgres, nats, mailhog] }
  media-svc:    { build: { context: .., dockerfile: apps/media-svc/Dockerfile, target: dev },    ports: ["3007:3007"], env_file: ./env/media-svc.env,    depends_on: [postgres, nats, minio] }
  messaging-svc:{ build: { context: .., dockerfile: apps/messaging-svc/Dockerfile, target: dev },ports: ["3008:3008"], env_file: ./env/messaging-svc.env,depends_on: [postgres, redis, nats] }
  review-svc:   { build: { context: .., dockerfile: apps/review-svc/Dockerfile, target: dev },   ports: ["3009:3009"], env_file: ./env/review-svc.env,   depends_on: [postgres, nats] }

volumes:
  pgdata:
  natsdata:
  meili:
  miniodata:
```

A `make up` target wraps `docker compose --profile core up -d` (Postgres, Redis, NATS, Keycloak, Meili, MailHog, MinIO) so engineers can run a single service natively against shared infra.

### 7.3 `apps/catalog-svc/Dockerfile` (multi-stage)

```dockerfile
# syntax=docker/dockerfile:1.6
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml turbo.json ./
COPY apps/catalog-svc/package.json apps/catalog-svc/
COPY libs/ libs/
RUN pnpm install --frozen-lockfile

FROM deps AS dev
COPY . .
WORKDIR /app/apps/catalog-svc
EXPOSE 3001
CMD ["pnpm", "start:dev"]

FROM deps AS build
COPY . .
RUN pnpm --filter catalog-svc build && pnpm --filter catalog-svc deploy --prod /out

FROM node:22-alpine AS prod
WORKDIR /app
COPY --from=build /out ./
EXPOSE 3001
CMD ["node", "dist/main.js"]
```

---

## 8. Cross-Cutting Concerns Cheatsheet

| Concern | Choice | Notes |
|---|---|---|
| **Logging** | Pino + JSON to stdout | One correlation id per request, propagated through NATS headers (`x-correlation-id`). |
| **Tracing** | OpenTelemetry SDK with OTLP exporter | Auto-instrument Fastify, TypeORM, NATS. Tempo or Honeycomb on the receiving end. |
| **Metrics** | Prometheus client per service | Scrape from a sidecar or directly. Standard RED metrics + JetStream consumer lag. |
| **Config** | `@nestjs/config` + Zod schema | Fail-fast at boot if any required env var is missing. |
| **Migrations** | TypeORM migrations per service | Runs at container startup behind a `--run-migrations-on-boot` flag for dev; in prod, a Job/initContainer. |
| **Secrets** | Doppler or 1Password Connect (dev) → SOPS-encrypted in Git for ops, GitHub OIDC → AWS/GCP secret manager in CI/CD. |
| **Rate limiting** | `@nestjs/throttler` backed by Upstash Redis at the gateway. |
| **Idempotency keys** | Required header on POST endpoints that mutate money state. Stored in `idempotency_keys` table with the response payload, TTL 24 h. |
| **Webhooks (Stripe)** | Endpoint lives in `payment-svc`, validates the Stripe signature, writes to outbox, then translates to `payment.*` events. Stripe's own retries cover us. |
| **Feature flags** | GrowthBook self-hosted, fed by a service config endpoint on the gateway. |
| **CI** | GitHub Actions matrix per app, Turborepo remote cache for incremental builds. Each PR runs `lint + unit + integration + contract`. |

---

## 9. Reality Checks & Recommendations

1. **Start with three services running in production**, not ten. Even though the codebases are split from day 1 (per your requirement), it's cheaper to deploy them as one Kubernetes namespace with a shared NATS and Postgres instance for the first 6 months, then peel them apart by traffic. The folder structure does not change — only the deployment topology does.
2. **Don't fall into the "modular monolith vs microservices" purity debate.** The Pretre layout works either way. The cost of starting with separate processes is mostly DevOps (CI per service, observability, NATS in dev) — manageable for 2–4 engineers in 2025/26 because the tooling has caught up.
3. **The biggest risk in a marketplace is the booking-payment saga.** Invest disproportionate test coverage there: inbox/outbox tables, replayable saga, idempotency keys on every mutating endpoint, and a chaos test that randomly fails NATS publishes during the saga. Everything else (search, reviews, messaging) is easier to recover from.
4. **Avoid `@nestjs/microservices` Transport.NATS.** As noted, it doesn't speak JetStream and silently loses messages on restart. Use `@horizon-republic/nestjs-jetstream` or wrap `nats.js` directly. Make this an architectural rule, written down in an ADR.
5. **The Pretre proxy pattern is worth keeping** because it makes the dependency graph of each service legible at a glance and keeps the domain layer trivially unit-testable. The criticism that "it's not idiomatic Nest" is true and irrelevant: you are explicitly opting out of "feature module" idiomatic Nest in favour of hexagonal layering, and the proxy is the smallest sane bridge between the two.
6. **Keep the `@tukio/contracts` package small and stable.** Every new event type ships a JSON schema and a TS type. Schemas are versioned (`v1`, `v2`); deletions never happen, only deprecations. Even if you skip Pact for now, this discipline alone prevents 80 % of integration regressions.
7. **In France**, GDPR + DAC7 (marketplace reporting since 2024) + TVA collection rules will affect `payment-svc`, `order-svc`, and `identity-svc`. Reserve schema room for legal documents, identity verification artefacts (R2-stored, pointed to by `identity-svc`), and a periodic export job. This is not architecture-changing, but it is easier to design in than to retrofit.

---

## 10. Reference Repositories Worth Studying

- **`jonathanPretre/clean-architecture-nestjs`** — the original proxy pattern reference. Read the `usecases-proxy.module.ts` and the matching Medium post.
- **`royib/clean-architecture-nestJS`** — same spirit, different style; helpful for an alternative perspective.
- **`VincentJouanne/nest-clean-architecture`** — DDD with functional-programming-flavoured use cases. Good ideas for `Result<T, E>` returns instead of throwing.
- **`Sairyss/domain-driven-hexagon`** — TypeScript/NestJS hexagon best-practices catalogue. Heavy, but the snippets on Value Objects and Repositories are excellent.
- **`HorizonRepublic/nestjs-jetstream`** — the recommended JetStream transport.
- **`fullstackhouse/nestjs-outbox`** — TypeORM/MikroORM outbox with PG LISTEN/NOTIFY.
- **`pact-foundation/nestjs-pact`** — Pact wired into NestJS modules.
- **`benjsicam/nestjs-rest-microservices`** — older but still useful reference for a Nest gateway + multiple downstream services.

---

## 11. Suggested Build Order (90-day plan)

**Sprint 0 (week 1–2).** Monorepo skeleton, `@tukio/contracts`, `@tukio/messaging`, `@tukio/auth`, Docker Compose with Postgres / NATS / Keycloak, CI for one service, ADR-001 ("hexagonal via UseCaseProxy"), ADR-002 ("NATS JetStream as event bus"), ADR-003 ("database per service").

**Sprint 1 (week 3–4).** `identity-svc` + `gateway-api` + `catalog-svc` (CRUD only, no search). End-to-end happy path: provider signs up in Keycloak → `identity.user.registered` event → `Profile` created → provider creates a draft listing.

**Sprint 2 (week 5–6).** `catalog-svc` publishing flow + Meilisearch indexing (consumer). Public search endpoint on the gateway. Add Pact contract tests.

**Sprint 3 (week 7–9).** `booking-svc` + `order-svc` happy path. Outbox + JetStream producer, inbox + idempotent consumers.

**Sprint 4 (week 10–11).** `payment-svc` with Stripe Connect + the booking-payment saga. End-to-end: search → request → quote → pay → confirm. This is the milestone that proves the architecture.

**Sprint 5 (week 12).** `notification-svc` (Resend), `media-svc` (R2), observability stack (OTel, Prometheus, Tempo). Soft-launch to a closed beta.

`messaging-svc` and `review-svc` come after the soft-launch, driven by user feedback. They are self-contained and the architecture absorbs them without changes.

---

This proposal is intentionally opinionated. Every choice — the proxy pattern, NATS JetStream over Kafka, choreographed sagas over a workflow engine, JSON-schema contracts before adopting Pact-broker — is selected to keep the team's cognitive load bounded while leaving every door open for scale. If a future requirement breaks an assumption (e.g., need for guaranteed ordering across all services, or a third-party that only speaks gRPC), the ports/adapters split makes the swap mechanical rather than architectural.
