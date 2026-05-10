import { ALL_USER_ROLES, isUserRole, UserRole } from './user-role.enum.js';

describe('UserRole', () => {
  it('exposes all 5 roles', () => {
    expect(ALL_USER_ROLES).toEqual([
      'client',
      'pro',
      'admin-support',
      'admin-modo',
      'admin-super',
    ]);
  });

  it('isUserRole accepts known roles', () => {
    for (const role of ALL_USER_ROLES) {
      expect(isUserRole(role)).toBe(true);
    }
    expect(isUserRole(UserRole.PRO)).toBe(true);
  });

  it('isUserRole rejects unknown values', () => {
    expect(isUserRole('wizard')).toBe(false);
    expect(isUserRole(42)).toBe(false);
    expect(isUserRole(null)).toBe(false);
    expect(isUserRole(undefined)).toBe(false);
  });
});
