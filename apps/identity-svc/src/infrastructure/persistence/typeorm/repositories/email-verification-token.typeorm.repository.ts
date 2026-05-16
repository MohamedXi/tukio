import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransactionContext } from '@tukio/messaging/outbox/transaction-context';
import type {
  EmailVerificationTokenLookup,
  EmailVerificationTokenRecord,
  IEmailVerificationTokenRepository,
} from '../../../../domain/ports/email-verification-token-repository.port.js';
import { EmailVerificationTokenEntity } from '../entities/email-verification-token.entity.js';

/**
 * Story 1.2b — TypeORM impl of `IEmailVerificationTokenRepository`.
 *
 * Critical : `save()` writes inside whatever transaction the caller has
 * established via `TransactionContext.run(manager, ...)` (Story 0.7
 * `OutboxPublisher` pattern). `UserProfileTypeormRepository.runInTransaction`
 * wraps the registration callback with this context so the aggregate save,
 * token save, and outbox event publishes all commit atomically.
 */
@Injectable()
export class EmailVerificationTokenTypeormRepository implements IEmailVerificationTokenRepository {
  constructor(
    @InjectRepository(EmailVerificationTokenEntity)
    private readonly repo: Repository<EmailVerificationTokenEntity>,
  ) {}

  async save(record: EmailVerificationTokenRecord): Promise<void> {
    // Review patch (1.2b) — write paths MUST live inside a
    // `runInTransaction` callback so the token insert commits atomically
    // with the aggregate save + outbox events. A silent fallback to
    // `this.repo.manager` would break the transactional-outbox guarantee
    // (token persisted while aggregate save rolled back, or vice versa).
    const manager = TransactionContext.getEntityManager();
    if (!manager) {
      throw new Error(
        'EmailVerificationTokenTypeormRepository.save must run inside ' +
          'UserProfileTypeormRepository.runInTransaction — calling it outside ' +
          'a transactional context would break outbox atomicity (Story 0.7).',
      );
    }
    const entity = new EmailVerificationTokenEntity();
    entity.token = record.token;
    entity.userId = record.userId;
    entity.expiresAt = record.expiresAt;
    entity.usedAt = null;
    await manager.getRepository(EmailVerificationTokenEntity).insert(entity);
  }

  async findByToken(
    token: string,
  ): Promise<EmailVerificationTokenLookup | null> {
    const entity = await this.repo.findOne({ where: { token } });
    if (!entity) return null;
    return {
      userId: entity.userId,
      expiresAt: entity.expiresAt,
      usedAt: entity.usedAt,
    };
  }

  async markUsed(token: string): Promise<void> {
    const manager = TransactionContext.getEntityManager() ?? this.repo.manager;
    await manager
      .getRepository(EmailVerificationTokenEntity)
      .update({ token }, { usedAt: new Date() });
  }
}
