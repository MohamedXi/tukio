import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeAll } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EVENTS_DIR = join(__dirname, '..');

function loadSchema(relativePath: string) {
  return JSON.parse(readFileSync(join(EVENTS_DIR, relativePath), 'utf8')) as object;
}

let ajv: InstanceType<typeof Ajv2020>;

beforeAll(() => {
  ajv = new Ajv2020({ strict: true, allErrors: true });
  addFormats(ajv);
});

const BASE_ACTOR = {
  userId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  role: 'system',
  locale: 'fr',
};

const BASE_EVENT = {
  eventId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  eventVersion: 'v1',
  occurredAt: '2026-05-09T12:00:00Z',
  correlationId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  causationId: null,
  actor: BASE_ACTOR,
};

describe('listing-published.v1', () => {
  const schema = loadSchema('catalog/listing-published.v1.schema.json');

  it('validates a correct payload', () => {
    const event = {
      ...BASE_EVENT,
      eventType: 'catalog.listing.published.v1',
      aggregate: { type: 'listing', id: 'c3d4e5f6-a7b8-9012-cdef-012345678902' },
      payload: {
        listingId: 'c3d4e5f6-a7b8-9012-cdef-012345678902',
        proId: 'd4e5f6a7-b8c9-0123-def0-123456789012',
        locale: 'fr',
        publishedAt: '2026-05-09T11:00:00Z',
        categorySlug: 'traiteur-mariage',
        priceFrom: 15000,
      },
    };
    const validate = ajv.compile(schema);
    expect(validate(event)).toBe(true);
  });

  it('rejects when payload.priceFrom is missing', () => {
    const event = {
      ...BASE_EVENT,
      eventType: 'catalog.listing.published.v1',
      aggregate: { type: 'listing', id: 'c3d4e5f6-a7b8-9012-cdef-012345678902' },
      payload: {
        listingId: 'c3d4e5f6-a7b8-9012-cdef-012345678902',
        proId: 'd4e5f6a7-b8c9-0123-def0-123456789012',
        locale: 'fr',
        publishedAt: '2026-05-09T11:00:00Z',
        categorySlug: 'traiteur-mariage',
        // priceFrom missing
      },
    };
    const validate = ajv.compile(schema);
    expect(validate(event)).toBe(false);
    expect(validate.errors).not.toBeNull();
  });
});

describe('booking-requested.v1', () => {
  const schema = loadSchema('booking/booking-requested.v1.schema.json');

  it('validates a correct payload', () => {
    const event = {
      ...BASE_EVENT,
      eventType: 'booking.requested.v1',
      aggregate: { type: 'booking', id: 'e5f6a7b8-c9d0-1234-ef01-234567890123' },
      payload: {
        bookingId: 'e5f6a7b8-c9d0-1234-ef01-234567890123',
        customerId: 'f6a7b8c9-d0e1-2345-f012-345678901234',
        listingId: 'c3d4e5f6-a7b8-9012-cdef-012345678902',
        proId: 'd4e5f6a7-b8c9-0123-def0-123456789012',
        requestedDate: '2026-06-15',
        totalAmount: { amount: 15000, currency: 'EUR' },
      },
    };
    const validate = ajv.compile(schema);
    expect(validate(event)).toBe(true);
  });

  it('rejects when totalAmount.amount is a float', () => {
    const event = {
      ...BASE_EVENT,
      eventType: 'booking.requested.v1',
      aggregate: { type: 'booking', id: 'e5f6a7b8-c9d0-1234-ef01-234567890123' },
      payload: {
        bookingId: 'e5f6a7b8-c9d0-1234-ef01-234567890123',
        customerId: 'f6a7b8c9-d0e1-2345-f012-345678901234',
        listingId: 'c3d4e5f6-a7b8-9012-cdef-012345678902',
        proId: 'd4e5f6a7-b8c9-0123-def0-123456789012',
        requestedDate: '2026-06-15',
        totalAmount: { amount: 150.5, currency: 'EUR' }, // float instead of integer
      },
    };
    const validate = ajv.compile(schema);
    expect(validate(event)).toBe(false);
  });
});

