import type { DomainEvent } from '../../types/DomainEvent.js';
import type { Money } from '../../types/Money.js';

export interface BookingRequestedV1Payload {
  bookingId: string;
  customerId: string;
  listingId: string;
  proId: string;
  requestedDate: string;
  totalAmount: Money;
}

export type BookingRequestedV1 = DomainEvent<BookingRequestedV1Payload> & {
  eventType: 'booking.requested.v1';
  eventVersion: 'v1';
  aggregate: { type: 'booking'; id: string };
};

export const BOOKING_REQUESTED_V1_TYPE = 'booking.requested.v1' as const;
