import { type DynamicModule, type InjectionToken, Module } from '@nestjs/common';
import { Pool } from 'pg';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboxEntity } from './outbox.entity.js';
import {
  OutboxRelayService,
  OUTBOX_RELAY_CONFIG,
  type OutboxRelayConfig,
} from './outbox-relay.service.js';

export interface OutboxRelayModuleOptions extends OutboxRelayConfig {
  dbUrl?: string;
  dbHost?: string;
  dbPort?: number;
  dbUser?: string;
  dbPassword?: string;
  dbName?: string;
}

export interface OutboxRelayModuleAsyncOptions<TDeps extends unknown[] = []> {
  inject?: InjectionToken[];
  useFactory: (...deps: TDeps) => Promise<OutboxRelayModuleOptions> | OutboxRelayModuleOptions;
}

@Module({})
export class OutboxRelayModule {
  static forRoot(options: OutboxRelayModuleOptions): DynamicModule {
    return OutboxRelayModule.forRootAsync({ useFactory: () => options });
  }

  static forRootAsync<TDeps extends unknown[] = []>(
    asyncOptions: OutboxRelayModuleAsyncOptions<TDeps>,
  ): DynamicModule {
    const optionsProvider = {
      provide: 'OUTBOX_RELAY_OPTIONS',
      inject: asyncOptions.inject ?? [],
      useFactory: (...deps: TDeps) => asyncOptions.useFactory(...deps),
    };

    const listenPoolProvider = {
      provide: 'OUTBOX_LISTEN_POOL',
      inject: ['OUTBOX_RELAY_OPTIONS' as InjectionToken],
      useFactory: (opts: OutboxRelayModuleOptions) =>
        new Pool({
          connectionString: opts.dbUrl,
          host: opts.dbHost ?? 'localhost',
          port: opts.dbPort ?? 5432,
          user: opts.dbUser,
          password: opts.dbPassword,
          database: opts.dbName,
          max: 1,
        }),
    };

    const configProvider = {
      provide: OUTBOX_RELAY_CONFIG,
      inject: ['OUTBOX_RELAY_OPTIONS' as InjectionToken],
      useFactory: (opts: OutboxRelayModuleOptions): OutboxRelayConfig => ({
        streamName: opts.streamName,
        subjectPrefix: opts.subjectPrefix,
        replicas: opts.replicas ?? 1,
      }),
    };

    return {
      module: OutboxRelayModule,
      imports: [TypeOrmModule.forFeature([OutboxEntity])],
      providers: [optionsProvider, listenPoolProvider, configProvider, OutboxRelayService],
      exports: [OutboxRelayService],
    };
  }
}
