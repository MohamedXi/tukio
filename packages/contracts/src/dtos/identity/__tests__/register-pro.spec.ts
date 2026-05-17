import { describe, it, expect } from 'vitest';
import {
  RegisterProInputSchema,
  type RegisterProInputDto,
  RegisterProResponseSchema,
  ProAddressSchema,
  ServiceZoneSchema,
  LegalFormEnum,
  VatStatusEnum,
  CategoryEnum,
} from '../register-pro.dto.js';

const validInput: RegisterProInputDto = {
  email: 'contact@acme.fr',
  firstName: 'Alice',
  lastName: 'Martin',
  locale: 'fr',
  dateOfBirth: '1989-09-14',
  contactPhone: '+33612345678',
  acceptMarketing: false,
  companyName: 'Acme SAS',
  siret: '35600000000048', // LA POSTE — Luhn-valid, INSEE active
  legalForm: 'SAS_SASU',
  vatStatus: 'vat_registered',
  categories: ['tents_marquees'],
  serviceZone: { city: 'Saint-Herblain', radiusKm: 80 },
  address: {
    street: '9 rue du Colonel Pierre Avia',
    postalCode: '75015',
    city: 'Paris',
    country: 'FR',
  },
  acceptCharter: true,
};

describe('RegisterProInputSchema (Story 1.3a-bis — conversion wizard payload)', () => {
  it('parses a valid conversion payload', () => {
    const result = RegisterProInputSchema.parse(validInput);
    expect(result.email).toBe('contact@acme.fr');
    expect(result.companyName).toBe('Acme SAS');
    expect(result.siret).toBe('35600000000048');
    expect(result.dateOfBirth).toBe('1989-09-14');
    expect(result.legalForm).toBe('SAS_SASU');
    expect(result.vatStatus).toBe('vat_registered');
    expect(result.categories).toEqual(['tents_marquees']);
    expect(result.serviceZone).toEqual({ city: 'Saint-Herblain', radiusKm: 80 });
    expect(result.acceptCharter).toBe(true);
  });

  it('defaults acceptMarketing to false when omitted', () => {
    const rest: Partial<RegisterProInputDto> = { ...validInput };
    delete rest.acceptMarketing;
    const result = RegisterProInputSchema.parse(rest);
    expect(result.acceptMarketing).toBe(false);
  });

  it('rejects payloads carrying the removed `password` field implicitly — strip silently (Zod default)', () => {
    // password is NOT in the schema anymore. Zod 4 default behavior is to strip
    // unknown keys, not error on them. This test pins the contract: payload still
    // parses, password silently dropped.
    const result = RegisterProInputSchema.safeParse({
      ...validInput,
      password: 'should-be-stripped',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect('password' in result.data).toBe(false);
    }
  });

  it('rejects payloads carrying the removed `acceptTerms` field implicitly — same behavior', () => {
    const result = RegisterProInputSchema.safeParse({ ...validInput, acceptTerms: true });
    expect(result.success).toBe(true);
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
      const result = RegisterProInputSchema.safeParse({
        ...validInput,
        address: { ...validInput.address, country: 'BE' },
      } as unknown);
      expect(result.success).toBe(false);
    });
  });

  describe('Date of birth validation (NEW Story 1.3a-bis)', () => {
    it('accepts an ISO date for an adult (≥ 18 yo)', () => {
      const result = RegisterProInputSchema.parse({ ...validInput, dateOfBirth: '2000-01-01' });
      expect(result.dateOfBirth).toBe('2000-01-01');
    });

    it('rejects a non-ISO date format', () => {
      const result = RegisterProInputSchema.safeParse({
        ...validInput,
        dateOfBirth: '14/09/1989',
      });
      expect(result.success).toBe(false);
    });

    it('rejects an impossible calendar date (2026-02-31 round-trips)', () => {
      const result = RegisterProInputSchema.safeParse({
        ...validInput,
        dateOfBirth: '2026-02-31',
      });
      expect(result.success).toBe(false);
    });

    it('rejects a future date', () => {
      const future = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      const iso = future.toISOString().slice(0, 10);
      const result = RegisterProInputSchema.safeParse({ ...validInput, dateOfBirth: iso });
      expect(result.success).toBe(false);
    });

    it('rejects a Pro under 18 years old', () => {
      // Use a millisecond offset rather than a day-number increment to avoid
      // month-end overflow: Date.UTC(year-18, month, lastDay+1) silently rolls
      // into the next month, making the fixture ≥1 day too young rather than
      // exactly one day too young. Using "tomorrow UTC midnight" via ms is safe.
      const tomorrowUTCMs = Date.now() + 24 * 60 * 60 * 1000;
      const tomorrow = new Date(tomorrowUTCMs);
      const oneYearAgo18 = new Date(
        Date.UTC(tomorrow.getUTCFullYear() - 18, tomorrow.getUTCMonth(), tomorrow.getUTCDate()),
      );
      const iso = oneYearAgo18.toISOString().slice(0, 10);
      const result = RegisterProInputSchema.safeParse({ ...validInput, dateOfBirth: iso });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some(
            (i) => i.path[0] === 'dateOfBirth' && /at least 18/iu.test(i.message),
          ),
        ).toBe(true);
      }
    });

    it('accepts a Pro who turns 18 exactly today', () => {
      const today = new Date();
      const exactly18 = new Date(
        Date.UTC(today.getUTCFullYear() - 18, today.getUTCMonth(), today.getUTCDate()),
      );
      const iso = exactly18.toISOString().slice(0, 10);
      const result = RegisterProInputSchema.safeParse({ ...validInput, dateOfBirth: iso });
      expect(result.success).toBe(true);
    });
  });

  describe('Legal form validation (NEW)', () => {
    it.each(['SAS_SASU', 'EURL_SARL', 'MICRO_ENTREPRISE', 'AUTO_ENTREPRENEUR', 'ASSO_1901'])(
      'accepts %s',
      (legalForm) => {
        const result = RegisterProInputSchema.safeParse({ ...validInput, legalForm });
        expect(result.success).toBe(true);
      },
    );

    it('rejects unknown legal form', () => {
      const result = RegisterProInputSchema.safeParse({ ...validInput, legalForm: 'SCI' });
      expect(result.success).toBe(false);
    });
  });

  describe('VAT status + cross-field rule (NEW)', () => {
    it('accepts vatStatus vat_registered with a vatNumber', () => {
      const result = RegisterProInputSchema.safeParse({
        ...validInput,
        vatStatus: 'vat_registered',
        vatNumber: 'FR12345678901',
      });
      expect(result.success).toBe(true);
    });

    it('accepts vatStatus vat_registered WITHOUT a vatNumber (registered but intracom number pending)', () => {
      const noVat: Partial<RegisterProInputDto> = { ...validInput, vatStatus: 'vat_registered' };
      delete noVat.vatNumber;
      const result = RegisterProInputSchema.safeParse(noVat);
      expect(result.success).toBe(true);
    });

    it('accepts vatStatus vat_exempt without a vatNumber', () => {
      const result = RegisterProInputSchema.safeParse({
        ...validInput,
        vatStatus: 'vat_exempt',
      });
      expect(result.success).toBe(true);
    });

    it('rejects vatStatus vat_exempt WITH a vatNumber (cross-field rule)', () => {
      const result = RegisterProInputSchema.safeParse({
        ...validInput,
        vatStatus: 'vat_exempt',
        vatNumber: 'FR12345678901',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some(
            (i) =>
              i.path[0] === 'vatNumber' &&
              /must be omitted when vatStatus is vat_exempt/iu.test(i.message),
          ),
        ).toBe(true);
      }
    });

    it('rejects unknown vatStatus value', () => {
      const result = RegisterProInputSchema.safeParse({ ...validInput, vatStatus: 'unknown' });
      expect(result.success).toBe(false);
    });
  });

  describe('Categories validation (NEW)', () => {
    it('accepts 1 category', () => {
      const result = RegisterProInputSchema.safeParse({
        ...validInput,
        categories: ['event_furniture'],
      });
      expect(result.success).toBe(true);
    });

    it('accepts 2 categories', () => {
      const result = RegisterProInputSchema.safeParse({
        ...validInput,
        categories: ['tents_marquees', 'event_furniture'],
      });
      expect(result.success).toBe(true);
    });

    it('rejects 0 categories', () => {
      const result = RegisterProInputSchema.safeParse({ ...validInput, categories: [] });
      expect(result.success).toBe(false);
    });

    it('rejects 3 categories (max 2)', () => {
      const result = RegisterProInputSchema.safeParse({
        ...validInput,
        categories: ['tents_marquees', 'event_furniture', 'decoration'],
      });
      expect(result.success).toBe(false);
    });

    it('rejects unknown category', () => {
      const result = RegisterProInputSchema.safeParse({
        ...validInput,
        categories: ['unknown_cat'],
      });
      expect(result.success).toBe(false);
    });

    it('rejects duplicate categories (same value twice)', () => {
      const result = RegisterProInputSchema.safeParse({
        ...validInput,
        categories: ['tents_marquees', 'tents_marquees'],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => /unique/iu.test(i.message))).toBe(true);
      }
    });
  });

  describe('Service zone validation (NEW)', () => {
    it('accepts radiusKm at lower bound (1)', () => {
      const result = RegisterProInputSchema.safeParse({
        ...validInput,
        serviceZone: { city: 'Nantes', radiusKm: 1 },
      });
      expect(result.success).toBe(true);
    });

    it('accepts radiusKm at upper bound (200)', () => {
      const result = RegisterProInputSchema.safeParse({
        ...validInput,
        serviceZone: { city: 'Nantes', radiusKm: 200 },
      });
      expect(result.success).toBe(true);
    });

    it('rejects radiusKm 0', () => {
      const result = RegisterProInputSchema.safeParse({
        ...validInput,
        serviceZone: { city: 'Nantes', radiusKm: 0 },
      });
      expect(result.success).toBe(false);
    });

    it('rejects radiusKm 201', () => {
      const result = RegisterProInputSchema.safeParse({
        ...validInput,
        serviceZone: { city: 'Nantes', radiusKm: 201 },
      });
      expect(result.success).toBe(false);
    });

    it('rejects negative radiusKm', () => {
      const result = RegisterProInputSchema.safeParse({
        ...validInput,
        serviceZone: { city: 'Nantes', radiusKm: -10 },
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty city', () => {
      const result = RegisterProInputSchema.safeParse({
        ...validInput,
        serviceZone: { city: '', radiusKm: 80 },
      });
      expect(result.success).toBe(false);
    });

    it('rejects city exceeding 100 chars (max bound)', () => {
      const result = RegisterProInputSchema.safeParse({
        ...validInput,
        serviceZone: { city: 'A'.repeat(101), radiusKm: 80 },
      });
      expect(result.success).toBe(false);
    });

    it('accepts city at exactly 100 chars (upper bound inclusive)', () => {
      const result = RegisterProInputSchema.safeParse({
        ...validInput,
        serviceZone: { city: 'A'.repeat(100), radiusKm: 80 },
      });
      expect(result.success).toBe(true);
    });
  });

  describe('Accept charter validation (NEW)', () => {
    it('accepts acceptCharter true (literal)', () => {
      const result = RegisterProInputSchema.safeParse({ ...validInput, acceptCharter: true });
      expect(result.success).toBe(true);
    });

    it('rejects acceptCharter false', () => {
      const result = RegisterProInputSchema.safeParse({ ...validInput, acceptCharter: false });
      expect(result.success).toBe(false);
    });

    it('rejects missing acceptCharter', () => {
      const noCharter: Partial<RegisterProInputDto> = { ...validInput };
      delete (noCharter as { acceptCharter?: true }).acceptCharter;
      const result = RegisterProInputSchema.safeParse(noCharter);
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

describe('ServiceZoneSchema (NEW Story 1.3a-bis)', () => {
  it('parses a valid service zone standalone', () => {
    const result = ServiceZoneSchema.parse({ city: 'Angers', radiusKm: 50 });
    expect(result.city).toBe('Angers');
    expect(result.radiusKm).toBe(50);
  });
});

describe('Enums exported (NEW Story 1.3a-bis)', () => {
  it('LegalFormEnum lists the 5 MVP values', () => {
    expect(LegalFormEnum.options).toEqual([
      'SAS_SASU',
      'EURL_SARL',
      'MICRO_ENTREPRISE',
      'AUTO_ENTREPRENEUR',
      'ASSO_1901',
    ]);
  });

  it('VatStatusEnum lists the 2 MVP values', () => {
    expect(VatStatusEnum.options).toEqual(['vat_registered', 'vat_exempt']);
  });

  it('CategoryEnum lists the 6 MVP values (Pays de la Loire pilot)', () => {
    expect(CategoryEnum.options).toEqual([
      'tents_marquees',
      'event_furniture',
      'decoration',
      'lighting_sound',
      'catering',
      'entertainment',
    ]);
  });
});

describe('RegisterProResponseSchema', () => {
  it('parses a valid response payload (post Story 1.3b-bis: requiresEmailVerification is false)', () => {
    const result = RegisterProResponseSchema.parse({
      userId: '00000000-0000-4000-8000-000000000001',
      proProfileId: '00000000-0000-4000-8000-000000000002',
      requiresAdminReview: true,
      requiresEmailVerification: false,
    });
    expect(result.userId).toBe('00000000-0000-4000-8000-000000000001');
    expect(result.requiresAdminReview).toBe(true);
    expect(result.requiresEmailVerification).toBe(false);
  });

  it('rejects a response missing the proProfileId', () => {
    const result = RegisterProResponseSchema.safeParse({
      userId: '00000000-0000-4000-8000-000000000001',
      requiresAdminReview: true,
      requiresEmailVerification: false,
    });
    expect(result.success).toBe(false);
  });

  it('rejects requiresEmailVerification true (conversion flow has the email already verified)', () => {
    const result = RegisterProResponseSchema.safeParse({
      userId: '00000000-0000-4000-8000-000000000001',
      proProfileId: '00000000-0000-4000-8000-000000000002',
      requiresAdminReview: true,
      requiresEmailVerification: true,
    });
    expect(result.success).toBe(false);
  });
});
