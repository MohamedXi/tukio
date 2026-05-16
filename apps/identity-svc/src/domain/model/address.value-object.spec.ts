import { Address, type AddressProps } from './address.value-object.js';
import { IdentityValidationException } from '../exception/identity-validation.exception.js';

const VALID: AddressProps = {
  street: '9 rue du Colonel Pierre Avia',
  postalCode: '75015',
  city: 'Paris',
  country: 'FR',
};

describe('Address value object', () => {
  it('accepts a valid French address', () => {
    const a = Address.create(VALID);
    expect(a.street).toBe('9 rue du Colonel Pierre Avia');
    expect(a.postalCode).toBe('75015');
    expect(a.city).toBe('Paris');
    expect(a.country).toBe('FR');
  });

  it('trims surrounding whitespace from street, city, and postal code', () => {
    const a = Address.create({
      street: '  rue de Rivoli  ',
      postalCode: '  75001  ',
      city: '  Paris  ',
      country: 'FR',
    });
    expect(a.street).toBe('rue de Rivoli');
    expect(a.postalCode).toBe('75001');
    expect(a.city).toBe('Paris');
  });

  it('rejects an empty street', () => {
    expect(() => Address.create({ ...VALID, street: '' })).toThrow(
      IdentityValidationException,
    );
  });

  it('rejects a 4-digit postal code', () => {
    expect(() => Address.create({ ...VALID, postalCode: '1300' })).toThrow(
      IdentityValidationException,
    );
  });

  it('rejects a postal code with letters', () => {
    expect(() => Address.create({ ...VALID, postalCode: 'A0001' })).toThrow(
      IdentityValidationException,
    );
  });

  it('rejects an empty city', () => {
    expect(() => Address.create({ ...VALID, city: '' })).toThrow(
      IdentityValidationException,
    );
  });

  it('rejects any country other than FR at MVP', () => {
    expect(() =>
      Address.create({ ...VALID, country: 'BE' as unknown as 'FR' }),
    ).toThrow(IdentityValidationException);
  });

  it('two addresses with identical fields compare equal', () => {
    expect(Address.create(VALID).equals(Address.create(VALID))).toBe(true);
  });
});
