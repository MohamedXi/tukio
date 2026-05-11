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

// Tukio business is Europe/Paris (MVP Pays de la Loire). Using
// `toISOString().slice(0, 10)` would shift dates near midnight by one day
// (UTC). For bookings on a calendar visible to FR users, we want the date
// they see, not UTC.
const PARIS_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Paris',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function asYyyyMmDd(date: Date): string {
  // en-CA produces YYYY-MM-DD natively, no manual reformat needed.
  return PARIS_DATE_FORMATTER.format(date);
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
