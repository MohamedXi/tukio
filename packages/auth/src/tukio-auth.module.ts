import { type DynamicModule, type InjectionToken, Module } from '@nestjs/common';
import { JwksCacheService, JWKS_CACHE } from './services/jwks-cache.service.js';
import { ActorResolverService, ACTOR_RESOLVER } from './services/actor-resolver.service.js';
import { KeycloakJwtGuard, KEYCLOAK_JWT_GUARD } from './guards/keycloak-jwt.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { ActorPropagationInterceptor } from './interceptors/actor-propagation.interceptor.js';

export interface TukioAuthConfig {
  keycloakUrl: string;
  realm: string;
  clientId: string;
  jwksRefreshIntervalMs?: number;
  issuer?: string;
  audience?: string | string[];
}

export interface TukioAuthModuleAsyncOptions<TDeps extends unknown[] = []> {
  inject?: InjectionToken[];
  useFactory: (...deps: TDeps) => Promise<TukioAuthConfig> | TukioAuthConfig;
}

@Module({})
export class TukioAuthModule {
  static forRoot(config: TukioAuthConfig): DynamicModule {
    return TukioAuthModule.forRootAsync({ useFactory: () => config });
  }

  static forRootAsync<TDeps extends unknown[] = []>(
    asyncOptions: TukioAuthModuleAsyncOptions<TDeps>,
  ): DynamicModule {
    const configProvider = {
      provide: 'TUKIO_AUTH_CONFIG',
      inject: asyncOptions.inject ?? [],
      useFactory: (...deps: TDeps) => asyncOptions.useFactory(...deps),
    };

    return {
      global: true,
      module: TukioAuthModule,
      providers: [
        configProvider,
        JwksCacheService,
        { provide: JWKS_CACHE, useExisting: JwksCacheService },
        ActorResolverService,
        { provide: ACTOR_RESOLVER, useExisting: ActorResolverService },
        KeycloakJwtGuard,
        { provide: KEYCLOAK_JWT_GUARD, useExisting: KeycloakJwtGuard },
        RolesGuard,
        ActorPropagationInterceptor,
      ],
      exports: [
        'TUKIO_AUTH_CONFIG',
        JWKS_CACHE,
        ACTOR_RESOLVER,
        KEYCLOAK_JWT_GUARD,
        KeycloakJwtGuard,
        RolesGuard,
        ActorPropagationInterceptor,
      ],
    };
  }
}
