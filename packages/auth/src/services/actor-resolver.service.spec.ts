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

describe('extractRole — precedence (primary role)', () => {
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
    expect(extractRole([])).toBe('client');
  });
});

describe('ActorResolverService.fromJwt', () => {
  it('extracts all fields from payload (primary role + full role set)', () => {
    const actor = ActorResolverService.fromJwt(makePayload(['client']));
    expect(actor.userId).toBe('user-uuid-1');
    expect(actor.role).toBe('client');
    expect(actor.roles).toEqual(['client']);
    expect(actor.locale).toBe('fr');
    expect(actor.email).toBe('test@tukio.one');
    expect(actor.emailVerified).toBe(true);
    expect(actor.amr).toEqual([]);
  });

  it('preserves the full role set (not just the precedence-derived primary)', () => {
    const actor = ActorResolverService.fromJwt(makePayload(['admin-modo', 'admin-support']));
    expect(actor.role).toBe('admin-modo'); // precedence
    expect(actor.roles).toEqual(expect.arrayContaining(['admin-modo', 'admin-support']));
  });

  it('filters out unknown realm roles', () => {
    const actor = ActorResolverService.fromJwt(makePayload(['client', 'some-other-realm-role']));
    expect(actor.roles).toEqual(['client']);
  });

  it('falls back to roles=[client] when realm_access.roles has no Tukio roles', () => {
    const actor = ActorResolverService.fromJwt(makePayload(['offline_access']));
    expect(actor.roles).toEqual(['client']);
    expect(actor.role).toBe('client');
  });

  it('handles malformed realm_access (non-array roles) without privilege escalation', () => {
    // If Keycloak misconfigures the mapper and emits roles as a string, the
    // resolver must NOT do substring matches.
    const actor = ActorResolverService.fromJwt(
      makePayload([], {
        realm_access: { roles: 'admin-super-disabled' as unknown as string[] },
      }),
    );
    expect(actor.roles).toEqual(['client']);
    expect(actor.role).toBe('client');
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

  it('whitelist-coerces invalid locale to fr', () => {
    const actor = ActorResolverService.fromJwt(makePayload(['client'], { locale: 'es' }));
    expect(actor.locale).toBe('fr');
  });

  it('keeps en when locale is en', () => {
    const actor = ActorResolverService.fromJwt(makePayload(['client'], { locale: 'en' }));
    expect(actor.locale).toBe('en');
  });

  it('propagates amr and acr fields', () => {
    const actor = ActorResolverService.fromJwt(
      makePayload(['admin-super'], { amr: ['totp', 'pwd'], acr: '2' }),
    );
    expect(actor.amr).toContain('totp');
    expect(actor.acr).toBe('2');
  });

  it('handles missing amr (non-array) safely', () => {
    const actor = ActorResolverService.fromJwt(
      makePayload(['client'], { amr: undefined as unknown as string[] }),
    );
    expect(actor.amr).toEqual([]);
  });
});
