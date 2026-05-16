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

const TEST_USER_PROFILE_ID = '00000000-0000-0000-0000-000000000001';
const TEST_SIRET = '35600000000048';

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

function makeProProfile(
  overrides: Partial<{ siret: string; id: string }> = {},
): ProProfile {
  return ProProfile.create({
    id: overrides.id ?? '10000000-0000-0000-0000-000000000001',
    userProfileId: TEST_USER_PROFILE_ID,
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
    await proProfileRepo.query('DELETE FROM pro_profiles');
  });

  it('save() persists a ProProfile row', async () => {
    const profile = makeProProfile();
    await repository.save(profile);
    const row = await proProfileRepo.findOne({ where: { id: profile.id } });
    expect(row).not.toBeNull();
    expect(row?.siret).toBe(TEST_SIRET);
    expect(row?.kycStatus).toBe(KycStatus.PENDING_REVIEW);
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

  it('enforces the partial unique index on siret WHERE deleted_at IS NULL', async () => {
    const profile1 = makeProProfile({
      id: '10000000-0000-0000-0000-000000000001',
    });
    const profile2 = makeProProfile({
      id: '10000000-0000-0000-0000-000000000002',
    });
    await repository.save(profile1);
    await expect(repository.save(profile2)).rejects.toThrow();
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
