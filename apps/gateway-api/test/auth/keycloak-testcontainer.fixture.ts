import { resolve } from 'node:path';
import {
  startKeycloakContainer,
  type KeycloakContainerHandle,
} from '@tukio/testing/testcontainers/keycloak';

const TUKIO_REALM = 'tukio';
const REALM_EXPORT_PATH = resolve(
  __dirname,
  '../../../../infra/keycloak/realm-export/tukio.realm.json',
);

/**
 * Story 1.4b Task 10 — shared Keycloak fixture for the auth e2e suite.
 *
 * Boots a Keycloak 25 container with the canonical tukio realm imported
 * (Story 1.1 export). Returns a `KeycloakContainerHandle` whose `url` field
 * is fed into `KEYCLOAK_URL` of the gateway-api boot env so the OAuth client
 * targets a real authorize endpoint.
 *
 * Slow boot (~15s) — each e2e file reuses one container via beforeAll.
 */
export async function startGatewayKeycloak(): Promise<KeycloakContainerHandle> {
  return startKeycloakContainer({
    realm: TUKIO_REALM,
    importJsonPath: REALM_EXPORT_PATH,
    version: '25.0',
  });
}

/**
 * Builds the env block expected by `validateEnv` for the gateway-api app
 * during e2e tests. Keeps secrets short (32 chars) and points
 * `IDENTITY_SVC_URL` at a localhost placeholder — login endpoints do NOT
 * forward to identity-svc.
 */
export function buildGatewayEnv(keycloakUrl: string): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'test',
    PORT: '0',
    LOG_LEVEL: 'warn',
    KEYCLOAK_URL: keycloakUrl,
    KEYCLOAK_REALM: 'tukio',
    KEYCLOAK_CLIENT_ID: 'tukio-api',
    KEYCLOAK_AUDIENCE: 'tukio-api',
    IDENTITY_SVC_URL: 'http://localhost:4001',
    IDENTITY_SVC_TIMEOUT_MS: '5000',
    IDENTITY_SVC_RETRIES: '0',
    REDIS_URL: 'redis://localhost:6379',
    THROTTLER_DEFAULT_LIMIT: '60',
    THROTTLER_DEFAULT_TTL_MS: '60000',
    THROTTLER_SENSITIVE_LIMIT: '5',
    THROTTLER_SENSITIVE_TTL_MS: '60000',
    TUKIO_INTERNAL_SERVICE_SECRET: 'e2e-internal-svc-secret-32-bytes!!',
    PUBLIC_BASE_URL: 'http://localhost:3000',
    STATE_JWT_HMAC_SECRET: 'e2e-state-jwt-secret-32-bytes-min!',
    PKCE_COOKIE_HMAC_SECRET: 'e2e-pkce-cookie-secret-32-bytes!!',
    ZONE_BASE_URL_PUBLIC: 'http://localhost:3000',
    ZONE_BASE_URL_SELLER: 'http://localhost:3002',
    ZONE_BASE_URL_ADMIN: 'http://localhost:3003',
    KEYCLOAK_OAUTH_CLIENT_WEB_ID: 'tukio-web',
    KEYCLOAK_OAUTH_CLIENT_ADMIN_ID: 'tukio-admin',
    CORS_ORIGINS:
      'http://localhost:3000,http://localhost:3002,http://localhost:3003',
  };
}
