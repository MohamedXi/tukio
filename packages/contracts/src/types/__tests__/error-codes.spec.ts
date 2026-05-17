import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { AuthErrorCodes } from '../error-codes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APPS_PUBLIC_MESSAGES = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  '..',
  'apps',
  'public',
  'src',
  'messages',
);

function loadMessages(locale: 'fr' | 'en'): Record<string, unknown> {
  const json = readFileSync(join(APPS_PUBLIC_MESSAGES, `${locale}.json`), 'utf8');
  return JSON.parse(json);
}

const REQUIRED_AUTH_I18N_KEYS = [
  'invalidState',
  'invalidCode',
  'csrfMismatch',
  'refreshInvalid',
  'refreshExpired',
  'refreshReused',
  'external',
] as const;

describe('AuthErrorCodes — Story 1.4a 7 new login flow codes', () => {
  it('defines the 7 Story 1.4a codes with the canonical AUTH-* shape', () => {
    expect(AuthErrorCodes.INVALID_STATE).toBe('AUTH-INVALID-STATE-001');
    expect(AuthErrorCodes.INVALID_CODE).toBe('AUTH-INVALID-CODE-001');
    expect(AuthErrorCodes.CSRF_MISMATCH).toBe('AUTH-CSRF-MISMATCH-001');
    expect(AuthErrorCodes.REFRESH_INVALID).toBe('AUTH-REFRESH-INVALID-001');
    expect(AuthErrorCodes.REFRESH_EXPIRED).toBe('AUTH-REFRESH-EXPIRED-001');
    expect(AuthErrorCodes.REFRESH_REUSED).toBe('AUTH-REFRESH-REUSED-001');
    expect(AuthErrorCodes.EXTERNAL).toBe('AUTH-EXTERNAL-001');
  });

  it('all AUTH-* codes are unique', () => {
    const values = Object.values(AuthErrorCodes);
    expect(new Set(values).size).toBe(values.length);
  });

  it.each(['fr', 'en'] as const)(
    'apps/public messages.%s has errors.auth.* i18n keys',
    (locale) => {
      const messages = loadMessages(locale);
      const errors = (messages.errors ?? {}) as { auth?: Record<string, string> };
      expect(errors.auth, `messages.${locale}.errors.auth missing`).toBeDefined();
      for (const key of REQUIRED_AUTH_I18N_KEYS) {
        expect(errors.auth?.[key], `messages.${locale}.errors.auth.${key} missing`).toBeTypeOf(
          'string',
        );
        expect((errors.auth as Record<string, string>)[key]?.length).toBeGreaterThan(0);
      }
    },
  );
});
