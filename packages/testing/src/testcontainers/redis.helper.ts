import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';
import { Redis } from 'ioredis';

export interface RedisContainerOptions {
  // Redis major version. Default '7' (Upstash compat baseline).
  version?: string;
}

export interface RedisContainerHandle {
  url: string;
  host: string;
  port: number;
  container: StartedTestContainer;
  getClient: () => Redis;
  stop: () => Promise<void>;
}

export async function startRedisContainer(
  options: RedisContainerOptions = {},
): Promise<RedisContainerHandle> {
  const version = options.version ?? '7';
  const container = await new GenericContainer(`redis:${version}-alpine`)
    .withExposedPorts(6379)
    .withWaitStrategy(Wait.forLogMessage(/Ready to accept connections/))
    .start();

  const host = container.getHost();
  const port = container.getMappedPort(6379);
  const url = `redis://${host}:${port}`;

  let client: Redis | null = null;
  const getClient = (): Redis => {
    if (!client) {
      client = new Redis({ host, port, maxRetriesPerRequest: 1 });
    }
    return client;
  };

  return {
    url,
    host,
    port,
    container,
    getClient,
    stop: async () => {
      if (client) client.disconnect();
      await container.stop();
    },
  };
}
