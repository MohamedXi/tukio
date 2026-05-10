import type { Locale } from '@tukio/contracts/types/Locale';
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
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.deletedAt = props.deletedAt;
  }

  static create(props: UserProfileProps): UserProfile {
    UserProfile.assertNonEmptyId(props.id, 'id');
    UserProfile.assertNonEmptyId(props.keycloakUserId, 'keycloakUserId');
    UserProfile.assertName(props.firstName, 'firstName');
    UserProfile.assertName(props.lastName, 'lastName');
    if (!Object.values(UserRole).includes(props.role)) {
      throw new InvalidUserProfileException(
        `Invalid role: ${String(props.role)}`,
      );
    }
    if (props.locale !== 'fr' && props.locale !== 'en') {
      throw new InvalidUserProfileException(
        `Invalid locale: ${String(props.locale)}`,
      );
    }
    return new UserProfile(props);
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
