import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getOrCreate, cleanupAllContainers, evict } from '../container-pool.js';

interface FakeHandle {
  id: string;
  stop: () => Promise<void>;
}

beforeEach(async () => {
  // Drain any state from previous tests.
  await cleanupAllContainers().catch(() => {});
});

describe('getOrCreate', () => {
  it('returns the same handle for repeated calls with the same key', async () => {
    const factory = vi.fn(async (): Promise<FakeHandle> => ({ id: 'h1', stop: async () => {} }));
    const a = await getOrCreate('k-same', factory);
    const b = await getOrCreate('k-same', factory);
    expect(a).toBe(b);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('does NOT race on concurrent calls — factory runs once even with parallel callers', async () => {
    // The previous implementation cached the resolved handle, leading to two
    // concurrent callers both invoking the factory and orphaning a container.
    let invocations = 0;
    const factory = vi.fn(async (): Promise<FakeHandle> => {
      invocations += 1;
      await new Promise((r) => setTimeout(r, 5));
      return { id: 'h-concurrent', stop: async () => {} };
    });
    const [a, b, c] = await Promise.all([
      getOrCreate('k-concurrent', factory),
      getOrCreate('k-concurrent', factory),
      getOrCreate('k-concurrent', factory),
    ]);
    expect(invocations).toBe(1);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('drops the entry when factory rejects so a later caller can retry', async () => {
    const factory1 = vi.fn(async (): Promise<FakeHandle> => {
      throw new Error('boom');
    });
    await expect(getOrCreate('k-retry', factory1)).rejects.toThrow('boom');

    const factory2 = vi.fn(async (): Promise<FakeHandle> => ({ id: 'h2', stop: async () => {} }));
    const second = await getOrCreate('k-retry', factory2);
    expect(second.id).toBe('h2');
    expect(factory2).toHaveBeenCalled();
  });
});

describe('cleanupAllContainers', () => {
  it('stops every container in the pool', async () => {
    const stop1 = vi.fn(async () => {});
    const stop2 = vi.fn(async () => {});
    await getOrCreate('a', async () => ({ id: 'a', stop: stop1 }));
    await getOrCreate('b', async () => ({ id: 'b', stop: stop2 }));
    await cleanupAllContainers();
    expect(stop1).toHaveBeenCalled();
    expect(stop2).toHaveBeenCalled();
  });

  it('throws AggregateError when multiple stops fail (preserves all diagnostics)', async () => {
    await getOrCreate('x', async () => ({
      id: 'x',
      stop: async () => {
        throw new Error('x-fail');
      },
    }));
    await getOrCreate('y', async () => ({
      id: 'y',
      stop: async () => {
        throw new Error('y-fail');
      },
    }));
    await expect(cleanupAllContainers()).rejects.toMatchObject({
      name: 'AggregateError',
      errors: expect.arrayContaining([
        expect.objectContaining({ message: 'x-fail' }),
        expect.objectContaining({ message: 'y-fail' }),
      ]),
    });
  });
});

describe('evict', () => {
  it('returns true when the key was found, false otherwise', async () => {
    await getOrCreate('present', async () => ({ id: 'p', stop: async () => {} }));
    expect(evict('present')).toBe(true);
    expect(evict('absent')).toBe(false);
  });
});
