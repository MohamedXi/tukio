import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Separate singletons per namespace to track signup vs contact independently.
// Sliding window: more accurate than fixed window at minute boundaries.

function makeRedis(): Redis {
  return new Redis({
    url: process.env['UPSTASH_REDIS_REST_URL'] ?? '',
    token: process.env['UPSTASH_REDIS_REST_TOKEN'] ?? '',
  });
}

export const signupRatelimit = new Ratelimit({
  redis: makeRedis(),
  limiter: Ratelimit.slidingWindow(5, '1 m'),
  analytics: false,
  prefix: 'tukio:pre-launch:signup',
});

export const contactRatelimit = new Ratelimit({
  redis: makeRedis(),
  limiter: Ratelimit.slidingWindow(5, '1 m'),
  analytics: false,
  prefix: 'tukio:pre-launch:contact',
});
