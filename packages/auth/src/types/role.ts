export type Role = 'client' | 'pro' | 'admin-support' | 'admin-modo' | 'admin-super';

export const ROLE_PRECEDENCE: Role[] = [
  'admin-super',
  'admin-modo',
  'admin-support',
  'pro',
  'client',
];
