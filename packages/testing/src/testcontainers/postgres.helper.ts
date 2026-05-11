import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';

export interface PostgresContainerOptions {
  database?: string;
  user?: string;
  password?: string;
  // Major Postgres version. Defaults to '16' per Architecture line 602.
  version?: string;
}

export interface PostgresContainerHandle {
  url: string;
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  container: StartedPostgreSqlContainer;
  getClient: () => pg.Pool;
  stop: () => Promise<void>;
}

// Starts a PostgreSQL container using @testcontainers/postgresql.
// The container is healthy by the time this resolves (testcontainers waits
// internally on `pg_isready`).
export async function startPostgresContainer(
  options: PostgresContainerOptions = {},
): Promise<PostgresContainerHandle> {
  const version = options.version ?? '16';
  const database = options.database ?? 'tukio_test';
  const user = options.user ?? 'tukio';
  const password = options.password ?? 'tukio';

  const container = await new PostgreSqlContainer(`postgres:${version}-alpine`)
    .withDatabase(database)
    .withUsername(user)
    .withPassword(password)
    .start();

  const host = container.getHost();
  const port = container.getMappedPort(5432);
  const url = `postgres://${user}:${password}@${host}:${port}/${database}`;

  let pool: pg.Pool | null = null;
  const getClient = (): pg.Pool => {
    if (!pool) {
      pool = new pg.Pool({ host, port, database, user, password });
    }
    return pool;
  };

  return {
    url,
    host,
    port,
    database,
    user,
    password,
    container,
    getClient,
    stop: async () => {
      if (pool) await pool.end();
      await container.stop();
    },
  };
}
