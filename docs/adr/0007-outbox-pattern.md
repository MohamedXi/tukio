# ADR-0007: Transactional outbox + PG LISTEN/NOTIFY relay

- **Status**: ✅ Accepted
- **Date**: 2026-05-09
- **Deciders**: Ismael (founder), tech lead
- **Tags**: `architecture`, `backend`, `data`

## Context

Microservices that both write to a database and publish events face a fundamental distributed systems
problem: if the DB write succeeds but the event publish fails (or vice versa), the system reaches an
inconsistent state. This is the **dual-write problem**.

For tukio.one this is critical in the booking saga (ADR-0006): a `BookingRequested` event that is
lost after the `Booking` row is written leaves the payment flow permanently stalled.

Options for solving dual-write:

1. **Best-effort publish**: write to DB, then publish to NATS. Risk: crash between the two steps
   loses the event permanently.
2. **Two-phase commit (2PC)**: atomic across DB + NATS. No standard 2PC protocol spans Postgres and
   NATS — requires an XA transaction manager not available in this stack.
3. **Transactional outbox**: write the event to a DB table inside the same transaction as the domain
   write. A separate relay process reads the outbox and publishes to NATS, deleting rows on ACK.

Forces:

- **At-least-once delivery**: events must be reliably delivered even if the application crashes
  mid-publish.
- **No distributed transactions**: the tech stack (Postgres + NATS) does not support 2PC.
- **Low latency relay**: the relay must be fast enough to not introduce perceptible lag in the saga
  flow — target < 1s from DB commit to NATS delivery under normal load.
- **Simplicity**: the relay must be operational with zero extra infrastructure (no Debezium, no
  Kafka Connect, no CDC pipeline).

## Decision

Adopt the **transactional outbox pattern** with a PG LISTEN/NOTIFY-based relay and fallback polling,
implemented in `@tukio/messaging` (`OutboxRelayService`, Story 0.7).

**Write path** (in every service use case that emits events):

```typescript
await this.dataSource.transaction(async (manager) => {
  await manager.save(aggregate);                       // 1. persist domain state
  await this.outboxPublisher.publish(manager, event);  // 2. insert into tukio_outbox (same tx)
});
// If the transaction fails, both writes are rolled back atomically.
```

**Relay path** (OutboxRelayService runs in-process per service):

1. Subscribe to `NOTIFY tukio_outbox_new` (PG LISTEN) — woken immediately on INSERT.
2. On wake: `SELECT ... FROM tukio_outbox WHERE status='pending' ORDER BY created_at LIMIT 100 FOR UPDATE SKIP LOCKED`.
3. Publish each event to NATS JetStream; on ACK → `UPDATE status='sent'` + `DELETE`.
4. Fallback polling every 30s in case LISTEN misses a notification (process restart, PG reconnect).

**Consumer deduplication** (InboxDedup, every consumer):

```sql
INSERT INTO tukio_inbox (event_id, consumer, processed_at)
VALUES ($1, $2, NOW())
ON CONFLICT (event_id, consumer) DO NOTHING
```

If 0 rows inserted → event already processed → skip idempotently.

## Consequences

### Positive

- **Atomic write + publish**: DB transaction wraps both domain write and outbox insert — guaranteed
  consistency. If the app crashes after DB commit, the relay republishes on restart.
- **At-least-once delivery** without 2PC or an external coordinator.
- **Zero extra infrastructure**: relay runs as a NestJS `OnModuleInit` worker in every service process.
  No Debezium, no Kafka Connect, no CDC pipeline.
- **Fast relay via PG LISTEN/NOTIFY**: typical latency < 100ms from outbox INSERT to NATS publish
  under normal load.
- **Observable**: outbox table row counts and `status` distribution are a real-time health indicator.
  Pino logs emit `outbox.published` and `outbox.failed` at INFO level.
- **Replay-safe**: `tukio_inbox` deduplication makes consumer processing idempotent — safe to replay
  events for debugging without side effects.

### Negative / Trade-offs

- **Outbox table growth**: published rows must be pruned regularly. `OutboxRelayService` deletes
  `status='sent'` rows after publication; a separate cron cleans `status='failed'` rows older than
  7 days (DLQ-like retention).
- **In-process relay**: the relay shares the service process memory. If the service is under load,
  relay polling competes for resources. Mitigated by `SKIP LOCKED` which makes the SELECT fast.
- **PG LISTEN reliability**: PG LISTEN connections drop on network interruptions. The 30s fallback
  polling ensures recovery.
- **Eventual consistency**: there is a relay lag between DB commit and NATS delivery (< 1s normally,
  up to 30s on fallback polling interval). Saga participants must tolerate this delay.

### Neutral

- The `tukio_outbox` and `tukio_inbox` tables are added to every service DB by a migration in
  Story 0.7 (`AddOutboxInboxTables`). This is standard infrastructure, not business schema.

## Alternatives Considered

### Best-effort publish (write DB then publish to NATS)

Simplest implementation. **Rejected**: crash between DB write and NATS publish loses events
permanently. Unacceptable for a financial saga where a lost `BookingRequested` event leaves a
customer's booking permanently stalled and a Stripe hold uncaptured.

### Change Data Capture (CDC) with Debezium

Reads Postgres WAL and publishes changes to Kafka. **Rejected**: requires a Kafka cluster (out of
budget — ADR-0002), Debezium connector management, and a Kafka Connect cluster. Total added
infrastructure cost: €60-100/month. Extreme overkill for MVP event volume.

### Saga log table (event sourcing)

Full event sourcing where the aggregate state IS the event log. **Considered** but deferred: event
sourcing requires a complete architectural shift (CQRS + event store), adds significant complexity
to reads (projection rebuilding), and the tukio MVP timeline does not allow for this. The outbox
pattern provides the delivery guarantee we need without event sourcing semantics.

### Kafka transactions (exactly-once semantics)

Kafka transactional producers + consumers provide exactly-once delivery. **Rejected**: requires Kafka
(out of budget), and exactly-once is stronger than needed — at-least-once with inbox deduplication
achieves the same effective behavior.

## References

- [External: https://microservices.io/patterns/data/transactional-outbox.html — pattern reference]
- [Source: Architecture §Messaging — outbox/inbox — lines 632-663]
- [Source: Story 0.7 — @tukio/messaging OutboxRelayService + InboxDedup]
- [ADR-0002 — NATS JetStream is the event bus the outbox relay publishes to]
- [ADR-0006 — Each choreographed saga step uses the outbox for its event emission]

## Implementation Notes

- **Schema** (created by Story 0.7 migration in every service DB):
  ```sql
  CREATE TABLE tukio_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_type VARCHAR(100) NOT NULL,
    aggregate_id UUID NOT NULL,
    event_type VARCHAR(200) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ
  );
  CREATE INDEX idx_outbox_pending ON tukio_outbox (status, created_at) WHERE status = 'pending';
  CREATE INDEX idx_outbox_aggregate ON tukio_outbox (aggregate_type, aggregate_id);

  CREATE TABLE tukio_inbox (
    event_id UUID NOT NULL,
    consumer VARCHAR(100) NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (event_id, consumer)
  );
  ```
- **`tukio/no-direct-event-publish` lint rule**: rejects `natsClient.publish()` calls from
  `usecases/` or `domain/` — forces all event emission through `OutboxPublisher`.
- **DLQ**: events in `status='failed'` after 3 retry attempts are flagged in logs for manual
  inspection. A V1+ DLQ stream (`tukio.dlq`) is the planned next step.
