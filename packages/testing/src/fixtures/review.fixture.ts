import { faker, fakerFR } from '@faker-js/faker';

const f = fakerFR;

export interface ReviewFixture {
  id: string;
  bookingId: string;
  authorId: string;
  targetProId: string;
  rating: number; // 1-5
  comment: string;
  createdAt: Date;
}

export function buildReview(overrides: Partial<ReviewFixture> = {}): ReviewFixture {
  return {
    id: faker.string.uuid(),
    bookingId: faker.string.uuid(),
    authorId: faker.string.uuid(),
    targetProId: faker.string.uuid(),
    rating: faker.number.int({ min: 1, max: 5 }),
    comment: f.lorem.sentences(2),
    createdAt: faker.date.recent(),
    ...overrides,
  };
}

export interface ReviewWithBreakdownFixture extends ReviewFixture {
  breakdown: {
    professionalism: number;
    quality: number;
    valueForMoney: number;
  };
}

// Builds a review with three sub-criteria. Partial `overrides.breakdown` is
// merged INTO the generated breakdown rather than replacing it whole — so a
// caller passing `{ breakdown: { professionalism: 5 } }` keeps random
// quality + valueForMoney instead of leaving them undefined.
export function buildReviewWithBreakdown(
  overrides: Partial<ReviewWithBreakdownFixture> = {},
): ReviewWithBreakdownFixture {
  const { breakdown: breakdownOverride, ...rest } = overrides;
  const base = buildReview(rest);
  return {
    ...base,
    breakdown: {
      professionalism: faker.number.int({ min: 1, max: 5 }),
      quality: faker.number.int({ min: 1, max: 5 }),
      valueForMoney: faker.number.int({ min: 1, max: 5 }),
      ...breakdownOverride,
    },
  };
}
