import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  DatabaseConfig,
  IConfigService,
  KeycloakConfig,
  NatsConfig,
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
    };
  }

  getNatsConfig(): NatsConfig {
    return {
      url: this.get('NATS_URL'),
      streamName: this.get('NATS_STREAM_NAME'),
      replicas: this.get('NATS_REPLICAS'),
    };
  }
}
