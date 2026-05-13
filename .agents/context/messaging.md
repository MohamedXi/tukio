# Messaging — NATS JetStream + transactional outbox + inbox dedup

Cross-service integration uses **NATS JetStream 2.10** with a
**transactional outbox** on the producer side and an **inbox dedup** on
the consumer side. The pattern was introduced by Story 0.7 and lives in
`@tukio/messaging`.

## Why outbox + inbox

The straight-line "write to DB then publish to NATS" approach has two
failure modes:

1. DB commits, NATS publish fails → consumers miss the event.
2. NATS publish succeeds, DB commit fails → consumers see a phantom event.

The outbox pattern atomically writes the event to a local `outbox` table
in the same DB transaction as the business write. A separate relay reads
`outbox` and publishes to NATS at-least-once. The inbox table on the
consumer side filters duplicates by `event_id`.

## Producer side (`OutboxPublisher` + `OutboxRelayService`)

### Use in a use case

```ts
// apps/identity-svc/src/usecases/register-user.usecase.ts
import type { IEventPublisher } from '../domain/ports/event-publisher.port.js';

export class RegisterUserUseCase {
  constructor(
    private readonly users: IUserProfileRepository,
    private readonly events: IEventPublisher, // injected as OutboxPublisher
  ) {}

  async execute(cmd: RegisterUserCommand): Promise<UserProfile> {
    const profile = UserProfile.create(cmd);
    await this.users.save(profile); // write to user_profiles
    await this.events.publish({
      // write to outbox SAME tx
      type: 'identity.user.registered.v1',
      payload: UserRegisteredV1Schema.parse({ userId: profile.id, email: profile.email.value }),
      correlationId: cmd.correlationId,
    });
    return profile;
  }
}
```

The `OutboxPublisher` implements `IEventPublisher` and inserts the event
into the `outbox` table within the current TypeORM transaction (via
`@Transactional()` decorator). Until the transaction commits, the event
is invisible.

### Relay (`OutboxRelayService`)

A background service per backend dedicated to one outbox. It:

1. Opens a **dedicated PG connection** (separate from the request-handling
   pool) and runs `LISTEN tukio_outbox_new`.
2. On `NOTIFY` (fired by the `trg_outbox_notify` trigger after insert),
   reads the new row, publishes to NATS JetStream stream
   `TUKIO_<SERVICE>`, and marks the row as `published_at = NOW()`.
3. On startup, replays unpublished rows (where `published_at IS NULL`)
   so a crash mid-publish is recoverable.
4. Has exponential backoff on NATS publish failures + dead-letter to
   `tukio_outbox_dlq` after N retries.

### Outbox table schema (Story 0.7 migration)

```sql
CREATE TABLE outbox (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID NOT NULL UNIQUE,
  event_type      TEXT NOT NULL,             -- 'identity.user.registered.v1'
  correlation_id  UUID NOT NULL,
  payload         JSONB NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'published' | 'failed'
  attempts        INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at    TIMESTAMPTZ,
  last_error      TEXT
);

CREATE INDEX idx_outbox_pending ON outbox (created_at) WHERE status = 'pending';

CREATE OR REPLACE FUNCTION notify_outbox_new() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('tukio_outbox_new', NEW.id::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_outbox_notify
  AFTER INSERT ON outbox
  FOR EACH ROW EXECUTE FUNCTION notify_outbox_new();
```

## Consumer side (`Inbox` dedup + `@NatsSubscribe`)

### Use in an event handler

```ts
// apps/notification-svc/src/infrastructure/messaging/handlers/user-registered.handler.ts
@Injectable()
export class UserRegisteredHandler {
  constructor(
    private readonly inbox: InboxService,
    private readonly useCase: SendWelcomeEmailUseCase,
  ) {}

  @NatsSubscribe('identity.user.registered.v1', { durable: 'notification-user-registered' })
  async handle(msg: NatsMessage): Promise<void> {
    const event = UserRegisteredV1Schema.parse(msg.payload);
    await this.inbox.dedupAndProcess(msg.event_id, async () => {
      await this.useCase.execute({ userId: event.userId, email: event.email, locale: msg.locale });
    });
  }
}
```

`InboxService.dedupAndProcess(eventId, fn)`:

1. Checks `inbox` for `event_id`. If present and `processed_at IS NOT NULL`,
   acks the message and returns.
2. Inserts the row with `processed_at = NULL`, runs `fn()`, then updates
   `processed_at = NOW()`. All in one PG transaction with the use case's
   own writes — so business write + dedup are atomic.
3. If `fn()` throws, the transaction rolls back. NATS redelivers
   (JetStream ack on completion).

### Inbox table schema

```sql
CREATE TABLE inbox (
  event_id        UUID PRIMARY KEY,
  event_type      TEXT NOT NULL,
  correlation_id  UUID NOT NULL,
  received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at    TIMESTAMPTZ,
  payload         JSONB NOT NULL
);

CREATE INDEX idx_inbox_received ON inbox (received_at) WHERE processed_at IS NULL;
```

