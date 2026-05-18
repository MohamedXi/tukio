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

describe('identity.user.registered.v1', () => {
  const schema = loadSchema('identity/user-registered.v1.schema.json');
  const validate = () => {
    const v = ajv.compile(schema);
    return v;
  };

  const validEvent = {
    ...BASE_EVENT,
    eventType: 'identity.user.registered.v1',
    aggregate: {
      type: 'user-profile',
      id: 'd4e5f6a7-b8c9-4012-9ef0-123456789012',
    },
    payload: {
      userId: 'd4e5f6a7-b8c9-4012-9ef0-123456789012',
      email: 'alice@example.com',
      firstName: 'Alice',
      lastName: 'Martin',
      role: 'client',
      locale: 'fr',
      acquisitionSource: 'google_ads',
      acquisitionMedium: 'cpc',
      acquisitionCampaign: 'spring2026',
      acquisitionContent: 'banner_v2',
      acquisitionTerm: 'event_marquees',
      acquisitionReferralId: null,
      marketingOptIn: true,
      registeredAt: '2026-05-15T12:00:00Z',
    },
  };

  it('validates a correct payload', () => {
    const v = validate();
    expect(v(validEvent)).toBe(true);
  });

  it('accepts null acquisition* fields (medium/campaign/content/term/referralId)', () => {
    const v = validate();
    const event = {
      ...validEvent,
      payload: {
        ...validEvent.payload,
        acquisitionMedium: null,
        acquisitionCampaign: null,
        acquisitionContent: null,
        acquisitionTerm: null,
        acquisitionReferralId: null,
      },
    };
    expect(v(event)).toBe(true);
  });

  it('rejects empty firstName (minLength: 1) — review patch P7', () => {
    const v = validate();
    const event = {
      ...validEvent,
      payload: { ...validEvent.payload, firstName: '' },
    };
    expect(v(event)).toBe(false);
  });

  it('rejects missing firstName (now required) — review patch P7', () => {
    const v = validate();
    const payloadWithoutFirst: Record<string, unknown> = { ...validEvent.payload };
    delete payloadWithoutFirst.firstName;
    const event = { ...validEvent, payload: payloadWithoutFirst };
    expect(v(event)).toBe(false);
  });

  it('rejects when role is not "client" (factory dédiée customer)', () => {
    const v = validate();
    const event = {
      ...validEvent,
      payload: { ...validEvent.payload, role: 'pro' },
    };
    expect(v(event)).toBe(false);
  });

  it('rejects when aggregate.type is not "user-profile"', () => {
    const v = validate();
    const event = {
      ...validEvent,
      aggregate: { type: 'user', id: validEvent.aggregate.id },
    };
    expect(v(event)).toBe(false);
  });

  it('rejects when acquisitionSource is not in the canonical enum', () => {
    const v = validate();
    const event = {
      ...validEvent,
      payload: { ...validEvent.payload, acquisitionSource: 'newsletter' },
    };
    expect(v(event)).toBe(false);
  });

  it('rejects when marketingOptIn is missing', () => {
    const v = validate();
    const payloadWithoutOptIn: Record<string, unknown> = { ...validEvent.payload };
    delete payloadWithoutOptIn.marketingOptIn;
    const event = { ...validEvent, payload: payloadWithoutOptIn };
    expect(v(event)).toBe(false);
  });
});

describe('identity.user.logged-in.v1 — JSON schema sync check (P16)', () => {
  it('schema payload properties match UserLoggedInV1Payload TS interface fields', () => {
    // Inspect schema JSON structure directly (no ajv.compile to avoid $id conflict
    // with the existing describe block below that also compiles this schema).
    const schema = loadSchema('identity/user-logged-in.v1.schema.json') as {
      properties?: { payload?: { properties?: Record<string, unknown> } };
    };
    const payloadProps = schema.properties?.payload?.properties ?? {};
    for (const field of ['userId', 'locale', 'role', 'ipHash', 'userAgentHash', 'loggedInAt']) {
      expect(payloadProps).toHaveProperty(field);
    }
    // Spec said `occurredAt` in payload — implementation uses `loggedInAt` (documented deviation P15)
    expect(payloadProps).not.toHaveProperty('occurredAt');
  });
});

