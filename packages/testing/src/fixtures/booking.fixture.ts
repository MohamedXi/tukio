import { faker } from '@faker-js/faker';

export type BookingStatus =
  | 'pending_pro_acceptance'
  | 'accepted'
  | 'refused'
  | 'confirmed'
  | 'cancelled'
  | 'completed';

export interface BookingFixture {
  id: string;
  customerId: string;
  providerId: string;
  listingId: string;
  status: BookingStatus;
  requestedDate: string; // YYYY-MM-DD
  totalAmount: { amount: number; currency: 'EUR' };
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

function asYyyyMmDd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function buildBooking(overrides: Partial<BookingFixture> = {}): BookingFixture {
  return {
    id: faker.string.uuid(),
    customerId: faker.string.uuid(),
    providerId: faker.string.uuid(),
    listingId: faker.string.uuid(),
    status: 'pending_pro_acceptance',
    requestedDate: asYyyyMmDd(faker.date.future()),
    totalAmount: { amount: faker.number.int({ min: 5_000, max: 100_000 }), currency: 'EUR' },
    createdAt: faker.date.recent(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export const buildBookingPending = (overrides: Partial<BookingFixture> = {}): BookingFixture =>
  buildBooking({ status: 'pending_pro_acceptance', ...overrides });

export const buildBookingAccepted = (overrides: Partial<BookingFixture> = {}): BookingFixture =>
  buildBooking({ status: 'accepted', ...overrides });

export const buildBookingConfirmed = (overrides: Partial<BookingFixture> = {}): BookingFixture =>
  buildBooking({ status: 'confirmed', ...overrides });

export const buildBookingCancelled = (overrides: Partial<BookingFixture> = {}): BookingFixture =>
  buildBooking({ status: 'cancelled', ...overrides });

export const buildBookingCompleted = (overrides: Partial<BookingFixture> = {}): BookingFixture =>
  buildBooking({ status: 'completed', ...overrides });
