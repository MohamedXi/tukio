import type { Actor } from './Actor.js';

export interface DomainEvent<TPayload> {
  eventId: string;
  eventType: string;
  eventVersion: 'v1' | 'v2';
  occurredAt: string;
  correlationId: string;
  causationId: string | null;
  actor: Actor;
  aggregate: { type: string; id: string };
  payload: TPayload;
}
