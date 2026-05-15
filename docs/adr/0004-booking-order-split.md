# ADR-0004: booking-svc ≠ order-svc — explicit split from Sprint 0

- **Status**: ✅ Accepted
- **Date**: 2026-05-09
- **Deciders**: Ismael (founder), tech lead
- **Tags**: `architecture`, `backend`

## Context

Event-service marketplaces typically conflate "booking" (availability reservation + agreement to
terms) and "order" (financial record, invoice, line items). For tukio.one the two concepts have
distinct lifecycles and different scaling requirements:

- **Booking**: stateful saga (6 states: `pending` → `confirmed` / `rejected` / `cancelled` /
  `completed` / `disputed`), drives provider availability, tied to calendar + slot management.
- **Order**: immutable financial record, linked to Stripe payment intent, drives invoice generation,
  VAT, and provider payouts. Once created, it only gains entries (refunds, adjustments).

Forces:

- **Separation of concerns**: merging both into `booking-svc` creates a God service with conflicting
  transaction semantics (saga state vs immutable ledger).
- **Independent scaling**: booking state machine receives spikes during provider confirmation windows
  (summer season 3× traffic — NFR38), while order volume is linear and stable.
- **Domain clarity**: in tukio business domain, "booking" = customer intent + provider agreement;
  "order" = financial proof. They have different lifespans, different audit requirements (NFR15).
- **Complexity budget**: splitting adds one service and one saga step (OrderCreated event), but
  avoids a larger future refactor.

## Decision

From Sprint 0, the platform maintains two distinct services:

- **`booking-svc`** (port 4003): owns the booking saga state machine, availability checks, provider
  communication events, cancellation/refund policies. DB: `tukio_booking`. Aggregate: `Booking`.
- **`order-svc`** (port 4004): owns the immutable order record created after payment capture. DB:
  `tukio_order`. Aggregate: `Order`. Receives `payment.intent.captured.v1` event from `payment-svc`
  and creates the order line items.

The saga choreography (ADR-0006) coordinates both services:

```
BookingRequested (booking-svc)
  → PaymentIntentCreated (payment-svc)
  → PaymentIntentCaptured (payment-svc)
  → OrderCreated (order-svc)       ← order-svc creates the Order aggregate
  → BookingConfirmed (booking-svc) ← booking-svc transitions to confirmed
```

## Consequences

### Positive

- **Clear domain boundaries**: booking and order aggregates have distinct lifecycles, different
  consistency requirements, and can be tested in isolation.
- **Independent deployment**: `booking-svc` can be scaled horizontally (peak season) without
  touching `order-svc`.
- **Audit trail**: `tukio_order` is an append-only immutable ledger — meets NFR15 financial audit
  requirements without mixing with mutable booking state.
- **Future-proof**: invoice generation, multi-currency support, provider payout logic can be added
  to `order-svc` without impacting `booking-svc`'s availability management.

### Negative / Trade-offs

- **+1 service to maintain**: 11 services instead of 10, each with its own Postgres DB, migrations,
  and NestJS module graph.
- **Saga complexity**: the choreography adds one extra event step (`PaymentCaptured → OrderCreated`)
  and requires idempotency checks in `order-svc` (ADR-0007 inbox dedup).
- **Cross-service queries in dashboard**: the seller dashboard needs both booking state and order
  amount — requires API composition at gateway-api level (two HTTP calls, combined in response DTO).

### Neutral

- The split aligns with how Stripe models payments (PaymentIntent is separate from the Stripe
  Invoice / Transfer objects), making the Stripe integration in `payment-svc` more natural.

## Alternatives Considered

### Single `booking-order-svc`

Combine both domains into one service with one database. **Rejected**: creates a God service where
saga state machine updates happen in the same transaction as financial record creation — conflicting
transaction semantics. Also blocks independent scaling of booking (high-spike) vs order (linear).

### `order-svc` as a module inside `booking-svc`

NestJS feature module separation within the same process. **Rejected**: NestJS modules in the same
process share the same database connection and memory — no real isolation. This is not a microservice
split, just a code organization concern.

## References

- [Source: PRD §FR34-66 — Booking lifecycle, 6 states, cancellation + refund policies]
- [Source: Architecture §Service split rationale]
- [Source: Story 4.1 — booking-svc saga state machine implementation]
- [Source: Story 4.2 — order-svc saga consumer]
- [ADR-0006 — Choreographed saga coordinates booking-svc ↔ order-svc]
- [ADR-0007 — Outbox pattern ensures events are delivered reliably between the two services]

## Implementation Notes

- `booking-svc` aggregate `Booking` exposes domain events via `domainEvents` array — emitted through
  `OutboxPublisher` after the state transition is persisted.
- `order-svc` consumes `payment.intent.captured.v1` and creates an `Order` aggregate. The
  `tukio_inbox` table deduplicates replayed events (ADR-0007).
- The seller dashboard endpoint `GET /seller/bookings/:id/order-summary` on `gateway-api` makes two
  downstream calls: `booking-svc` (state) + `order-svc` (amount, payment reference) and composes
  the response DTO in the gateway controller.
