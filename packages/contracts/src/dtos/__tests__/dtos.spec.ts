import { describe, it, expect } from 'vitest';

// RFC 4122 v4 UUIDs — version=4, variant=8 (0000...4000...8000...)
const UUID1 = '00000000-0000-4000-8000-000000000001';
const UUID2 = '00000000-0000-4000-8000-000000000002';
const UUID3 = '00000000-0000-4000-8000-000000000003';
const UUID4 = '00000000-0000-4000-8000-000000000004';

import {
  RegisterCustomerSchema,
  CreateBookingSchema,
  BookingResponseSchema,
  CreateListingSchema,
  PaymentIntentResponseSchema,
} from '../index.js';

describe('RegisterCustomerSchema', () => {
  it('parses a valid customer registration', () => {
    const result = RegisterCustomerSchema.parse({
      email: 'alice@example.com',
      password: 'SecurePass1234!',
      firstName: 'Alice',
      lastName: 'Martin',
      locale: 'fr',
      acceptedTermsAt: '2026-05-09T12:00:00Z',
    });
    expect(result.email).toBe('alice@example.com');
  });

  it('rejects a too-short password', () => {
    expect(() =>
      RegisterCustomerSchema.parse({
        email: 'alice@example.com',
        password: 'short',
        firstName: 'Alice',
        lastName: 'Martin',
        locale: 'fr',
        acceptedTermsAt: '2026-05-09T12:00:00Z',
      }),
    ).toThrow();
  });

  it('rejects an invalid email', () => {
    expect(() =>
      RegisterCustomerSchema.parse({
        email: 'not-an-email',
        password: 'SecurePass1234!',
        firstName: 'Alice',
        lastName: 'Martin',
        locale: 'fr',
        acceptedTermsAt: '2026-05-09T12:00:00Z',
      }),
    ).toThrow();
  });
});

describe('CreateBookingSchema', () => {
  it('parses a valid booking request', () => {
    const result = CreateBookingSchema.parse({
      listingId: UUID1,
      requestedDate: '2026-06-15',
      totalAmount: { amount: 15000, currency: 'EUR' },
      notes: 'Vegetarian options required.',
    });
    expect(result.totalAmount.amount).toBe(15000);
  });

  it('rejects an invalid date format', () => {
    expect(() =>
      CreateBookingSchema.parse({
        listingId: UUID1,
        requestedDate: '15/06/2026', // wrong format
        totalAmount: { amount: 15000, currency: 'EUR' },
      }),
    ).toThrow();
  });

  it('rejects a float amount', () => {
    expect(() =>
      CreateBookingSchema.parse({
        listingId: UUID1,
        requestedDate: '2026-06-15',
        totalAmount: { amount: 150.5, currency: 'EUR' },
      }),
    ).toThrow();
  });
});

describe('BookingResponseSchema', () => {
  it('parses a valid booking response', () => {
    const result = BookingResponseSchema.parse({
      id: UUID1,
      status: 'pending_pro_acceptance',
      customerId: UUID2,
      providerId: UUID3,
      listingId: UUID4,
      requestedDate: '2026-06-15',
      totalAmount: { amount: 15000, currency: 'EUR' },
      createdAt: '2026-05-09T12:00:00Z',
    });
    expect(result.status).toBe('pending_pro_acceptance');
  });

  it('rejects an unknown status', () => {
    expect(() =>
      BookingResponseSchema.parse({
        id: UUID1,
        status: 'unknown_status',
        customerId: UUID2,
        providerId: UUID3,
        listingId: UUID4,
        requestedDate: '2026-06-15',
        totalAmount: { amount: 15000, currency: 'EUR' },
        createdAt: '2026-05-09T12:00:00Z',
      }),
    ).toThrow();
  });
});

describe('CreateListingSchema', () => {
  it('parses a valid listing', () => {
    const result = CreateListingSchema.parse({
      categorySlug: 'traiteur',
      translations: [
        {
          locale: 'fr',
          title: 'Traiteur mariage haut de gamme',
          description: 'Un traiteur spécialisé pour vos mariages. Cuisine gastronomique, service impeccable et présentation soignée pour faire de votre journée un souvenir inoubliable.',
          slug: 'traiteur-mariage-haut-de-gamme',
        },
      ],
      basePrice: { amount: 8000, currency: 'EUR' },
      photos: [
        'https://cdn.tukio.one/p1.jpg',
        'https://cdn.tukio.one/p2.jpg',
        'https://cdn.tukio.one/p3.jpg',
        'https://cdn.tukio.one/p4.jpg',
      ],
      deliveryRadius: 50,
    });
    expect(result.deliveryRadius).toBe(50);
  });

  it('rejects fewer than 4 photos', () => {
    expect(() =>
      CreateListingSchema.parse({
        categorySlug: 'traiteur',
        translations: [
          {
            locale: 'fr',
            title: 'Traiteur mariage haut de gamme',
            description: 'Un traiteur spécialisé pour vos mariages avec service complet et cuisine gastronomique.',
            slug: 'traiteur-mariage',
          },
        ],
        basePrice: { amount: 8000, currency: 'EUR' },
        photos: ['https://cdn.tukio.one/p1.jpg'], // only 1 photo
        deliveryRadius: 50,
      }),
    ).toThrow();
  });
});

describe('PaymentIntentResponseSchema', () => {
  it('parses a valid payment intent response', () => {
    const result = PaymentIntentResponseSchema.parse({
      paymentIntentId: 'pi_3NxABC1234567890',
      clientSecret: 'pi_3NxABC1234567890_secret_abc123',
      amount: { amount: 15000, currency: 'EUR' },
      status: 'requires_action',
    });
    expect(result.status).toBe('requires_action');
  });

  it('rejects an unknown payment status', () => {
    expect(() =>
      PaymentIntentResponseSchema.parse({
        paymentIntentId: 'pi_3NxABC1234567890',
        clientSecret: 'pi_3NxABC1234567890_secret_abc123',
        amount: { amount: 15000, currency: 'EUR' },
        status: 'unknown', // not in enum
      }),
    ).toThrow();
  });
});
