import { Injectable, Logger } from '@nestjs/common';
import type { UserLoggedInV1Payload } from '@tukio/contracts/events/identity/user-logged-in.v1';
import type { ILoginAuditEventPublisher } from '../../../domain/ports/login-audit-event-publisher.port.js';

/**
 * Story 1.4b — placeholder publisher that logs the audit event to pino at
 * `info` level. Wiring `NatsJetStreamClient` into gateway-api is deferred to
 * Story 1.4d (observability scope) — gateway-api currently runs without a
 * NATS connection, and forcing it would make boot a hard dependency on NATS.
 *
 * For Stories 1.4a/b development the audit trail is still observable via the
 * structured pino logs (kept under the `audit` namespace), and the
 * `HandleCallbackUseCase` calls this publisher via the
 * `ILoginAuditEventPublisher` port — the use case is unaware of the swap.
 */
@Injectable()
export class NoopLoginAuditEventPublisher implements ILoginAuditEventPublisher {
  private readonly logger = new Logger('LoginAudit');

  publishLoggedIn(payload: UserLoggedInV1Payload): Promise<void> {
    this.logger.log(
      {
        event: 'identity.user.logged-in.v1',
        userId: payload.userId,
        locale: payload.locale,
        role: payload.role,
        loggedInAt: payload.loggedInAt,
      },
      'audit',
    );
    return Promise.resolve();
  }
}
