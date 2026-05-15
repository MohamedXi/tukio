# Story 4.2: order-svc + payment-svc Pretre implementations + saga consumers (FR47, FR49, FR53-54, FR56, FR63-65, R11, NFR42-46, NFR82)

Status: ready-for-dev

<!-- Validation optionnelle : voir checklist.md pour un quality-check avant `dev-story`. -->

## Story

**As a** backend developer Tukio (gardien Pattern Pretre + Clean Architecture + saga choréographée R11 critique + Story 4.1 livré booking-svc producer events `booking.*.v1` outbox stream),
**I want** **scaffolder order-svc Pretre (6ᵉ service)** + **étendre payment-svc Story 2.1 baseline** + **livrer les consumers NATS choréographés** qui transforment les events `booking.*.v1` en états Order + PaymentIntent + transitions Stripe (autorisation différée + capture + cancel + reservation refunds/transfers/payouts Stories 4.8/4.10/4.12), avec :

- (a) **Scaffolding `order-svc` Pretre** via `pnpm tsx infra/scripts/replicate-pretre-structure.sh --target=order-svc` (Story 0.6 livré) — 6ᵉ service Pretre après identity-svc (Story 0.6), gateway-api (Story 1.2), payment-svc (Story 2.1), catalog-svc (Story 3.1), booking-svc (Story 4.1) — port 4011 docker-compose + DB `tukio_order` séparée (ADR-003 strict).

- (b) **Domain `Order` aggregate root** (`apps/order-svc/src/domain/model/order.aggregate.ts`) — lifecycle 5 statuts driven par saga events :
```ts
export class Order {
  readonly id: OrderId;                          // UUID v7 sortable
  readonly bookingId: string;                     // FK logique cross-svc → booking-svc.booking.id
  readonly customerProfileId: string;             // FK logique identity-svc.user_profiles.id
  readonly proProfileId: string;                  // FK logique identity-svc.pro_profiles.id
  readonly listingSnapshot: ListingSnapshot;      // VO frozen at order creation (mirror booking)
  status: OrderStatus;                            // 'pending' | 'authorized' | 'paid' | 'invoiced' | 'cancelled'
  totals: OrderTotals;                            // VO { htAmount, vatAmount, ttcAmount, commission, stripeFees, netPro, currency='EUR' }
  vatTreatment: VatTreatment;                     // VO discriminated union 3 cas FR64 (Story 4.9 finalise full)
  paymentIntentId: string | null;                 // populated when payment-svc publishes payment.intent-authorized.v1
  invoices: InvoiceRef[];                         // [{ invoiceNumber, type:'customer'|'tukio_to_pro', r2Key, generatedAt }] — Story 4.9 finalise génération PDF
  correlationId: string;                          // saga correlation propagé depuis booking.requested.v1
  version: number;                                // optimistic lock
  uncommittedEvents: DomainEvent[];               // drained by repository post-save
  createdAt: Date; updatedAt: Date; deletedAt: Date | null;

  // Factory — créé sur consume booking.requested.v1
  static createFromBooking(input: {
    bookingId: string;
    customerProfileId: string;
    proProfileId: string;
    listingSnapshot: ListingSnapshot;
    totalAmountCents: number;
    correlationId: string;
  }): Order {
    if (input.totalAmountCents <= 0) throw new OrderValidationException({ field: 'totalAmountCents', code: 'must-be-positive' });
    const order = Object.assign(new Order(), {
      id: OrderId.generate(),
      ...input,
      status: OrderStatus.PENDING,
      totals: OrderTotals.fromHtAmount({ htAmountCents: input.totalAmountCents, currency: 'EUR' }), // VAT placeholder Story 4.2, full computation Story 4.9
      vatTreatment: VatTreatment.placeholder(),    // Story 4.9 finalise via VatCalculator
      paymentIntentId: null,
      invoices: [],
      version: 0,
      uncommittedEvents: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });
    order.appendEvent(new OrderCreatedEvent({ orderId: order.id.value, bookingId: input.bookingId, correlationId: input.correlationId, totals: order.totals, requestedAt: new Date() }));
    return order;
  }

  // Saga transitions — driven by consumed events
  authorize(paymentIntentId: string, actor: 'system'): void {
    this.ensureCanTransition(OrderStatus.PENDING, OrderStatus.AUTHORIZED);
    this.paymentIntentId = paymentIntentId;
    this.status = OrderStatus.AUTHORIZED;
    this.version++; this.touch();
    this.appendStatusChangedEvent({ from: 'pending', to: 'authorized', actor: 'system', reason: 'payment-intent-authorized' });
  }

  confirm(): void {
    // dual-input gate: booking.confirmed.v1 + payment.intent-captured.v1 must both be consumed
    this.ensureCanTransition(OrderStatus.AUTHORIZED, OrderStatus.PAID);
    this.status = OrderStatus.PAID;
    this.version++; this.touch();
    this.appendStatusChangedEvent({ from: 'authorized', to: 'paid', actor: 'system', reason: 'booking-confirmed-and-payment-captured' });
    this.appendEvent(new OrderConfirmedEvent({ orderId: this.id.value, bookingId: this.bookingId, correlationId: this.correlationId, totals: this.totals }));
  }

  markInvoiced(invoices: InvoiceRef[]): void {
    if (this.status !== OrderStatus.PAID) throw new InvalidTransitionException({ from: this.status, to: OrderStatus.INVOICED, orderId: this.id.value });
    if (invoices.length < 1) throw new OrderValidationException({ field: 'invoices', code: 'at-least-one-required' });
    this.invoices = invoices;
    this.status = OrderStatus.INVOICED;
    this.version++; this.touch();
    this.appendStatusChangedEvent({ from: 'paid', to: 'invoiced', actor: 'system', reason: 'invoices-generated' });
    this.appendEvent(new OrderInvoicesGeneratedEvent({ orderId: this.id.value, invoices, correlationId: this.correlationId }));
  }

  cancel(reason: { fromStatus: OrderStatus; cause: 'booking-refused' | 'booking-cancelled-pre-acceptance' | 'booking-cancelled-post-acceptance' | 'payment-failed' }): void {
    if (this.status === OrderStatus.CANCELLED) return; // idempotent
    if (this.status === OrderStatus.INVOICED) throw new OrderException('ORDER-CANNOT-CANCEL-INVOICED', 'Cannot cancel an invoiced order (use refund Story 4.12)');
    const from = this.status;
    this.status = OrderStatus.CANCELLED;
    this.version++; this.touch();
    this.appendStatusChangedEvent({ from, to: 'cancelled', actor: 'system', reason: reason.cause });
    this.appendEvent(new OrderCancelledEvent({ orderId: this.id.value, bookingId: this.bookingId, cancelledFromStatus: from, cause: reason.cause, correlationId: this.correlationId }));
  }

  private ensureCanTransition(from: OrderStatus, to: OrderStatus): void {
    if (this.status !== from) throw new InvalidTransitionException({ from: this.status, to, orderId: this.id.value });
  }
  private touch(): void { this.updatedAt = new Date(); }
  private appendEvent(e: DomainEvent): void { this.uncommittedEvents.push(e); }
  private appendStatusChangedEvent(input: { from: OrderStatus; to: OrderStatus; actor: 'system'; reason: string }): void {
    this.appendEvent(new OrderStatusChangedEvent({ orderId: this.id.value, ...input, at: new Date(), correlationId: this.correlationId }));
  }
}
```

- (c) **5 value-objects order-svc** (`apps/order-svc/src/domain/model/value-objects/`) — pure TS, lint boundaries strict :
  - **`order-id.vo.ts`** : `OrderId` UUID v7 (factory `OrderId.generate()`, `uuid` v11+ `v7()`). Tests ≥ 95 %.
  - **`order-status.vo.ts`** : const enum `'pending' | 'authorized' | 'paid' | 'invoiced' | 'cancelled'` + helpers `isTerminal`, `isMutable`, `parse(value: unknown): OrderStatus`. Tests : 6 cases.
  - **`order-totals.vo.ts`** : `OrderTotals` immutable VO `{ htAmountCents, vatAmountCents, ttcAmountCents, commissionCents, stripeFeesCents, netProCents, currency: 'EUR' }`. Factory `OrderTotals.fromHtAmount({ htAmountCents, currency })` — Story 4.2 baseline (VAT=0 placeholder, commission = 15 % htAmount, stripeFees = 0 placeholder). Invariants : tous montants entiers ≥ 0, currency=`EUR` MVP, `ttc = ht + vat`, `netPro = ht - commission - stripeFees`. Méthodes : `withVat(vatCents: number)`, `withCommission(rate: number)`, `withStripeFees(feesCents: number)`, `toJSON()`. Tests ≥ 95 % : 15 cases (factory happy + each invariant violation + computation + JSON round-trip).
  - **`vat-treatment.vo.ts`** : `VatTreatment` discriminated union (3 cas FR64 + 1 placeholder MVP) :
    ```ts
    export type VatTreatment =
      | { kind: 'placeholder'; computedAt: null }                                                 // MVP Story 4.2 — Story 4.9 finalise
      | { kind: 'exempted'; legalMention: string; computedAt: Date }                              // Cas A : Pro auto-entrepreneur — TVA non applicable art. 293 B
      | { kind: 'b2c_fr_standard'; rate: number; vatAmountCents: number; computedAt: Date }       // Cas B : Pro assujetti + Customer B2C FR — TVA 20 %
      | { kind: 'b2b_intra_eu_reverse_charge'; legalMention: string; customerVatNumber: string; computedAt: Date }; // Cas C : V1 B2B
    ```
    Story 4.2 livre uniquement `'placeholder'` (Story 4.9 finalise les 3 cas + factory `VatTreatment.compute({ pro, customer, amount, country })`). Tests : 4 cases (each kind + invalid throw).
  - **`currency-amount.vo.ts`** : `CurrencyAmount` immutable VO `{ amountCents: number, currency: 'EUR' }` + arithmétique `add/subtract/multiply/divide` (préserve currency) + `toJSON()`. Invariants : amountCents entier, currency='EUR' MVP. Tests ≥ 95 % : 10 cases.
  - **`invoice-ref.vo.ts`** : `InvoiceRef` `{ invoiceNumber: string, type: 'customer' | 'tukio_to_pro', r2Key: string, generatedAt: Date }` — Story 4.2 baseline (Story 4.9 livre full PDF generation). Tests : 4 cases.

- (d) **5 ports order-svc** (`apps/order-svc/src/domain/ports/`) — interfaces only :
  - **`order-repository.port.ts`** (`IOrderRepository`) :
    ```ts
    export interface IOrderRepository {
      findById(id: string): Promise<Order | null>;
      findByBookingId(bookingId: string): Promise<Order | null>;                                   // saga uniqueness — 1 order per booking
      findByCustomerProfileId(input: { customerProfileId: string; status?: OrderStatus[]; cursor?: string; limit?: number }): Promise<{ items: Order[]; nextCursor: string | null }>;
      findByProProfileId(input: { proProfileId: string; status?: OrderStatus[]; cursor?: string; limit?: number }): Promise<{ items: Order[]; nextCursor: string | null }>;
      save(order: Order): Promise<void>;                                                            // transactional + drain uncommittedEvents to outbox (ADR-007)
    }
    ```
  - **`invoice-repository.port.ts`** (`IInvoiceRepository`) — Story 4.2 baseline (CRUD `Invoice` entity), Story 4.9 finalise PDF generation + R2 upload :
    ```ts
    export interface IInvoiceRepository {
      findByOrderId(orderId: string): Promise<Invoice[]>;
      save(invoice: Invoice): Promise<void>;
    }
    ```
  - **`vat-calculator.port.ts`** (`IVatCalculator`) — Story 4.2 livre port + skeleton impl (returns `placeholder`), Story 4.9 finalise full 3 cas FR64 :
    ```ts
    export interface IVatCalculator {
      compute(input: { proProfileId: string; customerProfileId: string; htAmountCents: number; eventCountry: string }): Promise<VatTreatment>;
    }
    ```
  - **`pdf-generator.port.ts`** (`IPdfGenerator`) — Story 4.2 livre port + skeleton impl (returns `r2Key: 'placeholder://pending-story-4.9'`), Story 4.9 finalise full `@react-pdf/renderer` :
    ```ts
    export interface IPdfGenerator {
      generateInvoicePdf(input: { order: Order; type: 'customer' | 'tukio_to_pro' }): Promise<{ r2Key: string; pageCount: number }>;
    }
    ```
  - **`event-publisher.port.ts`** (`IEventPublisher`) — Story 0.7 `OutboxPublisher` wired :
    ```ts
    export interface IEventPublisher { publish(event: DomainEvent, transaction?: TransactionContext): Promise<void>; }
    ```

- (e) **4 exceptions order-svc** (`apps/order-svc/src/domain/exception/`) — toEnvelope() ADR-014 :
  - `order.exception.ts` (`OrderException` base — `code`, `message`, `details`, `toEnvelope()`)
  - `order-not-found.exception.ts` (`ORDER-NOT-FOUND-001` → 404)
  - `order-validation.exception.ts` (`ORDER-VALIDATION-002` → 422)
  - `invalid-transition.exception.ts` (`ORDER-INVALID-TRANSITION-003` → 409)

- (f) **4 use cases order-svc** (`apps/order-svc/src/usecases/`) — Story 4.2 livre 3 full + 1 skeleton :
  | Use case | Scope Story 4.2 | Trigger |
  |----------|-----------------|---------|
  | `create-order-from-booking.usecase.ts` | **Full** : consumer `booking.requested.v1` — dedup via inbox, `Order.createFromBooking(...)`, `orderRepository.save()` outbox `order.created.v1` | NATS subject `booking.requested.v1` |
  | `confirm-order.usecase.ts` | **Full** : dual-gate consumer — wait BOTH `booking.confirmed.v1` AND `payment.intent-captured.v1` for same `correlationId`. Inbox tracks both arrivals (`saga_dual_gate` row), when both present → `Order.confirm()` + `Order.markInvoiced(skeleton)` + outbox `order.confirmed.v1` + `order.invoices-generated.v1` (Story 4.9 finalise full PDF + TVA) | NATS subjects `booking.confirmed.v1` + `payment.intent-captured.v1` |
  | `cancel-order.usecase.ts` | **Full** : consumer `booking.refused.v1` + `booking.cancelled.v1` + `payment.intent-failed.v1` — `Order.cancel({ cause })` + outbox `order.cancelled.v1` | NATS subjects `booking.refused.v1`, `booking.cancelled.v1`, `payment.intent-failed.v1` |
  | `generate-invoices.usecase.ts` | **Skeleton** Story 4.2 : invoked by `confirm-order` post-`PAID` transition, returns 2 placeholder `InvoiceRef` (`'placeholder://customer-invoice', 'placeholder://tukio-to-pro'`) via `pdfGenerator.generateInvoicePdf` skeleton impl + `vatCalculator.compute` returns `placeholder`. **Story 4.9 finalise** full TVA 3 cas + `@react-pdf/renderer` + R2 upload + mandat 289 CGI header | Invoked from `confirm-order.usecase` |

