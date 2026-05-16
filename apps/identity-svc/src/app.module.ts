import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { IConfigService } from './domain/ports/config.port.js';
import { CONFIG_SERVICE } from './domain/ports/tokens.js';
import { ConfigurationModule } from './infrastructure/config/config.module.js';
import { LoggerModule } from './infrastructure/logger/logger.module.js';
import { HttpModule } from './infrastructure/http/http.module.js';
import { UseCasesProxyModule } from './infrastructure/usecases-proxy/usecases-proxy.module.js';
import { UserProfileEntity } from './infrastructure/persistence/typeorm/entities/user-profile.entity.js';
import { EmailVerificationTokenEntity } from './infrastructure/persistence/typeorm/entities/email-verification-token.entity.js';
import { ALL_MIGRATIONS } from './infrastructure/persistence/typeorm/migrations/index.js';
import { OutboxEntity } from '@tukio/messaging/outbox/entity';
import { TukioAuthModule } from '@tukio/auth/module';
import { KeycloakJwtGuard } from '@tukio/auth/guards';
import { EnvironmentConfigService } from './infrastructure/config/environment-config.service.js';

@Module({
  imports: [
    ConfigurationModule,
    LoggerModule,
    // @tukio/auth: global JWT guard + RBAC. @Public() opt-out for health/public endpoints.
    TukioAuthModule.forRootAsync<[EnvironmentConfigService]>({
      inject: [EnvironmentConfigService],
      useFactory: (config: EnvironmentConfigService) => {
        const kc = config.getKeycloakConfig();
        return {
          keycloakUrl: kc.url,
          realm: kc.realm,
          clientId: kc.clientId,
          audience: kc.audience,
          jwksRefreshIntervalMs: 600_000,
        };
      },
    }),
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
          // CRITICAL : explicit entity list — `forFeature` does NOT add entities
          // to the DataSource metadata in @nestjs/typeorm v11 without
          // `autoLoadEntities: true`. Missing `EmailVerificationTokenEntity`
          // here caused a runtime `EntityMetadataNotFoundError` on first token
          // insert (review patch 1.2b CRITICAL). OutboxEntity included as
          // defense-in-depth so OutboxPublisher's `manager.getRepository(OutboxEntity)`
          // never falls back to the parent DataSource alone.
          entities: [
            UserProfileEntity,
            EmailVerificationTokenEntity,
            OutboxEntity,
          ],
          // Auto-apply pending migrations at boot. TypeORM tracks applied
          // migrations in a `migrations` table and wraps each in a transaction,
          // so this is idempotent and safe to run on every container start.
          // Single-replica per service on DO Droplet → no multi-leader race.
          // If a migration fails, the container crashes and the deploy rolls
          // back instead of leaving the schema in a half-applied state.
          migrations: ALL_MIGRATIONS,
          migrationsRun: true,
          synchronize: false,
          logging: db.verbose
            ? ['query', 'error', 'warn', 'migration']
            : ['error', 'warn', 'migration'],
        };
      },
    }),
    HttpModule,
  ],
  providers: [
    // Apply KeycloakJwtGuard globally — use @Public() to opt-out per route.
    { provide: APP_GUARD, useClass: KeycloakJwtGuard },
  ],
})
export class AppModule {}
