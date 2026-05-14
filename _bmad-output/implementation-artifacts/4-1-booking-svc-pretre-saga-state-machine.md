# Story 4.1: booking-svc Pretre + `Booking` aggregate + saga state machine (FR47)

Status: ready-for-dev

## Story

**As a** backend developer Tukio (gardien Pattern Pretre + Clean Architecture + foundation domain pour toutes les Stories Epic 4 downstream saga booking-payment),
**I want** **scaffolder booking-svc Pretre + livrer le domain Booking complet** (aggregate root + 5-status state machine canonique + 5 value-objects + 8 use cases skeletons + 4 ports + BookingStateMachine domain service + DB tables + outbox events + lint boundaries strict) — Story 4.1 est l'**ouverture Epic 4** (saga booking-payment R11 critique) et template Pretre pour les Stories Epic 4 downstream consumers :
- (a) **Scaffolding booking-svc Pretre** via `pnpm tsx infra/scripts/replicate-pretre-structure.sh --target=booking-svc` (Story 0.6 livré) — 5ᵉ service Pretre scaffolded after identity-svc (Story 0.6), gateway-api (Story 1.2), payment-svc (Story 2.1), catalog-svc (Story 3.1) — port 4010 docker-compose Story 0.10
- (b) **Domain `Booking` aggregate root** (`apps/booking-svc/src/domain/model/booking.aggregate.ts`) avec invariants stricts state machine FR47 :
```ts
export class Booking {
  readonly id: BookingId;
  readonly listingId: string;        // FK logique → catalog-svc.listing.id
  readonly listingSnapshot: ListingSnapshot; // VO embedded — frozen at booking time (anti-changement prix post-booking)
  readonly customerProfileId: string; // FK logique → identity-svc.user_profiles.id (Customer)
  readonly proProfileId: string;      // FK logique → identity-svc.pro_profiles.id (Pro destinataire)
  period: BookingPeriod;              // VO {startAt, endAt} — invariants start < end, end - start ≥ 1h, ≤ 30 jours
  quantity: number;                   // 1+ — multiplie unitPricing si mode='unit'
  options: BookingOption[] | null;    // V1+ — MVP no options (placeholder Story 4.3 cart)
  totalAmount: Money;                 // VO {amountCents, currency='EUR'} — figé à la création (= listingSnapshot.pricing × quantity)
  capturePolicy: CapturePolicy;       // VO — 'manual_at_pro_accept' MVP (Stripe capture_method='manual')
  status: BookingStatus;              // 'pending_pro_acceptance' | 'confirmed' | 'completed' | 'cancelled' | 'refused'
  expiresAt: Date | null;             // null si status ∉ pending — sinon NOW() + 48h (cron auto-expire Story 4.7)
  cancellationReason: CancellationReason | null; // VO {reason, actor: 'customer'|'pro'|'system', at: Date}
  refusalReason: string | null;       // optional pro feedback Story 4.7
  acceptedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  refusedAt: Date | null;
  correlationId: string;              // saga correlation — ADR-006 + CorrelationContext Story 0.7
  version: number;                    // optimistic locking — Layer 3 race conditions Story 4.4
  uncommittedEvents: DomainEvent[];   // appended at every state transition, drained by repository post-save
  createdAt: Date; updatedAt: Date; deletedAt: Date | null;

  // Static factory (creation rules — initial state = pending_pro_acceptance directement post-payment-auth ; "request" conceptuel UX, pas persisté DB)
  static create(input: {
    listingId: string;
    listingSnapshot: ListingSnapshot;
    customerProfileId: string;
    proProfileId: string;
    period: BookingPeriod;
    quantity: number;
    options: BookingOption[] | null;
    capturePolicy: CapturePolicy;
    correlationId: string;
  }): Booking {
    // invariants
    if (input.customerProfileId === /* pro userId derive */ input.listingSnapshot.proUserProfileId) {
      throw new BookingValidationException({ field: 'customerProfileId', code: 'self-booking-forbidden' });
    }
    if (input.period.startAt < new Date()) {
      throw new BookingValidationException({ field: 'period.startAt', code: 'past-date-forbidden' });
    }
    const minLeadTime = input.listingSnapshot.serviceArea.minLeadTimeDays;
    const daysUntilStart = Math.floor((input.period.startAt.getTime() - Date.now()) / 86400000);
    if (daysUntilStart < minLeadTime) {
      throw new BookingValidationException({ field: 'period.startAt', code: 'lead-time-not-met', details: { minLeadTimeDays: minLeadTime } });
    }
    if (input.quantity < 1) throw new BookingValidationException({ field: 'quantity', code: 'min-1' });
    if (input.listingSnapshot.pricing.mode === 'unit' && input.listingSnapshot.pricing.minQuantity && input.quantity < input.listingSnapshot.pricing.minQuantity) {
      throw new BookingValidationException({ field: 'quantity', code: 'below-min-quantity', details: { min: input.listingSnapshot.pricing.minQuantity } });
    }
    // compute totalAmount
    const totalAmount = computeTotalAmount(input.listingSnapshot.pricing, input.quantity, input.options);
    const booking = Object.assign(new Booking(), {
      id: BookingId.generate(),
      ...input,
      totalAmount,
      status: BookingStatus.PENDING_PRO_ACCEPTANCE,
      expiresAt: new Date(Date.now() + 48 * 3600 * 1000), // 48h auto-expire Story 4.7
      cancellationReason: null,
      refusalReason: null,
      acceptedAt: null,
      completedAt: null,
      cancelledAt: null,
      refusedAt: null,
      version: 0,
      uncommittedEvents: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });
    booking.appendEvent(new BookingRequestedEvent({ bookingId: booking.id.value, correlationId: input.correlationId, /* payload cf. AC4 */ }));
    return booking;
  }

  // Domain state transitions (state machine — Story 4.1 implements transitions + invariants ; full business logic in Stories 4.4-4.10)
  acceptByPro(actorProUserId: string): void {
    this.ensureCanTransition(BookingStatus.PENDING_PRO_ACCEPTANCE, BookingStatus.CONFIRMED);
    if (this.expiresAt && this.expiresAt < new Date()) throw new BookingException('BOOKING-EXPIRED', 'Cannot accept: 48h window expired (auto-refused)');
    this.status = BookingStatus.CONFIRMED;
    this.acceptedAt = new Date();
    this.expiresAt = null;
    this.version++;
    this.appendStatusChangedEvent({ from: 'pending_pro_acceptance', to: 'confirmed', actor: { type: 'pro', userId: actorProUserId } });
    this.appendEvent(new BookingConfirmedEvent({ bookingId: this.id.value, correlationId: this.correlationId }));
  }

  refuseByPro(actorProUserId: string, reason: string | null): void {
    this.ensureCanTransition(BookingStatus.PENDING_PRO_ACCEPTANCE, BookingStatus.REFUSED);
    this.status = BookingStatus.REFUSED;
    this.refusedAt = new Date();
    this.refusalReason = reason;
    this.expiresAt = null;
    this.version++;
    this.appendStatusChangedEvent({ from: 'pending_pro_acceptance', to: 'refused', actor: { type: 'pro', userId: actorProUserId }, reason: reason ?? undefined });
    this.appendEvent(new BookingRefusedEvent({ bookingId: this.id.value, correlationId: this.correlationId, reason }));
  }

  autoExpire(): void {
    this.ensureCanTransition(BookingStatus.PENDING_PRO_ACCEPTANCE, BookingStatus.REFUSED);
    if (!this.expiresAt || this.expiresAt > new Date()) throw new BookingException('BOOKING-NOT-YET-EXPIRED', 'Cannot auto-expire: 48h window still active');
    this.status = BookingStatus.REFUSED;
    this.refusedAt = new Date();
    this.refusalReason = '__system_auto_expired__'; // sentinel — Story 4.7 cron + Story 5.4 notification template differentiates
    this.expiresAt = null;
    this.version++;
    this.appendStatusChangedEvent({ from: 'pending_pro_acceptance', to: 'refused', actor: { type: 'system', userId: 'system' }, reason: 'auto-expired-48h' });
    this.appendEvent(new BookingRefusedEvent({ bookingId: this.id.value, correlationId: this.correlationId, reason: '__system_auto_expired__' }));
  }

  cancelByCustomer(actorCustomerUserId: string, reason: CancellationReason): void {
    // can cancel from pending_pro_acceptance OR confirmed (different refund policy Story 4.8)
    if (this.status !== BookingStatus.PENDING_PRO_ACCEPTANCE && this.status !== BookingStatus.CONFIRMED) {
      throw new InvalidTransitionException({ from: this.status, to: BookingStatus.CANCELLED, bookingId: this.id.value });
    }
    const fromStatus = this.status;
    this.status = BookingStatus.CANCELLED;
    this.cancelledAt = new Date();
    this.cancellationReason = reason;
    this.expiresAt = null;
    this.version++;
    this.appendStatusChangedEvent({ from: fromStatus, to: 'cancelled', actor: { type: 'customer', userId: actorCustomerUserId }, reason: reason.reason });
    this.appendEvent(new BookingCancelledEvent({ bookingId: this.id.value, correlationId: this.correlationId, cancelledFromStatus: fromStatus, reason }));
  }

  cancelByPro(actorProUserId: string, reason: CancellationReason): void {
    // pro can cancel from confirmed (force majeure) — pre-event only
    this.ensureCanTransition(BookingStatus.CONFIRMED, BookingStatus.CANCELLED);
    if (this.period.startAt < new Date()) throw new BookingException('BOOKING-CANNOT-CANCEL-PAST', 'Cannot cancel: event already happened');
    this.status = BookingStatus.CANCELLED;
    this.cancelledAt = new Date();
    this.cancellationReason = reason;
    this.version++;
    this.appendStatusChangedEvent({ from: 'confirmed', to: 'cancelled', actor: { type: 'pro', userId: actorProUserId }, reason: reason.reason });
    this.appendEvent(new BookingCancelledEvent({ bookingId: this.id.value, correlationId: this.correlationId, cancelledFromStatus: 'confirmed', reason }));
  }

  complete(): void {
    this.ensureCanTransition(BookingStatus.CONFIRMED, BookingStatus.COMPLETED);
    if (this.period.endAt > new Date()) throw new BookingException('BOOKING-CANNOT-COMPLETE-EARLY', 'Cannot complete: event not yet finished');
    this.status = BookingStatus.COMPLETED;
    this.completedAt = new Date();
    this.version++;
    this.appendStatusChangedEvent({ from: 'confirmed', to: 'completed', actor: { type: 'system', userId: 'system' }, reason: 'cron-post-event-J+1' });
    this.appendEvent(new BookingCompletedEvent({ bookingId: this.id.value, correlationId: this.correlationId }));
  }

  // private helpers
  private ensureCanTransition(from: BookingStatus, to: BookingStatus): void {
    if (this.status !== from) throw new InvalidTransitionException({ from: this.status, to, bookingId: this.id.value });
    if (!BookingStateMachine.canTransition(from, to)) throw new InvalidTransitionException({ from, to, bookingId: this.id.value });
    this.updatedAt = new Date();
  }
  private appendEvent(event: DomainEvent): void { this.uncommittedEvents.push(event); }
  private appendStatusChangedEvent(input: { from: BookingStatus; to: BookingStatus; actor: Actor; reason?: string }): void {
    this.appendEvent(new BookingStatusChangedEvent({ bookingId: this.id.value, correlationId: this.correlationId, ...input, at: new Date() }));
  }
}
```
- (c) **5 value-objects** (`apps/booking-svc/src/domain/model/value-objects/`) — pure TS, no I/O imports (lint boundaries enforce) :
  - **`booking-id.vo.ts`** : `BookingId` UUID v7 (sortable by createdAt) — factory `BookingId.generate()` uses `uuid` v11+ latest stable v7 mode (vs v4 random — v7 preferred pour ordering DB index)
  - **`booking-status.vo.ts`** : `BookingStatus` enum + helpers `isTerminal(status)` (completed | cancelled | refused) + `isMutable(status)` (pending_pro_acceptance | confirmed)
  - **`booking-period.vo.ts`** : `BookingPeriod` `{ startAt: Date, endAt: Date }` immutable VO — invariants : `startAt < endAt`, `endAt - startAt >= 1h`, `endAt - startAt <= 30 days` (single-event scope MVP — V1+ multi-day events). Méthodes : `durationHours(): number`, `durationDays(): number`, `overlaps(other: BookingPeriod): boolean`, `toJSON(): { startAt: ISO8601, endAt: ISO8601 }`
  - **`capture-policy.vo.ts`** : `CapturePolicy` discriminated union :
    ```ts
    export type CapturePolicy =
      | { kind: 'manual_at_pro_accept' } // MVP — Stripe capture_method='manual', captured by payment-svc Story 4.7 on accept
      | { kind: 'manual_at_event_start' } // V1+ FR50 saved card pre-auth
      | { kind: 'split_30_70' };          // V1+ FR51 échéancier
    ```
  - **`cancellation-reason.vo.ts`** : `CancellationReason` `{ reason: string (1-500 chars), reasonCode: 'customer-changed-mind' | 'pro-force-majeure' | 'admin-decision' | 'system-auto-expired' | 'other', actor: 'customer' | 'pro' | 'admin' | 'system', at: Date }` — pattern Story 1.9 anonymization + Story 6.5 admin sanction ready
  - **`listing-snapshot.vo.ts`** : `ListingSnapshot` immutable VO — frozen view of listing at booking time (anti-changement price/options post-booking). Shape :
    ```ts
    interface ListingSnapshot {
      listingId: string;
      slug: string;
      titleFr: string;
      titleEn: string | null;
      pricing: { mode: 'unit' | 'package'; amountCents: number; currency: 'EUR'; unit?: string; minQuantity?: number | null; maxQuantity?: number | null; packageDescription?: string };
      serviceArea: { originPostalCode: string; deliveryRadiusKm: number; minLeadTimeDays: number };
      proProfileId: string;
      proUserProfileId: string; // for self-booking check
      photoThumbnailUrl: string | null; // for booking list display
      capturedAt: Date; // when snapshot was fetched from catalog-svc
    }
    ```
  - **`booking-option.vo.ts`** : `BookingOption` `{ id: string, label: string, priceCents: number }` — V1+ FR placeholder, MVP empty array null
  - Tests VOs ≥ 95 % chaque : happy + each invariant violation + edge cases (boundary periods, durations, snapshot serialization)