describe('booking-accepted.v1', () => {
  const schema = loadSchema('booking/booking-accepted.v1.schema.json');

  it('validates a correct payload', () => {
    const event = {
      ...BASE_EVENT,
      eventType: 'booking.accepted.v1',
      aggregate: { type: 'booking', id: 'e5f6a7b8-c9d0-1234-ef01-234567890123' },
      payload: {
        bookingId: 'e5f6a7b8-c9d0-1234-ef01-234567890123',
        customerId: 'f6a7b8c9-d0e1-2345-f012-345678901234',
        proId: 'd4e5f6a7-b8c9-0123-def0-123456789012',
        acceptedAt: '2026-05-09T13:00:00Z',
        paymentIntentId: 'pi_3NxABC1234567890',
      },
    };
    const validate = ajv.compile(schema);
    expect(validate(event)).toBe(true);
  });

  it('rejects when bookingId is missing', () => {
    const event = {
      ...BASE_EVENT,
      eventType: 'booking.accepted.v1',
      aggregate: { type: 'booking', id: 'e5f6a7b8-c9d0-1234-ef01-234567890123' },
      payload: {
        // bookingId missing
        customerId: 'f6a7b8c9-d0e1-2345-f012-345678901234',
        proId: 'd4e5f6a7-b8c9-0123-def0-123456789012',
        acceptedAt: '2026-05-09T13:00:00Z',
        paymentIntentId: 'pi_3NxABC1234567890',
      },
    };
    const validate = ajv.compile(schema);
    expect(validate(event)).toBe(false);
  });
});

describe('payment-intent-captured.v1', () => {
  const schema = loadSchema('payment/payment-intent-captured.v1.schema.json');

  it('validates a correct payload', () => {
    const event = {
      ...BASE_EVENT,
      eventType: 'payment.intent.captured.v1',
      aggregate: { type: 'payment-intent', id: 'pi_3NxABC1234567890' },
      payload: {
        paymentIntentId: 'pi_3NxABC1234567890',
        bookingId: 'e5f6a7b8-c9d0-1234-ef01-234567890123',
        orderId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567891',
        amount: { amount: 15000, currency: 'EUR' },
        capturedAt: '2026-05-09T14:00:00Z',
        stripeChargeId: 'ch_3NxABC1234567890',
      },
    };
    const validate = ajv.compile(schema);
    expect(validate(event)).toBe(true);
  });

  it('rejects when amount.currency is not EUR', () => {
    const event = {
      ...BASE_EVENT,
      eventType: 'payment.intent.captured.v1',
      aggregate: { type: 'payment-intent', id: 'pi_3NxABC1234567890' },
      payload: {
        paymentIntentId: 'pi_3NxABC1234567890',
        bookingId: 'e5f6a7b8-c9d0-1234-ef01-234567890123',
        orderId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567891',
        amount: { amount: 15000, currency: 'USD' }, // USD not EUR
        capturedAt: '2026-05-09T14:00:00Z',
        stripeChargeId: 'ch_3NxABC1234567890',
      },
    };
    const validate = ajv.compile(schema);
    expect(validate(event)).toBe(false);
  });
});

describe('admin-action-pro-verified.v1', () => {
  const schema = loadSchema('admin/admin-action-pro-verified.v1.schema.json');

  it('validates a correct payload (approved)', () => {
    const event = {
      ...BASE_EVENT,
      eventType: 'admin.action.pro-verified.v1',
      aggregate: { type: 'admin-action', id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567892' },
      payload: {
        proId: 'd4e5f6a7-b8c9-0123-def0-123456789012',
        adminId: 'b2c3d4e5-f6a7-8901-bcde-f12345678903',
        decision: 'approved',
        reason: null,
        decidedAt: '2026-05-09T15:00:00Z',
      },
    };
    const validate = ajv.compile(schema);
    expect(validate(event)).toBe(true);
  });

  it('rejects when decision is not in enum', () => {
    const event = {
      ...BASE_EVENT,
      eventType: 'admin.action.pro-verified.v1',
      aggregate: { type: 'admin-action', id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567892' },
      payload: {
        proId: 'd4e5f6a7-b8c9-0123-def0-123456789012',
        adminId: 'b2c3d4e5-f6a7-8901-bcde-f12345678903',
        decision: 'pending', // not in enum
        reason: null,
        decidedAt: '2026-05-09T15:00:00Z',
      },
    };
    const validate = ajv.compile(schema);
    expect(validate(event)).toBe(false);
  });
});
