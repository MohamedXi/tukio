import { z } from 'zod';

const MoneySchema = z.object({
  amount: z.number().int().nonnegative(),
  currency: z.literal('EUR'),
});

export const PAYMENT_INTENT_STATUSES = [
  'requires_action',
  'requires_confirmation',
  'succeeded',
  'canceled',
  'processing',
] as const;

export type PaymentIntentStatus = (typeof PAYMENT_INTENT_STATUSES)[number];

export const PaymentIntentResponseSchema = z.object({
  paymentIntentId: z.string(),
  clientSecret: z.string(),
  amount: MoneySchema,
  status: z.enum(PAYMENT_INTENT_STATUSES),
});

export type PaymentIntentResponseDto = z.infer<typeof PaymentIntentResponseSchema>;
