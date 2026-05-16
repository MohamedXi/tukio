import {
  UserStatus,
  ALL_USER_STATUSES,
  isUserStatus,
} from './user-status.enum.js';

describe('UserStatus', () => {
  it('exposes the 4 canonical statuses', () => {
    expect(ALL_USER_STATUSES).toEqual([
      'active',
      'pending_admin_review',
      'rejected',
      'suspended',
    ]);
  });

  it('isUserStatus accepts every canonical value', () => {
    for (const status of Object.values(UserStatus)) {
      expect(isUserStatus(status)).toBe(true);
    }
  });

  it('isUserStatus rejects non-canonical strings', () => {
    expect(isUserStatus('banned')).toBe(false);
    expect(isUserStatus('')).toBe(false);
  });

  it('isUserStatus rejects non-string values', () => {
    expect(isUserStatus(42)).toBe(false);
    expect(isUserStatus(null)).toBe(false);
    expect(isUserStatus(undefined)).toBe(false);
  });
});
