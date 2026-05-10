import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { REQUIRE_EMAIL_VERIFIED_KEY } from '../decorators/require-email-verified.decorator.js';
import { REQUIRE_MFA_KEY } from '../decorators/require-mfa.decorator.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { AuthForbiddenException } from '../exceptions/auth-forbidden.exception.js';
import { AuthMfaRequiredException } from '../exceptions/auth-mfa-required.exception.js';
import { AuthEmailNotVerifiedException } from '../exceptions/auth-email-not-verified.exception.js';
import type { BackendActor } from '../types/actor.js';
import type { Role } from '../types/role.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<{ actor?: BackendActor }>();
    const actor = request.actor;
    if (!actor) return true;

    // MFA gate: auto-applied for admin-* roles, or explicit @RequireMfa()
    const requireMfa = this.reflector.getAllAndOverride<boolean>(REQUIRE_MFA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const isAdmin = actor.role.startsWith('admin-');
    if ((requireMfa || isAdmin) && !actor.amr.includes('totp')) {
      throw new AuthMfaRequiredException('MFA required for this resource');
    }

    // Email verified gate
    const requireEmailVerified = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_EMAIL_VERIFIED_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (requireEmailVerified && !actor.emailVerified) {
      throw new AuthEmailNotVerifiedException('Email must be verified');
    }

    // Role gate
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    if (!requiredRoles.includes(actor.role)) {
      throw new AuthForbiddenException(
        `Required role: ${requiredRoles.join(', ')}. Actual role: ${actor.role}.`,
      );
    }

    return true;
  }
}
