/**
 * Coverage for the runtime-bearing exports across `@tukio/contracts`.
 *
 * Most files in this package are TypeScript type-only (interfaces, type
 * aliases, `export type` barrels) which compile to empty JS modules and
 * cannot meaningfully be unit-tested. They are excluded from coverage in
 * `vitest.config.ts`.
 *
 * The actual runtime surface is:
 *   - 5 event `_TYPE` constants (one per event file)
 *   - The `DomainException` abstract base class (exceptions/domain.exception.ts)
 *   - Barrel modules that re-export the above at runtime
 *
 * This spec imports them through their public subpaths (mirroring how
 * service code consumes them) and validates each.
 */
import { describe, it, expect } from 'vitest';

import { BOOKING_REQUESTED_V1_TYPE } from '../events/booking/booking-requested.v1.js';
import { BOOKING_ACCEPTED_V1_TYPE } from '../events/booking/booking-accepted.v1.js';
import { LISTING_PUBLISHED_V1_TYPE } from '../events/catalog/listing-published.v1.js';
import { PAYMENT_INTENT_CAPTURED_V1_TYPE } from '../events/payment/payment-intent-captured.v1.js';
import { ADMIN_ACTION_PRO_VERIFIED_V1_TYPE } from '../events/admin/admin-action-pro-verified.v1.js';
import { USER_REGISTERED_V1_TYPE } from '../events/identity/user-registered.v1.js';
import { PRO_REGISTERED_V1_TYPE } from '../events/identity/pro-registered.v1.js';
import { EMAIL_SEND_V1_TYPE, EMAIL_TEMPLATE_IDS } from '../events/notification/email-send.v1.js';

import { DomainException } from '../exceptions/domain.exception.js';
import { DomainException as DomainExceptionFromBarrel } from '../exceptions/index.js';
import { DomainException as DomainExceptionFromRoot } from '../index.js';

describe('event _TYPE constants', () => {
  it('BOOKING_REQUESTED_V1_TYPE matches the canonical event name', () => {
    expect(BOOKING_REQUESTED_V1_TYPE).toBe('booking.requested.v1');
  });

  it('BOOKING_ACCEPTED_V1_TYPE matches the canonical event name', () => {
    expect(BOOKING_ACCEPTED_V1_TYPE).toBe('booking.accepted.v1');
  });

  it('LISTING_PUBLISHED_V1_TYPE matches the canonical event name', () => {
    expect(LISTING_PUBLISHED_V1_TYPE).toBe('catalog.listing.published.v1');
  });

  it('PAYMENT_INTENT_CAPTURED_V1_TYPE matches the canonical event name', () => {
    expect(PAYMENT_INTENT_CAPTURED_V1_TYPE).toBe('payment.intent.captured.v1');
  });

  it('ADMIN_ACTION_PRO_VERIFIED_V1_TYPE matches the canonical event name', () => {
    expect(ADMIN_ACTION_PRO_VERIFIED_V1_TYPE).toBe('admin.action.pro-verified.v1');
  });

  it('USER_REGISTERED_V1_TYPE matches the canonical event name', () => {
    expect(USER_REGISTERED_V1_TYPE).toBe('identity.user.registered.v1');
  });

  it('PRO_REGISTERED_V1_TYPE matches the canonical event name', () => {
    expect(PRO_REGISTERED_V1_TYPE).toBe('identity.pro.registered.v1');
  });

  it('EMAIL_SEND_V1_TYPE matches the canonical event name', () => {
    expect(EMAIL_SEND_V1_TYPE).toBe('notification.email.send.v1');
  });

  it('EMAIL_TEMPLATE_IDS lists the MVP transactional templates', () => {
    expect(EMAIL_TEMPLATE_IDS).toContain('email-verify');
    expect(EMAIL_TEMPLATE_IDS).toContain('password-reset');
    expect(EMAIL_TEMPLATE_IDS).toContain('booking-confirmed');
    expect(EMAIL_TEMPLATE_IDS).toContain('pro-pending-admin-review');
    expect(EMAIL_TEMPLATE_IDS.length).toBeGreaterThanOrEqual(10);
  });

  it('all event types follow the <domain>.<entity>.<verb>.v<n> convention', () => {
    const allTypes = [
      BOOKING_REQUESTED_V1_TYPE,
      BOOKING_ACCEPTED_V1_TYPE,
      LISTING_PUBLISHED_V1_TYPE,
      PAYMENT_INTENT_CAPTURED_V1_TYPE,
      ADMIN_ACTION_PRO_VERIFIED_V1_TYPE,
      USER_REGISTERED_V1_TYPE,
      PRO_REGISTERED_V1_TYPE,
      EMAIL_SEND_V1_TYPE,
    ];
    const NATS_NAMING = /^[a-z]+(?:\.[a-z][a-z0-9-]*)+\.v\d+$/;
    for (const type of allTypes) {
      expect(type).toMatch(NATS_NAMING);
    }
  });
});

describe('DomainException base class', () => {
  // Concrete subclass used to exercise the abstract base.
  class TestException extends DomainException {
    readonly tukioCode = 'TEST-EXCEPTION-001';
    readonly httpStatus = 422;
    readonly title = 'Test exception';
  }

  it('is exported from the direct subpath', () => {
    const ex = new TestException('boom');
    expect(ex).toBeInstanceOf(DomainException);
  });

  it('is exported from the exceptions barrel', () => {
    class FromBarrel extends DomainExceptionFromBarrel {
      readonly tukioCode = 'BARREL-001';
      readonly httpStatus = 400;
      readonly title = 'Barrel test';
    }
    const ex = new FromBarrel('via barrel');
    expect(ex).toBeInstanceOf(DomainExceptionFromBarrel);
    expect(ex).toBeInstanceOf(Error);
  });

  it('is exported from the root barrel', () => {
    class FromRoot extends DomainExceptionFromRoot {
      readonly tukioCode = 'ROOT-001';
      readonly httpStatus = 500;
      readonly title = 'Root test';
    }
    const ex = new FromRoot('via root');
    expect(ex).toBeInstanceOf(DomainExceptionFromRoot);
  });

  it('preserves the message passed to super()', () => {
    const ex = new TestException('detailed reason');
    expect(ex.message).toBe('detailed reason');
  });

  it('sets the .name to the concrete subclass name (not "Error")', () => {
    const ex = new TestException('boom');
    expect(ex.name).toBe('TestException');
  });

  it('restores the prototype chain so instanceof works after JSON round-trips', () => {
    // Object.setPrototypeOf inside the base constructor is critical for
    // TypeScript-emitted ES2022+ classes; without it `instanceof` returns
    // false on Node when the class is downleveled.
    const ex = new TestException('boom');
    expect(Object.getPrototypeOf(ex)).toBe(TestException.prototype);
  });

  it('exposes the abstract metadata fields on the concrete subclass', () => {
    const ex = new TestException('boom');
    expect(ex.tukioCode).toBe('TEST-EXCEPTION-001');
    expect(ex.httpStatus).toBe(422);
    expect(ex.title).toBe('Test exception');
  });

  it('can be thrown and caught as a plain Error', () => {
    expect(() => {
      throw new TestException('thrown');
    }).toThrow(Error);
  });
});
