import { Siret } from './siret.value-object.js';
import { IdentityValidationException } from '../exception/identity-validation.exception.js';

describe('Siret value object', () => {
  it('accepts a Luhn-valid SIRET and exposes its components', () => {
    const s = Siret.create('35600000000048');
    expect(s.asString).toBe('35600000000048');
    expect(s.toString()).toBe('35600000000048');
    expect(s.siren).toBe('356000000');
    expect(s.nic).toBe('00048');
  });

  it('trims surrounding whitespace before validating', () => {
    const s = Siret.create('  35600000000048\n');
    expect(s.asString).toBe('35600000000048');
  });

  it('rejects a SIRET that fails the Luhn checksum', () => {
    expect(() => Siret.create('12345678901234')).toThrow(
      IdentityValidationException,
    );
  });

  it('rejects a SIRET shorter than 14 digits', () => {
    expect(() => Siret.create('123456789')).toThrow(
      IdentityValidationException,
    );
  });

  it('rejects a SIRET containing non-digit characters', () => {
    expect(() => Siret.create('3560000000004A')).toThrow(
      IdentityValidationException,
    );
  });

  it('rejects a non-string input', () => {
    expect(() => Siret.create(35600000000048 as unknown as string)).toThrow(
      IdentityValidationException,
    );
  });

  it('two SIRETs with the same value compare equal', () => {
    const a = Siret.create('35600000000048');
    const b = Siret.create('35600000000048');
    expect(a.equals(b)).toBe(true);
  });

  it('two different SIRETs do not compare equal', () => {
    const a = Siret.create('35600000000048');
    const b = Siret.create('44306184100039');
    expect(a.equals(b)).toBe(false);
  });
});
