// Singleton container pool to share long-startup containers (Keycloak ~15s,
// Meilisearch ~3s) across test files. Used together with Vitest's
// `globalSetup`/`globalTeardown` hooks to start once per test run.

type Stoppable = { stop: () => Promise<void> };

// We cache the IN-FLIGHT Promise<T>, not the resolved handle. This makes
// concurrent calls with the same key wait on a single start instead of
// racing two parallel factory invocations (which would orphan one
// container with no `stop()` ever called).
const pool: Map<string, Promise<Stoppable>> = new Map();

// Returns the cached handle for `key`, or starts a new one via `factory()`.
// Subsequent calls with the same key return the same handle without
// re-starting the container — including concurrent callers, which all
// resolve from the SAME promise.
export async function getOrCreate<T extends Stoppable>(
  key: string,
  factory: () => Promise<T>,
): Promise<T> {
  const existing = pool.get(key);
  if (existing) return existing as Promise<T>;
  // Start the factory and immediately store the promise so concurrent callers
  // observe the same in-flight start. If the factory rejects, drop the entry
  // so a later caller can retry instead of being stuck with a poisoned promise.
  const promise = (async () => factory())();
  pool.set(key, promise);
  try {
    return await (promise as Promise<T>);
  } catch (e) {
    pool.delete(key);
    throw e;
  }
}

// Stops every container in the pool and clears it. Call from Vitest
// `globalTeardown` so leftover containers do not survive the test run.
// Throws AggregateError when one or more stops fail, so all diagnostic info
// is preserved (the previous "throw first error" version lost the others).
export async function cleanupAllContainers(): Promise<void> {
  const errors: unknown[] = [];
  const entries = Array.from(pool.values());
  for (const promise of entries) {
    try {
      const handle = await promise;
      await handle.stop();
    } catch (e) {
      errors.push(e);
    }
  }
  pool.clear();
  if (errors.length > 0) {
    if (typeof AggregateError !== 'undefined') {
      throw new AggregateError(
        errors.map((e) => (e instanceof Error ? e : new Error(String(e)))),
        `cleanupAllContainers: ${errors.length} container(s) failed to stop`,
      );
    }
    throw errors[0];
  }
}

// Test-only: drop a single entry (e.g. when a chaos test deliberately stopped
// a container to simulate failure and now wants the pool to forget it).
// Returns true if the key was found and evicted.
export function evict(key: string): boolean {
  return pool.delete(key);
}
