# Story 4.4: Booking submission + 3-layer race condition protection (FR48, R5 critique, NFR46, NFR82)

Status: ready-for-dev

<!-- Validation optionnelle : voir checklist.md pour quality-check avant `dev-story`. -->

## Story

**As a** backend developer Tukio (gardien R5 race conditions + booking-svc Pretre + saga producer Story 4.1 baseline + cart consume Story 4.3 + payment-svc integration Story 4.2 livré),
**I want** **livrer la protection 3-layer race conditions complète** (FR48 R5 critique) sur l'endpoint canonique `POST /v1/bookings/checkout-session` qui transforme un cart Story 4.3 en `Booking` aggregate Story 4.1 baseline + finalise full `book-listing.usecase.ts` Story 4.1 skeleton + ajoute GIST exclusion constraint Postgres baseline Story 4.1 differée + optimistic locking retry × 1 + 3 exceptions ENV-PORTABLES `BOOKING-CONFLICT-001/002/003` + `booking.conflict-detected.v1` outbox event production-ready (Story 4.1 schema reserved → Story 4.4 producer full) + chaos test 100-parallel customers `availability-conflict.spec.ts` (NFR46) + NFR82 audit conflict trace correlationId — with :

- (a) **`book-listing.usecase.ts` FULL impl** (`apps/booking-svc/src/usecases/book-listing.usecase.ts`) — Story 4.1 livré skeleton (signature + invocation pattern + outbox event publish — full business logic deferred). Story 4.4 finalise full 3-layer wired :
```ts
@Injectable()
export class BookListingUseCase {
  constructor(
    @Inject(BOOKING_REPOSITORY) private readonly bookingRepo: IBookingRepository,
    @Inject(LISTING_SNAPSHOT_PORT) private readonly listingSnapshot: IListingSnapshotPort,
    @Inject(AVAILABILITY_LOCK_PORT) private readonly availabilityLock: IAvailabilityLockPort,
    @Inject(CART_REPOSITORY) private readonly cartRepo: ICartRepository,                              // Story 4.3 baseline réutilisé
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: IEventPublisher,
    private readonly logger: Logger,
  ) {}

  async execute(input: BookListingInput): Promise<BookListingOutput> {
    const { cartId, customerProfileId, period, paymentMethodId, correlationId } = input;
    const logCtx = { cartId, customerProfileId, correlationId };

    // STEP 1 — fetch cart Story 4.3 + invariants
    const cart = await this.cartRepo.findById(cartId);
    if (!cart) throw new CartNotFoundException({ cartId });
    if (cart.isEmpty()) throw new BookingValidationException({ field: 'cart', code: 'cart-empty' });
    if (cart.lines.length > 1) throw new BookingValidationException({ field: 'cart.lines', code: 'multi-line-not-supported-mvp' });  // MVP single-line cart — V1 multi-line
    const cartLine = cart.lines[0];

    // STEP 2 — fetch authoritative listing snapshot (anti-stale-cart — listing might have changed price/unpublished since cart add)
    const listingSnapshot = await this.listingSnapshot.fetchSnapshot(cartLine.listingId);              // throws ListingNotFoundException / ListingUnpublishedException Story 4.1
    if (listingSnapshot.proUserProfileId === /* derive from customerProfileId user */ customer.userProfileId) {
      throw new BookingValidationException({ field: 'customerProfileId', code: 'self-booking-forbidden' });
    }

    // STEP 3 — Layer 1 Redis lock acquire (Story 4.1 baseline `IAvailabilityLockPort.acquire`)
    const lock = await this.availabilityLock.acquire(cartLine.listingId, period, 30);                  // TTL 30s
    if (!lock) {
      this.logger.warn('Layer 1 Redis lock occupied', logCtx);
      await this.eventPublisher.publish(new BookingConflictDetectedEvent({
        listingId: cartLine.listingId, customerProfileId, period, layer: 1, code: 'BOOKING-CONFLICT-001', correlationId, detectedAt: new Date(),
      }));                                                                                              // NFR82 audit conflict
      throw new BookingConflictLayer1Exception({ listingId: cartLine.listingId, period, correlationId });
    }

    try {
      // STEP 4 — create Booking aggregate (Story 4.1 Booking.create — invariants checked domain layer)
      const booking = Booking.create({
        listingId: cartLine.listingId,
        listingSnapshot,
        customerProfileId,
        proProfileId: listingSnapshot.proProfileId,
        period,                                                                                          // BookingPeriod VO Story 4.1
        quantity: cartLine.quantity,
        options: cartLine.options,
        capturePolicy: { kind: 'manual_at_pro_accept' },                                                // MVP — Story 4.2 PaymentIntent consumes
        correlationId,
      });

      // STEP 5 — Layer 2 + Layer 3 : save with optimistic lock + GIST exclusion constraint enforced by Postgres
      let attempt = 0;
      const maxRetries = 1;                                                                              // 1 retry as per epic R5 spec
      while (true) {
        try {
          await this.bookingRepo.save(booking);                                                          // transactional outbox drain Story 4.1 + GIST raises 23P01 if overlap + optimistic 0-row-affected raises BookingOptimisticLockException
          break;
        } catch (err) {
          if (err instanceof BookingDbExclusionConstraintException) {                                    // wrapped from Postgres 23P01 (exclusion_violation)
            // Layer 2 GIST hit — period overlap with confirmed/pending booking — UNRECOVERABLE
            this.logger.warn('Layer 2 GIST exclusion constraint hit', { ...logCtx, layer: 2 });
            await this.eventPublisher.publish(new BookingConflictDetectedEvent({
              listingId: cartLine.listingId, customerProfileId, period, layer: 2, code: 'BOOKING-CONFLICT-002', correlationId, detectedAt: new Date(),
            }));
            throw new BookingConflictLayer2Exception({ listingId: cartLine.listingId, period, correlationId });
          }
          if (err instanceof BookingOptimisticLockException) {
            // Layer 3 — retry once max (epic R5 Layer 3 spec)
            attempt++;
            if (attempt > maxRetries) {
              this.logger.warn('Layer 3 optimistic lock exhausted', { ...logCtx, layer: 3, attempt });
              await this.eventPublisher.publish(new BookingConflictDetectedEvent({
                listingId: cartLine.listingId, customerProfileId, period, layer: 3, code: 'BOOKING-CONFLICT-003', correlationId, detectedAt: new Date(),
              }));
              throw new BookingConflictLayer3Exception({ listingId: cartLine.listingId, period, correlationId, attempts: attempt });
            }
            this.logger.info('Layer 3 optimistic lock retry', { ...logCtx, layer: 3, attempt });
            // reload booking + retry
            booking.refreshVersion(await this.bookingRepo.findById(booking.id.value));                   // re-fetch latest version
            continue;
          }
          throw err;                                                                                     // bubble up other errors (Stripe down, NATS down, etc. — saga retry via outbox)
        }
      }

      // STEP 6 — clear cart (cart consumed)
      await this.cartRepo.delete(cartId);                                                                // Story 4.3 ICartRepository.delete

      return { bookingId: booking.id.value, status: booking.status, paymentMethodId };                   // paymentMethodId returned for Story 4.5 frontend Stripe Elements consume
    } finally {
      // STEP 7 — release Redis lock (TTL 30s auto-cleanup as safety net, but explicit release good citizen)
      if (lock) await this.availabilityLock.release(lock.lockId);
    }
  }
}
```

**Layer interplay summary** :
- **Layer 1 Redis** : fast-fail (30s TTL) prevents thundering herd on simultaneous submission attempts. ~99 % of conflicts caught here.
- **Layer 2 GIST** : authoritative database-level guarantee against overlap (even if Redis cluster fails OR lock acquired but DB write delayed). Postgres exclusion constraint via `tstzrange WITH &&` operator detects ANY period overlap with existing `pending_pro_acceptance` OR `confirmed` bookings.
- **Layer 3 Optimistic lock** : protects against concurrent writes on SAME aggregate (e.g., Customer in 2 tabs both cancel/modify same booking) — `UPDATE booking SET ... WHERE id = ? AND version = ?` returns 0 rows if version moved. Retry × 1 then 409.

- (b) **DB migration UPDATE Story 4.1 baseline** (`apps/booking-svc/src/infrastructure/persistence/typeorm/migrations/<timestamp>-AddGistExclusionConstraint.ts`) — Story 4.1 livré baseline `booking` table without GIST (epic Story 4.1 line 436: "**Story 4.4 ajoutera EXCLUDE USING GIST exclusion constraint**"). Story 4.4 NEW migration :
```sql
-- migration <timestamp>-AddGistExclusionConstraint.ts
CREATE EXTENSION IF NOT EXISTS btree_gist;                                                              -- required for GIST on (uuid, tstzrange) composite

ALTER TABLE booking ADD CONSTRAINT booking_no_period_overlap
  EXCLUDE USING GIST (
    listing_id WITH =,
    tstzrange(start_at, end_at, '[)') WITH &&
  )
  WHERE (status IN ('pending_pro_acceptance', 'confirmed') AND deleted_at IS NULL);

-- Index already exists from Story 4.1 (`idx_booking_listing_period`) — GIST exclusion will use it via btree_gist
```
- **`down()` migration** : DROP CONSTRAINT booking_no_period_overlap + DROP EXTENSION IF EXISTS btree_gist (conditional — only drop if no other table uses it)
- **Postgres 16 baseline** (Story 0.10 docker-compose) supports `btree_gist` extension natively
- **Tests integration testcontainer Postgres 16** 6 scenarios : (1) migration up creates extension + constraint, (2) INSERT 2 overlapping bookings same listing same period → 2nd fails with `exclusion_violation (23P01)`, (3) INSERT 2 non-overlapping same listing → both succeed, (4) INSERT overlapping different listings → both succeed, (5) INSERT overlapping but one is `cancelled` → succeeds (WHERE filter), (6) migration down removes constraint cleanly

- (c) **3 new exceptions + 1 optimistic-lock exception** (`apps/booking-svc/src/domain/exception/booking-conflict/`) — Story 4.1 livré 5 base exceptions, Story 4.4 ajoute 4 conflict exceptions :
  - `booking-conflict-layer-1.exception.ts` — `BookingConflictLayer1Exception extends BookingException` → 409 `BOOKING-CONFLICT-001` "Un autre client est en train de réserver ce créneau, réessayez dans 30 s"
  - `booking-conflict-layer-2.exception.ts` — `BookingConflictLayer2Exception` → 409 `BOOKING-CONFLICT-002` "Créneau déjà réservé"
  - `booking-conflict-layer-3.exception.ts` — `BookingConflictLayer3Exception` → 409 `BOOKING-CONFLICT-003` "Conflit de modifications simultanées, réessayez"
  - `booking-optimistic-lock.exception.ts` — `BookingOptimisticLockException` (INTERNAL — caught + retried by use case, NOT exposed to client) — wraps Postgres "0 rows affected" UPDATE result
  - `booking-db-exclusion-constraint.exception.ts` — `BookingDbExclusionConstraintException` (INTERNAL infra layer — wraps Postgres `exclusion_violation (23P01)` raw error from `TypeormBookingRepository.save` post-INSERT, mapped to Layer 2 use case)
  - **Each exception `toEnvelope()`** ADR-014 mapping with `tukioCode` + `httpStatus` + `title` + `detail` + `instance` + i18n hint Story 5.4 notification
  - **Tests** : 5 exception constructors + serialization 10 cases

