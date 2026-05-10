import { describe, it, expect } from 'vitest';
import { isCompatibleVersion, migrateEventV1ToV2, parseEventType } from './event-versioning.js';

describe('parseEventType', () => {
  it('parses 4-segment event type with aggregate', () => {
    const result = parseEventType('catalog.listing.published.v1');
    expect(result).toEqual({
      service: 'catalog',
      aggregate: 'listing',
      event: 'published',
      version: 'v1',
    });
  });

  it('parses 3-segment event type without aggregate', () => {
    const result = parseEventType('booking.requested.v1');
    expect(result).toEqual({
      service: 'booking',
      event: 'requested',
      version: 'v1',
    });
  });

  it('parses v2 events', () => {
    const result = parseEventType('identity.user.registered.v2');
    expect(result.version).toBe('v2');
  });

  it('throws on malformed event types', () => {
    expect(() => parseEventType('too-short')).toThrow('Invalid eventType format');
    expect(() => parseEventType('admin.action.pro-verified.v3')).toThrow('Unsupported version');
  });
});

describe('isCompatibleVersion', () => {
  it('returns true for supported version', () => {
    expect(isCompatibleVersion('catalog.listing.published.v1', ['v1'])).toBe(true);
    expect(isCompatibleVersion('booking.requested.v2', ['v1', 'v2'])).toBe(true);
  });

  it('returns false for unsupported version', () => {
    expect(isCompatibleVersion('catalog.listing.published.v2', ['v1'])).toBe(false);
  });

  it('returns false for malformed event type', () => {
    expect(isCompatibleVersion('bad', ['v1', 'v2'])).toBe(false);
  });
});

describe('migrateEventV1ToV2', () => {
  it('applies the mapper function to the payload', () => {
    const v1 = { name: 'Alice', age: 30 };
    const result = migrateEventV1ToV2(v1, (p) => ({ ...p, displayName: p.name }));
    expect(result).toEqual({ name: 'Alice', age: 30, displayName: 'Alice' });
  });
});
