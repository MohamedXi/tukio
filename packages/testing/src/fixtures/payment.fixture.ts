import { faker } from '@faker-js/faker';

export type PaymentIntentStatus =
  | 'requires_action'
  | 'requires_confirmation'
  | 'succeeded'
  | 'canceled'
  | 'processing';

export interface PaymentIntentFixture {
  id: string;
  bookingId: string;
  customerId: string;
  amount: { amount: number; currency: 'EUR' };
  status: PaymentIntentStatus;
  stripePaymentIntentId: string;
  clientSecret: string;
  createdAt: Date;
}

export function buildPaymentIntent(
  overrides: Partial<PaymentIntentFixture> = {},
): PaymentIntentFixture {
  const stripeId = `pi_${faker.string.alphanumeric(24)}`;
  return {
    id: faker.string.uuid(),
    bookingId: faker.string.uuid(),
    customerId: faker.string.uuid(),
    amount: { amount: faker.number.int({ min: 5_000, max: 100_000 }), currency: 'EUR' },
    status: 'requires_action',
    stripePaymentIntentId: stripeId,
    clientSecret: `${stripeId}_secret_${faker.string.alphanumeric(20)}`,
    createdAt: faker.date.recent(),
    ...overrides,
  };
}

export interface RefundFixture {
  id: string;
  paymentIntentId: string;
  amount: { amount: number; currency: 'EUR' };
  reason: 'customer_cancelled' | 'pro_refused' | 'admin_dispute';
  createdAt: Date;
}

export function buildRefund(overrides: Partial<RefundFixture> = {}): RefundFixture {
  return {
    id: faker.string.uuid(),
    paymentIntentId: faker.string.uuid(),
    amount: { amount: faker.number.int({ min: 5_000, max: 100_000 }), currency: 'EUR' },
    reason: 'customer_cancelled',
    createdAt: faker.date.recent(),
    ...overrides,
  };
}