- (d) **`TypeormBookingRepository.save` UPDATE Story 4.1 baseline** (`apps/booking-svc/src/infrastructure/persistence/typeorm/repositories/booking.typeorm.repository.ts`) — Story 4.1 livré `save()` with transactional outbox drain + version field write (Story 4.1 AC8). Story 4.4 finalise full optimistic lock + GIST error mapping :
```ts
async save(booking: Booking): Promise<void> {
  const runner = this.dataSource.createQueryRunner();
  await runner.startTransaction();
  try {
    let result: UpdateResult | InsertResult;
    if (booking.version === 0) {
      // first save — INSERT
      try {
        result = await runner.manager.insert(BookingEntity, this.mapper.toEntity(booking));
      } catch (err) {
        if (this.isPostgresExclusionViolation(err)) {                                                     // 23P01 from GIST constraint
          throw new BookingDbExclusionConstraintException({ bookingId: booking.id.value, cause: err });
        }
        throw err;
      }
    } else {
      // subsequent save — UPDATE with optimistic lock
      result = await runner.manager.update(
        BookingEntity,
        { id: booking.id.value, version: booking.version },                                                 // WHERE id AND version (Story 4.1 baseline)
        { ...this.mapper.toEntity(booking), version: booking.version + 1 },                                // increment version
      );
      if (result.affected === 0) {
        throw new BookingOptimisticLockException({ bookingId: booking.id.value, expectedVersion: booking.version });
      }
    }
    // booking_status_transition rows (denormalized history) — Story 4.1 baseline
    if (booking.uncommittedStatusTransitions.length > 0) {
      await runner.manager.insert(BookingStatusTransitionEntity, booking.uncommittedStatusTransitions.map((t) => this.mapper.transitionToEntity(t)));
    }
    // outbox drain — Story 0.7 pattern Story 4.1 baseline
    if (booking.uncommittedEvents.length > 0) {
      await this.outboxPublisher.publishMany(booking.uncommittedEvents, { transactionManager: runner.manager });
    }
    await runner.commitTransaction();
    booking.markEventsCommitted();                                                                          // clear uncommittedEvents
  } catch (err) {
    await runner.rollbackTransaction();
    throw err;
  } finally {
    await runner.release();
  }
}

private isPostgresExclusionViolation(err: unknown): boolean {
  return err instanceof QueryFailedError && (err as any).code === '23P01';                                  // Postgres SQLSTATE exclusion_violation
}
```

- (e) **`Booking.refreshVersion(latestSavedBooking)` aggregate method** — Story 4.1 aggregate UPDATE — used by Story 4.4 retry logic Layer 3 :
```ts
// apps/booking-svc/src/domain/model/booking.aggregate.ts UPDATE Story 4.1
refreshVersion(latest: Booking): void {
  // Re-fetch latest version after optimistic lock conflict — merge any concurrent state changes
  // For Story 4.4 book-listing case : only used at INSERT phase where version=0, so refreshVersion is no-op for INSERT path
  // For Story 4.7+ accept/refuse/cancel future retries : merge state from DB
  this.version = latest.version;
  this.status = latest.status;
  this.acceptedAt = latest.acceptedAt;
  // ... (do not merge uncommittedEvents — they're transient)
}
```
- Tests : verify retry path works (mock 1ʳᵉ save throws OptimisticLock, 2ⁿᵈ succeeds) + retry exhaustion path (mock 2 OptimisticLock → throws Layer3)

- (f) **`booking.conflict-detected.v1` outbox event FULL production-ready** (Story 4.1 livré schema reserved baseline — Story 4.4 finalise full producer + payload) — `packages/contracts/src/events/booking/conflict-detected.v1.{schema.json,ts}` :
```ts
// conflict-detected.v1.ts
export interface BookingConflictDetectedEventV1 {
  eventId: string;                          // UUID v7
  eventType: 'booking.conflict-detected.v1';
  eventVersion: 'v1';
  occurredAt: string;                       // ISO 8601 UTC
  correlationId: string;                    // saga correlation
  causationId?: string;
  actor: { userId: string; role: 'client' | 'pro' | 'admin' | 'system'; locale: 'fr' | 'en' };
  aggregate: { type: 'booking-attempt'; id: string };  // pseudo-aggregate — not a real Booking yet
  payload: {
    listingId: string;
    customerProfileId: string;
    period: { startAt: string; endAt: string };
    layer: 1 | 2 | 3;                       // which layer detected
    code: 'BOOKING-CONFLICT-001' | 'BOOKING-CONFLICT-002' | 'BOOKING-CONFLICT-003';
    detectedAt: string;
  };
}
```
- **JSON Schema v7** validation
- **Subject NATS** `booking.conflict-detected.v1` (existing `BOOKING` stream Story 4.1) — consumed by Story 2.7 audit_log (NFR82 immutable audit) + Story 4.13 saga monitoring R11 (Grafana metric `tukio_booking_conflict_total{layer,code}`)

- (g) **Gateway-api `POST /v1/bookings/checkout-session` endpoint NEW** (`apps/gateway-api/src/infrastructure/http/controllers/bookings.controller.ts` NEW) — endpoint canonique Customer-facing pour transformer cart → Booking. **Auth required** (`KeycloakJwtGuard` Story 1.2 + `Roles('client')`) :
```ts
@Controller({ path: 'bookings', version: '1' })
@UseGuards(KeycloakJwtGuard)
export class BookingsController {
  @Post('checkout-session')
  @Roles('client')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })                                                       // 10 attempts/min (R5 spam prevention)
  @UsePipes(new ZodValidationPipe(BookListingRequestSchema))
  async checkoutSession(@Body() body: BookListingRequestDto, @ActorContext() actor: Actor): Promise<SuccessEnvelope<BookListingResponse>> {
    const correlationId = randomUUID();                                                                     // saga correlation Story 0.7 CorrelationContext
    const result = await this.bookListingForwarder.execute({ ...body, customerProfileId: actor.userProfileId, correlationId, actorLocale: actor.locale });
    return Envelope.success(result, { correlationId, locale: actor.locale });
  }
}
```
- **DTO** `BookListingRequestDto` (`packages/contracts/src/dtos/booking/book-listing-request.dto.ts` — Story 4.1 livré baseline DTO Story 4.4 finalise) :
```ts
export const BookListingRequestSchema = z.object({
  cartId: z.string().uuid(),
  period: z.object({
    startAt: z.string().datetime(),
    endAt: z.string().datetime(),
  }).refine((p) => new Date(p.startAt) < new Date(p.endAt), { message: 'startAt must be before endAt' }),
  // paymentMethodId optional MVP — Story 4.5 Stripe Elements will set later via PaymentIntent client_secret confirm flow
});
```
- **Forwarder** `apps/gateway-api/src/usecases/booking/book-listing.forwarder.ts` NEW — POST booking-svc internal `/internal/bookings/checkout-session` (X-Internal-Service-Token Story 1.10 pattern)
- **booking-svc internal endpoint** `apps/booking-svc/src/infrastructure/http/controllers/booking.controller.ts` NEW (co-located avec cart.controller Story 4.3) — wraps `BookListingUseCase`
- **Error mapping** `BookingConflictLayer1/2/3Exception` → 409 `BOOKING-CONFLICT-00X` envelope ADR-014 with **i18n message dispatch** based on `actor.locale` (Story 0.9 next-intl backend extension OR i18n map in exception classes)
- **Tests E2E gateway** 10 scenarios : happy + each Layer conflict 409 + cart-not-found 404 + cart-empty 422 + self-booking 422 + listing-unpublished 410 + throttle 429 + envelope shape verify

- (h) **`POST /v1/bookings` legacy alias?** — epic L1653 says `POST /v1/bookings` (not `/checkout-session`). **Decision** : Story 4.4 livre `POST /v1/bookings/checkout-session` as canonical (semantic clearer, alignment with Story 4.5 Stripe Elements terminology). NO legacy `POST /v1/bookings` alias MVP (Story 4.7 will add `POST /v1/bookings/<id>/accept` etc. as separate endpoints).

- (i) **Pro `manual-block` placeholder baseline** (V1 FR28) — epic L1657 mentions `seller/bookings/manual-block`. Story 4.4 livre **baseline only** (V1 finalise full Pro UI + use case) :
  - `apps/booking-svc/src/usecases/manual-block-availability.usecase.ts` — skeleton signature stub (commented out OR returns 501 Not Implemented + log) — V1 finalise
  - Tests : 1 scenario (skeleton returns 501)
  - Note in code: "**Story 4.4 baseline placeholder — Story 8.x V1 finalise full Pro manual-block flow with same 3-layer protection.**"

- (j) **Chaos test 100-parallel** `apps/booking-svc/test/chaos/availability-conflict.spec.ts` NEW (NFR46 réutilise `@tukio/testing` Story 0.9 chaos helpers) :
```ts
describe('Chaos: 100 customers race for same slot', () => {
  it('exactly 1 booking succeeds + 99 receive 409 envelope', async () => {
    const { booking, postgres, redis, nats } = await setupChaosEnv();                                       // testcontainer Postgres + Redis + NATS
    const listing = await seedListing();
    const period = { startAt: '2026-06-15T10:00:00Z', endAt: '2026-06-15T18:00:00Z' };

    // 100 parallel customers
    const customerIds = Array.from({ length: 100 }, (_, i) => `customer-${i}`);
    const results = await Promise.allSettled(
      customerIds.map((cid) => booking.bookListingUseCase.execute({
        cartId: createCartForCustomer(cid, listing.id, period).id,
        customerProfileId: cid,
        period,
        correlationId: `chaos-${cid}`,
      }))
    );

    // assert exactly 1 fulfilled
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(99);

    // assert all 99 rejections are clean BookingConflictException variants
    rejected.forEach((r) => {
      const err = (r as PromiseRejectedResult).reason;
      expect(['BOOKING-CONFLICT-001', 'BOOKING-CONFLICT-002', 'BOOKING-CONFLICT-003']).toContain(err.tukioCode);
    });

    // assert DB has exactly 1 booking with status pending_pro_acceptance
    const bookings = await postgres.query("SELECT * FROM booking WHERE listing_id = $1 AND status = 'pending_pro_acceptance'", [listing.id]);
    expect(bookings.rows).toHaveLength(1);

    // assert NATS received 1 booking.requested.v1 + 99 booking.conflict-detected.v1
    const events = await nats.replayStream('BOOKING', period.startAt);
    expect(events.filter((e) => e.eventType === 'booking.requested.v1')).toHaveLength(1);
    expect(events.filter((e) => e.eventType === 'booking.conflict-detected.v1')).toHaveLength(99);

    // assert layer distribution — Layer 1 should catch most, Layer 2 some, Layer 3 rare
    const layerDist = events.filter((e) => e.eventType === 'booking.conflict-detected.v1').reduce((acc, e) => { acc[e.payload.layer] = (acc[e.payload.layer] ?? 0) + 1; return acc; }, {});
    expect(layerDist[1]).toBeGreaterThan(0);                                                                // Redis fast-fail
    // Layer 2 + Layer 3 may or may not trigger depending on timing
  });

  // Variant : Redis cluster failure → Layer 2 must still protect
  it('Layer 1 disabled (Redis cluster down) → Layer 2 GIST still enforces 1-of-100', async () => {
    const { booking, postgres, nats } = await setupChaosEnv({ disableRedis: true });
    // ... same as above but only Layer 2 + Layer 3 catches conflicts
    // assert still exactly 1 booking + Layer 2 majority + 0 Layer 1
  });
});
```
- **Tests** also include : single-thread integration test verifying each layer triggers correctly with mocks + spy assertions on which layer caught each conflict
- **Performance** : NFR3 < 1s p95 happy path booking submission + < 500 ms p95 for 409 conflict response (Prometheus histogram `tukio_booking_submission_duration_seconds{outcome}`)
- **CI gate Story 0.11** : chaos test MUST pass on every PR touching booking-svc OR availability-lock-svc

- (k) **NFR82 audit `booking.conflict-detected.v1` consumer** — Story 2.7 audit_log baseline consumer subscribes `booking.*.v1`. Story 4.4 just produces event with proper payload structure; consumption is Story 2.7 automatic. **Test integration** verify Story 2.7 audit_log consumer ingests `booking.conflict-detected.v1` and persists to `audit_log` table with proper actor/listing/period/correlationId.

- (l) **Lint boundaries strict + EN strict + latest stable versions** — `pnpm --filter=booking-svc lint` 0 violations boundaries (Story 4.1 baseline maintained). EN strict (booking_no_period_overlap constraint name, BOOKING-CONFLICT-001 codes, English Postgres extension). Postgres `btree_gist` extension is standard core (no version pinning needed). TypeORM optimistic lock pattern.

- (m) **Logger structured pino + correlation propagation** — every layer 1/2/3 conflict logs structured event `{level: 'warn', layer, code, listingId, customerProfileId, period, correlationId}` — searchable in Grafana Tempo. NO PII (no email/phone in logs — customerProfileId only). 

## Acceptance Criteria

