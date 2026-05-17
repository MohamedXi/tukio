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
  clientId: string;
  audience: string;
}

/**
 * Service-account credentials for the Keycloak Admin API (Story 1.2b).
 * Auth via `clientCredentials` grant against the `tukio-api` confidential
 * client (Story 1.1). Secret comes from Doppler (`KEYCLOAK_CLIENT_SECRET_TUKIO_API`).
 */
export interface KeycloakAdminConfig {
  url: string;
  realm: string;
  clientId: string;
  clientSecret: string;
}

export interface NatsConfig {
  url: string;
  streamName: string;
  replicas: number;
}

/** INSEE SIRENE V3.11 apiKey auth (Story 1.3b deviation — no OAuth2). */
export interface InseeConfig {
  apiUrl: string;
  apiKey: string;
}

/** Cloudflare R2 KYC bucket config (AWS SDK S3 v3 compatible, Story 1.3b). */
export interface R2KycConfig {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export interface IConfigService {
  getNodeEnv(): 'development' | 'test' | 'production';
  getServiceName(): string;
  getServiceVersion(): string;
  getPort(): number;
  getLogLevel(): 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
  getDatabaseConfig(): DatabaseConfig;
  getKeycloakConfig(): KeycloakConfig;
  /** Service-account credentials for Keycloak Admin API (Story 1.2b). */
  getKeycloakAdminConfig(): KeycloakAdminConfig;
  /** HMAC-shared secret for `InternalServiceGuard` on `/internal/*` endpoints (Story 1.2b). */
  getInternalServiceSecret(): string;
  /** Public-facing apex URL used to build email-verify links (Story 1.2a use case). */
  getPublicBaseUrl(): string;
  getNatsConfig(): NatsConfig;
  /** INSEE SIRENE V3.11 apiKey config (Story 1.3b). */
  getInseeConfig(): InseeConfig;
  /** Cloudflare R2 KYC storage config (Story 1.3b). */
  getR2KycConfig(): R2KycConfig;
  /** R2 KYC bucket name (convenience getter used by the use-case proxy wiring). */
  getR2KycBucket(): string;
}
