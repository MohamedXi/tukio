/**
 * Gateway-api BFF config port (Story 1.2c).
 *
 * BFF-only — no Postgres, no NATS direct publish, no Keycloak Admin client.
 * Gateway forwards requests to internal services (identity-svc, catalog-svc…)
 * via HTTP with HMAC-signed `X-Internal-Service-*` headers (Story 1.2b guard).
 */

export interface KeycloakConfig {
  url: string;
  realm: string;
  clientId: string;
  audience: string;
}

/**
 * Identity-svc HTTP client config (Story 1.2c). Gateway forwards
 * `POST /v1/auth/customer/register` to identity-svc `POST /internal/customers`.
 */
export interface IdentitySvcConfig {
  url: string;
  timeoutMs: number;
  retries: number;
}

export interface RedisConfig {
  url: string;
}

/**
 * Two throttler scopes (Architecture lines 703-708 + Story 1.2c AC3):
 *  - `default` 60/min/IP for anonymous traffic
 *  - `sensitive` 5/min/IP for register/login/password-reset/payment endpoints
 */
export interface ThrottlerConfig {
  defaultLimit: number;
  defaultTtlMs: number;
  sensitiveLimit: number;
  sensitiveTtlMs: number;
}

export interface IConfigService {
  getNodeEnv(): 'development' | 'test' | 'production';
  getServiceName(): string;
  getServiceVersion(): string;
  getPort(): number;
  getLogLevel(): 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
  getKeycloakConfig(): KeycloakConfig;
  getIdentitySvcConfig(): IdentitySvcConfig;
  getRedisConfig(): RedisConfig;
  getThrottlerConfig(): ThrottlerConfig;
  /** HMAC-shared secret used to sign `/internal/*` forwarded calls (Story 1.2b). */
  getInternalServiceSecret(): string;
  /** Public-facing apex URL — used by downstream services to build email-verify links. */
  getPublicBaseUrl(): string;
}