1. **AC1 — `book-listing.usecase.ts` FULL impl + 3-layer race conditions wired + cart consume + clear** : Given Story 4.1 livré skeleton + Story 4.3 livré cart aggregate + `ICartRepository`, When je consulte `apps/booking-svc/src/usecases/book-listing.usecase.ts`, Then :
   - **Step 1** : `cartRepo.findById` + invariants (cart not empty, single-line MVP, self-booking-forbidden)
   - **Step 2** : `listingSnapshot.fetchSnapshot` (Story 4.1 `IListingSnapshotPort` — anti-stale-cart re-fetch authoritative)
   - **Step 3 Layer 1** : `availabilityLock.acquire(listingId, period, 30)` Story 4.1 baseline — if null → emit `booking.conflict-detected.v1` Layer 1 + throw `BookingConflictLayer1Exception` (409 BOOKING-CONFLICT-001)
   - **Step 4** : `Booking.create(...)` Story 4.1 aggregate factory (invariants checked domain)
   - **Step 5 Layer 2 + Layer 3** : `bookingRepo.save(booking)` — catch `BookingDbExclusionConstraintException` (Layer 2 GIST 23P01) → emit + throw Layer2Exception 409 BOOKING-CONFLICT-002 ; catch `BookingOptimisticLockException` (Layer 3) → retry × 1 max + reload booking version + retry → if exhausted emit + throw Layer3Exception 409 BOOKING-CONFLICT-003 ; bubble other errors (NATS down, etc.)
   - **Step 6** : `cartRepo.delete(cartId)` (cart consumed — Story 4.3 baseline réutilisé)
   - **Step 7 finally** : `availabilityLock.release(lockId)` (TTL 30s safety net + explicit good citizen)
   - **Returns** `{ bookingId, status: 'pending_pro_acceptance', paymentMethodId? }`
   - **Tests** ≥ 90 % use case unit + integration : 15 scenarios (happy, cart-not-found, cart-empty, multi-line MVP rejected, self-booking forbidden, listing-not-found, listing-unpublished, Layer 1 hit, Layer 2 hit, Layer 3 hit + retry success, Layer 3 hit + retry exhausted, NATS publish fail rollback, cart delete failure handling, correlationId propagation, lock release on success + on exception)

2. **AC2 — DB migration ADD `btree_gist` extension + GIST exclusion constraint** : Given Story 4.1 baseline `booking` table without GIST (line 436 deferred Story 4.4), When je consulte `apps/booking-svc/src/infrastructure/persistence/typeorm/migrations/<timestamp>-AddGistExclusionConstraint.ts`, Then :
   - `CREATE EXTENSION IF NOT EXISTS btree_gist` (Postgres 16 native)
   - `ALTER TABLE booking ADD CONSTRAINT booking_no_period_overlap EXCLUDE USING GIST (listing_id WITH =, tstzrange(start_at, end_at, '[)') WITH &&) WHERE (status IN ('pending_pro_acceptance', 'confirmed') AND deleted_at IS NULL);`
   - **`down()` migration** : DROP CONSTRAINT booking_no_period_overlap; conditional DROP EXTENSION (only if no other table depends — likely just leave it)
   - **Tests integration testcontainer Postgres 16** 6 scenarios :
     - Migration up creates extension + constraint
     - INSERT 2 overlapping bookings same listing same period → 2nd fails with `exclusion_violation (23P01)`
     - INSERT 2 non-overlapping same listing → both succeed
     - INSERT overlapping different listings → both succeed
     - INSERT overlapping but one is `cancelled` → succeeds (WHERE filter)
     - Migration down removes constraint cleanly without breaking existing rows

3. **AC3 — 4 NEW exceptions (3 conflict + 1 optimistic-lock internal + 1 db-exclusion internal)** : Given Story 4.1 livré 5 base exceptions, When Story 4.4 ajoute, Then :
   - **3 public exceptions** : `BookingConflictLayer1Exception` (409 BOOKING-CONFLICT-001) + `BookingConflictLayer2Exception` (409 BOOKING-CONFLICT-002) + `BookingConflictLayer3Exception` (409 BOOKING-CONFLICT-003)
   - **`toEnvelope()` method** each — ADR-014 mapping with `tukioCode` + `httpStatus` + `title` (i18n key) + `detail` (i18n key with listingId/period placeholders) + `instance`
   - **2 internal exceptions** : `BookingOptimisticLockException` (INTERNAL — not exposed to client, caught by use case retry logic) + `BookingDbExclusionConstraintException` (INTERNAL — wraps Postgres 23P01 raised by `TypeormBookingRepository.save`, mapped to Layer 2 in use case)
   - **i18n message hints** : exception classes export `messageKey: string` + `params: Record<string, unknown>` for Story 5.4 notification-svc email templates + Story 0.9 next-intl frontend toast messages
   - **Tests** : exception construction + `toEnvelope()` serialization + chain instanceof (10 cases AC3)

4. **AC4 — `TypeormBookingRepository.save` UPDATE Story 4.1 baseline — full optimistic lock + GIST error mapping** : Given Story 4.1 livré `save()` transactional outbox drain, When Story 4.4 finalise, Then :
   - **INSERT path** (`booking.version === 0`) : catch Postgres `QueryFailedError` with `code === '23P01'` → throw `BookingDbExclusionConstraintException`
   - **UPDATE path** (`booking.version > 0`) : `WHERE id = $1 AND version = $2` + SET `version = $2 + 1` — if `result.affected === 0` → throw `BookingOptimisticLockException`
   - **Transactional outbox drain** Story 4.1 preserved (drain `uncommittedEvents` to outbox table in same transaction + `OutboxPublisher` Story 0.7)
   - **Rollback on any error** + clean QueryRunner release in finally
   - **Tests integration testcontainer Postgres + NATS 8 scenarios** : INSERT happy + outbox drain commit, INSERT GIST violation throws DbExclusion + rollback (outbox NOT drained), UPDATE happy version++, UPDATE optimistic lock throws (concurrent UPDATE simulation), retry succeeds on 2nd attempt, retry exhausted, transaction commit failure rollback (no partial state), QueryRunner released on success + on exception

5. **AC5 — `Booking.refreshVersion(latestSavedBooking)` aggregate method UPDATE Story 4.1** : Given Story 4.4 retry logic Layer 3, When je consulte `apps/booking-svc/src/domain/model/booking.aggregate.ts` UPDATE, Then :
   - Method `refreshVersion(latest: Booking)` merges `version`, `status`, `acceptedAt`, terminal timestamps from latest DB state (NOT `uncommittedEvents` — those are transient)
   - **Idempotent** : safe to call multiple times
   - **Tests** : 3 scenarios (refresh updates version, refresh preserves uncommittedEvents, refresh after concurrent state change merges status correctly)

6. **AC6 — `booking.conflict-detected.v1` outbox event FULL production-ready (Story 4.1 schema reserved → Story 4.4 producer)** : Given Story 4.1 reserved schema baseline, When Story 4.4 finalise, Then :
   - **`packages/contracts/src/events/booking/conflict-detected.v1.{schema.json,ts}`** FULL payload (cf. story body section f) :
     - `payload`: `{ listingId, customerProfileId, period: { startAt, endAt }, layer: 1|2|3, code: 'BOOKING-CONFLICT-001'|'002'|'003', detectedAt: ISO 8601 }`
     - `aggregate.type = 'booking-attempt'` (pseudo-aggregate — not a real Booking yet, since it failed to be created)
   - **JSON Schema v7** validation + types auto-generated (Story 0.2 `json-schema-to-typescript`)
   - **Subject NATS** `booking.conflict-detected.v1` on existing `BOOKING` stream (Story 4.1 baseline)
   - **Producer wired** in `book-listing.usecase.ts` — emits via `OutboxPublisher` Story 0.7 (transactional outside booking transaction since booking failed to insert — emit on dedicated `outbox` infrastructure call)
   - **Consumed Story 2.7 audit_log** automatically (no Story 4.4 work — audit consumer subscribes `booking.*.v1`)
   - **Consumed Story 4.13 saga monitoring** automatically (Prometheus metric `tukio_booking_conflict_total{layer,code}` increment from NATS subscriber Story 4.13 livré)
   - **Tests** : event schema validation + producer emit on each layer conflict + integration round-trip publish → NATS → consumer

7. **AC7 — gateway-api `POST /v1/bookings/checkout-session` + forwarder + Zod + auth + throttle + envelope** : Given Story 1.2 livré KeycloakJwtGuard + envelope filter + throttle, When Story 4.4 ajoute, Then :
   - **`apps/gateway-api/src/infrastructure/http/controllers/bookings.controller.ts`** NEW — endpoint `POST /v1/bookings/checkout-session`
   - **Auth required** : `@UseGuards(KeycloakJwtGuard)` + `@Roles('client')` (Customer authenticated only — Story 1.2 pattern réutilisé)
   - **Throttle** : `@Throttle({ default: { limit: 10, ttl: 60_000 } })` — 10 attempts/min/user (R5 spam prevention + UX rate limit)
   - **Zod validation** : `BookListingRequestSchema` (Story 4.1 baseline DTO Story 4.4 finalise) — `{ cartId: uuid, period: { startAt, endAt }, paymentMethodId?: string }`
   - **Correlation ID** : `randomUUID()` set at controller layer (Story 0.7 `CorrelationContext`) + propagated via NATS event headers + booking-svc internal call
   - **Forwarder** : `apps/gateway-api/src/usecases/booking/book-listing.forwarder.ts` NEW → booking-svc internal `POST /internal/bookings/checkout-session` (X-Internal-Service-Token Story 1.10)
   - **booking-svc internal endpoint** `apps/booking-svc/src/infrastructure/http/controllers/booking.controller.ts` NEW (co-located avec cart.controller Story 4.3) — wraps `BookListingUseCase`
   - **Error mapping** : 3 conflict exceptions → 409 envelope with `tukioCode` + i18n hint (`actor.locale`) ; cart-not-found → 404 ; cart-empty/multi-line/self-booking → 422 ; listing-unpublished → 410 (Story 3.10 ListingUnpublishedException baseline) ; auth missing → 401 ; throttle exceeded → 429
   - **Tests E2E gateway** 10 scenarios AC7 : happy + each Layer conflict 409 + cart-not-found 404 + cart-empty 422 + self-booking 422 + listing-unpublished 410 + throttle 429 + envelope shape verify + correlationId propagation header

8. **AC8 — Pro `manual-block-availability.usecase.ts` baseline placeholder (V1 FR28)** : Given epic L1657 mentions Pro manual-block needs same 3-layer protection, When Story 4.4 livre baseline, Then :
   - **`apps/booking-svc/src/usecases/manual-block-availability.usecase.ts`** — skeleton signature (NOT wired in `UseCasesProxyModule` MVP — V1 wires)
   - **Returns 501 Not Implemented** OR throws explicit `NotImplementedException` with message "Story 8.x V1 finalise full Pro manual-block flow with same 3-layer race condition protection (Story 4.4 baseline)"
   - **Test** : 1 scenario verifying skeleton exists + returns 501
   - **Note in code** : explicit comment referencing Story 8.x V1 finalisation + epic reference + same Layer 1/2/3 pattern reusable

9. **AC9 — Chaos test 100-parallel `availability-conflict.spec.ts` NFR46** : Given Story 0.9 livré `@tukio/testing` chaos helpers + testcontainer Postgres + Redis + NATS, When Story 4.4 ajoute chaos suite, Then :
   - **`apps/booking-svc/test/chaos/availability-conflict.spec.ts`** NEW — 2 chaos scenarios :
     - **Scenario 1** : 100 customers race same slot — `Promise.allSettled` all booking submissions — assert exactly 1 fulfilled + 99 rejected with `BOOKING-CONFLICT-001/002/003` tukioCode + DB has exactly 1 booking `pending_pro_acceptance` + NATS received 1 `booking.requested.v1` + 99 `booking.conflict-detected.v1` + layer distribution mostly Layer 1 (Redis fast-fail catches most)
     - **Scenario 2** : Layer 1 disabled (Redis cluster down via `setupChaosEnv({ disableRedis: true })`) → Layer 2 GIST still enforces 1-of-100 — assert exactly 1 success + 99 fail with Layer 2 majority + 0 Layer 1
   - **Performance assertions** : booking submission p95 < 1s happy path + 409 conflict response p95 < 500ms (Prometheus histogram)
   - **CI gate Story 0.11** : chaos test MUST pass on every PR touching booking-svc OR cart-svc consume OR availability-lock infra
   - **`@tukio/testing/chaos/100-parallel-bookings.helper.ts`** NEW helper utility for setup — pattern réutilisable Stories 8.x V1 multi-vendor parallel saga + Story 12.x V1 quote conflicts
   - **Tests** : the chaos test IS the deliverable — must reliably pass 10/10 runs locally + CI

10. **AC10 — Booking aggregate `Booking.create` UPDATE Story 4.1 — set `paymentMethodId` placeholder + correlationId from caller** : Given Story 4.1 livré factory `Booking.create({...})`, When Story 4.4 verify, Then :
    - Story 4.1 baseline `correlationId` field already in factory — Story 4.4 verify caller passes saga correlation
    - **`paymentMethodId: string | null`** field added to Booking aggregate (Story 4.4 UPDATE Story 4.1 aggregate) — Story 4.5 Stripe Elements will populate via separate `attach-payment-method.usecase` future
    - DB migration adds column `payment_method_id VARCHAR(100) NULL` to `booking` table (NEW migration Story 4.4)
    - Tests : 3 scenarios (factory accepts paymentMethodId null MVP, factory accepts paymentMethodId string V1+, column persisted correctly)

