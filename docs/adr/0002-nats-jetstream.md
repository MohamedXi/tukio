# ADR-0002: NATS JetStream as message broker

- **Status**: ✅ Accepted
- **Date**: 2026-05-09
- **Deciders**: Ismael (founder), tech lead
- **Tags**: `architecture`, `backend`, `data`

## Context

Tukio requires asynchronous, durable messaging between microservices for:

1. **Booking saga choreography** (5-step flow: BookingRequested → PaymentIntent → Confirmed/Rejected)
2. **Transactional outbox relay** (DB writes + event publish must be atomic — ADR-0007)
3. **Catalog sync to Meilisearch** (listing events → search index updates)
4. **Notification triggers** (booking events → email dispatch via Resend)

Forces in tension:

- **Durability**: events must survive broker restarts and consumer crashes — not fire-and-forget.
- **Simplicity**: a solo founder + small team cannot operate a Kafka cluster or manage ZooKeeper.
- **Cost**: managed Kafka starts at ~€80/month; self-hosted adds operational burden.
- **At-least-once delivery**: the outbox pattern requires reliable re-delivery on consumer failure
  without complex consumer group coordination.
- **Replay**: staging and debugging require the ability to replay events from a given offset.

## Decision

Use **NATS JetStream 2.10** as the sole message broker for all inter-service events. JetStream runs
as a single instance (`-js -sd /data -m 8222`) on the `tukio-data` droplet (Story 0.12, ADR-0015).

Key configuration choices:

- **Stream `TUKIO`**: `subjects: ["tukio.>"]`, `retention: limits`, `storage: file`,
  `max_age: 72h` (3-day replay window). Durable consumers per service.
- **Subject naming**: `<domain>.<entity>.<verb>.v<n>` (e.g., `identity.user.registered.v1`).
  Enforced by lint rule `tukio/event-naming` (Story 0.7).
- **Delivery policy**: `DeliverNew` for live consumers; `DeliverAll` for replay on new deployments.
- **Acknowledgement**: explicit `ack()` in consumer after business logic completes — prevents silent
  message loss on exception.
- **R3 quorum deferred**: single instance for MVP (< 1k events/day). R3 cluster when throughput
  exceeds 10k events/day or RTO requirement drops below 1 min (V1+).

The `@tukio/messaging` package (Story 0.7) wraps the NATS.js client with:

- `NatsJetStreamModule` — NestJS module providing producer + consumer primitives.
- `OutboxRelayService` — polls/listens to the `tukio_outbox` PG table and publishes via JetStream.
- `InboxDedup` — consumer-side idempotency check against `tukio_inbox` table (ADR-0007).

## Consequences

### Positive

- **Low ops overhead**: single Docker container, no ZooKeeper, no Kafka Connect, no Schema Registry.
- **JetStream persistence**: events survive broker restarts; consumers replay from last ack.
- **Cost-efficient**: NATS is open-source; self-hosting adds ~0 € to the €29/month DO budget.
- **At-least-once delivery** natively via JetStream durable consumers.
- **Sub-millisecond latency** on the VPC private network between `tukio-apps` and `tukio-data`.
- **Simple consumer model**: `nats.subscribe()` + explicit ack — no complex consumer group balancing.

### Negative / Trade-offs

- **Single instance = SPOF** for MVP: if `tukio-data` droplet is down, events queue in the outbox
  DB and are replayed once NATS recovers — acceptable for MVP RPO of 24h.
- **No built-in schema registry**: schema evolution relies on versioned event subjects (`.v1`, `.v2`)
  and the `@tukio/contracts` type system — discipline over tooling.
- **Less ecosystem** than Kafka: fewer managed connectors, no Kafka Streams equivalent. Acceptable for
  the tukio event volume at MVP (< 1k events/day).
- **R3 quorum deferred**: a rolling restart of the data droplet causes a brief message gap. Mitigated
  by the transactional outbox (ADR-0007): events already written to PG are replayed post-recovery.

### Neutral

- NATS monitoring at `http://<data-priv-ip>:8222` provides basic stream/consumer metrics without
  Prometheus integration (Pino logs + UptimeRobot cover MVP observability needs).

## Alternatives Considered

### Apache Kafka (self-hosted or Confluent Cloud)

The industry standard for high-throughput event streaming. **Rejected** for MVP:

- Self-hosted: requires 3 ZooKeeper nodes + 3 Kafka brokers minimum for production — €60-120/month
  on DO alone.
- Confluent Cloud: $15/month minimum + egress costs → budget exceeded.
- Operational complexity is an order of magnitude above what a solo team can sustain.
- NATS can be migrated to Kafka when throughput exceeds NATS single-instance limits (>> 1M msg/day).

### RabbitMQ

AMQP 0-9-1, good for task queues. **Rejected**: no native event replay (messages are consumed and
gone), making outbox re-delivery and debugging difficult. Lacks JetStream's durable consumer model.

### AWS SQS + SNS

Managed, cheap at low volume. **Rejected**: introduces AWS vendor lock-in when the entire stack is on
DigitalOcean (ADR-0015). Cross-provider egress adds latency and cost at scale.

### Redis Streams

Lightweight alternative with persistence. **Considered** but rejected: Redis is already in the stack
as a cache/rate-limiter (ADR-0015); using it also as the primary event bus creates a single point of
failure that is harder to reason about. NATS separation of concerns is cleaner.

## References

- [External: https://docs.nats.io/nats-concepts/jetstream — JetStream concepts]
- [Source: Architecture §Messaging layer — line 123]
- [Source: Story 0.7 — @tukio/messaging NatsJetStreamModule + OutboxRelayService]
- [Source: Story 0.12 / ADR-0015 — data droplet hosting NATS]
- [ADR-0007 — Transactional outbox pattern that feeds JetStream]
- [ADR-0006 — Choreographed saga that relies on JetStream for event routing]

## Implementation Notes

- Stream created by `@tukio/messaging` on module init if not already present:
  `js.streams.add({ name: 'TUKIO', subjects: ['tukio.>'], … })`.
- Consumer names follow `<service>-<domain>` pattern: e.g., `booking-svc-identity` consumes
  `identity.user.registered.v1` events.
- Lint rule `tukio/event-naming` rejects subject strings not matching
  `^[a-z]+\.[a-z]+\.[a-z-]+\.v[0-9]+$`.
- Never call `nats.publish()` directly from a use case — always go through `OutboxPublisher`
  (enforced by `tukio/no-direct-event-publish` lint rule).
