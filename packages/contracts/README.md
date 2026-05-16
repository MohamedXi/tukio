# @tukio/contracts

Single source of truth for Tukio — REST envelope types, NATS event schemas (JSON Schema + TypeScript), and shared Zod DTOs.

## How to import (subpaths required)

```ts
// ✅ Correct — subpath imports
import type { SuccessEnvelope, ErrorEnvelope } from '@tukio/contracts/envelope';
import type { ListingPublishedV1 } from '@tukio/contracts/events/catalog/listing-published.v1';
import { CreateBookingSchema, type CreateBookingDto } from '@tukio/contracts/dtos/booking';
import type { Actor, Money, DomainEvent } from '@tukio/contracts/types';

// ❌ Forbidden — barrel import (lint rule tukio/no-barrel-import-contracts warns)
import { SuccessEnvelope } from '@tukio/contracts';
```

## Available subpaths

| Subpath                                                      | Contents                                                                                                              |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `@tukio/contracts`                                           | `Actor`, `Locale`, `Currency`, `Money`, `DomainEvent` only                                                            |
| `@tukio/contracts/envelope`                                  | `SuccessEnvelope<T>`, `ErrorEnvelope`, `Pagination`, `Meta`, `ErrorBody`, `ValidationIssue`, `EnvelopeMethod`         |
| `@tukio/contracts/types`                                     | All base types                                                                                                        |
| `@tukio/contracts/events/catalog/listing-published.v1`       | `ListingPublishedV1`, `LISTING_PUBLISHED_V1_TYPE`                                                                     |
| `@tukio/contracts/events/booking/booking-requested.v1`       | `BookingRequestedV1`, `BOOKING_REQUESTED_V1_TYPE`                                                                     |
| `@tukio/contracts/events/booking/booking-accepted.v1`        | `BookingAcceptedV1`, `BOOKING_ACCEPTED_V1_TYPE`                                                                       |
| `@tukio/contracts/events/payment/payment-intent-captured.v1` | `PaymentIntentCapturedV1`, `PAYMENT_INTENT_CAPTURED_V1_TYPE`                                                          |
| `@tukio/contracts/events/admin/admin-action-pro-verified.v1` | `AdminActionProVerifiedV1`, `ADMIN_ACTION_PRO_VERIFIED_V1_TYPE`                                                       |
| `@tukio/contracts/events/identity/user-registered.v1`        | `UserRegisteredV1`, `USER_REGISTERED_V1_TYPE`                                                                         |
| `@tukio/contracts/events/notification/email-send.v1`         | `EmailSendV1`, `EMAIL_SEND_V1_TYPE`                                                                                   |
| `@tukio/contracts/dtos/identity`                             | `RegisterCustomerInputSchema`, `RegisterCustomerInputDto`, `RegisterCustomerResponseSchema`, `AcquisitionInputSchema` |
| `@tukio/contracts/dtos/auth`                                 | `RegisterCustomerSchema`, `RegisterCustomerDto`                                                                       |
| `@tukio/contracts/dtos/booking`                              | `CreateBookingSchema`, `BookingResponseSchema`, `BookingStatusEnum`, etc.                                             |
| `@tukio/contracts/dtos/catalog`                              | `CreateListingSchema`, `CreateListingDto`                                                                             |
| `@tukio/contracts/dtos/payment`                              | `PaymentIntentResponseSchema`, `PaymentIntentResponseDto`                                                             |

## Adding a new event

1. Create `src/events/<service>/<event>.v1.schema.json` (Draft 2020-12)
2. Create `src/events/<service>/<event>.v1.ts` (TypeScript type)
3. Add explicit entry in `package.json#exports`
4. Run `pnpm --filter=@tukio/contracts test && pnpm --filter=@tukio/contracts run check:compat`

## Schema version bump (v1 → v2)

Create `<event>.v2.{schema.json,ts}` in parallel with v1. Keep v1. Update producers then consumers.

## Identity events (Epic 1)

The identity domain emits two NATS events on successful customer registration
(Story 1.2, transactional outbox via `@tukio/messaging`):

| Event                         | Subject                             | Schema                                               | Downstream consumers                                                                                            |
| ----------------------------- | ----------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `identity.user.registered.v1` | `tukio.identity.user.registered.v1` | `src/events/identity/user-registered.v1.schema.json` | `notification-svc` (welcome email), analytics (Plausible BI), `messaging-svc` (preload conversation slot in V1) |
| `notification.email.send.v1`  | `tukio.notification.email.send.v1`  | `src/events/notification/email-send.v1.schema.json`  | `notification-svc` Resend dispatcher (locale-aware template)                                                    |

**Payload contracts** (TypeScript types — see `events/identity/user-registered.v1.ts`):

- `userId: string` — Keycloak subject UUID (matches `sub` JWT claim).
- `email: string` — lowercased + trimmed.
- `locale: 'fr' | 'en'` — from registration form, drives downstream email + UI locale.
- `acquisition?: AcquisitionInputDto` — first-touch UTM context (K-04) propagated for BI.
- `registeredAt: string` — ISO-8601 timestamp.

**Anti-énumération (NFR9):** The gateway-api anti-enum filter NEVER exposes `IDENTITY-CONFLICT-001` to the UI. Event emission is conditional on a successful `register-customer.usecase` run — duplicate-email attempts produce no event.

## ADR references

- ADR-011: `@tukio/contracts` design (Story 0.13)
- ADR-014: API response envelope format (Story 0.13)
