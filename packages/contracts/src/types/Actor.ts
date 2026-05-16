import type { Locale } from './Locale.js';

export interface Actor {
  userId: string;
  role: 'client' | 'pro' | 'admin-support' | 'admin-modo' | 'admin-super' | 'system' | 'anonymous';
  locale: Locale;
}

/**
 * Nil UUID sentinel used when the actor is the system itself (no real user
 * triggered the event). Schemas declare `actor.userId: { type: string }` without
 * a `format: uuid` constraint, so consumers iterating actor.userId must check
 * for this sentinel before treating the value as a real user FK.
 */
export const SYSTEM_ACTOR_USER_ID = '00000000-0000-0000-0000-000000000000' as const;
