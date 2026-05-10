// Singleton container pool to share long-startup containers (Keycloak ~15s,
// Meilisearch ~3s) across test files. Used together with Vitest's
// `globalSetup`/`globalTeardown` hooks to start once per test run.

type Stoppable = { stop: () => Promise<void> };

interface PoolEntry {
  key: string;
  handle: Stoppable;
}

const pool: Map<string, PoolEntry> = new Map();

// Returns the cached handle for `key`, or starts a new one via `factory()`.
// Subsequent calls with the same key return the same handle without
// re-starting the container.
export async function getOrCreate<T extends Stoppable>(
  key: string,
  factory: () => Promise<T>,
): Promise<T> {
  const existing = pool.get(key);
  if (existing) return existing.handle as T;
  const handle = await factory();
  pool.set(key, { key, handle });
  return handle;
}

// Stops every container in the pool and clears it. Call from Vitest
// `globalTeardown` so leftover containers do not survive the test run.
export async function cleanupAllContainers(): Promise<void> {
  const errors: unknown[] = [];
  for (const entry of pool.values()) {
    try {
      await entry.handle.stop();
    } catch (e) {
      errors.push(e);
    }
  }
  pool.clear();
  if (errors.length > 0) {
    // Surface the first error so the developer can debug — but cleanup
    // already proceeded for the rest of the pool.
    throw errors[0];
  }
}

// Test-only: drop a single entry (e.g. when a chaos test deliberately stopped
// a container to simulate failure and now wants the pool to forget it).
export function evict(key: string): void {
  pool.delete(key);
}
