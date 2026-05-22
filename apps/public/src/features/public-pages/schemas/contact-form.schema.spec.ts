import { describe, it, expect } from 'vitest';
import { ContactFormSchema } from './contact-form.schema.js';

const valid = {
  firstName: 'Camille',
  lastName: 'Renaud',
  email: 'camille@exemple.fr',
  category: 'organisateur' as const,
  subject: 'general' as const,
  message: 'Bonjour, je souhaite en savoir plus.',
  locale: 'fr' as const,
};

describe('ContactFormSchema', () => {
  it('accepts a valid payload', () => {
    expect(ContactFormSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects empty firstName', () => {
    const r = ContactFormSchema.safeParse({ ...valid, firstName: '' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toBe('errors.firstName.required');
  });

  it('rejects firstName > 80 chars', () => {
    const r = ContactFormSchema.safeParse({ ...valid, firstName: 'A'.repeat(81) });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toBe('errors.firstName.tooLong');
  });

  it('rejects invalid email', () => {
    const r = ContactFormSchema.safeParse({ ...valid, email: 'not-an-email' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toBe('errors.email.invalid');
  });

  it('lowercases email', () => {
    const r = ContactFormSchema.safeParse({ ...valid, email: 'USER@EXAMPLE.COM' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe('user@example.com');
  });

  it('rejects invalid category enum', () => {
    const r = ContactFormSchema.safeParse({ ...valid, category: 'unknown' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toBe('errors.category.invalid');
  });

  it('rejects invalid subject enum', () => {
    const r = ContactFormSchema.safeParse({ ...valid, subject: 'unknown' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toBe('errors.subject.invalid');
  });

  it('rejects message shorter than 10 chars', () => {
    const r = ContactFormSchema.safeParse({ ...valid, message: 'Short' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toBe('errors.message.tooShort');
  });

  it('rejects message longer than 2000 chars', () => {
    const r = ContactFormSchema.safeParse({ ...valid, message: 'A'.repeat(2001) });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toBe('errors.message.tooLong');
  });

  it('trims whitespace from firstName', () => {
    const r = ContactFormSchema.safeParse({ ...valid, firstName: '  Camille  ' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.firstName).toBe('Camille');
  });

  it('accepts all valid category values', () => {
    for (const cat of [
      'organisateur',
      'professionnel',
      'journaliste',
      'partenaire',
      'autre',
    ] as const) {
      expect(ContactFormSchema.safeParse({ ...valid, category: cat }).success).toBe(true);
    }
  });

  it('accepts all valid subject values', () => {
    for (const sub of ['general', 'devenirPro', 'technique', 'partenariat', 'presse'] as const) {
      expect(ContactFormSchema.safeParse({ ...valid, subject: sub }).success).toBe(true);
    }
  });
});
