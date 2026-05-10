import {
  Injectable,
  type NestInterceptor,
  type ExecutionContext,
  type CallHandler,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import type { BackendActor } from '../types/actor.js';

export const ACTOR_HEADER = 'x-tukio-actor';
export const LOCALE_HEADER = 'x-tukio-locale';

// Inbound interceptor: prevents X-Tukio-Actor smuggling by ALWAYS overwriting
// (or stripping) the inbound header before any downstream code reads it.
//
// IMPORTANT: this does NOT propagate the header to outbound HTTP calls — that
// must be wired at the HTTP-client level (axios interceptor or undici dispatcher
// instantiated by services that make S2S calls). See README §Outbound Propagation.
@Injectable()
export class ActorPropagationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{
      actor?: BackendActor;
      headers: Record<string, string | string[] | undefined>;
    }>();

    // Always strip any client-supplied actor/locale header — these MUST be set
    // by trusted code (this interceptor), never accepted from the wire. Without
    // this strip, public routes (with no `actor`) would let attacker-supplied
    // X-Tukio-Actor headers reach downstream services that trust them.
    delete request.headers[ACTOR_HEADER];
    delete request.headers[LOCALE_HEADER];

    if (request.actor) {
      const actorHeader = encodeActor(request.actor);
      request.headers[ACTOR_HEADER] = actorHeader;
      request.headers[LOCALE_HEADER] = request.actor.locale;
    }

    return next.handle();
  }
}

// Wire-format: base64-JSON. MVP unsigned. V1+ adds HMAC for anti-tampering.
// Exposed for use by outbound HTTP-client interceptors (axios / undici).
export function encodeActor(actor: BackendActor): string {
  return Buffer.from(JSON.stringify(projectActor(actor))).toString('base64');
}

// Project BackendActor → wire shape consumed by downstream services.
// Drops backend-only fields (email, amr, acr) — those should not leak across
// service boundaries.
function projectActor(actor: BackendActor): {
  userId: string;
  role: string;
  roles: string[];
  locale: 'fr' | 'en';
  emailVerified: boolean;
} {
  return {
    userId: actor.userId,
    role: actor.role,
    roles: actor.roles,
    locale: actor.locale,
    emailVerified: actor.emailVerified,
  };
}
