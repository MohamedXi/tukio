import { z } from 'zod';

const MoneySchema = z.object({
  amount: z.number().int().nonnegative(),
  currency: z.literal('EUR'),
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
  listingId: z.string().uuid(),
  requestedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be YYYY-MM-DD' }),
  totalAmount: MoneySchema,
  notes: z.string().max(500).optional(),
});

export type CreateBookingDto = z.infer<typeof CreateBookingSchema>;

export const BookingResponseSchema = z.object({
  id: z.string().uuid(),
  status: BookingStatusEnum,
  customerId: z.string().uuid(),
  providerId: z.string().uuid(),
  listingId: z.string().uuid(),
  requestedDate: z.string(),
  totalAmount: MoneySchema,
  createdAt: z.string().datetime(),
});

export type BookingResponseDto = z.infer<typeof BookingResponseSchema>;
