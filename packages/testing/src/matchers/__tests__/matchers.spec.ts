import { describe, it, expect } from 'vitest';
import '../setup.js';

const successEnvelope = {
  method: 'GET',
  code: 200,
  data: { id: 'abc', email: 'jane@tukio.one' },
  meta: { timestamp: '2026-05-10T10:00:00Z', correlationId: 'c', locale: 'fr' },
};

const errorEnvelope = {
  method: 'GET',
  code: 404,
  error: {
    type: 'https://tukio.one/errors/user-not-found',
    title: 'User profile not found',
    detail: 'Not found',
    instance: '/v1/users/abc',
    tukioCode: 'USER-NOT-FOUND-001',
  },
  meta: { timestamp: '2026-05-10T10:00:00Z', correlationId: 'c', locale: 'fr' },
};

describe('toMatchSuccessEnvelope', () => {
  it('matches a SuccessEnvelope shape with no expected partial', () => {
    expect(successEnvelope).toMatchSuccessEnvelope();
  });

  it('matches a SuccessEnvelope with expected data partial', () => {
    expect(successEnvelope).toMatchSuccessEnvelope({ data: { id: 'abc' } });
  });

  it('matches a SuccessEnvelope with expected code', () => {
    expect(successEnvelope).toMatchSuccessEnvelope({ code: 200 });
  });

  it('rejects a non-envelope value', () => {
    expect(() => expect({ foo: 'bar' }).toMatchSuccessEnvelope()).toThrow();
  });

  it('rejects an ErrorEnvelope', () => {
    expect(() => expect(errorEnvelope).toMatchSuccessEnvelope()).toThrow();
  });

  it('rejects when expected data does not match', () => {
    expect(() =>
      expect(successEnvelope).toMatchSuccessEnvelope({ data: { id: 'wrong' } }),
    ).toThrow();
  });

  it('rejects when expected code does not match', () => {
    expect(() => expect(successEnvelope).toMatchSuccessEnvelope({ code: 404 })).toThrow();
  });
});

describe('toMatchErrorEnvelope', () => {
  it('matches an ErrorEnvelope with tukioCode + httpStatus', () => {
    expect(errorEnvelope).toMatchErrorEnvelope({
      tukioCode: 'USER-NOT-FOUND-001',
      httpStatus: 404,
    });
  });

  it('matches without httpStatus', () => {
    expect(errorEnvelope).toMatchErrorEnvelope({ tukioCode: 'USER-NOT-FOUND-001' });
  });

  it('rejects on wrong tukioCode', () => {
    expect(() => expect(errorEnvelope).toMatchErrorEnvelope({ tukioCode: 'OTHER' })).toThrow();
  });

  it('rejects on wrong httpStatus', () => {
    expect(() =>
      expect(errorEnvelope).toMatchErrorEnvelope({
        tukioCode: 'USER-NOT-FOUND-001',
        httpStatus: 500,
      }),
    ).toThrow();
  });

  it('rejects a SuccessEnvelope', () => {
    expect(() => expect(successEnvelope).toMatchErrorEnvelope({ tukioCode: 'X' })).toThrow();
  });
});

describe('toBeUuid', () => {
  it('matches a v4 UUID', () => {
    expect('11111111-1111-4111-a111-111111111111').toBeUuid();
  });

  it('matches a real generated UUID', () => {
    expect(crypto.randomUUID()).toBeUuid();
  });

  it('rejects non-UUID strings', () => {
    expect(() => expect('not-a-uuid').toBeUuid()).toThrow();
    expect(() => expect('').toBeUuid()).toThrow();
  });

  it('rejects non-strings', () => {
    expect(() => expect(42).toBeUuid()).toThrow();
    expect(() => expect(null).toBeUuid()).toThrow();
  });
});

describe('toBeIsoDate', () => {
  it('matches a typical Date.toISOString() output', () => {
    expect(new Date().toISOString()).toBeIsoDate();
  });

  it('matches with explicit timezone offset', () => {
    expect('2026-05-10T10:00:00+02:00').toBeIsoDate();
  });

  it('matches without milliseconds', () => {
    expect('2026-05-10T10:00:00Z').toBeIsoDate();
  });

  it('rejects YYYY-MM-DD only', () => {
    expect(() => expect('2026-05-10').toBeIsoDate()).toThrow();
  });

  it('rejects garbage strings', () => {
    expect(() => expect('not-a-date').toBeIsoDate()).toThrow();
  });

  it('rejects unparseable dates that match the regex shape', () => {
    expect(() => expect('2026-13-99T25:99:99Z').toBeIsoDate()).toThrow();
  });
});