- (d) **4 ports** (`apps/booking-svc/src/domain/ports/`) — interfaces only, no implementations (infrastructure/external livre les impls) :
  - **`booking-repository.port.ts`** (`IBookingRepository`) :
    ```ts
    export interface IBookingRepository {
      findById(id: string): Promise<Booking | null>;
      findByCustomerProfileId(input: { customerProfileId: string; status?: BookingStatus[]; cursor?: string; limit?: number }): Promise<{ items: Booking[]; nextCursor: string | null }>; // cursor pagination Story 2.3 pattern réutilisé
      findByProProfileId(input: { proProfileId: string; status?: BookingStatus[]; cursor?: string; limit?: number }): Promise<{ items: Booking[]; nextCursor: string | null }>;
      findPendingExpiringBefore(date: Date, limit: number): Promise<Booking[]>; // Story 4.7 auto-expire cron
      findConfirmedEndedBefore(date: Date, limit: number): Promise<Booking[]>; // Story 4.10 complete cron J+1
      save(booking: Booking): Promise<void>; // upsert + cascade booking_status_transition + drain uncommittedEvents to outbox (transactional)
    }
    ```
  - **`listing-snapshot.port.ts`** (`IListingSnapshotPort`) — cross-svc boundary catalog-svc (ADR-003 + ADR-008 — communication via internal endpoint + X-Internal-Service-Token, EXCEPTION explicit cross-svc HTTP sync call autorisée Architecture line 2154-2155 like booking↔catalog pattern) :
    ```ts
    export interface IListingSnapshotPort {
      fetchSnapshot(listingId: string): Promise<ListingSnapshot>; // calls catalog-svc GET /internal/listings/by-id/:id (NEW Story 4.1 catalog-svc internal endpoint)
      // throws ListingNotFoundException si 404 catalog-svc
      // throws ListingUnpublishedException si listing.status !== 'published' (anti-booking on draft/unpublished)
    }
    ```
  - **`availability-lock.port.ts`** (`IAvailabilityLockPort`) — Redis distributed lock Layer 1/3 R5 (Story 4.4 finalise full 3-layer protection — Story 4.1 livre le port + minimal Redis SET NX impl) :
    ```ts
    export interface IAvailabilityLockPort {
      acquire(listingId: string, period: BookingPeriod, ttlSeconds: number): Promise<{ lockId: string } | null>; // returns null si lock occupé
      release(lockId: string): Promise<void>;
    }
    ```
  - **`event-publisher.port.ts`** (`IEventPublisher`) — Story 0.7 livré `OutboxPublisher` from `@tukio/messaging` (`OUTBOX_PUBLISHER` symbol) — wired in `usecases-proxy.module.ts` :
    ```ts
    export interface IEventPublisher {
      publish(event: DomainEvent, transaction?: TransactionContext): Promise<void>; // transactional outbox ADR-007
    }
    ```

- (e) **`BookingStateMachine` domain service** (`apps/booking-svc/src/domain/service/booking-state-machine.service.ts`) — pure logic, no I/O :
```ts
export class BookingStateMachine {
  private static readonly TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
    [BookingStatus.PENDING_PRO_ACCEPTANCE]: [BookingStatus.CONFIRMED, BookingStatus.REFUSED, BookingStatus.CANCELLED],
    [BookingStatus.CONFIRMED]: [BookingStatus.COMPLETED, BookingStatus.CANCELLED],
    [BookingStatus.COMPLETED]: [], // terminal
    [BookingStatus.CANCELLED]: [], // terminal
    [BookingStatus.REFUSED]: [], // terminal
  };
  static canTransition(from: BookingStatus, to: BookingStatus): boolean {
    return this.TRANSITIONS[from]?.includes(to) ?? false;
  }
  static getAllowedTransitions(from: BookingStatus): BookingStatus[] {
    return this.TRANSITIONS[from] ?? [];
  }
  static isTerminal(status: BookingStatus): boolean {
    return this.TRANSITIONS[status]?.length === 0;
  }
}
```
Tests unit ≥ 95 % BookingStateMachine : tous transitions valides + tous transitions invalides + isTerminal pour chaque status + edge case enum invalid value.

- (f) **5 exceptions** (`apps/booking-svc/src/domain/exception/`) :
  - **`booking.exception.ts`** : `BookingException` base — generic `code` + `message` + optional `details`
  - **`invalid-transition.exception.ts`** : `InvalidTransitionException` — `{ from, to, bookingId }` + `toEnvelope()` → 409 `BOOKING-INVALID-TRANSITION-001`
  - **`booking-not-found.exception.ts`** : `BookingNotFoundException` → 404 `BOOKING-NOT-FOUND-002`
  - **`booking-validation.exception.ts`** : `BookingValidationException` — `{ field, code, details? }` → 422 `BOOKING-VALIDATION-003` (factory invariants)
  - **`listing-snapshot.exception.ts`** : `ListingNotFoundException` + `ListingUnpublishedException` (cross-svc port impl Story 4.1) → 409 `BOOKING-LISTING-UNAVAILABLE-004`
  - Tests : exception construction + serialization (`toEnvelope()` method for ADR-014 mapping)
  - **Layer 1/2/3 conflict exceptions** sont livrées **Story 4.4** (`BOOKING-CONFLICT-001/002/003`) — Story 4.1 ne livre que les base exceptions

- (g) **8 use cases skeletons** (`apps/booking-svc/src/usecases/`) — Story 4.1 livre **skeletons** (signature + invocation pattern via UseCaseProxy Story 0.6) + invariants domain via aggregate. **Full business logic** (3-layer race conditions, Stripe integration, cron schedulers, notification dispatch) sera livrée par Stories 4.4-4.10 :
  | Use case | Scope Story 4.1 (skeleton) | Consumer downstream |
  |----------|---------------------------|----------------------|
  | `book-listing.usecase.ts` | **Skeleton** : appel `availabilityLock.acquire` (port impl basic Redis SET NX MVP) + `listingSnapshot.fetch` + `Booking.create()` + `repository.save()` (outbox event) | Story 4.4 finalise 3-layer race conditions + Story 4.5 Stripe PaymentIntent integration |
  | `accept-booking.usecase.ts` | **Skeleton** : `repository.findById` + `booking.acceptByPro(actorUserId)` + `repository.save()` (outbox `booking.confirmed.v1` + `booking.status-changed.v1`) | Story 4.7 finalise Stripe capture trigger + notification |
  | `refuse-booking.usecase.ts` | **Skeleton** : `repository.findById` + `booking.refuseByPro(actorUserId, reason)` + `repository.save()` (outbox `booking.refused.v1`) | Story 4.7 finalise Stripe cancel PaymentIntent + notification |
  | `cancel-booking-by-customer.usecase.ts` | **Skeleton** : `repository.findById` + `booking.cancelByCustomer(...)` + `repository.save()` (outbox `booking.cancelled.v1`) | Story 4.8 finalise cancellation policy + refund |
  | `cancel-booking-by-pro.usecase.ts` | **Skeleton** : similar + invariant pre-event only | Story 4.8 finalise (rare case force majeure) |
  | `auto-expire-booking.usecase.ts` | **Skeleton** : `repository.findPendingExpiringBefore(NOW, batch)` + iterate + `booking.autoExpire()` + `repository.save()` | Story 4.7 finalise cron @Cron('*/10 * * * *') 10min granularity + notification |
  | `complete-booking.usecase.ts` | **Skeleton** : `repository.findConfirmedEndedBefore(NOW - 24h, batch)` + iterate + `booking.complete()` + `repository.save()` | Story 4.10 finalise cron @Cron('0 2 * * *') daily 2am UTC + Stripe transfer trigger |
  | `list-customer-bookings.usecase.ts` | **Full** : `repository.findByCustomerProfileId({ customerProfileId, status?, cursor })` cursor pagination | Story 4.11 customer bookings list page |
  | `list-pro-bookings.usecase.ts` | **Full** : `repository.findByProProfileId({ proProfileId, status?, cursor })` | Story 4.6 pro pending requests page + Story 4.11 |
  | `get-booking-detail.usecase.ts` | **Full** : `repository.findById` + ACL check (only customer || pro || admin can view) | Story 4.6 + 4.11 |

