import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';
import KcAdminClient from '@keycloak/keycloak-admin-client';

export interface KeycloakContainerOptions {
  realm?: string;
  // Path to a realm-export.json on the host filesystem. Mounted into the
  // container and imported at startup via Keycloak's `--import-realm` flag.
  importJsonPath?: string;
  // Keycloak major version. Default '25' (Phasetwo MVP baseline).
  version?: string;
  adminUser?: string;
  adminPassword?: string;
}

export interface KeycloakContainerHandle {
  url: string;
  realm: string;
  adminUser: string;
  adminPassword: string;
  container: StartedTestContainer;
  // Returns an authenticated KcAdminClient for creating users / clients in tests.
  getAdminClient: () => Promise<KcAdminClient>;
  stop: () => Promise<void>;
}

// Starts a Keycloak server in dev mode. Slow boot (10–20s) — strongly
// recommended to share via `containerPool` across tests.
//
// The keycloak admin client requires the master realm credentials; the
// imported realm (e.g. 'tukio') is queried separately.
export async function startKeycloakContainer(
  options: KeycloakContainerOptions = {},
): Promise<KeycloakContainerHandle> {
  const version = options.version ?? '25.0';
  const realm = options.realm ?? 'tukio';
  const adminUser = options.adminUser ?? 'admin';
  const adminPassword = options.adminPassword ?? 'admin';

  let builder = new GenericContainer(`quay.io/keycloak/keycloak:${version}`)
    .withEnvironment({
      KC_BOOTSTRAP_ADMIN_USERNAME: adminUser,
      KC_BOOTSTRAP_ADMIN_PASSWORD: adminPassword,
      KC_HEALTH_ENABLED: 'true',
    })
    .withCommand(options.importJsonPath ? ['start-dev', '--import-realm'] : ['start-dev'])
    .withExposedPorts(8080)
    .withWaitStrategy(
      Wait.forLogMessage(/Listening on:|started in/, 1).withStartupTimeout(120_000),
    );

  if (options.importJsonPath) {
    builder = builder.withCopyFilesToContainer([
      { source: options.importJsonPath, target: '/opt/keycloak/data/import/realm.json' },
    ]);
  }

  const container = await builder.start();
  const host = container.getHost();
  const port = container.getMappedPort(8080);
  const url = `http://${host}:${port}`;

  // Cache the IN-FLIGHT Promise<KcAdminClient>, not the resolved client.
  // Concurrent test files calling getAdminClient() in parallel otherwise
  // race: both create a new KcAdminClient + auth, the second clobbers the
  // first → intermittent 401s downstream.
  let adminPromise: Promise<KcAdminClient> | null = null;
  const getAdminClient = (): Promise<KcAdminClient> => {
    if (!adminPromise) {
      adminPromise = (async () => {
        const client = new KcAdminClient({ baseUrl: url, realmName: 'master' });
        await client.auth({
          username: adminUser,
          password: adminPassword,
          grantType: 'password',
          clientId: 'admin-cli',
        });
        return client;
      })();
    }
    return adminPromise;
  };

  return {
    url,
    realm,
    adminUser,
    adminPassword,
    container,
    getAdminClient,
    stop: async () => {
      await container.stop();
    },
  };
}
