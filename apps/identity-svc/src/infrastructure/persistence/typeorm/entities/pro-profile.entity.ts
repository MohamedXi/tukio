import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

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

  // ISO date `YYYY-MM-DD`. Stored as PostgreSQL `date` type (Story 1.3b
  // review D3 — was VARCHAR(10), now DATE for proper indexing/range queries).
  @Column({
    name: 'insee_incorporation_date',
    type: 'date',
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

  // NAF activity code (Story 1.3b review D3 — needed for AC10 metrics dashboard).
  @Column({
    name: 'insee_naf',
    type: 'varchar',
    length: 10,
    nullable: true,
  })
  inseeNaf!: string | null;

  @Index('idx_pro_profiles_insee_checked_at')
  @Column({ name: 'insee_checked_at', type: 'timestamptz' })
  inseeCheckedAt!: Date;

  // P12: DB-managed timestamps — let PostgreSQL DEFAULT NOW() handle creation
  // and let TypeORM bump `updated_at` on each save (was set explicitly from
  // the aggregate, which froze `updated_at` to the original `register()` time).
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  // ── Conversion wizard fields (Story 1.3b-bis) ──────────────────────────

  /** ISO `YYYY-MM-DD` date of birth supplied by the Pro at conversion time. */
  @Column({ name: 'date_of_birth', type: 'varchar', length: 10 })
  dateOfBirth!: string;

  /** Legal form (business structure): SAS_SASU | EURL_SARL | MICRO_ENTREPRISE | AUTO_ENTREPRENEUR | ASSO_1901. */
  @Column({ name: 'legal_form', type: 'varchar', length: 30 })
  legalForm!: string;

  /** VAT registration status: vat_registered | vat_exempt. */
  @Column({ name: 'vat_status', type: 'varchar', length: 30 })
  vatStatus!: string;

  /** MVP activity categories (1-2 items from the whitelist). Stored as JSONB array. */
  @Column({ name: 'categories', type: 'jsonb' })
  categories!: string[];

  /** Intervention zone: { city, radiusKm }. Stored as JSONB object. */
  @Column({ name: 'service_zone', type: 'jsonb' })
  serviceZone!: { city: string; radiusKm: number };

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