- (h) **DB migration `booking` + `booking_status_transition` baseline** (Story 4.1 livre baseline — Story 4.4 ajoute exclusion constraint GIST Layer 2) :
```sql
-- migration 1715600000000-CreateBookingTables.ts
CREATE TABLE booking (
  id UUID PRIMARY KEY, -- UUID v7 sortable
  listing_id UUID NOT NULL, -- FK logique cross-svc (catalog-svc.listing.id, no DB FK)
  listing_snapshot JSONB NOT NULL, -- frozen at booking time
  customer_profile_id UUID NOT NULL, -- FK logique identity-svc.user_profiles.id
  pro_profile_id UUID NOT NULL, -- FK logique identity-svc.pro_profiles.id
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity >= 1),
  options JSONB NULL, -- V1+ array of BookingOption
  total_amount_cents BIGINT NOT NULL CHECK (total_amount_cents >= 0),
  total_amount_currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
  capture_policy JSONB NOT NULL, -- discriminated union — MVP {kind: 'manual_at_pro_accept'}
  status VARCHAR(40) NOT NULL CHECK (status IN ('pending_pro_acceptance', 'confirmed', 'completed', 'cancelled', 'refused')),
  expires_at TIMESTAMPTZ NULL, -- NULL if status ∉ pending (Story 4.7 cron auto-expire 48h)
  cancellation_reason JSONB NULL, -- CancellationReason VO {reason, reasonCode, actor, at}
  refusal_reason TEXT NULL CHECK (refusal_reason IS NULL OR length(refusal_reason) <= 500),
  accepted_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  cancelled_at TIMESTAMPTZ NULL,
  refused_at TIMESTAMPTZ NULL,
  correlation_id UUID NOT NULL, -- saga correlation ADR-006
  version INTEGER NOT NULL DEFAULT 0, -- optimistic lock Layer 3 race conditions
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL
);

-- Indexes performance-friendly partials
CREATE INDEX idx_booking_customer_status ON booking (customer_profile_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_booking_pro_status ON booking (pro_profile_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_booking_pro_pending_expires ON booking (pro_profile_id, expires_at) WHERE status = 'pending_pro_acceptance' AND deleted_at IS NULL; -- Story 4.6 pro queue
CREATE INDEX idx_booking_pending_expires_at ON booking (expires_at) WHERE status = 'pending_pro_acceptance' AND deleted_at IS NULL; -- Story 4.7 cron
CREATE INDEX idx_booking_confirmed_end_at ON booking (end_at) WHERE status = 'confirmed' AND deleted_at IS NULL; -- Story 4.10 cron
CREATE INDEX idx_booking_listing_period ON booking (listing_id, start_at, end_at) WHERE status IN ('pending_pro_acceptance', 'confirmed') AND deleted_at IS NULL; -- Story 4.4 future exclusion constraint GIST
CREATE INDEX idx_booking_correlation_id ON booking (correlation_id); -- saga reconstruction R11

-- updated_at trigger Story 1.10 réutilisé
CREATE TRIGGER booking_updated_at BEFORE UPDATE ON booking FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TABLE booking_status_transition (
  id UUID PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES booking(id) ON DELETE CASCADE,
  from_status VARCHAR(40) NOT NULL,
  to_status VARCHAR(40) NOT NULL,
  actor_type VARCHAR(20) NOT NULL CHECK (actor_type IN ('customer', 'pro', 'admin', 'system')),
  actor_user_id VARCHAR(100) NOT NULL, -- 'system' sentinel for cron/saga
  reason TEXT NULL,
  at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_booking_status_transition_booking_at ON booking_status_transition (booking_id, at DESC); -- audit history retrieval

-- outbox/inbox tables Story 0.7 livré pattern — booking-svc replicate via `apps/booking-svc/src/infrastructure/persistence/typeorm/migrations/<timestamp+1>-CreateOutboxInbox.ts` (Story 0.7 template + Story 1.10 audit_log pattern)
```

- (i) **6 outbox events** (`packages/contracts/src/events/booking/`) — Story 4.1 livre schemas + types + outbox publishing dans aggregate :
  - `booking.requested.v1` — payload `{ bookingId, listingId, customerProfileId, proProfileId, period: { startAt, endAt }, quantity, totalAmount, correlationId, capturePolicy, requestedAt }` — consumed Story 4.2 order-svc + payment-svc
  - `booking.confirmed.v1` — payload `{ bookingId, customerProfileId, proProfileId, acceptedAt, correlationId }` — consumed Story 4.2 order-svc confirm + payment-svc capture
  - `booking.refused.v1` — payload `{ bookingId, refusalReason, isAutoExpired, refusedAt, correlationId }` — consumed Story 4.2 cancel + Story 5.4 notification + Story 2.7 audit
  - `booking.cancelled.v1` — payload `{ bookingId, cancellationReason, cancelledFromStatus, cancelledAt, correlationId }` — consumed Story 4.2 + Story 4.8 refund + Story 5.4
  - `booking.completed.v1` — payload `{ bookingId, completedAt, correlationId }` — consumed Story 4.10 transfer + Story 5.6 auto-request-review
  - `booking.status-changed.v1` — audit event for every transition (denormalized) — consumed Story 2.7 audit_log
  - **`booking.conflict-detected.v1`** — V1 stretch (NFR82 — Story 4.4 livre full) — Story 4.1 livre schema baseline pour Story 4.4 future
  - JSON Schemas v1 + types TS auto-generated + outbox-publisher wire via `@tukio/messaging` Story 0.7 `OutboxPublisher`

- (j) **Lint boundaries strict eslint-plugin-boundaries** (Story 0.6 livré config racine — Story 4.1 verify enforcement) : `pnpm --filter=booking-svc lint` 0 violations sur `apps/booking-svc/src/domain/**` — NO imports `@nestjs/*`, `typeorm`, `axios`, `stripe`, `ioredis`, `@upstash/redis`. Test failure case : créer temporairement `domain/test-violation.ts` avec `import { Stripe } from 'stripe'` → `pnpm lint` fail clear message → SUPPRIMER fichier (pas de commit).

**so that** Stories Epic 4 downstream (4.2 order-svc + payment-svc Pretre + saga consumers, 4.3 cart UI, 4.4 booking submission 3-layer race conditions, 4.5 Stripe PaymentIntent + Elements checkout, 4.6 pro pending requests page, 4.7 pro accept/refuse + Stripe capture, 4.8 customer cancellation flow, 4.9 invoice generation TVA, 4.10 auto-payout cron J+1, 4.11 customer/pro bookings list, 4.12 admin refund, 4.13 saga monitoring R11 alerts) consomment un **domain Booking solide testable** sans coupler aux détails infra (Stripe, Redis, Postgres, NATS, catalog-svc HTTP) — pure domain logic + ports interfaces. Le **pattern complet "aggregate root with state machine + multi-VO + multi-port + saga producer outbox events + cross-svc snapshot frozen at booking time"** devient template Stories Epic 5 (Conversation/Message aggregates avec state machine), Stories Epic 10 V1 (Dispute aggregate state machine + saga R11 evolution). C'est aussi la **fondation R11 saga choreographed** — sans Story 4.1, Stories 4.2-4.13 ne peuvent commencer.

> **Outcome attendu** : à la fin de cette story, `pnpm --filter=booking-svc lint` passe avec **0 violations boundaries** (domain pure) ; `pnpm --filter=booking-svc test --coverage` montre **≥ 95 % aggregate Booking + 5 VOs + BookingStateMachine** (state machine + invariants critical), **≥ 90 % use cases skeletons** (signature + invocation + outbox event publish), **≥ 80 % infrastructure** (TypeORM repository + ListingSnapshotClient HTTP cross-svc + Redis lock minimal) (NFR71) ; la migration `1715600000000-CreateBookingTables.ts` crée les 2 tables `booking` + `booking_status_transition` avec index partials performance-friendly + check constraints + trigger updated_at + correlation_id index pour saga reconstruction R11 ; un dev backend Story 4.4 (future 3-layer race conditions) peut `Booking.create({...})` + `repository.save(booking)` outbox `booking.requested.v1` publié visible `localhost:8222/jsz` ; un dev backend Story 4.2 (future order-svc consumer) peut subscribe `booking.requested.v1` outbox stream ; un test `pnpm vitest --filter=booking-svc test/domain` passe **50+ test cases** state machine transitions exhaustifs (5 statuts × matrix valide/invalide = 20+ cases) + VO invariants exhaustifs (BookingPeriod boundaries, CapturePolicy discriminated union, ListingSnapshot serialization, CancellationReason actor types, BookingId UUID v7 sortable) + aggregate factory invariants (self-booking-forbidden, past-date-forbidden, lead-time-not-met, below-min-quantity) ; la **handoff Stories 4.2-4.13** est documentée — chaque story future consume des use cases skeletons + ports prêts sans avoir à toucher au domain aggregate ; `_bmad-output/implementation-artifacts/sprint-status.yaml` flip Epic 4 = `in-progress` (transition backlog → in-progress automatique première story Epic 4 créée) ; un test `pnpm playwright test --grep "booking-svc health"` passe (basic health/ready endpoints exposed by Pretre baseline scaffold).

## Acceptance Criteria

1. **AC1 — Scaffolding booking-svc Pretre via replicate script + structure dossiers exacte** : Given Story 0.6 livré `infra/scripts/replicate-pretre-structure.sh` + Story 3.1 livré catalog-svc Pretre exemple récent, When je l'exécute `pnpm tsx infra/scripts/replicate-pretre-structure.sh --target=booking-svc`, Then :
   - **Structure scaffolded** `apps/booking-svc/src/` :
     ```
     apps/booking-svc/
     ├─ package.json, nest-cli.json, tsconfig.json, tsconfig.build.json, Dockerfile, .env.example
     └─ src/
        ├─ main.ts (port 4010 — UPDATE Story 0.10 docker-compose adds booking-svc service)
        ├─ app.module.ts
        ├─ domain/
        │  ├─ model/ (Story 4.1 livre Booking aggregate + 5 VOs)
        │  ├─ ports/ (Story 4.1 livre 4 ports)
        │  ├─ service/ (Story 4.1 livre BookingStateMachine)
        │  └─ exception/ (Story 4.1 livre 5 exceptions)
        ├─ usecases/ (Story 4.1 livre 9 use cases — 3 full + 6 skeletons)
        └─ infrastructure/
           ├─ persistence/typeorm/{entities,migrations,repositories}/
           ├─ external/{catalog-svc/listing-snapshot.client.ts, redis/availability-lock.service.ts}/
           ├─ messaging/nats/ (Story 0.7 OutboxPublisher wired via @tukio/messaging)
           ├─ http/controllers/ (Story 4.1 livre health/ready endpoints — Stories 4.4+ ajouteront business endpoints booking.controller.ts)
           ├─ logger/, config/, exception/
           └─ usecases-proxy/usecases-proxy.module.ts (DynamicModule wire ports → impls)
     ```
   - **`apps/booking-svc/eslint.config.mjs`** réutilise pattern Story 1.10 + Story 3.2 — extends root + adds booking-svc-specific boundary rules
   - **UPDATE `infra/docker-compose/docker-compose.dev.yml`** Story 0.10 livré — add `booking-svc` service port 4010 + healthcheck `/v1/health` + dependsOn `postgres-booking` (NEW DB instance OR shared with catalog) + redis + nats
   - **NEW database** `tukio_booking` (separate DB per service ADR-003 strict) — UPDATE `infra/scripts/bootstrap-databases.sh` Story 0.10 livré
   - **K8s manifests** : `infra/k8s/helm-charts/core-api/values-booking-svc.yaml` (NEW Story 4.1 — minimal MVP, full Story 0.12 helm charts) — pattern Story 1.10/3.2 réutilisé
   - Tests : `pnpm --filter=booking-svc build` passe + `pnpm --filter=booking-svc test --passWithNoTests` (placeholder) + `curl localhost:4010/v1/health` retourne 200 enveloppe

2. **AC2 — Domain `Booking` aggregate root + state machine 5 transitions** : Given Pretre scaffolding AC1, When je consulte `apps/booking-svc/src/domain/model/booking.aggregate.ts`, Then :
   - **Aggregate Booking** avec tous fields (cf. story body section b)
   - **Static factory `Booking.create({...})`** avec invariants : self-booking-forbidden, past-date-forbidden, lead-time-not-met (depuis listingSnapshot.serviceArea.minLeadTimeDays), below-min-quantity, total amount computation
   - **5 domain methods** Story 4.1 implémentées : `acceptByPro`, `refuseByPro`, `autoExpire`, `cancelByCustomer`, `cancelByPro`, `complete` (6 method = 5 transitions + auto-expire sub-variant)
   - **State machine via `BookingStateMachine.canTransition()`** centralized validation
   - **`BookingStatusChanged` domain event** appended at EACH transition + dedicated event types (`BookingRequestedEvent`, `BookingConfirmedEvent`, `BookingRefusedEvent`, `BookingCancelledEvent`, `BookingCompletedEvent`)
   - **`uncommittedEvents` collection** drained by repository post-save (transactional outbox ADR-007)
   - **Tests aggregate ≥ 95 %** : 50+ cases exhaustifs (factory invariants × 6, each transition allowed/forbidden × 12, terminal status × 3, version increment × 5, expiresAt set/clear × 4, event appending verify × 8)

