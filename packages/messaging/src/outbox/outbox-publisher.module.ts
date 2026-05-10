import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboxEntity } from './outbox.entity.js';
import { OutboxPublisher, OUTBOX_PUBLISHER } from './outbox-publisher.js';

@Module({
  imports: [TypeOrmModule.forFeature([OutboxEntity])],
  providers: [
    OutboxPublisher,
    {
      provide: OUTBOX_PUBLISHER,
      useExisting: OutboxPublisher,
    },
  ],
  exports: [OutboxPublisher, OUTBOX_PUBLISHER],
})
export class OutboxPublisherModule {}
