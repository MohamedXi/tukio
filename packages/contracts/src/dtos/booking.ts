import { z } from 'zod';

const MoneySchema = z.object({
  amount: z.number().int().nonnegative(),
  currency: z.literal('EUR'),
});

/** Shared YYYY-MM-DD date-only format for both request and response sides. */
const DateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
  message: 'Date must be YYYY-MM-DD',
});

export const BOOKING_STATUSES = [
  'pending_pro_acceptance',
  'accepted',
  'refused',
  'confirmed',
  'cancelled',
  'completed',
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const BookingStatusEnum = z.enum(BOOKING_STATUSES);

export const CreateBookingSchema = z.object({
  listingId: z.uuid(),
  requestedDate: DateOnlySchema,
  totalAmount: MoneySchema,
  notes: z.string().max(500).optional(),
});

export type CreateBookingDto = z.infer<typeof CreateBookingSchema>;

export const BookingResponseSchema = z.object({
  id: z.uuid(),
  status: BookingStatusEnum,
  customerId: z.uuid(),
  providerId: z.uuid(),
  listingId: z.uuid(),
  requestedDate: DateOnlySchema,
  totalAmount: MoneySchema,
  createdAt: z.iso.datetime(),
});

export type BookingResponseDto = z.infer<typeof BookingResponseSchema>;
