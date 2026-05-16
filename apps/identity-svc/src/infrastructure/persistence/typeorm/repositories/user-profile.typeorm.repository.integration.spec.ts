/**
 * Integration spec — UserProfileTypeormRepository against a real Postgres
 * testcontainer with the full migration history applied. Validates :
 *
 *   - Round-trip: factory `register()` → save → findByEmail → 7 new fields preserved
 *   - `runInTransaction` atomicity: aggregate + token + outbox events commit together
 *   - `runInTransaction` rollback: throwing inside the callback discards everything
 *   - `findByEmail` is case-insensitive (via unique index on lower(email))
 *   - Concurrent register race triggers Postgres 23505 (unique_violation)
 *
 * NOT executed by `pnpm test` (unit run). Run with `pnpm test:integration`
 * after `pnpm docker:up:wait`.
 */
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import {
  startPostgresContainer,
  type PostgresContainerHandle,
} from '@tukio/testing/testcontainers/postgres';
import { OutboxEntity } from '@tukio/messaging/outbox/entity';
import { OutboxPublisher } from '@tukio/messaging/outbox/publisher';
import { UserProfileEntity } from '../entities/user-profile.entity.js';
import { EmailVerificationTokenEntity } from '../entities/email-verification-token.entity.js';
import { UserProfileTypeormRepository } from './user-profile.typeorm.repository.js';
import { EmailVerificationTokenTypeormRepository } from './email-verification-token.typeorm.repository.js';
import { UserProfile } from '../../../../domain/model/user-profile.aggregate.js';
import { Email } from '../../../../domain/model/email.value-object.js';
import { AddOutboxInboxTables1715210000000 } from '../migrations/1715210000000-AddOutboxInboxTables.js';
import { CreateUserProfilesBaseline1715200000000 } from '../migrations/1715200000000-CreateUserProfilesBaseline.js';
import { AddAcquisitionColumns1715220000000 } from '../migrations/1715220000000-AddAcquisitionColumns.js';
import { AddCustomerRegistrationFields1715230000000 } from '../migrations/1715230000000-AddCustomerRegistrationFields.js';

