import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  IConfigService,
  IdentitySvcConfig,
  KeycloakConfig,
  KeycloakOAuthClientsConfig,
  RedisConfig,
  ThrottlerConfig,
  ZoneBaseUrlsConfig,
} from '../../domain/ports/config.port.js';
import type { Env } from './env.schema.js';

@Injectable()
export class EnvironmentConfigService implements IConfigService {
  constructor(private readonly nestConfig: ConfigService<Env, true>) {}

  private get<K extends keyof Env>(key: K): Env[K] {
    return this.nestConfig.get(key, { infer: true });
  }

  getNodeEnv(): 'development' | 'test' | 'production' {
    return this.get('NODE_ENV');
  }

  getServiceName(): string {
    return this.get('SERVICE_NAME');
  }

  getServiceVersion(): string {
    return this.get('SERVICE_VERSION');
  }

  getPort(): number {
    return this.get('PORT');
  }

  getCorsOrigins(): string[] {
    return this.get('CORS_ORIGINS')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
  }

  getLogLevel(): 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' {
    return this.get('LOG_LEVEL');
  }

  getKeycloakConfig(): KeycloakConfig {
    return {
      url: this.get('KEYCLOAK_URL'),
      realm: this.get('KEYCLOAK_REALM'),
      clientId: this.get('KEYCLOAK_CLIENT_ID'),
      audience: this.get('KEYCLOAK_AUDIENCE'),
    };
  }

  getIdentitySvcConfig(): IdentitySvcConfig {
    return {
      url: this.get('IDENTITY_SVC_URL'),
      timeoutMs: this.get('IDENTITY_SVC_TIMEOUT_MS'),
      retries: this.get('IDENTITY_SVC_RETRIES'),
    };
  }

  getRedisConfig(): RedisConfig {
    return {
      url: this.get('REDIS_URL'),
    };
  }

  getThrottlerConfig(): ThrottlerConfig {
    return {
      defaultLimit: this.get('THROTTLER_DEFAULT_LIMIT'),
      defaultTtlMs: this.get('THROTTLER_DEFAULT_TTL_MS'),
      sensitiveLimit: this.get('THROTTLER_SENSITIVE_LIMIT'),
      sensitiveTtlMs: this.get('THROTTLER_SENSITIVE_TTL_MS'),
    };
  }

  getInternalServiceSecret(): string {
    return this.get('TUKIO_INTERNAL_SERVICE_SECRET');
  }

  getPublicBaseUrl(): string {
    return this.get('PUBLIC_BASE_URL');
  }

  getStateJwtSecret(): string {
    return this.get('STATE_JWT_HMAC_SECRET');
  }

  getPkceCookieHmacSecret(): string {
    return this.get('PKCE_COOKIE_HMAC_SECRET');
  }

  getZoneBaseUrls(): ZoneBaseUrlsConfig {
    return {
      public: this.get('ZONE_BASE_URL_PUBLIC'),
      seller: this.get('ZONE_BASE_URL_SELLER'),
      admin: this.get('ZONE_BASE_URL_ADMIN'),
    };
  }

  getKeycloakOAuthClients(): KeycloakOAuthClientsConfig {
    return {
      web: this.get('KEYCLOAK_OAUTH_CLIENT_WEB_ID'),
      admin: this.get('KEYCLOAK_OAUTH_CLIENT_ADMIN_ID'),
    };
  }

  isDevInsecureCookiesEnabled(): boolean {
    return this.get('TUKIO_DEV_INSECURE_COOKIES') === '1';
  }
}
