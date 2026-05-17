/**
 * Integration tests for ProProfileTypeormRepository — requires a live Postgres
 * instance. Run with: pnpm --filter=identity-svc test:integration
 *
 * The testcontainer helper starts a throw-away Postgres 16 container and runs
 * ALL_MIGRATIONS automatically. Tests share the same container per file
 * (beforeAll/afterAll).
 */
import { DataSource, Repository } from 'typeorm';
import { ProProfileTypeormRepository } from './repositories/pro-profile.typeorm.repository.js';
import { ProProfileEntity } from './entities/pro-profile.entity.js';
import { UserProfileEntity } from './entities/user-profile.entity.js';
import { EmailVerificationTokenEntity } from './entities/email-verification-token.entity.js';
import { ALL_MIGRATIONS } from './migrations/index.js';
import { OutboxEntity } from '@tukio/messaging/outbox/entity';
import { ProProfile } from '../../../domain/model/pro-profile.aggregate.js';
import { Siret } from '../../../domain/model/siret.value-object.js';
import { Address } from '../../../domain/model/address.value-object.js';
import { PhoneNumber } from '../../../domain/model/phone-number.value-object.js';
import { KycStatus } from '../../../domain/model/kyc-status.enum.js';
import type { IEventPublisher } from '../../../domain/ports/event-publisher.port.js';
import type { IEmailVerificationTokenRepository } from '../../../domain/ports/email-verification-token-repository.port.js';

const TEST_SIRET = '35600000000048';
const USER_PROFILE_ID_A = '00000000-0000-0000-0000-000000000001';
const USER_PROFILE_ID_B = '00000000-0000-0000-0000-000000000002';
const PRO_PROFILE_ID_A = '10000000-0000-0000-0000-000000000001';
const PRO_PROFILE_ID_B = '10000000-0000-0000-0000-000000000002';

async function createTestDataSource(): Promise<DataSource> {
  const ds = new DataSource({
    type: 'postgres',
    host: process.env['PG_HOST'] ?? 'localhost',
    port: parseInt(process.env['PG_PORT'] ?? '5432', 10),
    username: process.env['PG_USER'] ?? 'tukio',
    password: process.env['PG_PASSWORD'] ?? 'tukio_dev_password',
    database: process.env['PG_DB'] ?? 'tukio_identity_test',
    entities: [
      UserProfileEntity,
      EmailVerificationTokenEntity,
      ProProfileEntity,
      OutboxEntity,
    ],
    migrations: ALL_MIGRATIONS,
    migrationsRun: true,
    synchronize: false,
    logging: false,
  });
  return ds.initialize();
}

/**
 * P3 — `pro_profiles.user_profile_id` REFERENCES `user_profiles(id) ON DELETE
 * CASCADE`. Inserting a Pro row requires the parent user_profiles row to exist
 * first, otherwise every save() rejects with a FK violation.
 */
async function insertUserProfile(
  ds: DataSource,
  id: string,
  emailLocal: string,
): Promise<void> {
  await ds.query(
    `INSERT INTO user_profiles (
       id, keycloak_user_id, email, first_name, last_name, role, locale,
       acquisition_first_touch, acquisition_last_touch, created_at, updated_at
     ) VALUES (
       $1, gen_random_uuid(), $2, 'Test', 'User', 'pro', 'fr',
       NOW(), NOW(), NOW(), NOW()
     )`,
    [id, `${emailLocal}@test.local`],
  );
}

