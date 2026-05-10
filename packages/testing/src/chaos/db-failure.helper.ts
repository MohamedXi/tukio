import type { PostgresContainerHandle } from '../testcontainers/postgres.helper.js';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

interface DockerContainer {
  pause: () => Promise<void>;
  unpause: () => Promise<void>;
}

function asDockerContainer(handle: PostgresContainerHandle): DockerContainer {
  return (handle.container as unknown as { dockerContainer: DockerContainer }).dockerContainer;
}

// Pauses the Postgres container Docker process for `durationMs`, then
// unpauses. Used for testing R13 (outbox relay handles transient DB
// unavailability without losing or duplicating events).
export async function pauseDbForDuration(
  pgContainer: PostgresContainerHandle,
  durationMs: number,
): Promise<void> {
  const dc = asDockerContainer(pgContainer);
  await dc.pause();
  await sleep(durationMs);
  await dc.unpause();
}
