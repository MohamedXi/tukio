/**
 * Pro KYC verification lifecycle (separate from `UserStatus.tukio_status`).
 *
 * - `pending_review` : dossier submitted, awaiting admin (Story 1.3 default).
 * - `approved`       : admin validated documents (Story 2.4 outcome).
 * - `rejected`       : admin refused dossier (Story 2.5 outcome).
 */
export const KycStatus = {
  PENDING_REVIEW: 'pending_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export type KycStatus = (typeof KycStatus)[keyof typeof KycStatus];

export const ALL_KYC_STATUSES: readonly KycStatus[] = Object.values(KycStatus);

export function isKycStatus(value: unknown): value is KycStatus {
  return (
    typeof value === 'string' && ALL_KYC_STATUSES.includes(value as KycStatus)
  );
}
