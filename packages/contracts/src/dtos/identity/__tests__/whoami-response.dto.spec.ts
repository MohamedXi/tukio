import { describe, it, expect } from 'vitest';
import { WhoamiResponseSchema } from '../whoami-response.dto.js';

const VALID = {
  userId: 'd4e5f6a7-b8c9-4012-9ef0-123456789012',
  email: 'alice@example.com',
  role: ['client'],
  status: 'active',
  locale: 'fr',
  emailVerified: true,
  mfaEnabled: false,
};

describe('WhoamiResponseSchema', () => {
  it('parses a valid Customer whoami payload', () => {
    expect(() => WhoamiResponseSchema.parse(VALID)).not.toThrow();
  });

  it('rejects missing email', () => {
    const rest: Record<string, unknown> = { ...VALID };
    delete rest.email;
    expect(() => WhoamiResponseSchema.parse(rest)).toThrow();
  });

  it('rejects non-UUID userId', () => {
    expect(() => WhoamiResponseSchema.parse({ ...VALID, userId: 'not-a-uuid' })).toThrow();
  });

  it('rejects unknown role value', () => {
    expect(() => WhoamiResponseSchema.parse({ ...VALID, role: ['client', 'visitor'] })).toThrow();
  });

  it('rejects empty role array (min 1)', () => {
    expect(() => WhoamiResponseSchema.parse({ ...VALID, role: [] })).toThrow();
  });

  it('rejects extra/unknown property (strict mode)', () => {
    expect(() => WhoamiResponseSchema.parse({ ...VALID, extraField: 'unexpected' })).toThrow();
  });
});
