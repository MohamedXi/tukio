import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { Redis } from 'ioredis';
import { TukioAuthModule } from '@tukio/auth/module';
import { KeycloakJwtGuard } from '@tukio/auth/guards';
import { CorrelationContextModule } from '@tukio/messaging/correlation';
import { ConfigurationModule } from './infrastructure/config/config.module.js';
import { LoggerModule } from './infrastructure/logger/logger.module.js';
import { HttpModule } from './infrastructure/http/http.module.js';
import { UseCasesProxyModule } from './infrastructure/usecases-proxy/usecases-proxy.module.js';
import { EnvironmentConfigService } from './infrastructure/config/environment-config.service.js';

/**
 * Gateway-api root module (Story 1.2c — BFF Pretre).
 *
 * Wiring overview :
 *  - `ConfigurationModule` + `LoggerModule` — boot config / pino.
 *  - `TukioAuthModule` — JWT validation via JWKS (KeycloakJwtGuard global
 *    + `@Public()` opt-out for register).
 *  - `ThrottlerModule` — Redis-backed rate limiting. Single `default` scope
 *    (60/min/IP) at module level ; sensitive routes tighten via per-handler
 *    `@Throttle({ default: { limit: 5, ttl: 60_000 } })`.
 *  - `CorrelationContextModule` — AsyncLocalStorage-backed correlation id
 *    propagated by the `correlationMiddleware` registered in main.ts.
 *  - `UseCasesProxyModule.register()` — forwarder factories (per Pattern Pretre).
 *  - `HttpModule` — controllers (health, auth-customer).
 */
@Module({
  imports: [
    ConfigurationModule,
    LoggerModule,
    CorrelationContextModule,
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
    ThrottlerModule.forRootAsync({
      imports: [ConfigurationModule],
      inject: [EnvironmentConfigService],
      useFactory: (config: EnvironmentConfigService) => {
        const throttler = config.getThrottlerConfig();
        const { url } = config.getRedisConfig();
        return {
          throttlers: [
            {
              name: 'default',
              limit: throttler.defaultLimit,
              ttl: throttler.defaultTtlMs,
            },
          ],
          storage: new ThrottlerStorageRedisService(new Redis(url)),
        };
      },
    }),
    UseCasesProxyModule.register(),
    HttpModule,
  ],
  providers: [
    // Global guards — order in DI is irrelevant ; both run on every request.
    { provide: APP_GUARD, useClass: KeycloakJwtGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
