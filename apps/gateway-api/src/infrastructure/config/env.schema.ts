import { z } from 'zod';

export const EnvSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    SERVICE_NAME: z.string().min(1).default('gateway-api'),
    SERVICE_VERSION: z.string().min(1).default('0.0.0'),
    PORT: z.coerce.number().int().positive().default(4000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
      .default('info'),
    // Keycloak JWT validation (public client → no client secret needed; gateway
    // only verifies tokens issued by other clients via JWKS).
    KEYCLOAK_URL: z.string().url().min(1).default('http://localhost:8080'),
    KEYCLOAK_REALM: z.string().min(1).default('tukio'),
    KEYCLOAK_CLIENT_ID: z.string().min(1).default('tukio-api'),
    KEYCLOAK_AUDIENCE: z.string().min(1).default('tukio-api'),
    // Identity-svc downstream client (Story 1.2c — gateway forwards register).
    IDENTITY_SVC_URL: z.string().url().min(1).default('http://localhost:4001'),
    // Timeout covers DNS + TLS + full request body upload + identity-svc
    // processing. Story 1.3c uploads up to 16 MB (3 × 5 MB KYC files + JSON
    // payload + multipart framing). At 100 Mbit/s intra-DC = ~1.3 s for the
    // upload alone; identity-svc then runs Keycloak + DB + R2. 30 s is the
    // safe default; override downward in dev where payload sizes are tiny.
    IDENTITY_SVC_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
    IDENTITY_SVC_RETRIES: z.coerce.number().int().min(0).max(10).default(3),
    // Upstash Redis URL — backs ThrottlerStorageRedis (Story 0.10 dev container).
    REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
    // Throttler — 2 scopes (Architecture lines 703-708).
    THROTTLER_DEFAULT_LIMIT: z.coerce.number().int().positive().default(60),
    THROTTLER_DEFAULT_TTL_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(60_000),
    THROTTLER_SENSITIVE_LIMIT: z.coerce.number().int().positive().default(5),
    THROTTLER_SENSITIVE_TTL_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(60_000),
    // HMAC-shared secret protecting `/internal/*` endpoints (Story 1.2b). Must
    // match the value identity-svc has for `TUKIO_INTERNAL_SERVICE_SECRET`.
    // Base64-encoded random bytes (≥ 32). No default in production.
    TUKIO_INTERNAL_SERVICE_SECRET: z.string().min(32),
    // Public apex (used by downstream services to build email-verify links).
    PUBLIC_BASE_URL: z.string().url().min(1).default('http://localhost:3000'),
    // ─── Login flow Keycloak Authorization Code + PKCE (Story 1.4a) ─────
    // HMAC secret signing the state JWT carried through Keycloak callback.
    // Generate per env via `openssl rand -base64 32`. NEVER committed; stored
    // in droplet secrets in prod. ≥ 32 chars enforced.
    STATE_JWT_HMAC_SECRET: z.string().min(32),
    // Separate HMAC secret for the pkce-state cookie (JWE A256GCM) — distinct
    // from STATE_JWT_HMAC_SECRET to limit blast-radius if either secret leaks.
    // Generate independently: `openssl rand -base64 32`. NEVER committed.
    PKCE_COOKIE_HMAC_SECRET: z.string().min(32),
    // Frontend zone base URLs for the post-login redirect resolver. Each must
    // resolve to a `*.tukio.one` host in production (or localhost in dev).
    ZONE_BASE_URL_PUBLIC: z
      .string()
      .url()
      .min(1)
      .default('http://localhost:3000'),
    ZONE_BASE_URL_SELLER: z
      .string()
      .url()
      .min(1)
      .default('http://localhost:3002'),
    ZONE_BASE_URL_ADMIN: z
      .string()
      .url()
      .min(1)
      .default('http://localhost:3003'),
    // Keycloak OAuth client IDs — match the 4 clients provisioned in Story 1.1.
    KEYCLOAK_OAUTH_CLIENT_WEB_ID: z.string().min(1).default('tukio-web'),
    KEYCLOAK_OAUTH_CLIENT_ADMIN_ID: z.string().min(1).default('tukio-admin'),
    // Dev-only flag dropping the cookie Secure attribute when set to '1' AND
    // NODE_ENV=development. Never honored in production (enforced at runtime).
    TUKIO_DEV_INSECURE_COOKIES: z.enum(['0', '1']).optional(),
    // CORS allowlist — comma-separated origins. Frontend apps (public/seller/admin)
    // make `withCredentials` XHRs to gateway-api, so the browser requires an
    // explicit `Access-Control-Allow-Origin` echo (no wildcard with creds).
    // In dev defaults to the 3 local Next.js dev ports. In prod must list the
    // exact public origins (tukio.one + subdomains).
    CORS_ORIGINS: z
      .string()
      .min(1)
      .default(
        'http://localhost:3000,http://localhost:3002,http://localhost:3003',
      ),
  })
  .passthrough();

