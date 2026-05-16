import { DataSource } from 'typeorm';
import { UserProfileEntity } from './entities/user-profile.entity.js';
import { EmailVerificationTokenEntity } from './entities/email-verification-token.entity.js';

// Standalone DataSource for TypeORM CLI (migration:generate / run / revert).
// Migrations glob is resolved relative to the CLI cwd (apps/identity-svc/).
// At app boot, NestJS uses TypeOrmModule.forRootAsync wired in app.module.ts via IConfigService.
//
// IMPORTANT: TypeORM CLI rejects files that expose more than one DataSource
// export. Keep the default export as the only one (do not add a named
// `export const dataSource = …`).
const isTrue = (v: string | undefined) => v === 'true' || v === '1';

const parsePort = (v: string | undefined, fallback: number): number => {
  const n = parseInt(v ?? String(fallback), 10);
  return isNaN(n) ? fallback : n;
};

// H2 review finding: never let the dev password be the silent fallback in
// non-development environments. Mirror the EnvSchema guard used at app boot.
const nodeEnv = process.env.NODE_ENV ?? 'development';
const dbPassword =
  process.env.DB_PASSWORD ??
  (nodeEnv === 'production' ? '' : 'tukio_dev_password');
if (!dbPassword) {
  throw new Error(
    'DB_PASSWORD is required in production. Set it via env (e.g. Doppler) before running migrations.',
  );
}

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parsePort(process.env.DB_PORT, 5432),
  username: process.env.DB_USER ?? 'tukio',
  password: dbPassword,
  database: process.env.DB_NAME ?? 'tukio_identity',
  entities: [UserProfileEntity, EmailVerificationTokenEntity],
  migrations: ['src/infrastructure/persistence/typeorm/migrations/*.{ts,js}'],
  migrationsRun: false,
  synchronize: false,
  logging: isTrue(process.env.DB_VERBOSE)
    ? ['query', 'error', 'warn', 'migration']
    : ['error', 'warn', 'migration'],
});

export default dataSource;
