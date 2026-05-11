import { describe, it, expect, vi } from 'vitest';
import { disconnectNatsForDuration } from '../nats-disconnect.helper.js';
import { pauseDbForDuration } from '../db-failure.helper.js';
import { injectFailureBetweenEvents } from '../saga-partial-failure.helper.js';
import type { NatsContainerHandle } from '../../testcontainers/nats.helper.js';
import type { PostgresContainerHandle } from '../../testcontainers/postgres.helper.js';

// These tests do NOT require Docker — they exercise the helper logic with
// mocked container handles. Real-container chaos tests run via the apps that
// consume @tukio/testing (Story 0.7 chaos test, Story 0.11 CI nightly tag).

describe('disconnectNatsForDuration', () => {
  it('calls pause then unpause around the sleep', async () => {
    const events: string[] = [];
    const handle: Partial<NatsContainerHandle> = {
      pause: vi.fn(async () => {
        events.push('pause');
      }),
      unpause: vi.fn(async () => {
        events.push('unpause');
      }),
    };

    await disconnectNatsForDuration(handle as NatsContainerHandle, 10);
    expect(events).toEqual(['pause', 'unpause']);
  });

  it('unpauses even if sleep throws (finally guard)', async () => {
    const handle: Partial<NatsContainerHandle> = {
      pause: vi.fn(async () => {}),
      unpause: vi.fn(async () => {}),
    };
    // Simulate sleep abort by monkey-patching setTimeout to throw.
    const originalSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = ((_fn: () => void, _ms: number) => {
      throw new Error('aborted');
    }) as unknown as typeof globalThis.setTimeout;

    try {
      await expect(disconnectNatsForDuration(handle as NatsContainerHandle, 10)).rejects.toThrow(
        'aborted',
      );
      expect(handle.unpause).toHaveBeenCalled();
    } finally {
      globalThis.setTimeout = originalSetTimeout;
    }
  });
});

describe('pauseDbForDuration', () => {
  function mockHandle(): {
    handle: PostgresContainerHandle;
    pause: ReturnType<typeof vi.fn>;
    unpause: ReturnType<typeof vi.fn>;
  } {
    const pause = vi.fn(async () => {});
    const unpause = vi.fn(async () => {});
    const handle = {
      container: { dockerContainer: { pause, unpause } },
    } as unknown as PostgresContainerHandle;
    return { handle, pause, unpause };
  }

  it('calls dockerContainer.pause then unpause', async () => {
    const { handle, pause, unpause } = mockHandle();
    await pauseDbForDuration(handle, 5);
    expect(pause).toHaveBeenCalled();
    expect(unpause).toHaveBeenCalled();
  });

  it('throws clearly when testcontainers private API changed', async () => {
    const handle = {
      container: {}, // no dockerContainer property
    } as unknown as PostgresContainerHandle;
    await expect(pauseDbForDuration(handle, 5)).rejects.toThrow(/private API changed/);
  });
});

describe('injectFailureBetweenEvents', () => {
  it("'publish-fail' returns a no-op handle (not implemented yet)", async () => {
    const handle = {
      getClient: vi.fn(),
    } as unknown as NatsContainerHandle;
    const injector = await injectFailureBetweenEvents(handle, 'event.x', 'publish-fail');
    expect(typeof injector.restore).toBe('function');
    await expect(injector.restore()).resolves.toBeUndefined();
    expect(handle.getClient).not.toHaveBeenCalled();
  });

  it("'consumer-crash' subscribes to the eventType and returns restore", async () => {
    const unsubscribe = vi.fn();
    const subscribe = vi.fn(() => ({ unsubscribe }));
    const getClient = vi.fn(async () => ({ subscribe }) as unknown);
    const handle = { getClient } as unknown as NatsContainerHandle;

    const injector = await injectFailureBetweenEvents(handle, 'booking.created', 'consumer-crash');
    expect(subscribe).toHaveBeenCalledWith(
      'booking.created',
      expect.objectContaining({ queue: 'tukio-chaos-injector' }),
    );
    await injector.restore();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
