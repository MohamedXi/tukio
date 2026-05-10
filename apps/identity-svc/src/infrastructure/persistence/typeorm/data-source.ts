import { DataSource } from 'typeorm';
import { UserProfileEntity } from './entities/user-profile.entity.js';

// Standalone DataSource for TypeORM CLI (migration:generate / run / revert).
// Migrations glob is resolved relative to the CLI cwd (apps/identity-svc/).
// At app boot, NestJS uses TypeOrmModule.forRootAsync wired in app.module.ts via IConfigService.
const isTrue = (v: string | undefined) => v === 'true' || v === '1';

const parsePort = (v: string | undefined, fallback: number): number => {
  const n = parseInt(v ?? String(fallback), 10);
  return isNaN(n) ? fallback : n;
};

export const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parsePort(process.env.DB_PORT, 5432),
  username: process.env.DB_USER ?? 'tukio_identity_user',
  password: process.env.DB_PASSWORD ?? 'changeme',
  database: process.env.DB_NAME ?? 'tukio_identity',
  entities: [UserProfileEntity],
  migrations: ['src/infrastructure/persistence/typeorm/migrations/*.{ts,js}'],
  migrationsRun: false,
  synchronize: false,
  logging: isTrue(process.env.DB_VERBOSE)
    ? ['query', 'error', 'warn', 'migration']
    : ['error', 'warn', 'migration'],
});

export default dataSource;
