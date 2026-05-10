import type { DomainEvent } from '@tukio/contracts/types/DomainEvent';

// Placeholder port — real impl arrives Story 0.7 (@tukio/messaging NATS JetStream wrapper).
export interface IEventPublisher {
  publish<TPayload>(event: DomainEvent<TPayload>): Promise<void>;
}
