import { Email } from '../../../../domain/model/email.value-object.js';
import { UserProfile } from '../../../../domain/model/user-profile.aggregate.js';
import { isUserRole } from '../../../../domain/model/user-role.enum.js';
import type { Locale } from '@tukio/contracts/types/Locale';
import { UserProfileEntity } from '../entities/user-profile.entity.js';

const isLocale = (value: string): value is Locale =>
  value === 'fr' || value === 'en';

export class UserProfileMapper {
  static toDomain(entity: UserProfileEntity): UserProfile {
    if (!isUserRole(entity.role)) {
      throw new Error(
        `UserProfileMapper: invalid role in DB for user ${entity.id}: ${entity.role}`,
      );
    }
    if (!isLocale(entity.locale)) {
      throw new Error(
        `UserProfileMapper: invalid locale in DB for user ${entity.id}: ${entity.locale}`,
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
    entity.createdAt = aggregate.createdAt;
    entity.updatedAt = aggregate.updatedAt;
    entity.deletedAt = aggregate.deletedAt;
    return entity;
  }
}
