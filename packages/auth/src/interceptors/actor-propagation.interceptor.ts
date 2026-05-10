import {
  Injectable,
  type NestInterceptor,
  type ExecutionContext,
  type CallHandler,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import type { BackendActor } from '../types/actor.js';

// Propagates X-Tukio-Actor, X-Tukio-Locale headers on all outbound HTTP calls.
// At MVP, Actor is base64-encoded JSON without HMAC signature (HMAC V1+ for anti-tampering).
// X-Tukio-Correlation-Id is propagated separately by each service via CorrelationMiddleware.
@Injectable()
export class ActorPropagationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{
      actor?: BackendActor;
      headers: Record<string, string>;
    }>();

    if (request.actor) {
      const actorHeader = Buffer.from(JSON.stringify(request.actor)).toString('base64');
      request.headers['x-tukio-actor'] = actorHeader;
      request.headers['x-tukio-locale'] = request.actor.locale;
    }

    return next.handle();
  }
}
