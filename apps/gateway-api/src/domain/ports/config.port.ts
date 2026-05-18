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
 * Throttler scopes (Architecture lines 703-708 + Story 1.2c AC3):
 *  - `default` 60/min/IP for anonymous traffic
 *  - `sensitive` 5/min/IP for register/login/password-reset/payment endpoints
 *
 * Note: `POST /v1/auth/pro/register` applies a per-route override of the
 * `default` scope (3/min via `@Throttle({ default: { limit: 3, ttl: 60_000 } })`
 * in `AuthProController`). This value is intentionally hardcoded at the
 * controller level (same pattern as `AuthCustomerController` sensitive limit).
 */
export interface ThrottlerConfig {
  defaultLimit: number;
  defaultTtlMs: number;
  sensitiveLimit: number;
  sensitiveTtlMs: number;
}

/**
 * Frontend zone base URLs consumed by the post-login redirect resolver
 * (Story 1.4a). Each maps to a `*.tukio.one` host in production.
 */
export interface ZoneBaseUrlsConfig {
  public: string;
  seller: string;
  admin: string;
}

/**
 * Keycloak OAuth client IDs used when initiating the Authorization Code +
 * PKCE flow (Story 1.4a). `tukio-web` covers customers and pros; `tukio-admin`
 * is reserved for the admin console (forces TOTP via the dedicated flow).
 */
export interface KeycloakOAuthClientsConfig {
  web: string;
  admin: string;
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
  /** HMAC secret signing the state JWT (Story 1.4a). */
  getStateJwtSecret(): string;
  /** Separate HMAC secret for the pkce-state cookie JWE (Story 1.4a review DN1). */
  getPkceCookieHmacSecret(): string;
  /** Frontend zone base URLs for the post-login redirect resolver (Story 1.4a). */
  getZoneBaseUrls(): ZoneBaseUrlsConfig;
  /** Keycloak OAuth client IDs (Story 1.4a). */
  getKeycloakOAuthClients(): KeycloakOAuthClientsConfig;
  /** Dev-only flag dropping cookie Secure attribute (Story 1.4a AC6). */
  isDevInsecureCookiesEnabled(): boolean;
}
