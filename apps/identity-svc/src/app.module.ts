import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { IConfigService } from './domain/ports/config.port.js';
import { CONFIG_SERVICE } from './domain/ports/tokens.js';
import { ConfigurationModule } from './infrastructure/config/config.module.js';
import { LoggerModule } from './infrastructure/logger/logger.module.js';
import { HttpModule } from './infrastructure/http/http.module.js';
import { UseCasesProxyModule } from './infrastructure/usecases-proxy/usecases-proxy.module.js';
import { UserProfileEntity } from './infrastructure/persistence/typeorm/entities/user-profile.entity.js';

@Module({
  imports: [
    ConfigurationModule,
    LoggerModule,
    // Pattern Pretre: AppModule is the single wiring point for use cases.
    // UseCasesProxyModule.register() is global so controllers in HttpModule
    // can inject its exports without explicitly importing it.
    UseCasesProxyModule.register(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigurationModule],
      inject: [CONFIG_SERVICE],
      useFactory: (config: IConfigService) => {
        const db = config.getDatabaseConfig();
        return {
          type: 'postgres' as const,
          host: db.host,
          port: db.port,
          username: db.username,
          password: db.password,
          database: db.database,
          entities: [UserProfileEntity],
          synchronize: false,
          migrationsRun: false,
          logging: db.verbose
            ? ['query', 'error', 'warn', 'migration']
            : ['error', 'warn', 'migration'],
        };
      },
    }),
    HttpModule,
  ],
})
export class AppModule {}
