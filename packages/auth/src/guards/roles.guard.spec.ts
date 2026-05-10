import { describe, it, expect, vi } from 'vitest';
import { Reflector } from '@nestjs/core';
import 'reflect-metadata';
import { RolesGuard } from './roles.guard.js';
import { AuthForbiddenException } from '../exceptions/auth-forbidden.exception.js';
import { AuthMfaRequiredException } from '../exceptions/auth-mfa-required.exception.js';
import { AuthEmailNotVerifiedException } from '../exceptions/auth-email-not-verified.exception.js';
import type { BackendActor } from '../types/actor.js';

function buildCtx(
  actor: BackendActor,
  roles?: string[],
  requireMfa = false,
  requireEmailVerified = false,
  isPublic = false,
) {
  const request = { actor };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => function h() {},
    getClass: () => class C {},
    _roles: roles,
    _requireMfa: requireMfa,
    _requireEmailVerified: requireEmailVerified,
    _isPublic: isPublic,
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
  locale: 'fr',
  email: 'c@t.one',
  emailVerified: true,
  amr: [],
};
const adminActor: BackendActor = {
  userId: 'u2',
  role: 'admin-super',
  locale: 'fr',
  email: 'a@t.one',
  emailVerified: true,
  amr: ['totp'],
};
const adminNoMfa: BackendActor = {
  ...adminActor,
  amr: [],
};

describe('RolesGuard', () => {
  it('passes when route is public', () => {
    const guard = buildGuard(undefined, false, false, true);
    const ctx = buildCtx(clientActor, undefined, false, false, true);
    expect(guard.canActivate(ctx as unknown as Parameters<RolesGuard['canActivate']>[0])).toBe(
      true,
    );
  });

  it('passes when no roles required', () => {
    const guard = buildGuard(undefined);
    const ctx = buildCtx(clientActor);
    expect(guard.canActivate(ctx as unknown as Parameters<RolesGuard['canActivate']>[0])).toBe(
      true,
    );
  });

  it('passes when actor has required role', () => {
    const guard = buildGuard(['client', 'pro']);
    const ctx = buildCtx(clientActor);
    expect(guard.canActivate(ctx as unknown as Parameters<RolesGuard['canActivate']>[0])).toBe(
      true,
    );
  });

  it('throws AuthForbiddenException when role insufficient', () => {
    const guard = buildGuard(['admin-modo', 'admin-super']);
    const ctx = buildCtx(clientActor);
    expect(() =>
      guard.canActivate(ctx as unknown as Parameters<RolesGuard['canActivate']>[0]),
    ).toThrow(AuthForbiddenException);
  });

  it('passes multi-roles OR when one matches', () => {
    const guard = buildGuard(['pro', 'admin-super']);
    const ctx = buildCtx(adminActor);
    expect(guard.canActivate(ctx as unknown as Parameters<RolesGuard['canActivate']>[0])).toBe(
      true,
    );
  });

  it('throws AuthMfaRequiredException for admin without totp', () => {
    const guard = buildGuard(['admin-super']);
    const ctx = buildCtx(adminNoMfa);
    expect(() =>
      guard.canActivate(ctx as unknown as Parameters<RolesGuard['canActivate']>[0]),
    ).toThrow(AuthMfaRequiredException);
  });

  it('passes admin with totp', () => {
    const guard = buildGuard(['admin-super']);
    const ctx = buildCtx(adminActor);
    expect(guard.canActivate(ctx as unknown as Parameters<RolesGuard['canActivate']>[0])).toBe(
      true,
    );
  });

  it('throws AuthEmailNotVerifiedException when email not verified', () => {
    const guard = buildGuard(['client'], false, true);
    const ctx = buildCtx({ ...clientActor, emailVerified: false });
    expect(() =>
      guard.canActivate(ctx as unknown as Parameters<RolesGuard['canActivate']>[0]),
    ).toThrow(AuthEmailNotVerifiedException);
  });

  it('throws AuthMfaRequiredException with explicit @RequireMfa()', () => {
    const guard = buildGuard(['client'], true);
    const ctx = buildCtx({ ...clientActor, amr: [] });
    expect(() =>
      guard.canActivate(ctx as unknown as Parameters<RolesGuard['canActivate']>[0]),
    ).toThrow(AuthMfaRequiredException);
  });
});