11. **AC11 — `Booking.refreshVersion` aggregate UPDATE + retry logic verifiable** : Given AC5, When Story 4.4 verify integration, Then :
    - Integration test : mock `bookingRepo.save` throws `BookingOptimisticLockException` on 1st call, succeeds on 2nd → use case retry once + assert success
    - Integration test : mock `bookingRepo.save` throws `BookingOptimisticLockException` on 2 calls → use case throws `BookingConflictLayer3Exception` + emits `booking.conflict-detected.v1` Layer 3

12. **AC12 — Logger structured pino + correlation propagation + NO PII** : Given Story 1.10 baseline pino + Story 0.7 CorrelationContext, When Story 4.4 logs conflict, Then :
    - **Each layer conflict logs structured event** `{level: 'warn', layer: 1|2|3, code, listingId, customerProfileId, period: { startAt, endAt }, correlationId, durationMs}` — searchable Grafana Tempo
    - **NO PII** in logs (no email/phone/full name — only `customerProfileId` UUID v7)
    - **Latency metric** `tukio_booking_submission_duration_seconds{outcome="success"|"conflict_layer_1"|"conflict_layer_2"|"conflict_layer_3"|"error"}` (Prometheus histogram) — instrumented in use case
    - Tests : 3 security scenarios (log captures no email + customerProfileId only + correlationId propagated + metric instrumentation verify)

13. **AC13 — Cart consume + clear post-success + atomic with booking creation** : Given Story 4.3 livré `ICartRepository.delete`, When Story 4.4 `book-listing.usecase` succeeds, Then :
    - **`cartRepo.delete(cartId)` AFTER `bookingRepo.save` commits successfully** — NOT in same transaction (cross-aggregate transaction would require 2PC, over-engineering MVP)
    - **Failure mode handling** : if booking commits but cart delete fails → log error, return success to client (cart will be left orphan + cron `cart-cleanup` V1+ will clean stale carts). UNACCEPTABLE alternative : rollback booking on cart delete fail (over-engineering, Booking already committed downstream consumers).
    - Tests : 3 scenarios (happy path cart cleared, booking commits + cart delete fails logged warning + booking success returned, double-submit idempotency — same cartId twice returns cached result OR re-fetch booking by cartId)

14. **AC14 — NFR82 audit `booking.conflict-detected.v1` event consumed Story 2.7** : Given Story 2.7 livré audit_log NATS consumer subscribes `booking.*.v1`, When Story 4.4 produces conflict event, Then :
    - **Integration test** verify Story 2.7 audit_log consumer ingests `booking.conflict-detected.v1` and persists to `audit_log` table (`tukio_identity.audit_log` per Story 1.10) with proper actor (customerProfileId), aggregate type 'booking-attempt', aggregate id (generated UUID per attempt for audit traceability), payload listingId/period/layer/code, correlationId
    - **No Story 4.4 modification of Story 2.7** — just verify automatic consumption works end-to-end

15. **AC15 — Lint boundaries strict + EN strict + coverage NFR71** : Given Story 0.6 baseline + memories Tukio, When `pnpm --filter=booking-svc lint && pnpm --filter=booking-svc test --coverage`, Then :
    - **0 violations boundaries** sur `apps/booking-svc/src/domain/**` (3 new exceptions pure domain) + `apps/booking-svc/src/usecases/**` (full impl uses ports only)
    - **EN strict** : `booking_no_period_overlap` constraint name, `BOOKING-CONFLICT-001/002/003` codes, English Postgres extension `btree_gist`, English SQL identifiers
    - **i18n** : exception messages exposed to client via envelope have `messageKey` for Story 0.9 next-intl frontend translation (FR/EN dispatch based on `actor.locale`)
    - **Coverage NFR71** : ≥ 95 % domain (3 new exceptions + Booking aggregate `refreshVersion`) + ≥ 90 % usecases (book-listing full impl + manual-block skeleton) + ≥ 80 % infrastructure (migration testcontainer Postgres 16 + TypeormBookingRepository UPDATE + booking.controller internal)
    - **Coverage report** uploadé CI Story 0.11 → fail si < threshold

16. **AC16 — Performance NFR3 + Prometheus metrics + Grafana dashboard skeleton** : Given Story 0.11 baseline CI perf + Story 4.13 future saga monitoring R11, When Story 4.4 instrument, Then :
    - **Prometheus histogram `tukio_booking_submission_duration_seconds{outcome,layer?}`** instrumented in `book-listing.usecase` (label outcome ∈ {success, conflict_layer_1, conflict_layer_2, conflict_layer_3, error})
    - **Performance budget** : p95 < 1s happy path + p95 < 500ms 409 conflict response
    - **NEW Grafana panel** added to existing dashboard `infra/k8s/grafana-dashboards/booking-svc.json` (Story 4.1 baseline OR NEW Story 4.4) — panels : booking submission rate, success rate, conflict layer distribution (stacked), p95 latency
    - Story 4.13 finalise full saga-health Grafana — Story 4.4 livre baseline metric ingestion ready
    - Tests : metric instrumentation verify via test scrape + Prometheus rule `BookingHighConflictRate` `rate(tukio_booking_submission_total{outcome=~"conflict_.*"}[5m]) / rate(tukio_booking_submission_total[5m]) > 0.10 for 10m` → warning Slack `#tukio-alerts-ops`

17. **AC17 — Documentation + handoff Stories 4.5/4.7/8.x V1** : Given AC1-16 livrés, When je consulte la doc, Then :
    - **NEW `docs/runbook/booking-race-conditions-debug.md`** (~40 lignes) — debugging guide each layer + Redis cluster failover scenario + GIST constraint analysis + optimistic lock retry tuning + chaos test invocation local + Grafana panels lookup
    - **UPDATE `docs/runbook/booking-saga-debug.md`** Story 4.1/4.2 livré — add section "Race conditions debugging" (cross-reference new runbook)
    - **UPDATE `docs/adr/0006-saga-choreographed.md`** — Implementation Notes : Story 4.4 livre 3-layer race conditions protection complete (Story 4.1 baseline Layer 1 → Story 4.4 finalise full)
    - **UPDATE `docs/project-context.md`** Story 1.10 baseline — add section "Booking 3-Layer Race Conditions (Story 4.4)" — résumé Layer 1/2/3 + GIST constraint + optimistic lock retry × 1 + chaos NFR46 + handoff Story 4.5 (Stripe Elements wire) + 4.7 (Pro accept Story 4.7 will use similar optimistic lock pattern for status transitions) + 8.x V1 (multi-vendor parallel saga reuses pattern per-vendor)
    - **UPDATE `_bmad-output/implementation-artifacts/4-1-booking-svc-pretre-saga-state-machine.md`** Completion Notes — add handoff "Story 4.4 livré : 3-layer race conditions complete, full book-listing.usecase, GIST exclusion constraint, BOOKING-CONFLICT-001/002/003 exceptions, booking.conflict-detected.v1 producer, chaos test 100-parallel"
    - **UPDATE `_bmad-output/implementation-artifacts/4-3-cart-ui-mono-vendor-persistence-zustand.md`** Completion Notes — add handoff "Story 4.4 consumes cart via book-listing.usecase + cart.delete post-success"
    - **`@tukio/testing/chaos/100-parallel-bookings.helper.ts`** NEW reusable helper (pattern Stories 8.x V1 + 12.x V1)
    - **Commit** `feat(booking-svc,gateway-api,contracts,messaging,testing,infra): Story 4.4 3-layer race condition protection + full book-listing.usecase + GIST exclusion constraint + 3 BOOKING-CONFLICT exceptions + booking.conflict-detected.v1 producer + 100-parallel chaos test NFR46 + NFR82 audit + cart consume Story 4.3 + Grafana metric baseline R11`

## Tasks / Subtasks

