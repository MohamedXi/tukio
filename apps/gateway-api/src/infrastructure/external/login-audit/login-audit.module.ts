import { Module } from '@nestjs/common';
import { LOGIN_AUDIT_EVENT_PUBLISHER } from '../../../domain/ports/tokens.js';
import { NoopLoginAuditEventPublisher } from './noop-login-audit-event-publisher.js';

/**
 * Story 1.4b — wires `ILoginAuditEventPublisher` to the no-op pino-logging
 * adapter. The token is consumed by `HandleCallbackUseCase` via the
 * `UseCasesProxyModule` factory.
 *
 * Swap to a NATS-backed adapter in Story 1.4d.
 */
@Module({
  providers: [
    {
      provide: LOGIN_AUDIT_EVENT_PUBLISHER,
      useClass: NoopLoginAuditEventPublisher,
    },
  ],
  exports: [LOGIN_AUDIT_EVENT_PUBLISHER],
})
export class LoginAuditModule {}
