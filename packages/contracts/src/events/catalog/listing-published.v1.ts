import type { DomainEvent } from '../../types/DomainEvent.js';

export interface ListingPublishedV1Payload {
  listingId: string;
  proId: string;
  locale: 'fr' | 'en';
  publishedAt: string;
  categorySlug: string;
  priceFrom: number;
}

export type ListingPublishedV1 = DomainEvent<ListingPublishedV1Payload> & {
  eventType: 'catalog.listing.published.v1';
  eventVersion: 'v1';
  aggregate: { type: 'listing'; id: string };
};

export const LISTING_PUBLISHED_V1_TYPE = 'catalog.listing.published.v1' as const;
