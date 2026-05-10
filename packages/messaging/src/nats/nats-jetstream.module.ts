import { type DynamicModule, type InjectionToken, Module } from '@nestjs/common';
import { NatsJetStreamClient, NATS_JETSTREAM_CLIENT } from './nats-jetstream-client.js';
import type { NatsJetStreamConfig, StreamConfig } from './types.js';

export interface NatsJetStreamModuleOptions {
  url: string | string[];
  name?: string;
  streams?: StreamConfig[];
}

export interface NatsJetStreamModuleAsyncOptions<TDeps extends unknown[] = []> {
  inject?: InjectionToken[];
  useFactory: (...deps: TDeps) => Promise<NatsJetStreamModuleOptions> | NatsJetStreamModuleOptions;
}

@Module({})
export class NatsJetStreamModule {
  static forRoot(options: NatsJetStreamModuleOptions): DynamicModule {
    return NatsJetStreamModule.forRootAsync({ useFactory: () => options });
  }

  static forRootAsync<TDeps extends unknown[] = []>(
    asyncOptions: NatsJetStreamModuleAsyncOptions<TDeps>,
  ): DynamicModule {
    const clientProvider = {
      provide: NATS_JETSTREAM_CLIENT,
      inject: asyncOptions.inject ?? [],
      useFactory: async (...deps: TDeps): Promise<NatsJetStreamClient> => {
        const options = await asyncOptions.useFactory(...deps);
        const config: NatsJetStreamConfig = {
          url: options.url,
          name: options.name,
          reconnect: true,
          maxReconnectAttempts: -1,
          reconnectTimeWait: 2_000,
          pingInterval: 30_000,
        };
        const client = new NatsJetStreamClient();
        await client.connect(config);
        for (const stream of options.streams ?? []) {
          await client.ensureStream(stream);
        }
        return client;
      },
    };

    return {
      global: true,
      module: NatsJetStreamModule,
      providers: [clientProvider],
      exports: [NATS_JETSTREAM_CLIENT],
    };
  }
}
