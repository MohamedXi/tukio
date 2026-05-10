export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  verbose: boolean;
}

export interface KeycloakConfig {
  url: string;
  realm: string;
}

export interface NatsConfig {
  url: string;
}

export interface IConfigService {
  getNodeEnv(): 'development' | 'test' | 'production';
  getServiceName(): string;
  getServiceVersion(): string;
  getPort(): number;
  getLogLevel(): 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
  getDatabaseConfig(): DatabaseConfig;
  getKeycloakConfig(): KeycloakConfig;
  getNatsConfig(): NatsConfig;
}
