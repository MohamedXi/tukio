import { Email } from '../../../../domain/model/email.value-object.js';
import { UserProfile } from '../../../../domain/model/user-profile.aggregate.js';
import { isUserRole } from '../../../../domain/model/user-role.enum.js';
import { CorruptedDataException } from '../../../../domain/exception/corrupted-data.exception.js';
import type { Locale } from '@tukio/contracts/types/Locale';
import { UserProfileEntity } from '../entities/user-profile.entity.js';

const isLocale = (value: string): value is Locale =>
  value === 'fr' || value === 'en';

export class UserProfileMapper {
  static toDomain(entity: UserProfileEntity): UserProfile {
    if (!isUserRole(entity.role)) {
      throw new CorruptedDataException(
        `invalid role value in user_profiles row`,
      );
    }
    if (!isLocale(entity.locale)) {
      throw new CorruptedDataException(
        `invalid locale value in user_profiles row`,
      );
    }
    return UserProfile.create({
      id: entity.id,
      keycloakUserId: entity.keycloakUserId,
      email: Email.create(entity.email),
      firstName: entity.firstName,
      lastName: entity.lastName,
      role: entity.role,
      locale: entity.locale,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      deletedAt: entity.deletedAt,
    });
  }

  static toEntity(aggregate: UserProfile): UserProfileEntity {
    const entity = new UserProfileEntity();
    entity.id = aggregate.id;
    entity.keycloakUserId = aggregate.keycloakUserId;
    entity.email = aggregate.email.toString();
    entity.firstName = aggregate.firstName;
    entity.lastName = aggregate.lastName;
    entity.role = aggregate.role;
    entity.locale = aggregate.locale;
    // createdAt and updatedAt are managed by @CreateDateColumn / @UpdateDateColumn — do not override.
    entity.deletedAt = aggregate.deletedAt;
    return entity;
  }
}
