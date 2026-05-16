import { describe, it, expect } from 'vitest';
import {
  RegisterProInputSchema,
  type RegisterProInputDto,
  RegisterProResponseSchema,
  ProAddressSchema,
} from '../register-pro.dto.js';

const validInput: RegisterProInputDto = {
  email: 'contact@acme.fr',
  password: 'SecurePass1234!',
  firstName: 'Alice',
  lastName: 'Martin',
  locale: 'fr',
  acceptTerms: true,
  acceptMarketing: false,
  companyName: 'Acme SAS',
  siret: '35600000000048', // LA POSTE — Luhn-valid, INSEE active
  address: {
    street: '9 rue du Colonel Pierre Avia',
    postalCode: '75015',
    city: 'Paris',
    country: 'FR',
  },
  contactPhone: '+33612345678',
};

describe('RegisterProInputSchema', () => {
  it('parses a valid pro registration payload', () => {
    const result = RegisterProInputSchema.parse(validInput);
    expect(result.email).toBe('contact@acme.fr');
    expect(result.companyName).toBe('Acme SAS');
    expect(result.siret).toBe('35600000000048');
  });

  it('defaults acceptMarketing to false when omitted', () => {
    // Build a copy without the optional field rather than destructuring an
    // unused variable (eslint no-unused-vars).
    const rest: Partial<RegisterProInputDto> = { ...validInput };
    delete rest.acceptMarketing;
    const result = RegisterProInputSchema.parse(rest);
    expect(result.acceptMarketing).toBe(false);
  });

  it('accepts an optional vatNumber with a numeric check key (FR12345678901)', () => {
    const result = RegisterProInputSchema.parse({ ...validInput, vatNumber: 'FR12345678901' });
    expect(result.vatNumber).toBe('FR12345678901');
  });

  it('accepts a vatNumber with an alphabetic check key (FRQU345678901)', () => {
    const result = RegisterProInputSchema.parse({ ...validInput, vatNumber: 'FRQU345678901' });
    expect(result.vatNumber).toBe('FRQU345678901');
  });

  it('normalises vatNumber to uppercase', () => {
    const result = RegisterProInputSchema.parse({ ...validInput, vatNumber: 'fr12345678901' });
    expect(result.vatNumber).toBe('FR12345678901');
  });

  it('rejects a vatNumber that does not match the FR + check key + SIREN pattern', () => {
    const result = RegisterProInputSchema.safeParse({ ...validInput, vatNumber: 'DE1234567890' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'vatNumber')).toBe(true);
    }
  });

  it('accepts an optional acquisition object', () => {
    const result = RegisterProInputSchema.parse({
      ...validInput,
      acquisition: { source: 'google_ads', campaign: 'pro-spring' },
    });
    expect(result.acquisition?.source).toBe('google_ads');
    expect(result.acquisition?.campaign).toBe('pro-spring');
  });

  describe('SIRET validation', () => {
    it('rejects a SIRET that is not 14 digits', () => {
      const result = RegisterProInputSchema.safeParse({ ...validInput, siret: '123' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path[0] === 'siret')).toBe(true);
      }
    });

    it('rejects a SIRET that fails the Luhn checksum', () => {
      const result = RegisterProInputSchema.safeParse({ ...validInput, siret: '12345678901234' });
      expect(result.success).toBe(false);
      if (!result.success) {
        const siretIssues = result.error.issues.filter((i) => i.path[0] === 'siret');
        expect(siretIssues.some((i) => /Luhn/i.test(i.message))).toBe(true);
      }
    });

    it('accepts a Luhn-valid SIRET (existence/active is checked server-side, not here)', () => {
      const result = RegisterProInputSchema.safeParse({
        ...validInput,
        siret: '44306184100039',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('Phone validation', () => {
    it.each([
      ['+33612345678', 'international +33 format'],
      ['0612345678', 'national 0 format'],
    ])('accepts %s — %s', (phone) => {
      const result = RegisterProInputSchema.safeParse({ ...validInput, contactPhone: phone });
      expect(result.success).toBe(true);
    });

    it.each([
      ['+44612345678', 'wrong country code'],
      ['06123456', 'too short'],
      ['001234567890', 'leading 0 followed by 0 (invalid trunk prefix)'],
      ['+330612345678', '+33 followed by leading 0'],
    ])('rejects %s — %s', (phone) => {
      const result = RegisterProInputSchema.safeParse({ ...validInput, contactPhone: phone });
      expect(result.success).toBe(false);
    });
  });

  describe('Postal code validation', () => {
    it('accepts 5-digit French postal codes', () => {
      const result = RegisterProInputSchema.parse({
        ...validInput,
        address: { ...validInput.address, postalCode: '13001' },
      });
      expect(result.address.postalCode).toBe('13001');
    });

    it('rejects a 4-digit postal code', () => {
      const result = RegisterProInputSchema.safeParse({
        ...validInput,
        address: { ...validInput.address, postalCode: '1300' },
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Country restriction (MVP France only)', () => {
    it('rejects any country other than FR at MVP', () => {
      // The schema is typed `country: 'FR'`, so we cast through `unknown` to
      // exercise the runtime guard against malformed payloads coming over HTTP.
      const result = RegisterProInputSchema.safeParse({
        ...validInput,
        address: { ...validInput.address, country: 'BE' },
      } as unknown);
      expect(result.success).toBe(false);
    });
  });
});

describe('ProAddressSchema', () => {
  it('parses a valid French address standalone', () => {
    const result = ProAddressSchema.parse(validInput.address);
    expect(result.country).toBe('FR');
  });
});

describe('RegisterProResponseSchema', () => {
  it('parses a valid response payload', () => {
    const result = RegisterProResponseSchema.parse({
      userId: '00000000-0000-4000-8000-000000000001',
      proProfileId: '00000000-0000-4000-8000-000000000002',
      requiresAdminReview: true,
      requiresEmailVerification: true,
    });
    expect(result.userId).toBe('00000000-0000-4000-8000-000000000001');
    expect(result.requiresAdminReview).toBe(true);
  });

  it('rejects a response missing the proProfileId', () => {
    const result = RegisterProResponseSchema.safeParse({
      userId: '00000000-0000-4000-8000-000000000001',
      requiresAdminReview: true,
      requiresEmailVerification: true,
    });
    expect(result.success).toBe(false);
  });
});
