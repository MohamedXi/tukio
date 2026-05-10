import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import type { JsMsg } from 'nats';
import { StringCodec } from 'nats';
import type { DomainEvent } from '@tukio/contracts/types/DomainEvent';
import { correlationContext } from '../correlation/correlation-context.js';
import { InboxEntity } from './inbox.entity.js';
import { isCompatibleVersion } from '../versioning/event-versioning.js';

export const INBOX_CONSUMER = Symbol('INBOX_CONSUMER');

const sc = StringCodec();

const BACKOFF_DELAYS_MS = [30_000, 60_000, 120_000, 300_000, 600_000];
const MAX_RETRIES = 5;

@Injectable()
export class InboxConsumer {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  // Handles an incoming NATS JetStream message with full idempotence guarantees.
  // 1. Validates the message against supported versions.
  // 2. Checks for duplicates via inbox table.
  // 3. Executes the handler inside a TypeORM transaction.
  // 4. Acks on success, naks with backoff on failure.
  async handle<TPayload>(
    jsMsg: JsMsg,
    handler: (event: DomainEvent<TPayload>) => Promise<void>,
    supportedVersions: ('v1' | 'v2')[] = ['v1', 'v2'],
  ): Promise<void> {
    let event: DomainEvent<TPayload>;

    try {
      event = JSON.parse(sc.decode(jsMsg.data)) as DomainEvent<TPayload>;
    } catch {
      jsMsg.term();
      return;
    }

    if (!isCompatibleVersion(event.eventType, supportedVersions)) {
      jsMsg.ack();
      return;
    }

    const qr = this.dataSource.createQueryRunner();

    try {
      await qr.connect();
      await qr.startTransaction();
      const existing = await qr.manager.findOne(InboxEntity, {
        where: { eventId: event.eventId },
      });
      if (existing) {
        jsMsg.ack();
        await qr.rollbackTransaction();
        return;
      }

      const row: Partial<InboxEntity> = {
        eventId: event.eventId,
        eventType: event.eventType,
        correlationId: event.correlationId,
        receivedAt: new Date(),
        payload: event.payload as object,
      };
      await qr.manager.getRepository(InboxEntity).insert(row);

      await correlationContext.runWithContext(event.correlationId, async () => {
        await handler(event);
      });

      await qr.manager.update(
        InboxEntity,
        { eventId: event.eventId },
        {
          processedAt: new Date(),
        },
      );

      await qr.commitTransaction();
      jsMsg.ack();
    } catch {
      await qr.rollbackTransaction();
      const deliveryCount = jsMsg.info.redeliveryCount ?? 0;
      const delayMs =
        BACKOFF_DELAYS_MS[Math.min(deliveryCount, BACKOFF_DELAYS_MS.length - 1)] ?? 600_000;

      if (deliveryCount >= MAX_RETRIES) {
        jsMsg.term();
      } else {
        jsMsg.nak(delayMs);
      }
    } finally {
      await qr.release();
    }
  }
}
