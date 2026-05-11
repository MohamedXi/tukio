import type { NatsContainerHandle } from '../testcontainers/nats.helper.js';

export type FailureType = 'consumer-crash' | 'publish-fail';

export interface InjectorHandle {
  // Reverts the injection. Always called by tests in afterEach.
  restore: () => Promise<void>;
}

interface MsgWithJetStreamAck {
  // JetStream messages expose ack/nak/term/working — see nats.js v2 API.
  nak?: (delayMs?: number) => void;
  term?: () => void;
  ack?: () => void;
}

// Sets up a NATS subscriber that consumes events of type `eventTypeToFail`
// and fails them according to `failureType`:
//
//   - 'consumer-crash': subscriber receives the JetStream message and `nak()`s
//     it immediately. JetStream redelivers per ack_wait + max_deliver policy,
//     simulating a consumer crash mid-processing. For non-JetStream subjects,
//     the message is dropped silently (no ack semantics apply).
//   - 'publish-fail': not yet implemented (requires intercepting publishes at
//     the application layer — see Story 4.13 V1 chaos tests CI). Returns a
//     no-op handle so the contract stays stable.
//
// Used for Story 4.13 (saga partial failure recovery — booking saga continues
// when one step fails by triggering the compensating action).
export async function injectFailureBetweenEvents(
  natsContainer: NatsContainerHandle,
  eventTypeToFail: string,
  failureType: FailureType,
): Promise<InjectorHandle> {
  if (failureType === 'publish-fail') {
    return { restore: async () => {} };
  }

  const client = await natsContainer.getClient();
  const sub = client.subscribe(eventTypeToFail, {
    queue: 'tukio-chaos-injector',
    callback: (err, msg) => {
      if (err) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('[saga-chaos] subscription error', err);
        }
        return;
      }
      // For JetStream messages: explicit `nak()` triggers redelivery per the
      // consumer's ack_wait + max_deliver policy. For core NATS (no ack
      // semantics), there is nothing to do — the message is consumed and
      // not re-emitted, which is a passable approximation of a crash.
      const jsMsg = msg as unknown as MsgWithJetStreamAck;
      if (typeof jsMsg.nak === 'function') {
        jsMsg.nak();
      }
    },
  });

  return {
    restore: async () => {
      sub.unsubscribe();
    },
  };
}
