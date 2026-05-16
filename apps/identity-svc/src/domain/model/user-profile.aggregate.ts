import { randomUUID } from 'node:crypto';
import type { Locale } from '@tukio/contracts/types/Locale';
import type {
  AcquisitionSource,
  AcquisitionContext,
} from '@tukio/contracts/types/Acquisition';
import { Email } from './email.value-object.js';
import { UserRole } from './user-role.enum.js';
import { UserStatus } from './user-status.enum.js';
import { InvalidUserProfileException } from '../exception/invalid-user-profile.exception.js';

/**
 * Optional acquisition input used by the `register()` factory.
 * Aligned with `AcquisitionInputDto` (`@tukio/contracts/dtos/identity`) — the
 * customer-facing form/gateway provides UTM-style fields, and the factory
 * derives the persisted `AcquisitionContext` (with firstTouch/lastTouch).
 */
export interface RegisterAcquisitionInput {
  source?: AcquisitionSource;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
  referralId?: string;
}

export interface RegisterCustomerProps {
  email: Email;
  firstName: string;
  lastName: string;
  locale: Locale;
  marketingOptIn: boolean;
  keycloakUserId: string;
  acquisition?: RegisterAcquisitionInput;
  /** Override for tests; defaults to `randomUUID()` at call time. */
  id?: string;
  /** Override for tests; defaults to `new Date()` at call time. */
  now?: Date;
}

export interface UserProfileProps {
  readonly id: string;
  readonly keycloakUserId: string;
  readonly email: Email;
  readonly firstName: string;
  readonly lastName: string;
  readonly role: UserRole;
  readonly locale: Locale;
  readonly acquisition: AcquisitionContext;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
  /**
   * New fields added Story 1.2a — optional with sensible defaults so the
   * existing `UserProfileMapper.toDomain` (Story 0.6) continues to work
   * before Story 1.2b adds the DB columns + mapper extensions.
   */
  readonly status?: UserStatus;
  readonly emailVerified?: boolean;
  readonly marketingOptIn?: boolean;
  readonly acceptTerms?: boolean;
  readonly acceptTermsAt?: Date | null;
}

const NAME_MIN = 1;
const NAME_MAX = 80;

export class UserProfile {
  readonly id: string;
  readonly keycloakUserId: string;
  readonly email: Email;
  readonly firstName: string;
  readonly lastName: string;
  readonly role: UserRole;
  readonly locale: Locale;
  readonly acquisition: AcquisitionContext;
  readonly status: UserStatus;
  readonly emailVerified: boolean;
  readonly marketingOptIn: boolean;
  readonly acceptTerms: boolean;
  readonly acceptTermsAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;

  private constructor(props: Required<UserProfileProps>) {
    this.id = props.id;
    this.keycloakUserId = props.keycloakUserId;
    this.email = props.email;
    this.firstName = props.firstName;
    this.lastName = props.lastName;
    this.role = props.role;
    this.locale = props.locale;
    this.acquisition = props.acquisition;
    this.status = props.status;
    this.emailVerified = props.emailVerified;
    this.marketingOptIn = props.marketingOptIn;
    this.acceptTerms = props.acceptTerms;
    this.acceptTermsAt = props.acceptTermsAt;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.deletedAt = props.deletedAt;
  }

  // Factory evaluated at call time (not at module load) so firstTouch/lastTouch
  // reflect the actual registration timestamp, not the server boot timestamp.
  static defaultAcquisition(): AcquisitionContext {
    const now = new Date().toISOString();
    return {
      source: 'unknown' satisfies AcquisitionSource,
      firstTouch: now,
      lastTouch: now,
    };
  }

