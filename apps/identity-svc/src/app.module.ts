import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigurationModule } from './infrastructure/config/config.module.js';
import { EnvironmentConfigService } from './infrastructure/config/environment-config.service.js';
import { LoggerModule } from './infrastructure/logger/logger.module.js';
import { HttpModule } from './infrastructure/http/http.module.js';
import { UserProfileEntity } from './infrastructure/persistence/typeorm/entities/user-profile.entity.js';

@Module({
  imports: [
    ConfigurationModule,
    LoggerModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigurationModule],
      inject: [EnvironmentConfigService],
      useFactory: (config: EnvironmentConfigService) => {
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
