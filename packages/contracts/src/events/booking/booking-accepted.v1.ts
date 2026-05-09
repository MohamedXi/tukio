import type { DomainEvent } from '../../types/DomainEvent.js';

export interface BookingAcceptedV1Payload {
  bookingId: string;
  customerId: string;
  proId: string;
  acceptedAt: string;
  paymentIntentId: string;
}

export type BookingAcceptedV1 = DomainEvent<BookingAcceptedV1Payload> & {
  eventType: 'booking.accepted.v1';
  eventVersion: 'v1';
  aggregate: { type: 'booking'; id: string };
};

export const BOOKING_ACCEPTED_V1_TYPE = 'booking.accepted.v1' as const;
