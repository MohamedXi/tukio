import { describe, it, expect, vi } from 'vitest';
import { Reflector } from '@nestjs/core';
import 'reflect-metadata';
import { RolesGuard } from './roles.guard.js';
import { AuthForbiddenException } from '../exceptions/auth-forbidden.exception.js';
import { AuthMfaRequiredException } from '../exceptions/auth-mfa-required.exception.js';
import { AuthNotAuthenticatedException } from '../exceptions/auth-not-authenticated.exception.js';
import { AuthEmailNotVerifiedException } from '../exceptions/auth-email-not-verified.exception.js';
import type { BackendActor } from '../types/actor.js';

function buildCtx(actor: BackendActor | undefined) {
  const request = { actor };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => function h() {},
    getClass: () => class C {},
  };
}

function buildGuard(
  roles?: string[],
  requireMfa = false,
  requireEmailVerified = false,
  isPublic = false,
) {
  const reflector = new Reflector();
  vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
    if (key === 'isPublic') return isPublic;
    if (key === 'roles') return roles;
    if (key === 'requireMfa') return requireMfa;
    if (key === 'requireEmailVerified') return requireEmailVerified;
    return undefined;
  });
  return new RolesGuard(reflector);
}

const clientActor: BackendActor = {
  userId: 'u1',
  role: 'client',
  roles: ['client'],
  locale: 'fr',
  email: 'c@t.one',
  emailVerified: true,
  amr: [],
};
const adminActor: BackendActor = {
  userId: 'u2',
  role: 'admin-super',
  roles: ['admin-super'],
  locale: 'fr',
  email: 'a@t.one',
  emailVerified: true,
  amr: ['totp'],
};
const adminNoMfa: BackendActor = { ...adminActor, amr: [] };
const proActor: BackendActor = {
  userId: 'u3',
  role: 'pro',
  roles: ['pro'],
  locale: 'fr',
  email: 'p@t.one',
  emailVerified: true,
  amr: [],
};
const dualRoleActor: BackendActor = {
  userId: 'u4',
  role: 'admin-modo',
  roles: ['admin-modo', 'admin-support'],
  locale: 'fr',
  email: 'd@t.one',
  emailVerified: true,
  amr: ['totp'],
};

type Ctx = Parameters<RolesGuard['canActivate']>[0];

describe('RolesGuard', () => {
  it('passes when route is public', () => {
    const guard = buildGuard(undefined, false, false, true);
    expect(guard.canActivate(buildCtx(clientActor) as unknown as Ctx)).toBe(true);
  });

  it('throws AuthNotAuthenticatedException when actor is missing (fail-closed)', () => {
    const guard = buildGuard(['client']);
    expect(() => guard.canActivate(buildCtx(undefined) as unknown as Ctx)).toThrow(
      AuthNotAuthenticatedException,
    );
  });

  it('passes when no roles required and no MFA-required role', () => {
    const guard = buildGuard(undefined);
    expect(guard.canActivate(buildCtx(clientActor) as unknown as Ctx)).toBe(true);
  });

  it('passes when actor has required role', () => {
    const guard = buildGuard(['client', 'pro']);
    expect(guard.canActivate(buildCtx(clientActor) as unknown as Ctx)).toBe(true);
  });

  it('throws AuthForbiddenException when role insufficient', () => {
    const guard = buildGuard(['admin-modo', 'admin-super']);
    expect(() => guard.canActivate(buildCtx(clientActor) as unknown as Ctx)).toThrow(
      AuthForbiddenException,
    );
  });

  it('passes multi-roles OR when one matches', () => {
    const guard = buildGuard(['pro', 'admin-super']);
    expect(guard.canActivate(buildCtx(adminActor) as unknown as Ctx)).toBe(true);
  });

  it('passes least-privilege check when actor has a strictly-listed role among multiple', () => {
    // dualRoleActor has [admin-modo, admin-support]; route requires admin-support only.
    const guard = buildGuard(['admin-support']);
    expect(guard.canActivate(buildCtx(dualRoleActor) as unknown as Ctx)).toBe(true);
  });

  it('admin without MFA hitting client-only route → 403 (role check first), not 401 (info leak)', () => {
    // Reordering: role check before MFA. The admin role is not in [client], so
    // the user gets 403 "Insufficient role" — they never learn they would have
    // needed MFA, which would otherwise leak their privilege level.
    const guard = buildGuard(['client']);
    expect(() => guard.canActivate(buildCtx(adminNoMfa) as unknown as Ctx)).toThrow(
      AuthForbiddenException,
    );
  });

  it('admin without MFA on admin route → 401 AuthMfaRequiredException', () => {
    const guard = buildGuard(['admin-super']);
    expect(() => guard.canActivate(buildCtx(adminNoMfa) as unknown as Ctx)).toThrow(
      AuthMfaRequiredException,
    );
  });

  it('passes admin with totp on admin route', () => {
    const guard = buildGuard(['admin-super']);
    expect(guard.canActivate(buildCtx(adminActor) as unknown as Ctx)).toBe(true);
  });

  it('passes admin with acr=2 fallback (no amr)', () => {
    const guard = buildGuard(['admin-super']);
    const adminAcrOnly: BackendActor = { ...adminActor, amr: [], acr: '2' };
    expect(guard.canActivate(buildCtx(adminAcrOnly) as unknown as Ctx)).toBe(true);
  });

  it('passes admin with webauthn amr (not just totp)', () => {
    const guard = buildGuard(['admin-super']);
    const adminWebauthn: BackendActor = { ...adminActor, amr: ['webauthn'] };
    expect(guard.canActivate(buildCtx(adminWebauthn) as unknown as Ctx)).toBe(true);
  });

  it('throws AuthEmailNotVerifiedException when email not verified', () => {
    const guard = buildGuard(['client'], false, true);
    const unverified = { ...clientActor, emailVerified: false };
    expect(() => guard.canActivate(buildCtx(unverified) as unknown as Ctx)).toThrow(
      AuthEmailNotVerifiedException,
    );
  });

  it('throws AuthMfaRequiredException with explicit @RequireMfa() on non-admin route', () => {
    const guard = buildGuard(['pro'], true);
    expect(() => guard.canActivate(buildCtx(proActor) as unknown as Ctx)).toThrow(
      AuthMfaRequiredException,
    );
  });
});
