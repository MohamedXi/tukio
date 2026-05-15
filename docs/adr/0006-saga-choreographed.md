# ADR-0006: Choreographed saga for booking-payment flow

- **Status**: ✅ Accepted
- **Date**: 2026-05-09
- **Deciders**: Ismael (founder), tech lead
- **Tags**: `architecture`, `backend`

## Context

The booking creation flow spans 4 microservices (`booking-svc`, `payment-svc`, `order-svc`,
`notification-svc`) and must handle partial failures gracefully:

1. Customer requests a booking → `booking-svc` creates a `Booking` in `pending` state.
2. `payment-svc` creates a Stripe PaymentIntent (hold funds but don't capture).
3. Provider confirms/rejects via `booking-svc`.
4. On confirmation: `payment-svc` captures the PaymentIntent; `order-svc` creates the Order.
5. `notification-svc` sends confirmation emails to both customer and provider.

Failure modes to handle:
- Payment fails after booking is created → booking must be cancelled, provider notified.
- Provider rejects → PaymentIntent must be cancelled, customer notified.
- Provider doesn't respond in 48h → automatic rejection, PaymentIntent cancelled.

Forces in tension:

- **Consistency**: all 4 services must eventually reach a consistent final state (confirmed or
  rejected) even if individual steps fail.
- **Simplicity**: a solo team cannot operate a dedicated saga orchestrator service (Temporal) or
  maintain a complex state machine coordinator.
- **Resilience**: no single point of failure in the saga flow — if `booking-svc` is temporarily
  down, other services should not be blocked.
- **Observability**: it must be possible to reconstruct the saga state from events alone.

## Decision

Use **choreographed saga** over orchestrated saga for the booking-payment flow. Each microservice
reacts to events it subscribes to and emits the next event in the chain, with compensating
transactions on failure:

```
booking-svc:        BookingRequested ──────────────────────────────────────────────┐
payment-svc:             └→ PaymentIntentCreated                                   │ (on reject/cancel)
booking-svc:                      └→ BookingPendingProviderConfirmation            │
payment-svc:                               └→ PaymentIntentCaptured (on confirm)   │
order-svc:                                          └→ OrderCreated               │
booking-svc:                                                  └→ BookingConfirmed  │
notification-svc:   (all state changes) → email dispatch                          │
                                                                   ←──────────────┘
Compensations:
  PaymentIntent cancelled  ← BookingRejected | BookingCancelled | PaymentFailed
  Booking cancelled        ← PaymentFailed | ProviderTimeout (48h)
```

Each saga step uses the **transactional outbox** (ADR-0007) to guarantee at-least-once event
delivery. The `correlationId` (set at `BookingRequested` creation) links all saga events together
for observability.

## Consequences

### Positive

- **No orchestrator SPOF**: if `booking-svc` restarts mid-saga, the `notification-svc` is unaffected
  — it simply waits for the `BookingConfirmed` event from the outbox relay.
- **Simple operations**: choreography is implemented as NestJS `@Subscribe()` handlers with outbox
  — no Temporal cluster, no Saga state machine library to operate.
- **Event log = saga state**: the full NATS JetStream event history is the audit trail. Replaying
  events from `BookingRequested` reconstructs the saga state at any point in time.
- **Independent service development**: `order-svc` only needs to know about `PaymentIntentCaptured`
  — it has no dependency on `booking-svc`'s internal state machine.
- **Compensating transactions**: each service implements its own rollback (e.g., `payment-svc`
  cancels the PaymentIntent on `BookingRejected`) — no central rollback coordinator.

### Negative / Trade-offs

- **Distributed state reconstruction**: debugging a stuck saga requires correlating events across
  4 services using `correlationId`. No single dashboard shows the full saga state out of the box.
  Mitigated by structured logs with `correlationId` in every log line and the `booking-svc` aggregate
  state machine as the authoritative saga state.
- **Idempotency discipline**: every consumer must handle duplicate event delivery (ADR-0007 inbox
  dedup) — requires `tukio_inbox` deduplication table in every service.
- **Timeout handling**: the 48h provider confirmation window is a scheduled job in `booking-svc`
  (`SchedulerModule` cron), not a saga orchestrator timeout — simpler but less explicit than
  Temporal's activity timeout model.

### Neutral

- Choreography vs orchestration is primarily an operational vs code complexity tradeoff. Choreography
  distributes complexity into each service's event handler; orchestration centralizes it. Either
  approach can be migrated to the other as complexity grows.

## Alternatives Considered

### Orchestrated saga (Temporal)

A centralized workflow engine manages the entire saga lifecycle — retries, timeouts, compensations.
**Rejected for MVP**:

- Temporal requires a dedicated cluster (Temporal Cloud ~$50/month, or self-hosted on another droplet).
- Development complexity: Temporal workflows are a specialized programming model requiring
  training and specific SDK patterns.
- Over-engineered for MVP booking volume (< 100 bookings/day). Can be introduced in V2+ if the
  choreography becomes unmanageable.

### Saga state machine library (XState, MachineState)

Client-side saga state machine in `booking-svc`. **Partially adopted**: `booking-svc` does maintain
the `Booking` aggregate state machine (6 states). However, this is for the booking domain state
only — the cross-service saga coordination remains choreographed via events.

### Two-phase commit across services

Distributed transaction coordinated by a transaction manager. **Rejected**: no standard transaction
manager supports NestJS + Postgres + Stripe in a single transaction. Would require synchronous
locking across services, defeating the purpose of microservices.

## References

- [Source: Architecture §Saga choreography — line 154]
- [Source: Story 0.7 — @tukio/messaging event infrastructure]
- [Source: Story 4.1 — booking-svc saga state machine]
- [Source: Story 4.2 — order-svc saga consumer]
- [ADR-0007 — Outbox pattern guarantees at-least-once delivery for each saga step]
- [ADR-0002 — NATS JetStream delivers saga events between services]
- [ADR-0004 — booking-svc ≠ order-svc split enables this choreography]

## Implementation Notes

- `correlationId` is set to the `booking.id` (UUID) at `BookingRequested` creation and propagated
  in the `meta.correlationId` field of every subsequent saga event.
- Each service uses `@tukio/messaging InboxDedup` to reject reprocessing of already-handled events:
  `INSERT INTO tukio_inbox (event_id) ON CONFLICT DO NOTHING` → if 0 rows inserted, skip processing.
- The 48h provider timeout is a `@Cron('0 * * * *')` job in `booking-svc` that queries for
  `Booking` entities in `pending_provider_confirmation` state older than 48h and triggers
  `BookingAutoRejected` events.
- Compensating transactions are implemented as use cases: `CancelPaymentIntentUseCase` in
  `payment-svc`, `CancelBookingUseCase` in `booking-svc` — each triggered by the corresponding
  failure event.