3. **AC3 — 5 value-objects + invariants stricts** : Given AC2, When je consulte `apps/booking-svc/src/domain/model/value-objects/`, Then :
   - **`booking-id.vo.ts`** : `BookingId` UUID v7 sortable. Factory `BookingId.generate()` uses `uuid` v11+ `v7()` function (latest stable). `value` getter returns string. Tests : 5 cases (generate uniqueness + sortable by createdAt + parse valid + parse invalid throws + serialization)
   - **`booking-status.vo.ts`** : `BookingStatus` const enum `'pending_pro_acceptance' | 'confirmed' | 'completed' | 'cancelled' | 'refused'` + namespace helpers `BookingStatus.isTerminal`, `BookingStatus.isMutable`, `BookingStatus.parse(value: unknown): BookingStatus` (throws). Tests : 6 cases (each status + invalid → throw)
   - **`booking-period.vo.ts`** : `BookingPeriod` immutable VO — invariants : `startAt < endAt`, `endAt - startAt >= 1h`, `endAt - startAt <= 30 days`. Méthodes : `durationHours`, `durationDays`, `overlaps(other)`, `toJSON`. Tests ≥ 95 % : 12 cases (happy 2h period, exact 1h boundary, just-under-1h throws, exact 30 days boundary, just-over-30d throws, overlaps true/false 4 scenarios, durations calc + JSON serialize)
   - **`capture-policy.vo.ts`** : `CapturePolicy` discriminated union (3 kinds). Factory + type-guard helpers. Tests : 3 cases (each kind)
   - **`cancellation-reason.vo.ts`** : `CancellationReason` VO + factory + actor enum + reasonCode enum. Tests ≥ 95 % : 8 cases (each actor × happy + reason too long throws + reason empty throws + reasonCode invalid throws)
   - **`listing-snapshot.vo.ts`** : `ListingSnapshot` immutable VO + factory `ListingSnapshot.fromCatalogResponse(response)` + invariants (pricing mode discriminated, capturedAt non-future). Tests ≥ 95 % : 6 cases (unit pricing snapshot, package pricing snapshot, mode invalid throws, capturedAt future throws, JSON round-trip preserves shape, deep frozen post-creation)
   - **`booking-option.vo.ts`** : MVP placeholder VO (V1+ FR options). Tests : 3 cases (factory + invariants + JSON)

4. **AC4 — 4 ports + 5 exceptions** : Given AC2, When je consulte `apps/booking-svc/src/domain/ports/` + `domain/exception/`, Then :
   - **Ports** (interfaces only) :
     - `booking-repository.port.ts` (`IBookingRepository`) — 6 méthodes (findById, findByCustomerProfileId cursor, findByProProfileId cursor, findPendingExpiringBefore, findConfirmedEndedBefore, save)
     - `listing-snapshot.port.ts` (`IListingSnapshotPort`) — 1 méthode `fetchSnapshot(listingId)` — throws ListingNotFoundException + ListingUnpublishedException
     - `availability-lock.port.ts` (`IAvailabilityLockPort`) — `acquire(listingId, period, ttlSeconds)` + `release(lockId)` (Redis SET NX MVP — Story 4.4 finalise full 3-layer)
     - `event-publisher.port.ts` (`IEventPublisher`) — Story 0.7 `OutboxPublisher` wired
   - **Exceptions** (5 = 5 base) :
     - `booking.exception.ts` (`BookingException` base — generic `code` + `message` + `details` + `toEnvelope()`)
     - `invalid-transition.exception.ts` (`InvalidTransitionException` extends BookingException — `code='BOOKING-INVALID-TRANSITION-001'` → 409 ADR-014)
     - `booking-not-found.exception.ts` (`BookingNotFoundException` — `code='BOOKING-NOT-FOUND-002'` → 404)
     - `booking-validation.exception.ts` (`BookingValidationException` — `code='BOOKING-VALIDATION-003'` → 422 with field + details)
     - `listing-snapshot.exception.ts` (`ListingNotFoundException` + `ListingUnpublishedException` — `code='BOOKING-LISTING-UNAVAILABLE-004'` → 409)
   - **Layer 1/2/3 race condition exceptions** `BOOKING-CONFLICT-001/002/003` sont **deferred Story 4.4** (cf. epic line 1654-1656)
   - Tests : exception construction + serialization (`toEnvelope()` method for ADR-014 mapping) + chain (BookingException sub-class instanceof check)

5. **AC5 — `BookingStateMachine` domain service** : Given AC4, When je consulte `apps/booking-svc/src/domain/service/booking-state-machine.service.ts`, Then :
   - **`BookingStateMachine` static class** avec TRANSITIONS matrix immutable (cf. story body section e)
   - **3 méthodes statiques** : `canTransition(from, to)` boolean, `getAllowedTransitions(from)` array, `isTerminal(status)` boolean
   - Tests unit ≥ 95 % : 20+ cases (matrix complète 5 × 5 = 25 cases — 5 invalid each from each, 5 valid pending→{confirmed,refused,cancelled}, 2 valid confirmed→{completed,cancelled}, 0 from terminals) + isTerminal × 5 + getAllowedTransitions × 5

6. **AC6 — 9 use cases (3 full + 6 skeletons) + UseCaseProxy wired** : Given AC2-5, When je consulte `apps/booking-svc/src/usecases/` + `usecases-proxy/usecases-proxy.module.ts`, Then :
   - **Full implementations** (Story 4.1 livre fully) : `list-customer-bookings.usecase.ts`, `list-pro-bookings.usecase.ts`, `get-booking-detail.usecase.ts`
   - **Skeletons** (Story 4.1 livre signature + invocation pattern + outbox event publish + domain transition — full business logic in downstream stories) : `book-listing.usecase.ts` (Story 4.4 + 4.5), `accept-booking.usecase.ts` (Story 4.7), `refuse-booking.usecase.ts` (Story 4.7), `cancel-booking-by-customer.usecase.ts` (Story 4.8), `cancel-booking-by-pro.usecase.ts` (Story 4.8), `auto-expire-booking.usecase.ts` (Story 4.7 cron), `complete-booking.usecase.ts` (Story 4.10 cron)
   - **`UseCasesProxyModule` (DynamicModule)** wire 9 use cases + 4 ports → impls (TypeormBookingRepository + ListingSnapshotClient cross-svc HTTP + UpstashRedisAvailabilityLock minimal + OutboxPublisher from `@tukio/messaging` Story 0.7) — pattern Story 0.6 `UseCaseProxy<T>` réutilisé
   - **Tests use cases ≥ 90 %** : mock ports (repository + listingSnapshot + availabilityLock + eventPublisher) — verify domain method invocation + outbox event emit. Skeletons test : signature + happy path skeleton execution + delegate to aggregate domain method correctly

7. **AC7 — DB migration `booking` + `booking_status_transition` + indexes** : Given AC2, When je consulte `apps/booking-svc/src/infrastructure/persistence/typeorm/migrations/1715600000000-CreateBookingTables.ts` + `1715600000001-CreateOutboxInbox.ts` (Story 0.7 template), Then :
   - **2 tables créées** (cf. story body section h) + **outbox/inbox** tables Story 0.7 pattern
   - **Indexes partials performance-friendly** : `idx_booking_customer_status`, `idx_booking_pro_status`, `idx_booking_pro_pending_expires`, `idx_booking_pending_expires_at` (cron), `idx_booking_confirmed_end_at` (cron), `idx_booking_listing_period` (Story 4.4 future GIST exclusion), `idx_booking_correlation_id` (saga R11 reconstruction)
   - **Trigger `booking_updated_at`** réutilise pattern `trigger_set_updated_at()` Story 1.10
   - **Check constraints** : status enum, quantity >= 1, total_amount_cents >= 0, refusal_reason length ≤ 500
   - **`down()` migration** : DROP cascade ordre inverse FK + indexes + tables + trigger
   - **Story 4.4 ajoutera EXCLUDE USING GIST exclusion constraint** : `EXCLUDE USING GIST (listing_id WITH =, tstzrange(start_at, end_at, '[)') WITH &&) WHERE (status IN ('pending_pro_acceptance', 'confirmed'))` — Story 4.1 ne livre PAS (déféré Story 4.4 — extension `btree_gist` PG requise documentée Story 4.4)
   - Tests integration testcontainer Postgres 8 cases : migration up + down + check constraints (status enum violation, quantity 0 reject, total_amount negative reject), cascade FK booking_status_transition, partial indexes EXPLAIN ANALYZE common queries, soft-delete preserves transitions, trigger updates updated_at on UPDATE

