import { z } from 'zod';

export const EnvSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    SERVICE_NAME: z.string().default('identity-svc'),
    SERVICE_VERSION: z.string().default('0.0.0'),
    PORT: z.coerce.number().int().positive().default(4001),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
      .default('info'),
    DB_HOST: z.string().default('localhost'),
    DB_PORT: z.coerce.number().int().positive().default(5432),
    DB_USER: z.string().default('tukio_identity_user'),
    DB_PASSWORD: z.string().default('changeme'),
    DB_NAME: z.string().default('tukio_identity'),
    DB_VERBOSE: z
      .union([
        z.literal('true'),
        z.literal('false'),
        z.literal('1'),
        z.literal('0'),
      ])
      .optional()
      .transform((v) => v === 'true' || v === '1'),
    KEYCLOAK_URL: z.string().url().default('http://localhost:8080'),
    KEYCLOAK_REALM: z.string().default('tukio'),
    NATS_URL: z.string().default('nats://localhost:4222'),
  })
  .passthrough();

export type Env = z.infer<typeof EnvSchema>;

export const validateEnv = (raw: Record<string, unknown>): Env => {
  const parsed = EnvSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
};
