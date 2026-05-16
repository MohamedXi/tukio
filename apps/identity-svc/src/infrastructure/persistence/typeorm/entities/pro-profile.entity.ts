import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'pro_profiles' })
export class ProProfileEntity {
  @PrimaryColumn({ name: 'id', type: 'uuid' })
  id!: string;

  @Index('idx_pro_profiles_user_profile_id', { unique: true })
  @Column({ name: 'user_profile_id', type: 'uuid' })
  userProfileId!: string;

  @Column({ name: 'company_name', type: 'varchar', length: 200 })
  companyName!: string;

  // Uniqueness is enforced by a partial index `WHERE deleted_at IS NULL`
  // (migration 1715240000000). TypeORM's `unique: true` would create a
  // full unique constraint — we rely on the partial one instead (FR16).
  @Column({ name: 'siret', type: 'varchar', length: 14 })
  siret!: string;

  @Column({ name: 'vat_number', type: 'varchar', length: 20, nullable: true })
  vatNumber!: string | null;

  @Column({ name: 'address', type: 'jsonb' })
  address!: {
    street: string;
    postalCode: string;
    city: string;
    country: string;
  };

  @Column({ name: 'contact_phone', type: 'varchar', length: 20 })
  contactPhone!: string;

  @Column({ name: 'kyc_id_card_r2_key', type: 'varchar', length: 500 })
  kycIdCardR2Key!: string;

  @Column({ name: 'kyc_rib_r2_key', type: 'varchar', length: 500 })
  kycRibR2Key!: string;

  @Column({
    name: 'kyc_kbis_r2_key',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  kycKbisR2Key!: string | null;

  @Index('idx_pro_profiles_kyc_status', { where: '"deleted_at" IS NULL' })
  @Column({
    name: 'kyc_status',
    type: 'varchar',
    length: 30,
    default: 'pending_review',
  })
  kycStatus!: string;

  @Column({ name: 'kyc_decision_at', type: 'timestamptz', nullable: true })
  kycDecisionAt!: Date | null;

  @Column({ name: 'kyc_decision_by', type: 'uuid', nullable: true })
  kycDecisionBy!: string | null;

  @Column({ name: 'kyc_decision_reason', type: 'text', nullable: true })
  kycDecisionReason!: string | null;

  @Column({
    name: 'insee_denomination',
    type: 'varchar',
    length: 200,
    nullable: true,
  })
  inseeDenomination!: string | null;

  @Column({
    name: 'insee_incorporation_date',
    type: 'varchar',
    length: 10,
    nullable: true,
  })
  inseeIncorporationDate!: string | null;

  @Column({
    name: 'insee_legal_category',
    type: 'varchar',
    length: 10,
    nullable: true,
  })
  inseeLegalCategory!: string | null;

  @Index('idx_pro_profiles_insee_checked_at')
  @Column({ name: 'insee_checked_at', type: 'timestamptz', nullable: true })
  inseeCheckedAt!: Date | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt!: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
