import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { TransactionContext } from '@tukio/messaging/outbox/transaction-context';
import type {
  IUserProfileRepository,
  TransactionContext as DomainTxnContext,
} from '../../../../domain/ports/user-profile.repository.port.js';
import type { IEventPublisher } from '../../../../domain/ports/event-publisher.port.js';
import type { IEmailVerificationTokenRepository } from '../../../../domain/ports/email-verification-token-repository.port.js';
import {
  EVENT_PUBLISHER,
  EMAIL_VERIFICATION_TOKEN_REPOSITORY,
} from '../../../../domain/ports/tokens.js';
import type { UserProfile } from '../../../../domain/model/user-profile.aggregate.js';
import { UserProfileEntity } from '../entities/user-profile.entity.js';
import { UserProfileMapper } from '../mappers/user-profile.mapper.js';

@Injectable()
export class UserProfileTypeormRepository implements IUserProfileRepository {
  constructor(
    @InjectRepository(UserProfileEntity)
    private readonly repo: Repository<UserProfileEntity>,
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: IEventPublisher,
    @Inject(EMAIL_VERIFICATION_TOKEN_REPOSITORY)
    private readonly tokenRepo: IEmailVerificationTokenRepository,
  ) {}

  async findById(id: string): Promise<UserProfile | null> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? UserProfileMapper.toDomain(entity) : null;
  }

  async findByKeycloakUserId(
    keycloakUserId: string,
  ): Promise<UserProfile | null> {
    const entity = await this.repo.findOne({ where: { keycloakUserId } });
    return entity ? UserProfileMapper.toDomain(entity) : null;
  }

  async findByEmail(email: string): Promise<UserProfile | null> {
    const normalized = email.trim().toLowerCase();
    const entity = await this.repo.findOne({ where: { email: normalized } });
    return entity ? UserProfileMapper.toDomain(entity) : null;
  }

  async save(userProfile: UserProfile): Promise<void> {
    // When inside a transaction, save via the txn-bound EntityManager so the
    // insert participates in the same SQL transaction as the outbox events.
    const manager = TransactionContext.getEntityManager() ?? this.repo.manager;
    await manager
      .getRepository(UserProfileEntity)
      .save(UserProfileMapper.toEntity(userProfile));
  }

  /**
   * Story 1.2b — real impl replacing the 1.2a stub.
   *
   * Opens a TypeORM transaction (via `dataSource.transaction`) and runs the
   * callback inside `TransactionContext.run(manager, ...)`. The wrapped
   * `OutboxPublisher` (Story 0.7) reads the same `EntityManager` from
   * AsyncLocalStorage, so every event inserted via `eventPublisher.publish`
   * inside the callback commits atomically with the aggregate save and
   * token save. Throwing inside the callback rolls back everything.
   *
   * The exposed `txn` context surfaces narrow ports (`save` only on
   * userProfileRepo, the full token repo, the event publisher) to prevent
   * leaky cross-aggregate reads inside the transaction. Race-safety of email
   * uniqueness is enforced by the DB unique index on `lower(email)` (this
   * migration adds it) — concurrent `findByEmail` pre-checks can both miss,
   * but only one INSERT wins. The use case catches the resulting Postgres
   * 23505 and translates to 409 IDENTITY-CONFLICT-001.
   */
  async runInTransaction<T>(
    callback: (txn: DomainTxnContext) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction(async (manager) =>
      TransactionContext.run(manager, async () => {
        const txn: DomainTxnContext = {
          userProfileRepo: {
            save: (profile: UserProfile) =>
              manager
                .getRepository(UserProfileEntity)
                .save(UserProfileMapper.toEntity(profile))
                .then(() => undefined),
          },
          tokenRepo: this.tokenRepo,
          eventPublisher: this.eventPublisher,
        };
        return callback(txn);
      }),
    );
  }
}
