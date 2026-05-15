import type { Locale } from '@tukio/contracts/types/Locale';
import type {
  AcquisitionSource,
  AcquisitionContext,
} from '@tukio/contracts/types/Acquisition';
import { Email } from './email.value-object.js';
import { UserRole } from './user-role.enum.js';
import { InvalidUserProfileException } from '../exception/invalid-user-profile.exception.js';

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
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;

  private constructor(props: UserProfileProps) {
    this.id = props.id;
    this.keycloakUserId = props.keycloakUserId;
    this.email = props.email;
    this.firstName = props.firstName;
    this.lastName = props.lastName;
    this.role = props.role;
    this.locale = props.locale;
    this.acquisition = props.acquisition;
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
    const acquisition: typeof props.acquisition =
      props.acquisition ?? UserProfile.defaultAcquisition();
    const normalized: UserProfileProps = {
      ...props,
      firstName,
      lastName,
      acquisition,
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
    return new UserProfile(normalized);
  }

  isDeleted(): boolean {
    return this.deletedAt !== null;
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
