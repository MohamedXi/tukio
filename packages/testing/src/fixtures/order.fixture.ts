import { faker } from '@faker-js/faker';

export interface OrderLineItemFixture {
  bookingId: string;
  proId: string;
  amount: { amount: number; currency: 'EUR' };
}

export interface OrderFixture {
  id: string;
  customerId: string;
  status: 'pending' | 'paid' | 'cancelled' | 'refunded';
  totalAmount: { amount: number; currency: 'EUR' };
  lineItems: OrderLineItemFixture[];
  createdAt: Date;
}

export function buildOrder(overrides: Partial<OrderFixture> = {}): OrderFixture {
  return {
    id: faker.string.uuid(),
    customerId: faker.string.uuid(),
    status: 'pending',
    totalAmount: { amount: faker.number.int({ min: 10_000, max: 200_000 }), currency: 'EUR' },
    lineItems: [],
    createdAt: faker.date.recent(),
    ...overrides,
  };
}

export function buildOrderWithLineItems(
  itemsCount: number,
  overrides: Partial<OrderFixture> = {},
): OrderFixture {
  const lineItems: OrderLineItemFixture[] = Array.from({ length: itemsCount }, () => ({
    bookingId: faker.string.uuid(),
    proId: faker.string.uuid(),
    amount: { amount: faker.number.int({ min: 5_000, max: 50_000 }), currency: 'EUR' },
  }));
  const total = lineItems.reduce((acc, li) => acc + li.amount.amount, 0);
  return buildOrder({
    lineItems,
    totalAmount: { amount: total, currency: 'EUR' },
    ...overrides,
  });
}