describe('identity.user.logged-in.v1', () => {
  const schema = loadSchema('identity/user-logged-in.v1.schema.json');
  const compile = () => ajv.compile(schema);

  const validEvent = {
    ...BASE_EVENT,
    eventType: 'identity.user.logged-in.v1',
    aggregate: {
      type: 'user-profile',
      id: 'd4e5f6a7-b8c9-4012-9ef0-123456789012',
    },
    payload: {
      userId: 'd4e5f6a7-b8c9-4012-9ef0-123456789012',
      locale: 'fr',
      role: ['client'],
      ipHash: 'a'.repeat(64),
      userAgentHash: 'b'.repeat(64),
      loggedInAt: '2026-05-15T12:00:00Z',
    },
  };

  it('validates a correct payload', () => {
    expect(compile()(validEvent)).toBe(true);
  });

  it('accepts multi-role admin (admin-modo + admin-super)', () => {
    const event = {
      ...validEvent,
      payload: { ...validEvent.payload, role: ['admin-modo', 'admin-super'] },
    };
    expect(compile()(event)).toBe(true);
  });

  it('rejects empty role array (minItems: 1)', () => {
    const event = { ...validEvent, payload: { ...validEvent.payload, role: [] } };
    expect(compile()(event)).toBe(false);
  });

  it('rejects unknown role value', () => {
    const event = {
      ...validEvent,
      payload: { ...validEvent.payload, role: ['client', 'visitor'] },
    };
    expect(compile()(event)).toBe(false);
  });

  it('rejects duplicated role (uniqueItems)', () => {
    const event = {
      ...validEvent,
      payload: { ...validEvent.payload, role: ['client', 'client'] },
    };
    expect(compile()(event)).toBe(false);
  });

  it('rejects ipHash that is not a 64-char lowercase hex string', () => {
    const event = {
      ...validEvent,
      payload: { ...validEvent.payload, ipHash: 'not-a-sha256' },
    };
    expect(compile()(event)).toBe(false);
  });

  it('rejects when userAgentHash is missing', () => {
    const payloadMissing: Record<string, unknown> = { ...validEvent.payload };
    delete payloadMissing.userAgentHash;
    const event = { ...validEvent, payload: payloadMissing };
    expect(compile()(event)).toBe(false);
  });

  it('rejects when locale is not fr/en', () => {
    const event = { ...validEvent, payload: { ...validEvent.payload, locale: 'de' } };
    expect(compile()(event)).toBe(false);
  });
});

describe('notification.email.send.v1', () => {
  const schema = loadSchema('notification/email-send.v1.schema.json');
  const validate = () => ajv.compile(schema);

  const validEvent = {
    ...BASE_EVENT,
    eventType: 'notification.email.send.v1',
    aggregate: {
      type: 'user-profile',
      id: 'd4e5f6a7-b8c9-4012-9ef0-123456789012',
    },
    payload: {
      templateId: 'email-verify',
      locale: 'fr',
      to: {
        email: 'alice@example.com',
        userId: 'd4e5f6a7-b8c9-4012-9ef0-123456789012',
        name: 'Alice Martin',
      },
      params: {
        firstName: 'Alice',
        verifyUrl: 'https://tukio.one/fr/auth/email/verify?token=abc',
        expiresAt: '2026-05-22T12:00:00Z',
      },
    },
  };

  it('validates a correct email-verify payload', () => {
    const v = validate();
    expect(v(validEvent)).toBe(true);
  });

  it('accepts to.userId = null and omitted name', () => {
    const v = validate();
    const event = {
      ...validEvent,
      payload: {
        ...validEvent.payload,
        to: { email: 'anonymous@example.com', userId: null },
      },
    };
    expect(v(event)).toBe(true);
  });

  it('rejects an unknown templateId', () => {
    const v = validate();
    const event = {
      ...validEvent,
      payload: { ...validEvent.payload, templateId: 'marketing-blast' },
    };
    expect(v(event)).toBe(false);
  });

  it('rejects when locale is not fr/en', () => {
    const v = validate();
    const event = { ...validEvent, payload: { ...validEvent.payload, locale: 'de' } };
    expect(v(event)).toBe(false);
  });

  it('rejects when to.email is missing', () => {
    const v = validate();
    const event = {
      ...validEvent,
      payload: {
        ...validEvent.payload,
        to: { userId: validEvent.payload.to.userId },
      },
    };
    expect(v(event)).toBe(false);
  });

  it('accepts arbitrary params keys (additionalProperties: true)', () => {
    const v = validate();
    const event = {
      ...validEvent,
      payload: {
        ...validEvent.payload,
        params: { whateverKey: 'whateverValue', nested: { ok: true } },
      },
    };
    expect(v(event)).toBe(true);
  });

  it('rejects non-UUID aggregate.id (review patch P9 — alignment with user-registered.v1)', () => {
    const v = validate();
    const event = {
      ...validEvent,
      aggregate: { type: 'user-profile', id: 'not-a-uuid' },
    };
    expect(v(event)).toBe(false);
  });

  it('rejects unknown aggregate.type (review patch P9)', () => {
    const v = validate();
    const event = {
      ...validEvent,
      aggregate: {
        type: 'arbitrary',
        id: 'd4e5f6a7-b8c9-4012-9ef0-123456789012',
      },
    };
    expect(v(event)).toBe(false);
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
