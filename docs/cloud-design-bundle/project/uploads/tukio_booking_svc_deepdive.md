# Tukio — booking-svc Deep Dive

> Architecture détaillée du service `booking-svc` — le service le plus critique et le plus complexe du système.
> À lire après : `Research_Report.md` + `tukio_product_tech_alignment.md` + `tukio_booking_paiements_deepdive.md`
> Audience : tech lead, devs backend qui implémenteront ce service

---

## Sommaire

- [A. Service responsibility](#a-service-responsibility)
- [B. Bounded context boundaries](#b-bounded-context-boundaries)
- [C. Domain model](#c-domain-model)
- [D. Use cases inventory](#d-use-cases-inventory)
- [E. Folder tree (full)](#e-folder-tree-full)
- [F. Key files (sample implementations)](#f-key-files-sample-implementations)
- [G. The booking-payment saga](#g-the-booking-payment-saga)
- [H. Concurrency & race conditions](#h-concurrency--race-conditions)
- [I. Failure modes & compensations](#i-failure-modes--compensations)
- [J. Testing strategy](#j-testing-strategy)
- [K. Operational concerns](#k-operational-concerns)
- [L. Open questions](#l-open-questions)

---

## A. Service responsibility

### A.1 What booking-svc owns

`booking-svc` is the system of record for the **booking lifecycle** — from "a customer wants to reserve a service on these dates" all the way to "the event happened, the pro got paid, the customer left a review".

Concrete responsibilities:

1. **Slot reservation** — atomic reservation of inventory units for a date range, with conflict detection.
2. **Booking lifecycle state machine** — `requested → quoted → accepted → confirmed → completed / cancelled`.
3. **Pro decision workflow** — accept, refuse, request modification, with timeout management (48 h default).
4. **Cancellation policy enforcement** — apply the correct refund percentage based on the booking's policy and current date.
5. **Compensation actions** — release slots when payment fails or booking is cancelled downstream.
6. **Booking-side saga participation** — emit and consume NATS events to coordinate with `order-svc` and `payment-svc`.

### A.2 What booking-svc does NOT own

Equally important to be clear about what's outside scope:

- ❌ **Payment processing** — `payment-svc` owns Stripe integration. `booking-svc` only knows "payment succeeded" or "payment failed" via events.
- ❌ **Cart & checkout UX** — `order-svc` owns the cart and the order creation. A booking only exists *after* an order is placed.
- ❌ **Invoice generation** — `order-svc` produces the PDF invoices.
- ❌ **Listing details** — `catalog-svc` owns service titles, prices, photos, descriptions. `booking-svc` only stores a snapshot at booking time.
- ❌ **Customer/pro identity** — `identity-svc` owns user profiles. `booking-svc` only stores user IDs (Keycloak `sub` UUIDs).
- ❌ **Messaging between customer and pro** — `messaging-svc` owns the chat threads (created on booking confirmation).
- ❌ **Reviews** — `review-svc` owns reviews. `booking-svc` triggers `booking.completed.v1` which `review-svc` consumes to enable the review window.
- ❌ **Availability / calendar UI** — `catalog-svc` owns the availability rules and the calendar. `booking-svc` *queries* `catalog-svc` (sync) to check availability before reserving a slot, and *emits* an event when a slot is taken so `catalog-svc` can update its read model.

### A.3 Datastore

- **Primary**: PostgreSQL database `tukio_booking`, owned exclusively by this service.
- **No reads or writes** to other services' databases. Period.

### A.4 Events emitted (publisher contract)

```
booking.requested.v1          # customer asked for a booking, awaiting pro response
booking.quoted.v1             # pro proposed a custom price (V1)
booking.accepted.v1           # pro accepted the request (triggers payment capture)
booking.refused.v1            # pro refused (triggers refund/cancel)
booking.timed_out.v1          # 48h elapsed without pro response
booking.confirmed.v1          # payment succeeded, booking is firm
booking.completed.v1          # event date passed, booking fulfilled
booking.cancelled.v1          # cancelled by client/pro/system
booking.modified.v1           # changes accepted by both parties (V1)
booking.disputed.v1           # dispute opened
booking.slot_released.v1      # availability slot freed (compensation event)
```

### A.5 Events consumed (subscriber contract)

```
order.paid.v1                 # from order-svc → mark booking confirmed
order.cancelled.v1            # from order-svc → release slot
payment.failed.v1             # from payment-svc → mark booking refused/cancelled
payment.refunded.v1           # from payment-svc → log + analytics
identity.user.suspended.v1    # from identity-svc → flag bookings of suspended users
catalog.listing.unpublished.v1 # from catalog-svc → flag bookings of unpublished listings
```

---

## B. Bounded context boundaries

### B.1 Sync calls (HTTP via gateway-api)

`booking-svc` exposes a REST API. All these endpoints are reached **via `gateway-api`** (defence in depth: `booking-svc` also validates the JWT, but the gateway is the only public surface).

```
POST   /v1/bookings                          # create a booking request
GET    /v1/bookings/:id                      # fetch booking detail
GET    /v1/bookings                          # list bookings (with filters: customer, pro, status, dates)
POST   /v1/bookings/:id/accept               # pro accepts a request
POST   /v1/bookings/:id/refuse               # pro refuses a request
POST   /v1/bookings/:id/cancel               # client or pro cancels
POST   /v1/bookings/:id/modify               # propose modification (V1)
POST   /v1/bookings/:id/confirm-modification # accept proposed modification (V1)
GET    /v1/bookings/:id/cancellation-impact  # compute refund amount for current date
```

### B.2 Sync calls (out)

`booking-svc` makes **one** synchronous call out: to `catalog-svc` to check availability before creating a booking. This is intentional — we want immediate feedback to the customer if dates aren't available.

```
GET catalog-svc/internal/listings/:id/availability?from=...&to=...&qty=...
```

For everything else, we use async events.

### B.3 Async events (NATS JetStream)

cf. §A.4 and §A.5 above.

### B.4 Boundaries cheat sheet

| Concern | Source of truth | How booking-svc gets it |
|---------|-----------------|--------------------------|
| Listing details (price, title) | `catalog-svc` | Snapshot at booking time (stored in booking row) |
| Availability | `catalog-svc` | Sync API call before reservation, then async event after |
| Customer identity | `identity-svc` (mirrored from Keycloak) | Just the `customerId` (UUID); resolve via gateway aggregation if needed |
| Pro identity | `identity-svc` | Just the `providerId` |
| Payment status | `payment-svc` | Async events (`payment.captured.v1`, `payment.failed.v1`) |
| Order/cart | `order-svc` | Async events; the booking row stores `orderId` for correlation |

---

## C. Domain model

### C.1 Aggregates

`booking-svc` has **one** primary aggregate root: `Booking`. Everything else is contained inside it (value objects, child entities) or is a side aggregate with its own consistency boundary.

```
Booking (aggregate root)
├── id (BookingId)
├── customerId (UserId)
├── providerId (UserId)
├── listingSnapshot (ListingSnapshot — VO)
├── period (DateRange — VO)
├── quantity (number)
├── pricing (Pricing — VO)
├── options (BookingOption[])
├── deliveryAddress (Address — VO)
├── status (BookingStatus — enum)
├── cancellationPolicy (CancellationPolicy — enum)
├── timeline (TimelineEvent[] — append-only audit log)
├── orderId (OrderId — set after order-svc creates the order)
├── correlationId (string — saga correlation)
├── createdAt, updatedAt (Date)
└── timeoutAt (Date — when pro response deadline expires)

Side aggregate (consistency boundary on its own):
SlotReservation
├── id
├── listingId
├── period
├── quantity
├── bookingId
├── status (active | released)
└── createdAt
```

### C.2 Why a separate `SlotReservation` aggregate?

`SlotReservation` is the unit that prevents double-booking. It has its own consistency boundary because:

- Its lifecycle is **shorter** than the booking (released on cancellation/refusal/timeout)
- Its **invariant** is independent: "no two active reservations overlap on the same listing+period beyond inventory quantity"
- Multiple bookings might compete for the same slot; the reservation acts as the lock
- In the future (V1+), we may have `SlotReservation` *without* a `Booking` (for pre-booking holds, options 48 h)

The `Booking` aggregate references the `SlotReservation` by ID but doesn't contain it.

### C.3 Status state machine

```
                    ┌──────────────────────────────────────────────┐
                    │                                              │
                    │           ┌──────────────────┐               │
   POST /bookings   │           │ slot reservation │               │
   ─────────────────┼──────────▶│   created        │               │
                    │           └────────┬─────────┘               │
                    │                    │                          │
                    │                    ▼                          │
                    │           ┌────────────────────┐              │
                    │           │ pending_pro_       │              │
                    │           │ acceptance         │              │
                    │           └─┬──────────┬───────┘              │
                    │             │          │                       │
                    │   accept    │          │  refuse / timeout    │
                    │             ▼          ▼                       │
                    │  ┌────────────────┐  ┌──────────────┐         │
                    │  │ accepted       │  │ refused      │         │
                    │  │ (capturing $)  │  │ /timed_out   │         │
                    │  └────┬───────────┘  └──────┬───────┘         │
                    │       │                     │                  │
                    │       │ payment.captured    │ release slot     │
                    │       ▼                     ▼                  │
                    │  ┌────────────────┐  ┌──────────────┐         │
                    │  │ confirmed      │  │ cancelled    │         │
                    │  └────┬───────────┘  └──────────────┘         │
                    │       │                                        │
                    │       │ event date passes                      │
                    │       ▼                                        │
                    │  ┌────────────────┐                            │
                    │  │ completed      │                            │
                    │  └────────────────┘                            │
                    │                                                │
                    │  Branches: cancelled_by_client,                │
                    │            cancelled_by_pro,                   │
                    │            disputed (frozen)                   │
                    │                                                │
                    └────────────────────────────────────────────────┘
```

### C.4 Status enum (canonical)

```typescript
export enum BookingStatus {
  // Pre-acceptance
  PENDING_PRO_ACCEPTANCE = 'pending_pro_acceptance',

  // Pro decided
  ACCEPTED = 'accepted',                 // pro said yes, awaiting payment capture
  REFUSED = 'refused',                   // pro said no
  TIMED_OUT = 'timed_out',               // 48h elapsed without response

  // Payment outcome
  CONFIRMED = 'confirmed',               // payment captured, booking is firm
  PAYMENT_FAILED = 'payment_failed',     // payment failed after acceptance (rare)

  // Lifecycle
  COMPLETED = 'completed',               // event date passed
  CANCELLED_BY_CLIENT = 'cancelled_by_client',
  CANCELLED_BY_PRO = 'cancelled_by_pro',
  CANCELLED_BY_SYSTEM = 'cancelled_by_system',  // e.g. listing unpublished

  // Special
  DISPUTED = 'disputed',                 // dispute opened, funds frozen
  MODIFIED = 'modified',                 // V1 — modification accepted
}
```

### C.5 Invariants enforced by the domain

These are validated **inside the aggregate** (in pure TypeScript, no infrastructure):

1. A booking's `period.from` must be ≥ today + listing's `leadTimeDays` (snapshot value)
2. A booking's `period.to` must be > `period.from`
3. A booking's `quantity` must be ≥ listing's `minQuantity` and ≤ `maxQuantity`
4. Status transitions must follow the state machine (no jumping from `pending_pro_acceptance` directly to `completed`)
5. Once `confirmed`, the booking cannot be modified (only cancelled, with policy applied)
6. The `cancellationPolicy` is locked at booking creation (snapshot)
7. A `SlotReservation` cannot exceed the listing's `totalInventory` minus already-reserved quantity for the period

### C.6 Value objects

Pure data, immutable, equality by value:

```typescript
class DateRange {
  constructor(readonly from: Date, readonly to: Date) {
    if (to <= from) throw new Error('Invalid date range');
  }
  durationDays(): number { /* ... */ }
  overlaps(other: DateRange): boolean { /* ... */ }
}

class Pricing {
  constructor(
    readonly subtotalCents: number,
    readonly optionsCents: number,
    readonly deliveryCents: number,
    readonly currency: 'EUR'
  ) {}
  totalCents(): number {
    return this.subtotalCents + this.optionsCents + this.deliveryCents;
  }
}

class ListingSnapshot {
  constructor(
    readonly listingId: string,
    readonly title: string,
    readonly providerId: string,
    readonly pricingMode: 'unit' | 'forfait' | 'quote',
    readonly leadTimeDays: number,
    readonly cancellationPolicy: CancellationPolicy,
    readonly capturedAt: Date
  ) {}
}

class Address {
  constructor(
    readonly street: string,
    readonly postalCode: string,
    readonly city: string,
    readonly country: 'FR',
    readonly geo?: { lat: number; lng: number }
  ) {}
}
```

### C.7 Cancellation policy

```typescript
enum CancellationPolicyType {
  FLEXIBLE = 'flexible',
  STANDARD = 'standard',
  STRICT = 'strict',
}

interface CancellationPolicy {
  type: CancellationPolicyType;
  refundSchedule: RefundScheduleEntry[];
}

interface RefundScheduleEntry {
  daysBeforeEvent: number;
  refundPercentage: number;
}

// Standard policy (default):
const STANDARD_POLICY: CancellationPolicy = {
  type: CancellationPolicyType.STANDARD,
  refundSchedule: [
    { daysBeforeEvent: 30, refundPercentage: 100 },
    { daysBeforeEvent: 15, refundPercentage: 50 },
    { daysBeforeEvent: 7, refundPercentage: 25 },
    { daysBeforeEvent: 0, refundPercentage: 0 },
  ],
};
```

The policy is **a snapshot at booking creation**. If the pro changes their policy later, existing bookings are unaffected.

---

## D. Use cases inventory

The Pretre proxy pattern requires one use case class per business operation. Here's the full list for `booking-svc` (MVP scope unless tagged V1).

### D.1 Customer-initiated use cases

| Use case | Triggered by | Inputs | Outputs / events |
|----------|--------------|--------|--------------------|
| `RequestBookingUseCase` | `POST /v1/bookings` (customer) | customerId, listingId, period, qty, options, deliveryAddress | Booking row created, `booking.requested.v1` emitted |
| `CancelBookingUseCase` | `POST /v1/bookings/:id/cancel` (customer or pro) | bookingId, actorId, reason | Status updated, refund computed, `booking.cancelled.v1` emitted |
| `GetCancellationImpactUseCase` | `GET /v1/bookings/:id/cancellation-impact` (customer) | bookingId | Refund amount + percentage at current date |

### D.2 Pro-initiated use cases

| Use case | Triggered by | Inputs | Outputs / events |
|----------|--------------|--------|--------------------|
| `AcceptBookingUseCase` | `POST /v1/bookings/:id/accept` (pro) | bookingId, providerId, optionalMessage | Status → `accepted`, `booking.accepted.v1` emitted |
| `RefuseBookingUseCase` | `POST /v1/bookings/:id/refuse` (pro) | bookingId, providerId, reason, optionalMessage | Status → `refused`, slot released, `booking.refused.v1` emitted |
| `QuoteBookingUseCase` *(V1)* | `POST /v1/bookings/:id/quote` (pro) | bookingId, providerId, customPricing | Status → `quoted`, `booking.quoted.v1` emitted |

### D.3 System-initiated use cases (event consumers)

| Use case | Triggered by event | Action |
|----------|---------------------|--------|
| `OnOrderPaidUseCase` | `order.paid.v1` | Mark booking `confirmed`, emit `booking.confirmed.v1` |
| `OnOrderCancelledUseCase` | `order.cancelled.v1` | Mark booking `cancelled`, release slot |
| `OnPaymentFailedUseCase` | `payment.failed.v1` | Mark booking `payment_failed`, release slot, alert admin |
| `OnListingUnpublishedUseCase` | `catalog.listing.unpublished.v1` | If active future bookings exist, flag them and notify |
| `OnUserSuspendedUseCase` | `identity.user.suspended.v1` | Flag bookings, alert admin |

### D.4 Scheduled use cases (cron jobs)

| Use case | Schedule | Action |
|----------|----------|--------|
| `TimeoutPendingBookingsUseCase` | Every 5 min | Find bookings in `pending_pro_acceptance` with `timeoutAt < now()`, transition to `timed_out`, release slot, emit event |
| `CompleteFinishedBookingsUseCase` | Every hour | Find bookings in `confirmed` with `period.to < now()`, transition to `completed`, emit event |
| `ReconciliationUseCase` | Daily | Compare bookings vs Stripe payment intents, alert on divergence (cf. R12 in alignment doc) |

### D.5 Internal/admin use cases

| Use case | Triggered by | Action |
|----------|--------------|--------|
| `GetBookingDetailUseCase` | `GET /v1/bookings/:id` | Return booking detail (RBAC: customer, pro, or admin) |
| `ListBookingsUseCase` | `GET /v1/bookings` | List bookings with filters |
| `MarkDisputedUseCase` (admin) | `POST /v1/admin/bookings/:id/dispute` | Status → `disputed`, freeze refunds |
| `ResolveDisputeUseCase` (admin) | `POST /v1/admin/bookings/:id/resolve-dispute` | Apply manual decision |

**Total**: ~17 use cases in MVP. That's the right granularity — one class per business operation.

---

## E. Folder tree (full)

Following the pattern from `Research_Report.md` §5.2, applied to `booking-svc`:

```
booking-svc/
├─ src/
│  ├─ main.ts
│  ├─ app.module.ts
│  │
│  ├─ domain/                                       # pure TypeScript, no NestJS imports
│  │  ├─ model/
│  │  │  ├─ booking.ts                              # aggregate root
│  │  │  ├─ booking-status.ts                       # enum
│  │  │  ├─ slot-reservation.ts                     # side aggregate
│  │  │  ├─ cancellation-policy.ts                  # VO + types
│  │  │  ├─ pricing.ts                              # VO
│  │  │  ├─ date-range.ts                           # VO
│  │  │  ├─ address.ts                              # VO
│  │  │  ├─ listing-snapshot.ts                     # VO
│  │  │  └─ timeline-event.ts                       # entity (audit log)
│  │  ├─ ports/                                     # interfaces + Symbol tokens
│  │  │  ├─ booking.repository.ts
│  │  │  ├─ slot-reservation.repository.ts
│  │  │  ├─ availability.checker.ts                 # outbound to catalog-svc
│  │  │  ├─ event.publisher.ts                      # outbound to NATS
│  │  │  ├─ idempotency.store.ts
│  │  │  ├─ logger.ts
│  │  │  └─ clock.ts
│  │  ├─ service/                                   # domain services (stateless)
│  │  │  ├─ refund-calculator.ts                    # applies cancellation policy
│  │  │  └─ availability-validator.ts
│  │  └─ exception/
│  │     ├─ booking-not-found.exception.ts
│  │     ├─ invalid-status-transition.exception.ts
│  │     ├─ slot-unavailable.exception.ts
│  │     ├─ unauthorized-actor.exception.ts
│  │     └─ booking-already-cancelled.exception.ts
│  │
│  ├─ usecases/
│  │  ├─ request-booking.usecase.ts
│  │  ├─ accept-booking.usecase.ts
│  │  ├─ refuse-booking.usecase.ts
│  │  ├─ cancel-booking.usecase.ts
│  │  ├─ get-booking-detail.usecase.ts
│  │  ├─ list-bookings.usecase.ts
│  │  ├─ get-cancellation-impact.usecase.ts
│  │  │
│  │  ├─ on-order-paid.usecase.ts                   # consumer
│  │  ├─ on-order-cancelled.usecase.ts              # consumer
│  │  ├─ on-payment-failed.usecase.ts               # consumer
│  │  ├─ on-listing-unpublished.usecase.ts          # consumer
│  │  ├─ on-user-suspended.usecase.ts               # consumer
│  │  │
│  │  ├─ timeout-pending-bookings.usecase.ts        # cron
│  │  ├─ complete-finished-bookings.usecase.ts      # cron
│  │  ├─ reconciliation.usecase.ts                  # cron
│  │  │
│  │  ├─ mark-disputed.usecase.ts                   # admin
│  │  └─ resolve-dispute.usecase.ts                 # admin
│  │
│  └─ infrastructure/
│     ├─ config/
│     │  ├─ environment-config.module.ts
│     │  └─ environment-config.service.ts
│     │
│     ├─ persistence/
│     │  ├─ typeorm.module.ts
│     │  ├─ entities/
│     │  │  ├─ booking.entity.ts
│     │  │  ├─ slot-reservation.entity.ts
│     │  │  ├─ timeline-event.entity.ts
│     │  │  ├─ outbox.entity.ts
│     │  │  └─ inbox.entity.ts
│     │  ├─ repositories/
│     │  │  ├─ typeorm-booking.repository.ts
│     │  │  └─ typeorm-slot-reservation.repository.ts
│     │  ├─ system-clock.ts
│     │  ├─ pg-idempotency.store.ts
│     │  └─ migrations/
│     │     ├─ 1715000000000-init.ts
│     │     ├─ 1715000010000-add-outbox.ts
│     │     └─ 1715000020000-add-inbox.ts
│     │
│     ├─ http-clients/
│     │  └─ catalog-availability.client.ts          # implements AvailabilityChecker
│     │
│     ├─ messaging/
│     │  ├─ nats.module.ts
│     │  ├─ nats.publisher.ts                       # implements EventPublisher (outbox-aware)
│     │  ├─ outbox.relay.ts                         # PG LISTEN/NOTIFY → NATS
│     │  └─ consumers/
│     │     ├─ order.consumer.ts
│     │     ├─ payment.consumer.ts
│     │     ├─ catalog.consumer.ts
│     │     └─ identity.consumer.ts
│     │
│     ├─ scheduler/
│     │  └─ scheduled-jobs.service.ts               # uses @nestjs/schedule
│     │
│     ├─ http/
│     │  ├─ controllers.module.ts
│     │  ├─ controllers/
│     │  │  ├─ booking.controller.ts                # customer & pro endpoints
│     │  │  └─ admin-booking.controller.ts          # admin endpoints
│     │  ├─ dto/
│     │  │  ├─ request-booking.dto.ts
│     │  │  ├─ accept-booking.dto.ts
│     │  │  ├─ refuse-booking.dto.ts
│     │  │  ├─ cancel-booking.dto.ts
│     │  │  └─ list-bookings.query.dto.ts
│     │  ├─ presenters/
│     │  │  ├─ booking.presenter.ts
│     │  │  └─ cancellation-impact.presenter.ts
│     │  ├─ guards/
│     │  │  ├─ keycloak-jwt.guard.ts
│     │  │  └─ roles.guard.ts
│     │  └─ decorators/
│     │     ├─ current-actor.decorator.ts
│     │     └─ roles.decorator.ts
│     │
│     ├─ logger/
│     │  ├─ logger.module.ts
│     │  └─ pino-logger.service.ts
│     │
│     ├─ exception/
│     │  ├─ all-exceptions.filter.ts
│     │  ├─ domain-exception.filter.ts              # maps domain exceptions → HTTP
│     │  └─ exceptions.module.ts
│     │
│     └─ usecases-proxy/
│        └─ usecases-proxy.module.ts                # the central wiring
│
├─ test/
│  ├─ unit/
│  │  ├─ usecases/
│  │  │  ├─ request-booking.usecase.spec.ts
│  │  │  ├─ accept-booking.usecase.spec.ts
│  │  │  ├─ refuse-booking.usecase.spec.ts
│  │  │  ├─ cancel-booking.usecase.spec.ts
│  │  │  └─ ... (one spec per use case)
│  │  └─ domain/
│  │     ├─ booking.spec.ts                         # state machine tests
│  │     ├─ refund-calculator.spec.ts
│  │     └─ date-range.spec.ts
│  │
│  ├─ integration/
│  │  ├─ booking.repository.spec.ts                 # against testcontainers PG
│  │  └─ slot-reservation.repository.spec.ts
│  │
│  ├─ contract/
│  │  ├─ provider-pact.spec.ts                     # verify contracts against gateway
│  │  └─ event-schemas.spec.ts                     # validate emitted events vs JSON schema
│  │
│  ├─ chaos/
│  │  └─ saga-failures.spec.ts                     # randomly fail NATS during saga
│  │
│  └─ e2e/
│     └─ booking-flow.e2e.spec.ts                  # full happy path with supertest
│
├─ Dockerfile
├─ tsconfig.json
├─ nest-cli.json
└─ package.json
```

---

## F. Key files (sample implementations)

### F.1 `domain/model/booking.ts` (aggregate root)

```typescript
import { BookingStatus } from './booking-status';
import { ListingSnapshot } from './listing-snapshot';
import { DateRange } from './date-range';
import { Pricing } from './pricing';
import { Address } from './address';
import { CancellationPolicy } from './cancellation-policy';
import { TimelineEvent, TimelineEventType } from './timeline-event';
import { InvalidStatusTransitionException } from '../exception/invalid-status-transition.exception';
import { BookingAlreadyCancelledException } from '../exception/booking-already-cancelled.exception';
import { UnauthorizedActorException } from '../exception/unauthorized-actor.exception';

export interface BookingProps {
  id: string;
  customerId: string;
  providerId: string;
  listingSnapshot: ListingSnapshot;
  period: DateRange;
  quantity: number;
  pricing: Pricing;
  options: BookingOption[];
  deliveryAddress: Address;
  status: BookingStatus;
  cancellationPolicy: CancellationPolicy;
  timeline: TimelineEvent[];
  orderId: string | null;
  slotReservationId: string;
  correlationId: string;
  timeoutAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BookingOption {
  optionId: string;
  label: string;
  priceCents: number;
  quantity: number;
}

export class Booking {
  private constructor(private props: BookingProps) {}

  // ─── Factory ───────────────────────────────────────────────────────

  static create(input: {
    id: string;
    customerId: string;
    providerId: string;
    listingSnapshot: ListingSnapshot;
    period: DateRange;
    quantity: number;
    pricing: Pricing;
    options: BookingOption[];
    deliveryAddress: Address;
    cancellationPolicy: CancellationPolicy;
    slotReservationId: string;
    correlationId: string;
    now: Date;
    timeoutHours?: number;
  }): Booking {
    // Domain invariants
    if (input.quantity < 1) throw new Error('Quantity must be ≥ 1');
    if (input.period.from < input.now) throw new Error('Cannot book in the past');

    const timeoutHours = input.timeoutHours ?? 48;
    const timeoutAt = new Date(input.now.getTime() + timeoutHours * 3600_000);

    return new Booking({
      ...input,
      status: BookingStatus.PENDING_PRO_ACCEPTANCE,
      timeline: [TimelineEvent.created(input.now)],
      orderId: null,
      timeoutAt,
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  static fromPersistence(props: BookingProps): Booking {
    return new Booking(props);
  }

  // ─── Behaviors ─────────────────────────────────────────────────────

  acceptByPro(actorId: string, now: Date, message?: string): void {
    this.assertActorIsProvider(actorId);
    this.assertStatusIs(BookingStatus.PENDING_PRO_ACCEPTANCE);

    this.props.status = BookingStatus.ACCEPTED;
    this.props.timeoutAt = null; // no more timeout
    this.props.timeline.push(
      TimelineEvent.acceptedByPro(now, actorId, message),
    );
    this.props.updatedAt = now;
  }

  refuseByPro(actorId: string, reason: string, now: Date, message?: string): void {
    this.assertActorIsProvider(actorId);
    this.assertStatusIs(BookingStatus.PENDING_PRO_ACCEPTANCE);

    this.props.status = BookingStatus.REFUSED;
    this.props.timeoutAt = null;
    this.props.timeline.push(
      TimelineEvent.refusedByPro(now, actorId, reason, message),
    );
    this.props.updatedAt = now;
  }

  timeOut(now: Date): void {
    this.assertStatusIs(BookingStatus.PENDING_PRO_ACCEPTANCE);

    this.props.status = BookingStatus.TIMED_OUT;
    this.props.timeoutAt = null;
    this.props.timeline.push(TimelineEvent.timedOut(now));
    this.props.updatedAt = now;
  }

  confirm(orderId: string, now: Date): void {
    this.assertStatusIs(BookingStatus.ACCEPTED);

    this.props.status = BookingStatus.CONFIRMED;
    this.props.orderId = orderId;
    this.props.timeline.push(TimelineEvent.confirmed(now, orderId));
    this.props.updatedAt = now;
  }

  cancel(actorId: string, actorRole: 'customer' | 'pro' | 'system', reason: string, now: Date): void {
    if (this.isTerminalStatus()) {
      throw new BookingAlreadyCancelledException(this.props.id);
    }

    let newStatus: BookingStatus;
    if (actorRole === 'customer') {
      this.assertActorIsCustomer(actorId);
      newStatus = BookingStatus.CANCELLED_BY_CLIENT;
    } else if (actorRole === 'pro') {
      this.assertActorIsProvider(actorId);
      newStatus = BookingStatus.CANCELLED_BY_PRO;
    } else {
      newStatus = BookingStatus.CANCELLED_BY_SYSTEM;
    }

    this.props.status = newStatus;
    this.props.timeline.push(
      TimelineEvent.cancelled(now, actorId, actorRole, reason),
    );
    this.props.updatedAt = now;
  }

  complete(now: Date): void {
    this.assertStatusIs(BookingStatus.CONFIRMED);
    if (now < this.props.period.to) {
      throw new Error('Cannot complete a booking before its end date');
    }

    this.props.status = BookingStatus.COMPLETED;
    this.props.timeline.push(TimelineEvent.completed(now));
    this.props.updatedAt = now;
  }

  markPaymentFailed(now: Date, reason: string): void {
    this.assertStatusIs(BookingStatus.ACCEPTED);

    this.props.status = BookingStatus.PAYMENT_FAILED;
    this.props.timeline.push(TimelineEvent.paymentFailed(now, reason));
    this.props.updatedAt = now;
  }

  // ─── Queries ───────────────────────────────────────────────────────

  isTerminalStatus(): boolean {
    return [
      BookingStatus.REFUSED,
      BookingStatus.TIMED_OUT,
      BookingStatus.CANCELLED_BY_CLIENT,
      BookingStatus.CANCELLED_BY_PRO,
      BookingStatus.CANCELLED_BY_SYSTEM,
      BookingStatus.PAYMENT_FAILED,
      BookingStatus.COMPLETED,
    ].includes(this.props.status);
  }

  isCancellable(): boolean {
    return [
      BookingStatus.PENDING_PRO_ACCEPTANCE,
      BookingStatus.ACCEPTED,
      BookingStatus.CONFIRMED,
    ].includes(this.props.status);
  }

  hasTimedOut(now: Date): boolean {
    if (this.props.status !== BookingStatus.PENDING_PRO_ACCEPTANCE) return false;
    if (!this.props.timeoutAt) return false;
    return now >= this.props.timeoutAt;
  }

  toPrimitives(): BookingProps {
    return {
      ...this.props,
      timeline: [...this.props.timeline],
      options: [...this.props.options],
    };
  }

  // ─── Getters ───────────────────────────────────────────────────────

  get id() { return this.props.id; }
  get customerId() { return this.props.customerId; }
  get providerId() { return this.props.providerId; }
  get status() { return this.props.status; }
  get correlationId() { return this.props.correlationId; }
  get period() { return this.props.period; }
  get pricing() { return this.props.pricing; }
  get cancellationPolicy() { return this.props.cancellationPolicy; }
  get slotReservationId() { return this.props.slotReservationId; }

  // ─── Internal guards ───────────────────────────────────────────────

  private assertActorIsProvider(actorId: string): void {
    if (actorId !== this.props.providerId) {
      throw new UnauthorizedActorException(
        `Actor ${actorId} is not the provider of booking ${this.props.id}`,
      );
    }
  }

  private assertActorIsCustomer(actorId: string): void {
    if (actorId !== this.props.customerId) {
      throw new UnauthorizedActorException(
        `Actor ${actorId} is not the customer of booking ${this.props.id}`,
      );
    }
  }

  private assertStatusIs(expected: BookingStatus): void {
    if (this.props.status !== expected) {
      throw new InvalidStatusTransitionException(
        `Booking ${this.props.id} is in status ${this.props.status}, expected ${expected}`,
      );
    }
  }
}
```

### F.2 `domain/service/refund-calculator.ts`

```typescript
import { Booking } from '../model/booking';
import { CancellationPolicy } from '../model/cancellation-policy';

export class RefundCalculator {
  /**
   * Compute the refund amount (in cents) for a booking cancellation
   * occurring at `cancellationDate`.
   */
  computeRefund(booking: Booking, cancellationDate: Date): {
    amountCents: number;
    percentage: number;
    daysBeforeEvent: number;
  } {
    const eventStart = booking.period.from;
    const msPerDay = 86_400_000;
    const daysBeforeEvent = Math.floor(
      (eventStart.getTime() - cancellationDate.getTime()) / msPerDay,
    );

    const percentage = this.findApplicablePercentage(
      booking.cancellationPolicy,
      daysBeforeEvent,
    );

    const totalCents = booking.pricing.totalCents();
    const amountCents = Math.floor((totalCents * percentage) / 100);

    return { amountCents, percentage, daysBeforeEvent };
  }

  private findApplicablePercentage(
    policy: CancellationPolicy,
    daysBeforeEvent: number,
  ): number {
    // Schedule is sorted descending by daysBeforeEvent
    // Find the first entry where daysBeforeEvent ≥ entry.daysBeforeEvent
    const sorted = [...policy.refundSchedule].sort(
      (a, b) => b.daysBeforeEvent - a.daysBeforeEvent,
    );
    for (const entry of sorted) {
      if (daysBeforeEvent >= entry.daysBeforeEvent) {
        return entry.refundPercentage;
      }
    }
    return 0; // Past the event
  }
}
```

### F.3 `usecases/request-booking.usecase.ts`

```typescript
import { ulid } from 'ulid';
import { BookingRepository } from '../domain/ports/booking.repository';
import { SlotReservationRepository } from '../domain/ports/slot-reservation.repository';
import { AvailabilityChecker } from '../domain/ports/availability.checker';
import { EventPublisher } from '../domain/ports/event.publisher';
import { Logger } from '../domain/ports/logger';
import { Clock } from '../domain/ports/clock';
import { Booking } from '../domain/model/booking';
import { SlotReservation } from '../domain/model/slot-reservation';
import { DateRange } from '../domain/model/date-range';
import { Pricing } from '../domain/model/pricing';
import { Address } from '../domain/model/address';
import { ListingSnapshot } from '../domain/model/listing-snapshot';
import { SlotUnavailableException } from '../domain/exception/slot-unavailable.exception';

export interface RequestBookingInput {
  customerId: string;
  listingId: string;
  periodFrom: Date;
  periodTo: Date;
  quantity: number;
  options: Array<{ optionId: string; quantity: number }>;
  deliveryAddress: {
    street: string;
    postalCode: string;
    city: string;
  };
  idempotencyKey: string;
}

export interface RequestBookingOutput {
  bookingId: string;
  status: string;
  timeoutAt: Date;
  totalCents: number;
}

export class RequestBookingUseCase {
  constructor(
    private readonly logger: Logger,
    private readonly bookings: BookingRepository,
    private readonly slots: SlotReservationRepository,
    private readonly availability: AvailabilityChecker,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(input: RequestBookingInput): Promise<RequestBookingOutput> {
    const now = this.clock.now();
    const period = new DateRange(input.periodFrom, input.periodTo);

    // 1. Sync call to catalog-svc to fetch listing details + check availability
    //    Returns 409 if not available (race condition, returned to caller as HTTP 409)
    const availabilityResult = await this.availability.checkAndSnapshot({
      listingId: input.listingId,
      period,
      quantity: input.quantity,
      optionIds: input.options.map((o) => o.optionId),
    });

    if (!availabilityResult.available) {
      throw new SlotUnavailableException(
        `Listing ${input.listingId} not available for ${period.from.toISOString()} - ${period.to.toISOString()}`,
      );
    }

    // 2. Create slot reservation FIRST (it's the lock)
    //    The repository uses an exclusion constraint to prevent overlaps
    //    atomically at the DB level.
    const slotId = ulid();
    const slot = SlotReservation.create({
      id: slotId,
      listingId: input.listingId,
      period,
      quantity: input.quantity,
      bookingId: '', // filled below
      now,
    });

    // 3. Build booking
    const bookingId = ulid();
    slot.attachBooking(bookingId);

    const correlationId = ulid();

    const listingSnapshot = ListingSnapshot.fromAvailabilityResult(
      availabilityResult,
      now,
    );
    const pricing = new Pricing(
      availabilityResult.subtotalCents,
      availabilityResult.optionsTotalCents,
      availabilityResult.deliveryCents,
      'EUR',
    );

    const booking = Booking.create({
      id: bookingId,
      customerId: input.customerId,
      providerId: availabilityResult.providerId,
      listingSnapshot,
      period,
      quantity: input.quantity,
      pricing,
      options: input.options.map((o) => ({
        optionId: o.optionId,
        label: availabilityResult.optionsMap[o.optionId].label,
        priceCents: availabilityResult.optionsMap[o.optionId].priceCents,
        quantity: o.quantity,
      })),
      deliveryAddress: new Address(
        input.deliveryAddress.street,
        input.deliveryAddress.postalCode,
        input.deliveryAddress.city,
        'FR',
      ),
      cancellationPolicy: availabilityResult.cancellationPolicy,
      slotReservationId: slotId,
      correlationId,
      now,
    });

    // 4. Persist + emit event in single transaction (outbox pattern)
    await this.bookings.transaction(async (tx) => {
      await this.slots.save(slot, tx);
      await this.bookings.save(booking, tx);

      await this.events.publish({
        type: 'booking.requested.v1',
        aggregateId: booking.id,
        occurredAt: now,
        correlationId,
        payload: {
          bookingId: booking.id,
          customerId: booking.customerId,
          providerId: booking.providerId,
          listingId: input.listingId,
          period: { from: period.from, to: period.to },
          quantity: input.quantity,
          totalCents: pricing.totalCents(),
          timeoutAt: booking.toPrimitives().timeoutAt,
        },
      }, tx);
    });

    this.logger.info('Booking requested', {
      bookingId,
      customerId: input.customerId,
      listingId: input.listingId,
      correlationId,
    });

    return {
      bookingId,
      status: booking.status,
      timeoutAt: booking.toPrimitives().timeoutAt!,
      totalCents: pricing.totalCents(),
    };
  }
}
```

### F.4 `usecases/accept-booking.usecase.ts`

```typescript
export interface AcceptBookingInput {
  bookingId: string;
  actorProviderId: string;
  message?: string;
}

export class AcceptBookingUseCase {
  constructor(
    private readonly logger: Logger,
    private readonly bookings: BookingRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(input: AcceptBookingInput): Promise<void> {
    const booking = await this.bookings.findById(input.bookingId);
    if (!booking) throw new BookingNotFoundException(input.bookingId);

    booking.acceptByPro(input.actorProviderId, this.clock.now(), input.message);

    await this.bookings.transaction(async (tx) => {
      await this.bookings.save(booking, tx);

      await this.events.publish({
        type: 'booking.accepted.v1',
        aggregateId: booking.id,
        occurredAt: this.clock.now(),
        correlationId: booking.correlationId,
        payload: {
          bookingId: booking.id,
          customerId: booking.customerId,
          providerId: booking.providerId,
          period: {
            from: booking.period.from,
            to: booking.period.to,
          },
          totalCents: booking.pricing.totalCents(),
          message: input.message,
        },
      }, tx);
    });

    this.logger.info('Booking accepted', {
      bookingId: booking.id,
      providerId: input.actorProviderId,
    });
  }
}
```

### F.5 `usecases/cancel-booking.usecase.ts`

```typescript
export interface CancelBookingInput {
  bookingId: string;
  actorId: string;
  actorRole: 'customer' | 'pro';
  reason: string;
}

export interface CancelBookingOutput {
  refundAmountCents: number;
  refundPercentage: number;
}

export class CancelBookingUseCase {
  constructor(
    private readonly logger: Logger,
    private readonly bookings: BookingRepository,
    private readonly slots: SlotReservationRepository,
    private readonly events: EventPublisher,
    private readonly refundCalculator: RefundCalculator,
    private readonly clock: Clock,
  ) {}

  async execute(input: CancelBookingInput): Promise<CancelBookingOutput> {
    const booking = await this.bookings.findById(input.bookingId);
    if (!booking) throw new BookingNotFoundException(input.bookingId);

    if (!booking.isCancellable()) {
      throw new BookingAlreadyCancelledException(booking.id);
    }

    const now = this.clock.now();

    // Compute refund based on policy and current date
    const refund = this.refundCalculator.computeRefund(booking, now);

    booking.cancel(input.actorId, input.actorRole, input.reason, now);

    await this.bookings.transaction(async (tx) => {
      await this.bookings.save(booking, tx);
      await this.slots.releaseByBookingId(booking.id, tx);

      await this.events.publish({
        type: 'booking.cancelled.v1',
        aggregateId: booking.id,
        occurredAt: now,
        correlationId: booking.correlationId,
        payload: {
          bookingId: booking.id,
          customerId: booking.customerId,
          providerId: booking.providerId,
          orderId: booking.toPrimitives().orderId,
          cancelledBy: input.actorRole,
          reason: input.reason,
          refundAmountCents: refund.amountCents,
          refundPercentage: refund.percentage,
        },
      }, tx);

      // Also emit slot_released event (catalog-svc consumes to update its read model)
      await this.events.publish({
        type: 'booking.slot_released.v1',
        aggregateId: booking.slotReservationId,
        occurredAt: now,
        correlationId: booking.correlationId,
        payload: {
          slotId: booking.slotReservationId,
          listingId: booking.toPrimitives().listingSnapshot.listingId,
          period: { from: booking.period.from, to: booking.period.to },
          quantity: booking.toPrimitives().quantity,
        },
      }, tx);
    });

    this.logger.info('Booking cancelled', {
      bookingId: booking.id,
      cancelledBy: input.actorRole,
      refundAmountCents: refund.amountCents,
    });

    return {
      refundAmountCents: refund.amountCents,
      refundPercentage: refund.percentage,
    };
  }
}
```

### F.6 `usecases/on-order-paid.usecase.ts` (event consumer)

```typescript
export interface OnOrderPaidInput {
  orderId: string;
  bookingId: string;
  paidAmountCents: number;
  correlationId: string;
}

export class OnOrderPaidUseCase {
  constructor(
    private readonly logger: Logger,
    private readonly bookings: BookingRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(input: OnOrderPaidInput): Promise<void> {
    const booking = await this.bookings.findById(input.bookingId);
    if (!booking) {
      this.logger.warn('OnOrderPaid: booking not found, possibly compensated', {
        bookingId: input.bookingId,
      });
      return; // idempotent: skip if not found
    }

    if (booking.status !== BookingStatus.ACCEPTED) {
      this.logger.warn('OnOrderPaid: booking not in ACCEPTED state, skipping', {
        bookingId: booking.id,
        currentStatus: booking.status,
      });
      return; // idempotent
    }

    const now = this.clock.now();
    booking.confirm(input.orderId, now);

    await this.bookings.transaction(async (tx) => {
      await this.bookings.save(booking, tx);

      await this.events.publish({
        type: 'booking.confirmed.v1',
        aggregateId: booking.id,
        occurredAt: now,
        correlationId: booking.correlationId,
        payload: {
          bookingId: booking.id,
          orderId: input.orderId,
          customerId: booking.customerId,
          providerId: booking.providerId,
          period: { from: booking.period.from, to: booking.period.to },
          totalCents: booking.pricing.totalCents(),
        },
      }, tx);
    });

    this.logger.info('Booking confirmed via order.paid', {
      bookingId: booking.id,
      orderId: input.orderId,
    });
  }
}
```

### F.7 `infrastructure/persistence/repositories/typeorm-booking.repository.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { BookingEntity } from '../entities/booking.entity';
import { Booking } from '../../../domain/model/booking';
import { BookingRepository } from '../../../domain/ports/booking.repository';

@Injectable()
export class TypeOrmBookingRepository implements BookingRepository {
  constructor(
    @InjectRepository(BookingEntity)
    private readonly repo: Repository<BookingEntity>,
  ) {}

  async save(booking: Booking, tx?: EntityManager): Promise<void> {
    const manager = tx ?? this.repo.manager;
    const entity = this.toEntity(booking);
    await manager.getRepository(BookingEntity).save(entity);
  }

  async findById(id: string): Promise<Booking | null> {
    const entity = await this.repo.findOne({
      where: { id },
      relations: ['timeline'],
    });
    return entity ? this.toDomain(entity) : null;
  }

  async findByCustomer(
    customerId: string,
    opts: { limit: number; offset: number; status?: string[] },
  ): Promise<Booking[]> {
    const qb = this.repo
      .createQueryBuilder('b')
      .where('b.customerId = :customerId', { customerId })
      .orderBy('b.createdAt', 'DESC')
      .limit(opts.limit)
      .offset(opts.offset);

    if (opts.status?.length) {
      qb.andWhere('b.status IN (:...status)', { status: opts.status });
    }

    const entities = await qb.getMany();
    return entities.map((e) => this.toDomain(e));
  }

  async findPendingTimeouts(now: Date, batchSize = 100): Promise<Booking[]> {
    const entities = await this.repo
      .createQueryBuilder('b')
      .where('b.status = :status', {
        status: 'pending_pro_acceptance',
      })
      .andWhere('b.timeoutAt <= :now', { now })
      .limit(batchSize)
      .getMany();

    return entities.map((e) => this.toDomain(e));
  }

  async transaction<T>(work: (tx: EntityManager) => Promise<T>): Promise<T> {
    return await this.repo.manager.transaction(work);
  }

  // ─── Mapping ───────────────────────────────────────────────────────

  private toEntity(booking: Booking): BookingEntity {
    const props = booking.toPrimitives();
    const entity = new BookingEntity();
    entity.id = props.id;
    entity.customerId = props.customerId;
    entity.providerId = props.providerId;
    entity.listingSnapshot = JSON.stringify(props.listingSnapshot);
    entity.periodFrom = props.period.from;
    entity.periodTo = props.period.to;
    entity.quantity = props.quantity;
    entity.subtotalCents = props.pricing.subtotalCents;
    entity.optionsCents = props.pricing.optionsCents;
    entity.deliveryCents = props.pricing.deliveryCents;
    entity.options = JSON.stringify(props.options);
    entity.deliveryAddress = JSON.stringify(props.deliveryAddress);
    entity.status = props.status;
    entity.cancellationPolicy = JSON.stringify(props.cancellationPolicy);
    entity.timeline = JSON.stringify(props.timeline);
    entity.orderId = props.orderId;
    entity.slotReservationId = props.slotReservationId;
    entity.correlationId = props.correlationId;
    entity.timeoutAt = props.timeoutAt;
    entity.createdAt = props.createdAt;
    entity.updatedAt = props.updatedAt;
    return entity;
  }

  private toDomain(entity: BookingEntity): Booking {
    return Booking.fromPersistence({
      id: entity.id,
      customerId: entity.customerId,
      providerId: entity.providerId,
      listingSnapshot: JSON.parse(entity.listingSnapshot),
      period: new DateRange(entity.periodFrom, entity.periodTo),
      quantity: entity.quantity,
      pricing: new Pricing(
        entity.subtotalCents,
        entity.optionsCents,
        entity.deliveryCents,
        'EUR',
      ),
      options: JSON.parse(entity.options),
      deliveryAddress: JSON.parse(entity.deliveryAddress),
      status: entity.status as BookingStatus,
      cancellationPolicy: JSON.parse(entity.cancellationPolicy),
      timeline: JSON.parse(entity.timeline),
      orderId: entity.orderId,
      slotReservationId: entity.slotReservationId,
      correlationId: entity.correlationId,
      timeoutAt: entity.timeoutAt,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }
}
```

### F.8 `infrastructure/persistence/repositories/typeorm-slot-reservation.repository.ts`

This is where the **race condition prevention** happens at the database level.

```typescript
@Injectable()
export class TypeOrmSlotReservationRepository implements SlotReservationRepository {
  constructor(
    @InjectRepository(SlotReservationEntity)
    private readonly repo: Repository<SlotReservationEntity>,
  ) {}

  /**
   * Save with overlap detection.
   * The slot_reservations table has a tstzrange exclusion constraint:
   *
   *   ALTER TABLE slot_reservations
   *   ADD CONSTRAINT no_overlap EXCLUDE USING gist (
   *     listing_id WITH =,
   *     period WITH &&
   *   ) WHERE (status = 'active');
   *
   * When two transactions try to insert overlapping reservations for the
   * same listing simultaneously, PostgreSQL raises a constraint violation
   * on the second one. We catch it and translate to SlotUnavailableException.
   */
  async save(slot: SlotReservation, tx?: EntityManager): Promise<void> {
    const manager = tx ?? this.repo.manager;
    try {
      await manager.getRepository(SlotReservationEntity).save(this.toEntity(slot));
    } catch (err: any) {
      if (err.code === '23P01' /* exclusion_violation */) {
        throw new SlotUnavailableException(
          `Slot for listing ${slot.listingId} on this period is no longer available`,
        );
      }
      throw err;
    }
  }

  async releaseByBookingId(bookingId: string, tx?: EntityManager): Promise<void> {
    const manager = tx ?? this.repo.manager;
    await manager
      .getRepository(SlotReservationEntity)
      .update({ bookingId }, { status: 'released' });
  }

  // toEntity / toDomain elided for brevity
}
```

The exclusion constraint is the **key** to preventing race conditions. It works at the database level, atomically, even under heavy concurrency.

### F.9 `infrastructure/messaging/consumers/order.consumer.ts`

```typescript
import { Controller, Inject } from '@nestjs/common';
import { EventPattern, Payload, Ctx } from '@nestjs/microservices';
import { JetstreamContext } from '@horizon-republic/nestjs-jetstream';
import { UseCasesProxyModule, UseCaseProxy } from '../../usecases-proxy/usecases-proxy.module';
import { OnOrderPaidUseCase } from '../../../usecases/on-order-paid.usecase';
import { OnOrderCancelledUseCase } from '../../../usecases/on-order-cancelled.usecase';
import { InboxStore } from '../inbox.store';

@Controller()
export class OrderConsumer {
  constructor(
    @Inject(UseCasesProxyModule.ON_ORDER_PAID)
    private readonly onOrderPaid: UseCaseProxy<OnOrderPaidUseCase>,
    @Inject(UseCasesProxyModule.ON_ORDER_CANCELLED)
    private readonly onOrderCancelled: UseCaseProxy<OnOrderCancelledUseCase>,
    private readonly inbox: InboxStore,
  ) {}

  @EventPattern('order.paid.v1', {
    durable: 'booking-on-order-paid',
    deliver_policy: 'new',
    ack_policy: 'explicit',
    max_deliver: 5,
  })
  async handleOrderPaid(@Payload() event: any, @Ctx() ctx: JetstreamContext) {
    const eventId = event.id;

    // Idempotency: check inbox first
    const alreadyProcessed = await this.inbox.exists(eventId, 'booking-on-order-paid');
    if (alreadyProcessed) {
      ctx.message.ack();
      return;
    }

    try {
      await this.inbox.transaction(async (tx) => {
        await this.inbox.markProcessed(eventId, 'booking-on-order-paid', tx);
        await this.onOrderPaid.getInstance().execute({
          orderId: event.data.orderId,
          bookingId: event.data.bookingId,
          paidAmountCents: event.data.paidAmountCents,
          correlationId: event.correlationId,
        });
      });
      ctx.message.ack();
    } catch (err) {
      ctx.message.nak(); // retried, eventually DLQ-ed if max_deliver hit
    }
  }

  @EventPattern('order.cancelled.v1', {
    durable: 'booking-on-order-cancelled',
    max_deliver: 5,
  })
  async handleOrderCancelled(@Payload() event: any, @Ctx() ctx: JetstreamContext) {
    // ... similar pattern
  }
}
```

### F.10 `infrastructure/usecases-proxy/usecases-proxy.module.ts`

```typescript
import { DynamicModule, Module, Provider } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BookingEntity } from '../persistence/entities/booking.entity';
import { SlotReservationEntity } from '../persistence/entities/slot-reservation.entity';

import { TypeOrmBookingRepository } from '../persistence/repositories/typeorm-booking.repository';
import { TypeOrmSlotReservationRepository } from '../persistence/repositories/typeorm-slot-reservation.repository';

import { BOOKING_REPOSITORY } from '../../domain/ports/booking.repository';
import { SLOT_RESERVATION_REPOSITORY } from '../../domain/ports/slot-reservation.repository';
import { AVAILABILITY_CHECKER } from '../../domain/ports/availability.checker';
import { EVENT_PUBLISHER } from '../../domain/ports/event.publisher';
import { LOGGER } from '../../domain/ports/logger';
import { CLOCK } from '../../domain/ports/clock';

import { CatalogAvailabilityClient } from '../http-clients/catalog-availability.client';
import { NatsEventPublisher } from '../messaging/nats.publisher';
import { LoggerModule } from '../logger/logger.module';
import { PinoLoggerService } from '../logger/pino-logger.service';
import { SystemClock } from '../persistence/system-clock';

import { RefundCalculator } from '../../domain/service/refund-calculator';

import { RequestBookingUseCase } from '../../usecases/request-booking.usecase';
import { AcceptBookingUseCase } from '../../usecases/accept-booking.usecase';
import { RefuseBookingUseCase } from '../../usecases/refuse-booking.usecase';
import { CancelBookingUseCase } from '../../usecases/cancel-booking.usecase';
import { GetBookingDetailUseCase } from '../../usecases/get-booking-detail.usecase';
import { GetCancellationImpactUseCase } from '../../usecases/get-cancellation-impact.usecase';
import { OnOrderPaidUseCase } from '../../usecases/on-order-paid.usecase';
import { OnOrderCancelledUseCase } from '../../usecases/on-order-cancelled.usecase';
import { OnPaymentFailedUseCase } from '../../usecases/on-payment-failed.usecase';
import { TimeoutPendingBookingsUseCase } from '../../usecases/timeout-pending-bookings.usecase';

export class UseCaseProxy<T> {
  constructor(private readonly useCase: T) {}
  getInstance(): T {
    return this.useCase;
  }
}

@Module({})
export class UseCasesProxyModule {
  // Customer
  static readonly REQUEST_BOOKING = 'RequestBookingUseCaseProxy';
  static readonly CANCEL_BOOKING = 'CancelBookingUseCaseProxy';
  static readonly GET_BOOKING_DETAIL = 'GetBookingDetailUseCaseProxy';
  static readonly GET_CANCELLATION_IMPACT = 'GetCancellationImpactUseCaseProxy';

  // Pro
  static readonly ACCEPT_BOOKING = 'AcceptBookingUseCaseProxy';
  static readonly REFUSE_BOOKING = 'RefuseBookingUseCaseProxy';

  // Consumers
  static readonly ON_ORDER_PAID = 'OnOrderPaidUseCaseProxy';
  static readonly ON_ORDER_CANCELLED = 'OnOrderCancelledUseCaseProxy';
  static readonly ON_PAYMENT_FAILED = 'OnPaymentFailedUseCaseProxy';

  // Cron
  static readonly TIMEOUT_PENDING = 'TimeoutPendingBookingsUseCaseProxy';

  static register(): DynamicModule {
    const portProviders: Provider[] = [
      { provide: BOOKING_REPOSITORY, useClass: TypeOrmBookingRepository },
      { provide: SLOT_RESERVATION_REPOSITORY, useClass: TypeOrmSlotReservationRepository },
      { provide: AVAILABILITY_CHECKER, useClass: CatalogAvailabilityClient },
      { provide: EVENT_PUBLISHER, useClass: NatsEventPublisher },
      { provide: LOGGER, useExisting: PinoLoggerService },
      { provide: CLOCK, useClass: SystemClock },
      RefundCalculator,
    ];

    const useCaseProviders: Provider[] = [
      {
        provide: UseCasesProxyModule.REQUEST_BOOKING,
        inject: [
          LOGGER,
          BOOKING_REPOSITORY,
          SLOT_RESERVATION_REPOSITORY,
          AVAILABILITY_CHECKER,
          EVENT_PUBLISHER,
          CLOCK,
        ],
        useFactory: (logger, bookings, slots, availability, events, clock) =>
          new UseCaseProxy(
            new RequestBookingUseCase(logger, bookings, slots, availability, events, clock),
          ),
      },
      {
        provide: UseCasesProxyModule.ACCEPT_BOOKING,
        inject: [LOGGER, BOOKING_REPOSITORY, EVENT_PUBLISHER, CLOCK],
        useFactory: (logger, bookings, events, clock) =>
          new UseCaseProxy(new AcceptBookingUseCase(logger, bookings, events, clock)),
      },
      {
        provide: UseCasesProxyModule.REFUSE_BOOKING,
        inject: [LOGGER, BOOKING_REPOSITORY, SLOT_RESERVATION_REPOSITORY, EVENT_PUBLISHER, CLOCK],
        useFactory: (logger, bookings, slots, events, clock) =>
          new UseCaseProxy(new RefuseBookingUseCase(logger, bookings, slots, events, clock)),
      },
      {
        provide: UseCasesProxyModule.CANCEL_BOOKING,
        inject: [
          LOGGER,
          BOOKING_REPOSITORY,
          SLOT_RESERVATION_REPOSITORY,
          EVENT_PUBLISHER,
          RefundCalculator,
          CLOCK,
        ],
        useFactory: (logger, bookings, slots, events, refundCalc, clock) =>
          new UseCaseProxy(
            new CancelBookingUseCase(logger, bookings, slots, events, refundCalc, clock),
          ),
      },
      {
        provide: UseCasesProxyModule.GET_BOOKING_DETAIL,
        inject: [LOGGER, BOOKING_REPOSITORY],
        useFactory: (logger, bookings) =>
          new UseCaseProxy(new GetBookingDetailUseCase(logger, bookings)),
      },
      {
        provide: UseCasesProxyModule.GET_CANCELLATION_IMPACT,
        inject: [BOOKING_REPOSITORY, RefundCalculator, CLOCK],
        useFactory: (bookings, refundCalc, clock) =>
          new UseCaseProxy(new GetCancellationImpactUseCase(bookings, refundCalc, clock)),
      },
      {
        provide: UseCasesProxyModule.ON_ORDER_PAID,
        inject: [LOGGER, BOOKING_REPOSITORY, EVENT_PUBLISHER, CLOCK],
        useFactory: (logger, bookings, events, clock) =>
          new UseCaseProxy(new OnOrderPaidUseCase(logger, bookings, events, clock)),
      },
      {
        provide: UseCasesProxyModule.ON_ORDER_CANCELLED,
        inject: [LOGGER, BOOKING_REPOSITORY, SLOT_RESERVATION_REPOSITORY, EVENT_PUBLISHER, CLOCK],
        useFactory: (logger, bookings, slots, events, clock) =>
          new UseCaseProxy(new OnOrderCancelledUseCase(logger, bookings, slots, events, clock)),
      },
      {
        provide: UseCasesProxyModule.ON_PAYMENT_FAILED,
        inject: [LOGGER, BOOKING_REPOSITORY, SLOT_RESERVATION_REPOSITORY, EVENT_PUBLISHER, CLOCK],
        useFactory: (logger, bookings, slots, events, clock) =>
          new UseCaseProxy(new OnPaymentFailedUseCase(logger, bookings, slots, events, clock)),
      },
      {
        provide: UseCasesProxyModule.TIMEOUT_PENDING,
        inject: [LOGGER, BOOKING_REPOSITORY, SLOT_RESERVATION_REPOSITORY, EVENT_PUBLISHER, CLOCK],
        useFactory: (logger, bookings, slots, events, clock) =>
          new UseCaseProxy(
            new TimeoutPendingBookingsUseCase(logger, bookings, slots, events, clock),
          ),
      },
    ];

    return {
      module: UseCasesProxyModule,
      imports: [
        LoggerModule,
        TypeOrmModule.forFeature([BookingEntity, SlotReservationEntity]),
      ],
      providers: [...portProviders, ...useCaseProviders],
      exports: useCaseProviders.map((p: any) => p.provide),
    };
  }
}
```

---

## G. The booking-payment saga

### G.1 Choreographed saga overview

The booking-payment saga is the **single most important workflow** in the system. It spans 3 services (`booking-svc`, `order-svc`, `payment-svc`) and ~5 events.

```
ACTOR        SERVICE                   EVENT                              ACTION
─────        ───────                   ─────                              ──────
customer  → booking-svc              POST /v1/bookings
                                                                          • Snapshot listing details
                                                                          • Reserve slot (DB exclusion constraint)
                                                                          • Create booking (pending_pro_acceptance)
                                                                          • Set timeoutAt = now + 48h
                                     ──booking.requested.v1──▶
                                                                  ▼
                                                                order-svc
                                                                          • Create draft Order
                                                                          • Compute taxes, totals
                                                                          • Wait for booking.accepted

[time passes...]

pro       → booking-svc              POST /v1/bookings/:id/accept
                                                                          • Validate actor is provider
                                                                          • Validate status = pending_pro_acceptance
                                                                          • Status → ACCEPTED
                                     ──booking.accepted.v1──▶
                                                                  ▼
                                                                order-svc
                                                                          • Find draft Order for this booking
                                                                          • Status: pending → ready_for_payment
                                     ──order.ready_for_payment.v1──▶
                                                                            ▼
                                                                      payment-svc
                                                                          • Lookup customer & pro Stripe IDs
                                                                          • Capture PaymentIntent (auth → captured)
                                     ──payment.captured.v1──▶◀─────────────┘
                                              ▼
                                          order-svc
                                          • Status: ready_for_payment → paid
                                          • Generate invoice PDFs
                                     ──order.paid.v1──▶
                                              ▼
                                          booking-svc
                                          • Status: ACCEPTED → CONFIRMED
                                          • Store orderId
                                     ──booking.confirmed.v1──▶
                                              ▼
                                          notification-svc
                                          • Send "your booking is confirmed" emails
                                          • Send "you've been booked" pro notification

[event happens, time passes...]

booking-svc cron checks bookings with period.to in past
                                                                          • Status: CONFIRMED → COMPLETED
                                     ──booking.completed.v1──▶
                                              ▼
                                          notification-svc → request review email
                                          payment-svc → schedule payout to pro (J+1)
                                          review-svc → enable review submission window
```

### G.2 Compensating paths

**Pro refuses:**
```
pro → booking-svc                    POST /v1/bookings/:id/refuse
                                                                          • Status → REFUSED
                                                                          • Release slot
                                     ──booking.refused.v1──▶
                                              ▼
                                          order-svc
                                          • Status: pending → cancelled
                                     ──order.cancelled.v1──▶
                                              ▼
                                          payment-svc
                                          • PaymentIntent.cancel() (release auth)
                                     ──payment.cancelled.v1──▶
                                              ▼
                                          notification-svc → "your request was declined" email
```

**Pro times out (48h):**
Same as pro refuses, but triggered by `booking-svc` cron:
```
booking-svc cron → TimeoutPendingBookingsUseCase
                                                                          • Status → TIMED_OUT
                                                                          • Release slot
                                     ──booking.timed_out.v1──▶ (same downstream as refused)
```

**Payment fails (after pro accepts):**
This is the rare and tricky case. Pro accepted, but customer's card got declined / fraud check failed.
```
payment-svc                          (Stripe webhook payment_intent.payment_failed)
                                     ──payment.failed.v1──▶
                                              ▼
                                          booking-svc
                                          • Status: ACCEPTED → PAYMENT_FAILED
                                          • Release slot
                                     ──booking.cancelled.v1──▶ (with reason: payment_failed)
                                              ▼
                                          order-svc → cancel order
                                          notification-svc → notify customer + pro
                                          admin alert (manual followup may be needed)
```

**Customer cancels before pro response:**
```
customer → booking-svc               POST /v1/bookings/:id/cancel
                                                                          • Status → CANCELLED_BY_CLIENT
                                                                          • Release slot
                                                                          • Refund: 100% (no payment captured yet)
                                     ──booking.cancelled.v1──▶
                                              ▼
                                          order-svc → cancel order
                                          payment-svc → cancel auth (no refund needed if not captured)
```

**Customer cancels after confirmation:**
```
customer → booking-svc               POST /v1/bookings/:id/cancel
                                                                          • Compute refund per cancellation policy
                                                                            (e.g., J-25 = 50% refund)
                                                                          • Status → CANCELLED_BY_CLIENT
                                                                          • Release slot
                                     ──booking.cancelled.v1──▶ (with refundAmountCents)
                                              ▼
                                          payment-svc → Stripe refund (partial)
                                          order-svc → mark order partially_refunded
                                          notification-svc → confirmation emails
```

### G.3 Saga correlation

Every event in the saga carries the same `correlationId` (a ULID generated at booking creation). This allows:

- **Tracing** in observability tools (Jaeger, Tempo)
- **Debugging** by querying logs/events by correlationId
- **Manual replay** of a saga by replaying events with the same correlationId

### G.4 Saga failure detection

A `saga-monitor` job runs every 5 minutes and looks for stuck sagas:

```sql
-- Bookings that have been ACCEPTED for > 5 minutes but no booking.confirmed event
SELECT b.id, b.correlation_id, b.updated_at
FROM bookings b
WHERE b.status = 'accepted'
  AND b.updated_at < NOW() - INTERVAL '5 minutes'
LIMIT 100;
```

Each match is alerted to admin (Slack webhook). Manual investigation: check `payment-svc` and `order-svc` logs for the same correlationId. Resolution may require:
- Manual replay of `payment.captured.v1` event
- Manual override of booking status with audit trail
- Refund + customer notification if irrecoverable

---

## H. Concurrency & race conditions

### H.1 The classic race: two customers booking the last slot

**Scenario**: Pro has 1 chapiteau. Two customers click "Réserver" on the same dates within milliseconds.

**Defence in depth — three layers:**

#### Layer 1: Frontend optimistic UX

Frontend shows the booking form, but only the **server response** matters. UI shows "checking availability..." after submit, never claims success before server ACK.

#### Layer 2: Redis lock during checkout

When customer enters the checkout funnel (`/cart`), `order-svc` acquires a Redis lock:

```
SET lock:listing:{listingId}:{period} {customerId} NX EX 600
```

If lock acquisition fails (returns `nil`), `order-svc` returns 409 to the frontend: "This slot is currently being booked by someone else, try again in a few minutes."

Lock is released when:
- Order is created and booking flows to `booking-svc` (success path)
- Customer abandons (TTL expires after 10 minutes)
- Order creation fails (explicit release in error handler)

This layer prevents 95% of races.

#### Layer 3: PostgreSQL exclusion constraint (the ultimate authority)

Even if both customers somehow pass through Redis (e.g., Redis was down momentarily), the database has the final say:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE slot_reservations
ADD CONSTRAINT no_overlap_active_slots
EXCLUDE USING gist (
  listing_id WITH =,
  period WITH &&
)
WHERE (status = 'active');
```

When two transactions try to insert overlapping slot reservations:
1. Transaction A succeeds
2. Transaction B fails with `23P01` (`exclusion_violation`)
3. The repository catches `23P01` and throws `SlotUnavailableException`
4. Use case propagates 409 to caller
5. Customer sees "Slot taken, please pick other dates"

If the customer paid in transaction B before the exclusion constraint kicked in (unlikely but possible if Redis was bypassed), `payment-svc` issues an automatic refund with apology email.

### H.2 Inventory-based concurrency

For listings with `quantity > 1` (e.g., 200 chairs), the constraint is more nuanced. Two customers can each book 50 chairs on the same dates — that's fine, total is 100 ≤ 200.

The check happens in 2 steps:
1. **Optimistic check** at `RequestBookingUseCase` start: compute remaining inventory for the period via `AvailabilityChecker` (sync call to `catalog-svc`)
2. **Pessimistic confirmation** at insertion time: a deferred trigger or row-level lock ensures the cumulative reserved quantity never exceeds inventory

The exclusion constraint above doesn't fit this case (overlap is allowed up to inventory). Instead:

```sql
CREATE OR REPLACE FUNCTION check_slot_inventory()
RETURNS TRIGGER AS $$
DECLARE
  total_reserved INT;
  total_inventory INT;
BEGIN
  SELECT total_inventory INTO total_inventory FROM listings WHERE id = NEW.listing_id;
  -- catalog-svc would denormalize this into booking-svc DB or expose via API
  -- (database-per-service: we'd snapshot total_inventory in slot_reservations row at creation)

  SELECT COALESCE(SUM(quantity), 0) INTO total_reserved
  FROM slot_reservations
  WHERE listing_id = NEW.listing_id
    AND period && NEW.period
    AND status = 'active'
    AND id != NEW.id;

  IF (total_reserved + NEW.quantity) > total_inventory THEN
    RAISE EXCEPTION 'Inventory exceeded for listing %', NEW.listing_id
      USING ERRCODE = '23P01';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_inventory_constraint
BEFORE INSERT OR UPDATE ON slot_reservations
FOR EACH ROW
EXECUTE FUNCTION check_slot_inventory();
```

In a strict database-per-service setup, `total_inventory` is denormalized into the `slot_reservations` row at creation (snapshot, never updated). This avoids any cross-service join.

### H.3 Optimistic locking for bookings

To prevent lost updates on concurrent state transitions (e.g., pro accepts and customer cancels at the same instant), the `bookings` table has a `version` column:

```sql
UPDATE bookings
SET status = 'accepted', version = version + 1, updated_at = NOW()
WHERE id = $1 AND version = $2;
```

If `0` rows updated → version mismatch → repository throws `ConcurrentModificationException` → use case retries (up to 3 times) or fails to caller.

### H.4 Idempotency of HTTP endpoints

`POST /v1/bookings` accepts a required `Idempotency-Key` header. The first request creates the booking; subsequent requests with the same key return the same booking response. Implementation: `idempotency_keys` table with `(key, response_body, ttl)`.

```typescript
// In RequestBookingUseCase, before creating
const cached = await this.idempotencyStore.get(input.idempotencyKey);
if (cached) return cached;

// ... create booking ...

await this.idempotencyStore.save(input.idempotencyKey, output, /* TTL */ 24 * 3600);
return output;
```

### H.5 Idempotency of event consumers

Already covered in §F.6 and §F.9 via the `inbox` table. Every consumer first writes to `inbox` (with `INSERT ... ON CONFLICT DO NOTHING`) inside the same transaction as the business work. Duplicate event delivery is silently absorbed.

---

## I. Failure modes & compensations

### I.1 NATS publish failure after DB commit (the dreaded case)

**Without outbox**:
1. DB transaction commits (booking created)
2. `events.publish('booking.requested.v1')` throws (NATS down)
3. Booking exists in DB but the event was never sent
4. Order-svc never knows → cart never has the booking → invisible booking

**With outbox** (our design):
1. DB transaction includes BOTH the booking insert AND the outbox row insert
2. Outbox relay (PG LISTEN/NOTIFY) wakes up, picks up the row, publishes to NATS
3. If NATS is down, the outbox relay retries with exponential backoff
4. When NATS is back, the relay publishes the event
5. Order-svc receives it, with possible delay but no loss

The outbox is the **single most important piece** of the architecture for marketplace correctness.

### I.2 NATS consumer retries

For `OnOrderPaidUseCase` and similar consumers:
- `max_deliver: 5` — NATS retries up to 5 times with backoff
- After 5 failures, message moves to DLQ (`dlq.booking` stream)
- Admin tooling to inspect and re-queue DLQ messages

Common failure causes:
- Bug in business logic → fix code, redeploy, replay DLQ
- DB temporarily unavailable → backoff resolves it
- Inbox conflict (already processed) → no-op, ack immediately

### I.3 Stripe webhook missed

If `payment.captured.v1` is missed:
- Customer paid but booking never confirmed
- After 5 minutes, saga monitor alerts admin
- Reconciliation cron job (daily) compares `bookings.status = 'accepted'` with Stripe's PaymentIntent state
- Manual or automated remediation: replay event from Stripe API

### I.4 Pro accepts but slot was cancelled by another booking's compensation

**Scenario**: Pro has 2 chapiteaux. Customer A and Customer B both book 1 each. A's payment fails → slot released. Pro accepts B in the meantime. B is fine.

But: Customer A's slot release event arrives *before* Customer B's accept. When pro accepts B, the slot reservation is already gone. → No issue, because the slot is per-booking, B's slot is independent.

The only scenario to worry about is: **the booking row's referenced slot was already released** (e.g., by an out-of-order event). The accept use case checks the slot still exists and is `active`; if not, refuses the accept and emits a compensating event.

### I.5 Out-of-order event delivery

NATS JetStream provides per-stream ordering by default, **not** global ordering. Within `BOOKING` stream, events are ordered. Cross-stream (e.g., `BOOKING` and `PAYMENT`), no ordering guarantee.

For the saga to be correct under out-of-order delivery:
- All consumers are idempotent (check current state before applying)
- All transitions are commutative where possible
- The `correlationId` allows reconstruction of the intended sequence

If a consumer receives `payment.captured.v1` *before* `booking.accepted.v1` (race), it logs a warning, defers processing for 30 s, retries. If still out of order, raises a saga inconsistency alert.

---

## J. Testing strategy

### J.1 Unit tests (the bulk)

One spec per use case + one spec per domain class. All run with `vitest`, no infrastructure.

Example:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { CancelBookingUseCase } from '../../src/usecases/cancel-booking.usecase';
import { Booking } from '../../src/domain/model/booking';
import { BookingStatus } from '../../src/domain/model/booking-status';
import { RefundCalculator } from '../../src/domain/service/refund-calculator';

describe('CancelBookingUseCase', () => {
  const now = new Date('2026-05-20T10:00:00Z');
  const eventDate = new Date('2026-06-15T10:00:00Z'); // J-26
  const clock = { now: () => now };
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

  function buildBooking(): Booking {
    return Booking.fromPersistence({
      id: 'bkg-1',
      customerId: 'customer-a',
      providerId: 'provider-a',
      status: BookingStatus.CONFIRMED,
      period: new DateRange(eventDate, new Date('2026-06-17')),
      pricing: new Pricing(120000, 15000, 4500, 'EUR'), // total: 1395 €
      cancellationPolicy: STANDARD_POLICY,
      // ... other fields
    });
  }

  it('cancels a confirmed booking and refunds 50% at J-26', async () => {
    const booking = buildBooking();
    const bookings = {
      findById: vi.fn().mockResolvedValue(booking),
      save: vi.fn(),
      transaction: vi.fn(async (cb) => cb({})),
    };
    const slots = { releaseByBookingId: vi.fn() };
    const events = { publish: vi.fn() };
    const refundCalc = new RefundCalculator();

    const sut = new CancelBookingUseCase(logger, bookings, slots, events, refundCalc, clock);

    const result = await sut.execute({
      bookingId: 'bkg-1',
      actorId: 'customer-a',
      actorRole: 'customer',
      reason: 'Plans changed',
    });

    expect(result.refundPercentage).toBe(50);
    expect(result.refundAmountCents).toBe(69_750); // 1395 € × 50%
    expect(events.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'booking.cancelled.v1',
        payload: expect.objectContaining({ refundAmountCents: 69_750 }),
      }),
    );
    expect(slots.releaseByBookingId).toHaveBeenCalledWith('bkg-1', expect.anything());
  });

  it('rejects cancellation by non-owner', async () => {
    const booking = buildBooking();
    const bookings = { findById: vi.fn().mockResolvedValue(booking) };
    const sut = new CancelBookingUseCase(/* ... */);

    await expect(
      sut.execute({
        bookingId: 'bkg-1',
        actorId: 'someone-else',
        actorRole: 'customer',
        reason: 'X',
      }),
    ).rejects.toThrow(/Unauthorized/);
  });

  it('cannot cancel a booking already in terminal state', async () => {
    const booking = buildBooking();
    booking.cancel('customer-a', 'customer', 'first cancel', new Date('2026-05-19'));
    // ... attempt to cancel again
    await expect(/* cancel again */).rejects.toThrow(/already cancelled/);
  });
});
```

**Targets:**
- Use case coverage ≥ 90 %
- Domain coverage ≥ 95 %
- Each test runs in < 50 ms

### J.2 Integration tests (adapters)

Test `TypeOrmBookingRepository`, `TypeOrmSlotReservationRepository`, `NatsEventPublisher` against real PG (testcontainers) and real NATS (testcontainers).

**Critical test**: prove the exclusion constraint actually works:

```typescript
it('rejects overlapping slot reservations', async () => {
  const slot1 = SlotReservation.create({ /* listingId: L1, period: 2026-06-15..17, qty: 1 */ });
  const slot2 = SlotReservation.create({ /* listingId: L1, period: 2026-06-16..18, qty: 1 */ });

  await repo.save(slot1);
  await expect(repo.save(slot2)).rejects.toThrow(SlotUnavailableException);
});
```

### J.3 Contract tests

Two types:

**HTTP contract** (gateway-api → booking-svc): consumer-driven Pact. Gateway publishes pacts to broker. Booking-svc verifies them in CI.

**Event contract**: every event emitted by booking-svc has a JSON schema in `@tukio/contracts`. CI test:

```typescript
import Ajv from 'ajv';
import bookingRequestedSchema from '@tukio/contracts/events/booking.requested.v1.schema.json';

it('booking.requested.v1 events match the contract', async () => {
  const ajv = new Ajv();
  const validate = ajv.compile(bookingRequestedSchema);

  const sample = await captureBookingRequestedEvent(); // capture from a real test scenario

  expect(validate(sample)).toBe(true);
  if (!validate(sample)) console.error(validate.errors);
});
```

### J.4 Chaos tests

Critical for the saga. Run periodically (nightly in CI), simulate failures:

```typescript
it('survives NATS publish failure during cancellation', async () => {
  // Setup: real PG, real NATS, but NATS publish fails 50% of the time
  natsTestServer.injectFault('publish_fail_rate', 0.5);

  const result = await runCancellationSaga();

  // Wait for outbox relay to retry
  await sleep(5000);

  // Check final state: booking cancelled, slot released, event eventually published
  const booking = await getBooking(result.bookingId);
  expect(booking.status).toBe(BookingStatus.CANCELLED_BY_CLIENT);

  const events = await captureNatsEvents();
  expect(events).toContainEqual(
    expect.objectContaining({ type: 'booking.cancelled.v1' }),
  );
});
```

### J.5 E2E tests

Single happy-path test through booking-svc only (no other services), via supertest:

```
POST /v1/bookings → 201
POST /v1/bookings/:id/accept → 200
... wait for outbox event publication ...
GET /v1/bookings/:id → status: ACCEPTED
```

We do NOT do cross-service E2E in CI. Saved for staging environment.

---

## K. Operational concerns

### K.1 Migrations

```sql
-- 1715000000000-init.ts
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE bookings (
  id                     TEXT PRIMARY KEY,
  customer_id            UUID NOT NULL,
  provider_id            UUID NOT NULL,
  listing_snapshot       JSONB NOT NULL,
  period                 TSTZRANGE NOT NULL,
  quantity               INT NOT NULL CHECK (quantity > 0),
  subtotal_cents         INT NOT NULL,
  options_cents          INT NOT NULL DEFAULT 0,
  delivery_cents         INT NOT NULL DEFAULT 0,
  options                JSONB NOT NULL DEFAULT '[]',
  delivery_address       JSONB NOT NULL,
  status                 TEXT NOT NULL,
  cancellation_policy    JSONB NOT NULL,
  timeline               JSONB NOT NULL DEFAULT '[]',
  order_id               TEXT,
  slot_reservation_id    TEXT NOT NULL,
  correlation_id         TEXT NOT NULL,
  timeout_at             TIMESTAMPTZ,
  version                INT NOT NULL DEFAULT 1,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bookings_customer ON bookings (customer_id, created_at DESC);
CREATE INDEX idx_bookings_provider ON bookings (provider_id, created_at DESC);
CREATE INDEX idx_bookings_status_timeout ON bookings (status, timeout_at)
  WHERE status = 'pending_pro_acceptance';
CREATE INDEX idx_bookings_correlation ON bookings (correlation_id);

CREATE TABLE slot_reservations (
  id                  TEXT PRIMARY KEY,
  listing_id          UUID NOT NULL,
  period              TSTZRANGE NOT NULL,
  quantity            INT NOT NULL CHECK (quantity > 0),
  total_inventory     INT NOT NULL,
  booking_id          TEXT,
  status              TEXT NOT NULL CHECK (status IN ('active', 'released')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- For listings with max_concurrent_bookings = 1 (e.g., chapiteau unique)
-- The exclusion constraint applies only if total_inventory = 1
CREATE INDEX idx_slot_reservations_listing_period ON slot_reservations
  USING gist (listing_id, period) WHERE status = 'active';

CREATE TABLE outbox (
  id              TEXT PRIMARY KEY,
  type            TEXT NOT NULL,
  aggregate_id    TEXT NOT NULL,
  payload         JSONB NOT NULL,
  occurred_at     TIMESTAMPTZ NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',
  attempts        INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at         TIMESTAMPTZ
);

CREATE INDEX idx_outbox_pending ON outbox (created_at) WHERE status = 'pending';

CREATE TABLE inbox (
  message_id   TEXT NOT NULL,
  consumer     TEXT NOT NULL,
  received_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, consumer)
);

CREATE TABLE idempotency_keys (
  key             TEXT PRIMARY KEY,
  response_body   JSONB NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_idempotency_expiry ON idempotency_keys (expires_at);
```

### K.2 Observability

**Logs (Pino → stdout):**
- INFO: every use case execution start/end
- WARN: idempotency hits (event already processed), recoverable errors
- ERROR: domain exceptions, infrastructure failures

Each log line includes `correlationId`, `bookingId` (when applicable), `actorUserId`, `traceId`.

**Metrics (Prometheus):**

```
booking_created_total{listing_category}
booking_status_transitions_total{from, to}
booking_pro_response_duration_seconds_histogram
slot_unavailable_errors_total
saga_stuck_total
outbox_pending_count_gauge
outbox_publish_lag_seconds_histogram
nats_consumer_lag_messages{consumer}
db_query_duration_seconds_histogram{repo, method}
```

**Tracing (OpenTelemetry):**
- Auto-instrument Fastify HTTP server, TypeORM, NATS publisher/consumer
- Propagate `correlationId` through HTTP headers and NATS message headers
- Manual spans inside use cases for business-meaningful operations

**Alerts (Prometheus → Alertmanager):**
- `outbox_pending_count_gauge > 100 for > 1 minute` → outbox relay broken
- `nats_consumer_lag_messages > 1000` → consumer stuck
- `saga_stuck_total > 0 over 5 minutes` → saga monitor flagged something
- `booking_pro_response_duration_seconds_histogram p99 > 24h` → pros are sluggish (business signal)

### K.3 Backup & disaster recovery

- PostgreSQL: PITR (Point-in-Time Recovery) enabled, daily snapshots, 30-day retention
- NATS JetStream: replicas R3 in production, file-based persistence
- Outbox table: NEVER deleted (append-only), only `status` updated
- Audit trail (timeline) stored in JSONB per booking, also append-only

### K.4 Deploy & rollback

- Each release: blue-green deploy, 1-hour canary on 5% of traffic before full rollout
- Rollback: revert image, but **migrations are forward-only** (additive). If a migration is buggy, write a corrective migration, never `down`.
- Feature flags via GrowthBook for risky changes (new use cases, behavior tweaks)

### K.5 Performance budgets

- `POST /v1/bookings` p99 < 500 ms (includes sync call to catalog-svc + DB transaction)
- `GET /v1/bookings/:id` p99 < 100 ms
- Event consumer lag < 1 second p99
- Outbox publish latency < 500 ms p99 (LISTEN/NOTIFY based)

---

## L. Open questions

| # | Question | Reco / status |
|---|----------|----------------|
| **L-01** | Should `booking-svc` cache `catalog-svc` listing details to avoid sync calls in hot paths? | At MVP no. If `RequestBookingUseCase` p99 exceeds 500 ms, introduce a 60s in-memory LRU cache for listing snapshots. |
| **L-02** | Multi-vendor cart (V1) — does one cart create multiple bookings or one booking with multiple line items? | **Multiple bookings, one order** (cf. ADR-004). Each booking goes through its own pro acceptance. The order is the unit that gets paid. |
| **L-03** | What happens if pro accepts after the listing was unpublished? | The accept fails with a domain exception. The customer is refunded. Pro is notified. Probably rare in practice. |
| **L-04** | Should we expose a "pro extends timeout" feature ("I need 24 more hours to decide")? | V2 feature. At MVP: hard 48 h timeout, no extension. |
| **L-05** | Inventory snapshot or live? | **Snapshot** at slot reservation creation (`total_inventory` denormalized into `slot_reservations`). Pro changing inventory does not affect existing reservations. |
| **L-06** | Cancellation policy: snapshot or live? | **Snapshot** at booking creation (already in `Booking` aggregate). |
| **L-07** | Should we soft-delete bookings? | No, never delete. Cancelled bookings remain in DB for accounting (10-year retention). |
| **L-08** | How to test the exclusion constraint? | Real PG via testcontainers, run two parallel transactions, expect one to fail with 23P01. Critical test. |
| **L-09** | Saga timeout for stuck saga (e.g., booking ACCEPTED but no payment for > 1 hour) | Cron `saga-monitor` alerts admin. Manual remediation in MVP. Auto-compensation in V1+. |
| **L-10** | Event versioning strategy when adding fields to existing events | Additive only in v1. Breaking changes → new version (`booking.requested.v2`), both versions emitted during migration period (~30 days), consumers updated, then v1 deprecated. |

---

*End of booking-svc deep dive — version 1, to iterate as the service is built.*
