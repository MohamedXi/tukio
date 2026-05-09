import type { DomainEvent } from '../../types/DomainEvent.js';
import type { Money } from '../../types/Money.js';

export interface PaymentIntentCapturedV1Payload {
  paymentIntentId: string;
  bookingId: string;
  orderId: string;
  amount: Money;
  capturedAt: string;
  stripeChargeId: string;
}

export type PaymentIntentCapturedV1 = DomainEvent<PaymentIntentCapturedV1Payload> & {
  eventType: 'payment.intent.captured.v1';
  eventVersion: 'v1';
  aggregate: { type: 'payment-intent'; id: string };
};

export const PAYMENT_INTENT_CAPTURED_V1_TYPE = 'payment.intent.captured.v1' as const;
