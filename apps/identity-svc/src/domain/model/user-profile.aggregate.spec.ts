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

  it('defaults new Story 1.2a fields (status/emailVerified/marketingOptIn/acceptTerms) when omitted', () => {
    const profile = UserProfile.create(validProps());
    expect(profile.status).toBe('active');
    expect(profile.emailVerified).toBe(false);
    expect(profile.marketingOptIn).toBe(false);
    expect(profile.acceptTerms).toBe(false);
    expect(profile.acceptTermsAt).toBeNull();
  });

  it('rejects unknown status value', () => {
    expect(() =>
      UserProfile.create(validProps({ status: 'banned' as any })),
    ).toThrow(InvalidUserProfileException);
  });

  it('rejects non-string firstName via assertName branch', () => {
    expect(() =>
      UserProfile.create(validProps({ firstName: 42 as any })),
    ).toThrow(InvalidUserProfileException);
  });

  it('isEmailVerified() returns the emailVerified flag', () => {
    const profile = UserProfile.create(validProps({ emailVerified: true }));
    expect(profile.isEmailVerified()).toBe(true);
  });

  it('isActive() returns true only for active non-deleted profiles', () => {
    const active = UserProfile.create(validProps());
    expect(active.isActive()).toBe(true);

    const deleted = UserProfile.create(validProps({ deletedAt: new Date() }));
    expect(deleted.isActive()).toBe(false);

    const suspended = UserProfile.create(validProps({ status: 'suspended' }));
    expect(suspended.isActive()).toBe(false);
  });

  it('rejects acceptTerms=true with acceptTermsAt=null (review patch P13 — RGPD coherence)', () => {
    expect(() =>
      UserProfile.create(
        validProps({ acceptTerms: true, acceptTermsAt: null }),
      ),
    ).toThrow(InvalidUserProfileException);
  });

  it('rejects acceptTerms=false with acceptTermsAt set (review patch P13)', () => {
    expect(() =>
      UserProfile.create(
        validProps({ acceptTerms: false, acceptTermsAt: new Date() }),
      ),
    ).toThrow(InvalidUserProfileException);
  });

  it('accepts the coherent pair acceptTerms=true + acceptTermsAt=Date', () => {
    const profile = UserProfile.create(
      validProps({
        acceptTerms: true,
        acceptTermsAt: new Date('2026-05-15T12:00:00Z'),
      }),
    );
    expect(profile.acceptTerms).toBe(true);
    expect(profile.acceptTermsAt).toEqual(new Date('2026-05-15T12:00:00Z'));
  });
});

describe('UserProfile.register() factory (Story 1.2a customer-specific)', () => {
  const fixedNow = new Date('2026-05-15T12:00:00Z');
  const baseInput = {
    email: Email.create('alice@example.com'),
    firstName: 'Alice',
    lastName: 'Martin',
    locale: 'fr' as const,
    marketingOptIn: false,
    keycloakUserId: '22222222-2222-4222-8222-222222222222',
    id: '11111111-1111-4111-8111-111111111111',
    now: fixedNow,
  };

  it('produces an active, unverified client with acceptTerms = true', () => {
    const profile = UserProfile.register(baseInput);
    expect(profile.role).toBe('client');
    expect(profile.status).toBe('active');
    expect(profile.emailVerified).toBe(false);
    expect(profile.acceptTerms).toBe(true);
    expect(profile.acceptTermsAt).toEqual(fixedNow);
    expect(profile.marketingOptIn).toBe(false);
    expect(profile.createdAt).toEqual(fixedNow);
    expect(profile.updatedAt).toEqual(fixedNow);
    expect(profile.deletedAt).toBeNull();
  });

  it('propagates marketingOptIn = true from the form input', () => {
    const profile = UserProfile.register({
      ...baseInput,
      marketingOptIn: true,
    });
    expect(profile.marketingOptIn).toBe(true);
  });

  it('defaults acquisition source to "unknown" when not provided', () => {
    const profile = UserProfile.register(baseInput);
    expect(profile.acquisition.source).toBe('unknown');
    expect(profile.acquisition.firstTouch).toBe(fixedNow.toISOString());
    expect(profile.acquisition.lastTouch).toBe(fixedNow.toISOString());
  });

  it('persists acquisition fields when provided (first-touch wins)', () => {
    const profile = UserProfile.register({
      ...baseInput,
      acquisition: {
        source: 'google_ads',
        medium: 'cpc',
        campaign: 'spring2026',
        referralId: '33333333-3333-4333-8333-333333333333',
      },
    });
    expect(profile.acquisition.source).toBe('google_ads');
    expect(profile.acquisition.medium).toBe('cpc');
    expect(profile.acquisition.campaign).toBe('spring2026');
    expect(profile.acquisition.referralId).toBe(
      '33333333-3333-4333-8333-333333333333',
    );
  });

  it('trims firstName and lastName before persistence', () => {
    const profile = UserProfile.register({
      ...baseInput,
      firstName: '  Alice  ',
      lastName: '  Martin  ',
    });
    expect(profile.firstName).toBe('Alice');
    expect(profile.lastName).toBe('Martin');
  });

  it('generates an id when none is provided', () => {
    const profile = UserProfile.register({
      email: baseInput.email,
      firstName: baseInput.firstName,
      lastName: baseInput.lastName,
      locale: baseInput.locale,
      marketingOptIn: baseInput.marketingOptIn,
      keycloakUserId: baseInput.keycloakUserId,
    });
    expect(profile.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
    );
  });
});
