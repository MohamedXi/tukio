import { Redis } from '@upstash/redis';
import { resendClient } from './resend-client.js';

const POSITION_CACHE_TTL_SECONDS = 300; // 5 minutes

function getRedis(): Redis {
  return new Redis({
    url: process.env['UPSTASH_REDIS_REST_URL'] ?? '',
    token: process.env['UPSTASH_REDIS_REST_TOKEN'] ?? '',
  });
}

function positionCacheKey(audienceId: string): string {
  return `tukio:pre-launch:position:${audienceId}`;
}

// Returns the estimated waitlist position for a newly added contact.
// Cache TTL 5min: position is approximate (within ~1 contact over a 5min window).
export async function computePosition(audienceId: string): Promise<number> {
  const redis = getRedis();
  const cacheKey = positionCacheKey(audienceId);
  const cached = await redis.get<number>(cacheKey);
  if (cached !== null && cached !== undefined) {
    return cached + 1;
  }
  const list = await resendClient.contacts.list({ audienceId });
  const count = Array.isArray(list.data?.data) ? list.data.data.length : 0;
  await redis.set(cacheKey, count, { ex: POSITION_CACHE_TTL_SECONDS });
  return count + 1;
}

export async function getCachedPosition(audienceId: string): Promise<number> {
  const redis = getRedis();
  const cacheKey = positionCacheKey(audienceId);
  const cached = await redis.get<number>(cacheKey);
  return (cached ?? 0) + 1;
}
