import { describe, it, expect } from 'vitest';
import { PreLaunchSignupSchema } from './pre-launch-signup.schema.js';

const valid = {
  firstName: 'Camille',
  lastName: 'Renaud',
  email: 'camille@exemple.fr',
  role: 'organisateur' as const,
  rgpdOptIn: true as const,
  locale: 'fr' as const,
};

describe('PreLaunchSignupSchema', () => {
  it('accepts a valid payload', () => {
    expect(PreLaunchSignupSchema.safeParse(valid).success).toBe(true);
  });

  it('trims firstName and lastName', () => {
    const result = PreLaunchSignupSchema.safeParse({
      ...valid,
      firstName: '  Camille  ',
      lastName: '  Renaud  ',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.firstName).toBe('Camille');
      expect(result.data.lastName).toBe('Renaud');
    }
  });

  it('rejects empty firstName', () => {
    const result = PreLaunchSignupSchema.safeParse({ ...valid, firstName: '' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toContain('firstName.required');
  });

  it('rejects firstName > 80 chars', () => {
    const result = PreLaunchSignupSchema.safeParse({ ...valid, firstName: 'a'.repeat(81) });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toContain('firstName.tooLong');
  });

  it('accepts firstName exactly 80 chars', () => {
    expect(PreLaunchSignupSchema.safeParse({ ...valid, firstName: 'a'.repeat(80) }).success).toBe(
      true,
    );
  });

  it('rejects empty lastName', () => {
    const result = PreLaunchSignupSchema.safeParse({ ...valid, lastName: '' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toContain('lastName.required');
  });

  it('lowercases email', () => {
    const result = PreLaunchSignupSchema.safeParse({ ...valid, email: 'CAMILLE@EXEMPLE.FR' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe('camille@exemple.fr');
  });

  it('rejects invalid email', () => {
    const result = PreLaunchSignupSchema.safeParse({ ...valid, email: 'not-an-email' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toContain('email.invalid');
  });

  it('rejects email > 254 chars', () => {
    const longEmail = 'a'.repeat(250) + '@x.fr';
    const result = PreLaunchSignupSchema.safeParse({ ...valid, email: longEmail });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toContain('email.tooLong');
  });

  it('accepts role=professionnel', () => {
    expect(PreLaunchSignupSchema.safeParse({ ...valid, role: 'professionnel' }).success).toBe(true);
  });

  it('rejects invalid role', () => {
    const result = PreLaunchSignupSchema.safeParse({ ...valid, role: 'admin' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toContain('role.invalid');
  });

  it('rejects rgpdOptIn=false', () => {
    const result = PreLaunchSignupSchema.safeParse({ ...valid, rgpdOptIn: false });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toContain('rgpdOptIn.required');
  });

  it('accepts locale=en', () => {
    expect(PreLaunchSignupSchema.safeParse({ ...valid, locale: 'en' }).success).toBe(true);
  });

  it('rejects invalid locale', () => {
    const result = PreLaunchSignupSchema.safeParse({ ...valid, locale: 'de' });
    expect(result.success).toBe(false);
  });
});
