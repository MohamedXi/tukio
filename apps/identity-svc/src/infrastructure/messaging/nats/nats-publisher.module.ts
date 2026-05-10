import { Module } from '@nestjs/common';
import { OutboxPublisherModule } from '@tukio/messaging/outbox';
import { OutboxRelayModule } from '@tukio/messaging/outbox/relay';
import { NatsJetStreamModule } from '@tukio/messaging/nats';
import { EVENT_PUBLISHER } from '../../../domain/ports/tokens.js';
import { OUTBOX_PUBLISHER } from '@tukio/messaging';
import { ConfigurationModule } from '../../config/config.module.js';
import { EnvironmentConfigService } from '../../config/environment-config.service.js';

@Module({
  imports: [
    ConfigurationModule,
    OutboxPublisherModule,
    OutboxRelayModule.forRootAsync<[EnvironmentConfigService]>({
      inject: [EnvironmentConfigService],
      useFactory: (config: EnvironmentConfigService) => {
        const nats = config.getNatsConfig();
        const db = config.getDatabaseConfig();
        return {
          streamName: nats.streamName,
          subjectPrefix: 'tukio.identity',
          replicas: nats.replicas,
          dbHost: db.host,
          dbPort: db.port,
          dbUser: db.username,
          dbPassword: db.password,
          dbName: db.database,
        };
      },
    }),
    NatsJetStreamModule.forRootAsync<[EnvironmentConfigService]>({
      inject: [EnvironmentConfigService],
      useFactory: (config: EnvironmentConfigService) => {
        const nats = config.getNatsConfig();
        return {
          url: nats.url,
          name: 'identity-svc',
          streams: [
            {
              name: nats.streamName,
              subjects: ['tukio.identity.>'],
              replicas: nats.replicas,
            },
          ],
        };
      },
    }),
  ],
  providers: [
    {
      provide: EVENT_PUBLISHER,
      useExisting: OUTBOX_PUBLISHER,
    },
  ],
  exports: [EVENT_PUBLISHER],
})
export class NatsPublisherModule {}
