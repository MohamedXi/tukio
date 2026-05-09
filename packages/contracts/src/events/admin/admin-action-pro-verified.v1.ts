import type { DomainEvent } from '../../types/DomainEvent.js';

export interface AdminActionProVerifiedV1Payload {
  proId: string;
  adminId: string;
  decision: 'approved' | 'rejected';
  reason: string | null;
  decidedAt: string;
}

export type AdminActionProVerifiedV1 = DomainEvent<AdminActionProVerifiedV1Payload> & {
  eventType: 'admin.action.pro-verified.v1';
  eventVersion: 'v1';
  aggregate: { type: 'admin-action'; id: string };
};

export const ADMIN_ACTION_PRO_VERIFIED_V1_TYPE = 'admin.action.pro-verified.v1' as const;
