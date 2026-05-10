import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

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

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
