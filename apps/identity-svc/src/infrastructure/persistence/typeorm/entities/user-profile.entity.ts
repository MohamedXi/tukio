import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { AcquisitionSource } from '@tukio/contracts/types/Acquisition';

@Entity({ name: 'user_profiles' })
export class UserProfileEntity {
  @PrimaryColumn({ name: 'id', type: 'uuid' })
  id!: string;

  @Index('idx_user_profiles_keycloak_user_id', { unique: true })
  @Column({ name: 'keycloak_user_id', type: 'uuid' })
  keycloakUserId!: string;

  @Column({ name: 'email', type: 'varchar', length: 254, unique: true })
  email!: string;

  @Column({ name: 'first_name', type: 'varchar', length: 80 })
  firstName!: string;

  @Column({ name: 'last_name', type: 'varchar', length: 80 })
  lastName!: string;

  @Column({ name: 'role', type: 'varchar', length: 20 })
  role!: string;

  @Column({ name: 'locale', type: 'varchar', length: 2, default: 'fr' })
  locale!: string;

  // Acquisition tracking columns (Story 0.13 — migration 1715220000000).
  // Indexed in: idx_user_profiles_acquisition_source, idx_user_profiles_acquisition_campaign,
  // idx_user_profiles_acquisition_first_touch.
  @Index('idx_user_profiles_acquisition_source')
  @Column({ name: 'acquisition_source', type: 'text', default: 'unknown' })
  acquisitionSource!: AcquisitionSource;

  @Column({ name: 'acquisition_medium', type: 'text', nullable: true })
  acquisitionMedium!: string | null;

  @Column({ name: 'acquisition_campaign', type: 'text', nullable: true })
  acquisitionCampaign!: string | null;

  @Column({ name: 'acquisition_referral_id', type: 'uuid', nullable: true })
  acquisitionReferralId!: string | null;

  @Index('idx_user_profiles_acquisition_first_touch')
  @Column({ name: 'acquisition_first_touch', type: 'timestamptz' })
  acquisitionFirstTouch!: Date;

  @Column({ name: 'acquisition_last_touch', type: 'timestamptz' })
  acquisitionLastTouch!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
