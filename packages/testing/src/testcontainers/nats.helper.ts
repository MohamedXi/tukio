import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';
import { connect, type NatsConnection } from 'nats';

export interface NatsContainerOptions {
  jetstream?: boolean;
  // NATS major version. Default '2.10' (current stable).
  version?: string;
}

export interface NatsContainerHandle {
  url: string;
  host: string;
  port: number;
  container: StartedTestContainer;
  getClient: () => Promise<NatsConnection>;
  // For chaos tests: pause the container (simulates network partition) then
  // unpause. The container stays mapped to the same host:port across
  // pause/unpause cycles.
  pause: () => Promise<void>;
  unpause: () => Promise<void>;
  stop: () => Promise<void>;
}

// Starts a NATS server with JetStream optionally enabled.
// Tests waiting on a "Server is ready" log message — JetStream-aware.
export async function startNatsContainer(
  options: NatsContainerOptions = {},
): Promise<NatsContainerHandle> {
  const version = options.version ?? '2.10';
  const jetstream = options.jetstream ?? true;

  const cmd = jetstream ? ['-js', '--http_port', '8222'] : ['--http_port', '8222'];

  const container = await new GenericContainer(`nats:${version}-alpine`)
    .withCommand(cmd)
    .withExposedPorts(4222, 8222)
    .withWaitStrategy(Wait.forLogMessage(/Server is ready/))
    .start();

  const host = container.getHost();
  const port = container.getMappedPort(4222);
  const url = `nats://${host}:${port}`;

  let client: NatsConnection | null = null;
  const getClient = async (): Promise<NatsConnection> => {
    if (!client) {
      client = await connect({ servers: url });
    }
    return client;
  };

  return {
    url,
    host,
    port,
    container,
    getClient,
    pause: async () => {
      const dockerContainer = (
        container as unknown as { dockerContainer: { pause: () => Promise<void> } }
      ).dockerContainer;
      await dockerContainer.pause();
    },
    unpause: async () => {
      const dockerContainer = (
        container as unknown as { dockerContainer: { unpause: () => Promise<void> } }
      ).dockerContainer;
      await dockerContainer.unpause();
    },
    stop: async () => {
      if (client) {
        try {
          await client.drain();
        } catch {
          // Best-effort drain — pause + stop sequences may leave the connection unusable.
        }
      }
      await container.stop();
    },
  };
}