8. **AC8 — TypeORM repository + entities + outbox transactional drain** : Given AC7, When je consulte `apps/booking-svc/src/infrastructure/persistence/typeorm/`, Then :
   - **2 entities** : `booking.entity.ts` (`@Entity('booking')`) + `booking-status-transition.entity.ts` (`@Entity('booking_status_transition')`) + outbox/inbox entities Story 0.7 réutilisés
   - **`booking.typeorm.repository.ts`** (`TypeormBookingRepository implements IBookingRepository`) :
     - `findById` → SELECT with JOIN status transitions optional + mapper to aggregate
     - `findByCustomerProfileId({ customerProfileId, status?, cursor })` — cursor pagination Story 2.3 pattern `(updated_at DESC, id DESC)` keyset
     - `findByProProfileId` — similar
     - `findPendingExpiringBefore(date, limit)` — `WHERE status = 'pending_pro_acceptance' AND expires_at < $1 AND deleted_at IS NULL ORDER BY expires_at ASC LIMIT $2`
     - `findConfirmedEndedBefore(date, limit)` — similar with end_at field
     - `save(booking)` — **transactional** (TypeORM `QueryRunner.startTransaction()`) :
       1. UPSERT booking row (optimistic lock check via `WHERE id = $1 AND version = $2 - 1` — fail throws `BookingOptimisticLockException` Story 4.4 stretch — Story 4.1 livre l'infrastructure, Story 4.4 livre exception)
       2. INSERT booking_status_transition rows (denormalized history)
       3. **Drain `booking.uncommittedEvents`** to outbox table (Story 0.7 `OutboxPublisher` pattern réutilisé) — `OutboxRelayService` PG LISTEN/NOTIFY relays to NATS post-commit
       4. Commit transaction OR rollback all on any failure
   - **`booking.mapper.ts`** static mapper aggregate ↔ entity (TypeORM-isolated boundary, pure functions)
   - Tests integration testcontainer Postgres + NATS 8 cases : save happy + outbox event drained, save with status transition cascade, findById not-found returns null, cursor pagination customer × 2 pages stable, findPendingExpiringBefore filter correct, findConfirmedEndedBefore filter correct, save rollback on event publish fail, save optimistic lock fail (Story 4.4 finalise — Story 4.1 stub assertion)

9. **AC9 — `IListingSnapshotPort` cross-svc HTTP impl + catalog-svc NEW internal endpoint** : Given AC4 port + Story 3.10 livré internal-listing-detail.controller.ts pattern, When Story 4.1 wire cross-svc, Then :
   - **NEW catalog-svc internal endpoint** `GET /internal/listings/by-id/:id?includeProSnapshot=true` (NEW Story 4.1 — pattern Story 3.10 internal réutilisé) — returns ListingSnapshot shape inline (listing + pro + pricing + serviceArea + photoThumbnailUrl) — uniquement listings with `status='published'` else throws + 404 (Story 4.1 catalog-svc UPDATE — co-located avec Story 3.10 internal-listing-detail.controller.ts)
   - **NEW booking-svc infra impl** `apps/booking-svc/src/infrastructure/external/catalog-svc/listing-snapshot.client.ts` (`ListingSnapshotClient implements IListingSnapshotPort`) — axios call avec `X-Internal-Service-Token` header (Doppler `INTERNAL_SERVICE_TOKEN` — pattern Story 3.2 réutilisé) + retry 2x exponential backoff (500ms/2s) + timeout 3s + circuit breaker V1+
   - **Throws** :
     - HTTP 404 catalog-svc → `ListingNotFoundException`
     - HTTP 409 status='unpublished'/'deleted' → `ListingUnpublishedException`
     - Network errors (timeout, 5xx) → bubble up (saga retry via outbox)
   - **Architecture exception explicit** : booking-svc → catalog-svc HTTP sync call autorisée (architecture lines 2154-2155 booking↔catalog availability check pattern documented) — ADR-003 strict cross-DB-no-SELECT respect + ADR-008 internal endpoint authentication
   - Tests : 6 scenarios (happy fetch, 404 → ListingNotFoundException, 409 unpublished → ListingUnpublishedException, timeout retry success on 2nd, timeout retry exhausted → bubble, X-Internal-Service-Token header verify)

10. **AC10 — `IAvailabilityLockPort` Redis Upstash impl baseline (Layer 1 Story 4.4 future)** : Given AC4 port, When je consulte `apps/booking-svc/src/infrastructure/external/redis/availability-lock.service.ts`, Then :
    - **`UpstashRedisAvailabilityLock implements IAvailabilityLockPort`** :
      - `acquire(listingId, period, ttlSeconds)` — `SET key=lock:listing:{listingId}:{period.startAt}:{period.endAt} value=<lockId nanoid> NX PX <ttlSeconds * 1000>`. Returns `{ lockId }` if set, null if occupied
      - `release(lockId)` — uses lua script atomicity (`if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`)
    - **Upstash Redis Cloud** SDK `@upstash/redis` latest stable v1.40+ (Story 0.10 docker-compose dev local Redis OR Upstash Cloud staging/prod — env switch via `REDIS_PROVIDER` Doppler)
    - **TTL default 30s** (matches Story 4.4 epic AC line 1654 layer 1)
    - **Lock keys naming convention** `lock:listing:<listingId>:<startAtISO8601>:<endAtISO8601>` — granularity = (listing, exact period). Different periods on same listing = different locks (multi-customer parallel reservations on different dates OK)
    - Tests integration testcontainer Redis 5 scenarios : acquire happy, acquire occupied → null, release happy, release wrong lockId → no-op, TTL auto-expire after 30s

11. **AC11 — `IEventPublisher` OutboxPublisher wired via `@tukio/messaging` + 6 event schemas** : Given Story 0.7 livré `OutboxPublisher` + Story 1.10 audit_log + Story 2.7 audit pattern, When Story 4.1 wire booking-svc, Then :
    - **`OutboxPublisher`** from `@tukio/messaging` wired in `usecases-proxy.module.ts` :
      ```ts
      { provide: 'EVENT_PUBLISHER', useExisting: OutboxPublisher }
      ```
    - **`OutboxRelayModule.forRoot({...})`** registered in app.module.ts (pattern Story 0.7 réutilisé Stories 1.10/3.2)
    - **NATS streams configured** : `BOOKING` stream with subjects `booking.*` — Story 0.7 livré stream creation infrastructure
    - **6 event schemas** in `packages/contracts/src/events/booking/` :
      - `requested.v1.{schema.json,ts}`, `confirmed.v1`, `refused.v1`, `cancelled.v1`, `completed.v1`, `status-changed.v1`
      - JSON Schema v7 validation + TypeScript types auto-generated via `json-schema-to-typescript` Story 0.2 pattern
      - **Story 4.4 reserve** `conflict-detected.v1` schema baseline (NFR82 audit Story 4.4 livre full + publisher wiring)
    - Tests : 6 events round-trip (publish → outbox table → PG LISTEN/NOTIFY → relay → NATS subject → JSON-Schema validation pass) — integration testcontainer Postgres + NATS

12. **AC12 — Lint boundaries strict eslint-plugin-boundaries + tests coverage NFR71** : Given Story 0.6 livré eslint-plugin-boundaries strict + Story 1.10 + 3.2 booking-svc enforcement précédent, When `pnpm --filter=booking-svc lint`, Then :
    - **0 violations boundaries** sur `apps/booking-svc/src/domain/**` — NO imports `@nestjs/*`, `typeorm`, `axios`, `stripe`, `ioredis`, `@upstash/redis`, `nats`
    - **0 violations boundaries** sur `apps/booking-svc/src/usecases/**` — NO imports infra-specific (only domain ports + domain models)
    - **Test failure case** : créer temporairement `domain/test-violation.ts` avec `import Stripe from 'stripe'` → `pnpm lint` fail clear message `"🚫 Pattern Pretre violation: domain/ must not import I/O libs. Move to infrastructure/."` → SUPPRIMER fichier (pas de commit)
    - **Coverage thresholds NFR71** : ≥ 95 % domain (aggregate + VOs + state machine + exceptions) + ≥ 90 % usecases + ≥ 80 % infrastructure (testcontainer Postgres + Redis + NATS)
    - **Coverage report** uploadé CI Story 0.11 → fail si < threshold

## Tasks / Subtasks

- [ ] **Task 1 — Scaffolding booking-svc Pretre via replicate script + docker-compose + bootstrap DB** (AC: #1)
  - [ ] 1.1 — `pnpm tsx infra/scripts/replicate-pretre-structure.sh --target=booking-svc` (Story 0.6 livré — verify works for 5ᵉ service)
  - [ ] 1.2 — UPDATE `apps/booking-svc/package.json` + `main.ts` port 4010
  - [ ] 1.3 — UPDATE `infra/docker-compose/docker-compose.dev.yml` Story 0.10 — add booking-svc + postgres-booking healthcheck dependsOn
  - [ ] 1.4 — UPDATE `infra/scripts/bootstrap-databases.sh` Story 0.10 — create `tukio_booking` DB
  - [ ] 1.5 — NEW `infra/k8s/helm-charts/core-api/values-booking-svc.yaml` minimal MVP
  - [ ] 1.6 — UPDATE `tsconfig.base.json` `paths` if needed (likely automatic via replicate)
  - [ ] 1.7 — Verify `pnpm --filter=booking-svc build` passes + `curl localhost:4010/v1/health` returns 200 enveloppe

- [ ] **Task 2 — Domain `Booking` aggregate root + state machine + 6 transitions** (AC: #2) — coverage ≥ 95 %
  - [ ] 2.1 — `apps/booking-svc/src/domain/model/booking.aggregate.ts` (aggregate + factory + 6 transition methods)
  - [ ] 2.2 — `booking.aggregate.spec.ts` 50+ cases exhaustifs (factory × 6 invariants + transitions × 12 + version × 5 + events × 8 + expiresAt × 4)

- [ ] **Task 3 — 5 value-objects + factory + invariants** (AC: #3) — coverage ≥ 95 %
  - [ ] 3.1 — `booking-id.vo.ts` UUID v7 (`uuid` v11+ latest stable)
  - [ ] 3.2 — `booking-status.vo.ts` enum + helpers
  - [ ] 3.3 — `booking-period.vo.ts` (immutable + invariants + methods + serialization)
  - [ ] 3.4 — `capture-policy.vo.ts` discriminated union
  - [ ] 3.5 — `cancellation-reason.vo.ts` + actor enum + reasonCode enum
  - [ ] 3.6 — `listing-snapshot.vo.ts` immutable + factory fromCatalogResponse
  - [ ] 3.7 — `booking-option.vo.ts` placeholder V1+
  - [ ] 3.8 — Tests VOs 30+ cases AC3

- [ ] **Task 4 — 4 ports + 5 exceptions** (AC: #4)
  - [ ] 4.1 — `apps/booking-svc/src/domain/ports/{booking-repository,listing-snapshot,availability-lock,event-publisher}.port.ts`
  - [ ] 4.2 — `apps/booking-svc/src/domain/exception/{booking,invalid-transition,booking-not-found,booking-validation,listing-snapshot}.exception.ts`
  - [ ] 4.3 — Tests exceptions construction + serialization 10 cases AC4

- [ ] **Task 5 — `BookingStateMachine` domain service** (AC: #5) — coverage ≥ 95 %
  - [ ] 5.1 — `apps/booking-svc/src/domain/service/booking-state-machine.service.ts`
  - [ ] 5.2 — Tests 25+ cases (matrix complète + helpers)

- [ ] **Task 6 — 9 use cases (3 full + 6 skeletons) + UseCasesProxyModule wired** (AC: #6) — coverage ≥ 90 %
  - [ ] 6.1 — Full `list-customer-bookings.usecase.ts` + spec (cursor pagination)
  - [ ] 6.2 — Full `list-pro-bookings.usecase.ts` + spec
  - [ ] 6.3 — Full `get-booking-detail.usecase.ts` + spec (ACL check)
  - [ ] 6.4 — Skeleton `book-listing.usecase.ts` + spec (signature + outbox event publish + domain invoke — Story 4.4/4.5 finalise)
  - [ ] 6.5 — Skeleton `accept-booking.usecase.ts` + spec
  - [ ] 6.6 — Skeleton `refuse-booking.usecase.ts` + spec
  - [ ] 6.7 — Skeleton `cancel-booking-by-customer.usecase.ts` + spec
  - [ ] 6.8 — Skeleton `cancel-booking-by-pro.usecase.ts` + spec
  - [ ] 6.9 — Skeleton `auto-expire-booking.usecase.ts` + spec
  - [ ] 6.10 — Skeleton `complete-booking.usecase.ts` + spec
  - [ ] 6.11 — `usecases-proxy/usecases-proxy.module.ts` wire 9 use cases + 4 ports → impls

- [ ] **Task 7 — DB migration `booking` + `booking_status_transition` + outbox/inbox + indexes** (AC: #7) — coverage ≥ 80 % integration
  - [ ] 7.1 — `1715600000000-CreateBookingTables.ts` (up + down + indexes + check constraints + trigger)
  - [ ] 7.2 — `1715600000001-CreateOutboxInbox.ts` (Story 0.7 template réutilisé)
  - [ ] 7.3 — Tests integration testcontainer Postgres 8 scenarios AC7

- [ ] **Task 8 — TypeORM entities + repository + mapper + transactional save with outbox drain** (AC: #8) — coverage ≥ 80 %
  - [ ] 8.1 — `entities/booking.entity.ts` + `booking-status-transition.entity.ts` + outbox/inbox entities
  - [ ] 8.2 — `repositories/booking.typeorm.repository.ts` (implements IBookingRepository — 6 methods)
  - [ ] 8.3 — `mappers/booking.mapper.ts` (aggregate ↔ entity)
  - [ ] 8.4 — Tests integration testcontainer Postgres + NATS 8 scenarios AC8

- [ ] **Task 9 — `IListingSnapshotPort` impl + catalog-svc NEW internal endpoint** (AC: #9)
  - [ ] 9.1 — NEW catalog-svc internal endpoint `GET /internal/listings/by-id/:id?includeProSnapshot=true` (UPDATE Story 3.10 internal-listing-detail.controller.ts — extend response shape)
  - [ ] 9.2 — `apps/booking-svc/src/infrastructure/external/catalog-svc/listing-snapshot.client.ts` (axios + retry + X-Internal-Service-Token + circuit breaker V1+)
  - [ ] 9.3 — Tests 6 scenarios AC9 (mock catalog-svc HTTP via nock OR contract testing)

- [ ] **Task 10 — `IAvailabilityLockPort` Upstash Redis impl baseline** (AC: #10)
  - [ ] 10.1 — `apps/booking-svc/src/infrastructure/external/redis/availability-lock.service.ts` (`UpstashRedisAvailabilityLock`)
  - [ ] 10.2 — `@upstash/redis` v1.40+ dependency added
  - [ ] 10.3 — Tests integration testcontainer Redis 5 scenarios AC10 (Story 0.10 dev local Redis OR Upstash Cloud staging mock)

- [ ] **Task 11 — `OutboxPublisher` wired + 6 event schemas `packages/contracts/src/events/booking/`** (AC: #11)
  - [ ] 11.1 — Wire OutboxPublisher in usecases-proxy.module.ts + OutboxRelayModule.forRoot in app.module.ts
  - [ ] 11.2 — Configure NATS stream `BOOKING` with subjects `booking.*` (Story 0.7 pattern)
  - [ ] 11.3 — Add 6 event schemas + types `packages/contracts/src/events/booking/{requested,confirmed,refused,cancelled,completed,status-changed}.v1.{schema.json,ts}` + index export
  - [ ] 11.4 — Tests integration round-trip 6 events AC11

- [ ] **Task 12 — eslint-plugin-boundaries strict enforcement + coverage NFR71** (AC: #12)
  - [ ] 12.1 — `pnpm --filter=booking-svc lint` → 0 violations boundaries (verify domain + usecases pure)
  - [ ] 12.2 — Test boundary fail case (temporary violation file → lint fail → DELETE file, no commit)
  - [ ] 12.3 — Coverage NFR71 thresholds enforced (≥ 95 % domain + ≥ 90 % usecases + ≥ 80 % infrastructure)
  - [ ] 12.4 — CI Story 0.11 fail-fast on coverage regression

- [ ] **Task 13 — Documentation + handoff Stories 4.2-4.13 + commit**
  - [ ] 13.1 — UPDATE `docs/project-context.md` add section "Booking & Saga Foundation (Story 4.1)" — résumé Booking aggregate + state machine + saga choreographed producer + 4 ports + 8 use cases + cross-svc boundaries booking↔catalog
  - [ ] 13.2 — NEW runbook `docs/runbook/booking-saga-debug.md` (~30 lignes — debugging outbox lag + correlationId reconstruction + state machine transitions + cron 48h auto-expire + Story 4.13 future saga monitoring R11)
  - [ ] 13.3 — UPDATE `docs/adr/0006-saga-choreographed.md` Implementation Notes (Story 4.1 livre producer pattern, Story 4.2 livre consumers)
  - [ ] 13.4 — Commit `feat(booking-svc,catalog,contracts,messaging): Story 4.1 booking-svc Pretre + Booking aggregate state machine 5 statuses + 5 VOs + 4 ports + 9 use cases + DB tables + 6 outbox events + lint boundaries strict + saga choreographed producer foundation R11`

## Dev Notes

### Pourquoi Story 4.1 ouvre Epic 4 R11 critique

Story 4.1 est l'**ouverture Epic 4** (Booking + Cart + Payment Saga MVP) — l'**Epic le plus risqué Tukio MVP** (R11 saga choreographed booking-payment partiellement échouée). Sans Story 4.1, **aucune** Story Epic 4 downstream ne peut commencer car toutes consomment le domain Booking + saga producer events. Pattern complet **aggregate root with state machine + multi-VO + multi-port + saga producer outbox + cross-svc snapshot frozen at booking time + cron skeletons** est template Stories 4.2-4.13 + Stories Epic 5 (Conversation/Message aggregates avec state machine) + Stories Epic 10 V1 (Dispute aggregate state machine + R11 evolution).

### Décisions techniques majeures actées

1. **5 statuts persistés (vs 6 incluant 'request')** — `request` est sémantique UX frontend (= form submission), pas persisté DB. Booking créé directement en `pending_pro_acceptance` après Stripe payment auth Story 4.5. Simplifie state machine matrix + tests. PRD FR47 mentionne 'accepted' → renommé `pending_pro_acceptance` (clearer semantic : c'est le statut **pendant que Pro review**, accepted = transition into confirmed).

2. **Booking aggregate avec uncommittedEvents collection + transactional outbox drain** — pattern Story 0.7 livré `OutboxPublisher` + ADR-007. Aggregate accumule événements à chaque transition, repository.save() drain to outbox dans même transaction TypeORM. Garantit cohérence ADR-007 + R11 saga resilience.

3. **ListingSnapshot frozen at booking time** — anti-changement prix post-booking (Pro qui change prix listing après que customer a réservé → booking conserve le snapshot). VO immutable. Cross-svc via `IListingSnapshotPort` (catalog-svc HTTP sync call autorisée exception ADR-003 — documented Architecture lines 2154-2155 booking↔catalog pattern).

4. **UUID v7 (vs v4)** pour BookingId — sortable par createdAt (DB index performance) + cryptographically random. `uuid` v11+ `v7()` function latest stable.

5. **BookingStateMachine séparé de Booking aggregate** — Single Responsibility : aggregate enforces transitions (calls ensureCanTransition), state machine domain service centralizes la matrix de transitions (testable séparément + extensible Stories 4.x).

6. **5-status × terminal markers** : `completed`, `cancelled`, `refused` sont terminaux (no further transition). `pending_pro_acceptance` + `confirmed` sont mutables. State machine matrix immutable static `TRANSITIONS`.

7. **3 use cases full + 6 skeletons** — Story 4.1 livre suffisant pour Stories 4.2 (consumers) + Story 4.6 (pro UI) + Story 4.11 (customer/pro bookings list). Skeletons pour business-logic-heavy use cases (Stripe integration, cron schedulers, notification dispatch, refund computation, race conditions) finalisés Stories 4.4-4.10.

8. **Exclusion constraint GIST Layer 2 deferred Story 4.4** — Story 4.1 livre baseline indexes (sufficient for queries) + Story 4.4 ajoute `EXCLUDE USING GIST (listing_id WITH =, tstzrange WITH &&)` + `CREATE EXTENSION btree_gist` (PG required — documented Story 4.4). Pas de Layer 2 race protection MVP **dans Story 4.1** (mais tests singleton process safe).

9. **`@upstash/redis` v1.40+ baseline Layer 1** — Story 4.4 finalise full 3-layer. Story 4.1 livre minimal Redis SET NX + Lua script release (atomicity). Pattern compatible Upstash Cloud staging/prod + Story 0.10 dev local Redis.

10. **NATS stream `BOOKING` + 6 event subjects** `booking.*` — Story 0.7 pattern + JSON Schema v7 validation + types auto-generated via `json-schema-to-typescript` Story 0.2 pattern.

11. **CapturePolicy discriminated union** — MVP `'manual_at_pro_accept'` (Stripe capture_method='manual' Story 4.5/4.7). V1+ FR50 saved card + FR51 30/70 échéancier ready (Stories Epic 9).

12. **Cross-svc HTTP exception explicit ADR-003 + ADR-008** — booking↔catalog sync HTTP call documented Architecture lines 2154-2155. X-Internal-Service-Token header (Doppler) + retry + timeout + circuit breaker V1+ pattern Story 3.2 réutilisé.

13. **EN strict + i18n FR/EN + RGAA AA + latest stable versions + Clean Architecture + Envelope ADR-014 + ADR-006 saga choreographed + ADR-007 outbox** memories — toutes respectées.

14. **No backwards compatibility hacks** — fresh service scaffolding, no migration legacy.

### Versions à utiliser

| Lib | Usage | Version | Notes |
|-----|-------|---------|-------|
| `uuid` | BookingId v7 sortable | latest stable v11+ | `v7()` function (CryptoRandomValues + monotonic timestamp) |
| `@upstash/redis` | Redis distributed lock | latest stable v1.40+ | Edge-compatible + Upstash Cloud staging/prod + dev local Redis docker-compose Story 0.10 |
| `@horizon-republic/nestjs-jetstream` OR `nats` | NATS JetStream | (Story 0.7 already) | Wrapped by `@tukio/messaging` |
| `typeorm` | Postgres ORM | (Story 0.6 already) | Pretre baseline pattern |
| `@nestjs/schedule` | Cron @Cron decorators | (Story 1.9 already) | For auto-expire + complete crons (Stories 4.7 + 4.10 — Story 4.1 livre skeletons) |
| `json-schema-to-typescript` | Event types generation | (Story 0.2 already) | 6 events booking schemas |
| `@tukio/messaging` | OutboxPublisher + OutboxRelay | (Story 0.7 already) | Wired via DynamicModule.forRoot |
| `@tukio/contracts` | Event schemas + DTOs | (Story 0.2 already) | UPDATE — add events/booking/* |

### Project Structure cible

```
# ====== NEW Story 4.1 ======

apps/booking-svc/
├─ package.json, nest-cli.json, tsconfig.json, tsconfig.build.json, Dockerfile, .env.example   # NEW (replicate Story 0.6)
├─ eslint.config.mjs                                                                            # NEW (Pretre boundaries strict)
└─ src/
   ├─ main.ts (port 4010)                                                                       # NEW
   ├─ app.module.ts                                                                             # NEW
   ├─ domain/
   │  ├─ model/
   │  │  ├─ booking.aggregate.ts + spec                                                         # NEW (aggregate root + state machine + 6 transitions)
   │  │  └─ value-objects/
   │  │     ├─ booking-id.vo.ts + spec                                                          # NEW (UUID v7)
   │  │     ├─ booking-status.vo.ts + spec                                                      # NEW (enum + helpers)
   │  │     ├─ booking-period.vo.ts + spec                                                      # NEW
   │  │     ├─ capture-policy.vo.ts + spec                                                      # NEW
   │  │     ├─ cancellation-reason.vo.ts + spec                                                 # NEW
   │  │     ├─ listing-snapshot.vo.ts + spec                                                    # NEW
   │  │     └─ booking-option.vo.ts + spec                                                      # NEW (placeholder V1+)
   │  ├─ ports/
   │  │  ├─ booking-repository.port.ts                                                          # NEW
   │  │  ├─ listing-snapshot.port.ts                                                            # NEW
   │  │  ├─ availability-lock.port.ts                                                           # NEW
   │  │  ├─ event-publisher.port.ts                                                             # NEW
   │  │  └─ tokens.ts                                                                           # NEW (Symbol DI tokens)
   │  ├─ service/booking-state-machine.service.ts + spec                                        # NEW
   │  └─ exception/
   │     ├─ booking.exception.ts                                                                # NEW (base)
   │     ├─ invalid-transition.exception.ts                                                     # NEW
   │     ├─ booking-not-found.exception.ts                                                      # NEW
   │     ├─ booking-validation.exception.ts                                                     # NEW
   │     └─ listing-snapshot.exception.ts                                                       # NEW (ListingNotFound + ListingUnpublished)
   ├─ usecases/
   │  ├─ book-listing.usecase.ts + spec                                                         # NEW skeleton (Story 4.4/4.5 finalise)
   │  ├─ accept-booking.usecase.ts + spec                                                       # NEW skeleton (Story 4.7)
   │  ├─ refuse-booking.usecase.ts + spec                                                       # NEW skeleton (Story 4.7)
   │  ├─ cancel-booking-by-customer.usecase.ts + spec                                           # NEW skeleton (Story 4.8)
   │  ├─ cancel-booking-by-pro.usecase.ts + spec                                                # NEW skeleton (Story 4.8)
   │  ├─ auto-expire-booking.usecase.ts + spec                                                  # NEW skeleton (Story 4.7 cron)
   │  ├─ complete-booking.usecase.ts + spec                                                     # NEW skeleton (Story 4.10 cron)
   │  ├─ list-customer-bookings.usecase.ts + spec                                               # NEW full (cursor pagination)
   │  ├─ list-pro-bookings.usecase.ts + spec                                                    # NEW full
   │  └─ get-booking-detail.usecase.ts + spec                                                   # NEW full (ACL check)
   └─ infrastructure/
      ├─ usecases-proxy/usecases-proxy.module.ts                                                # NEW (wire 9 use cases + 4 ports)
      ├─ persistence/typeorm/
      │  ├─ entities/{booking.entity.ts,booking-status-transition.entity.ts,outbox.entity.ts,inbox.entity.ts}  # NEW
      │  ├─ repositories/booking.typeorm.repository.ts + spec (integration)                     # NEW
      │  ├─ mappers/booking.mapper.ts + spec                                                    # NEW
      │  └─ migrations/
      │     ├─ 1715600000000-CreateBookingTables.ts                                             # NEW (booking + booking_status_transition + indexes)
      │     └─ 1715600000001-CreateOutboxInbox.ts                                               # NEW (Story 0.7 template)
      ├─ external/
      │  ├─ catalog-svc/listing-snapshot.client.ts + spec                                       # NEW (implements IListingSnapshotPort)
      │  └─ redis/availability-lock.service.ts + spec                                           # NEW (implements IAvailabilityLockPort Upstash)
      ├─ messaging/nats/booking-stream-config.ts                                                # NEW (stream BOOKING subjects booking.*)
      ├─ http/controllers/health.controller.ts                                                  # NEW (basic Pretre scaffold — business controllers Stories 4.4+)
      ├─ logger/, config/, exception/                                                            # NEW (Pretre baseline replicate)
      └─ ...

# ====== UPDATE Stories existing ======

apps/catalog-svc/src/infrastructure/http/controllers/
└─ internal-listing-detail.controller.ts                                                       # UPDATE Story 3.10 — add endpoint GET /internal/listings/by-id/:id?includeProSnapshot=true

packages/contracts/src/events/booking/                                                          # NEW directory
├─ requested.v1.{schema.json,ts}                                                                # NEW
├─ confirmed.v1.{schema.json,ts}                                                                # NEW
├─ refused.v1.{schema.json,ts}                                                                  # NEW
├─ cancelled.v1.{schema.json,ts}                                                                # NEW
├─ completed.v1.{schema.json,ts}                                                                # NEW
├─ status-changed.v1.{schema.json,ts}                                                           # NEW
└─ index.ts                                                                                     # NEW (barrel export)

packages/contracts/src/dtos/booking/
├─ book-listing-request.dto.ts                                                                  # NEW (Stories 4.4 will use)
├─ booking-detail.dto.ts                                                                        # NEW (Stories 4.6/4.11)
├─ booking-period.dto.ts                                                                        # NEW
└─ booking-status.dto.ts                                                                        # NEW

infra/docker-compose/docker-compose.dev.yml                                                     # UPDATE Story 0.10 — add booking-svc + postgres-booking
infra/scripts/bootstrap-databases.sh                                                            # UPDATE Story 0.10 — add tukio_booking
infra/k8s/helm-charts/core-api/values-booking-svc.yaml                                          # NEW (minimal MVP)

docs/runbook/booking-saga-debug.md                                                              # NEW (~30 lignes)
docs/adr/0006-saga-choreographed.md                                                             # UPDATE Implementation Notes
docs/project-context.md                                                                         # UPDATE — section "Booking & Saga Foundation (Story 4.1)"

# Estimation : ~50 nouveaux + ~5 updates = ~55 fichiers
```

### Critical Architecture Constraints

> Cf. Stories 0.2 (`@tukio/contracts` events + DTOs), 0.6 (Pretre baseline scaffolding + replicate script + boundaries lint), 0.7 (`@tukio/messaging` OutboxPublisher + OutboxRelay + NATS streams + InboxConsumer), 0.10 (docker-compose dev local + bootstrap DBs), 0.11 (CI Lighthouse — not directly applicable backend, but coverage + lint thresholds), 1.10 (identity-svc internal endpoints pattern réutilisé + audit_log table baseline pattern), 2.1 (payment-svc Pretre + Stripe Connect Express + stripe_events_inbox idempotency — Story 4.1 livre booking-svc producer events, Story 4.2 livre payment-svc consumer + capture), 2.3 (cursor pagination canonical pattern — réutilisé list-customer/pro-bookings), 3.1 (catalog-svc Pretre baseline + `IProProfileClient` pattern), 3.2 (catalog-svc Listing aggregate + Slug VO + ProProfileClient cross-svc HTTP pattern réutilisé pour ListingSnapshot), 3.10 (catalog-svc internal-listing-detail.controller.ts pattern — UPDATE add by-id endpoint). Architecture lines 2120-2164 Pretre canonical structure (booking-svc exemple). ADR-001 Clean Architecture + ADR-003 DB per service + ADR-006 saga choreographed + ADR-007 outbox + ADR-014 envelope.

1. **API responses envelope ADR-014** — toutes responses wrapped `{ method, code, data | error, meta }`. 5 error codes `BOOKING-*-00X` enveloppe (Story 4.1 livre 5 baseline + reserve `BOOKING-CONFLICT-001/002/003` Story 4.4).

2. **ADR-001 Clean Architecture strict** — Pattern Pretre boundaries enforced eslint-plugin-boundaries. Domain pure (no NestJS/TypeORM/I/O imports). Use cases consume ports. Infrastructure implements ports.

3. **ADR-003 DB per service strict** — `tukio_booking` separate DB. Pas de cross-DB SELECT. Communication async via NATS events (saga choreographed ADR-006).

4. **ADR-006 saga choreographed** — booking-svc producer events `booking.*.v1` → consumed by order-svc + payment-svc + notification-svc + review-svc + audit (Story 2.7). Story 4.13 future R11 monitoring + alerts.

5. **ADR-007 transactional outbox** — `OutboxPublisher` + `OutboxRelay` Story 0.7 livré. Booking aggregate `uncommittedEvents` drained dans same transaction TypeORM. Garantit cohérence ADR-007 + R11 saga resilience.

6. **ADR-008 internal endpoint authentication** — booking-svc ↔ catalog-svc cross-svc HTTP autorisée exception (booking-availability check) avec `X-Internal-Service-Token` header. Pattern Story 3.2 réutilisé.

7. **Cross-svc boundary discipline strict** — booking-svc NE PEUT PAS SELECT directement sur `catalog-svc.listing` ou `identity-svc.pro_profiles` ou `identity-svc.user_profiles`. Uniquement via `IListingSnapshotPort` + (V1+) `IProClient` / `ICustomerClient` ports.

8. **NFR42 saga resilience + NFR43 reliability + NFR44 chaos tests + NFR46 message durability** — Story 4.13 finalise chaos tests + monitoring R11 — Story 4.1 livre foundation outbox + correlation_id index.

9. **NFR71 coverage thresholds** — ≥ 95 % domain + ≥ 90 % usecases + ≥ 80 % infrastructure.

10. **NFR82 audit** — `booking.status-changed.v1` event + `booking_status_transition` table denormalized history. Story 2.7 audit_log consumer ingests.

11. **R5 race conditions (FR48)** — Story 4.4 finalise 3-layer protection. Story 4.1 livre Layer 1 baseline (Redis lock minimal).

12. **R11 saga partial failure** — Story 4.13 finalise monitoring + alerts > 5 min. Story 4.1 livre correlation_id field + index + outbox pattern.

13. **EN strict + Clean Architecture + Envelope + Pretre + Cross-svc boundaries + latest stable versions** memories.

### Previous Story Intelligence

**Story 0.2 (`@tukio/contracts` events + DTOs)** : Story 4.1 ajoute 6 event schemas + 4 DTOs booking. Pattern JSON Schema v7 + types auto-generated.

**Story 0.6 (Pretre baseline + replicate script + boundaries lint)** : Story 4.1 réutilise `replicate-pretre-structure.sh --target=booking-svc` (5ᵉ service Pretre after identity/gateway/payment/catalog).

**Story 0.7 (`@tukio/messaging` OutboxPublisher + OutboxRelay + NATS streams + CorrelationContext + InboxConsumer)** : Story 4.1 wire OutboxPublisher in booking-svc usecases-proxy.module.ts. Pattern Stories 1.10/3.2 réutilisé.

**Story 0.10 (docker-compose dev local)** : Story 4.1 UPDATE docker-compose — add booking-svc + postgres-booking + bootstrap-databases.sh.

**Story 0.11 (CI Lighthouse)** : Story 4.1 add `pnpm --filter=booking-svc test --coverage` + lint to CI pipeline (NFR71 thresholds enforced).

**Story 1.10 (identity-svc internal endpoints + audit_log)** : Story 4.1 réutilise pattern internal endpoint + audit_log will consume `booking.status-changed.v1`.

**Story 2.1 (payment-svc Pretre + Stripe Connect Express)** : Story 4.1 booking-svc producer events → Story 4.2 payment-svc consumer (PaymentIntent create + capture).

**Story 2.3 (cursor pagination canonical)** : Story 4.1 réutilise pour `findByCustomerProfileId` + `findByProProfileId` use cases (Stories 4.6 + 4.11).

**Story 3.1 (catalog-svc Pretre baseline + ProProfileClient pattern)** : Story 4.1 réutilise pattern cross-svc client (booking-svc → catalog-svc HTTP).

**Story 3.2 (catalog-svc Listing aggregate + Slug VO + ProProfileClient cross-svc HTTP)** : Story 4.1 réutilise pattern ProProfileClient pour ListingSnapshotClient.

**Story 3.5 (median price + priceDeviation publish-time + cron compute-medians)** : Story 4.1 ListingSnapshot capture pricing + listing.priceDeviation (Story 3.12 indexer field) — V1+ filter UI.

**Story 3.7 (Meilisearch indexer + MeilisearchListingDocument shape)** : Story 4.1 ListingSnapshot peut alternative read from Meilisearch (V1+ optim) — MVP read direct catalog-svc HTTP.

**Story 3.10 (catalog-svc internal-listing-detail.controller.ts pattern)** : Story 4.1 UPDATE — add `GET /internal/listings/by-id/:id?includeProSnapshot=true` endpoint.

**Story 3.11 (cross-svc boundary + 410 Gone pattern)** : Story 4.1 réutilise pattern exceptions cross-svc (ListingNotFound + ListingUnpublished).

**Story 3.12 (final Epic 3 — `price-deviation.service.ts` shared helper)** : Story 4.1 booking peut consume `priceDeviation` field si captured dans snapshot (V1+ UI display).

### What this story does NOT do

- ❌ **3-layer race condition full protection (FR48 R5)** — Story 4.4 finalise. Story 4.1 livre Layer 1 baseline.
- ❌ **Stripe PaymentIntent integration** — Story 4.5. Story 4.1 livre `booking.requested.v1` event consumed by payment-svc Story 4.2.
- ❌ **48h auto-expire cron** — Story 4.7. Story 4.1 livre skeleton `auto-expire-booking.usecase.ts` + `findPendingExpiringBefore` repository.
- ❌ **J+1 complete cron** — Story 4.10. Story 4.1 livre skeleton + `findConfirmedEndedBefore`.
- ❌ **Cart UI + persistence Zustand** — Story 4.3.
- ❌ **Customer cancellation flow + refund policy** — Story 4.8.
- ❌ **Invoice generation TVA mandat 289 CGI** — Story 4.9.
- ❌ **Pro pending requests page UI** — Story 4.6.
- ❌ **Admin refund + reconciliation page** — Story 4.12.
- ❌ **Saga monitoring R11 alerts > 5 min Slack** — Story 4.13.
- ❌ **NFR82 audit consumer** — Story 2.7 livré, Story 4.1 publie l'event `booking.status-changed.v1` consumed automatically.
- ❌ **Booking conflict event `booking.conflict-detected.v1`** — Story 4.4 livre full (Story 4.1 reserve schema baseline only).
- ❌ **HTTP controllers business endpoints** — Stories 4.4+ (Story 4.1 livre only health/ready scaffolded by Pretre baseline).

### Files to UPDATE vs CREATE

Cf. Project Structure cible — annoté `# NEW Story 4.1` vs `# UPDATE`.

**UPDATE files (read complete state before modifying)** :
1. `apps/catalog-svc/src/infrastructure/http/controllers/internal-listing-detail.controller.ts` Story 3.10 — add `GET /internal/listings/by-id/:id?includeProSnapshot=true` endpoint
2. `infra/docker-compose/docker-compose.dev.yml` Story 0.10 — add booking-svc service + postgres-booking dependency
3. `infra/scripts/bootstrap-databases.sh` Story 0.10 — add `tukio_booking` DB creation
4. `docs/adr/0006-saga-choreographed.md` — add Implementation Notes section
5. `docs/project-context.md` Story 1.10 livré pattern — add "Booking & Saga Foundation (Story 4.1)" section
6. `packages/contracts/src/events/index.ts` — barrel export new booking events

**Lire l'état complet de chaque UPDATE file avant édition** — internal-listing-detail.controller.ts notamment (Story 3.10 livre 2 endpoints `by-slug` + `by-slug/similar` — Story 4.1 ajoute `by-id` co-located).

### Testing Standards

- Coverage ≥ 95 % `Booking` aggregate + 5 VOs + `BookingStateMachine`
- Coverage ≥ 90 % use cases (3 full + 6 skeletons)
- Coverage ≥ 80 % infrastructure (TypeormBookingRepository + ListingSnapshotClient + UpstashRedisAvailabilityLock + migrations)
- Integration testcontainer Postgres + Redis + NATS (8 + 5 + 6 scenarios respectively)
- Lint boundaries strict 0 violations (verify domain + usecases pure)
- Pattern Pretre boundaries fail-case verify (temporary violation file)
- NFR71 coverage thresholds enforced CI Story 0.11

### Project Structure Notes

✅ **Aligné** architecture.md (Pretre strict canonical lines 2120-2164 — booking-svc is THE example documented in Architecture + ADR-001 Clean Architecture + ADR-003 DB per service strict + ADR-006 saga choreographed + ADR-007 transactional outbox + ADR-008 gateway-api sole public surface + ADR-014 envelope + cross-svc boundary booking↔catalog HTTP exception documented), PRD §FR47 (5-status lifecycle + audit trail), §FR48 (3-layer race conditions — Story 4.4 finalise), §R5 (race conditions), §R11 (saga partial failure — Story 4.13 finalise), §NFR42-46 (saga resilience + reliability + chaos + recovery + message durability), §NFR71 (coverage), §NFR82 (audit), Stories 0.2/0.6/0.7/0.10/0.11/1.10/2.1/2.3/3.1/3.2/3.5/3.7/3.10/3.11/3.12, memories Tukio (feedback_clean_architecture_explicit, feedback_api_envelope_response, feedback_tech_layer_english, feedback_latest_versions).

⚠️ **Déviations** : aucune significative. Booking aggregate state machine + cross-svc HTTP exception + outbox pattern conformes architecture canonique.

⚠️ **Décisions clés Story 4.1** :
- 5 statuts persistés (vs 6 'request' transient UX) — PRD FR47 simplifié
- ListingSnapshot frozen at booking time (anti-changement prix post-booking)
- BookingStateMachine séparé aggregate (SRP + testabilité)
- UUID v7 sortable (vs v4 random) — DB index performance
- 3 use cases full + 6 skeletons (Stories 4.4-4.10 finalisent)
- Exclusion constraint GIST Layer 2 deferred Story 4.4
- Cross-svc HTTP exception explicit ADR documented
- Saga producer pattern foundation R11

### References

- [Source: epics.md#Epic-4-Story-4.1 — Lines 1596-1611]
- [Source: prd.md#FR47 (lifecycle 5-status), #FR48 (race conditions 3-layer), #R5 (race), #R11 (saga partial), #NFR42-46 (saga resilience + chaos + durability), #NFR71 (coverage), #NFR82 (audit)]
- [Source: architecture.md — ADR-001 Clean Architecture, ADR-003 DB per service, ADR-006 saga choreographed, ADR-007 transactional outbox, ADR-008 internal endpoint, ADR-014 envelope, Pretre canonical structure lines 2120-2164, cross-svc boundary booking↔catalog lines 2154-2155]
- [Source: Stories 0.2 (contracts events + DTOs), 0.6 (Pretre baseline + replicate + boundaries lint), 0.7 (@tukio/messaging OutboxPublisher + OutboxRelay + InboxConsumer + CorrelationContext), 0.10 (docker-compose dev), 0.11 (CI coverage), 1.10 (identity-svc internal endpoints + audit_log), 2.1 (payment-svc Pretre + Stripe Connect), 2.3 (cursor pagination canonical), 3.1 (catalog-svc Pretre baseline + ProProfileClient), 3.2 (Listing aggregate + Slug VO + cross-svc HTTP pattern), 3.5 (median + priceDeviation), 3.7 (Meilisearch indexer), 3.10 (internal-listing-detail.controller.ts pattern — UPDATE), 3.11 (cross-svc + 410 Gone exceptions), 3.12 (price-deviation.service shared)]
- [Memory: user_ismael, project_tukio, feedback_clean_architecture_explicit, feedback_api_envelope_response, feedback_tech_layer_english, feedback_latest_versions]

## Dev Agent Record

### Agent Model Used

(à remplir)

### Debug Log References

### Completion Notes List

(points d'attention pour Story 4.2 (order-svc + payment-svc Pretre saga consumers — réutilise pattern booking-svc Story 4.1, consume `booking.*.v1` events outbox stream), Story 4.3 (cart UI — Zustand store frontend, consume Story 3.10 listing detail CTA Reserve → cart → checkout → Story 4.4), Story 4.4 (3-layer race condition full — add Layer 2 GIST exclusion constraint + Layer 3 optimistic lock conflict exception + `booking.conflict-detected.v1` event + chaos tests), Story 4.5 (Stripe PaymentIntent + Elements checkout — frontend integration + payment-svc consumer wire), Story 4.6 (pro pending requests page UI — consume `list-pro-bookings.usecase` Story 4.1 livré + 48h countdown UI), Story 4.7 (pro accept/refuse workflow + Stripe capture trigger + 48h cron auto-expire — finalise skeletons), Story 4.8 (customer cancellation flow + refund policy templates), Story 4.9 (invoice generation TVA art. 289 CGI), Story 4.10 (auto-payout cron J+1 + Stripe transfer), Story 4.11 (customer + pro bookings list/detail UI — consume Story 4.1 livré use cases), Story 4.12 (admin refund reconciliation), Story 4.13 (saga monitoring R11 alerts > 5 min Slack — chaos tests CI + Grafana dashboard saga-health))

### File List

(à remplir)

---

## Story Completion Status

- **Story Status** : `ready-for-dev`
- **Created** : 2026-05-14
- **Created by** : `bmad-create-story` workflow
- **Epic** : Epic 4 — Booking, Cart & Payment Saga (MVP) — **OUVERTURE Epic 4 R11 critique**
- **Sprint cible** : Sprint 5 (1ʳᵉ story Epic 4 MVP — foundation domain pour Stories 4.2-4.13)
- **Estimation effort** : 6-8 jours (1 dev backend senior — scaffolding Pretre via replicate + Booking aggregate + 5 VOs + 4 ports + BookingStateMachine + 5 exceptions + 9 use cases (3 full + 6 skeletons) + DB migrations + TypeORM repo + ListingSnapshotClient cross-svc HTTP + UpstashRedis lock baseline + OutboxPublisher wire + 6 event schemas + lint boundaries strict + coverage NFR71 + 1 runbook + UPDATE catalog-svc internal endpoint, ~55 fichiers)
- **Dépendances upstream** :
  - Stories 0.2 (contracts), 0.6 (Pretre + replicate), 0.7 (@tukio/messaging OutboxPublisher + OutboxRelay), 0.10 (docker-compose), 0.11 (CI coverage)
  - Stories 1.10 (identity-svc internal endpoints pattern + audit_log), 2.1 (payment-svc Pretre + Stripe Connect), 2.3 (cursor pagination)
  - Stories 3.1 (catalog-svc Pretre baseline), 3.2 (Listing aggregate + cross-svc HTTP pattern), 3.10 (catalog-svc internal endpoint pattern — UPDATE add by-id)
- **Dépendances downstream** (Epic 4 + cross-Epic) :
  - Story 4.2 (order-svc + payment-svc Pretre consumers — consume `booking.*.v1`)
  - Story 4.3 (cart UI — frontend Zustand + sync `POST /v1/carts/<cartId>/lines`)
  - Story 4.4 (3-layer race conditions full — add GIST exclusion + optimistic lock + `booking.conflict-detected.v1`)
  - Story 4.5 (Stripe PaymentIntent + Elements — wire payment-svc consumer + frontend `<PaymentElement>`)
  - Story 4.6 (pro pending page — `list-pro-bookings.usecase` Story 4.1 full impl consumed)
  - Story 4.7 (pro accept/refuse + Stripe capture + 48h cron auto-expire — finalise skeletons Story 4.1)
  - Story 4.8 (customer cancellation flow + refund policy)
  - Story 4.9 (invoice TVA art. 289 CGI)
  - Story 4.10 (auto-payout cron J+1 — `complete-booking.usecase` skeleton finalise + Stripe transfer)
  - Story 4.11 (customer + pro bookings list UI — `list-customer-bookings.usecase` + `get-booking-detail.usecase` Story 4.1 consumed)
  - Story 4.12 (admin refund reconciliation page)
  - Story 4.13 (saga monitoring R11 alerts + chaos tests)
  - Story 5.4 (notification-svc — consume `booking.*` events → email templates Resend)
  - Story 5.6 (auto-request-review cron — consume `booking.completed.v1`)
  - Story 2.7 (audit_log — consume `booking.status-changed.v1` Story 4.1 livre event already published)
  - Stories Epic 5/Epic 10 V1+ (Message + Dispute aggregates — pattern aggregate state machine Story 4.1 réutilisé)
- **FRs covered** :
  - **FR47** ✅ Booking lifecycle 5 statuses + audit trail (`booking_status_transition` table + `booking.status-changed.v1` event)
  - **FR48 partial** ✅ Layer 1 Redis lock baseline (Story 4.4 finalise full 3-layer)
- **NFRs touchés** :
  - **NFR42** ✅ Outbox pattern Story 0.7 wired (saga resilience)
  - **NFR43-46** ✅ Foundation reliability + durability (Story 4.13 finalise chaos tests)
  - **NFR71** ✅ Coverage thresholds enforced (≥ 95 % domain + ≥ 90 % usecases + ≥ 80 % infra)
  - **NFR82** ✅ Audit `booking_status_transition` table + `booking.status-changed.v1` event for Story 2.7 consumer

> **Prochaine story → Story 4.2** (order-svc + payment-svc Pretre + saga consumers — consume `booking.*.v1` events Story 4.1 livré + implement `create-order-from-booking.usecase` + `confirm-order.usecase` + `cancel-order.usecase` + payment-svc consumers + saga choreographed flow complete) **OR** Story 4.3 (cart UI frontend Zustand) — parallèle possible si team capacity allows (4.2 + 4.3 indépendants).

---

**Dev agent next steps :**
1. Lire ce file complètement
2. Vérifier upstream Stories 0.2/0.6/0.7/0.10/0.11/1.10/2.1/2.3/3.1/3.2/3.10 implémentées (sprint-status.yaml)
3. Lire l'état complet de chaque UPDATE file avant édition (cf. section "Files to UPDATE vs CREATE")
4. Implémenter Tasks 1-13 dans l'ordre (scaffolding Pretre → Booking aggregate + state machine → 5 VOs → 4 ports + 5 exceptions → BookingStateMachine → 9 use cases (3 full + 6 skeletons) + UseCasesProxyModule → DB migrations → TypeORM repo + transactional outbox drain → ListingSnapshotClient cross-svc HTTP + UPDATE catalog-svc internal endpoint → UpstashRedis lock baseline → OutboxPublisher wire + 6 event schemas → lint boundaries strict enforcement + coverage NFR71 → docs runbook + ADR-006 update + project-context + commit)
5. Lancer `pnpm --filter=booking-svc lint && pnpm --filter=booking-svc test --coverage` après chaque jalon
6. Commit Story 4.1 quand : 0 violations boundaries + coverage NFR71 thresholds + 50+ tests domain + 8 integration tests Postgres + 5 integration tests Redis + 6 integration tests NATS round-trip + handoff Stories 4.2-4.13 documented project-context
7. Update sprint-status : `4-1-booking-svc-pretre-saga-state-machine: review` puis `done`. **Epic 4 status automatique flip backlog → in-progress** lors de la création de Story 4.1 (workflow handled).