- (g) **payment-svc EXTENSION** (`apps/payment-svc/` — déjà scaffolded Story 2.1 minimal MVP avec StripeConnectAccount). Story 4.2 ÉTEND :
  - **Nouveau domain model** `apps/payment-svc/src/domain/model/` :
    - `payment-intent.aggregate.ts` — aggregate root :
      ```ts
      export class PaymentIntent {
        readonly id: PaymentIntentId;                                // UUID v7 LOCAL — différent de stripePaymentIntentId
        readonly bookingId: string;                                   // FK logique
        readonly orderId: string | null;                              // FK logique — populated when order.created.v1 received (or null si race)
        readonly customerProfileId: string;
        readonly proProfileId: string;
        readonly stripeAccountId: string;                             // Pro Connect account ID (cross-svc identity-svc.pro_profiles.stripe_account_id Story 2.1)
        readonly amount: CurrencyAmount;                              // total ttc cents EUR
        readonly applicationFeeAmount: CurrencyAmount;                // Tukio commission cents (15 % HT MVP — computed by CommissionCalculator)
        readonly capturePolicy: CapturePolicy;                        // VO depuis @tukio/contracts shared OR replicated — MVP 'manual_at_pro_accept'
        stripePaymentIntentId: string | null;                         // Stripe pi_xxx — populated after stripe.paymentIntents.create
        stripeClientSecret: string | null;                            // never logged — Story 4.5 frontend Elements
        status: PaymentStatus;                                        // 'requires_payment_method' | 'requires_action' | 'requires_capture' | 'processing' | 'succeeded' | 'canceled' | 'failed'
        lastStripeError: StripeErrorPayload | null;                   // serialized last Stripe error (no PAN/CVV)
        capturedAt: Date | null; cancelledAt: Date | null; failedAt: Date | null;
        correlationId: string;
        version: number;
        uncommittedEvents: DomainEvent[];
        createdAt: Date; updatedAt: Date;

        // Factory — créé sur consume booking.requested.v1
        static createFromBooking(input: {
          bookingId: string;
          customerProfileId: string;
          proProfileId: string;
          stripeAccountId: string;
          totalAmountCents: number;
          correlationId: string;
        }): PaymentIntent {
          if (input.totalAmountCents <= 0) throw new PaymentValidationException({ field: 'totalAmountCents', code: 'must-be-positive' });
          const commission = CommissionCalculator.compute({ htAmountCents: input.totalAmountCents });
          const pi = Object.assign(new PaymentIntent(), {
            id: PaymentIntentId.generate(),
            ...input,
            amount: new CurrencyAmount(input.totalAmountCents, 'EUR'),
            applicationFeeAmount: new CurrencyAmount(commission, 'EUR'),
            capturePolicy: { kind: 'manual_at_pro_accept' },
            stripePaymentIntentId: null,
            stripeClientSecret: null,
            status: PaymentStatus.REQUIRES_PAYMENT_METHOD,
            lastStripeError: null,
            capturedAt: null, cancelledAt: null, failedAt: null,
            version: 0, uncommittedEvents: [], createdAt: new Date(), updatedAt: new Date(),
          });
          pi.appendEvent(new PaymentIntentCreatedEvent({ paymentIntentId: pi.id.value, bookingId: input.bookingId, amount: pi.amount, correlationId: input.correlationId }));
          return pi;
        }

        // Saga transitions
        attachStripeIntent(stripePaymentIntentId: string, stripeClientSecret: string, status: PaymentStatus): void {
          if (this.stripePaymentIntentId) throw new PaymentValidationException({ field: 'stripePaymentIntentId', code: 'already-attached' });
          this.stripePaymentIntentId = stripePaymentIntentId;
          this.stripeClientSecret = stripeClientSecret;
          this.status = status;
          this.version++; this.touch();
          this.appendEvent(new PaymentIntentAuthorizedEvent({ paymentIntentId: this.id.value, stripePaymentIntentId, status, correlationId: this.correlationId }));
        }

        markRequiresCapture(): void {
          if (this.status !== PaymentStatus.REQUIRES_PAYMENT_METHOD && this.status !== PaymentStatus.REQUIRES_ACTION) {
            throw new InvalidPaymentTransitionException({ from: this.status, to: PaymentStatus.REQUIRES_CAPTURE, paymentIntentId: this.id.value });
          }
          this.status = PaymentStatus.REQUIRES_CAPTURE;
          this.version++; this.touch();
          this.appendEvent(new PaymentIntentAuthorizedEvent({ paymentIntentId: this.id.value, stripePaymentIntentId: this.stripePaymentIntentId!, status: this.status, correlationId: this.correlationId }));
        }

        markCaptured(capturedAmount: CurrencyAmount): void {
          if (this.status !== PaymentStatus.REQUIRES_CAPTURE && this.status !== PaymentStatus.PROCESSING) {
            throw new InvalidPaymentTransitionException({ from: this.status, to: PaymentStatus.SUCCEEDED, paymentIntentId: this.id.value });
          }
          this.status = PaymentStatus.SUCCEEDED;
          this.capturedAt = new Date();
          this.version++; this.touch();
          this.appendEvent(new PaymentIntentCapturedEvent({ paymentIntentId: this.id.value, stripePaymentIntentId: this.stripePaymentIntentId!, capturedAmount, correlationId: this.correlationId }));
        }

        markCancelled(reason: 'booking-refused' | 'booking-cancelled-pre-acceptance' | 'customer-3ds-failed' | 'admin-cancel'): void {
          if (this.status === PaymentStatus.SUCCEEDED) throw new PaymentException('PAYMENT-CANNOT-CANCEL-CAPTURED', 'Use refund Story 4.12 — cannot cancel after capture');
          this.status = PaymentStatus.CANCELED;
          this.cancelledAt = new Date();
          this.version++; this.touch();
          this.appendEvent(new PaymentIntentCancelledEvent({ paymentIntentId: this.id.value, stripePaymentIntentId: this.stripePaymentIntentId, reason, correlationId: this.correlationId }));
        }

        markFailed(stripeError: StripeErrorPayload): void {
          this.status = PaymentStatus.FAILED;
          this.failedAt = new Date();
          this.lastStripeError = stripeError; // already PII-stripped by infra layer
          this.version++; this.touch();
          this.appendEvent(new PaymentIntentFailedEvent({ paymentIntentId: this.id.value, stripePaymentIntentId: this.stripePaymentIntentId, errorCode: stripeError.code, errorMessage: stripeError.message, correlationId: this.correlationId }));
        }

        private touch(): void { this.updatedAt = new Date(); }
        private appendEvent(e: DomainEvent): void { this.uncommittedEvents.push(e); }
      }
      ```
    - `refund.entity.ts` — entity (placeholder Story 4.2, Story 4.12 finalise admin flow) : `{ id, paymentIntentId, stripeRefundId, amountCents, reason, status, createdAt }`
    - `transfer.entity.ts` — entity (placeholder Story 4.2, Story 4.10 finalise cron J+1) : `{ id, paymentIntentId, stripeTransferId, destinationStripeAccountId, amountCents, status, createdAt }`
    - `payout.entity.ts` — entity (placeholder Story 4.2, Story 4.10 finalise) : `{ id, transferId, stripePayoutId, arrivalDate, status, createdAt }`
  - **Nouveaux value-objects payment-svc** :
    - `payment-intent-id.vo.ts` : UUID v7 local — distinct from Stripe `pi_xxx`
    - `payment-status.vo.ts` : enum + helpers (`isTerminal`, `isCapturable`, `parse`)
    - `capture-policy.vo.ts` : **réutiliser** `@tukio/contracts/types/capture-policy.ts` shared (Story 4.1 livre — vérifier export depuis booking-svc OR ré-exporter depuis `@tukio/contracts`)
    - `stripe-error-payload.vo.ts` : `{ code: string, message: string, declineCode?: string, type: string }` — PII-stripped at infra boundary (NO PAN/CVV/clientSecret)
  - **Nouveaux ports payment-svc** :
    - **`payment-intent-repository.port.ts`** (`IPaymentIntentRepository`) :
      ```ts
      export interface IPaymentIntentRepository {
        findById(id: string): Promise<PaymentIntent | null>;
        findByBookingId(bookingId: string): Promise<PaymentIntent | null>;
        findByStripePaymentIntentId(stripePiId: string): Promise<PaymentIntent | null>;
        save(intent: PaymentIntent): Promise<void>;                                                // transactional + drain to outbox
      }
      ```
    - **`stripe-payment-gateway.port.ts`** (`IStripePaymentGateway`) — NEW, distinct from `IStripeConnect` Story 2.1 (qui gère Account onboarding) :
      ```ts
      export interface IStripePaymentGateway {
        createPaymentIntent(input: {
          amountCents: number;
          currency: 'EUR';
          applicationFeeAmountCents: number;
          transferDestinationAccountId: string;
          captureMethod: 'manual';
          metadata: { bookingId: string; orderId: string | null; customerProfileId: string; proProfileId: string; correlationId: string };
          idempotencyKey: string;
        }): Promise<{ stripePaymentIntentId: string; clientSecret: string; status: string }>;
        capturePaymentIntent(stripePaymentIntentId: string, idempotencyKey: string): Promise<{ status: string; capturedAmountCents: number }>;
        cancelPaymentIntent(stripePaymentIntentId: string, cancellationReason: 'requested_by_customer' | 'duplicate' | 'fraudulent' | 'abandoned', idempotencyKey: string): Promise<{ status: string }>;
        createRefund(input: { stripePaymentIntentId: string; amountCents: number; reason: 'requested_by_customer' | 'duplicate' | 'fraudulent'; idempotencyKey: string }): Promise<{ stripeRefundId: string; status: string }>;     // Story 4.12
        createTransfer(input: { amountCents: number; currency: 'EUR'; destinationAccountId: string; sourceTransactionChargeId: string; transferGroup: string; idempotencyKey: string }): Promise<{ stripeTransferId: string; status: string }>;  // Story 4.10
      }
      ```
    - **`order-svc-events-inbox.port.ts`** (`IOrderSvcEventsInbox`) — Story 4.2 baseline using Story 0.7 `InboxConsumer` pattern :
      ```ts
      export interface IOrderSvcEventsInbox {
        hasProcessed(eventId: string): Promise<boolean>;
        markProcessed(eventId: string, payload: unknown): Promise<void>;
      }
      ```
      (Pattern identique pour `booking-svc-events-inbox` + `payment-svc-events-inbox` — chacun a son inbox table dédiée.)

- (h) **`CommissionCalculator` domain service** (`apps/payment-svc/src/domain/service/commission-calculator.service.ts`) — pure logic Story 4.2 MVP fixed 15 % :
  ```ts
  export class CommissionCalculator {
    private static readonly MVP_COMMISSION_RATE = 0.15;                                            // FR65 MVP fixed 15 % HT — Story 9.x V1 livre 3 tiers (Starter 15 % / Business 10 % / Enterprise 5 %)
    static compute(input: { htAmountCents: number; proTier?: 'starter' | 'business' | 'enterprise' /* V1 */ }): number {
      if (input.htAmountCents <= 0) throw new Error('htAmountCents must be positive');
      // V1 stretch: branch on proTier — Story 9.x finalise
      return Math.round(input.htAmountCents * CommissionCalculator.MVP_COMMISSION_RATE);
    }
  }
  ```
  Tests ≥ 95 % : 8 cases (happy, rounding banker, htAmount=0 throw, htAmount<0 throw, large amount, small amount, currency invariant, V1 tier branch placeholder).

- (i) **6 use cases payment-svc** (`apps/payment-svc/src/usecases/`) — Story 4.2 livre 4 full + 2 skeletons :
  | Use case | Scope Story 4.2 | Trigger |
  |----------|-----------------|---------|
  | `create-payment-intent.usecase.ts` | **Full** : consumer `booking.requested.v1` — dedup via inbox, fetch `pro.stripeAccountId` cross-svc identity-svc (HTTP — pattern Story 2.1 `IdentitySvcClient`), `PaymentIntent.createFromBooking(...)`, `stripeGateway.createPaymentIntent(...)` (capture_method='manual', application_fee_amount, transfer_data.destination), `pi.attachStripeIntent(...)`, `repository.save()` outbox `payment.intent-created.v1` | NATS subject `booking.requested.v1` |
  | `capture-payment.usecase.ts` | **Full** : consumer `booking.confirmed.v1` — dedup, `repository.findByBookingId`, guard `pi.status === REQUIRES_CAPTURE`, `stripeGateway.capturePaymentIntent(stripePiId, idempotencyKey=correlationId+'-capture')`, `pi.markCaptured(...)`, `repository.save()` outbox `payment.intent-captured.v1`. **Latency NFR6 p95 < 800 ms** | NATS subject `booking.confirmed.v1` |
  | `cancel-payment.usecase.ts` | **Full** : consumer `booking.refused.v1` + `booking.cancelled.v1` (selon `cancelledFromStatus`) — dedup, `repository.findByBookingId`, branch logic : (a) `status ∈ {REQUIRES_PAYMENT_METHOD, REQUIRES_ACTION, REQUIRES_CAPTURE}` → `stripeGateway.cancelPaymentIntent(...)` + `pi.markCancelled(...)` outbox `payment.intent-cancelled.v1`. (b) `status === SUCCEEDED` (déjà capturé — cas `booking.cancelled` post-acceptance) → **DEFER to Story 4.8/4.12** (refund flow) : `cancel-payment` ne fait rien, log warning + emit `saga.alert.v1` (R11 watchdog will catch) | NATS subjects `booking.refused.v1`, `booking.cancelled.v1` |
  | `process-stripe-webhook.usecase.ts` | **EXTEND Story 2.1** : Story 2.1 traite `account.*` events Connect onboarding. Story 4.2 ajoute routing pour PaymentIntent webhooks : `payment_intent.requires_capture` (→ `pi.markRequiresCapture()`), `payment_intent.canceled` (→ `pi.markCancelled('customer-3ds-failed')`), `payment_intent.succeeded` (idempotent log seul — capture initiated by `capture-payment.usecase`), `payment_intent.payment_failed` (→ `pi.markFailed(stripeError)`), `charge.refunded` (Story 4.12 stretch — log only), `transfer.created` + `payout.paid` (Story 4.10 stretch — log only). Dedup via `stripe_events_inbox` table Story 2.1 réutilisée | Stripe webhook HTTP endpoint `/v1/webhooks/stripe` (gateway-api forwards) |
  | `refund-payment.usecase.ts` | **Skeleton** Story 4.2 : signature + `stripeGateway.createRefund` skeleton + `Refund.create()` + outbox `payment.refund-issued.v1`. **Story 4.12 finalise** full admin flow (RBAC `admin-modo+`, partial refunds, reason enum, reconciliation) | Admin HTTP endpoint Story 4.12 |
  | `transfer-to-pro.usecase.ts` | **Skeleton** Story 4.2 : signature + `stripeGateway.createTransfer` skeleton + `Transfer.create()` + outbox `payment.transfer-created.v1`. **Story 4.10 finalise** full cron J+1 + `payout.paid` webhook handling + auto-payout policy | Cron `@Cron('0 2 * * *')` Story 4.10 |

- (j) **NATS consumers wired** via Story 0.7 `@tukio/messaging` `InboxConsumer<Event>` pattern :
  - **order-svc** consumers (`apps/order-svc/src/infrastructure/messaging/nats/`) :
    - `booking-events.consumer.ts` — durable consumer `order-svc-booking-events` sur stream `BOOKING`, subjects `booking.requested.v1`, `booking.confirmed.v1`, `booking.cancelled.v1`, `booking.refused.v1`
    - `payment-events.consumer.ts` — durable consumer `order-svc-payment-events` sur stream `PAYMENT`, subjects `payment.intent-captured.v1`, `payment.intent-failed.v1`
  - **payment-svc** consumers (`apps/payment-svc/src/infrastructure/messaging/nats/`) :
    - `booking-events.consumer.ts` — durable consumer `payment-svc-booking-events` sur stream `BOOKING`, subjects `booking.requested.v1`, `booking.confirmed.v1`, `booking.cancelled.v1`, `booking.refused.v1`
  - **Dedup obligatoire** : chaque consumer démarre par `inbox.hasProcessed(eventId)` (Story 0.7 `InboxConsumer<T>` wrapper le fait — utiliser le wrapper, ne pas re-coder).
  - **NATS JetStream durable + max_deliver=5 + ack_wait=30s + backoff exponential** (Story 0.7 livré config). DLQ subject `dlq.<svc>.<event-type>` au-delà de 5 tentatives (alerte Slack — Story 4.13 finalise — Story 4.2 livre baseline DLQ creation).

- (k) **`saga-watchdog.task.ts` cron** (`apps/order-svc/src/infrastructure/scheduling/saga-watchdog.task.ts`) — **Story 4.2 livre skeleton + DB query baseline**, Story 4.13 finalise full Prometheus dashboard + Slack alerts :
  ```ts
  @Injectable()
  export class SagaWatchdogTask {
    @Cron('*/1 * * * *')                                                                            // every 1 min — NFR43 alerte > 5 min
    async detectStuckSagas(): Promise<void> {
      // Story 4.2 baseline: detect orders stuck in AUTHORIZED > 5 min (= booking.confirmed.v1 reçu sans payment.intent-captured.v1)
      // OR pending > 10 min (= no payment.intent-authorized.v1 received post booking.requested.v1)
      const stuckOrders = await this.orderRepository.findStuckSagas({ authorizedOlderThan: 5 * 60_000, pendingOlderThan: 10 * 60_000 });
      for (const order of stuckOrders) {
        await this.eventPublisher.publish(new SagaAlertEvent({ orderId: order.id.value, bookingId: order.bookingId, status: order.status, stuckSinceMs: Date.now() - order.updatedAt.getTime(), correlationId: order.correlationId }));
      }
    }
  }
  ```
  + UPDATE `IOrderRepository.findStuckSagas(input)` method added. Story 4.13 ajoutera Grafana dashboard saga-health + PagerDuty escalade.

- (l) **DB migrations** :
  - **order-svc** NEW `tukio_order` DB :
    - `1715700000000-CreateOrderTables.ts` — tables `order` + `order_status_transition` + `invoice` + check constraints + indexes partials
    - `1715700000001-CreateOutboxInbox.ts` — Story 0.7 template (outbox + inbox + saga_dual_gate)
    ```sql
    -- 1715700000000-CreateOrderTables.ts (extrait)
    CREATE TABLE order_ (                                                                            -- 'order' reserved keyword → use 'order_' or "order" quoted
      id UUID PRIMARY KEY,
      booking_id UUID NOT NULL UNIQUE,                                                               -- 1 order per booking saga uniqueness
      customer_profile_id UUID NOT NULL,
      pro_profile_id UUID NOT NULL,
      listing_snapshot JSONB NOT NULL,
      status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'authorized', 'paid', 'invoiced', 'cancelled')),
      totals JSONB NOT NULL,                                                                         -- OrderTotals VO
      vat_treatment JSONB NOT NULL,                                                                  -- VatTreatment VO discriminated union
      payment_intent_id UUID NULL,                                                                   -- FK logique cross-svc payment-svc
      invoices JSONB NOT NULL DEFAULT '[]'::jsonb,                                                   -- InvoiceRef[]
      correlation_id UUID NOT NULL,
      version INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ NULL
    );
    CREATE INDEX idx_order_customer_status ON order_ (customer_profile_id, status) WHERE deleted_at IS NULL;
    CREATE INDEX idx_order_pro_status ON order_ (pro_profile_id, status) WHERE deleted_at IS NULL;
    CREATE INDEX idx_order_correlation_id ON order_ (correlation_id);                                -- saga R11 reconstruction
    CREATE INDEX idx_order_stuck_saga ON order_ (status, updated_at) WHERE status IN ('pending', 'authorized') AND deleted_at IS NULL;  -- saga-watchdog cron
    CREATE TRIGGER order_updated_at BEFORE UPDATE ON order_ FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

    CREATE TABLE order_status_transition (
      id UUID PRIMARY KEY,
      order_id UUID NOT NULL REFERENCES order_(id) ON DELETE CASCADE,
      from_status VARCHAR(20) NOT NULL,
      to_status VARCHAR(20) NOT NULL,
      reason TEXT NULL,
      at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX idx_order_status_transition_order_at ON order_status_transition (order_id, at DESC);

    CREATE TABLE invoice (
      id UUID PRIMARY KEY,
      order_id UUID NOT NULL REFERENCES order_(id) ON DELETE RESTRICT,                                -- LCEN 10y retention — no cascade delete
      invoice_number VARCHAR(50) NOT NULL UNIQUE,
      type VARCHAR(20) NOT NULL CHECK (type IN ('customer', 'tukio_to_pro')),
      r2_key TEXT NOT NULL,
      ht_amount_cents BIGINT NOT NULL CHECK (ht_amount_cents >= 0),
      vat_amount_cents BIGINT NOT NULL DEFAULT 0 CHECK (vat_amount_cents >= 0),
      ttc_amount_cents BIGINT NOT NULL CHECK (ttc_amount_cents >= 0),
      currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
      vat_treatment JSONB NOT NULL,
      generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX idx_invoice_order ON invoice (order_id);
    CREATE INDEX idx_invoice_generated_at ON invoice (generated_at);                                  -- 10y retention queries

    -- saga_dual_gate (order-svc only — track dual-event confirm-order gate)
    CREATE TABLE saga_dual_gate (
      correlation_id UUID PRIMARY KEY,
      booking_id UUID NOT NULL,
      booking_confirmed_received_at TIMESTAMPTZ NULL,
      payment_captured_received_at TIMESTAMPTZ NULL,
      both_complete_at TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX idx_saga_dual_gate_incomplete ON saga_dual_gate (created_at) WHERE both_complete_at IS NULL;  -- saga-watchdog
    ```
  - **payment-svc** UPDATE existing migrations (Story 2.1 livré `stripe_events_inbox` baseline + `outbox` baseline) — ajouter :
    - `<timestamp>-CreatePaymentIntentTables.ts` — tables `payment_intent` + `refund` + `transfer` + `payout` + indexes + check constraints
    - **Réutilise** `stripe_events_inbox` Story 2.1 pour dedup webhook (juste ajouter routing par event_type dans `process-stripe-webhook.usecase.ts`)
    ```sql
    CREATE TABLE payment_intent (
      id UUID PRIMARY KEY,                                                                            -- local UUID v7
      booking_id UUID NOT NULL UNIQUE,                                                                -- 1 PaymentIntent per booking
      order_id UUID NULL,                                                                             -- FK logique order-svc — populated late
      customer_profile_id UUID NOT NULL,
      pro_profile_id UUID NOT NULL,
      stripe_account_id TEXT NOT NULL,                                                                -- Pro Connect account
      stripe_payment_intent_id TEXT NULL UNIQUE,                                                      -- pi_xxx — populated after Stripe API call
      stripe_client_secret TEXT NULL,                                                                 -- never logged — encrypted at rest preferred (V1)
      amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
      currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
      application_fee_amount_cents BIGINT NOT NULL CHECK (application_fee_amount_cents >= 0),
      capture_policy JSONB NOT NULL,
      status VARCHAR(40) NOT NULL CHECK (status IN ('requires_payment_method','requires_action','requires_capture','processing','succeeded','canceled','failed')),
      last_stripe_error JSONB NULL,                                                                   -- PII-stripped
      captured_at TIMESTAMPTZ NULL, cancelled_at TIMESTAMPTZ NULL, failed_at TIMESTAMPTZ NULL,
      correlation_id UUID NOT NULL,
      version INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX idx_payment_intent_booking ON payment_intent (booking_id);
    CREATE INDEX idx_payment_intent_correlation ON payment_intent (correlation_id);
    CREATE INDEX idx_payment_intent_status ON payment_intent (status, updated_at);
    CREATE TRIGGER payment_intent_updated_at BEFORE UPDATE ON payment_intent FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

    CREATE TABLE refund (
      id UUID PRIMARY KEY,
      payment_intent_id UUID NOT NULL REFERENCES payment_intent(id) ON DELETE RESTRICT,
      stripe_refund_id TEXT NULL UNIQUE,                                                              -- re_xxx
      amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
      reason VARCHAR(40) NOT NULL,
      status VARCHAR(40) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX idx_refund_pi ON refund (payment_intent_id);

    CREATE TABLE transfer (
      id UUID PRIMARY KEY,
      payment_intent_id UUID NOT NULL REFERENCES payment_intent(id) ON DELETE RESTRICT,
      stripe_transfer_id TEXT NULL UNIQUE,                                                            -- tr_xxx
      destination_stripe_account_id TEXT NOT NULL,
      amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
      transfer_group TEXT NOT NULL,                                                                   -- typically bookingId
      status VARCHAR(40) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX idx_transfer_pi ON transfer (payment_intent_id);
    CREATE INDEX idx_transfer_group ON transfer (transfer_group);

    CREATE TABLE payout (
      id UUID PRIMARY KEY,
      transfer_id UUID NOT NULL REFERENCES transfer(id) ON DELETE RESTRICT,
      stripe_payout_id TEXT NULL UNIQUE,                                                              -- po_xxx
      arrival_date TIMESTAMPTZ NULL,
      status VARCHAR(40) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX idx_payout_transfer ON payout (transfer_id);
    ```

