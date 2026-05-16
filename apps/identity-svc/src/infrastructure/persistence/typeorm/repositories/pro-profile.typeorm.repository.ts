import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { TransactionContext } from '@tukio/messaging/outbox/transaction-context';
import type {
  IProProfileRepository,
  ProTransactionContext,
} from '../../../../domain/ports/pro-profile.repository.port.js';
import type { IEventPublisher } from '../../../../domain/ports/event-publisher.port.js';
import type { IEmailVerificationTokenRepository } from '../../../../domain/ports/email-verification-token-repository.port.js';
import {
  EVENT_PUBLISHER,
  EMAIL_VERIFICATION_TOKEN_REPOSITORY,
} from '../../../../domain/ports/tokens.js';
import type { ProProfile } from '../../../../domain/model/pro-profile.aggregate.js';
import type { Siret } from '../../../../domain/model/siret.value-object.js';
import { UserProfile } from '../../../../domain/model/user-profile.aggregate.js';
import { ProProfileEntity } from '../entities/pro-profile.entity.js';
import { UserProfileEntity } from '../entities/user-profile.entity.js';
import { ProProfileMapper } from '../mappers/pro-profile.mapper.js';
import { UserProfileMapper } from '../mappers/user-profile.mapper.js';

@Injectable()
export class ProProfileTypeormRepository implements IProProfileRepository {
  constructor(
    @InjectRepository(ProProfileEntity)
    private readonly repo: Repository<ProProfileEntity>,
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: IEventPublisher,
    @Inject(EMAIL_VERIFICATION_TOKEN_REPOSITORY)
    private readonly tokenRepo: IEmailVerificationTokenRepository,
  ) {}

  async findBySiret(siret: Siret): Promise<ProProfile | null> {
    const entity = await this.repo
      .createQueryBuilder('pp')
      .where('pp.siret = :siret', { siret: siret.asString })
      .andWhere('pp.deleted_at IS NULL')
      .getOne();
    return entity ? ProProfileMapper.toDomain(entity) : null;
  }

  async findById(id: string): Promise<ProProfile | null> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? ProProfileMapper.toDomain(entity) : null;
  }

  async save(proProfile: ProProfile): Promise<void> {
    const manager = TransactionContext.getEntityManager() ?? this.repo.manager;
    await manager
      .getRepository(ProProfileEntity)
      .save(ProProfileMapper.toEntity(proProfile));
  }

  async runInTransaction<T>(
    callback: (txn: ProTransactionContext) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction(async (manager) =>
      TransactionContext.run(manager, async () => {
        const txn: ProTransactionContext = {
          userProfileRepo: {
            save: (profile: UserProfile) =>
              manager
                .getRepository(UserProfileEntity)
                .save(UserProfileMapper.toEntity(profile))
                .then(() => undefined),
          },
          proProfileRepo: {
            save: (proProfile: ProProfile) =>
              manager
                .getRepository(ProProfileEntity)
                .save(ProProfileMapper.toEntity(proProfile))
                .then(() => undefined),
          },
          // tokenRepo is part of the base TransactionContext shape — pro
          // registration doesn't use it but the type contract requires it.
          tokenRepo: this.tokenRepo,
          eventPublisher: this.eventPublisher,
        };
        return callback(txn);
      }),
    );
  }
}
