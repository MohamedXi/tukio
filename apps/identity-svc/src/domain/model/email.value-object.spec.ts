import { Email } from './email.value-object.js';
import { InvalidEmailException } from '../exception/invalid-email.exception.js';

describe('Email (value object)', () => {
  it('normalizes to lowercase + trim', () => {
    const email = Email.create('  Foo@Bar.COM  ');
    expect(email.toString()).toBe('foo@bar.com');
  });

  it('equals another Email with same normalized value', () => {
    expect(Email.create('a@b.io').equals(Email.create('A@B.io'))).toBe(true);
  });

  it('does not equal a different Email', () => {
    expect(Email.create('a@b.io').equals(Email.create('c@d.io'))).toBe(false);
  });

  it.each([
    '',
    '   ',
    'no-at-sign.com',
    'a@b',
    'a@b.c',
    'a@@b.io',
    'foo bar@baz.io',
  ])('rejects invalid email: %s', (raw) => {
    expect(() => Email.create(raw)).toThrow(InvalidEmailException);
  });

  it('rejects non-string input', () => {
    expect(() => Email.create(123 as any)).toThrow(InvalidEmailException);
  });

  it('rejects emails over 254 characters', () => {
    const huge = `${'a'.repeat(250)}@bar.io`;
    expect(() => Email.create(huge)).toThrow(InvalidEmailException);
  });

  // Story 1.2b review patch B11 — case-sensitivity contract assertion.
  // The `findByEmail` repository normalizes (`trim().toLowerCase()`) and the
  // DB has a unique index on `lower(email)`. This test pins the Email VO
  // behavior so a future "preserve case for display" change can't silently
  // break the persistence-layer lookup invariant.
  it('asString returns the lowercased normalized value (matches DB lower(email) index)', () => {
    const email = Email.create('Alice@Example.COM');
    expect(email.asString).toBe('alice@example.com');
    expect(email.toString()).toBe('alice@example.com');
  });
});
