import type { ProProfile } from '../model/pro-profile.aggregate.js';
import type { Siret } from '../model/siret.value-object.js';
import type { IEventPublisher } from './event-publisher.port.js';
import type {
  IUserProfileRepository,
  TransactionContext,
} from './user-profile.repository.port.js';

/**
 * Pro-side transaction context — shares the same TypeORM QueryRunner as the
 * customer-side `TransactionContext` (Story 1.2a). Use cases that need to
 * persist a `UserProfile` AND a `ProProfile` atomically (Story 1.3 register
 * pro saga) call `runInTransaction` on either repository — both must hand
 * back the same shape so the use case body is symmetric.
 */
export interface ProTransactionContext extends TransactionContext {
  userProfileRepo: Pick<IUserProfileRepository, 'save'>;
  proProfileRepo: Pick<IProProfileRepository, 'save'>;
  eventPublisher: IEventPublisher;
}

export interface IProProfileRepository {
  /**
   * Lookup a Pro profile by SIRET. Used by the registration use case to
   * enforce the FR16 anti-doublon rule before calling the INSEE validator.
   * Soft-deleted rows must be excluded (`deleted_at IS NULL`).
   */
  findBySiret(siret: Siret): Promise<ProProfile | null>;

  findById(id: string): Promise<ProProfile | null>;

  /**
   * Persist the Pro aggregate. Outside of a transaction, this performs a
   * single SQL `INSERT ... ON CONFLICT DO UPDATE`. Inside `runInTransaction`,
   * the call reuses the active QueryRunner.
   */
  save(proProfile: ProProfile): Promise<void>;

  /**
   * Run a callback inside an atomic SQL transaction that spans User + Pro
   * persistence + outbox event publication. The callback throws to rollback.
   *
   * Impl arrives Story 1.3b. Story 1.3a only adds the signature so the use
   * case can be wired against the port (mocked in unit tests).
   */
  runInTransaction<T>(
    callback: (txn: ProTransactionContext) => Promise<T>,
  ): Promise<T>;
}