describe('UserProfileTypeormRepository (integration)', () => {
  let pg: PostgresContainerHandle;
  let dataSource: DataSource;
  let repo: UserProfileTypeormRepository;
  let tokenRepo: EmailVerificationTokenTypeormRepository;
  let outboxPublisher: OutboxPublisher;

  beforeAll(async () => {
    pg = await startPostgresContainer({ database: 'tukio_identity_test' });

    dataSource = new DataSource({
      type: 'postgres',
      host: pg.host,
      port: pg.port,
      username: pg.user,
      password: pg.password,
      database: pg.database,
      entities: [UserProfileEntity, EmailVerificationTokenEntity, OutboxEntity],
      migrations: [
        CreateUserProfilesBaseline1715200000000,
        AddOutboxInboxTables1715210000000,
        AddAcquisitionColumns1715220000000,
        AddCustomerRegistrationFields1715230000000,
      ],
      synchronize: false,
      logging: false,
    });
    await dataSource.initialize();
    await dataSource.runMigrations();

    outboxPublisher = new OutboxPublisher(dataSource);
    tokenRepo = new EmailVerificationTokenTypeormRepository(
      dataSource.getRepository(EmailVerificationTokenEntity),
    );
    repo = new UserProfileTypeormRepository(
      dataSource.getRepository(UserProfileEntity),
      dataSource,
      outboxPublisher,
      tokenRepo,
    );
  }, 60_000);

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
    if (pg) await pg.stop();
  });

  beforeEach(async () => {
    await dataSource.query('DELETE FROM email_verification_tokens');
    await dataSource.query('DELETE FROM outbox');
    await dataSource.query('DELETE FROM user_profiles');
  });

  const buildProfile = (email: string): UserProfile =>
    UserProfile.register({
      id: randomUUID(),
      keycloakUserId: randomUUID(),
      email: Email.create(email),
      firstName: 'Alice',
      lastName: 'Martin',
      locale: 'fr',
      marketingOptIn: true,
      acquisition: {
        source: 'google_ads',
        medium: 'cpc',
        campaign: 'spring2026',
        content: 'banner_v2',
        term: 'event_marquees',
      },
    });

  it('round-trips the 7 new fields (status, emailVerified, marketingOptIn, acceptTerms, acceptTermsAt, acquisitionContent, acquisitionTerm)', async () => {
    const profile = buildProfile('roundtrip@example.com');
    await repo.save(profile);

    const reloaded = await repo.findByEmail('roundtrip@example.com');
    expect(reloaded).not.toBeNull();
    expect(reloaded!.status).toBe('active');
    expect(reloaded!.emailVerified).toBe(false);
    expect(reloaded!.marketingOptIn).toBe(true);
    expect(reloaded!.acceptTerms).toBe(true);
    expect(reloaded!.acceptTermsAt).not.toBeNull();
    expect(reloaded!.acquisition.content).toBe('banner_v2');
    expect(reloaded!.acquisition.term).toBe('event_marquees');
  });

  it('findByEmail is case-insensitive via the lower(email) unique index', async () => {
    await repo.save(buildProfile('Mixed.Case@Example.com'));
    const reloaded = await repo.findByEmail('mixed.case@example.com');
    expect(reloaded).not.toBeNull();
  });

  it('runInTransaction commits aggregate + token + outbox events atomically', async () => {
    const profile = buildProfile('txn-happy@example.com');
    const token = randomUUID();
    await repo.runInTransaction(async (txn) => {
      await txn.userProfileRepo.save(profile);
      await txn.tokenRepo.save({
        token,
        userId: profile.id,
        expiresAt: new Date(Date.now() + 86_400_000),
      });
      await txn.eventPublisher.publish({
        eventId: randomUUID(),
        eventType: 'identity.user.registered.v1',
        eventVersion: 'v1',
        occurredAt: new Date().toISOString(),
        correlationId: randomUUID(),
        causationId: null,
        actor: { userId: profile.id, role: 'client', locale: 'fr' },
        aggregate: { type: 'user-profile', id: profile.id },
        payload: { userId: profile.id, foo: 'bar' },
      });
    });

    const reloaded = await repo.findByEmail('txn-happy@example.com');
    expect(reloaded).not.toBeNull();
    const outboxRows = await dataSource.query('SELECT COUNT(*) FROM outbox');
    expect(parseInt(outboxRows[0].count, 10)).toBe(1);
    const tokenRows = await dataSource.query(
      'SELECT COUNT(*) FROM email_verification_tokens WHERE token = $1',
      [token],
    );
    expect(parseInt(tokenRows[0].count, 10)).toBe(1);
  });

  it('runInTransaction rolls back EVERYTHING when the callback throws', async () => {
    const profile = buildProfile('txn-rollback@example.com');
    await expect(
      repo.runInTransaction(async (txn) => {
        await txn.userProfileRepo.save(profile);
        await txn.tokenRepo.save({
          token: randomUUID(),
          userId: profile.id,
          expiresAt: new Date(Date.now() + 86_400_000),
        });
        await txn.eventPublisher.publish({
          eventId: randomUUID(),
          eventType: 'identity.user.registered.v1',
          eventVersion: 'v1',
          occurredAt: new Date().toISOString(),
          correlationId: randomUUID(),
          causationId: null,
          actor: { userId: profile.id, role: 'client', locale: 'fr' },
          aggregate: { type: 'user-profile', id: profile.id },
          payload: { userId: profile.id },
        });
        throw new Error('simulated mid-txn failure');
      }),
    ).rejects.toThrow('simulated mid-txn failure');

    expect(await repo.findByEmail('txn-rollback@example.com')).toBeNull();
    const outboxRows = await dataSource.query('SELECT COUNT(*) FROM outbox');
    expect(parseInt(outboxRows[0].count, 10)).toBe(0);
    const tokenRows = await dataSource.query(
      'SELECT COUNT(*) FROM email_verification_tokens',
    );
    expect(parseInt(tokenRows[0].count, 10)).toBe(0);
  });

  it('concurrent register with same email fails one with Postgres 23505 (unique_violation)', async () => {
    const email = 'race@example.com';
    const p1 = buildProfile(email);
    const p2 = buildProfile(email);

    const results = await Promise.allSettled([repo.save(p1), repo.save(p2)]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    const rejection = rejected[0]!;
    expect((rejection.reason as { code?: string }).code).toBe('23505');
  });
});
