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

| Subpath                                                      | Contents                                                                                                      |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `@tukio/contracts`                                           | `Actor`, `Locale`, `Currency`, `Money`, `DomainEvent` only                                                    |
| `@tukio/contracts/envelope`                                  | `SuccessEnvelope<T>`, `ErrorEnvelope`, `Pagination`, `Meta`, `ErrorBody`, `ValidationIssue`, `EnvelopeMethod` |
| `@tukio/contracts/types`                                     | All base types                                                                                                |
| `@tukio/contracts/events/catalog/listing-published.v1`       | `ListingPublishedV1`, `LISTING_PUBLISHED_V1_TYPE`                                                             |
| `@tukio/contracts/events/booking/booking-requested.v1`       | `BookingRequestedV1`, `BOOKING_REQUESTED_V1_TYPE`                                                             |
| `@tukio/contracts/events/booking/booking-accepted.v1`        | `BookingAcceptedV1`, `BOOKING_ACCEPTED_V1_TYPE`                                                               |
| `@tukio/contracts/events/payment/payment-intent-captured.v1` | `PaymentIntentCapturedV1`, `PAYMENT_INTENT_CAPTURED_V1_TYPE`                                                  |
| `@tukio/contracts/events/admin/admin-action-pro-verified.v1` | `AdminActionProVerifiedV1`, `ADMIN_ACTION_PRO_VERIFIED_V1_TYPE`                                               |
| `@tukio/contracts/dtos/auth`                                 | `RegisterCustomerSchema`, `RegisterCustomerDto`                                                               |
| `@tukio/contracts/dtos/booking`                              | `CreateBookingSchema`, `BookingResponseSchema`, `BookingStatusEnum`, etc.                                     |
| `@tukio/contracts/dtos/catalog`                              | `CreateListingSchema`, `CreateListingDto`                                                                     |
| `@tukio/contracts/dtos/payment`                              | `PaymentIntentResponseSchema`, `PaymentIntentResponseDto`                                                     |

## Adding a new event

1. Create `src/events/<service>/<event>.v1.schema.json` (Draft 2020-12)
2. Create `src/events/<service>/<event>.v1.ts` (TypeScript type)
3. Add explicit entry in `package.json#exports`
4. Run `pnpm --filter=@tukio/contracts test && pnpm --filter=@tukio/contracts run check:compat`

## Schema version bump (v1 → v2)

Create `<event>.v2.{schema.json,ts}` in parallel with v1. Keep v1. Update producers then consumers.

## ADR references

- ADR-011: `@tukio/contracts` design (Story 0.13)
- ADR-014: API response envelope format (Story 0.13)
