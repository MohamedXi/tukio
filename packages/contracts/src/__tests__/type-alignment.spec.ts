/**
 * Compile-time type alignment tests.
 * If this file compiles with tsc --noEmit, the types are correctly aligned.
 * Vitest wraps the assertions to make them discoverable as test cases.
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

describe('Zod schema ↔ TypeScript type alignment', () => {
  it('z.infer<CreateBookingSchema> is assignable to CreateBookingDto', () => {
    type Inferred = z.infer<typeof CreateBookingSchema>;
    // This assignment fails at compile time if types are misaligned
    const _check: CreateBookingDto = undefined as unknown as Inferred;
    const _checkReverse: Inferred = undefined as unknown as CreateBookingDto;
    expect(true).toBe(true);
    void _check;
    void _checkReverse;
  });

  it('z.infer<RegisterCustomerSchema> is assignable to RegisterCustomerDto', () => {
    type Inferred = z.infer<typeof RegisterCustomerSchema>;
    const _check: RegisterCustomerDto = undefined as unknown as Inferred;
    const _checkReverse: Inferred = undefined as unknown as RegisterCustomerDto;
    expect(true).toBe(true);
    void _check;
    void _checkReverse;
  });
});

describe('DomainEvent type extensions', () => {
  it('ListingPublishedV1 extends DomainEvent<ListingPublishedV1Payload>', () => {
    // Compile-time check: ListingPublishedV1 must be assignable to DomainEvent<Payload>
    const _check: DomainEvent<ListingPublishedV1Payload> = undefined as unknown as ListingPublishedV1;
    expect(true).toBe(true);
    void _check;
  });

  it('ListingPublishedV1.eventType is narrowed to the literal type', () => {
    const event = {
      eventType: 'catalog.listing.published.v1' as const,
    } as ListingPublishedV1;
    // TypeScript will error if eventType doesn't match the literal
    const _narrow: 'catalog.listing.published.v1' = event.eventType;
    expect(_narrow).toBe('catalog.listing.published.v1');
  });
});