  static create(props: UserProfileProps): UserProfile {
    // Normalize names: trim whitespace so validation and storage are consistent.
    const firstName =
      typeof props.firstName === 'string'
        ? props.firstName.trim()
        : props.firstName;
    const lastName =
      typeof props.lastName === 'string'
        ? props.lastName.trim()
        : props.lastName;
    const acquisition: AcquisitionContext =
      props.acquisition ?? UserProfile.defaultAcquisition();

    const normalized: Required<UserProfileProps> = {
      id: props.id,
      keycloakUserId: props.keycloakUserId,
      email: props.email,
      firstName,
      lastName,
      role: props.role,
      locale: props.locale,
      acquisition,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
      deletedAt: props.deletedAt,
      // Defaults applied here so existing rehydration paths (mapper.toDomain
      // built Story 0.6, before these columns existed) keep working until
      // Story 1.2b lands the migration + mapper extensions.
      status: props.status ?? UserStatus.ACTIVE,
      emailVerified: props.emailVerified ?? false,
      marketingOptIn: props.marketingOptIn ?? false,
      acceptTerms: props.acceptTerms ?? false,
      acceptTermsAt: props.acceptTermsAt ?? null,
    };

    UserProfile.assertNonEmptyId(normalized.id, 'id');
    UserProfile.assertNonEmptyId(normalized.keycloakUserId, 'keycloakUserId');
    UserProfile.assertName(normalized.firstName, 'firstName');
    UserProfile.assertName(normalized.lastName, 'lastName');
    if (!Object.values(UserRole).includes(normalized.role)) {
      throw new InvalidUserProfileException(
        `Invalid role: ${String(normalized.role)}`,
      );
    }
    if (normalized.locale !== 'fr' && normalized.locale !== 'en') {
      throw new InvalidUserProfileException(
        `Invalid locale: ${String(normalized.locale)}`,
      );
    }
    if (!Object.values(UserStatus).includes(normalized.status)) {
      throw new InvalidUserProfileException(
        `Invalid status: ${String(normalized.status)}`,
      );
    }
    // Story 1.2a review patch P13 — RGPD: acceptTerms and acceptTermsAt are
    // coupled. Either both indicate consent (true + Date), or both indicate
    // its absence (false + null). A corrupted DB row with only one of them
    // must be rejected at rehydration time.
    if (normalized.acceptTerms && normalized.acceptTermsAt === null) {
      throw new InvalidUserProfileException(
        'acceptTerms=true requires acceptTermsAt to be set',
      );
    }
    if (!normalized.acceptTerms && normalized.acceptTermsAt !== null) {
      throw new InvalidUserProfileException(
        'acceptTerms=false requires acceptTermsAt to be null',
      );
    }
    return new UserProfile(normalized);
  }

  /**
   * Customer-specific factory used by `RegisterCustomerUseCase` (Story 1.2a).
   * Always produces:
   *   - role          = `client`
   *   - status        = `active` (no admin gate for B2C — vs Story 1.3 Pro)
   *   - emailVerified = `false` (FR8/FR17: verification required for transactional flows)
   *   - acceptTerms   = `true` + acceptTermsAt = now (form gate enforced upstream)
   * `marketingOptIn` is RGPD opt-in passed through from the form (default false).
   * Acquisition fields are persisted with `firstTouch = lastTouch = now` (K-04
   * first-touch wins — multi-touch attribution refined Story 7.5).
   */
  static register(props: RegisterCustomerProps): UserProfile {
    const now = props.now ?? new Date();
    const nowIso = now.toISOString();
    const id = props.id ?? randomUUID();

    const acquisitionInput = props.acquisition ?? {};
    const acquisition: AcquisitionContext = {
      source: acquisitionInput.source ?? 'unknown',
      ...(acquisitionInput.medium !== undefined && {
        medium: acquisitionInput.medium,
      }),
      ...(acquisitionInput.campaign !== undefined && {
        campaign: acquisitionInput.campaign,
      }),
      ...(acquisitionInput.content !== undefined && {
        content: acquisitionInput.content,
      }),
      ...(acquisitionInput.term !== undefined && {
        term: acquisitionInput.term,
      }),
      ...(acquisitionInput.referralId !== undefined && {
        referralId: acquisitionInput.referralId,
      }),
      firstTouch: nowIso,
      lastTouch: nowIso,
    };

    return UserProfile.create({
      id,
      keycloakUserId: props.keycloakUserId,
      email: props.email,
      firstName: props.firstName,
      lastName: props.lastName,
      role: UserRole.CLIENT,
      locale: props.locale,
      acquisition,
      status: UserStatus.ACTIVE,
      emailVerified: false,
      marketingOptIn: props.marketingOptIn,
      acceptTerms: true,
      acceptTermsAt: now,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  }

  isDeleted(): boolean {
    return this.deletedAt !== null;
  }

  isEmailVerified(): boolean {
    return this.emailVerified;
  }

  isActive(): boolean {
    return this.status === UserStatus.ACTIVE && !this.isDeleted();
  }

  private static assertNonEmptyId(value: string, field: string): void {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new InvalidUserProfileException(
        `Field ${field} must be a non-empty string`,
      );
    }
  }

  private static assertName(value: string, field: string): void {
    if (typeof value !== 'string') {
      throw new InvalidUserProfileException(`Field ${field} must be a string`);
    }
    const len = value.trim().length;
    if (len < NAME_MIN || len > NAME_MAX) {
      throw new InvalidUserProfileException(
        `Field ${field} length must be between ${NAME_MIN} and ${NAME_MAX} characters`,
      );
    }
  }
}