export type Env = z.infer<typeof EnvSchema>;

const DEV_INTERNAL_SECRET = 'dev-internal-svc-secret-32-bytes!!';
const DEV_STATE_JWT_SECRET = 'dev-state-jwt-secret-32-bytes-minimum!';
const DEV_PKCE_COOKIE_SECRET = 'dev-pkce-cookie-secret-32-bytes-ok!!';

export const validateEnv = (raw: Record<string, unknown>): Env => {
  const isNonProd = raw['NODE_ENV'] !== 'production';
  const withDefaults: Record<string, unknown> = { ...raw };
  if (!withDefaults['TUKIO_INTERNAL_SERVICE_SECRET'] && isNonProd) {
    // Must match identity-svc dev fallback (env.schema P5 review patch) so the
    // local docker-compose smoke test signs requests with the same key.
    withDefaults['TUKIO_INTERNAL_SERVICE_SECRET'] = DEV_INTERNAL_SECRET;
  }
  if (!withDefaults['STATE_JWT_HMAC_SECRET'] && isNonProd) {
    withDefaults['STATE_JWT_HMAC_SECRET'] = DEV_STATE_JWT_SECRET;
  }
  if (!withDefaults['PKCE_COOKIE_HMAC_SECRET'] && isNonProd) {
    withDefaults['PKCE_COOKIE_HMAC_SECRET'] = DEV_PKCE_COOKIE_SECRET;
  }

  const parsed = EnvSchema.safeParse(withDefaults);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  // Mirror identity-svc Story 1.2b review patch P5 — refuse to boot in prod
  // with the well-known dev fallback secret still in place. A misconfigured
  // NODE_ENV would otherwise let gateway-api sign requests with a repo-checked
  // secret → effective auth bypass against `/internal/*`.
  if (parsed.data.NODE_ENV === 'production') {
    if (parsed.data.TUKIO_INTERNAL_SERVICE_SECRET === DEV_INTERNAL_SECRET) {
      throw new Error(
        'Refusing to start in production with dev fallback for TUKIO_INTERNAL_SERVICE_SECRET. ' +
          'Set explicit value via secret store before deploy.',
      );
    }
    if (parsed.data.STATE_JWT_HMAC_SECRET === DEV_STATE_JWT_SECRET) {
      throw new Error(
        'Refusing to start in production with dev fallback for STATE_JWT_HMAC_SECRET. ' +
          'Set explicit value via secret store before deploy.',
      );
    }
    if (parsed.data.PKCE_COOKIE_HMAC_SECRET === DEV_PKCE_COOKIE_SECRET) {
      throw new Error(
        'Refusing to start in production with dev fallback for PKCE_COOKIE_HMAC_SECRET. ' +
          'Set explicit value via secret store before deploy.',
      );
    }
    // P6: zone base URLs must point to *.tukio.one (or tukio.one apex) in prod
    for (const key of [
      'ZONE_BASE_URL_PUBLIC',
      'ZONE_BASE_URL_SELLER',
      'ZONE_BASE_URL_ADMIN',
    ] as const) {
      const raw = parsed.data[key];
      let hostname: string;
      try {
        hostname = new URL(raw).hostname.toLowerCase();
      } catch {
        throw new Error(`Invalid URL for ${key}: ${raw}`);
      }
      if (hostname !== 'tukio.one' && !hostname.endsWith('.tukio.one')) {
        throw new Error(
          `${key} must resolve to tukio.one or a *.tukio.one subdomain in production. Got: ${raw}`,
        );
      }
    }
    if (parsed.data.TUKIO_DEV_INSECURE_COOKIES === '1') {
      throw new Error(
        'Refusing to start in production with TUKIO_DEV_INSECURE_COOKIES=1. ' +
          'This flag drops the cookie Secure attribute and is dev-only.',
      );
    }
  }

  return parsed.data;
};
