import { Module } from '@nestjs/common';
import { EVENT_PUBLISHER } from '../../../domain/ports/tokens.js';
import { LoggerModule } from '../../logger/logger.module.js';
import { NatsPublisher } from './nats.publisher.js';

@Module({
  imports: [LoggerModule],
  providers: [
    {
      provide: EVENT_PUBLISHER,
      useClass: NatsPublisher,
    },
  ],
  exports: [EVENT_PUBLISHER],
})
export class NatsPublisherModule {}