- [ ] **Task 1 — DB migration ADD `btree_gist` extension + GIST exclusion constraint + `payment_method_id` column** (AC: #2, #10) — coverage ≥ 80 % integration
  - [ ] 1.1 — `apps/booking-svc/src/infrastructure/persistence/typeorm/migrations/<timestamp>-AddGistExclusionConstraint.ts` (CREATE EXTENSION + ALTER TABLE ADD CONSTRAINT + ALTER TABLE ADD COLUMN payment_method_id)
  - [ ] 1.2 — Down migration verified clean (DROP CONSTRAINT + conditional DROP EXTENSION)
  - [ ] 1.3 — Tests integration testcontainer Postgres 16 — 6 scenarios AC2 + 1 scenario AC10 column add
  - [ ] 1.4 — UPDATE `apps/booking-svc/.env.example` if needed (likely no — btree_gist core extension)

- [ ] **Task 2 — 4 new exceptions (3 public + 2 internal) + i18n message hints** (AC: #3)
  - [ ] 2.1 — `apps/booking-svc/src/domain/exception/booking-conflict/{booking-conflict-layer-1,booking-conflict-layer-2,booking-conflict-layer-3}.exception.ts`
  - [ ] 2.2 — `apps/booking-svc/src/domain/exception/booking-conflict/booking-optimistic-lock.exception.ts` (INTERNAL)
  - [ ] 2.3 — `apps/booking-svc/src/infrastructure/persistence/typeorm/exceptions/booking-db-exclusion-constraint.exception.ts` (INTERNAL infra layer — wraps Postgres 23P01)
  - [ ] 2.4 — `toEnvelope()` method each public exception + i18n `messageKey`/`params` for Story 0.9 frontend translation + Story 5.4 email notification
  - [ ] 2.5 — Tests construction + serialization + chain instanceof 10 cases AC3

- [ ] **Task 3 — `TypeormBookingRepository.save` UPDATE Story 4.1 — full optimistic lock + GIST error mapping** (AC: #4) — coverage ≥ 80 % integration
  - [ ] 3.1 — UPDATE `apps/booking-svc/src/infrastructure/persistence/typeorm/repositories/booking.typeorm.repository.ts` Story 4.1 — full INSERT/UPDATE branching + `isPostgresExclusionViolation(err)` helper + optimistic lock check `result.affected === 0` + transactional outbox drain preserved
  - [ ] 3.2 — Tests integration testcontainer Postgres + NATS 8 scenarios AC4

- [ ] **Task 4 — `Booking.refreshVersion(latest)` aggregate method UPDATE Story 4.1** (AC: #5, #11)
  - [ ] 4.1 — UPDATE `apps/booking-svc/src/domain/model/booking.aggregate.ts` Story 4.1 — add `refreshVersion` method
  - [ ] 4.2 — Tests 3 scenarios AC5 (idempotent + preserve uncommittedEvents + merge concurrent state)
  - [ ] 4.3 — Integration test : retry succeeds on 2nd attempt + retry exhausted scenarios AC11

- [ ] **Task 5 — `book-listing.usecase.ts` FULL impl** (AC: #1, #13) — coverage ≥ 90 %
  - [ ] 5.1 — UPDATE `apps/booking-svc/src/usecases/book-listing.usecase.ts` Story 4.1 skeleton → full impl (cf. story body section a — 7 steps)
  - [ ] 5.2 — Wire `ICartRepository` Story 4.3 baseline + `ICartRepository.delete` post-success
  - [ ] 5.3 — Wire `IListingSnapshotPort` Story 4.1 anti-stale-cart fetch
  - [ ] 5.4 — Wire 3-layer error handling (Layer 1 lock null, Layer 2 catch BookingDbExclusionConstraintException, Layer 3 catch BookingOptimisticLockException + retry × 1 + reload via refreshVersion)
  - [ ] 5.5 — Wire `OutboxPublisher` emit `booking.conflict-detected.v1` on each conflict layer
  - [ ] 5.6 — Lock release in `finally` block (TTL safety net + explicit good citizen)
  - [ ] 5.7 — Tests unit + integration 15 scenarios AC1 + 3 scenarios AC13

- [ ] **Task 6 — `booking.conflict-detected.v1` outbox event FULL schema + producer wired** (AC: #6)
  - [ ] 6.1 — UPDATE `packages/contracts/src/events/booking/conflict-detected.v1.{schema.json,ts}` Story 4.1 reserved → Story 4.4 full payload
  - [ ] 6.2 — UPDATE `packages/contracts/src/events/booking/index.ts` barrel export
  - [ ] 6.3 — Wire `OutboxPublisher.publish(new BookingConflictDetectedEvent(...))` in 3 conflict branches of `book-listing.usecase`
  - [ ] 6.4 — Tests integration round-trip publish → NATS → consumer (verify Story 2.7 audit_log ingests automatically) AC6 + AC14

- [ ] **Task 7 — gateway-api `POST /v1/bookings/checkout-session` controller + forwarder + Zod + auth + throttle** (AC: #7) — coverage ≥ 85 %
  - [ ] 7.1 — `apps/gateway-api/src/infrastructure/http/controllers/bookings.controller.ts` NEW
  - [ ] 7.2 — `apps/gateway-api/src/usecases/booking/book-listing.forwarder.ts` NEW (X-Internal-Service-Token Story 1.10)
  - [ ] 7.3 — UPDATE `packages/contracts/src/dtos/booking/book-listing-request.dto.ts` Story 4.1 baseline → Story 4.4 finalise Zod schema
  - [ ] 7.4 — `apps/booking-svc/src/infrastructure/http/controllers/booking.controller.ts` NEW internal endpoint (co-located cart.controller Story 4.3)
  - [ ] 7.5 — Error mapping 3 conflict exceptions → 409 envelope ADR-014 with i18n hint based on `actor.locale`
  - [ ] 7.6 — Tests E2E gateway 10 scenarios AC7

- [ ] **Task 8 — Pro `manual-block-availability.usecase.ts` baseline placeholder V1 FR28** (AC: #8)
  - [ ] 8.1 — `apps/booking-svc/src/usecases/manual-block-availability.usecase.ts` skeleton (returns 501 + explicit comment Story 8.x V1)
  - [ ] 8.2 — Test 1 scenario verifies skeleton returns 501

- [ ] **Task 9 — Chaos test 100-parallel `availability-conflict.spec.ts` NFR46 + `@tukio/testing` helper** (AC: #9) — must pass 10/10 runs
  - [ ] 9.1 — `apps/booking-svc/test/chaos/availability-conflict.spec.ts` NEW — 2 chaos scenarios (full Redis + Redis-disabled Layer 2-only)
  - [ ] 9.2 — `packages/testing/src/chaos/100-parallel-bookings.helper.ts` NEW reusable helper
  - [ ] 9.3 — UPDATE `packages/testing/src/chaos/index.ts` barrel export
  - [ ] 9.4 — Verify chaos test passes 10/10 local runs + integrate into CI Story 0.11 fail-fast
  - [ ] 9.5 — Performance assertions p95 < 1s happy + p95 < 500ms 409 (via Prometheus mock OR direct latency measurement)

- [ ] **Task 10 — Logger structured pino + Prometheus metrics + Grafana panel** (AC: #12, #16)
  - [ ] 10.1 — UPDATE booking-svc pino logger config — extend structured fields (`layer`, `code`, `correlationId`, `durationMs`)
  - [ ] 10.2 — Instrument `tukio_booking_submission_duration_seconds{outcome}` histogram in `book-listing.usecase` + register via prom-client module-level (Story 0.6 pattern)
  - [ ] 10.3 — NEW Grafana panel `infra/k8s/grafana-dashboards/booking-svc.json` (NEW OR UPDATE Story 4.1 baseline) — panels : submission rate, success rate, conflict layer distribution stacked, p95 latency
  - [ ] 10.4 — Prometheus rule `BookingHighConflictRate` (`infra/k8s/prometheus-rules/booking-svc.yaml` NEW OR UPDATE) — alert if > 10 % conflict rate over 10min → warning Slack
  - [ ] 10.5 — Tests metric instrumentation verify + log security 3 scenarios AC12

- [ ] **Task 11 — Lint boundaries strict + coverage NFR71 + EN strict verify** (AC: #15)
  - [ ] 11.1 — `pnpm --filter=booking-svc lint` 0 violations boundaries domain + usecases
  - [ ] 11.2 — Test boundary fail-case (temporary violation file → fail → DELETE)
  - [ ] 11.3 — Coverage NFR71 thresholds enforced CI Story 0.11
  - [ ] 11.4 — EN strict verify (constraint name + error codes + Postgres extension + SQL identifiers)

- [ ] **Task 12 — Documentation runbooks + ADR updates + project-context + commit** (AC: #17)
  - [ ] 12.1 — NEW `docs/runbook/booking-race-conditions-debug.md` (~40 lignes)
  - [ ] 12.2 — UPDATE `docs/runbook/booking-saga-debug.md` Story 4.1/4.2 — add section "Race conditions debugging"
  - [ ] 12.3 — UPDATE `docs/adr/0006-saga-choreographed.md` — Implementation Notes Story 4.4 livre 3-layer
  - [ ] 12.4 — UPDATE `docs/project-context.md` — section "Booking 3-Layer Race Conditions (Story 4.4)"
  - [ ] 12.5 — UPDATE `_bmad-output/implementation-artifacts/4-1-...md` Completion Notes — Story 4.4 handoff
  - [ ] 12.6 — UPDATE `_bmad-output/implementation-artifacts/4-3-...md` Completion Notes — Story 4.4 cart consume
  - [ ] 12.7 — Commit `feat(booking-svc,gateway-api,contracts,messaging,testing,infra): Story 4.4 3-layer race condition protection + full book-listing.usecase + GIST exclusion constraint + 3 BOOKING-CONFLICT exceptions + booking.conflict-detected.v1 producer + 100-parallel chaos test NFR46 + NFR82 audit + cart consume Story 4.3 + Grafana metric baseline R11`

## Dev Notes

### Pourquoi Story 4.4 = R5 critique MVP production-ready

Story 4.4 livre la **garantie production-ready contre les double-bookings** sur le tunnel checkout Customer. C'est le **risque tech #1 Epic 4** (R5 + R11 saga partial failure). Sans Story 4.4 finalisée :
- Story 4.1 livre seulement Layer 1 baseline (Redis SET NX + version field) — insuffisant pour production
- 2 customers cliquant "Confirmer" simultanément peuvent créer 2 Bookings sur le même créneau → 2 PaymentIntents → 1 Pro accepte les 2 → cash refund manuel admin + Customer mécontent + réputation Tukio impactée

Story 4.4 ferme la boucle :
- **Layer 1 Redis** (Story 4.1 baseline) : fast-fail 99 % des cas
- **Layer 2 GIST exclusion constraint** (Story 4.4 NEW) : authoritative DB-level safety net
- **Layer 3 Optimistic locking** (Story 4.4 finalise Story 4.1 version field) : concurrent writes on same aggregate

**Chaos test 100-parallel** garantit que la production peut supporter pic de trafic (e.g., listing populaire avec 50+ vues simultanées). NFR46 CI gate fail-fast empêche regression.

**Story 4.4 = template "multi-layer race condition protection + optimistic lock retry pattern + GIST exclusion constraint + chaos test 100-parallel + correlationId audit conflict"** réutilisable :
- Story 4.7 (Pro accept booking) : optimistic lock on Booking aggregate transition `pending_pro_acceptance → confirmed` (concurrent accept + customer cancel race)
- Story 4.8 (Customer cancel booking) : same optimistic lock pattern
- Story 8.x V1 (multi-vendor parallel saga) : N parallel bookings on different listings, same Customer cart → reuse 3-layer per-listing
- Story 12.x V1 (custom quote) : same pattern for quote acceptance race

### Décisions techniques majeures actées Story 4.4

1. **Layer 1 Redis Upstash SET NX TTL 30s** (Story 4.1 baseline) — explicit lock via `availabilityLock.acquire(listingId, period, 30)` Story 4.1 `IAvailabilityLockPort`. TTL safety net si crash post-lock-pre-release. 30s suffit pour Stripe API latency + DB write (max ~5s observed).

2. **Layer 2 GIST `EXCLUDE USING GIST (listing_id WITH =, tstzrange(start_at, end_at, '[)') WITH &&)`** — Postgres `btree_gist` extension required (Postgres 16 standard). `tstzrange` operator class `&&` (overlap) garantit detection any partial period overlap. Filtered partial constraint `WHERE (status IN ('pending_pro_acceptance', 'confirmed') AND deleted_at IS NULL)` — cancelled/refused/completed bookings don't lock slots. Bracket `[)` = inclusive start, exclusive end (standard Postgres tstzrange notation).

3. **Layer 3 Optimistic locking retry × 1 max** (epic R5 spec line 1656 "retry × 1, sinon 409") — pattern simple : 1 retry then 409. Plus de retry = thundering herd risk. Less retry = false negatives sur concurrent reads benign.

4. **3 exceptions HTTP 409 distinctes (vs single 409)** — `BOOKING-CONFLICT-001/002/003` granular pour :
   - Frontend can show different UX messages (Layer 1 "réessayez dans 30s" temporary, Layer 2 "déjà réservé" definitive, Layer 3 "conflit simultané" rare)
   - Analytics + monitoring : distinguish layer distribution → optimize bottleneck
   - Audit + debugging : Grafana panel stacked by layer + Prometheus alert tunable per-layer

5. **`BookingConflictDetectedEvent` outbox emission (vs direct logger only)** — NFR82 audit requires immutable trace. Outbox event enables :
   - Story 2.7 audit_log consumer auto-ingests
   - Story 4.13 saga monitoring Prometheus metric `tukio_booking_conflict_total{layer,code}` increment from NATS subscriber
   - Future analytics : layer distribution per listing for capacity planning
   - Tradeoff : adds 1 NATS publish overhead per conflict, but acceptable given conflicts are exceptional

6. **`paymentMethodId` field in Booking aggregate** — Story 4.4 ADD but only as nullable placeholder MVP. Story 4.5 (Stripe Elements) will populate via separate use case `attach-payment-method.usecase.ts` after PaymentIntent client_secret confirm flow. This decouples booking creation (Story 4.4) from payment method attachment (Story 4.5).

7. **`POST /v1/bookings/checkout-session` (vs epic `POST /v1/bookings`)** — semantic clearer + alignment Story 4.5 Stripe Elements terminology. Story 4.7 will use `POST /v1/bookings/<id>/accept` for Pro actions. NO `POST /v1/bookings` legacy alias MVP.

8. **`book-listing.usecase.ts` cart consume + `cartRepo.delete` POST-success (vs IN-transaction)** — cross-aggregate transaction would require 2PC or saga compensation. MVP decision : cart delete AFTER booking commits successfully. Failure mode : booking commits + cart delete fails → log warning + return success + orphan cart (cleanup cron V1+). Acceptable : worst case Customer sees stale cart on next visit + refreshes manually.

9. **Listing snapshot re-fetch in `book-listing.usecase`** (Story 4.4 anti-stale-cart) — cart stored snapshot Story 4.3 at add-to-cart time. Between add and submit, listing might have been : (a) unpublished by Pro → Story 4.4 throws `ListingUnpublishedException` 410, (b) price changed → Story 4.4 uses fresh snapshot for booking authoritative price (cart snapshot was only for UX preview), (c) deleted soft-delete → 410. Pattern Story 3.10 ListingUnavailableErrorPage frontend handles 410 gracefully.

10. **Chaos test as deliverable** (vs unit test only) — Story 4.4 ships the chaos test infrastructure. NFR46 CI requires it. 100-parallel customers is realistic upper bound (popular Pro on Black Friday weekend). 10/10 reliability locally + CI ensures regression detection.

11. **Grafana panel + Prometheus alert baseline Story 4.4** (Story 4.13 finalise full saga-health) — Story 4.4 lays metric baseline ingestion. Story 4.13 adds full dashboard + PagerDuty escalade + traces Tempo correlation.

12. **No 2PC / Saga compensation** — Stories Epic 4 saga choreographed pattern (ADR-006). Booking creation = single aggregate write + outbox `booking.requested.v1`. Cart delete = follow-up best-effort. If booking succeeds but cart delete fails → eventual consistency via cron V1+. Acceptable for MVP.

13. **EN strict + Clean Architecture explicit + Envelope ADR-014 + latest stable + lint boundaries strict + i18n FR/EN** memories — toutes respectées.

### Versions à utiliser

| Lib | Usage | Version | Notes |
|-----|-------|---------|-------|
| **PostgreSQL** | DB + `btree_gist` extension + GIST exclusion constraint | **16.x** (Story 0.10 baseline) | `btree_gist` core extension since Postgres 9.1 — stable. tstzrange operator `&&` standard since 9.2 |
| **TypeORM** | ORM + optimistic lock pattern + QueryRunner transactional | (Story 0.6 baseline) | UPDATE Story 0.6 `version` field decorator + manual UPDATE WHERE id AND version (Story 4.1 baseline) |
| `@upstash/redis` | Layer 1 distributed lock | (Story 4.1 baseline) | SET NX + Lua atomic release Story 4.1 |
| `@tukio/messaging` | OutboxPublisher + InboxConsumer | (Story 0.7 baseline) | Producer `booking.conflict-detected.v1` Story 4.4 |
| `@tukio/contracts` | Event schemas + DTOs + envelope | (Story 0.2 baseline) | UPDATE `events/booking/conflict-detected.v1.{schema,ts}` Story 4.1 reserved → Story 4.4 full |
| `@tukio/testing` | testcontainers + chaos helpers | (Story 0.9 baseline) | NEW `chaos/100-parallel-bookings.helper.ts` reusable |
| `@nestjs/throttler` | Rate limit gateway | (Story 1.2 baseline) | 10/min/user booking submission |
| `pino` | Logger structured JSON | (Story 1.10 baseline) | UPDATE booking-svc redact + extend fields layer/code/correlationId/durationMs |
| `prom-client` | Prometheus metrics | (Story 0.12 baseline) | Histogram `tukio_booking_submission_duration_seconds` |

### Project Structure cible

```
# ====== NEW Story 4.4 ======

apps/booking-svc/src/
├─ domain/exception/booking-conflict/
│  ├─ booking-conflict-layer-1.exception.ts                                                            # NEW Story 4.4 (BOOKING-CONFLICT-001 → 409)
│  ├─ booking-conflict-layer-2.exception.ts                                                            # NEW (BOOKING-CONFLICT-002 → 409)
│  ├─ booking-conflict-layer-3.exception.ts                                                            # NEW (BOOKING-CONFLICT-003 → 409)
│  └─ booking-optimistic-lock.exception.ts                                                             # NEW INTERNAL (not exposed to client)
├─ infrastructure/
│  ├─ persistence/typeorm/
│  │  ├─ exceptions/booking-db-exclusion-constraint.exception.ts                                       # NEW INTERNAL (wraps Postgres 23P01)
│  │  └─ migrations/<timestamp>-AddGistExclusionConstraint.ts                                          # NEW (CREATE EXTENSION btree_gist + EXCLUDE USING GIST + ADD COLUMN payment_method_id)
│  └─ http/controllers/booking.controller.ts                                                            # NEW internal endpoint (co-located cart.controller Story 4.3)
├─ test/chaos/availability-conflict.spec.ts                                                            # NEW chaos test 100-parallel NFR46

apps/gateway-api/src/
├─ infrastructure/http/controllers/bookings.controller.ts                                              # NEW POST /v1/bookings/checkout-session
└─ usecases/booking/book-listing.forwarder.ts                                                          # NEW

packages/contracts/src/
├─ events/booking/conflict-detected.v1.{schema.json,ts}                                                # UPDATE Story 4.1 reserved → Story 4.4 full payload
├─ events/booking/index.ts                                                                             # UPDATE barrel export
└─ dtos/booking/book-listing-request.dto.ts                                                            # UPDATE Story 4.1 baseline → Story 4.4 finalise Zod schema

packages/testing/src/
├─ chaos/100-parallel-bookings.helper.ts                                                               # NEW reusable helper (pattern Stories 8.x V1)
└─ chaos/index.ts                                                                                      # UPDATE barrel export

infra/k8s/
├─ grafana-dashboards/booking-svc.json                                                                 # NEW OR UPDATE — panels submission rate + conflict layer distribution + p95 latency
└─ prometheus-rules/booking-svc.yaml                                                                   # NEW OR UPDATE — BookingHighConflictRate alert

docs/runbook/booking-race-conditions-debug.md                                                          # NEW ~40 lignes
docs/runbook/booking-saga-debug.md                                                                     # UPDATE Story 4.1/4.2 — add race conditions section

# ====== UPDATE Story 4.4 ======

apps/booking-svc/src/
├─ domain/model/booking.aggregate.ts                                                                   # UPDATE Story 4.1 — add `refreshVersion(latest)` method + `paymentMethodId` field
├─ usecases/book-listing.usecase.ts                                                                    # UPDATE Story 4.1 skeleton → FULL impl 7-step 3-layer
├─ usecases/manual-block-availability.usecase.ts                                                       # NEW baseline placeholder V1 FR28 (Story 8.x finalise)
└─ infrastructure/persistence/typeorm/repositories/booking.typeorm.repository.ts                       # UPDATE Story 4.1 — full optimistic lock + GIST error mapping

docs/adr/0006-saga-choreographed.md                                                                    # UPDATE Implementation Notes (3-layer livré)
docs/project-context.md                                                                                # UPDATE — section "Booking 3-Layer Race Conditions (Story 4.4)"
_bmad-output/implementation-artifacts/4-1-booking-svc-pretre-saga-state-machine.md                     # UPDATE Completion Notes — Story 4.4 handoff
_bmad-output/implementation-artifacts/4-3-cart-ui-mono-vendor-persistence-zustand.md                   # UPDATE Completion Notes — Story 4.4 consumes cart

# Estimation : ~22 nouveaux + ~10 updates = ~32 fichiers
```

### Critical Architecture Constraints

> Cf. Stories 0.2 (contracts events + DTOs), 0.6 (Pretre baseline + boundaries lint), 0.7 (@tukio/messaging OutboxPublisher + InboxConsumer + CorrelationContext), 0.9 (@tukio/testing testcontainers + chaos helpers), 0.10 (docker-compose Postgres 16 + Redis Upstash dev local), 0.11 (CI coverage + chaos tests gate + Lighthouse), 0.12 (Prometheus + Grafana baseline DigitalOcean Droplets), 1.2 (gateway KeycloakJwtGuard + envelope filter + throttle), 1.10 (identity-svc internal endpoints + X-Internal-Service-Token + pino redact paths), 2.7 (audit_log NATS consumer subscribes booking.*.v1), 3.10 (listing detail + ListingUnpublishedException 410 — réutilisé), 4.1 (booking-svc Pretre + Booking aggregate state machine + 5 VOs + 4 ports + IAvailabilityLockPort Redis baseline + version field + booking.conflict-detected.v1 schema reserved — Story 4.4 EXTEND), 4.3 (cart aggregate + ICartRepository + cart.delete — Story 4.4 CONSUME). Architecture lines 268-276 (saga distribuée), lines 291 (Cache Redis 3 layers race conditions), lines 630 (Cache locks 3 layers PRD FR48), lines 2120-2164 (Pretre canonical). PRD §FR48 (3 layers protection), §R5 (race conditions critique), §R11 (saga partial failure), §NFR46 (chaos tests CI obligatoires saga), §NFR42 (outbox relay), §NFR82 (audit), §NFR71 (coverage).

1. **API responses envelope ADR-014** — toutes responses gateway-api wrapped. 3 conflict codes `BOOKING-CONFLICT-001/002/003` envelope.

2. **ADR-001 Clean Architecture strict** — exceptions domain pure (no NestJS/TypeORM/I/O imports). Use case consumes ports (`IAvailabilityLockPort` Story 4.1, `IBookingRepository` Story 4.1, `ICartRepository` Story 4.3, `IListingSnapshotPort` Story 4.1, `IEventPublisher` Story 0.7). Lint boundaries enforced eslint-plugin-boundaries.

3. **ADR-003 DB per service strict** — booking + cart vivent dans `tukio_booking`. GIST constraint local to booking table.

4. **ADR-006 saga choreographed** — Story 4.4 `book-listing.usecase` produces `booking.requested.v1` (Story 4.1 baseline) consumed Story 4.2 order-svc + payment-svc (Story 4.2 livré). Story 4.4 produces `booking.conflict-detected.v1` consumed Story 2.7 audit + Story 4.13 monitoring.

5. **ADR-007 transactional outbox** — `OutboxPublisher` Story 0.7 wired. `booking.requested.v1` drained in same transaction as Booking save. `booking.conflict-detected.v1` published on conflict (outside booking transaction since booking failed) via direct OutboxPublisher call to its own outbox row (separate transaction).

6. **ADR-008 internal endpoint authentication** — gateway-api → booking-svc internal `POST /internal/bookings/checkout-session` avec `X-Internal-Service-Token` Story 1.10 pattern.

7. **NFR3 < 1s p95 booking submission happy path + < 500ms p95 409 conflict response** — Prometheus histogram `tukio_booking_submission_duration_seconds{outcome}` instrumented.

8. **NFR42 outbox relay** — Story 0.7 livré, Story 4.4 uses.

9. **NFR43 saga alert > 5 min stuck** — Story 4.13 finalise (Story 4.4 produces baseline `booking.conflict-detected.v1` consumed Story 4.13 future).

10. **NFR46 chaos tests CI obligatoires** — Story 4.4 livre 1 chaos suite (`availability-conflict.spec.ts` 2 scenarios). CI Story 0.11 fail-fast.

11. **NFR71 coverage thresholds** — ≥ 95 % domain (exceptions) + ≥ 90 % usecases (book-listing full impl) + ≥ 80 % infrastructure (migration testcontainer + repository UPDATE + booking.controller).

12. **NFR82 audit** — `booking.conflict-detected.v1` event consumed Story 2.7 audit_log automatically.

13. **R5 race conditions** — Story 4.4 finalise full 3-layer. Story 4.1 livré Layer 1 baseline. Story 4.4 ajoute Layer 2 GIST + Layer 3 optimistic lock + retry × 1 + 3 exceptions distinctes + chaos test 100-parallel.

14. **R11 saga partial failure** — Story 4.13 finalise full monitoring. Story 4.4 livre baseline metric ingestion (Prometheus histogram) + Grafana panel skeleton + Slack alert baseline `BookingHighConflictRate` (> 10 % conflict rate over 10min).

15. **EN strict + Clean Architecture + Envelope ADR-014 + latest stable + lint boundaries strict + i18n FR/EN frontend** memories — toutes respectées.

### Previous Story Intelligence

**Story 0.2 (`@tukio/contracts` events + DTOs)** : Story 4.4 finalise `booking.conflict-detected.v1` schema (Story 4.1 reserved). Pattern JSON Schema v7 + types auto-generated.

**Story 0.6 (Pretre baseline + boundaries lint)** : Story 4.4 réutilise lint boundaries enforcement.

**Story 0.7 (`@tukio/messaging` OutboxPublisher + InboxConsumer + CorrelationContext + NATS streams)** : Story 4.4 utilise OutboxPublisher pour producer `booking.conflict-detected.v1`. CorrelationContext propagé saga.

**Story 0.9 (`@tukio/testing` testcontainers + chaos helpers + axe-core)** : Story 4.4 ajoute `chaos/100-parallel-bookings.helper.ts` réutilisable.

**Story 0.10 (docker-compose dev local + bootstrap DBs)** : Story 4.4 verify Postgres 16 baseline supports `btree_gist` extension (standard core).

**Story 0.11 (CI coverage + chaos tests gate + Lighthouse)** : Story 4.4 ajoute chaos suite to CI fail-fast.

**Story 0.12 (Prometheus + Grafana baseline)** : Story 4.4 instruments `tukio_booking_submission_duration_seconds{outcome}` + nouveau Grafana panel.

**Story 1.2 (gateway KeycloakJwtGuard + envelope filter + throttle)** : Story 4.4 réutilise pattern `BookingsController` auth Customer + throttle 10/min + envelope.

**Story 1.10 (identity-svc internal endpoints + X-Internal-Service-Token + pino redact paths)** : Story 4.4 réutilise pattern internal endpoint authentication + pino redact baseline (no PII in logs).

**Story 2.7 (audit_log NATS consumer subscribes `booking.*.v1`)** : Story 4.4 produces `booking.conflict-detected.v1` automatically consumed Story 2.7 audit_log.

**Story 3.10 (listing detail public + `ListingUnpublishedException` 410)** : Story 4.4 réutilise exception when listing snapshot fetch fails — frontend Story 3.10 `<ListingUnavailableErrorPage>` 410 handler reusable.

**Story 4.1 (booking-svc Pretre + Booking aggregate state machine + IAvailabilityLockPort Redis baseline + version field + booking.conflict-detected.v1 schema reserved + book-listing.usecase skeleton + transactional outbox drain)** : Story 4.4 **EXTEND** :
- Réutilise `IAvailabilityLockPort.acquire/release` Story 4.1 baseline (Layer 1)
- Réutilise `IBookingRepository.save` Story 4.1 transactional outbox + UPDATE pour optimistic lock + GIST error mapping
- Réutilise `version: int` Booking field Story 4.1 baseline (Layer 3)
- Réutilise `booking.conflict-detected.v1` schema reserved Story 4.1 → Story 4.4 finalise full payload
- Réutilise `book-listing.usecase.ts` skeleton Story 4.1 → Story 4.4 finalise full impl
- Réutilise `IListingSnapshotPort.fetchSnapshot` Story 4.1 (anti-stale-cart)
- Réutilise `IEventPublisher` Story 4.1 wired OutboxPublisher Story 0.7
- ADD `payment_method_id` column + `refreshVersion` aggregate method UPDATE Story 4.1
- ADD GIST exclusion constraint (Story 4.1 line 436 deferred → Story 4.4)

**Story 4.2 (order-svc + payment-svc Pretre saga consumers)** : Story 4.4 produces `booking.requested.v1` Story 4.1 baseline consumed Story 4.2 (no direct interaction Story 4.4 ↔ Story 4.2 use cases — only via NATS).

**Story 4.3 (cart UI mono-vendor + Zustand store + booking-svc Cart aggregate EXTEND + `ICartRepository`)** : Story 4.4 **CONSUME** :
- `cartRepo.findById` Story 4.3
- `cartRepo.delete(cartId)` Story 4.3 post-success
- Cart invariants validated upstream Story 4.3 (mono-vendor, self-booking-forbidden) — Story 4.4 re-checks self-booking as defense in depth

### What this story does NOT do (out of scope)

- ❌ **Stripe Elements frontend checkout UI + PaymentIntent client_secret confirm flow** → Story 4.5 (Story 4.4 returns `paymentMethodId` placeholder for Story 4.5 frontend wire — Story 4.4 backend creates Booking + emits `booking.requested.v1` → Story 4.2 payment-svc creates PaymentIntent → Story 4.5 frontend confirms 3DS)
- ❌ **Pro accept/refuse workflow + Stripe capture trigger** → Story 4.7 (Story 4.4 creates Booking in `pending_pro_acceptance` — Story 4.7 transitions to `confirmed` via Stripe capture)
- ❌ **Pro `manual-block` full UI + use case impl** → Story 8.x V1 FR28 (Story 4.4 baseline placeholder only)
- ❌ **Customer cancellation flow + refund policy templates** → Story 4.8 (independent — Story 4.8 transitions confirmed/pending → cancelled)
- ❌ **Booking lifecycle subsequent transitions (accept/refuse/cancel/complete)** → Stories 4.7/4.8/4.10 (Story 4.4 only creates initial Booking in `pending_pro_acceptance`)
- ❌ **Saga monitoring R11 full Slack + Grafana saga-health + PagerDuty escalade** → Story 4.13 (Story 4.4 livre baseline metric ingestion + Grafana panel + Prometheus alert basic — Story 4.13 finalise full saga health dashboard)
- ❌ **Multi-vendor cart parallel saga V1** → Story 8.x V1 (Story 4.4 mono-vendor MVP — re-uses pattern per-vendor)
- ❌ **Quote pre-booking custom prices V1** → Story 12.x V1 (similar race condition pattern applicable to quote acceptance)
- ❌ **48h auto-expire cron full impl** → Story 4.7 (Story 4.1 livré skeleton + Story 4.4 doesn't touch)
- ❌ **Inventory pool partagé FR29 V1** → V1+ Epic 9+ (Story 4.4 1 listing 1 lock — no pool semantics)
- ❌ **GIST exclusion constraint extend to V1 multi-listing pool** → V1+ Epic 9+ stretch
- ❌ **TypeORM 2PC distributed transaction (booking + cart in same transaction)** → over-engineering MVP. Story 4.4 cart delete post-success best-effort with orphan cleanup cron V1+
- ❌ **Stripe PaymentIntent creation in `book-listing.usecase`** — NO. Booking creation emits `booking.requested.v1` Story 4.1 → Story 4.2 `create-payment-intent.usecase` consumes (saga choreographed ADR-006). Story 4.4 backend does NOT directly call Stripe API
- ❌ **Frontend booking submission UI changes** — Story 4.3 cart page checkout CTA → Story 4.5 will call `POST /v1/bookings/checkout-session` from `/fr/checkout` page. Story 4.4 just exposes the endpoint
- ❌ **`POST /v1/bookings` legacy alias** — Story 4.4 livre only `POST /v1/bookings/checkout-session` (canonical semantic)
- ❌ **Audit consumer NFR82** — Story 2.7 livré automatically ingests `booking.conflict-detected.v1` (Story 4.4 only verifies via integration test)

### Files to UPDATE vs CREATE

Cf. Project Structure cible — annoté `# NEW Story 4.4` vs `# UPDATE`.

**UPDATE files (read complete state before modifying)** :

1. **`apps/booking-svc/src/usecases/book-listing.usecase.ts`** Story 4.1 livré skeleton — **CRITICAL : lire l'état Story 4.1 skeleton complet pour préserver injection ports + signature + outbox event publish pattern + invocation via UseCaseProxy wired in usecases-proxy.module.ts Story 4.1**. Story 4.4 finalise full 7-step impl (cart fetch + listing snapshot + Layer 1 + Booking.create + Layer 2/3 save + cart delete + lock release).

2. **`apps/booking-svc/src/infrastructure/persistence/typeorm/repositories/booking.typeorm.repository.ts`** Story 4.1 livré transactional outbox drain — **CRITICAL : préserver outbox drain pattern + transactional QueryRunner + booking_status_transition rows cascade + mapper.toEntity**. Story 4.4 ajoute INSERT/UPDATE branching + `isPostgresExclusionViolation` helper + optimistic lock check.

3. **`apps/booking-svc/src/domain/model/booking.aggregate.ts`** Story 4.1 livré aggregate root — **CRITICAL : préserver factory + 6 transition methods Story 4.1 + state machine + uncommittedEvents collection + invariants existing**. Story 4.4 ajoute `refreshVersion(latest: Booking)` method + `paymentMethodId: string | null` field.

4. **`packages/contracts/src/events/booking/conflict-detected.v1.{schema.json,ts}`** Story 4.1 reserved baseline — Story 4.4 finalise full payload + JSON Schema v7 validation.

5. **`packages/contracts/src/dtos/booking/book-listing-request.dto.ts`** Story 4.1 livré DTO baseline — Story 4.4 finalise Zod schema with cartId + period + paymentMethodId optional.

6. **`packages/contracts/src/events/booking/index.ts`** — UPDATE barrel export `BookingConflictDetectedEventV1`.

7. **`apps/booking-svc/src/infrastructure/usecases-proxy/usecases-proxy.module.ts`** Story 4.1/4.3 livré — verify `book-listing.usecase` wired with new deps `ICartRepository` (added Story 4.3). Maybe no change needed if Story 4.3 already wired.

8. **`apps/booking-svc/.env.example`** — verify Postgres extension `btree_gist` doesn't require env var (standard core, no env).

9. **`docs/runbook/booking-saga-debug.md`** Story 4.1/4.2 livré — UPDATE add section "Race conditions debugging" (cross-reference new runbook Story 4.4).

10. **`docs/adr/0006-saga-choreographed.md`** — UPDATE Implementation Notes : Story 4.4 livre 3-layer complete.

11. **`docs/project-context.md`** — UPDATE section "Booking 3-Layer Race Conditions (Story 4.4)".

12. **`_bmad-output/implementation-artifacts/4-1-booking-svc-pretre-saga-state-machine.md`** — UPDATE Completion Notes List handoff Story 4.4 done.

13. **`_bmad-output/implementation-artifacts/4-3-cart-ui-mono-vendor-persistence-zustand.md`** — UPDATE Completion Notes List — Story 4.4 consumes cart.

14. **`infra/k8s/grafana-dashboards/booking-svc.json`** Story 4.1 baseline (if exists) — UPDATE add 4 new panels. OR NEW if Story 4.1 didn't ship dashboard.

15. **`infra/k8s/prometheus-rules/booking-svc.yaml`** Story 4.1 baseline (if exists) — UPDATE add `BookingHighConflictRate` rule. OR NEW.

**Lire l'état complet de chaque UPDATE file avant édition** — particularly :
- `book-listing.usecase.ts` Story 4.1 (preserve injection signature + outbox publish pattern)
- `booking.typeorm.repository.ts` Story 4.1 (preserve transactional outbox drain pattern)
- `booking.aggregate.ts` Story 4.1 (preserve 6 transitions + state machine + uncommittedEvents)

### Testing Standards

- **Coverage ≥ 95 % domain** (4 new exceptions + Booking aggregate `refreshVersion`)
- **Coverage ≥ 90 % usecases** (`book-listing.usecase` full impl + `manual-block-availability` skeleton)
- **Coverage ≥ 80 % infrastructure** (`booking.typeorm.repository.ts` UPDATE + migration testcontainer Postgres 16 + `booking.controller.ts` internal)
- **Tests unit Vitest** + **integration testcontainer Postgres + Redis + NATS** + **chaos 100-parallel must pass 10/10 runs**
- **Tests E2E Playwright gateway** 10 scenarios AC7
- **Lint boundaries strict 0 violations** domain + usecases pure
- **CI Story 0.11 fail-fast** : chaos test gate + coverage NFR71 + perf budget p95 < 1s happy + p95 < 500ms 409
- **Prometheus alert verify** : `BookingHighConflictRate` triggers correctly via synthetic load test

### Project Structure Notes

✅ **Aligné** : architecture.md (Pretre canonical lines 2120-2164, saga choreographed lines 268-276, Cache locks 3 layers lines 291 + 630, ADR-001 Clean Architecture + ADR-003 DB per service + ADR-006 saga choreographed + ADR-007 transactional outbox + ADR-008 internal endpoint + ADR-014 envelope), PRD §FR48 (3 layers protection), §R5 (race conditions critique R5), §R11 (saga partial failure), §NFR46 (chaos tests CI), §NFR82 (audit), §NFR71 (coverage), §NFR3 (< 1s checkout) ; Stories 0.2/0.6/0.7/0.9/0.10/0.11/0.12/1.2/1.10/2.7/3.10/4.1/4.3 ; memories Tukio (feedback_clean_architecture_explicit, feedback_api_envelope_response, feedback_tech_layer_english, feedback_latest_versions).

⚠️ **Déviations** : aucune significative. 3 distinct conflict codes (vs single 409) est une décision documentée Dev Notes (granular UX + analytics + monitoring). Cart delete post-success best-effort (vs 2PC) est documenté MVP decision (over-engineering avoided).

⚠️ **Décisions clés Story 4.4** :
- Layer 1 Redis baseline Story 4.1 réutilisé
- Layer 2 GIST `EXCLUDE USING GIST ... tstzrange WITH &&` filtered partial constraint
- Layer 3 optimistic lock retry × 1 max (epic spec)
- 3 distinct `BOOKING-CONFLICT-001/002/003` codes (granular)
- `booking.conflict-detected.v1` outbox event Story 4.1 reserved → Story 4.4 full producer
- `paymentMethodId` column ADD Booking aggregate (Story 4.5 wire)
- `POST /v1/bookings/checkout-session` (vs epic `POST /v1/bookings` — semantic clearer)
- Pro `manual-block` baseline placeholder (V1 finalise Story 8.x)
- Cart consume + delete post-success best-effort (vs 2PC over-engineering)
- Listing snapshot re-fetch anti-stale-cart
- Chaos test 100-parallel as deliverable + reusable helper `@tukio/testing`
- Logger structured pino + Prometheus metrics + Grafana panel baseline + Slack alert `BookingHighConflictRate`
- NO direct Stripe API call (saga choreographed via NATS events)
- NO frontend changes (Story 4.5 wires frontend)
- NFR82 audit via `booking.conflict-detected.v1` Story 2.7 auto-consume

### References

- [Source: epics.md#Epic-4-Story-4.4 — Lines 1645-1660]
- [Source: prd.md#FR48 (3 layers protection), #R5 (race conditions critique), #R11 (saga partial failure — Story 4.13 finalise), #NFR3 (< 1s p95 checkout happy path), #NFR46 (chaos tests CI obligatoires), #NFR71 (coverage thresholds), #NFR82 (audit immutable)]
- [Source: architecture.md — ADR-001 Clean Architecture, ADR-003 DB per service strict, ADR-006 saga choreographed, ADR-007 transactional outbox, ADR-008 internal endpoint authentication, ADR-014 envelope, Pretre canonical structure lines 2120-2164, Cache locks 3 layers lines 291 + 630, saga distribuée lines 268-276, event payload structure lines 1572-1612 (correlationId saga propagation)]
- [Source: Stories 0.2 (contracts events + DTOs), 0.6 (Pretre baseline + boundaries lint), 0.7 (@tukio/messaging OutboxPublisher + InboxConsumer + CorrelationContext + NATS streams), 0.9 (@tukio/testing testcontainers Postgres/Redis/NATS + chaos saga-partial-failure helper), 0.10 (docker-compose Postgres 16 + Redis Upstash dev local), 0.11 (CI coverage + chaos tests gate), 0.12 (Prometheus + Grafana baseline), 1.2 (gateway KeycloakJwtGuard + envelope filter + throttle), 1.10 (identity-svc internal endpoints + X-Internal-Service-Token + pino redact baseline), 2.7 (audit_log NATS consumer subscribes booking.*.v1 — Story 4.4 producer Story 2.7 auto-consume), 3.10 (listing detail public + ListingUnpublishedException 410 — Story 4.4 réutilise), 4.1 (booking-svc Pretre + Booking aggregate state machine + IAvailabilityLockPort Redis baseline + version field + booking.conflict-detected.v1 schema reserved + book-listing.usecase skeleton + transactional outbox drain — Story 4.4 EXTEND), 4.3 (cart aggregate + ICartRepository + cart.delete — Story 4.4 CONSUME)]
- [External: https://www.postgresql.org/docs/16/btree-gist.html — Postgres btree_gist extension]
- [External: https://www.postgresql.org/docs/16/rangetypes.html#RANGETYPES-EXCLUSION — Range types + exclusion constraint]
- [External: https://www.postgresql.org/docs/16/errcodes-appendix.html — Postgres SQLSTATE 23P01 exclusion_violation]
- [External: https://typeorm.io/transactions — TypeORM transactional QueryRunner pattern]
- [External: https://upstash.com/docs/redis/sdks/javascript-typescript/quickstart — Upstash Redis SET NX pattern (Story 4.1 baseline)]
- [External: https://docs.nestjs.com/security/rate-limiting — NestJS Throttler pattern (Story 1.2 baseline)]
- [Memory: user_ismael, project_tukio, feedback_clean_architecture_explicit, feedback_api_envelope_response, feedback_tech_layer_english, feedback_latest_versions]

## Dev Agent Record

### Agent Model Used

(à remplir par dev-story)

### Debug Log References

### Completion Notes List

(points d'attention pour :
- **Story 4.5** (Stripe PaymentIntent + Elements checkout frontend) : Story 4.4 returns `paymentMethodId` placeholder in response — Story 4.5 will populate via `<PaymentElement>` Stripe Elements confirm flow. Story 4.5 frontend calls `POST /v1/bookings/checkout-session` Story 4.4 livré → receives bookingId → confirms PaymentIntent via Story 4.2 `clientSecret` already created. Frontend flow : page `/fr/checkout` consume cart Story 4.3 + call Story 4.4 endpoint + confirm Stripe Elements + redirect `/fr/checkout/success?bookingId=...`
- **Story 4.6** (pro pending requests page UI) : independent of Story 4.4
- **Story 4.7** (pro accept/refuse + Stripe capture) : transitions Booking `pending_pro_acceptance → confirmed` via Story 4.1 aggregate methods + payment-svc capture Story 4.2 consume. Same optimistic lock pattern Story 4.4 reusable for accept/refuse race conditions (Pro in 2 tabs simultaneously)
- **Story 4.8** (customer cancellation flow + refund policy) : same optimistic lock pattern reusable
- **Story 4.11** (customer + pro bookings list/detail UI) : consume Story 4.1 use cases livré + Story 4.2 Order/PaymentIntent data
- **Story 4.13** (saga monitoring R11 alerts > 5 min Slack + Grafana saga-health full) : consume `booking.conflict-detected.v1` Story 4.4 produced + Grafana panel Story 4.4 baseline → finalise full dashboard + PagerDuty escalade + traces Tempo
- **Story 5.4** (notification-svc — consume booking.* events) : `booking.requested.v1` Story 4.1 produced consumed by Story 5.4 email Pro "Nouvelle demande" — Story 4.4 only triggers the producer
- **Story 8.x V1** (multi-vendor parallel saga) : Story 4.4 mono-vendor 3-layer pattern reusable per-vendor in multi-vendor cart. `@tukio/testing/chaos/100-parallel-bookings.helper.ts` Story 4.4 livré reusable for multi-vendor chaos
- **Story 12.x V1** (custom quote pre-booking + chat libre) : same race condition pattern applicable to quote acceptance race)

### File List

(à remplir par dev-story)

---

## Story Completion Status

- **Story Status** : `ready-for-dev`
- **Created** : 2026-05-15
- **Created by** : `bmad-create-story` workflow
- **Epic** : Epic 4 — Booking, Cart & Payment Saga (MVP) — **R5 critique : 3-layer race conditions complète**
- **Sprint cible** : Sprint 5 (4ᵉ story Epic 4 — bloque Story 4.5 Stripe Elements frontend + Story 4.7 Pro accept — doit être livrée avant frontend Stripe consume)
- **Estimation effort** : **5-7 jours** (1 dev backend senior — DB migration GIST + 4 exceptions + book-listing.usecase full impl + booking.typeorm.repository UPDATE + booking.aggregate.refreshVersion + booking.conflict-detected.v1 schema + gateway-api endpoint + 100-parallel chaos test + Grafana panels + Prometheus alert + 2 runbooks + ~32 fichiers)
- **Dépendances upstream** :
  - Stories 0.2 (contracts), 0.6 (Pretre + boundaries lint), 0.7 (@tukio/messaging OutboxPublisher + CorrelationContext + NATS streams), 0.9 (@tukio/testing testcontainers + chaos helpers), 0.10 (docker-compose Postgres 16 + Redis dev local), 0.11 (CI coverage + chaos tests gate), 0.12 (Prometheus + Grafana baseline)
  - Stories 1.2 (gateway KeycloakJwtGuard + envelope + throttle), 1.10 (identity-svc internal endpoints pattern + X-Internal-Service-Token + pino redact)
  - Stories 2.7 (audit_log consumer — auto-consume Story 4.4 producer), 3.10 (listing detail + ListingUnpublishedException 410 réutilisé)
  - **Story 4.1 (booking-svc Pretre + Booking aggregate state machine + IAvailabilityLockPort Redis baseline + version field + booking.conflict-detected.v1 schema reserved + book-listing.usecase skeleton + transactional outbox drain — Story 4.4 EXTEND)**
  - **Story 4.3 (cart aggregate + ICartRepository + cart.delete — Story 4.4 CONSUME)**
- **Dépendances downstream** (Epic 4 + cross-Epic) :
  - **Story 4.5 (Stripe PaymentIntent + Elements checkout frontend — consume Story 4.4 endpoint POST /v1/bookings/checkout-session + paymentMethodId Story 4.5 populate)**
  - Story 4.6 (pro pending requests page UI — independent)
  - Story 4.7 (pro accept/refuse + Stripe capture — reuses optimistic lock pattern Story 4.4 for accept/refuse race)
  - Story 4.8 (customer cancellation flow — reuses optimistic lock pattern)
  - Story 4.11 (customer + pro bookings list/detail UI — consume Booking aggregate use cases)
  - Story 4.13 (saga monitoring R11 alerts — consume booking.conflict-detected.v1 Story 4.4 produced)
  - Story 5.4 (notification-svc — consume booking.requested.v1 produced indirectly via Story 4.4 → Story 4.1 emit)
  - Story 8.x V1 (multi-vendor parallel saga — reuses 3-layer pattern per-vendor + chaos helper Story 4.4)
  - Story 12.x V1 (custom quote pre-booking — reuses race condition pattern)
- **FRs covered** :
  - **FR48** ✅ 3 layers protection (Redis lock Story 4.1 baseline + DB exclusion constraint NEW + optimistic locking finalise)
  - **FR28 baseline** ✅ Pro manual-block placeholder skeleton (Story 8.x V1 finalise full)
  - **FR47 partial** ✅ Booking lifecycle creation `pending_pro_acceptance` initial state (Story 4.1 aggregate baseline réutilisé)
- **NFRs touchés** :
  - **NFR3** ✅ Booking submission p95 < 1s happy path + 409 conflict response p95 < 500ms (Prometheus histogram + Lighthouse CI)
  - **NFR42** ✅ Outbox publish `booking.conflict-detected.v1` via Story 0.7 pattern
  - **NFR43 baseline** ✅ Grafana panel + Slack alert baseline `BookingHighConflictRate` (Story 4.13 finalise full saga-health)
  - **NFR46** ✅ 1 chaos suite (`availability-conflict.spec.ts` 2 scenarios) CI fail-fast Story 0.11
  - **NFR71** ✅ Coverage thresholds enforced (≥ 95 % domain + ≥ 90 % usecases + ≥ 80 % infrastructure)
  - **NFR82** ✅ Audit `booking.conflict-detected.v1` consumed Story 2.7 audit_log automatically

> **Prochaine story → Story 4.5** (Stripe PaymentIntent + Elements checkout frontend — consume Story 4.4 endpoint + Story 4.2 PaymentIntent flow + Story 4.3 cart Zustand state + `<PaymentElement>` Stripe.js + 3DS Secure + `/fr/checkout/success` confirmation page UX-DR figé bundle Cloud Design). Story 4.5 ferme le tunnel **Customer end-to-end MVP** (cart → checkout submission → Stripe Elements payment → success confirmation page). Stories 4.6/4.7/4.8/4.10/4.11/4.12/4.13 peuvent être livrées ensuite en parallèle.

---

**Dev agent next steps :**
1. Lire ce file complètement (~ 800 lignes)
2. Vérifier upstream Stories 0.2/0.6/0.7/0.9/0.10/0.11/0.12/1.2/1.10/2.7/3.10/4.1/4.3 implémentées (`sprint-status.yaml` — Story 4.1 + Story 4.3 doivent être `done` AVANT Story 4.4 dev)
3. **Lire l'état complet de chaque UPDATE file Story 4.1/4.3 avant édition** — particularly :
   - `book-listing.usecase.ts` Story 4.1 skeleton (preserve injection + signature + outbox pattern)
   - `booking.typeorm.repository.ts` Story 4.1 (preserve transactional outbox drain pattern)
   - `booking.aggregate.ts` Story 4.1 (preserve 6 transitions + state machine + uncommittedEvents)
4. Implémenter Tasks 1-12 dans l'ordre :
   - **Task 1 DB migration GIST + payment_method_id** (Phase 1, ~0.5 jour)
   - **Tasks 2-3 exceptions + repository UPDATE optimistic lock + GIST error mapping** (Phase 2, ~1 jour)
   - **Task 4 Booking.refreshVersion aggregate UPDATE** (Phase 3, ~0.5 jour)
   - **Task 5 book-listing.usecase FULL impl 7-step 3-layer** (Phase 4, ~1-1.5 jours)
   - **Task 6 booking.conflict-detected.v1 schema + producer wired** (Phase 5, ~0.5 jour)
   - **Task 7 gateway-api controller + forwarder + booking-svc internal controller + DTO Zod** (Phase 6, ~1 jour)
   - **Task 8 manual-block placeholder** (Phase 7, ~0.25 jour)
   - **Task 9 chaos test 100-parallel + reusable helper @tukio/testing** (Phase 8, ~1 jour)
   - **Task 10 logger + Prometheus metrics + Grafana panel + alert** (Phase 9, ~0.5 jour)
   - **Tasks 11-12 lint + docs + commit** (Phase 10, ~0.5 jour)
5. Lancer `pnpm --filter=booking-svc lint && pnpm --filter=booking-svc test --coverage` + chaos test 10/10 local runs après chaque jalon
6. Commit Story 4.4 quand :
   - 0 violations boundaries lint booking-svc/domain/exception + booking-svc/usecases
   - Coverage NFR71 thresholds (≥ 95 % domain + ≥ 90 % usecases + ≥ 80 % infrastructure)
   - 8 integration tests testcontainer Postgres 16 GIST + repository optimistic lock + outbox drain pass
   - 1 chaos test `availability-conflict.spec.ts` 2 scenarios pass 10/10 local runs
   - 10 E2E gateway tests pass (envelope shape + 409 each layer + auth + throttle + error mapping)
   - 1 integration test verify Story 2.7 audit_log auto-consume `booking.conflict-detected.v1`
   - Perf budgets p95 < 1s happy + p95 < 500ms 409 (Prometheus histogram + load test verify)
   - Grafana panel + Prometheus alert `BookingHighConflictRate` instrumented + tested
   - Handoff Stories 4.5/4.7/8.x V1 documented project-context + completion notes Stories 4.1 + 4.3 updated
   - PR ouvert vers `develop` (jamais main per git workflow Tukio memory)
