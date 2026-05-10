import { describe, it, expect } from 'vitest';
import {
  buildUser,
  buildClient,
  buildPro,
  buildAdminModo,
  buildAdminSuper,
} from '../user.fixture.js';
import { buildListing } from '../listing.fixture.js';
import {
  buildBooking,
  buildBookingPending,
  buildBookingConfirmed,
  buildBookingCancelled,
  buildBookingCompleted,
} from '../booking.fixture.js';
import { buildOrder, buildOrderWithLineItems } from '../order.fixture.js';
import { buildPaymentIntent, buildRefund } from '../payment.fixture.js';
import { buildReview, buildReviewWithBreakdown } from '../review.fixture.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('User fixtures', () => {
  it('buildUser returns a valid user with all required fields', () => {
    const u = buildUser();
    expect(u.id).toMatch(UUID_RE);
    expect(u.keycloakUserId).toMatch(UUID_RE);
    expect(u.email).toContain('@');
    expect(u.firstName).toBeTruthy();
    expect(u.lastName).toBeTruthy();
    expect(u.role).toBe('client');
    expect(u.locale).toBe('fr');
    expect(u.deletedAt).toBeNull();
  });

  it('buildUser respects overrides', () => {
    const u = buildUser({ email: 'fixed@tukio.one', role: 'admin-modo' });
    expect(u.email).toBe('fixed@tukio.one');
    expect(u.role).toBe('admin-modo');
  });

  it('role variants set the right role', () => {
    expect(buildClient().role).toBe('client');
    expect(buildPro().role).toBe('pro');
    expect(buildAdminModo().role).toBe('admin-modo');
    expect(buildAdminSuper().role).toBe('admin-super');
  });
});

describe('Listing fixtures', () => {
  it('buildListing returns a published listing with photos', () => {
    const l = buildListing();
    expect(l.id).toMatch(UUID_RE);
    expect(l.basePrice.currency).toBe('EUR');
    expect(l.basePrice.amount).toBeGreaterThan(0);
    expect(l.photos.length).toBeGreaterThanOrEqual(4);
    expect(l.status).toBe('published');
  });

  it('respects overrides', () => {
    const l = buildListing({ status: 'draft', categorySlug: 'photographer' });
    expect(l.status).toBe('draft');
    expect(l.categorySlug).toBe('photographer');
  });
});

describe('Booking fixtures', () => {
  it('buildBooking defaults to pending_pro_acceptance', () => {
    const b = buildBooking();
    expect(b.status).toBe('pending_pro_acceptance');
    expect(b.requestedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(b.totalAmount.currency).toBe('EUR');
  });

  it('status variants', () => {
    expect(buildBookingPending().status).toBe('pending_pro_acceptance');
    expect(buildBookingConfirmed().status).toBe('confirmed');
    expect(buildBookingCancelled().status).toBe('cancelled');
    expect(buildBookingCompleted().status).toBe('completed');
  });
});

describe('Order fixtures', () => {
  it('buildOrder with no line items', () => {
    const o = buildOrder();
    expect(o.lineItems).toHaveLength(0);
  });

  it('buildOrderWithLineItems sums totals', () => {
    const o = buildOrderWithLineItems(3);
    expect(o.lineItems).toHaveLength(3);
    const computed = o.lineItems.reduce((acc, li) => acc + li.amount.amount, 0);
    expect(o.totalAmount.amount).toBe(computed);
  });
});

describe('Payment fixtures', () => {
  it('buildPaymentIntent has Stripe-shaped IDs', () => {
    const pi = buildPaymentIntent();
    expect(pi.stripePaymentIntentId).toMatch(/^pi_/);
    expect(pi.clientSecret).toContain(pi.stripePaymentIntentId);
    expect(pi.status).toBe('requires_action');
  });

  it('buildRefund defaults to customer_cancelled', () => {
    const r = buildRefund();
    expect(r.reason).toBe('customer_cancelled');
  });
});

describe('Review fixtures', () => {
  it('buildReview returns rating 1-5', () => {
    const r = buildReview();
    expect(r.rating).toBeGreaterThanOrEqual(1);
    expect(r.rating).toBeLessThanOrEqual(5);
  });

  it('buildReviewWithBreakdown has all 3 sub-criteria', () => {
    const r = buildReviewWithBreakdown();
    expect(r.breakdown.professionalism).toBeGreaterThanOrEqual(1);
    expect(r.breakdown.quality).toBeGreaterThanOrEqual(1);
    expect(r.breakdown.valueForMoney).toBeGreaterThanOrEqual(1);
  });
});
