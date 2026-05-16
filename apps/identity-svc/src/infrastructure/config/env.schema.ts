import { z } from 'zod';

export const EnvSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    SERVICE_NAME: z.string().min(1).default('identity-svc'),
    SERVICE_VERSION: z.string().min(1).default('0.0.0'),
    PORT: z.coerce.number().int().positive().default(4001),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
      .default('info'),
    // Postgres — no default for secrets; must be explicitly provided in non-dev envs.
    DB_HOST: z.string().min(1).default('localhost'),
    DB_PORT: z.coerce.number().int().positive().default(5432),
    // Default shared dev user provisioned by Story 0.10 docker-compose.
    DB_USER: z.string().min(1).default('tukio'),
    DB_PASSWORD: z.string().min(1), // no default — must be provided explicitly
    DB_NAME: z.string().min(1).default('tukio_identity'),
    DB_VERBOSE: z
      .union([
        z.literal('true'),
        z.literal('false'),
        z.literal('1'),
        z.literal('0'),
      ])
      .optional()
      .transform((v) => v === 'true' || v === '1'),
    KEYCLOAK_URL: z.string().url().min(1).default('http://localhost:8080'),
    KEYCLOAK_REALM: z.string().min(1).default('tukio'),
    KEYCLOAK_CLIENT_ID: z.string().min(1).default('tukio-api'),
    KEYCLOAK_AUDIENCE: z.string().min(1).default('tukio-api'),
    // Service-account secret for the `tukio-api` confidential client (Story 1.1).
    // No default — must be provided in every environment.
    KEYCLOAK_CLIENT_SECRET_TUKIO_API: z.string().min(1),
    // HMAC-shared secret protecting `/internal/*` endpoints (Story 1.2b).
    // Base64-encoded random bytes (≥ 32). No default.
    TUKIO_INTERNAL_SERVICE_SECRET: z.string().min(32),
    // Public-facing apex URL used to build email-verify links (Story 1.2a use case).
    PUBLIC_BASE_URL: z.string().url().min(1).default('http://localhost:3000'),
    NATS_URL: z.string().min(1).default('nats://localhost:4222'),
    NATS_STREAM_NAME: z.string().min(1).default('TUKIO_IDENTITY'),
    NATS_REPLICAS: z.coerce.number().int().positive().default(1),
    // INSEE SIRENE V3.11 apiKey (Story 1.3b). Optional — only required when pro registration is active.
    INSEE_API_URL: z.string().url().min(1).default('https://api.insee.fr'),
    INSEE_API_KEY: z.string().min(1).optional(),
    // Cloudflare R2 KYC bucket (Story 1.3b). Optional — only required when pro registration is active.
    R2_KYC_ENDPOINT: z.string().url().min(1).optional(),
    R2_KYC_ACCESS_KEY_ID: z.string().min(1).optional(),
    R2_KYC_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    R2_KYC_BUCKET: z.string().min(1).default('tukio-kyc-staging'),
  })
  .passthrough();

export type Env = z.infer<typeof EnvSchema>;

export const validateEnv = (raw: Record<string, unknown>): Env => {
  // Inject safe defaults for secrets in development/test only.
  // In production all secrets MUST be set explicitly.
  const isNonProd = raw['NODE_ENV'] !== 'production';
  const withDefaults: Record<string, unknown> = { ...raw };
  if (!withDefaults['DB_PASSWORD'] && isNonProd) {
    withDefaults['DB_PASSWORD'] = 'tukio_dev_password';
  }
  if (!withDefaults['KEYCLOAK_CLIENT_SECRET_TUKIO_API'] && isNonProd) {
    withDefaults['KEYCLOAK_CLIENT_SECRET_TUKIO_API'] = 'tukio-api-dev-secret';
  }
  if (!withDefaults['TUKIO_INTERNAL_SERVICE_SECRET'] && isNonProd) {
    // 32-char fixed dev secret — matches the gateway-api default to keep
    // local docker-compose smoke tests one-shot.
    withDefaults['TUKIO_INTERNAL_SERVICE_SECRET'] =
      'dev-internal-svc-secret-32-bytes!!';
  }

  const parsed = EnvSchema.safeParse(withDefaults);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  // Review patch P5 (1.2b) — refuse to boot in production with any of the
  // well-known dev fallback secrets still in place. Without this, a misconfigured
  // NODE_ENV (e.g. accidentally unset on a staging deploy) would silently
  // accept requests signed with the repo-checked-in default → effective auth bypass.
  const DEV_FALLBACKS: Record<string, string> = {
    DB_PASSWORD: 'tukio_dev_password',
    KEYCLOAK_CLIENT_SECRET_TUKIO_API: 'tukio-api-dev-secret',
    TUKIO_INTERNAL_SERVICE_SECRET: 'dev-internal-svc-secret-32-bytes!!',
  };
  if (parsed.data.NODE_ENV === 'production') {
    const leaked = Object.entries(DEV_FALLBACKS)
      .filter(([key, devValue]) => parsed.data[key] === devValue)
      .map(([key]) => key);
    if (leaked.length > 0) {
      throw new Error(
        `Refusing to start in production with dev fallback secret(s) for : ${leaked.join(', ')}. ` +
          'Set explicit values via secret store before deploy.',
      );
    }
  }

  return parsed.data;
};
