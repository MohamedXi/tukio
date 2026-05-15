import { Email } from './email.value-object.js';
import {
  UserProfile,
  type UserProfileProps,
} from './user-profile.aggregate.js';
import { UserRole } from './user-role.enum.js';
import { InvalidUserProfileException } from '../exception/invalid-user-profile.exception.js';

const validProps = (
  overrides: Partial<UserProfileProps> = {},
): UserProfileProps => ({
  id: '11111111-1111-1111-1111-111111111111',
  keycloakUserId: '22222222-2222-2222-2222-222222222222',
  email: Email.create('jane@tukio.one'),
  firstName: 'Jane',
  lastName: 'Doe',
  role: UserRole.CLIENT,
  locale: 'fr',
  acquisition: UserProfile.defaultAcquisition(),
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  deletedAt: null,
  ...overrides,
});

describe('UserProfile (aggregate)', () => {
  it('creates a valid UserProfile', () => {
    const profile = UserProfile.create(validProps());
    expect(profile.id).toBe('11111111-1111-1111-1111-111111111111');
    expect(profile.firstName).toBe('Jane');
    expect(profile.role).toBe('client');
    expect(profile.locale).toBe('fr');
    expect(profile.isDeleted()).toBe(false);
  });

  it('flags soft-deleted profiles', () => {
    const profile = UserProfile.create(validProps({ deletedAt: new Date() }));
    expect(profile.isDeleted()).toBe(true);
  });

  it('rejects empty id', () => {
    expect(() => UserProfile.create(validProps({ id: '   ' }))).toThrow(
      InvalidUserProfileException,
    );
  });

  it('rejects empty keycloakUserId', () => {
    expect(() =>
      UserProfile.create(validProps({ keycloakUserId: '' })),
    ).toThrow(InvalidUserProfileException);
  });

  it('rejects firstName too short or too long', () => {
    expect(() => UserProfile.create(validProps({ firstName: '' }))).toThrow(
      InvalidUserProfileException,
    );
    expect(() =>
      UserProfile.create(validProps({ firstName: 'a'.repeat(81) })),
    ).toThrow(InvalidUserProfileException);
  });

  it('rejects unknown role', () => {
    expect(() =>
      UserProfile.create(validProps({ role: 'wizard' as any })),
    ).toThrow(InvalidUserProfileException);
  });

  it('rejects unsupported locale', () => {
    expect(() =>
      UserProfile.create(validProps({ locale: 'es' as any })),
    ).toThrow(InvalidUserProfileException);
  });
});
