/**
 * Tukio business-level user account status (orthogonal to Keycloak `enabled` flag).
 *
 * - `active`               : verified or self-served account (Customer B2C par défaut Story 1.2a).
 * - `pending_admin_review` : Pro registration awaiting admin KYC verification (Story 1.3).
 * - `rejected`             : admin rejected the account (Story 2.5).
 * - `suspended`            : admin-imposed suspension (Story 6.5 sanction graduée).
 */
export const UserStatus = {
  ACTIVE: 'active',
  PENDING_ADMIN_REVIEW: 'pending_admin_review',
  REJECTED: 'rejected',
  SUSPENDED: 'suspended',
} as const;

export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const ALL_USER_STATUSES: readonly UserStatus[] =
  Object.values(UserStatus);

export function isUserStatus(value: unknown): value is UserStatus {
  return (
    typeof value === 'string' && ALL_USER_STATUSES.includes(value as UserStatus)
  );
}
