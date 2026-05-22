import { getUpstashRedis } from './upstash-client.js';
import { resendClient } from './resend-client.js';

const POSITION_CACHE_TTL_SECONDS = 300; // 5 minutes
const RESEND_LIST_PAGE_SIZE = 1000; // Spec L285: paginate when needed; MVP < 1000

function positionCacheKey(audienceId: string): string {
  return `tukio:pre-launch:position:${audienceId}`;
}

// Atomically returns the next position for a newly added contact.
// First call after TTL expiry seeds the counter from Resend; subsequent calls
// INCR atomically so concurrent signups receive distinct positions.
export async function computePosition(audienceId: string): Promise<number> {
  if (!audienceId) {
    throw new Error('computePosition requires a non-empty audienceId');
  }
  const redis = getUpstashRedis();
  const cacheKey = positionCacheKey(audienceId);

  // Seed if missing using NX (no-overwrite) — safe under concurrency.
  const exists = await redis.exists(cacheKey);
  if (!exists) {
    const list = await resendClient.contacts.list({ audienceId });
    const arr = list.data?.data;
    const count = Array.isArray(arr) ? Math.min(arr.length, RESEND_LIST_PAGE_SIZE) : 0;
    // nx: only set if missing — wins the race deterministically.
    await redis.set(cacheKey, count, { ex: POSITION_CACHE_TTL_SECONDS, nx: true });
  }

  // INCR is atomic — N parallel signups receive N distinct sequential positions.
  return await redis.incr(cacheKey);
}

// Returns a best-effort position for the duplicate-signup path WITHOUT incrementing.
// Falls through to `computePosition` (which seeds + increments) on cold cache so
// duplicate users never see the misleading `position: 1`.
export async function getCachedPosition(audienceId: string): Promise<number> {
  if (!audienceId) {
    throw new Error('getCachedPosition requires a non-empty audienceId');
  }
  const redis = getUpstashRedis();
  const cacheKey = positionCacheKey(audienceId);
  const cached = await redis.get<number>(cacheKey);
  if (cached === null || cached === undefined) {
    // Cold cache: fall back to compute (which also INCRs) — acceptable for duplicates
    // since they re-establish the counter baseline.
    return await computePosition(audienceId);
  }
  return cached;
}
