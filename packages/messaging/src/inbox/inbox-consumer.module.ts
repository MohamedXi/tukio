import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InboxEntity } from './inbox.entity.js';
import { InboxConsumer, INBOX_CONSUMER } from './inbox-consumer.js';

@Module({
  imports: [TypeOrmModule.forFeature([InboxEntity])],
  providers: [InboxConsumer, { provide: INBOX_CONSUMER, useExisting: InboxConsumer }],
  exports: [InboxConsumer, INBOX_CONSUMER],
})
export class InboxConsumerModule {}
