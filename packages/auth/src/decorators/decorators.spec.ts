import { describe, it, expect } from 'vitest';
import { IS_PUBLIC_KEY } from './public.decorator.js';
import { ROLES_KEY } from './roles.decorator.js';
import { REQUIRE_EMAIL_VERIFIED_KEY } from './require-email-verified.decorator.js';
import { REQUIRE_MFA_KEY } from './require-mfa.decorator.js';

describe('Decorator key constants', () => {
  it('IS_PUBLIC_KEY is a non-empty string', () => {
    expect(typeof IS_PUBLIC_KEY).toBe('string');
    expect(IS_PUBLIC_KEY).toBeTruthy();
  });

  it('ROLES_KEY is a non-empty string', () => {
    expect(typeof ROLES_KEY).toBe('string');
    expect(ROLES_KEY).toBeTruthy();
  });

  it('REQUIRE_EMAIL_VERIFIED_KEY is a non-empty string', () => {
    expect(typeof REQUIRE_EMAIL_VERIFIED_KEY).toBe('string');
    expect(REQUIRE_EMAIL_VERIFIED_KEY).toBeTruthy();
  });

  it('REQUIRE_MFA_KEY is a non-empty string', () => {
    expect(typeof REQUIRE_MFA_KEY).toBe('string');
    expect(REQUIRE_MFA_KEY).toBeTruthy();
  });

  it('all keys are distinct', () => {
    const keys = [IS_PUBLIC_KEY, ROLES_KEY, REQUIRE_EMAIL_VERIFIED_KEY, REQUIRE_MFA_KEY];
    expect(new Set(keys).size).toBe(keys.length);
  });
});
