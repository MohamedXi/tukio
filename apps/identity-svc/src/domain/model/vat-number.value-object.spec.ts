import { VatNumber } from './vat-number.value-object.js';
import { IdentityValidationException } from '../exception/identity-validation.exception.js';

describe('VatNumber value object', () => {
  it('accepts a well-formed French VAT number', () => {
    const v = VatNumber.create('FR12345678901');
    expect(v.asString).toBe('FR12345678901');
  });

  it('normalises lowercase fr prefix to FR', () => {
    const v = VatNumber.create('fr12345678901');
    expect(v.asString).toBe('FR12345678901');
  });

  it('trims surrounding whitespace before validating', () => {
    const v = VatNumber.create('  FR12345678901  ');
    expect(v.asString).toBe('FR12345678901');
  });

  it('rejects a non-FR VAT number', () => {
    expect(() => VatNumber.create('DE12345678901')).toThrow(
      IdentityValidationException,
    );
  });

  it('rejects a VAT number with the wrong digit count', () => {
    expect(() => VatNumber.create('FR1234567890')).toThrow(
      IdentityValidationException,
    ); // 10 digits
    expect(() => VatNumber.create('FR123456789012')).toThrow(
      IdentityValidationException,
    ); // 12 digits
  });

  it('rejects a non-string input', () => {
    expect(() => VatNumber.create(12345678901 as unknown as string)).toThrow(
      IdentityValidationException,
    );
  });

  it('two VAT numbers with the same value compare equal', () => {
    expect(
      VatNumber.create('FR12345678901').equals(
        VatNumber.create('fr12345678901'),
      ),
    ).toBe(true);
  });
});
