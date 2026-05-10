import { Injectable } from '@nestjs/common';
import type { BackendActor } from '../types/actor.js';
import { ROLE_PRECEDENCE, TUKIO_ROLES, type Role } from '../types/role.js';
import type { KeycloakJwtPayload } from '../types/jwt-payload.js';

export const ACTOR_RESOLVER = Symbol('ACTOR_RESOLVER');

@Injectable()
export class ActorResolverService {
  static fromJwt(payload: KeycloakJwtPayload): BackendActor {
    const realmRoles = readRealmRoles(payload);
    const tukioRoles = filterTukioRoles(realmRoles);
    const primaryRole = resolvePrimaryRole(tukioRoles);
    return {
      userId: payload.sub,
      role: primaryRole,
      roles: tukioRoles.length > 0 ? tukioRoles : ['client'],
      locale: payload.locale === 'en' ? 'en' : 'fr',
      email: payload.email ?? '',
      emailVerified: payload.email_verified ?? false,
      amr: Array.isArray(payload.amr) ? payload.amr : [],
      acr: payload.acr,
    };
  }
}

function readRealmRoles(payload: KeycloakJwtPayload): string[] {
  const raw = payload.realm_access?.roles;
  return Array.isArray(raw) ? raw : [];
}

function filterTukioRoles(roles: string[]): Role[] {
  return roles.filter((r): r is Role => (TUKIO_ROLES as readonly string[]).includes(r));
}

function resolvePrimaryRole(roles: Role[]): Role {
  for (const r of ROLE_PRECEDENCE) {
    if (roles.includes(r)) return r;
  }
  return 'client';
}

// Re-exported for tests + RolesGuard.
export { resolvePrimaryRole as extractRole };
