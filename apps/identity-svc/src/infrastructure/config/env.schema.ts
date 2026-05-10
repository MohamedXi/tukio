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
    DB_USER: z.string().min(1).default('tukio_identity_user'),
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
    NATS_URL: z.string().min(1).default('nats://localhost:4222'),
  })
  .passthrough();

export type Env = z.infer<typeof EnvSchema>;

export const validateEnv = (raw: Record<string, unknown>): Env => {
  // Inject a safe default for DB_PASSWORD in development/test only.
  // In production the variable MUST be set explicitly.
  const withDefaults =
    !raw['DB_PASSWORD'] && raw['NODE_ENV'] !== 'production'
      ? { DB_PASSWORD: 'changeme', ...raw }
      : raw;

  const parsed = EnvSchema.safeParse(withDefaults);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
};