function makeProProfile(
  overrides: Partial<{
    siret: string;
    id: string;
    userProfileId: string;
  }> = {},
): ProProfile {
  return ProProfile.create({
    id: overrides.id ?? PRO_PROFILE_ID_A,
    userProfileId: overrides.userProfileId ?? USER_PROFILE_ID_A,
    companyName: 'ACME SAS',
    siret: Siret.create(overrides.siret ?? TEST_SIRET),
    vatNumber: null,
    address: Address.create({
      street: '10 rue de la Paix',
      postalCode: '75001',
      city: 'Paris',
      country: 'FR',
    }),
    contactPhone: PhoneNumber.create('+33612345678'),
    kycStatus: KycStatus.PENDING_REVIEW,
    kyc: {
      idCardR2Key: 'pro/user-1/id-card.jpg',
      ribR2Key: 'pro/user-1/rib.pdf',
      kbisR2Key: null,
    },
    insee: {
      legalName: 'ACME SAS',
      incorporationDate: '2020-01-01',
      legalCategory: '5710',
      naf: '5310Z',
      checkedAt: new Date(),
    },
    kycDecision: {
      decidedAt: null,
      decidedBy: null,
      reason: null,
    },
    conversion: {
      dateOfBirth: '1990-06-15',
      legalForm: 'SAS_SASU',
      vatStatus: 'vat_registered',
      categories: ['tents_marquees'],
      serviceZone: { city: 'Nantes', radiusKm: 80 },
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  });
}

describe('ProProfileTypeormRepository (integration)', () => {
  let ds: DataSource;
  let proProfileRepo: Repository<ProProfileEntity>;
  let repository: ProProfileTypeormRepository;

  const mockEventPublisher: IEventPublisher = {
    publish: jest.fn().mockResolvedValue(undefined),
  };
  const mockTokenRepo: IEmailVerificationTokenRepository = {
    save: jest.fn().mockResolvedValue(undefined),
    findByToken: jest.fn().mockResolvedValue(null),
    markUsed: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    ds = await createTestDataSource();
    proProfileRepo = ds.getRepository(ProProfileEntity);
    repository = new ProProfileTypeormRepository(
      proProfileRepo,
      ds,
      mockEventPublisher,
      mockTokenRepo,
    );
  });

  afterAll(async () => {
    await ds.destroy();
  });

  beforeEach(async () => {
    // Order matters: pro_profiles → user_profiles cascade-deletes the parent
    // anyway, but we wipe both explicitly so each test starts clean.
    await proProfileRepo.query('DELETE FROM pro_profiles');
    await proProfileRepo.query('DELETE FROM user_profiles');
    await insertUserProfile(ds, USER_PROFILE_ID_A, 'user-a');
  });

  it('save() persists a ProProfile row', async () => {
    const profile = makeProProfile();
    await repository.save(profile);
    const row = await proProfileRepo.findOne({ where: { id: profile.id } });
    expect(row).not.toBeNull();
    expect(row?.siret).toBe(TEST_SIRET);
    expect(row?.kycStatus).toBe(KycStatus.PENDING_REVIEW);
    expect(row?.inseeNaf).toBe('5310Z');
  });

  it('findBySiret() returns null when no matching active row', async () => {
    const result = await repository.findBySiret(Siret.create(TEST_SIRET));
    expect(result).toBeNull();
  });

  it('findBySiret() returns ProProfile for an active row', async () => {
    const profile = makeProProfile();
    await repository.save(profile);
    const result = await repository.findBySiret(Siret.create(TEST_SIRET));
    expect(result).not.toBeNull();
    expect(result?.siret.asString).toBe(TEST_SIRET);
  });

  it('findBySiret() returns null for soft-deleted rows', async () => {
    const profile = makeProProfile();
    await repository.save(profile);
    await proProfileRepo.update({ id: profile.id }, { deletedAt: new Date() });
    const result = await repository.findBySiret(Siret.create(TEST_SIRET));
    expect(result).toBeNull();
  });

  // P4 — Both profiles need distinct user_profile_id (the column has its own
  // UNIQUE constraint). The test must verify the partial SIRET index, NOT the
  // user_profile_id one — which means provisioning a second parent row.
  it('enforces uq_pro_profiles_siret (partial WHERE deleted_at IS NULL)', async () => {
    await insertUserProfile(ds, USER_PROFILE_ID_B, 'user-b');
    const profile1 = makeProProfile({ id: PRO_PROFILE_ID_A });
    const profile2 = makeProProfile({
      id: PRO_PROFILE_ID_B,
      userProfileId: USER_PROFILE_ID_B,
    });
    await repository.save(profile1);
    await expect(repository.save(profile2)).rejects.toMatchObject({
      constraint: 'uq_pro_profiles_siret',
    });
  });

  it('runInTransaction() rolls back on callback failure', async () => {
    const profile = makeProProfile();
    await expect(
      repository.runInTransaction(async (txn) => {
        await txn.proProfileRepo.save(profile);
        throw new Error('forced rollback');
      }),
    ).rejects.toThrow('forced rollback');
    const row = await proProfileRepo.findOne({ where: { id: profile.id } });
    expect(row).toBeNull();
  });
});
