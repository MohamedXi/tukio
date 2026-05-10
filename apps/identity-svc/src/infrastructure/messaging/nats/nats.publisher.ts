import { Inject, Injectable } from '@nestjs/common';
import type { DomainEvent } from '@tukio/contracts/types/DomainEvent';
import type { IEventPublisher } from '../../../domain/ports/event-publisher.port.js';
import type { ILogger } from '../../../domain/ports/logger.port.js';
import { LOGGER } from '../../../domain/ports/tokens.js';

// Placeholder NATS publisher — Story 0.7 (@tukio/messaging) will replace this
// with a real JetStream-backed implementation tied to the outbox table.
// For now, we just log the would-be publish so the wiring works end-to-end.
@Injectable()
export class NatsPublisher implements IEventPublisher {
  constructor(@Inject(LOGGER) private readonly logger: ILogger) {}

  async publish<TPayload>(event: DomainEvent<TPayload>): Promise<void> {
    this.logger.info('[NatsPublisher placeholder] would publish event', {
      eventId: event.eventId,
      eventType: event.eventType,
      aggregate: event.aggregate,
    });
    return Promise.resolve();
  }
}
