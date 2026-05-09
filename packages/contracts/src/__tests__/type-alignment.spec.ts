/**
 * Compile-time type alignment tests.
 * Uses an `Equals<A, B>` helper that produces `never` if A and B are not strictly equal,
 * so the `const _check: AssertEqual<...> = true` lines fail at compile time on type drift.
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { CreateBookingSchema, type CreateBookingDto } from '../dtos/booking.js';
import { RegisterCustomerSchema, type RegisterCustomerDto } from '../dtos/auth.js';
import type {
  ListingPublishedV1,
  ListingPublishedV1Payload,
} from '../events/catalog/listing-published.v1.js';
import type { DomainEvent } from '../types/DomainEvent.js';

/** True only if A and B are strictly equal (bidirectional assignability). */
type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

type AssertEqual<A, B> = Equals<A, B> extends true ? true : never;

/** True if A is assignable to B (one-way). */
type AssertAssignable<A, B> = A extends B ? true : never;

describe('Zod schema ↔ TypeScript type alignment', () => {
  it('z.infer<CreateBookingSchema> === CreateBookingDto', () => {
    const _check: AssertEqual<z.infer<typeof CreateBookingSchema>, CreateBookingDto> = true;
    expect(_check).toBe(true);
  });

  it('z.infer<RegisterCustomerSchema> === RegisterCustomerDto', () => {
    const _check: AssertEqual<z.infer<typeof RegisterCustomerSchema>, RegisterCustomerDto> = true;
    expect(_check).toBe(true);
  });
});

describe('DomainEvent type extensions', () => {
  it('ListingPublishedV1 is assignable to DomainEvent<ListingPublishedV1Payload>', () => {
    const _check: AssertAssignable<
      ListingPublishedV1,
      DomainEvent<ListingPublishedV1Payload>
    > = true;
    expect(_check).toBe(true);
  });

  it('ListingPublishedV1.eventType is narrowed to the literal type', () => {
    const event = {
      eventType: 'catalog.listing.published.v1' as const,
    } as ListingPublishedV1;
    const _narrow: 'catalog.listing.published.v1' = event.eventType;
    expect(_narrow).toBe('catalog.listing.published.v1');
  });
});
