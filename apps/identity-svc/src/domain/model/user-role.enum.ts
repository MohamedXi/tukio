export const UserRole = {
  CLIENT: 'client',
  PRO: 'pro',
  ADMIN_SUPPORT: 'admin-support',
  ADMIN_MODO: 'admin-modo',
  ADMIN_SUPER: 'admin-super',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const ALL_USER_ROLES: readonly UserRole[] = Object.values(UserRole);

export function isUserRole(value: unknown): value is UserRole {
  return (
    typeof value === 'string' && ALL_USER_ROLES.includes(value as UserRole)
  );
}
