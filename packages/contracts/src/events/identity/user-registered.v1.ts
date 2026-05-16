import type { DomainEvent } from '../../types/DomainEvent.js';
import type { AcquisitionSource } from '../../types/Acquisition.js';
import type { Locale } from '../../types/Locale.js';

export interface UserRegisteredV1Payload {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'client';
  locale: Locale;
  acquisitionSource: AcquisitionSource;
  acquisitionMedium: string | null;
  acquisitionCampaign: string | null;
  acquisitionContent: string | null;
  acquisitionTerm: string | null;
  acquisitionReferralId: string | null;
  marketingOptIn: boolean;
  registeredAt: string;
}

export type UserRegisteredV1 = DomainEvent<UserRegisteredV1Payload> & {
  eventType: 'identity.user.registered.v1';
  eventVersion: 'v1';
  aggregate: { type: 'user-profile'; id: string };
};

export const USER_REGISTERED_V1_TYPE = 'identity.user.registered.v1' as const;