- (m) **NATS event schemas** (`packages/contracts/src/events/`) — Story 4.2 livre schemas v1 + types TS auto-generated (Story 0.2 `json-schema-to-typescript`) :
  - **`order/`** (NEW directory) :
    - `created.v1.{schema.json,ts}` — `{ orderId, bookingId, customerProfileId, proProfileId, totals, correlationId, requestedAt }`
    - `confirmed.v1.{schema.json,ts}` — `{ orderId, bookingId, totals, confirmedAt, correlationId }`
    - `cancelled.v1.{schema.json,ts}` — `{ orderId, bookingId, cancelledFromStatus, cause, cancelledAt, correlationId }`
    - `invoices-generated.v1.{schema.json,ts}` — `{ orderId, invoices: InvoiceRef[], generatedAt, correlationId }` (Story 4.9 finalise full payload)
    - `status-changed.v1.{schema.json,ts}` — audit event (Story 2.7 consumer)
  - **`payment/`** (UPDATE Story 2.1 — Story 2.1 livre `stripe-account-*.v1`, Story 4.2 ajoute) :
    - `intent-created.v1.{schema.json,ts}` — `{ paymentIntentId, bookingId, amount, applicationFeeAmount, correlationId, createdAt }`
    - `intent-authorized.v1.{schema.json,ts}` — `{ paymentIntentId, stripePaymentIntentId, amount, status, correlationId, authorizedAt }`
    - `intent-captured.v1.{schema.json,ts}` — `{ paymentIntentId, stripePaymentIntentId, capturedAmount, correlationId, capturedAt }`
    - `intent-failed.v1.{schema.json,ts}` — `{ paymentIntentId, stripePaymentIntentId, errorCode, errorMessage, correlationId, failedAt }`
    - `intent-cancelled.v1.{schema.json,ts}` — `{ paymentIntentId, stripePaymentIntentId, reason, correlationId, cancelledAt }`
    - `refund-issued.v1.{schema.json,ts}` — Story 4.2 schema baseline (Story 4.12 livre full producer)
    - `transfer-created.v1.{schema.json,ts}` — Story 4.2 schema baseline (Story 4.10 livre full producer)
    - `payout-confirmed.v1.{schema.json,ts}` — Story 4.2 schema baseline (Story 4.10 livre full producer)
  - **`saga/`** (NEW directory) :
    - `alert.v1.{schema.json,ts}` — `{ alertId, orderId, bookingId, status, stuckSinceMs, correlationId, raisedAt }` — Story 4.13 finalise notification-svc consumer Slack

- (n) **Lint boundaries strict** `eslint-plugin-boundaries` (Story 0.6 config racine) :
  - `pnpm --filter=order-svc lint` → **0 violations** sur `apps/order-svc/src/domain/**` — NO imports `@nestjs/*`, `typeorm`, `axios`, `stripe`, `nats`, `@upstash/redis`
  - `pnpm --filter=payment-svc lint` → **0 violations** sur `apps/payment-svc/src/domain/**` — Story 2.1 baseline préservé + nouveaux domain files conformes
  - **Test failure case** : créer temporairement `order-svc/domain/test-violation.ts` avec `import Stripe from 'stripe'` → `pnpm lint` fail clair → SUPPRIMER (pas de commit)

