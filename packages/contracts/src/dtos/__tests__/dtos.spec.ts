import { describe, it, expect } from 'vitest';

// RFC 4122 v4 UUIDs (version=4, variant=8) — used as deterministic test fixtures
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

  it('rejects a too-short password with issue path "password" and code too_small', () => {
    const result = RegisterCustomerSchema.safeParse({
      email: 'alice@example.com',
      password: 'short',
      firstName: 'Alice',
      lastName: 'Martin',
      locale: 'fr',
      acceptedTermsAt: '2026-05-09T12:00:00Z',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const passwordIssue = result.error.issues.find((i) => i.path[0] === 'password');
      expect(passwordIssue).toBeDefined();
      expect(passwordIssue?.code).toBe('too_small');
    }
  });

  it('rejects an invalid email with path "email"', () => {
    const result = RegisterCustomerSchema.safeParse({
      email: 'not-an-email',
      password: 'SecurePass1234!',
      firstName: 'Alice',
      lastName: 'Martin',
      locale: 'fr',
      acceptedTermsAt: '2026-05-09T12:00:00Z',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const emailIssue = result.error.issues.find((i) => i.path[0] === 'email');
      expect(emailIssue).toBeDefined();
    }
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

  it('rejects an invalid date format with path "requestedDate"', () => {
    const result = CreateBookingSchema.safeParse({
      listingId: UUID1,
      requestedDate: '15/06/2026',
      totalAmount: { amount: 15000, currency: 'EUR' },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const dateIssue = result.error.issues.find((i) => i.path[0] === 'requestedDate');
      expect(dateIssue).toBeDefined();
    }
  });

  it('rejects a float amount with path "totalAmount.amount"', () => {
    const result = CreateBookingSchema.safeParse({
      listingId: UUID1,
      requestedDate: '2026-06-15',
      totalAmount: { amount: 150.5, currency: 'EUR' },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const amountIssue = result.error.issues.find(
        (i) => i.path[0] === 'totalAmount' && i.path[1] === 'amount',
      );
      expect(amountIssue).toBeDefined();
    }
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

  it('rejects an unknown status with path "status"', () => {
    const result = BookingResponseSchema.safeParse({
      id: UUID1,
      status: 'unknown_status',
      customerId: UUID2,
      providerId: UUID3,
      listingId: UUID4,
      requestedDate: '2026-06-15',
      totalAmount: { amount: 15000, currency: 'EUR' },
      createdAt: '2026-05-09T12:00:00Z',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const statusIssue = result.error.issues.find((i) => i.path[0] === 'status');
      expect(statusIssue).toBeDefined();
    }
  });

  it('rejects a malformed requestedDate (consistent with CreateBookingSchema)', () => {
    const result = BookingResponseSchema.safeParse({
      id: UUID1,
      status: 'pending_pro_acceptance',
      customerId: UUID2,
      providerId: UUID3,
      listingId: UUID4,
      requestedDate: '2026/06/15',
      totalAmount: { amount: 15000, currency: 'EUR' },
      createdAt: '2026-05-09T12:00:00Z',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const dateIssue = result.error.issues.find((i) => i.path[0] === 'requestedDate');
      expect(dateIssue).toBeDefined();
    }
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
          description:
            'Un traiteur spécialisé pour vos mariages. Cuisine gastronomique, service impeccable et présentation soignée pour faire de votre journée un souvenir inoubliable.',
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

  it('rejects fewer than 4 photos with path "photos" and code too_small', () => {
    const result = CreateListingSchema.safeParse({
      categorySlug: 'traiteur',
      translations: [
        {
          locale: 'fr',
          title: 'Traiteur mariage haut de gamme',
          description:
            'Un traiteur spécialisé pour vos mariages avec service complet et cuisine gastronomique.',
          slug: 'traiteur-mariage',
        },
      ],
      basePrice: { amount: 8000, currency: 'EUR' },
      photos: ['https://cdn.tukio.one/p1.jpg'],
      deliveryRadius: 50,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const photosIssue = result.error.issues.find((i) => i.path[0] === 'photos');
      expect(photosIssue).toBeDefined();
      expect(photosIssue?.code).toBe('too_small');
    }
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

  it('rejects an unknown payment status with path "status"', () => {
    const result = PaymentIntentResponseSchema.safeParse({
      paymentIntentId: 'pi_3NxABC1234567890',
      clientSecret: 'pi_3NxABC1234567890_secret_abc123',
      amount: { amount: 15000, currency: 'EUR' },
      status: 'unknown',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const statusIssue = result.error.issues.find((i) => i.path[0] === 'status');
      expect(statusIssue).toBeDefined();
    }
  });
});
