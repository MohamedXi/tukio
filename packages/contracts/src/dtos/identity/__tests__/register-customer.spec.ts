import { describe, it, expect } from 'vitest';
import {
  RegisterCustomerInputSchema,
  type RegisterCustomerInputDto,
  RegisterCustomerResponseSchema,
} from '../register-customer.dto.js';
import { AcquisitionInputSchema, AcquisitionSourceSchema } from '../acquisition.dto.js';

const validInput: RegisterCustomerInputDto = {
  email: 'alice@example.com',
  password: 'SecurePass1234!',
  firstName: 'Alice',
  lastName: 'Martin',
  locale: 'fr',
  acceptTerms: true,
  acceptMarketing: false,
};

describe('RegisterCustomerInputSchema', () => {
  it('parses a valid customer registration payload', () => {
    const result = RegisterCustomerInputSchema.parse(validInput);
    expect(result.email).toBe('alice@example.com');
    expect(result.acceptMarketing).toBe(false);
  });

  it('defaults acceptMarketing to false when omitted', () => {
    const input: Omit<RegisterCustomerInputDto, 'acceptMarketing'> = {
      email: validInput.email,
      password: validInput.password,
      firstName: validInput.firstName,
      lastName: validInput.lastName,
      locale: validInput.locale,
      acceptTerms: validInput.acceptTerms,
    };
    const result = RegisterCustomerInputSchema.parse(input);
    expect(result.acceptMarketing).toBe(false);
  });

  it('accepts an optional acquisition object with defaults', () => {
    const result = RegisterCustomerInputSchema.parse({
      ...validInput,
      acquisition: { campaign: 'spring2026' },
    });
    expect(result.acquisition?.source).toBe('unknown');
    expect(result.acquisition?.campaign).toBe('spring2026');
  });

  it('rejects a too-short password with path "password" and code too_small', () => {
    const result = RegisterCustomerInputSchema.safeParse({ ...validInput, password: 'short1!' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === 'password');
      expect(issue?.code).toBe('too_small');
    }
  });

  it('rejects a password missing uppercase with path "password"', () => {
    const result = RegisterCustomerInputSchema.safeParse({
      ...validInput,
      password: 'lowercase1234!',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'password')).toBe(true);
    }
  });

  it('rejects a password missing a digit', () => {
    const result = RegisterCustomerInputSchema.safeParse({
      ...validInput,
      password: 'NoDigitsHere!!!',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'password')).toBe(true);
    }
  });

  it('rejects a password missing a special character', () => {
    const result = RegisterCustomerInputSchema.safeParse({
      ...validInput,
      password: 'NoSpecial1234567',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'password')).toBe(true);
    }
  });

  it('rejects an invalid email with path "email"', () => {
    const result = RegisterCustomerInputSchema.safeParse({ ...validInput, email: 'not-an-email' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.find((i) => i.path[0] === 'email')).toBeDefined();
    }
  });

  it('normalizes email at the schema boundary (trim + lowercase) — review patch P4', () => {
    const result = RegisterCustomerInputSchema.parse({
      ...validInput,
      email: '  Alice@Example.COM ',
    });
    expect(result.email).toBe('alice@example.com');
  });

  it('accepts French accented characters as alphanumeric (broader Unicode-aware password regex)', () => {
    // 'Façade-2026!' has lowercase (a/d/e), uppercase (F), digits, and a special (- + !).
    const result = RegisterCustomerInputSchema.safeParse({
      ...validInput,
      password: 'Façade-2026!',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a password missing a non-alphanumeric character (Unicode-aware)', () => {
    const result = RegisterCustomerInputSchema.safeParse({
      ...validInput,
      password: 'AlphaNum1234567',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'password')).toBe(true);
    }
  });

  it('rejects when acceptTerms is false (literal(true) gate)', () => {
    const result = RegisterCustomerInputSchema.safeParse({ ...validInput, acceptTerms: false });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.find((i) => i.path[0] === 'acceptTerms')).toBeDefined();
    }
  });

  it('rejects unknown locale value', () => {
    const result = RegisterCustomerInputSchema.safeParse({ ...validInput, locale: 'de' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.find((i) => i.path[0] === 'locale')).toBeDefined();
    }
  });

  it('rejects an empty firstName after trim', () => {
    const result = RegisterCustomerInputSchema.safeParse({ ...validInput, firstName: '   ' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.find((i) => i.path[0] === 'firstName')).toBeDefined();
    }
  });
});

describe('RegisterCustomerResponseSchema', () => {
  it('parses a valid response', () => {
    const result = RegisterCustomerResponseSchema.parse({
      userId: '11111111-1111-4111-8111-111111111111',
      requiresEmailVerification: true,
    });
    expect(result.requiresEmailVerification).toBe(true);
  });

  it('rejects when requiresEmailVerification is false', () => {
    const result = RegisterCustomerResponseSchema.safeParse({
      userId: '11111111-1111-4111-8111-111111111111',
      requiresEmailVerification: false,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-UUID userId', () => {
    const result = RegisterCustomerResponseSchema.safeParse({
      userId: 'not-a-uuid',
      requiresEmailVerification: true,
    });
    expect(result.success).toBe(false);
  });
});

describe('AcquisitionSourceSchema', () => {
  it('accepts every canonical source value', () => {
    for (const source of [
      'organic',
      'google_ads',
      'meta_ads',
      'referral',
      'direct',
      'partner',
      'unknown',
    ] as const) {
      expect(AcquisitionSourceSchema.parse(source)).toBe(source);
    }
  });

  it('rejects a non-canonical source', () => {
    expect(AcquisitionSourceSchema.safeParse('newsletter').success).toBe(false);
  });
});

describe('AcquisitionInputSchema', () => {
  it('defaults source to "unknown" when omitted', () => {
    const result = AcquisitionInputSchema.parse({});
    expect(result.source).toBe('unknown');
  });

  it('truncation guard: rejects medium > 200 chars', () => {
    const longMedium = 'x'.repeat(201);
    const result = AcquisitionInputSchema.safeParse({ source: 'google_ads', medium: longMedium });
    expect(result.success).toBe(false);
  });

  it('accepts a valid UUID referralId', () => {
    const result = AcquisitionInputSchema.parse({
      source: 'referral',
      referralId: '11111111-1111-4111-8111-111111111111',
    });
    expect(result.referralId).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('rejects a non-UUID referralId', () => {
    const result = AcquisitionInputSchema.safeParse({
      source: 'referral',
      referralId: 'short-code',
    });
    expect(result.success).toBe(false);
  });
});