**so that** la saga choréographée booking → order → payment (R11 critique mono-vendor MVP) est **complète end-to-end** : un Customer initie un booking (Story 4.4/4.5 livreront UI + Stripe Elements frontend), `booking.requested.v1` est consommé en parallèle par order-svc (crée Order pending) + payment-svc (crée PaymentIntent autorisé Stripe via `capture_method='manual'`, application_fee + transfer_data destination Pro). Pro accepte (Story 4.7 livre UI + transition `booking.confirmed.v1`), payment-svc consume → `stripe.paymentIntents.capture()` (NFR6 < 800 ms p95) → publie `payment.intent-captured.v1`. order-svc consume `booking.confirmed.v1` + `payment.intent-captured.v1` (dual-gate via `saga_dual_gate` table par correlationId) → transition `Order.confirm()` → `Order.markInvoiced()` (Story 4.2 skeleton, Story 4.9 finalise PDF TVA mandat 289 CGI + R2). Si saga bloquée > 5 min (R11), `saga-watchdog` cron émet `saga.alert.v1` (Story 4.13 finalise Slack `#tukio-alerts-saga`). Si booking refusé/annulé pre-acceptance, `cancel-order` + `cancel-payment` annulent gracieusement (PaymentIntent libère l'autorisation sans charge). Story 4.10 (auto-payout cron J+1) consommera `booking.completed.v1` pour `transfer-to-pro` (skeleton Story 4.2). Story 4.12 (admin refund) consommera HTTP `POST /admin/refunds` pour `refund-payment` (skeleton Story 4.2). Stripe webhooks PaymentIntent (`requires_capture`, `payment_failed`, `succeeded`, `canceled`) sont routés par `process-stripe-webhook.usecase` étendu (dedup `stripe_events_inbox` Story 2.1 réutilisée) — **garantit idempotence inbox + outbox transactional ADR-007 + saga correlation R11 + 0 PCI PAN/CVV/clientSecret en logs (NFR1 RGPD + pino redact paths)**.

> **Outcome attendu** : à la fin de cette story, `pnpm --filter=order-svc lint && pnpm --filter=payment-svc lint` passent **0 violations boundaries** ; `pnpm --filter=order-svc test --coverage && pnpm --filter=payment-svc test --coverage` montrent **≥ 95 % domain** (Order + PaymentIntent aggregates + 11 VOs + CommissionCalculator), **≥ 90 % usecases** (3 full order + 4 full payment + 2 skeletons payment), **≥ 80 % infrastructure** (consumers NATS testcontainer + repositories + stripe-mock testcontainer) ; les migrations créent **tukio_order** + ajoutent tables `payment_intent`/`refund`/`transfer`/`payout` dans `tukio_payment` (Story 2.1 baseline) ; un test e2e saga `pnpm playwright test test/saga/booking-to-confirmed.e2e-spec.ts` reproduit le flow happy : publish `booking.requested.v1` → assert order-svc crée Order pending + outbox `order.created.v1` + payment-svc crée PaymentIntent + outbox `payment.intent-created.v1` + stripe-mock receives `paymentIntents.create` call + publish `booking.confirmed.v1` → assert payment-svc capture + outbox `payment.intent-captured.v1` + order-svc dual-gate → `Order.PAID` + outbox `order.confirmed.v1` + outbox `order.invoices-generated.v1` skeleton ; un test chaos `pnpm vitest test/chaos/payment-svc-down.chaos-spec.ts` simule payment-svc crash post-`booking.requested.v1` consume — au restart, JetStream redélivre + inbox skip déjà processed + PaymentIntent existant détecté → saga continue sans duplicate Stripe API call (idempotency key correlationId pattern) ; le `sprint-status.yaml` flip `4-2-order-svc-payment-svc-pretre-saga-consumers: ready-for-dev`.

## Acceptance Criteria

1. **AC1 — Scaffolding `order-svc` Pretre via replicate script + docker-compose + bootstrap DB** : Given Story 0.6 livré `infra/scripts/replicate-pretre-structure.sh` + Story 4.1 livré pattern booking-svc, When je l'exécute `pnpm tsx infra/scripts/replicate-pretre-structure.sh --target=order-svc`, Then :
   - **Structure scaffolded** `apps/order-svc/src/` strictement Pattern Pretre (`domain/{model,ports,service,exception}/`, `usecases/`, `infrastructure/{persistence/typeorm,messaging/nats,external,http,logger,config,exception,usecases-proxy,scheduling}/`)
   - `apps/order-svc/eslint.config.mjs` réutilise pattern Story 1.10/3.2/4.1 — extends root + adds order-svc-specific boundary rules
   - **UPDATE `infra/docker-compose/docker-compose.dev.yml`** Story 0.10 — add `order-svc` service port 4011 + healthcheck `/v1/health` + dependsOn `postgres-order` + nats + redis
   - **NEW database `tukio_order`** — UPDATE `infra/scripts/bootstrap-databases.sh`
   - **K8s manifests** `infra/k8s/helm-charts/core-api/values-order-svc.yaml` (minimal MVP, full Story 0.12)
   - `pnpm --filter=order-svc build` passe + `curl localhost:4011/v1/health` retourne 200 enveloppe ADR-014

2. **AC2 — Domain `Order` aggregate root + saga state machine 5 statuts (`pending → authorized → paid → invoiced | cancelled`)** : Given AC1, When je consulte `apps/order-svc/src/domain/model/order.aggregate.ts`, Then :
   - **Aggregate Order** avec tous fields (cf. story body section b)
   - **Static factory `Order.createFromBooking({...})`** invariants (totalAmount > 0, currency='EUR')
   - **4 méthodes domain Story 4.2** : `authorize(paymentIntentId, actor)`, `confirm()`, `markInvoiced(invoices)`, `cancel({ fromStatus, cause })`
   - **`uncommittedEvents` drained** by repository post-save (ADR-007)
   - **5 events appended** : `OrderCreatedEvent`, `OrderStatusChangedEvent` (audit per transition), `OrderConfirmedEvent`, `OrderInvoicesGeneratedEvent`, `OrderCancelledEvent`
   - **Tests aggregate ≥ 95 %** : 40+ cases (factory × 4 invariants, transitions × 8 [pending→authorized, authorized→paid, paid→invoiced, ×3 cancel branches, invalid transitions], idempotent cancel, version increment × 5, events emit × 8)

3. **AC3 — 5 value-objects order-svc + invariants stricts** : Given AC2, When je consulte `apps/order-svc/src/domain/model/value-objects/`, Then :
   - `order-id.vo.ts` UUID v7 sortable (`uuid` v11+ `v7()`) — tests 5 cases
   - `order-status.vo.ts` enum + helpers (`isTerminal`, `isMutable`, `parse`) — tests 6 cases
   - `order-totals.vo.ts` immutable VO + factory `fromHtAmount` + méthodes `withVat/withCommission/withStripeFees` + invariants stricts — tests ≥ 95 % 15 cases
   - `vat-treatment.vo.ts` discriminated union (placeholder MVP + 3 cas réservés Story 4.9) — tests 4 cases
   - `currency-amount.vo.ts` immutable + arithmétique préservant currency — tests ≥ 95 % 10 cases
   - `invoice-ref.vo.ts` — tests 4 cases

4. **AC4 — 5 ports order-svc + 4 exceptions** : Given AC2, When je consulte `apps/order-svc/src/domain/ports/` + `exception/`, Then :
   - **Ports** (interfaces only) : `IOrderRepository` (6 méthodes incl. `findStuckSagas`), `IInvoiceRepository`, `IVatCalculator` (Story 4.9 finalise), `IPdfGenerator` (Story 4.9 finalise), `IEventPublisher` (Story 0.7 `OutboxPublisher` wired)
   - **Exceptions** : `OrderException` base + `OrderNotFoundException` (`ORDER-NOT-FOUND-001` → 404) + `OrderValidationException` (`ORDER-VALIDATION-002` → 422) + `InvalidTransitionException` (`ORDER-INVALID-TRANSITION-003` → 409)
   - Tests : exception construction + `toEnvelope()` serialization + chain instanceof (8 cases)

5. **AC5 — 4 use cases order-svc (3 full + 1 skeleton) + UseCasesProxyModule wired** : Given AC2-4, When je consulte `apps/order-svc/src/usecases/` + `usecases-proxy/usecases-proxy.module.ts`, Then :
   - **`create-order-from-booking.usecase.ts` full** : consumer `booking.requested.v1` (via Story 0.7 `InboxConsumer<BookingRequestedEvent>` wrapper, dedup `inbox` table), uniqueness check `findByBookingId` (idempotent retry → return existing), `Order.createFromBooking(...)`, `repository.save()` outbox `order.created.v1`
   - **`confirm-order.usecase.ts` full dual-gate** : consume `booking.confirmed.v1` OR `payment.intent-captured.v1` → INSERT/UPDATE `saga_dual_gate` row (correlationId PK) → si les 2 sont arrivés → atomic `Order.authorize(paymentIntentId)` [si pas déjà] + `Order.confirm()` + `Order.markInvoiced(generateInvoicesSkeletonResult)` → outbox `order.confirmed.v1` + `order.invoices-generated.v1`
   - **`cancel-order.usecase.ts` full** : consumer `booking.refused.v1` + `booking.cancelled.v1` + `payment.intent-failed.v1` — `Order.cancel({ cause })`, outbox `order.cancelled.v1` (idempotent — already cancelled = no-op)
   - **`generate-invoices.usecase.ts` skeleton** : returns 2 `InvoiceRef` placeholder (Story 4.9 finalise `vatCalculator.compute` + `pdfGenerator.generateInvoicePdf` full)
   - **`UseCasesProxyModule` DynamicModule** wire 4 use cases + 5 ports → impls (`TypeormOrderRepository`, `TypeormInvoiceRepository`, `PlaceholderVatCalculator` skeleton, `PlaceholderPdfGenerator` skeleton, `OutboxPublisher` from `@tukio/messaging` Story 0.7) — pattern Story 0.6/4.1 réutilisé
   - **Tests use cases ≥ 90 %** : mock ports + inbox dedup happy + duplicate eventId → skip + outbox event emit verify + dual-gate happy + dual-gate partial (only 1 event arrived) → no transition

6. **AC6 — Domain `PaymentIntent` aggregate root payment-svc + 5 saga transitions** : Given Story 2.1 livré payment-svc Pretre baseline avec `StripeConnectAccount.aggregate`, When je consulte `apps/payment-svc/src/domain/model/payment-intent.aggregate.ts`, Then :
   - **Aggregate `PaymentIntent`** avec tous fields (cf. story body section g) — distinct du `StripeConnectAccount.aggregate` Story 2.1 (qui gère onboarding Pro Connect, pas saga payment)
   - **Static factory `PaymentIntent.createFromBooking({...})`** + invariants
   - **5 méthodes domain** : `attachStripeIntent(stripePaymentIntentId, clientSecret, status)`, `markRequiresCapture()`, `markCaptured(capturedAmount)`, `markCancelled(reason)`, `markFailed(stripeError)`
   - **5 events appended** : `PaymentIntentCreatedEvent`, `PaymentIntentAuthorizedEvent`, `PaymentIntentCapturedEvent`, `PaymentIntentCancelledEvent`, `PaymentIntentFailedEvent`
   - **`uncommittedEvents` drained** by repository post-save (ADR-007 transactional)
   - **Tests aggregate ≥ 95 %** : 40+ cases (factory + each transition × valid/invalid + idempotent cancel + version increment + events emit + lastStripeError set on markFailed)

7. **AC7 — 4 value-objects payment-svc + 4 exceptions** : Given AC6 + Story 2.1 VOs existants, When je consulte `apps/payment-svc/src/domain/model/value-objects/` + `exception/`, Then :
   - `payment-intent-id.vo.ts` UUID v7 — distinct from Stripe `pi_xxx`
   - `payment-status.vo.ts` enum + helpers
   - `capture-policy.vo.ts` — **shared** via `@tukio/contracts/types/capture-policy.ts` (Story 4.1 a livré dans booking-svc — Story 4.2 promote au shared package OU réplique avec note ADR clarifying)
   - `stripe-error-payload.vo.ts` PII-stripped + serializable
   - **4 exceptions** : `PaymentException` base + `PaymentValidationException` (`PAYMENT-VALIDATION-001` → 422) + `InvalidPaymentTransitionException` (`PAYMENT-INVALID-TRANSITION-002` → 409) + `PaymentIntentNotFoundException` (`PAYMENT-NOT-FOUND-003` → 404)
   - Tests VO + exception ≥ 95 % chacun

8. **AC8 — 3 ports payment-svc nouveaux + `CommissionCalculator` domain service** : Given AC6-7, When je consulte `apps/payment-svc/src/domain/ports/` + `service/`, Then :
   - `payment-intent-repository.port.ts` (`IPaymentIntentRepository`) — 4 méthodes (findById, findByBookingId, findByStripePaymentIntentId, save transactional outbox drain)
   - `stripe-payment-gateway.port.ts` (`IStripePaymentGateway`) — 5 méthodes (`createPaymentIntent`, `capturePaymentIntent`, `cancelPaymentIntent`, `createRefund`, `createTransfer`) — **distinct port** de `IStripeConnect` Story 2.1 (séparation concerns onboarding vs payment-flow)
   - `booking-svc-events-inbox.port.ts` (`IBookingSvcEventsInbox`) — dedup `inbox` table
   - **`CommissionCalculator.service.ts`** — pure logic Story 4.2 MVP fixed 15 % HT — tests ≥ 95 % 8 cases (V1 stretch tier branch)

9. **AC9 — 6 use cases payment-svc (4 full + 2 skeletons) + UseCasesProxyModule wired** : Given AC6-8, When je consulte `apps/payment-svc/src/usecases/` + `usecases-proxy/usecases-proxy.module.ts`, Then :
   - **`create-payment-intent.usecase.ts` full** : consumer `booking.requested.v1` (via `InboxConsumer<BookingRequestedEvent>`), uniqueness `findByBookingId`, fetch `pro.stripeAccountId` via `IdentitySvcClient` (Story 2.1 livré `IdentitySvcClient` — réutiliser), `CommissionCalculator.compute(htAmountCents)`, `PaymentIntent.createFromBooking(...)`, `stripeGateway.createPaymentIntent({ capture_method:'manual', application_fee_amount, transfer_data:{destination:proStripeAccountId}, metadata:{bookingId, customerProfileId, proProfileId, correlationId}, idempotencyKey: correlationId+'-create-pi' })`, `pi.attachStripeIntent(...)`, `repository.save()` outbox `payment.intent-created.v1`
   - **`capture-payment.usecase.ts` full** : consumer `booking.confirmed.v1`, dedup inbox, `repository.findByBookingId`, guard `status === REQUIRES_CAPTURE`, `stripeGateway.capturePaymentIntent(stripePiId, idempotencyKey=correlationId+'-capture')`, `pi.markCaptured(...)`, outbox `payment.intent-captured.v1`. **Latence < 800 ms p95 NFR6 verified via metric**
   - **`cancel-payment.usecase.ts` full** : consumer `booking.refused.v1` + `booking.cancelled.v1` — branch logic per status (cancellable: REQUIRES_*/PROCESSING → Stripe cancel + `pi.markCancelled`; capturé: SUCCEEDED → log + emit `saga.alert.v1` defer to Story 4.8/4.12 refund)
   - **`process-stripe-webhook.usecase.ts` EXTEND Story 2.1** : Story 2.1 livre routing `account.*` events. Story 4.2 ajoute routing : `payment_intent.requires_capture`, `payment_intent.canceled`, `payment_intent.succeeded` (idempotent log), `payment_intent.payment_failed` (→ `pi.markFailed`), `charge.refunded` (Story 4.12 log only), `transfer.created`, `payout.paid` (Story 4.10 log only). Dedup `stripe_events_inbox` Story 2.1 réutilisée.
   - **`refund-payment.usecase.ts` skeleton** Story 4.2 — Story 4.12 finalise admin RBAC + reason enum + partial
   - **`transfer-to-pro.usecase.ts` skeleton** Story 4.2 — Story 4.10 finalise cron J+1 + auto-payout policy
   - **`UseCasesProxyModule`** wire 6 use cases (3 full + 2 skeletons Story 4.2 + 1 EXTEND Story 2.1) + ports → impls : `TypeormPaymentIntentRepository`, `StripePaymentGatewayService` (NEW, distinct from Story 2.1 `StripeConnectService`), `IdentitySvcClient` (Story 2.1 wired), `OutboxPublisher` (Story 0.7)
   - **Tests use cases ≥ 90 %** : `stripe-mock` testcontainer for Stripe API + mock IdentitySvcClient + mock inbox dedup happy + duplicate event skip + idempotency key propagation Stripe + happy capture < 800 ms p95 perf budget

10. **AC10 — NATS consumers wired order-svc + payment-svc + Story 0.7 `InboxConsumer` pattern** : Given Story 0.7 livré `@tukio/messaging` + JetStream durable consumers, When je consulte `apps/{order-svc,payment-svc}/src/infrastructure/messaging/nats/`, Then :
    - **order-svc** : `booking-events.consumer.ts` (durable `order-svc-booking-events` sur stream `BOOKING`, subjects `booking.requested.v1`, `booking.confirmed.v1`, `booking.cancelled.v1`, `booking.refused.v1`) + `payment-events.consumer.ts` (durable `order-svc-payment-events` sur stream `PAYMENT`, subjects `payment.intent-captured.v1`, `payment.intent-failed.v1`)
    - **payment-svc** : `booking-events.consumer.ts` (durable `payment-svc-booking-events` sur stream `BOOKING`, subjects `booking.requested.v1`, `booking.confirmed.v1`, `booking.cancelled.v1`, `booking.refused.v1`)
    - **Story 0.7 `InboxConsumer<T>` wrapper utilisé** (dedup automatic via `inbox` table par eventId — NE PAS re-coder le dedup)
    - **JetStream config** : `ack_wait=30s`, `max_deliver=5`, `backoff` exponential `[1s, 5s, 30s, 2m, 5m]`, DLQ subject `dlq.<svc>.<event-type>` post 5 fails
    - **NATS streams créés** Story 0.7 baseline : `BOOKING` (subjects `booking.*`), `PAYMENT` (subjects `payment.*`), `ORDER` (subjects `order.*` — Story 4.2 NEW stream creation), `SAGA` (subjects `saga.*` — Story 4.2 NEW)
    - Tests integration testcontainer NATS : 12 scenarios (happy each consumer + duplicate eventId skip + DLQ after 5 fails + correlationId propagation cross-event)

11. **AC11 — DB migrations order-svc + extension payment-svc + saga_dual_gate table** : Given AC2 + AC6 + Story 2.1 baseline, When je consulte `apps/order-svc/src/infrastructure/persistence/typeorm/migrations/` + `apps/payment-svc/.../migrations/`, Then :
    - **order-svc** : `1715700000000-CreateOrderTables.ts` (table `order_` reserved-keyword-quoted + `order_status_transition` + `invoice` + `saga_dual_gate` + indexes partials + check constraints + trigger updated_at) + `1715700000001-CreateOutboxInbox.ts` (Story 0.7 template)
    - **payment-svc** : `<timestamp>-CreatePaymentIntentTables.ts` (tables `payment_intent` + `refund` + `transfer` + `payout` + indexes + check constraints) — réutilise `stripe_events_inbox` Story 2.1 + `outbox`/`inbox` Story 2.1 baseline
    - **Indexes partials performance-friendly** : `idx_order_customer_status`, `idx_order_pro_status`, `idx_order_correlation_id` (saga R11), `idx_order_stuck_saga` (cron), `idx_invoice_order`, `idx_invoice_generated_at` (10y retention queries), `idx_payment_intent_booking`, `idx_payment_intent_correlation`, `idx_payment_intent_status`, `idx_transfer_group`, `idx_saga_dual_gate_incomplete`
    - **Check constraints** : status enums, amounts ≥ 0 (totalAmount > 0), currency='EUR' MVP
    - **`down()` migrations** ordre inverse FK + indexes + tables + triggers
    - Tests integration testcontainer Postgres 12 scenarios : migration up + down chaque service + check constraints (status enum violation reject, amount negative reject), cascade FK (order_status_transition CASCADE, invoice RESTRICT pour LCEN 10y), partial indexes EXPLAIN ANALYZE common queries, trigger updates updated_at

12. **AC12 — TypeORM entities + repositories + transactional outbox drain order-svc + payment-svc** : Given AC11, When je consulte `infrastructure/persistence/typeorm/` des 2 services, Then :
    - **order-svc** entities : `order.entity.ts`, `order-status-transition.entity.ts`, `invoice.entity.ts`, `saga-dual-gate.entity.ts`, outbox/inbox réutilisés Story 0.7
    - **`order.typeorm.repository.ts`** (`TypeormOrderRepository implements IOrderRepository`) — 6 méthodes (findById, findByBookingId UNIQUE constraint, findByCustomerProfileId cursor, findByProProfileId cursor, findStuckSagas pour watchdog, save transactional)
    - **`invoice.typeorm.repository.ts`** baseline (Story 4.9 finalise)
    - **`order.mapper.ts`** static aggregate ↔ entity mapper pure
    - **payment-svc** entities : `payment-intent.entity.ts`, `refund.entity.ts`, `transfer.entity.ts`, `payout.entity.ts` (Story 4.2 NEW), `outbox/inbox/stripe_events_inbox.entity.ts` Story 2.1 réutilisés
    - **`payment-intent.typeorm.repository.ts`** + mapper
    - **`save(aggregate)` transactional** (TypeORM `QueryRunner.startTransaction()`) :
      1. UPSERT aggregate row (optimistic lock check via `WHERE id = $1 AND version = $2 - 1`)
      2. INSERT status_transition rows (denormalized history — order_status_transition pour order-svc, audit via outbox-only pour payment-svc)
      3. **Drain `uncommittedEvents`** to outbox table (Story 0.7 `OutboxPublisher` pattern + `OutboxRelayService` PG LISTEN/NOTIFY relays to NATS post-commit)
      4. Commit OR rollback all on any failure
    - Tests integration testcontainer Postgres + NATS 16 scenarios : save happy outbox drained, save with status transition cascade, findById not-found, findByBookingId UNIQUE constraint, cursor pagination × 2 pages stable, findStuckSagas query correct (only pending/authorized > threshold), save rollback on outbox publish fail

13. **AC13 — `StripePaymentGatewayService` infra impl + `IdentitySvcClient` réutilisé Story 2.1** : Given AC8 + Story 2.1 livré `StripeConnectService` + `IdentitySvcClient` + `stripe` SDK latest stable, When je consulte `apps/payment-svc/src/infrastructure/external/`, Then :
    - **`stripe/stripe-payment-gateway.service.ts`** (`StripePaymentGatewayService implements IStripePaymentGateway`) — **distinct fichier** de `stripe-connect.service.ts` Story 2.1 (séparation concerns) :
      - `createPaymentIntent({amountCents, currency, applicationFeeAmountCents, transferDestinationAccountId, captureMethod:'manual', metadata, idempotencyKey})` → `stripe.paymentIntents.create({ amount: amountCents, currency, capture_method:'manual', application_fee_amount: applicationFeeAmountCents, transfer_data:{destination: transferDestinationAccountId}, metadata }, { idempotencyKey })` → returns `{stripePaymentIntentId, clientSecret, status}`
      - `capturePaymentIntent(stripePiId, idempotencyKey)` → `stripe.paymentIntents.capture(stripePiId, undefined, {idempotencyKey})`
      - `cancelPaymentIntent(stripePiId, reason, idempotencyKey)` → `stripe.paymentIntents.cancel(stripePiId, {cancellation_reason: reason}, {idempotencyKey})`
      - `createRefund({stripePiId, amountCents, reason, idempotencyKey})` → `stripe.refunds.create({payment_intent: stripePiId, amount: amountCents, reason}, {idempotencyKey})` — Story 4.12
      - `createTransfer({amountCents, currency, destinationAccountId, sourceTransactionChargeId, transferGroup, idempotencyKey})` → `stripe.transfers.create({amount, currency, destination, source_transaction, transfer_group}, {idempotencyKey})` — Story 4.10
    - **Stripe SDK** `stripe` latest stable (currently v17+ as of 2026 — vérifier `pnpm view stripe version` puis pinner latest stable, JAMAIS une version mineure forcée sans raison ; Story 2.1 utilisait v14+, Story 4.2 upgrade si nouvelle version stable dispo — memory `feedback_latest_versions`)
    - **API version** : utiliser **dernière API Stripe stable** (e.g. `2024-12-18.acacia` ou supérieure si Stripe a publié — vérifier docs Stripe juste avant impl, configurer dans `StripeModule.forRoot({apiVersion: '<latest>'})`)
    - **Idempotency keys propagated** to ALL Stripe API calls (saga retry safety — JetStream redeliver via inbox skip + duplicate Stripe API call swallowed)
    - **PII redaction logger pino** Story 2.1 redact paths réutilisés + extended : NO PAN/CVV/`client_secret` jamais loggés, uniquement `paymentIntentId`, `chargeId`, `status`, `amount`, `currency`
    - **Errors mapping** : `StripeCardError` → `PaymentFailedException` (3DS refused, declined), `StripeRateLimitError` → retry exponential backoff (NFR45), `StripeAuthenticationError` → alert SRE + bubble up, network errors → retry 3x backoff
    - **`identity-svc/identity-svc.client.ts`** Story 2.1 livré — Story 4.2 réutilise pour `fetchProStripeAccountId(proProfileId)` (cross-svc HTTP X-Internal-Service-Token Story 1.10 pattern)
    - Tests integration `stripe-mock` testcontainer 10 scenarios : createPaymentIntent happy + idempotency key replay returns same response, capturePaymentIntent happy + idempotent, cancelPaymentIntent each reason, error mapping (StripeCardError → PaymentFailedException, StripeRateLimitError → retry success on 2nd, network timeout → retry exhausted), PII redaction logs verify (no PAN/CVV in pino output)

14. **AC14 — Inbox dedup + Outbox publisher wired + 9 event schemas + 3 NATS streams** : Given Story 0.7 livré `@tukio/messaging`, When Story 4.2 wire les 2 services, Then :
    - **`OutboxPublisher`** wired in chacun `usecases-proxy.module.ts` (pattern Story 0.7 + 1.10 + 4.1 réutilisé)
    - **`OutboxRelayModule.forRoot(...)`** registered in chacun `app.module.ts`
    - **`InboxConsumer<T>` wrapper** utilisé pour chaque consumer (dedup automatic — Story 0.7 livré pattern)
    - **NATS streams créés** : `BOOKING` (Story 4.1 baseline), `PAYMENT` (Story 2.1 baseline EXTEND avec subjects `payment.intent-*.v1`), `ORDER` (NEW Story 4.2), `SAGA` (NEW Story 4.2)
    - **9 NEW event schemas** :
      - `packages/contracts/src/events/order/{created,confirmed,cancelled,invoices-generated,status-changed}.v1.{schema.json,ts}` (5)
      - `packages/contracts/src/events/payment/{intent-created,intent-authorized,intent-captured,intent-failed,intent-cancelled}.v1.{schema.json,ts}` (5 NEW Story 4.2)
      - `packages/contracts/src/events/payment/{refund-issued,transfer-created,payout-confirmed}.v1.{schema.json,ts}` (3 baseline schemas Story 4.2 — Stories 4.10/4.12 livrent full producers)
      - `packages/contracts/src/events/saga/alert.v1.{schema.json,ts}` (1)
      - JSON Schema v7 validation + types TS auto-generated (Story 0.2 `json-schema-to-typescript`)
    - Tests integration round-trip 9 events (publish → outbox → PG LISTEN/NOTIFY → relay → NATS subject → JSON-Schema validation pass + consumer inbox dedup verify) — testcontainer Postgres + NATS

15. **AC15 — `saga-watchdog.task.ts` cron skeleton + `saga.alert.v1` baseline** : Given AC14 + AC12 `IOrderRepository.findStuckSagas`, When je consulte `apps/order-svc/src/infrastructure/scheduling/saga-watchdog.task.ts`, Then :
    - **`@Cron('*/1 * * * *')`** every 1 min (NFR43 alerte > 5 min)
    - **Stuck detection** : orders `pending` > 10 min OR `authorized` > 5 min (= booking confirmed mais payment.intent-captured.v1 jamais arrivé OU saga partiellement échouée)
    - **`SagaAlertEvent` published** via outbox → `saga.alert.v1` consumed Story 4.13 par notification-svc Slack
    - **Story 4.13 finalise** full Grafana dashboard saga-health + PagerDuty escalade + traces Tempo correlation
    - Tests : 4 scenarios (no stuck sagas → no alert, 1 stuck authorized → 1 alert, 1 stuck pending → 1 alert, mix several → multiple alerts batched)

16. **AC16 — Lint boundaries strict 2 services + tests coverage NFR71** : Given Story 0.6 livré `eslint-plugin-boundaries` + Stories 1.10/3.2/4.1 patterns, When `pnpm --filter=order-svc lint && pnpm --filter=payment-svc lint`, Then :
    - **0 violations boundaries** sur `apps/order-svc/src/domain/**` + `apps/payment-svc/src/domain/**` — NO imports `@nestjs/*`, `typeorm`, `axios`, `stripe`, `nats`, `@upstash/redis`, `@react-pdf/renderer`
    - **0 violations** sur `usecases/**` des 2 services — NO imports infra-specific
    - **Test failure case** : créer temporairement `domain/test-violation.ts` avec `import Stripe from 'stripe'` dans order-svc OR payment-svc → `pnpm lint` fail clair → SUPPRIMER fichier
    - **Coverage NFR71 thresholds enforced** : ≥ 95 % domain (Order + PaymentIntent + 11 VOs + CommissionCalculator + exceptions) + ≥ 90 % usecases (3 full + 1 skeleton order, 4 full + 2 skeletons payment) + ≥ 80 % infrastructure (testcontainer Postgres + NATS + stripe-mock)
    - **Coverage report** uploadé CI Story 0.11 → fail si < threshold

17. **AC17 — Tests e2e saga happy-path + chaos partial-failure (NFR46)** : Given AC1-16 livrés, When je lance les tests e2e saga, Then :
    - **`test/saga/booking-to-confirmed.e2e-spec.ts`** (testcontainer Postgres × 3 + NATS + stripe-mock) reproduit flow happy :
      1. Publish `booking.requested.v1` sur stream BOOKING
      2. Assert `order-svc` consume → Order pending created → outbox `order.created.v1` published
      3. Assert `payment-svc` consume → PaymentIntent created → `stripe-mock` receives `paymentIntents.create` call (capture_method='manual', application_fee_amount=15% HT, transfer_data.destination=proStripeAccountId, metadata.correlationId) → outbox `payment.intent-created.v1` published
      4. Simulate Stripe webhook `payment_intent.requires_capture` → `payment-svc` `markRequiresCapture` → outbox `payment.intent-authorized.v1`
      5. Publish `booking.confirmed.v1` (simulating Pro accept Story 4.7)
      6. Assert `payment-svc` consume → Stripe capture call → outbox `payment.intent-captured.v1` + `order-svc` consume → saga_dual_gate row updated
      7. Assert `order-svc` confirms (dual-gate complete) → `Order.PAID` → `Order.INVOICED` (skeleton) → outbox `order.confirmed.v1` + `order.invoices-generated.v1`
      8. Assert `correlationId` propagé partout (NATS event headers + Stripe metadata + logs)
    - **`test/chaos/payment-svc-crash.chaos-spec.ts`** (NFR46) :
      1. Simule payment-svc crash juste après consume `booking.requested.v1` mais avant `stripe.paymentIntents.create`
      2. Restart payment-svc
      3. Assert JetStream redelivers `booking.requested.v1` → inbox skip déjà processed → PaymentIntent existant détecté (uniqueness `findByBookingId`) → saga continue sans duplicate Stripe API call
      4. **Idempotency key Stripe** garantit pas de duplicate paymentIntent côté Stripe même si retry
    - **`test/chaos/saga-dual-gate-out-of-order.chaos-spec.ts`** : `payment.intent-captured.v1` arrive AVANT `booking.confirmed.v1` (race ordering) → order-svc `saga_dual_gate` row attend → quand booking.confirmed arrive → atomic complete dual-gate
    - **`test/chaos/payment-svc-down.chaos-spec.ts`** : payment-svc DOWN pendant 30s → JetStream durable consumer accumule lag → restart → consume backlog OK
    - Tests fail-fast CI Story 0.11 si timeout > 60s ou assertions fail

18. **AC18 — PII redaction logger + 0 PAN/CVV/clientSecret en logs (NFR1 RGPD)** : Given Story 2.1 livré pino redact paths baseline, When `process-stripe-webhook.usecase` + `create-payment-intent.usecase` + `capture-payment.usecase` s'exécutent, Then :
    - **pino logger redact paths** étendus : `*.client_secret`, `*.charges[*].payment_method_details`, `*.payment_method`, `*.source.card`, `*.last4` (last4 OK to log — c'est non-PAN par design Stripe), masquer email + phone Customer dans metadata si captured (Story 4.5/4.7 PII reveal)
    - **Logs structurés JSON** uniquement, jamais console.log
    - **`lastStripeError` stripped** before persisting (PII removed at infra mapper boundary `stripe-error-mapper.ts`)
    - Tests security : 6 scenarios — webhook payload with PAN → log captures NO PAN, error contains client_secret → log redacted, refund webhook charge details → only refund ID + amount + reason logged, capture latency metric emitted

19. **AC19 — Documentation runbook + ADR + project-context handoff Stories 4.3-4.13** : Given AC1-18 livrés, When je consulte la doc, Then :
    - **UPDATE `docs/runbook/booking-saga-debug.md`** Story 4.1 livré — add sections "order-svc saga consumer" + "payment-svc Stripe consumer" + "saga-watchdog cron debug" + "dual-gate stuck diagnostic"
    - **UPDATE `docs/adr/0006-saga-choreographed.md`** — Implementation Notes : Story 4.1 livre producer booking, Story 4.2 livre consumers order + payment + Stripe gateway. Story 4.13 livre monitoring R11 full
    - **UPDATE `docs/adr/0007-transactional-outbox.md`** — confirm pattern wired in 3 services (booking-svc Story 4.1, order-svc Story 4.2 NEW, payment-svc Story 4.2 EXTEND)
    - **UPDATE `docs/project-context.md`** Story 1.10 baseline — add section "Order + Payment Saga Consumers (Story 4.2)" — résumé Order aggregate + 4 use cases + dual-gate + PaymentIntent aggregate + 6 use cases + StripePaymentGateway + saga choreographed complete + R11 watchdog skeleton + handoff Stories 4.3-4.13
    - **NEW `docs/runbook/stripe-payment-intent-debug.md`** (~40 lignes) — debugging PaymentIntent flow + 3DS issues + idempotency replay + webhook routing + error mapping
    - **UPDATE `_bmad-output/implementation-artifacts/4-1-booking-svc-pretre-saga-state-machine.md`** Completion Notes List — ajouter "Story 4.2 livré : order-svc + payment-svc Pretre + saga consumers — booking.*.v1 outbox stream consommé end-to-end + Stripe PaymentIntent flow + saga-watchdog R11 skeleton + dual-gate confirm-order. Patterns réutilisables Stories 4.5 (frontend Stripe Elements consume client_secret), 4.7 (pro accept = trigger booking.confirmed.v1 → payment-svc capture), 4.8/4.12 (refund flow extend cancel-payment SUCCEEDED branch), 4.10 (transfer-to-pro skeleton finalise cron J+1), 4.13 (saga-watchdog full Grafana + PagerDuty)."

## Tasks / Subtasks

- [ ] **Task 1 — Scaffolding `order-svc` Pretre + docker-compose + bootstrap DB + Helm minimal** (AC: #1)
  - [ ] 1.1 — `pnpm tsx infra/scripts/replicate-pretre-structure.sh --target=order-svc` (Story 0.6 livré — 6ᵉ service Pretre)
  - [ ] 1.2 — UPDATE `apps/order-svc/package.json` + `main.ts` port 4011
  - [ ] 1.3 — UPDATE `infra/docker-compose/docker-compose.dev.yml` Story 0.10 — add order-svc + postgres-order + healthcheck + dependsOn nats/redis/postgres
  - [ ] 1.4 — UPDATE `infra/scripts/bootstrap-databases.sh` Story 0.10 — create `tukio_order` DB
  - [ ] 1.5 — NEW `infra/k8s/helm-charts/core-api/values-order-svc.yaml` minimal MVP
  - [ ] 1.6 — Verify `pnpm --filter=order-svc build` + `curl localhost:4011/v1/health` retourne 200 enveloppe ADR-014

- [ ] **Task 2 — Domain `Order` aggregate root + 4 transitions saga + 5 events** (AC: #2) — coverage ≥ 95 %
  - [ ] 2.1 — `apps/order-svc/src/domain/model/order.aggregate.ts` (aggregate + factory + authorize + confirm + markInvoiced + cancel)
  - [ ] 2.2 — `order.aggregate.spec.ts` 40+ cases (factory × 4 + transitions × 8 + idempotent cancel + version × 5 + events × 8)

- [ ] **Task 3 — 5 value-objects order-svc + factory + invariants** (AC: #3) — coverage ≥ 95 %
  - [ ] 3.1 — `order-id.vo.ts` UUID v7 (uuid v11+)
  - [ ] 3.2 — `order-status.vo.ts` enum + helpers
  - [ ] 3.3 — `order-totals.vo.ts` immutable + factory + arithmétique
  - [ ] 3.4 — `vat-treatment.vo.ts` discriminated union (Story 4.9 finalise full)
  - [ ] 3.5 — `currency-amount.vo.ts` immutable + arithmétique
  - [ ] 3.6 — `invoice-ref.vo.ts`
  - [ ] 3.7 — Tests VOs 35+ cases AC3

- [ ] **Task 4 — 5 ports order-svc + 4 exceptions + tokens** (AC: #4)
  - [ ] 4.1 — `apps/order-svc/src/domain/ports/{order-repository,invoice-repository,vat-calculator,pdf-generator,event-publisher}.port.ts` + `tokens.ts` Symbol DI
  - [ ] 4.2 — `apps/order-svc/src/domain/exception/{order,order-not-found,order-validation,invalid-transition}.exception.ts` + `toEnvelope()`
  - [ ] 4.3 — Tests exceptions construction + serialization 8 cases

- [ ] **Task 5 — 4 use cases order-svc (3 full + 1 skeleton) + UseCasesProxyModule** (AC: #5) — coverage ≥ 90 %
  - [ ] 5.1 — Full `create-order-from-booking.usecase.ts` + spec (consumer + dedup inbox + uniqueness + outbox event)
  - [ ] 5.2 — Full `confirm-order.usecase.ts` + spec (dual-gate via saga_dual_gate + atomic transitions)
  - [ ] 5.3 — Full `cancel-order.usecase.ts` + spec (3 NATS triggers + idempotent)
  - [ ] 5.4 — Skeleton `generate-invoices.usecase.ts` + spec (placeholder Story 4.9 finalise)
  - [ ] 5.5 — `usecases-proxy/usecases-proxy.module.ts` wire 4 use cases + 5 ports → impls

- [ ] **Task 6 — Domain `PaymentIntent` aggregate root payment-svc + 5 transitions saga + 5 events** (AC: #6) — coverage ≥ 95 %
  - [ ] 6.1 — `apps/payment-svc/src/domain/model/payment-intent.aggregate.ts` (aggregate + factory + attachStripeIntent + markRequiresCapture + markCaptured + markCancelled + markFailed)
  - [ ] 6.2 — `payment-intent.aggregate.spec.ts` 40+ cases

- [ ] **Task 7 — 4 value-objects payment-svc + 4 exceptions + `CommissionCalculator` domain service** (AC: #7, #8) — coverage ≥ 95 %
  - [ ] 7.1 — `payment-intent-id.vo.ts` UUID v7 local
  - [ ] 7.2 — `payment-status.vo.ts` enum + helpers
  - [ ] 7.3 — `capture-policy.vo.ts` — **décision** : promote depuis booking-svc Story 4.1 vers `@tukio/contracts/types/capture-policy.ts` shared (recommended) OU réplique avec note ADR
  - [ ] 7.4 — `stripe-error-payload.vo.ts` PII-stripped serializable
  - [ ] 7.5 — 4 exceptions `payment-svc/src/domain/exception/` + `toEnvelope()` + tests
  - [ ] 7.6 — `service/commission-calculator.service.ts` + tests ≥ 95 % 8 cases (V1 stretch tier branch)

- [ ] **Task 8 — 3 ports payment-svc nouveaux + tokens** (AC: #8)
  - [ ] 8.1 — `apps/payment-svc/src/domain/ports/{payment-intent-repository,stripe-payment-gateway,booking-svc-events-inbox}.port.ts`
  - [ ] 8.2 — UPDATE `tokens.ts` Story 2.1 — add Symbol DI tokens

- [ ] **Task 9 — 6 use cases payment-svc (4 full + 2 skeletons) + UseCasesProxyModule EXTEND** (AC: #9) — coverage ≥ 90 %
  - [ ] 9.1 — Full `create-payment-intent.usecase.ts` + spec (consumer booking.requested.v1 + IdentitySvcClient fetch stripeAccountId + CommissionCalculator + Stripe createPaymentIntent + idempotency key + outbox)
  - [ ] 9.2 — Full `capture-payment.usecase.ts` + spec (consumer booking.confirmed.v1 + guard REQUIRES_CAPTURE + Stripe capture + NFR6 < 800 ms p95 + outbox)
  - [ ] 9.3 — Full `cancel-payment.usecase.ts` + spec (consumer booking.refused.v1 + booking.cancelled.v1 + branch logic SUCCEEDED defer Story 4.8/4.12)
  - [ ] 9.4 — EXTEND `process-stripe-webhook.usecase.ts` Story 2.1 — add PaymentIntent + Refund + Transfer + Payout webhook routing + dedup stripe_events_inbox
  - [ ] 9.5 — Skeleton `refund-payment.usecase.ts` + spec (Story 4.12 finalise)
  - [ ] 9.6 — Skeleton `transfer-to-pro.usecase.ts` + spec (Story 4.10 finalise)
  - [ ] 9.7 — UPDATE `usecases-proxy/usecases-proxy.module.ts` Story 2.1 — wire 6 use cases (3 full Story 4.2 + 2 skeletons Story 4.2 + 1 EXTEND Story 2.1) + ports → impls

- [ ] **Task 10 — NATS consumers order-svc + payment-svc + 4 streams configuration** (AC: #10)
  - [ ] 10.1 — `apps/order-svc/src/infrastructure/messaging/nats/booking-events.consumer.ts` (durable + InboxConsumer<T> Story 0.7 wrapper)
  - [ ] 10.2 — `apps/order-svc/src/infrastructure/messaging/nats/payment-events.consumer.ts`
  - [ ] 10.3 — `apps/payment-svc/src/infrastructure/messaging/nats/booking-events.consumer.ts`
  - [ ] 10.4 — UPDATE `apps/order-svc/src/app.module.ts` + `apps/payment-svc/src/app.module.ts` register OutboxRelayModule.forRoot + JetStream consumer modules
  - [ ] 10.5 — NATS streams creation : ORDER (NEW), SAGA (NEW) — UPDATE Story 0.7 stream config OR Story 4.2 livre via @tukio/messaging dynamic stream creation
  - [ ] 10.6 — Tests integration testcontainer NATS 12 scenarios AC10

- [ ] **Task 11 — DB migrations order-svc + payment-svc + saga_dual_gate table** (AC: #11) — coverage ≥ 80 % integration
  - [ ] 11.1 — `apps/order-svc/.../migrations/1715700000000-CreateOrderTables.ts` (order_ + order_status_transition + invoice + saga_dual_gate + indexes + constraints + trigger)
  - [ ] 11.2 — `apps/order-svc/.../migrations/1715700000001-CreateOutboxInbox.ts` (Story 0.7 template)
  - [ ] 11.3 — `apps/payment-svc/.../migrations/<timestamp>-CreatePaymentIntentTables.ts` (payment_intent + refund + transfer + payout + indexes + constraints)
  - [ ] 11.4 — Tests integration testcontainer Postgres 12 scenarios AC11

- [ ] **Task 12 — TypeORM entities + repositories + mappers + transactional outbox drain (2 services)** (AC: #12) — coverage ≥ 80 %
  - [ ] 12.1 — order-svc entities (`order`, `order-status-transition`, `invoice`, `saga-dual-gate`, outbox/inbox réutilisés Story 0.7)
  - [ ] 12.2 — `order.typeorm.repository.ts` (6 méthodes incl. findStuckSagas) + mapper + integration spec
  - [ ] 12.3 — `invoice.typeorm.repository.ts` baseline + spec
  - [ ] 12.4 — payment-svc entities (`payment_intent`, `refund`, `transfer`, `payout`) — outbox/inbox/stripe_events_inbox réutilisés Story 2.1
  - [ ] 12.5 — `payment-intent.typeorm.repository.ts` + mapper + integration spec
  - [ ] 12.6 — Tests integration testcontainer Postgres + NATS 16 scenarios AC12 (transactional outbox drain + optimistic lock)

- [ ] **Task 13 — `StripePaymentGatewayService` infra impl + IdentitySvcClient réutilisé** (AC: #13)
  - [ ] 13.1 — `apps/payment-svc/src/infrastructure/external/stripe/stripe-payment-gateway.service.ts` (5 méthodes + idempotency key propagated + error mapping)
  - [ ] 13.2 — UPDATE `apps/payment-svc/src/infrastructure/external/stripe/stripe.module.ts` Story 2.1 — register StripePaymentGatewayService + bump Stripe SDK version latest stable + apiVersion latest
  - [ ] 13.3 — `apps/payment-svc/src/infrastructure/external/stripe/errors.ts` Story 2.1 EXTEND — add PaymentIntent error mapping (StripeCardError → PaymentFailedException, etc.)
  - [ ] 13.4 — UPDATE pino redact paths Story 2.1 — extend with PaymentIntent paths
  - [ ] 13.5 — Tests integration `stripe-mock` testcontainer 10 scenarios AC13

- [ ] **Task 14 — Inbox dedup + OutboxPublisher wired + 9 event schemas + 4 NATS streams** (AC: #14)
  - [ ] 14.1 — Wire OutboxPublisher in usecases-proxy.module.ts des 2 services + OutboxRelayModule.forRoot in app.module.ts
  - [ ] 14.2 — Configure NATS streams ORDER (NEW), SAGA (NEW) — UPDATE Story 0.7 OR via @tukio/messaging dynamic
  - [ ] 14.3 — NEW 5 event schemas `packages/contracts/src/events/order/{created,confirmed,cancelled,invoices-generated,status-changed}.v1.{schema.json,ts}`
  - [ ] 14.4 — NEW 5 event schemas `packages/contracts/src/events/payment/{intent-created,intent-authorized,intent-captured,intent-failed,intent-cancelled}.v1.{schema.json,ts}` + 3 baseline schemas (`refund-issued`, `transfer-created`, `payout-confirmed`)
  - [ ] 14.5 — NEW 1 event schema `packages/contracts/src/events/saga/alert.v1.{schema.json,ts}`
  - [ ] 14.6 — UPDATE `packages/contracts/src/events/index.ts` — barrel export new events
  - [ ] 14.7 — Tests integration round-trip 9 events AC14

- [ ] **Task 15 — `saga-watchdog.task.ts` cron skeleton + R11 baseline** (AC: #15)
  - [ ] 15.1 — `apps/order-svc/src/infrastructure/scheduling/saga-watchdog.task.ts` (@Cron 1 min + findStuckSagas + emit saga.alert.v1)
  - [ ] 15.2 — UPDATE `IOrderRepository.findStuckSagas` method
  - [ ] 15.3 — Tests 4 scenarios AC15 + `@nestjs/schedule` setup verify

- [ ] **Task 16 — eslint-plugin-boundaries strict 2 services + coverage NFR71** (AC: #16)
  - [ ] 16.1 — `pnpm --filter=order-svc lint && pnpm --filter=payment-svc lint` → 0 violations boundaries (verify domain + usecases pure)
  - [ ] 16.2 — Test boundary fail case (temporary violation file → lint fail → DELETE file, no commit)
  - [ ] 16.3 — Coverage NFR71 thresholds enforced (≥ 95 % domain + ≥ 90 % usecases + ≥ 80 % infrastructure) per service
  - [ ] 16.4 — CI Story 0.11 fail-fast on coverage regression

- [ ] **Task 17 — Tests e2e saga happy + 3 chaos suites (NFR46)** (AC: #17)
  - [ ] 17.1 — `apps/order-svc/test/saga/booking-to-confirmed.e2e-spec.ts` (testcontainer Postgres × 3 + NATS + stripe-mock + happy flow 8 steps assertions)
  - [ ] 17.2 — `apps/payment-svc/test/chaos/payment-svc-crash.chaos-spec.ts` (NFR46 — crash post-consume + restart + idempotent)
  - [ ] 17.3 — `apps/order-svc/test/chaos/saga-dual-gate-out-of-order.chaos-spec.ts` (race ordering events)
  - [ ] 17.4 — `apps/order-svc/test/chaos/payment-svc-down.chaos-spec.ts` (durable consumer backlog)
  - [ ] 17.5 — Setup `@tukio/testing/chaos/saga-partial-failure.helper.ts` (Story 0.9 baseline EXTEND si nécessaire)

- [ ] **Task 18 — PII redaction logger + 0 PAN/CVV/clientSecret en logs (NFR1 RGPD)** (AC: #18)
  - [ ] 18.1 — UPDATE pino logger config payment-svc Story 2.1 baseline — extend redact paths PaymentIntent
  - [ ] 18.2 — `apps/payment-svc/src/infrastructure/external/stripe/stripe-error-mapper.ts` (PII-strip before persisting `lastStripeError`)
  - [ ] 18.3 — Tests security 6 scenarios AC18

- [ ] **Task 19 — Documentation runbook + ADR + project-context + commit handoff Stories 4.3-4.13** (AC: #19)
  - [ ] 19.1 — UPDATE `docs/runbook/booking-saga-debug.md` Story 4.1 livré — add order-svc + payment-svc + saga-watchdog sections
  - [ ] 19.2 — UPDATE `docs/adr/0006-saga-choreographed.md` Implementation Notes (Story 4.2 livre consumers)
  - [ ] 19.3 — UPDATE `docs/adr/0007-transactional-outbox.md` (Story 4.2 wire 3 services)
  - [ ] 19.4 — UPDATE `docs/project-context.md` — section "Order + Payment Saga Consumers (Story 4.2)"
  - [ ] 19.5 — NEW `docs/runbook/stripe-payment-intent-debug.md` (~40 lignes)
  - [ ] 19.6 — UPDATE `_bmad-output/implementation-artifacts/4-1-booking-svc-pretre-saga-state-machine.md` Completion Notes List (handoff Story 4.2 done)
  - [ ] 19.7 — Commit `feat(order-svc,payment-svc,contracts,messaging,infra): Story 4.2 order-svc Pretre + payment-svc EXTEND + saga consumers + dual-gate confirm + 6 use cases payment + 4 use cases order + 13 outbox events + saga-watchdog R11 skeleton + lint boundaries strict + chaos tests NFR46`

## Dev Notes

### Pourquoi Story 4.2 = saga choréographée complète + Stripe payment flow

Story 4.2 **ferme la boucle saga choréographée** booking-payment R11 critique (PRD §R11, §FR47, §FR49, §FR65, §NFR42-46) ouverte par Story 4.1 (booking-svc producer events) + Story 2.1 (payment-svc onboarding baseline). C'est le **pivot Epic 4** : sans Story 4.2, aucune Story Epic 4 downstream (4.5 Stripe Elements frontend, 4.7 Pro accept = trigger capture, 4.8 customer cancellation refund, 4.10 auto-payout cron, 4.12 admin refund) ne peut être livrée — toutes consomment les outbox events `payment.intent-*.v1` + `order.*.v1` + nécessitent les use cases skeletons (`refund-payment`, `transfer-to-pro`) en place.

**Story 4.2 = template "saga consumer multi-event dual-gate + Stripe webhook routing + idempotency end-to-end"** réutilisable :
- Story 8.x V1 multi-vendor cart : parallel saga orchestration N-vendors avec dual-gate étendu
- Story 9.x V1 Subscription tiers : Stripe Billing webhook routing pattern réutilisé
- Story 10.x V1 Dispute workflow : payment-svc consumer Stripe `charge.dispute.*` events
- Story 11.x V1 In-app notifications real-time : notification-svc consumer outbox events `payment.*`

### Décisions techniques majeures actées Story 4.2

1. **Dual-gate `saga_dual_gate` table** dans order-svc pour `confirm-order.usecase.ts` — track les 2 events `booking.confirmed.v1` + `payment.intent-captured.v1` arrivés indépendamment (race ordering possible). Quand les 2 sont présents par `correlationId` → atomic `Order.confirm()`. Alternative considérée : pure event sourcing replay — rejetée (over-engineering MVP). Pattern simple + extensible Story 8.x multi-vendor (N-events parallel gate).

2. **Idempotency keys Stripe** propagated **partout** : `correlationId + '-create-pi'`, `correlationId + '-capture'`, `correlationId + '-cancel'`. Garantit JetStream redeliver + inbox skip + duplicate Stripe API call swallowed (Stripe returns same response 24h replay window). **NE PAS** générer keys aléatoires — toujours dérivées de `correlationId` saga.

3. **`StripePaymentGatewayService` distinct de `StripeConnectService` Story 2.1** (séparation concerns Pattern Pretre + Single Responsibility) — Story 2.1 gère Connect onboarding (`stripe.accounts.*`, `stripe.accountLinks.*`), Story 4.2 ajoute payment flow (`stripe.paymentIntents.*`, `stripe.refunds.*`, `stripe.transfers.*`). Tous deux dans `apps/payment-svc/src/infrastructure/external/stripe/` mais fichiers + ports + classes distincts.

4. **PaymentIntent `capture_method='manual'` + `transfer_data.destination`** = pattern escrow Stripe Connect Express officiel (FR49 + FR65 + FR43 anti-désintermédiation). Stripe maintient les funds en escrow Tukio, transfert vers Pro Connect account déclenché par `stripe.transfers.create` Story 4.10 (auto-payout cron J+1). `application_fee_amount` = commission Tukio (15 % HT MVP, V1 3 tiers Story 9.x).

5. **`CommissionCalculator` MVP fixed 15 %** — domain service pure logic. V1 stretch branch sur `proTier` (Starter 15 % / Business 10 % / Enterprise 5 %). Story 9.x livre full subscription tiers + Stripe Subscription sync — Story 4.2 ne couple PAS au tier (`proTier` optional param avec fallback default).

6. **Order aggregate 5 statuts (`pending → authorized → paid → invoiced | cancelled`)** différent de Booking 5 statuts (`pending_pro_acceptance → confirmed → completed | cancelled | refused`) — saga states distincts par aggregate. Order ne reflète PAS booking lifecycle, il reflète le **payment + invoicing lifecycle**. Pas de status `completed` Order (= différent de Booking completed) — Order termine soit `invoiced` (success) soit `cancelled` (rollback). Story 4.9 finalisera `markInvoiced` full PDF + Story 4.12 admin refund peut produire un status `refunded` futur (V1 stretch).

7. **`generate-invoices.usecase.ts` SKELETON Story 4.2** — Story 4.9 livre full TVA 3 cas + mandat 289 CGI + `@react-pdf/renderer` + R2 upload + i18n PDF FR/EN. Story 4.2 livre **placeholder** (returns 2 `InvoiceRef` avec `r2Key='placeholder://pending-story-4.9'`) suffisant pour `Order.markInvoiced()` transition + outbox `order.invoices-generated.v1` event published (notification-svc Story 5.4 peut consume pour email skeleton).

8. **`refund-payment` + `transfer-to-pro` skeletons Story 4.2** — Story 4.12 (admin refund) + Story 4.10 (auto-payout cron J+1) finalisent business logic. Story 4.2 livre signature + outbox event publish + StripePaymentGateway port methods baseline — Stories 4.10/4.12 ajoutent cron schedule + admin HTTP endpoint + RBAC.

9. **`saga-watchdog.task.ts` cron skeleton Story 4.2** — détection orders stuck `pending` > 10 min OU `authorized` > 5 min → émet `saga.alert.v1` (NFR43). Story 4.13 finalise : Grafana dashboard saga-health + PagerDuty escalade + traces Tempo correlation + chaos tests CI Story 0.11 NFR46.

10. **Inbox dedup obligatoire via Story 0.7 `InboxConsumer<T>` wrapper** — NE PAS re-coder le dedup eventId. Le wrapper Story 0.7 gère : (1) check `hasProcessed(eventId)`, (2) si oui skip, (3) si non execute handler dans transaction, (4) `markProcessed(eventId, payload)` post-success. Garantit at-least-once delivery + idempotent processing (ADR-002 + NFR42).

11. **OutboxPublisher transactional drain ADR-007** — TOUT event business doit passer par outbox table (pas direct `nats.publish()`). Pattern Story 0.7 livré + Story 4.1 réutilisé : `OutboxPublisher.publish(event, transaction)` insère dans `outbox` table dans la même transaction TypeORM que l'aggregate save. `OutboxRelayService` PG LISTEN/NOTIFY relays to NATS post-commit (fallback polling 30s NFR42).

12. **`capture-policy.vo.ts` shared decision** — Story 4.1 livre dans `apps/booking-svc/src/domain/model/value-objects/capture-policy.vo.ts`. Story 4.2 needs same VO dans payment-svc. **Décision recommandée** : promote vers `@tukio/contracts/types/capture-policy.ts` shared (pure type discriminated union, pas de business logic). Alternative : réplique avec ADR note expliquant pourquoi pas shared (rejected — duplication friction).

13. **Stripe SDK version latest stable** (memory `feedback_latest_versions`) — Story 2.1 utilisait Stripe SDK v14+ avec API version `2024-11-20.acacia`. Story 4.2 vérifie + bump si nouvelle version stable disponible (currently 2026 — Stripe likely v17+ + API version `2025-XX-XX` ou +). Configurer `StripeModule.forRoot({ apiVersion: '<latest>' })`. **JAMAIS pinning version arbitraire** — utiliser `pnpm view stripe version` puis pinner exact latest stable.

14. **EN strict + i18n FR/EN + Clean Architecture + Envelope ADR-014 + ADR-006 saga choreographed + ADR-007 outbox + NFR1 RGPD PII redaction + latest stable versions + Cross-svc boundaries** memories — toutes respectées.

15. **No backwards compatibility hacks** — order-svc fresh scaffolding, payment-svc EXTEND Story 2.1 baseline (pas de breaking changes, juste ajouts).

### Versions à utiliser

| Lib | Usage | Version | Notes |
|-----|-------|---------|-------|
| `uuid` | OrderId v7 + PaymentIntentId v7 sortable | latest stable v11+ | `v7()` function — CryptoRandomValues + monotonic timestamp |
| `stripe` | Stripe SDK | **latest stable** (vérifier `pnpm view stripe version` ; Story 2.1 utilisait v14+ — Story 4.2 bump si supérieur dispo) | API version `apiVersion` config — utiliser dernière stable Stripe officielle |
| `stripe-mock` | Testcontainer Stripe API | latest (Stripe officiel) | testcontainer setup Story 2.1 réutilisé |
| `typeorm` | Postgres ORM | (Story 0.6 baseline) | Pretre transactional save pattern réutilisé |
| `@nestjs/schedule` | Cron @Cron decorators | (Story 1.9 baseline) | `saga-watchdog.task.ts` cron 1 min |
| `@nestjs/jetstream` OR `nats` | NATS JetStream | (Story 0.7 baseline) | Wrapped by `@tukio/messaging` `InboxConsumer<T>` |
| `json-schema-to-typescript` | Event types generation | (Story 0.2 baseline) | 9 NEW events Story 4.2 |
| `@tukio/messaging` | OutboxPublisher + OutboxRelay + InboxConsumer | (Story 0.7 baseline) | Wired via DynamicModule.forRoot dans 2 services |
| `@tukio/contracts` | Event schemas + DTOs + envelope types | (Story 0.2 baseline) | UPDATE — add events/{order,saga}/* + events/payment/* extend + types/capture-policy.ts shared |
| `@tukio/testing` | testcontainers + chaos helpers | (Story 0.9 baseline) | Postgres × 3 + NATS + stripe-mock + saga-partial-failure |
| `pino` | Logger structured JSON + PII redact | (Story 2.1 baseline EXTEND) | redact paths étendus PaymentIntent |

### Project Structure cible

```
# ====== NEW Story 4.2 ======

apps/order-svc/                                                                                       # NEW (6ᵉ service Pretre — replicate Story 0.6)
├─ package.json, nest-cli.json, tsconfig.json, tsconfig.build.json, Dockerfile, .env.example          # NEW
├─ eslint.config.mjs                                                                                  # NEW
└─ src/
   ├─ main.ts (port 4011)                                                                             # NEW
   ├─ app.module.ts                                                                                   # NEW (OutboxRelayModule.forRoot + JetStream consumer modules + ScheduleModule)
   ├─ domain/
   │  ├─ model/
   │  │  ├─ order.aggregate.ts + spec                                                                 # NEW
   │  │  └─ value-objects/{order-id,order-status,order-totals,vat-treatment,currency-amount,invoice-ref}.vo.ts + spec  # NEW (6)
   │  ├─ ports/{order-repository,invoice-repository,vat-calculator,pdf-generator,event-publisher}.port.ts + tokens.ts  # NEW (5+tokens)
   │  └─ exception/{order,order-not-found,order-validation,invalid-transition}.exception.ts           # NEW (4)
   ├─ usecases/
   │  ├─ create-order-from-booking.usecase.ts + spec                                                  # NEW full
   │  ├─ confirm-order.usecase.ts + spec                                                              # NEW full (dual-gate)
   │  ├─ cancel-order.usecase.ts + spec                                                               # NEW full
   │  └─ generate-invoices.usecase.ts + spec                                                          # NEW skeleton (Story 4.9 finalise)
   └─ infrastructure/
      ├─ usecases-proxy/usecases-proxy.module.ts                                                      # NEW (wire 4 use cases + 5 ports → impls)
      ├─ persistence/typeorm/
      │  ├─ entities/{order,order-status-transition,invoice,saga-dual-gate,outbox,inbox}.entity.ts    # NEW
      │  ├─ repositories/{order,invoice}.typeorm.repository.ts + integration spec                     # NEW (2)
      │  ├─ mappers/{order,invoice}.mapper.ts + spec                                                  # NEW (2)
      │  └─ migrations/
      │     ├─ 1715700000000-CreateOrderTables.ts                                                     # NEW (order + order_status_transition + invoice + saga_dual_gate + indexes + constraints + trigger)
      │     └─ 1715700000001-CreateOutboxInbox.ts                                                     # NEW (Story 0.7 template)
      ├─ messaging/nats/
      │  ├─ booking-events.consumer.ts                                                                # NEW (durable order-svc-booking-events + InboxConsumer<T>)
      │  ├─ payment-events.consumer.ts                                                                # NEW (durable order-svc-payment-events)
      │  └─ order-stream-config.ts                                                                    # NEW (stream ORDER + SAGA creation)
      ├─ external/
      │  ├─ vat-calculator/placeholder-vat-calculator.service.ts                                      # NEW skeleton (Story 4.9 finalise full 3 cas FR64)
      │  └─ pdf-generator/placeholder-pdf-generator.service.ts                                        # NEW skeleton (Story 4.9 finalise @react-pdf/renderer + R2)
      ├─ scheduling/saga-watchdog.task.ts                                                             # NEW (cron 1 min + findStuckSagas + emit saga.alert.v1)
      ├─ http/controllers/health.controller.ts                                                         # NEW (basic Pretre scaffold)
      ├─ logger/, config/, exception/                                                                  # NEW (Pretre baseline replicate)
      └─ ...

# ====== EXTEND Story 4.2 (payment-svc Story 2.1 baseline) ======

apps/payment-svc/src/
├─ domain/
│  ├─ model/
│  │  ├─ payment-intent.aggregate.ts + spec                                                           # NEW Story 4.2
│  │  ├─ refund.entity.ts                                                                             # NEW Story 4.2 (Story 4.12 finalise)
│  │  ├─ transfer.entity.ts                                                                           # NEW Story 4.2 (Story 4.10 finalise)
│  │  ├─ payout.entity.ts                                                                             # NEW Story 4.2 (Story 4.10 finalise)
│  │  └─ value-objects/{payment-intent-id,payment-status,stripe-error-payload}.vo.ts + spec           # NEW (3) + capture-policy via @tukio/contracts shared
│  ├─ ports/{payment-intent-repository,stripe-payment-gateway,booking-svc-events-inbox}.port.ts       # NEW (3) — distinct from Story 2.1 ports
│  ├─ service/commission-calculator.service.ts + spec                                                  # NEW
│  ├─ exception/{payment-validation,invalid-payment-transition,payment-intent-not-found,payment-failed}.exception.ts  # NEW (4)
│  └─ ports/tokens.ts                                                                                  # UPDATE Story 2.1 — add Symbol DI tokens
├─ usecases/
│  ├─ create-payment-intent.usecase.ts + spec                                                         # NEW full
│  ├─ capture-payment.usecase.ts + spec                                                               # NEW full
│  ├─ cancel-payment.usecase.ts + spec                                                                # NEW full
│  ├─ process-stripe-webhook.usecase.ts + spec                                                        # UPDATE Story 2.1 — EXTEND routing PaymentIntent/Refund/Transfer/Payout webhooks
│  ├─ refund-payment.usecase.ts + spec                                                                # NEW skeleton (Story 4.12 finalise)
│  └─ transfer-to-pro.usecase.ts + spec                                                               # NEW skeleton (Story 4.10 finalise)
└─ infrastructure/
   ├─ usecases-proxy/usecases-proxy.module.ts                                                          # UPDATE Story 2.1 — wire 6 new use cases + 3 new ports → impls
   ├─ persistence/typeorm/
   │  ├─ entities/{payment-intent,refund,transfer,payout}.entity.ts                                    # NEW (4)
   │  ├─ repositories/payment-intent.typeorm.repository.ts + integration spec                          # NEW
   │  ├─ mappers/payment-intent.mapper.ts + spec                                                       # NEW
   │  └─ migrations/<timestamp>-CreatePaymentIntentTables.ts                                           # NEW (payment_intent + refund + transfer + payout + indexes + constraints)
   ├─ messaging/nats/booking-events.consumer.ts                                                        # NEW (durable payment-svc-booking-events + InboxConsumer<T>)
   ├─ external/stripe/
   │  ├─ stripe-payment-gateway.service.ts                                                             # NEW (distinct from stripe-connect.service.ts Story 2.1)
   │  ├─ stripe.module.ts                                                                              # UPDATE Story 2.1 — register StripePaymentGatewayService + bump SDK version + apiVersion latest
   │  ├─ errors.ts                                                                                     # UPDATE Story 2.1 — extend with PaymentIntent error mapping
   │  └─ stripe-error-mapper.ts                                                                        # NEW (PII-strip before persisting lastStripeError)
   └─ logger/                                                                                          # UPDATE Story 2.1 — extend pino redact paths PaymentIntent

# ====== UPDATE @tukio/contracts ======

packages/contracts/src/
├─ events/
│  ├─ order/                                                                                          # NEW directory
│  │  ├─ created.v1.{schema.json,ts}                                                                  # NEW
│  │  ├─ confirmed.v1.{schema.json,ts}                                                                # NEW
│  │  ├─ cancelled.v1.{schema.json,ts}                                                                # NEW
│  │  ├─ invoices-generated.v1.{schema.json,ts}                                                       # NEW (Story 4.9 finalise full payload)
│  │  ├─ status-changed.v1.{schema.json,ts}                                                           # NEW (audit Story 2.7 consumer)
│  │  └─ index.ts                                                                                     # NEW
│  ├─ payment/                                                                                        # UPDATE Story 2.1 directory
│  │  ├─ intent-created.v1.{schema.json,ts}                                                           # NEW
│  │  ├─ intent-authorized.v1.{schema.json,ts}                                                        # NEW
│  │  ├─ intent-captured.v1.{schema.json,ts}                                                          # NEW
│  │  ├─ intent-failed.v1.{schema.json,ts}                                                            # NEW
│  │  ├─ intent-cancelled.v1.{schema.json,ts}                                                         # NEW
│  │  ├─ refund-issued.v1.{schema.json,ts}                                                            # NEW baseline (Story 4.12 livre full producer)
│  │  ├─ transfer-created.v1.{schema.json,ts}                                                         # NEW baseline (Story 4.10 livre full producer)
│  │  ├─ payout-confirmed.v1.{schema.json,ts}                                                         # NEW baseline (Story 4.10 livre full producer)
│  │  └─ index.ts                                                                                     # UPDATE — barrel export
│  ├─ saga/                                                                                           # NEW directory
│  │  ├─ alert.v1.{schema.json,ts}                                                                    # NEW (Story 4.13 finalise consumer)
│  │  └─ index.ts                                                                                     # NEW
│  └─ index.ts                                                                                        # UPDATE — barrel exports new directories
├─ dtos/order/
│  ├─ order-detail.dto.ts                                                                             # NEW (Stories 4.11/4.12 consume)
│  └─ order-status.dto.ts                                                                             # NEW
└─ types/capture-policy.ts                                                                            # NEW (promoted from booking-svc Story 4.1 — shared)

# ====== UPDATE infra ======

infra/docker-compose/docker-compose.dev.yml                                                           # UPDATE Story 0.10 — add order-svc service + postgres-order
infra/scripts/bootstrap-databases.sh                                                                  # UPDATE Story 0.10 — add tukio_order DB
infra/k8s/helm-charts/core-api/values-order-svc.yaml                                                  # NEW (minimal MVP)

# ====== UPDATE docs ======

docs/runbook/booking-saga-debug.md                                                                    # UPDATE Story 4.1 livré — add order-svc + payment-svc + saga-watchdog sections
docs/runbook/stripe-payment-intent-debug.md                                                           # NEW (~40 lignes — debugging PaymentIntent flow + 3DS issues + idempotency replay + webhook routing)
docs/adr/0006-saga-choreographed.md                                                                   # UPDATE — Implementation Notes (Story 4.2 livre consumers)
docs/adr/0007-transactional-outbox.md                                                                 # UPDATE — wire 3 services confirmed
docs/project-context.md                                                                               # UPDATE — section "Order + Payment Saga Consumers (Story 4.2)"
_bmad-output/implementation-artifacts/4-1-booking-svc-pretre-saga-state-machine.md                    # UPDATE Completion Notes List — handoff Story 4.2 done

# Estimation : ~90 nouveaux + ~12 updates = ~100 fichiers
```

### Critical Architecture Constraints

> Cf. Stories 0.2 (`@tukio/contracts` events + DTOs), 0.6 (Pretre baseline + replicate script + boundaries lint), 0.7 (`@tukio/messaging` OutboxPublisher + OutboxRelay + InboxConsumer + CorrelationContext + NATS streams), 0.9 (`@tukio/testing` testcontainers + chaos helpers), 0.10 (docker-compose dev local + bootstrap DBs), 0.11 (CI coverage + lint thresholds), 1.10 (identity-svc internal endpoints pattern + audit_log + Phasetwo webhook bridge pattern réutilisé pour Stripe webhooks), 2.1 (payment-svc Pretre baseline + StripeConnectService + IdentitySvcClient + stripe_events_inbox idempotency + pino redact paths — Story 4.2 EXTEND), 2.3 (cursor pagination canonical pattern réutilisé list-customer/pro-orders), 3.1 (catalog-svc Pretre baseline + ProProfileClient pattern), 4.1 (booking-svc Pretre + Booking aggregate + state machine + 6 outbox events `booking.*.v1` — Story 4.2 CONSUME). Architecture lines 2120-2164 Pretre canonical structure, lines 2341-2378 saga booking-payment 5 étapes, lines 268-276 saga distribuée & event sourcing partiel, lines 632-663 outbox/inbox tables ADR-007, lines 1572-1612 event payload structure + saga correlation. ADR-001 Clean Architecture + ADR-003 DB per service + ADR-006 saga choreographed + ADR-007 outbox + ADR-008 internal endpoint + ADR-014 envelope.

1. **API responses envelope ADR-014** — toutes responses wrapped `{ method, code, data | error, meta }`. Error codes ENV-PORTABLES `ORDER-*-00X` + `PAYMENT-*-00X` enveloppe (Story 4.2 livre 8 baseline).

2. **ADR-001 Clean Architecture strict** — Pattern Pretre boundaries enforced eslint-plugin-boundaries. Domain pure (no NestJS/TypeORM/Stripe/axios/I/O imports). Use cases consume ports. Infrastructure implements ports + adapts I/O.

3. **ADR-003 DB per service strict** — `tukio_order` NEW separate DB + `tukio_payment` Story 2.1 baseline EXTEND. Pas de cross-DB SELECT. Communication async via NATS events (saga choreographed ADR-006) + sync HTTP exception identity-svc pour `pro.stripeAccountId` (Story 2.1 `IdentitySvcClient` pattern réutilisé — X-Internal-Service-Token ADR-008).

4. **ADR-006 saga choreographed** — Story 4.2 livre les consumers complète : booking-svc producer (Story 4.1) → order-svc + payment-svc consumers (Story 4.2) → outbox events `order.*.v1` + `payment.*.v1` consumed Stories 4.5/4.7/4.10/4.12/notification-svc/audit Story 2.7. **PAS d'orchestrator** (Temporal etc.) — pure choreography. Story 4.13 finalise R11 monitoring + alerts.

5. **ADR-007 transactional outbox** — `OutboxPublisher` + `OutboxRelay` Story 0.7 wired dans **3 services** Story 4.2 (booking-svc Story 4.1 baseline + order-svc NEW Story 4.2 + payment-svc Story 2.1 EXTEND). Aggregate `uncommittedEvents` drained dans même transaction TypeORM. Garantit cohérence DB ↔ NATS + R11 saga resilience.

6. **ADR-008 internal endpoint authentication** — payment-svc → identity-svc cross-svc HTTP (Story 2.1 `IdentitySvcClient` pattern) avec `X-Internal-Service-Token` header (Doppler `INTERNAL_SERVICE_TOKEN`) — Story 4.2 réutilise pour `fetchProStripeAccountId`.

7. **Cross-svc boundary discipline strict** — order-svc NE PEUT PAS SELECT directement sur `booking-svc.booking`, `payment-svc.payment_intent`, ou `identity-svc.pro_profiles`. payment-svc NE PEUT PAS SELECT sur les autres DBs. Communication uniquement via :
   - NATS events (consumers Story 4.2 livré)
   - HTTP sync exception identity-svc → `IdentitySvcClient` (Story 2.1 baseline)
   - **PAS d'autre HTTP sync inter-services** (cross-svc boundary strict per ADR-003)

8. **NFR1 RGPD PII redaction** — pino redact paths étendus PaymentIntent (`*.client_secret`, `*.charges[*].payment_method_details`, `*.payment_method`, `*.source.card`, etc.). `lastStripeError` stripped avant persist. NO PAN/CVV/`client_secret` jamais loggés.

9. **NFR42 outbox relay** — Story 0.7 livré `OutboxPublisher` + `OutboxRelay` PG LISTEN/NOTIFY + fallback polling 30s. Story 4.2 wire dans 3 services.

10. **NFR43 saga alert > 5 min** — Story 4.2 livre skeleton `saga-watchdog.task.ts` cron 1 min + `saga.alert.v1` baseline. Story 4.13 finalise Grafana + PagerDuty.

11. **NFR45 retries exponential + circuit breaker timeout 3s** — Stripe SDK retry built-in (Story 2.1 baseline) + extension Story 4.2 PaymentIntent calls. `StripeRateLimitError` → backoff exponential. Network errors → 3x retry.

12. **NFR46 chaos tests CI obligatoires** sur saga booking-payment — Story 4.2 livre 3 chaos suites (payment-svc-crash, saga-dual-gate-out-of-order, payment-svc-down). Story 4.13 finalise CI fail-fast Story 0.11.

13. **NFR71 coverage thresholds** — ≥ 95 % domain (Order + PaymentIntent aggregates + 11 VOs + CommissionCalculator + exceptions) + ≥ 90 % usecases + ≥ 80 % infrastructure.

14. **NFR82 audit** — `order.status-changed.v1` event + `order_status_transition` table denormalized history. payment-svc audit via outbox-only (pas de status_transition table — payment status changes audit via `payment.intent-*.v1` events). Story 2.7 audit_log consumer ingests.

15. **R11 saga partial failure** — Story 4.13 finalise monitoring + alerts > 5 min. Story 4.2 livre :
    - `correlation_id` propagé dans NATS event headers + Stripe metadata + logs structurés
    - `saga_dual_gate` table tracking incomplete sagas (`idx_saga_dual_gate_incomplete` index)
    - `saga-watchdog` cron skeleton emit `saga.alert.v1`
    - Idempotency keys Stripe + inbox dedup garantit retry safety

16. **EN strict + i18n FR/EN + Clean Architecture explicit + Envelope ADR-014 + Pretre boundaries + latest stable versions** memories — toutes respectées.

### Previous Story Intelligence

**Story 0.2 (`@tukio/contracts` events + DTOs)** : Story 4.2 ajoute 13 NEW event schemas (5 order + 5 payment intent + 3 payment baseline + 1 saga) + DTOs order + `capture-policy.ts` shared type promoted. Pattern JSON Schema v7 + types auto-generated.

**Story 0.6 (Pretre baseline + replicate script + boundaries lint)** : Story 4.2 réutilise `replicate-pretre-structure.sh --target=order-svc` (6ᵉ service Pretre après identity/gateway/payment/catalog/booking).

**Story 0.7 (`@tukio/messaging` OutboxPublisher + OutboxRelay + InboxConsumer + CorrelationContext + NATS streams)** : Story 4.2 wire OutboxPublisher + OutboxRelay + InboxConsumer dans 2 services (order-svc NEW, payment-svc EXTEND). NATS streams ORDER + SAGA NEW créés.

**Story 0.9 (`@tukio/testing` testcontainers + chaos helpers)** : Story 4.2 réutilise testcontainer Postgres × 3 + NATS + stripe-mock + saga-partial-failure helper pour 3 chaos suites NFR46.

**Story 0.10 (docker-compose dev local)** : Story 4.2 UPDATE docker-compose — add order-svc + postgres-order + bootstrap-databases.sh add `tukio_order`.

**Story 0.11 (CI coverage + lint thresholds)** : Story 4.2 add `pnpm --filter=order-svc test --coverage` + `pnpm --filter=payment-svc test --coverage` + lint to CI pipeline (NFR71 thresholds enforced + 3 chaos suites NFR46).

**Story 1.10 (identity-svc internal endpoints + audit_log + Phasetwo webhook bridge idempotency pattern)** : Story 4.2 réutilise pattern internal endpoint + audit_log consumes `order.status-changed.v1` automatically + Phasetwo webhook bridge pattern réutilisé pour Stripe webhooks idempotency `stripe_events_inbox` (Story 2.1 baseline EXTEND).

**Story 2.1 (payment-svc Pretre baseline + Stripe Connect Express + IdentitySvcClient + stripe_events_inbox idempotency + pino redact paths)** : Story 4.2 **EXTEND** payment-svc :
- Réutilise `StripeConnectService` Story 2.1 (account onboarding) — distinct du **NEW** `StripePaymentGatewayService` Story 4.2 (payment flow)
- Réutilise `IdentitySvcClient` Story 2.1 (cross-svc HTTP pro fetch)
- Réutilise `stripe_events_inbox` Story 2.1 + extend webhook routing (`process-stripe-webhook.usecase.ts` UPDATE)
- Réutilise pino redact paths Story 2.1 + extend PaymentIntent paths
- Réutilise outbox + inbox tables Story 2.1 baseline
- Bump Stripe SDK + apiVersion latest stable

**Story 2.3 (cursor pagination canonical)** : Story 4.2 réutilise pour `findByCustomerProfileId` + `findByProProfileId` order-svc use cases (Stories 4.11/4.12 consume).

**Story 4.1 (booking-svc Pretre + Booking aggregate state machine + 6 outbox events `booking.*.v1`)** : Story 4.2 **CONSUME** :
- `booking.requested.v1` → order-svc `create-order-from-booking` + payment-svc `create-payment-intent`
- `booking.confirmed.v1` → order-svc `confirm-order` (dual-gate) + payment-svc `capture-payment`
- `booking.cancelled.v1` → order-svc `cancel-order` + payment-svc `cancel-payment`
- `booking.refused.v1` → order-svc `cancel-order` + payment-svc `cancel-payment`
- `booking.completed.v1` → Story 4.10 transfer-to-pro (skeleton Story 4.2)
- `booking.status-changed.v1` → audit Story 2.7

### What this story does NOT do (out of scope)

- ❌ **Frontend Stripe Elements checkout UI** → Story 4.5 (consume `clientSecret` Story 4.2 livré)
- ❌ **Pro pending requests page UI** → Story 4.6
- ❌ **Pro accept/refuse UI + Stripe capture trigger via HTTP** → Story 4.7 (call `POST /v1/bookings/<id>/accept` → booking-svc → booking.confirmed.v1 → payment-svc capture Story 4.2 livré)
- ❌ **48h auto-expire cron** → Story 4.7 (Story 4.1 livre skeleton + Story 4.2 consumes resulting booking.refused.v1)
- ❌ **Customer cancellation flow + refund policy templates + refund preview UI** → Story 4.8 (Story 4.2 livre `cancel-payment` for pre-acceptance cancel only — POST-acceptance refund deferred Story 4.8)
- ❌ **Invoice PDF generation full TVA 3 cas FR64 + mandat 289 CGI + R2 upload + i18n PDF FR/EN** → Story 4.9 (Story 4.2 livre `generate-invoices.usecase.ts` skeleton + `IVatCalculator`/`IPdfGenerator` ports + `placeholder` implementations)
- ❌ **Auto-payout cron J+1 + Stripe transfer creation business logic + Stripe `payout.paid` webhook full handling** → Story 4.10 (Story 4.2 livre `transfer-to-pro.usecase.ts` skeleton + `IStripePaymentGateway.createTransfer` port method)
- ❌ **Customer/Pro bookings list UI + booking detail** → Story 4.11 (Story 4.2 livre Order aggregate + use cases backend, frontend consumes via gateway-api Stories 4.11/4.12)
- ❌ **Admin refund + reconciliation page + RBAC `admin-modo+` + partial refund + reason enum + Stripe ↔ Tukio reconciliation export CSV** → Story 4.12 (Story 4.2 livre `refund-payment.usecase.ts` skeleton + `IStripePaymentGateway.createRefund` port method)
- ❌ **Saga monitoring R11 alerts > 5 min Slack + Grafana dashboard saga-health + PagerDuty escalade + traces Tempo correlation full + chaos tests CI fail-fast** → Story 4.13 (Story 4.2 livre `saga-watchdog.task.ts` skeleton + `saga.alert.v1` event baseline)
- ❌ **3-layer race condition full protection FR48 R5** → Story 4.4 (Story 4.1 livre Layer 1 baseline)
- ❌ **Cart UI Zustand + persistence** → Story 4.3
- ❌ **Multi-vendor parallel saga V1** → Story 8.x V1 B2B Multi-vendor cart
- ❌ **3 tiers subscription tier-based commission rates** → Story 9.x V1 (Story 4.2 livre `CommissionCalculator` fixed 15 % MVP + V1 stretch branch tier)
- ❌ **NFR82 audit consumer** — Story 2.7 livré, Story 4.2 publie events `order.status-changed.v1` consumed automatically
- ❌ **HTTP business endpoints order-svc + payment-svc PaymentIntent** — order-svc HTTP controllers Story 4.11/4.12, payment-svc PaymentIntent endpoints Story 4.5 frontend uses gateway-api → booking-svc → payment-svc via NATS (pas d'endpoint HTTP direct customer-facing payment-svc — webhook only Story 2.1 baseline + extend Story 4.2)

### Files to UPDATE vs CREATE

Cf. Project Structure cible — annoté `# NEW Story 4.2` vs `# UPDATE`.

**UPDATE files (read complete state before modifying)** :

1. `apps/payment-svc/src/usecases/process-stripe-webhook.usecase.ts` Story 2.1 — EXTEND routing PaymentIntent/Refund/Transfer/Payout webhooks. **CRITICAL : lire l'état Story 2.1 complet pour préserver routing `account.*` events Connect onboarding.**
2. `apps/payment-svc/src/infrastructure/usecases-proxy/usecases-proxy.module.ts` Story 2.1 — UPDATE wire 6 new use cases + 3 new ports → impls (PRÉSERVER Story 2.1 4 use cases existants + ports onboarding)
3. `apps/payment-svc/src/infrastructure/external/stripe/stripe.module.ts` Story 2.1 — UPDATE register StripePaymentGatewayService + bump Stripe SDK version + apiVersion latest
4. `apps/payment-svc/src/infrastructure/external/stripe/errors.ts` Story 2.1 — UPDATE extend with PaymentIntent error mapping (StripeCardError, StripeRateLimitError, etc.)
5. `apps/payment-svc/src/domain/ports/tokens.ts` Story 2.1 — UPDATE add Symbol DI tokens (PAYMENT_INTENT_REPOSITORY, STRIPE_PAYMENT_GATEWAY, BOOKING_SVC_EVENTS_INBOX, COMMISSION_CALCULATOR)
6. `apps/payment-svc/src/app.module.ts` Story 2.1 — UPDATE register OutboxRelayModule.forRoot + JetStream consumer module + ScheduleModule
7. `apps/payment-svc/src/logger/` Story 2.1 baseline — UPDATE extend pino redact paths PaymentIntent
8. `packages/contracts/src/events/payment/index.ts` Story 2.1 baseline — UPDATE barrel export 8 new payment events
9. `packages/contracts/src/events/index.ts` — UPDATE barrel export new directories (order/, saga/, payment/ extends)
10. `infra/docker-compose/docker-compose.dev.yml` Story 0.10 — UPDATE add order-svc service + postgres-order
11. `infra/scripts/bootstrap-databases.sh` Story 0.10 — UPDATE add `tukio_order` DB creation
12. `docs/runbook/booking-saga-debug.md` Story 4.1 livré — UPDATE add order-svc + payment-svc + saga-watchdog sections
13. `docs/adr/0006-saga-choreographed.md` — UPDATE Implementation Notes (Story 4.2 livre consumers)
14. `docs/adr/0007-transactional-outbox.md` — UPDATE wire 3 services confirmed
15. `docs/project-context.md` Story 1.10 livré pattern — UPDATE add "Order + Payment Saga Consumers (Story 4.2)" section
16. `_bmad-output/implementation-artifacts/4-1-booking-svc-pretre-saga-state-machine.md` — UPDATE Completion Notes List handoff Story 4.2 done

**Lire l'état complet de chaque UPDATE file avant édition** — critical especially Story 2.1 `process-stripe-webhook.usecase.ts` + `usecases-proxy.module.ts` + `stripe.module.ts` qui sont les files les plus modifiés (préserver routing + DI + SDK config existant).

### Testing Standards

- **Coverage ≥ 95 % domain** (Order aggregate + 5 VOs + 4 exceptions + PaymentIntent aggregate + 4 VOs + 4 exceptions + CommissionCalculator)
- **Coverage ≥ 90 % usecases** (4 order use cases + 6 payment use cases — 3 full order + 1 skeleton + 4 full payment + 2 skeletons)
- **Coverage ≥ 80 % infrastructure** (TypeORM repositories + NATS consumers + StripePaymentGatewayService + StripeErrorMapper + migrations)
- **Integration testcontainer Postgres × 3 + NATS + stripe-mock** (16 + 12 + 10 = 38 scenarios)
- **Lint boundaries strict 0 violations** order-svc + payment-svc domain + usecases pure
- **Pattern Pretre boundaries fail-case verify** (temporary violation file)
- **NFR71 coverage thresholds enforced** CI Story 0.11
- **NFR46 chaos tests obligatoires** : 3 suites (payment-svc-crash, saga-dual-gate-out-of-order, payment-svc-down)
- **NFR1 PII redaction security tests** : 6 scenarios (no PAN/CVV/clientSecret in logs)
- **E2E saga happy-path test** : 8 assertions complete booking → confirmed flow
- **Performance** : capture-payment p95 < 800 ms (NFR6) verify via metric (Prometheus histogram baseline Story 0.12)

### Project Structure Notes

✅ **Aligné** architecture.md (Pretre strict canonical lines 2120-2164, saga choreographed lines 2341-2378, outbox/inbox lines 632-663, event payload structure lines 1572-1612, ADR-001 Clean Architecture + ADR-003 DB per service strict + ADR-006 saga choreographed + ADR-007 transactional outbox + ADR-008 internal endpoint authentication + ADR-014 envelope), PRD §FR47 (lifecycle audit trail — Order aggregate transitions), §FR49 (Stripe Elements autorisation différée — Story 4.2 livre backend, frontend Story 4.5), §FR53 (Pro transactions visualization — Story 4.11 consume Order use cases), §FR54 (factures émises au nom du pro mandat 289 CGI — Story 4.9 finalise full PDF), §FR61 (admin refund — Story 4.12 finalise), §FR63 (rapprochement Stripe ↔ Tukio — Story 4.12 finalise full), §FR64 (3 cas TVA — Story 4.9 finalise full), §FR65 (reversement auto J+1 — Story 4.10 finalise full), §R11 (saga partial failure — Story 4.13 finalise full + Story 4.2 livre baseline), §NFR42 (outbox relay fallback polling 30s), §NFR43 (saga alert > 5 min — Story 4.13 finalise full), §NFR45 (retries exponential Stripe + timeout 3s), §NFR46 (chaos tests CI obligatoires saga), §NFR71 (coverage thresholds), §NFR82 (audit), Stories 0.2/0.6/0.7/0.9/0.10/0.11/1.10/2.1/2.3/3.1/4.1, memories Tukio (feedback_clean_architecture_explicit, feedback_api_envelope_response, feedback_tech_layer_english, feedback_latest_versions, feedback_i18n_frontend).

⚠️ **Déviations** : aucune significative. Order aggregate 5 statuts (pending/authorized/paid/invoiced/cancelled) différent de Booking 5 statuts (pending_pro_acceptance/confirmed/completed/cancelled/refused) — par design saga distincte par aggregate. Dual-gate `saga_dual_gate` table est une décision Story 4.2 documentée Dev Notes (alternative pure event sourcing rejected MVP).

⚠️ **Décisions clés Story 4.2** :
- order-svc 6ᵉ service Pretre scaffolding via replicate script
- payment-svc Story 2.1 EXTEND (préserver Connect onboarding flow)
- Dual-gate `saga_dual_gate` table pour confirm-order (2 events independent arrival)
- `StripePaymentGatewayService` distinct de `StripeConnectService` Story 2.1 (Single Responsibility)
- Idempotency keys derived from `correlationId` (saga retry safety)
- `CommissionCalculator` MVP fixed 15 % HT (V1 stretch branch tier Story 9.x)
- `generate-invoices`, `refund-payment`, `transfer-to-pro` SKELETONS (Stories 4.9/4.12/4.10 finalisent)
- `saga-watchdog` cron skeleton + `saga.alert.v1` baseline (Story 4.13 finalise R11 full)
- `capture-policy.ts` promoted to `@tukio/contracts` shared (vs booking-svc Story 4.1 local)
- Inbox dedup obligatoire via Story 0.7 `InboxConsumer<T>` wrapper (NE PAS re-coder)
- OutboxPublisher transactional drain ADR-007 wired 3 services
- Stripe SDK latest stable + apiVersion latest (vérifier `pnpm view stripe version`)
- 3 chaos suites NFR46 (payment-svc-crash, dual-gate-out-of-order, payment-svc-down)
- PII redaction logger pino extended PaymentIntent paths
- 4 NATS streams (BOOKING Story 4.1 baseline + PAYMENT Story 2.1 EXTEND + ORDER NEW + SAGA NEW)

### References

- [Source: epics.md#Epic-4-Story-4.2 — Lines 1612-1627]
- [Source: prd.md#FR47 (lifecycle audit), #FR49 (Stripe Elements capture différée), #FR53 (Pro transactions), #FR54 (factures mandat 289 CGI — Story 4.9 finalise), #FR61 (admin refund — Story 4.12 finalise), #FR63 (rapprochement Stripe ↔ Tukio — Story 4.12 finalise), #FR64 (3 cas TVA — Story 4.9 finalise), #FR65 (auto-payout J+1 — Story 4.10 finalise), #R11 (saga partial failure — Story 4.13 finalise full), #NFR1 (RGPD PII redaction), #NFR42 (outbox relay fallback), #NFR43 (saga alert > 5 min), #NFR45 (retries exponential Stripe), #NFR46 (chaos tests CI), #NFR71 (coverage thresholds), #NFR82 (audit immutable)]
- [Source: architecture.md — ADR-001 Clean Architecture, ADR-003 DB per service, ADR-006 saga choreographed, ADR-007 transactional outbox, ADR-008 internal endpoint authentication, ADR-014 envelope, Pretre canonical structure lines 2120-2164, saga booking-payment flow lines 2341-2378 (étapes 4 → consumers Story 4.2), outbox/inbox tables lines 632-663, event payload structure lines 1572-1612 (correlationId saga propagation), Stripe Connect Express lines 135, 299, 2030, 2383]
- [Source: Stories 0.2 (contracts events + DTOs), 0.6 (Pretre baseline + replicate + boundaries lint), 0.7 (@tukio/messaging OutboxPublisher + OutboxRelay + InboxConsumer<T> + CorrelationContext + NATS streams config), 0.9 (@tukio/testing testcontainers Postgres/NATS/stripe-mock + chaos saga-partial-failure helper), 0.10 (docker-compose dev local + bootstrap DBs), 0.11 (CI coverage + lint thresholds), 1.10 (identity-svc internal endpoints pattern + audit_log + Phasetwo webhook bridge idempotency pattern réutilisé Stripe webhooks), 2.1 (payment-svc Pretre baseline + Stripe Connect Express + StripeConnectService + IdentitySvcClient + stripe_events_inbox idempotency + pino redact paths — Story 4.2 EXTEND), 2.3 (cursor pagination canonical pattern), 3.1 (catalog-svc Pretre baseline + ProProfileClient pattern), 4.1 (booking-svc Pretre + Booking aggregate state machine + 6 outbox events `booking.*.v1` — Story 4.2 CONSUME)]
- [External: https://docs.stripe.com/connect/express-accounts — Stripe Connect Express overview]
- [External: https://docs.stripe.com/api/payment_intents/create — PaymentIntent create + capture_method=manual + application_fee_amount + transfer_data]
- [External: https://docs.stripe.com/connect/destination-charges — Destination charges + on_behalf_of + transfer_data]
- [External: https://docs.stripe.com/api/payment_intents/capture — PaymentIntent capture (NFR6 < 800 ms p95)]
- [External: https://docs.stripe.com/api/payment_intents/cancel — PaymentIntent cancel + cancellation_reason]
- [External: https://docs.stripe.com/api/refunds/create — Refund create (Story 4.12 finalise full)]
- [External: https://docs.stripe.com/api/transfers/create — Transfer create + source_transaction + transfer_group (Story 4.10 finalise full cron J+1)]
- [External: https://docs.stripe.com/api/idempotent_requests — Stripe idempotency keys (saga retry safety)]
- [External: https://docs.stripe.com/webhooks/signatures — Stripe webhook signature verification (Story 2.1 baseline réutilisé)]
- [External: https://github.com/stripe/stripe-mock — stripe-mock testcontainer (Story 2.1 baseline)]
- [External: https://docs.nats.io/nats-concepts/jetstream/consumers — JetStream durable consumers + ack_wait + max_deliver + backoff (Story 0.7 baseline)]
- [Memory: user_ismael, project_tukio, feedback_clean_architecture_explicit, feedback_api_envelope_response, feedback_tech_layer_english, feedback_latest_versions, feedback_i18n_frontend]

## Dev Agent Record

### Agent Model Used

(à remplir par dev-story)

### Debug Log References

### Completion Notes List

(points d'attention pour :
- **Story 4.3** (cart UI Zustand + persistence — frontend Story 4.4 booking submission consume `POST /v1/bookings/checkout-session` qui trigger booking.requested.v1 → Story 4.2 livré consumers)
- **Story 4.4** (3-layer race conditions full — add Layer 2 GIST exclusion constraint + Layer 3 optimistic lock + `booking.conflict-detected.v1` event + chaos tests — Story 4.2 outbox event consumed côté Story 2.7 audit only)
- **Story 4.5** (Stripe PaymentIntent + Elements checkout frontend — consume `clientSecret` returned by Story 4.2 `create-payment-intent.usecase` + Stripe Elements `<PaymentElement>` + 3D Secure redirect)
- **Story 4.6** (pro pending requests page UI — consume Story 4.1 `list-pro-bookings.usecase` + Story 4.2 saga state visibility)
- **Story 4.7** (pro accept/refuse + Stripe capture trigger — POST /v1/bookings/<id>/accept call booking-svc → `booking.confirmed.v1` → Story 4.2 `capture-payment.usecase` capture Stripe → outbox `payment.intent-captured.v1` → Story 4.2 `confirm-order.usecase` dual-gate)
- **Story 4.8** (customer cancellation flow + refund policy templates — pre-acceptance cancel handled by Story 4.2 `cancel-payment.usecase` SKELETON SUCCEEDED branch — Story 4.8 finalise full refund computation + 3 templates politique)
- **Story 4.9** (invoice generation full TVA 3 cas + mandat 289 CGI + @react-pdf/renderer + R2 upload + i18n PDF FR/EN — finalise Story 4.2 `generate-invoices.usecase.ts` skeleton + `IVatCalculator`/`IPdfGenerator` ports)
- **Story 4.10** (auto-payout cron J+1 + Stripe transfer creation + payout.paid webhook full — finalise Story 4.2 `transfer-to-pro.usecase.ts` skeleton + `IStripePaymentGateway.createTransfer` port method)
- **Story 4.11** (customer + pro bookings list/detail UI — consume Story 4.2 Order use cases + cursor pagination)
- **Story 4.12** (admin refund + reconciliation page + RBAC + partial refund + reason enum + CSV export — finalise Story 4.2 `refund-payment.usecase.ts` skeleton + `IStripePaymentGateway.createRefund` port method)
- **Story 4.13** (saga monitoring R11 alerts > 5 min Slack + Grafana saga-health dashboard + PagerDuty escalade + traces Tempo correlation full + chaos tests CI fail-fast — finalise Story 4.2 `saga-watchdog.task.ts` skeleton + `saga.alert.v1` baseline + 3 chaos suites livrées)
- **Story 5.4** (notification-svc — consume `order.*` + `payment.*` events Story 4.2 livré → email templates Resend FR/EN locale dispatch)
- **Story 5.6** (auto-request-review cron — consume `booking.completed.v1` Story 4.1 + corresponding `order.invoiced` lifecycle Story 4.2)
- **Story 2.7** (audit_log consumer — consume `order.status-changed.v1` Story 4.2 livré automatically + audit Stripe webhook events))

### File List

(à remplir par dev-story)

---

## Story Completion Status

- **Story Status** : `ready-for-dev`
- **Created** : 2026-05-14
- **Created by** : `bmad-create-story` workflow
- **Epic** : Epic 4 — Booking, Cart & Payment Saga (MVP) — **pivot Epic 4 — saga choréographée complète + Stripe payment flow**
- **Sprint cible** : Sprint 5 (2ᵉ story Epic 4 MVP — pivot saga consumers — peut run en parallèle avec Story 4.3 cart UI si team capacity allows)
- **Estimation effort** : **9-12 jours** (1 dev backend senior — scaffolding order-svc Pretre via replicate + Order aggregate + 5 VOs + 5 ports + 4 use cases (3 full + 1 skeleton) + saga-watchdog cron skeleton + DB migrations + TypeORM repos + NATS consumers + payment-svc EXTEND PaymentIntent aggregate + 4 VOs + 3 ports + CommissionCalculator + 6 use cases (4 full + 2 skeletons) + StripePaymentGatewayService + DB migrations + NATS consumer + 9 outbox events + 4 NATS streams config + 3 chaos suites NFR46 + e2e saga test + lint boundaries strict + coverage NFR71 + PII redaction extended + 2 runbooks + 4 ADR updates + UPDATE Story 2.1 process-stripe-webhook + usecases-proxy + stripe.module + ~100 fichiers)
- **Dépendances upstream** :
  - Stories 0.2 (contracts), 0.6 (Pretre + replicate), 0.7 (@tukio/messaging OutboxPublisher + OutboxRelay + InboxConsumer + NATS streams), 0.9 (@tukio/testing testcontainers + chaos), 0.10 (docker-compose), 0.11 (CI coverage)
  - Stories 1.10 (identity-svc internal endpoints pattern + audit_log + Phasetwo webhook bridge), 2.1 (payment-svc Pretre baseline + StripeConnectService + IdentitySvcClient + stripe_events_inbox + pino redact — Story 4.2 EXTEND), 2.3 (cursor pagination canonical)
  - Stories 3.1 (catalog-svc Pretre baseline + ProProfileClient pattern)
  - **Story 4.1 (booking-svc Pretre + Booking aggregate state machine + 6 outbox events `booking.*.v1` — Story 4.2 CONSUME prereq)**
- **Dépendances downstream** (Epic 4 + cross-Epic) :
  - Story 4.3 (cart UI — frontend Zustand consume — independent backend Story 4.2)
  - Story 4.4 (3-layer race conditions full — consume Story 4.1 + Story 4.2 outbox events booking.conflict-detected.v1 audit only)
  - Story 4.5 (Stripe PaymentIntent + Elements checkout frontend — consume Story 4.2 `clientSecret` returned by `create-payment-intent.usecase`)
  - Story 4.6 (pro pending requests page — consume Story 4.1 use cases — independent backend Story 4.2)
  - Story 4.7 (pro accept/refuse + Stripe capture — triggers Story 4.2 `capture-payment.usecase`)
  - Story 4.8 (customer cancellation flow + refund policy — finalises Story 4.2 `cancel-payment` SUCCEEDED branch defer)
  - Story 4.9 (invoice TVA art. 289 CGI — finalises Story 4.2 `generate-invoices` skeleton)
  - Story 4.10 (auto-payout cron J+1 — finalises Story 4.2 `transfer-to-pro` skeleton)
  - Story 4.11 (customer + pro bookings list UI — consumes Story 4.2 Order use cases)
  - Story 4.12 (admin refund reconciliation — finalises Story 4.2 `refund-payment` skeleton)
  - Story 4.13 (saga monitoring R11 alerts + chaos tests CI — finalises Story 4.2 `saga-watchdog` skeleton + 3 chaos suites baseline)
  - Story 5.4 (notification-svc — consume `order.*` + `payment.*` events Story 4.2 livré)
  - Story 2.7 (audit_log — consume `order.status-changed.v1` Story 4.2 livré + payment events audit)
  - Stories Epic 8 V1 (Multi-vendor cart parallel saga orchestration) + Epic 9 V1 (Subscription tiers Stripe Billing — réutilise Stripe webhook routing pattern Story 4.2)
- **FRs covered** :
  - **FR47** ✅ Order audit trail (`order.status-changed.v1` event + `order_status_transition` table denormalized)
  - **FR49 backend** ✅ Stripe PaymentIntent capture_method=manual + application_fee + transfer_data destination Pro (Story 4.5 frontend finalise full)
  - **FR53 partial** ✅ Order aggregate + use cases + `list-customer-orders` + `list-pro-orders` baseline (Story 4.11 UI finalise + Story 4.12 admin reconciliation full)
  - **FR54 backend** ✅ Order aggregate + invoice entity + InvoiceRef baseline (Story 4.9 finalise full PDF mandat 289 CGI)
  - **FR56 backend** ✅ Transfer + Payout entities baseline + IStripePaymentGateway port (Story 4.10 finalise full cron + UI seller payouts)
  - **FR61 backend** ✅ Refund entity + IStripePaymentGateway.createRefund port (Story 4.12 finalise full admin flow)
  - **FR63 backend** ✅ Order audit + Stripe events inbox (Story 4.12 finalise full reconciliation UI + CSV export)
  - **FR64 backend skeleton** ⏳ VatTreatment VO discriminated union + IVatCalculator port + placeholder impl (Story 4.9 finalise full 3 cas)
  - **FR65 backend skeleton** ⏳ Transfer aggregate + transfer_to_pro use case skeleton (Story 4.10 finalise full cron J+1)
- **NFRs touchés** :
  - **NFR1** ✅ PII redaction logger pino étendu PaymentIntent (no PAN/CVV/clientSecret in logs)
  - **NFR6** ✅ Capture-payment p95 < 800 ms (Prometheus histogram baseline Story 0.12)
  - **NFR42** ✅ Outbox relay PG LISTEN/NOTIFY + fallback polling 30s wired 3 services
  - **NFR43 skeleton** ✅ `saga-watchdog` cron + `saga.alert.v1` baseline (Story 4.13 finalise Slack + PagerDuty)
  - **NFR45** ✅ Retries exponential Stripe SDK + circuit breaker timeout 3s
  - **NFR46** ✅ 3 chaos suites baseline (payment-svc-crash, saga-dual-gate-out-of-order, payment-svc-down)
  - **NFR71** ✅ Coverage thresholds enforced (≥ 95 % domain + ≥ 90 % usecases + ≥ 80 % infra) per service
  - **NFR82** ✅ Audit `order.status-changed.v1` event + `order_status_transition` table + payment events `payment.intent-*.v1` for Story 2.7 consumer

> **Prochaine story → Story 4.3** (cart UI frontend Zustand — independent backend Story 4.2, peut run en parallèle) **OU** Story 4.4 (3-layer race conditions full + GIST exclusion constraint + `booking.conflict-detected.v1` event + chaos tests — Story 4.1 dependency + Story 4.2 outbox events audit only). Recommandation : Story 4.4 prioritaire (FR48 R5 critique completes booking saga production-ready), Story 4.3 + 4.5 + 4.6 + 4.7 + 4.8 + 4.11 + 4.12 + 4.13 parallélisables ensuite.

---

**Dev agent next steps :**
1. Lire ce file complètement (~ 800 lignes — story 4.2 est le plus complexe Epic 4)
2. Vérifier upstream Stories 0.2/0.6/0.7/0.9/0.10/0.11/1.10/2.1/2.3/3.1/4.1 implémentées (`sprint-status.yaml` — Story 4.1 doit être `done` AVANT Story 4.2 dev — Stories 0.11/0.12/0.13/1.x/2.x peuvent être encore `ready-for-dev` mais leur scaffolding doit être livré dans develop)
3. **Lire l'état complet de chaque UPDATE file Story 2.1 avant édition** — critical especially :
   - `apps/payment-svc/src/usecases/process-stripe-webhook.usecase.ts` (préserver routing `account.*` events Connect onboarding)
   - `apps/payment-svc/src/infrastructure/usecases-proxy/usecases-proxy.module.ts` (préserver 4 use cases existants + ports onboarding)
   - `apps/payment-svc/src/infrastructure/external/stripe/stripe.module.ts` (préserver StripeConnectService + IdentitySvcClient + bump SDK version careful)
4. Implémenter Tasks 1-19 dans l'ordre :
   - **Tasks 1-5 order-svc scaffolding + domain + ports + use cases** (Phase 1, ~3-4 jours)
   - **Tasks 6-9 payment-svc EXTEND + PaymentIntent aggregate + 4 VOs + 3 ports + CommissionCalculator + 6 use cases** (Phase 2, ~3-4 jours)
   - **Task 10 NATS consumers + 4 streams** (Phase 3, ~1 jour)
   - **Tasks 11-12 DB migrations + TypeORM repositories + transactional outbox drain** (Phase 4, ~1-2 jours)
   - **Task 13 StripePaymentGatewayService + Stripe SDK + idempotency + error mapping** (Phase 5, ~1 jour)
   - **Tasks 14-15 OutboxPublisher wired + 9 event schemas + saga-watchdog cron skeleton** (Phase 6, ~0.5 jour)
   - **Tasks 16-18 lint boundaries + coverage NFR71 + 3 chaos suites NFR46 + PII redaction** (Phase 7, ~1-2 jours)
   - **Task 19 documentation + commit** (Phase 8, ~0.5 jour)
5. Lancer `pnpm --filter=order-svc lint && pnpm --filter=order-svc test --coverage` + `pnpm --filter=payment-svc lint && pnpm --filter=payment-svc test --coverage` après chaque jalon
6. Commit Story 4.2 quand :
   - 0 violations boundaries lint 2 services + coverage NFR71 thresholds 2 services
   - 80+ tests unit domain + 38 integration tests testcontainer (16 Postgres × 2 services + 12 NATS + 10 stripe-mock)
   - 1 e2e saga happy-path test (8 assertions complete flow)
   - 3 chaos suites NFR46 (payment-svc-crash, dual-gate-out-of-order, payment-svc-down)
   - 6 security tests PII redaction (no PAN/CVV/clientSecret in logs)
   - Handoff Stories 4.3-4.13 documented project-context + completion notes Story 4.1 updated
   - PR ouvert vers `develop` (jamais main per git workflow Tukio memory)
