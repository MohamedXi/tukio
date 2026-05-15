import { Email } from '../../../../domain/model/email.value-object.js';
import { UserProfile } from '../../../../domain/model/user-profile.aggregate.js';
import { isUserRole } from '../../../../domain/model/user-role.enum.js';
import { CorruptedDataException } from '../../../../domain/exception/corrupted-data.exception.js';
import type { Locale } from '@tukio/contracts/types/Locale';
import {
  isAcquisitionSource,
  type AcquisitionContext,
} from '@tukio/contracts/types/Acquisition';
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
    const source = isAcquisitionSource(entity.acquisitionSource)
      ? entity.acquisitionSource
      : 'unknown';

    const acquisition: AcquisitionContext = {
      source,
      medium: entity.acquisitionMedium ?? undefined,
      campaign: entity.acquisitionCampaign ?? undefined,
      referralId: entity.acquisitionReferralId ?? undefined,
      firstTouch: entity.acquisitionFirstTouch.toISOString(),
      lastTouch: entity.acquisitionLastTouch.toISOString(),
    };

    return UserProfile.create({
      id: entity.id,
      keycloakUserId: entity.keycloakUserId,
      email: Email.create(entity.email),
      firstName: entity.firstName,
      lastName: entity.lastName,
      role: entity.role,
      locale: entity.locale,
      acquisition,
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
    entity.acquisitionSource = aggregate.acquisition.source;
    entity.acquisitionMedium = aggregate.acquisition.medium ?? null;
    entity.acquisitionCampaign = aggregate.acquisition.campaign ?? null;
    entity.acquisitionReferralId = aggregate.acquisition.referralId ?? null;
    entity.acquisitionFirstTouch = new Date(aggregate.acquisition.firstTouch);
    entity.acquisitionLastTouch = new Date(aggregate.acquisition.lastTouch);
    // createdAt, updatedAt managed by @CreateDateColumn / @UpdateDateColumn — do not override.
    entity.deletedAt = aggregate.deletedAt;
    return entity;
  }
}
