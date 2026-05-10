import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { REQUIRE_EMAIL_VERIFIED_KEY } from '../decorators/require-email-verified.decorator.js';
import { REQUIRE_MFA_KEY } from '../decorators/require-mfa.decorator.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { AuthForbiddenException } from '../exceptions/auth-forbidden.exception.js';
import { AuthMfaRequiredException } from '../exceptions/auth-mfa-required.exception.js';
import { AuthNotAuthenticatedException } from '../exceptions/auth-not-authenticated.exception.js';
import { AuthEmailNotVerifiedException } from '../exceptions/auth-email-not-verified.exception.js';
import type { BackendActor } from '../types/actor.js';
import { MFA_AMR_VALUES, MFA_REQUIRED_ROLES, type Role } from '../types/role.js';

// `acr === '2'` is the OIDC "Level of Assurance 2" claim (multi-factor) — used
// as a fallback when Keycloak does not emit `amr`.
const ACR_MFA_LEVEL = '2';

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

    // Fail-closed: if no actor is attached, JWT verification did not run or
    // failed silently — never let the request through. The previous behaviour
    // (`return true`) was a fail-open posture that defeated the guard.
    if (!actor) {
      throw new AuthNotAuthenticatedException(
        'No authenticated actor on request — KeycloakJwtGuard must run before RolesGuard',
      );
    }

    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Role check FIRST — checking MFA before role would leak admin-status
    // (an admin without MFA hitting a client-only route would receive 401
    // `AUTH-MFA-REQUIRED-003` instead of 403, exposing their privilege level).
    if (requiredRoles && requiredRoles.length > 0) {
      const matches = actor.roles.some((r) => requiredRoles.includes(r));
      if (!matches) {
        throw new AuthForbiddenException(
          `Required role: ${requiredRoles.join(', ')}. Actual roles: ${actor.roles.join(', ')}.`,
        );
      }
    }

    // Email-verified gate (explicit @RequireEmailVerified()).
    const requireEmailVerified = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_EMAIL_VERIFIED_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (requireEmailVerified && !actor.emailVerified) {
      throw new AuthEmailNotVerifiedException('Email must be verified');
    }

    // MFA gate — auto-applied for MFA_REQUIRED_ROLES (admin-*) or via
    // explicit @RequireMfa(). Accepts any MFA-class amr OR acr=='2' fallback.
    const requireMfa = this.reflector.getAllAndOverride<boolean>(REQUIRE_MFA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const isMfaRequiredRole = actor.roles.some((r) => MFA_REQUIRED_ROLES.has(r));
    if (requireMfa || isMfaRequiredRole) {
      const hasMfaAmr = actor.amr.some((m) => MFA_AMR_VALUES.includes(m));
      const hasMfaAcr = actor.acr === ACR_MFA_LEVEL;
      if (!hasMfaAmr && !hasMfaAcr) {
        throw new AuthMfaRequiredException('MFA required for this resource');
      }
    }

    return true;
  }
}