## Event naming

Pattern: `<domain>.<entity>.<verb>.v<n>` — lowercase, dot-separated,
kebab-case within segments, **English-only**.

| Producer      | Event                             | Notes                                  |
| ------------- | --------------------------------- | -------------------------------------- |
| identity-svc  | `identity.user.registered.v1`     | After successful registration          |
| identity-svc  | `identity.user.email-verified.v1` | After email-verify landing             |
| identity-svc  | `identity.user.deleted.v1`        | Soft-delete                            |
| catalog-svc   | `catalog.listing.published.v1`    | Auto-publish if KYC verified           |
| catalog-svc   | `catalog.listing.unpublished.v1`  | Pro action or admin moderation         |
| booking-svc   | `booking.requested.v1`            | Customer submits                       |
| booking-svc   | `booking.accepted.v1`             | Pro accepts within delai               |
| booking-svc   | `booking.refused.v1`              | Pro refuses or expires                 |
| payment-svc   | `payment.intent.captured.v1`      | Stripe capture confirmed               |
| admin (audit) | `admin.action.pro-verified.v1`    | Goes to `tukio_audit` immutable stream |

The `tukio/event-naming` ESLint rule (error) validates the shape at
publish/subscribe sites:

```ts
// ✅
await this.events.publish({ type: 'identity.user.registered.v1', ... });

// ❌ Linter error
await this.events.publish({ type: 'UserRegistered', ... });
await this.events.publish({ type: 'identity-user-registered.v1', ... });
```

Event payloads live in
`packages/contracts/src/events/<domain>/<event-name>.v<n>.ts` as Zod
schemas. Add a new event via the `.agents/skills/add-nats-event.md`
workflow.

## Streams (one per service)

Each service owns a JetStream stream named `TUKIO_<SERVICE>` (uppercase
underscore):

| Service          | Stream               | Subjects         |
| ---------------- | -------------------- | ---------------- |
| identity-svc     | `TUKIO_IDENTITY`     | `identity.>`     |
| catalog-svc      | `TUKIO_CATALOG`      | `catalog.>`      |
| booking-svc      | `TUKIO_BOOKING`      | `booking.>`      |
| order-svc        | `TUKIO_ORDER`        | `order.>`        |
| payment-svc      | `TUKIO_PAYMENT`      | `payment.>`      |
| messaging-svc    | `TUKIO_MESSAGING`    | `messaging.>`    |
| review-svc       | `TUKIO_REVIEW`       | `review.>`       |
| notification-svc | `TUKIO_NOTIFICATION` | `notification.>` |
| media-svc        | `TUKIO_MEDIA`        | `media.>`        |
| (audit)          | `TUKIO_AUDIT`        | `admin.action.>` |

Streams are created on service boot via
`OutboxRelayModule.forRoot({ streamName: 'TUKIO_<SERVICE>' })`. Consumers
declare durable subscriptions: `durable: '<service>-<handler>'`.

## Replicas

- **Dev** (docker-compose): `R=1` (single node).
- **Prod / staging**: `R=3` (declared in service bootstrap via env var
  `NATS_REPLICAS`). Provides HA + storage durability.

## DLQ + chaos

- Failed deliveries after N retries land in a dedicated DLQ stream per
  service (`TUKIO_<SERVICE>_DLQ`).
- Chaos tests live in `apps/<svc>/test/chaos/*.chaos-spec.ts` and
  validate: NATS disconnect during publish, consumer crash mid-process,
  PG LISTEN/NOTIFY connection loss, JetStream redelivery, DLQ overflow.
- Run via `pnpm chaos:test` (Story 0.10's `infra/scripts/run-chaos-tests.sh`).

## Hard rules

- ✅ **Publish only via `OutboxPublisher`** (the `IEventPublisher` port).
  Enforced by `tukio/no-direct-event-publish` (warn at MVP, error at
  Story 0.11).
- ✅ **Consume only via `@NatsSubscribe` + `InboxService.dedupAndProcess`**.
  Never write a custom NATS subscription that bypasses dedup.
- ✅ **Event payloads MUST have a Zod schema** in `@tukio/contracts/events/`.
  Parse on consume.
- ✅ **Bump `v<n>`** on any breaking payload change. Old consumers keep
  working on `vN-1` until they're migrated.
- ✅ **Include `correlationId`** in every event. Propagate from the
  triggering HTTP request.
- ❌ **Never `nats.publish()` directly** from a use case.
- ❌ **Never** consume an event without inbox dedup.
- ❌ **Never** reuse a `v<n>` with breaking payload changes.
- ❌ **Never** use `tukio_outbox_dlq` as a dumping ground — DLQ entries
  must be alerted on and triaged.
