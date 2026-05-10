import { describe, it, expect } from 'vitest';
import { ActorResolverService, extractRole } from './actor-resolver.service.js';
import type { KeycloakJwtPayload } from '../types/jwt-payload.js';

const makePayload = (
  roles: string[],
  overrides: Partial<KeycloakJwtPayload> = {},
): KeycloakJwtPayload => ({
  sub: 'user-uuid-1',
  iss: 'https://auth.tukio.one/realms/tukio',
  aud: 'tukio-api',
  exp: Math.floor(Date.now() / 1000) + 3600,
  iat: Math.floor(Date.now() / 1000),
  email: 'test@tukio.one',
  email_verified: true,
  amr: [],
  locale: 'fr',
  realm_access: { roles },
  ...overrides,
});

describe('extractRole — precedence', () => {
  it('returns admin-super first', () => {
    expect(extractRole(['client', 'admin-super', 'pro'])).toBe('admin-super');
  });

  it('returns admin-modo before pro', () => {
    expect(extractRole(['pro', 'admin-modo'])).toBe('admin-modo');
  });

  it('returns admin-support before pro', () => {
    expect(extractRole(['pro', 'admin-support'])).toBe('admin-support');
  });

  it('returns pro before client', () => {
    expect(extractRole(['client', 'pro'])).toBe('pro');
  });

  it('returns client when no known role found', () => {
    expect(extractRole(['some-unknown-role'])).toBe('client');
  });

  it('returns client for empty roles', () => {
    expect(extractRole([])).toBe('client');
  });
});

describe('ActorResolverService.fromJwt', () => {
  it('extracts all fields from payload', () => {
    const actor = ActorResolverService.fromJwt(makePayload(['client']));
    expect(actor.userId).toBe('user-uuid-1');
    expect(actor.role).toBe('client');
    expect(actor.locale).toBe('fr');
    expect(actor.email).toBe('test@tukio.one');
    expect(actor.emailVerified).toBe(true);
    expect(actor.amr).toEqual([]);
  });

  it('defaults email to empty string if missing', () => {
    const actor = ActorResolverService.fromJwt(makePayload(['client'], { email: undefined }));
    expect(actor.email).toBe('');
  });

  it('defaults emailVerified to false if missing', () => {
    const actor = ActorResolverService.fromJwt(
      makePayload(['client'], { email_verified: undefined }),
    );
    expect(actor.emailVerified).toBe(false);
  });

  it('defaults locale to fr if missing', () => {
    const actor = ActorResolverService.fromJwt(makePayload(['client'], { locale: undefined }));
    expect(actor.locale).toBe('fr');
  });

  it('propagates amr field', () => {
    const actor = ActorResolverService.fromJwt(
      makePayload(['admin-super'], { amr: ['totp', 'pwd'] }),
    );
    expect(actor.amr).toContain('totp');
  });

  it('uses correct role precedence from JWT', () => {
    const actor = ActorResolverService.fromJwt(makePayload(['pro', 'admin-modo']));
    expect(actor.role).toBe('admin-modo');
  });
});
