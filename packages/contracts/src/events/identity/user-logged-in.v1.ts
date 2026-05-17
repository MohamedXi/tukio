import type { DomainEvent } from '../../types/DomainEvent.js';
import type { Locale } from '../../types/Locale.js';

export type UserLoggedInRole = 'client' | 'pro' | 'admin-support' | 'admin-modo' | 'admin-super';

export interface UserLoggedInV1Payload {
  userId: string;
  locale: Locale;
  role: UserLoggedInRole[];
  ipHash: string;
  userAgentHash: string;
  loggedInAt: string;
}

export type UserLoggedInV1 = DomainEvent<UserLoggedInV1Payload> & {
  eventType: 'identity.user.logged-in.v1';
  eventVersion: 'v1';
  aggregate: { type: 'user-profile'; id: string };
};

export const USER_LOGGED_IN_V1_TYPE = 'identity.user.logged-in.v1' as const;
