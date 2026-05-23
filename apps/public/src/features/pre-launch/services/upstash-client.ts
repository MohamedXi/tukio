import { Redis } from '@upstash/redis';

// Single Redis client shared by rate-limit and position-cache services.
// Lazy memoization: the constructor is called once on first use to avoid
// failing at module load when env vars are unset (e.g., during build/static analysis).

let redisInstance: Redis | undefined;

export function getUpstashRedis(): Redis {
  if (!redisInstance) {
    const url = process.env['UPSTASH_REDIS_REST_URL'];
    const token = process.env['UPSTASH_REDIS_REST_TOKEN'];
    if (!url || !token) {
      throw new Error('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set');
    }
    redisInstance = new Redis({ url, token });
  }
  return redisInstance;
}

// Test helper — never used in production code.
export function __resetUpstashRedisForTests(): void {
  redisInstance = undefined;
}
