import { Injectable } from '@nestjs/common';
import type { BackendActor } from '../types/actor.js';
import { ROLE_PRECEDENCE, type Role } from '../types/role.js';
import type { KeycloakJwtPayload } from '../types/jwt-payload.js';

export const ACTOR_RESOLVER = Symbol('ACTOR_RESOLVER');

@Injectable()
export class ActorResolverService {
  static fromJwt(payload: KeycloakJwtPayload): BackendActor {
    return {
      userId: payload.sub,
      role: extractRole(payload.realm_access?.roles ?? []),
      locale: (payload.locale as 'fr' | 'en') ?? 'fr',
      email: payload.email ?? '',
      emailVerified: payload.email_verified ?? false,
      amr: payload.amr ?? [],
    };
  }
}

export function extractRole(roles: string[]): Role {
  for (const r of ROLE_PRECEDENCE) {
    if (roles.includes(r)) return r;
  }
  return 'client';
}
