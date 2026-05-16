import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  DatabaseConfig,
  IConfigService,
  InseeConfig,
  KeycloakAdminConfig,
  KeycloakConfig,
  NatsConfig,
  R2KycConfig,
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

  getLogLevel(): 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' {
    return this.get('LOG_LEVEL');
  }

  getDatabaseConfig(): DatabaseConfig {
    return {
      host: this.get('DB_HOST'),
      port: this.get('DB_PORT'),
      username: this.get('DB_USER'),
      password: this.get('DB_PASSWORD'),
      database: this.get('DB_NAME'),
      verbose: this.get('DB_VERBOSE') ?? false,
    };
  }

  getKeycloakConfig(): KeycloakConfig {
    return {
      url: this.get('KEYCLOAK_URL'),
      realm: this.get('KEYCLOAK_REALM'),
      clientId: this.get('KEYCLOAK_CLIENT_ID'),
      audience: this.get('KEYCLOAK_AUDIENCE'),
    };
  }

  getKeycloakAdminConfig(): KeycloakAdminConfig {
    return {
      url: this.get('KEYCLOAK_URL'),
      realm: this.get('KEYCLOAK_REALM'),
      clientId: this.get('KEYCLOAK_CLIENT_ID'),
      clientSecret: this.get('KEYCLOAK_CLIENT_SECRET_TUKIO_API'),
    };
  }

  getInternalServiceSecret(): string {
    return this.get('TUKIO_INTERNAL_SERVICE_SECRET');
  }

  getPublicBaseUrl(): string {
    return this.get('PUBLIC_BASE_URL');
  }

  getNatsConfig(): NatsConfig {
    return {
      url: this.get('NATS_URL'),
      streamName: this.get('NATS_STREAM_NAME'),
      replicas: this.get('NATS_REPLICAS'),
    };
  }

  getInseeConfig(): InseeConfig {
    return {
      apiUrl: this.get('INSEE_API_URL'),
      // In dev/test the key is optional; the adapter handles undefined gracefully.
      apiKey: this.get('INSEE_API_KEY') ?? '',
    };
  }

  getR2KycConfig(): R2KycConfig {
    return {
      endpoint: this.get('R2_KYC_ENDPOINT') ?? '',
      bucket: this.get('R2_KYC_BUCKET'),
      accessKeyId: this.get('R2_KYC_ACCESS_KEY_ID') ?? '',
      secretAccessKey: this.get('R2_KYC_SECRET_ACCESS_KEY') ?? '',
    };
  }

  getR2KycBucket(): string {
    return this.get('R2_KYC_BUCKET');
  }
}
