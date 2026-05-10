import { Inject, Injectable, Optional } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import type { Pool } from 'pg';
import type { DomainEvent } from '@tukio/contracts/types/DomainEvent';
import { correlationContext } from '../correlation/correlation-context.js';
import { TransactionContext } from './transaction-context.js';
import { OutboxEntity } from './outbox.entity.js';

export const OUTBOX_PUBLISHER = Symbol('OUTBOX_PUBLISHER');
export const OUTBOX_NOTIFY_POOL = Symbol('OUTBOX_NOTIFY_POOL');

// OutboxPublisher — implements the transactional outbox pattern.
// Inserts events into the `outbox` table within the current TypeORM transaction,
// then emits pg_notify to wake the OutboxRelayService immediately.
//
// TRANSACTION ATOMICITY: Uses TransactionContext.getEntityManager() to share the
// caller's transaction. If no active transaction, falls back to DataSource.manager
// (non-atomic — acceptable for use cases without explicit transaction wrapping).
// The OutboxRelayService's polling fallback ensures events are never permanently lost.
@Injectable()
export class OutboxPublisher {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Optional() @Inject(OUTBOX_NOTIFY_POOL) private readonly notifyPool?: Pool,
  ) {}

  async publish<TPayload>(event: DomainEvent<TPayload>): Promise<void> {
    const resolvedCorrelationId =
      event.correlationId || correlationContext.getCorrelationId() || crypto.randomUUID();

    const row: Partial<OutboxEntity> = {
      id: event.eventId,
      aggregateType: event.aggregate.type,
      aggregateId: event.aggregate.id,
      eventType: event.eventType,
      eventVersion: parseInt(event.eventVersion.replace('v', ''), 10),
      payload: { ...(event.payload as object), _actor: event.actor },
      correlationId: resolvedCorrelationId,
      status: 'pending',
      retryCount: 0,
      createdAt: new Date(),
    };

    const manager = TransactionContext.getEntityManager() ?? this.dataSource.manager;
    await manager.getRepository(OutboxEntity).insert(row);

    // pg_notify is delivered after the transaction commits (Postgres semantics).
    // Uses the dedicated notify pool if available, otherwise queries via the manager.
    try {
      if (this.notifyPool) {
        const client = await this.notifyPool.connect();
        try {
          await client.query(`SELECT pg_notify('tukio_outbox_new', $1)`, [event.eventId]);
        } finally {
          client.release();
        }
      } else {
        await manager.query(`SELECT pg_notify('tukio_outbox_new', $1)`, [event.eventId]);
      }
    } catch {
      // pg_notify is best-effort — the outbox relay polling fallback (30s) covers failures.
    }
  }
}
