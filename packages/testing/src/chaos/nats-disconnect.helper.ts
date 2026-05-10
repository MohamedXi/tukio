import type { NatsContainerHandle } from '../testcontainers/nats.helper.js';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// Pauses the NATS container Docker process for `durationMs`, then unpauses.
// Used by Story 0.7 chaos test (NATS partition recovery → outbox relay
// continues, in-flight subscribers reconnect).
export async function disconnectNatsForDuration(
  natsContainer: NatsContainerHandle,
  durationMs: number,
): Promise<void> {
  await natsContainer.pause();
  await sleep(durationMs);
  await natsContainer.unpause();
}
