import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';
import { MeiliSearch } from 'meilisearch';

export interface MeilisearchContainerOptions {
  masterKey?: string;
  // Meilisearch version tag. Default 'latest'.
  version?: string;
}

export interface MeilisearchContainerHandle {
  url: string;
  masterKey: string;
  container: StartedTestContainer;
  getClient: () => MeiliSearch;
  stop: () => Promise<void>;
}

export async function startMeilisearchContainer(
  options: MeilisearchContainerOptions = {},
): Promise<MeilisearchContainerHandle> {
  const masterKey = options.masterKey ?? 'test-master-key';
  const version = options.version ?? 'latest';

  const container = await new GenericContainer(`getmeili/meilisearch:${version}`)
    .withEnvironment({
      MEILI_MASTER_KEY: masterKey,
      MEILI_NO_ANALYTICS: 'true',
      MEILI_ENV: 'development',
    })
    .withExposedPorts(7700)
    .withWaitStrategy(Wait.forHttp('/health', 7700).forStatusCode(200))
    .start();

  const host = container.getHost();
  const port = container.getMappedPort(7700);
  const url = `http://${host}:${port}`;

  let client: MeiliSearch | null = null;
  const getClient = (): MeiliSearch => {
    if (!client) {
      client = new MeiliSearch({ host: url, apiKey: masterKey });
    }
    return client;
  };

  return {
    url,
    masterKey,
    container,
    getClient,
    stop: async () => {
      await container.stop();
    },
  };
}
