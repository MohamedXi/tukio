import type { DomainEvent } from '../../types/DomainEvent.js';
import type { AcquisitionSource } from '../../types/Acquisition.js';
import type { Locale } from '../../types/Locale.js';

export interface ProRegisteredV1Address {
  street: string;
  postalCode: string;
  city: string;
  country: 'FR';
}

export interface ProRegisteredV1Payload {
  userProfileId: string;
  proProfileId: string;
  email: string;
  firstName: string;
  lastName: string;
  companyName: string;
  siret: string;
  vatNumber: string | null;
  address: ProRegisteredV1Address;
  contactPhone: string;
  kycStatus: 'pending_review';
  tukioStatus: 'pending_admin_review';
  /** INSEE SIRENE V3.11 snapshot at registration time (Story 1.3b). */
  inseeDenomination: string | null;
  inseeDateCreation: string | null;
  inseeCategorieJuridique: string | null;
  acquisitionSource: AcquisitionSource;
  acquisitionMedium: string | null;
  acquisitionCampaign: string | null;
  acquisitionContent: string | null;
  acquisitionTerm: string | null;
  acquisitionReferralId: string | null;
  marketingOptIn: boolean;
  registeredAt: string;
}

export type ProRegisteredV1 = DomainEvent<ProRegisteredV1Payload> & {
  eventType: 'identity.pro.registered.v1';
  eventVersion: 'v1';
  aggregate: { type: 'pro-profile'; id: string };
  actor: { userId: string; role: 'pro'; locale: Locale };
};

export const PRO_REGISTERED_V1_TYPE = 'identity.pro.registered.v1' as const;
