import type { PostgresContainerHandle } from '../testcontainers/postgres.helper.js';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

interface DockerContainer {
  pause: () => Promise<void>;
  unpause: () => Promise<void>;
}

// Reaches into the private `dockerContainer` field on StartedTestContainer.
// This is not part of the testcontainers public API and may break on minor
// version bumps; the runtime guard below makes the failure mode explicit
// (clear error message) instead of an obscure "dc.pause is not a function".
function asDockerContainer(handle: PostgresContainerHandle): DockerContainer {
  const dc = (handle.container as unknown as { dockerContainer: DockerContainer }).dockerContainer;
  if (!dc || typeof dc.pause !== 'function' || typeof dc.unpause !== 'function') {
    throw new Error(
      '[pauseDbForDuration] testcontainers private API changed: `container.dockerContainer.pause/unpause` is not available. Update @tukio/testing/chaos/db-failure.helper to match the new public surface.',
    );
  }
  return dc;
}

// Pauses the Postgres container Docker process for `durationMs`, then
// unpauses. Used for testing R13 (outbox relay handles transient DB
// unavailability without losing or duplicating events).
//
// CRITICAL: try/finally ensures unpause runs even if `sleep` is aborted —
// a paused PG container blocks every connection in the pool forever.
export async function pauseDbForDuration(
  pgContainer: PostgresContainerHandle,
  durationMs: number,
): Promise<void> {
  const dc = asDockerContainer(pgContainer);
  await dc.pause();
  try {
    await sleep(durationMs);
  } finally {
    await dc.unpause();
  }
}
