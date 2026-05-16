import { PhoneNumber } from './phone-number.value-object.js';
import { IdentityValidationException } from '../exception/identity-validation.exception.js';

describe('PhoneNumber value object', () => {
  it('accepts the international +33 format and stores it unchanged', () => {
    expect(PhoneNumber.create('+33612345678').asString).toBe('+33612345678');
  });

  it('accepts the national 0XXX format and normalises to +33XXX', () => {
    expect(PhoneNumber.create('0612345678').asString).toBe('+33612345678');
  });

  it('trims surrounding whitespace', () => {
    expect(PhoneNumber.create('  0612345678  ').asString).toBe('+33612345678');
  });

  it('rejects a phone number with the wrong country code', () => {
    expect(() => PhoneNumber.create('+44612345678')).toThrow(
      IdentityValidationException,
    );
  });

  it('rejects a number that is too short', () => {
    expect(() => PhoneNumber.create('061234567')).toThrow(
      IdentityValidationException,
    );
  });

  it('rejects a number that is too long', () => {
    expect(() => PhoneNumber.create('06123456789')).toThrow(
      IdentityValidationException,
    );
  });

  it('rejects 0 followed by 0 (invalid trunk prefix)', () => {
    expect(() => PhoneNumber.create('0012345678')).toThrow(
      IdentityValidationException,
    );
  });

  it('rejects +33 followed by 0 (invalid trunk prefix)', () => {
    expect(() => PhoneNumber.create('+330612345678')).toThrow(
      IdentityValidationException,
    );
  });

  it('rejects a non-string input', () => {
    expect(() => PhoneNumber.create(612345678 as unknown as string)).toThrow(
      IdentityValidationException,
    );
  });

  it('two phone numbers in equivalent formats compare equal after normalisation', () => {
    expect(
      PhoneNumber.create('0612345678').equals(
        PhoneNumber.create('+33612345678'),
      ),
    ).toBe(true);
  });
});
