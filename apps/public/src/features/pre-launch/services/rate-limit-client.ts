import { Ratelimit } from '@upstash/ratelimit';
import { getUpstashRedis } from './upstash-client.js';

// Lazy memoization: rate limiter built on first call so that empty env in non-prod
// (dev fallback path skips rate limiting altogether) doesn't fail at module load.

let signupLimiter: Ratelimit | undefined;
let contactLimiter: Ratelimit | undefined;

export function getSignupRatelimit(): Ratelimit {
  if (!signupLimiter) {
    signupLimiter = new Ratelimit({
      redis: getUpstashRedis(),
      limiter: Ratelimit.slidingWindow(5, '1 m'),
      analytics: false,
      prefix: 'tukio:pre-launch:signup',
    });
  }
  return signupLimiter;
}

export function getContactRatelimit(): Ratelimit {
  if (!contactLimiter) {
    contactLimiter = new Ratelimit({
      redis: getUpstashRedis(),
      limiter: Ratelimit.slidingWindow(5, '1 m'),
      analytics: false,
      prefix: 'tukio:pre-launch:contact',
    });
  }
  return contactLimiter;
}

// Backwards-compat for callers that imported the eager singletons.
// Construct on access via Proxy so `vi.mock` of named exports keeps working.
export const signupRatelimit = {
  limit: (identifier: string) => getSignupRatelimit().limit(identifier),
};
export const contactRatelimit = {
  limit: (identifier: string) => getContactRatelimit().limit(identifier),
};

// Test helper — resets memoized instances.
export function __resetRatelimitForTests(): void {
  signupLimiter = undefined;
  contactLimiter = undefined;
}
