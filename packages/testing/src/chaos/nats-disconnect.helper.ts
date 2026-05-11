import type { NatsContainerHandle } from '../testcontainers/nats.helper.js';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// Pauses the NATS container Docker process for `durationMs`, then unpauses.
// Used by Story 0.7 chaos test (NATS partition recovery → outbox relay
// continues, in-flight subscribers reconnect).
//
// CRITICAL: pause is a destructive op that MUST always be reversed. The
// try/finally ensures unpause runs even if `sleep` is aborted (test timeout,
// Ctrl-C) — otherwise the container stays paused and every subsequent test
// deadlocks on its connection.
export async function disconnectNatsForDuration(
  natsContainer: NatsContainerHandle,
  durationMs: number,
): Promise<void> {
  await natsContainer.pause();
  try {
    await sleep(durationMs);
  } finally {
    await natsContainer.unpause();
  }
}
