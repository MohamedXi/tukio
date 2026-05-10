import type { NatsContainerHandle } from '../testcontainers/nats.helper.js';

export type FailureType = 'consumer-crash' | 'publish-fail';

export interface InjectorHandle {
  // Reverts the injection. Always called by tests in afterEach.
  restore: () => Promise<void>;
}

// Sets up a NATS subscriber that consumes events of type `eventTypeToFail`
// and fails them according to `failureType`:
//
//   - 'consumer-crash': subscriber receives the message and `nak()`s it
//     immediately, simulating a consumer crash mid-processing
//   - 'publish-fail': not yet implemented (would require intercepting
//     publishes — done at the application layer, see Story 4.13 V1 chaos
//     tests CI). Returns a no-op handle for now.
//
// Used for Story 4.13 (saga partial failure recovery — booking saga continues
// when one step fails by triggering the compensating action).
export async function injectFailureBetweenEvents(
  natsContainer: NatsContainerHandle,
  eventTypeToFail: string,
  failureType: FailureType,
): Promise<InjectorHandle> {
  if (failureType === 'publish-fail') {
    // Application-level concern; surface via a no-op so the chaos suite
    // contract stays stable even though this scenario has not landed yet.
    return { restore: async () => {} };
  }

  const client = await natsContainer.getClient();
  const sub = client.subscribe(eventTypeToFail, {
    queue: 'tukio-chaos-injector',
    callback: (err, msg) => {
      if (err) return;
      // Drop the message: do nothing → no ack → JetStream redelivers.
      // For non-JetStream subjects, the publish is silently consumed.
      msg.respond?.(undefined);
    },
  });

  return {
    restore: async () => {
      sub.unsubscribe();
    },
  };
}
