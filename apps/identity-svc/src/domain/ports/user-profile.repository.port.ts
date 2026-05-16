import type { UserProfile } from '../model/user-profile.aggregate.js';
import type { IEventPublisher } from './event-publisher.port.js';
import type { IEmailVerificationTokenRepository } from './email-verification-token-repository.port.js';

/**
 * Atomic transaction context exposed to use cases via `runInTransaction`.
 * All operations on the wrapped repositories + event publisher share the same
 * SQL transaction (TypeORM QueryRunner). The OutboxPublisher (`IEventPublisher`)
 * inserts events into the `outbox_events` table inside the same transaction —
 * guarantees atomicity with the aggregate save (Story 0.7 transactional outbox).
 */
export interface TransactionContext {
  userProfileRepo: Pick<IUserProfileRepository, 'save'>;
  tokenRepo: IEmailVerificationTokenRepository;
  eventPublisher: IEventPublisher;
}

export interface IUserProfileRepository {
  findById(id: string): Promise<UserProfile | null>;
  findByKeycloakUserId(keycloakUserId: string): Promise<UserProfile | null>;
  findByEmail(email: string): Promise<UserProfile | null>;
  save(userProfile: UserProfile): Promise<void>;
  /**
   * Run a callback inside an atomic SQL transaction. The callback receives
   * transaction-scoped repositories and an event publisher that all share the
   * same TypeORM QueryRunner. Throw to rollback.
   *
   * Impl arrives Story 1.2b. Story 1.2a only adds the signature so the use case
   * can be wired against the port (mock in unit tests).
   */
  runInTransaction<T>(
    callback: (txn: TransactionContext) => Promise<T>,
  ): Promise<T>;
}
