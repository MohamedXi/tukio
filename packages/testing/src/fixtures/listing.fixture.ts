import { faker, fakerFR } from '@faker-js/faker';

const f = fakerFR;

export interface ListingFixture {
  id: string;
  proId: string;
  categorySlug: string;
  title: string;
  slug: string;
  description: string;
  basePrice: { amount: number; currency: 'EUR' };
  photos: string[];
  deliveryRadius: number;
  status: 'draft' | 'pending_review' | 'published' | 'unpublished' | 'archived';
  createdAt: Date;
  updatedAt: Date;
}

const SAMPLE_CATEGORIES = ['photographer', 'caterer', 'dj', 'wedding-planner', 'florist'];

export function buildListing(overrides: Partial<ListingFixture> = {}): ListingFixture {
  const title = overrides.title ?? f.commerce.productName();
  return {
    id: faker.string.uuid(),
    proId: faker.string.uuid(),
    categorySlug: faker.helpers.arrayElement(SAMPLE_CATEGORIES),
    title,
    slug: faker.helpers.slugify(title).toLowerCase(),
    description: f.lorem.paragraphs(2),
    basePrice: { amount: faker.number.int({ min: 5_000, max: 200_000 }), currency: 'EUR' },
    photos: Array.from({ length: 4 }, () => faker.image.url()),
    deliveryRadius: faker.number.int({ min: 5, max: 50 }),
    status: 'published',
    createdAt: faker.date.past(),
    updatedAt: new Date(),
    ...overrides,
  };
}
