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

  // Story 1.2b — customer registration columns (migration 1715230000000).
  // `tukio_status` distinct from Keycloak `enabled` flag : the tukio business
  // status (active / pending_admin_review / rejected / suspended) is orthogonal
  // to Keycloak's account-enabled toggle.
  @Index('idx_user_profiles_tukio_status', { where: '"deleted_at" IS NULL' })
  @Column({
    name: 'tukio_status',
    type: 'varchar',
    length: 30,
    default: 'active',
  })
  tukioStatus!: string;

  @Index('idx_user_profiles_email_verified', { where: '"deleted_at" IS NULL' })
  @Column({ name: 'email_verified', type: 'boolean', default: false })
  emailVerified!: boolean;

  @Column({ name: 'marketing_opt_in', type: 'boolean', default: false })
  marketingOptIn!: boolean;

  @Column({ name: 'accept_terms', type: 'boolean', default: false })
  acceptTerms!: boolean;

  @Column({ name: 'accept_terms_at', type: 'timestamptz', nullable: true })
  acceptTermsAt!: Date | null;

  @Column({ name: 'phone', type: 'varchar', length: 20, nullable: true })
  phone!: string | null;

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

  // Story 1.2b — UTM content + term (review patch E3 from 1.2a code-review).
  // Migration 1715230000000 adds these columns alongside the registration
  // fields above so the end-to-end UTM persistence is atomic.
  @Column({ name: 'acquisition_content', type: 'text', nullable: true })
  acquisitionContent!: string | null;

  @Column({ name: 'acquisition_term', type: 'text', nullable: true })
  acquisitionTerm!: string | null;

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
