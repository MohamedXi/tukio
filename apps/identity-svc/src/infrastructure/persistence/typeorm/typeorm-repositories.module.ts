import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  EMAIL_VERIFICATION_TOKEN_REPOSITORY,
  USER_PROFILE_REPOSITORY,
} from '../../../domain/ports/tokens.js';
import { NatsPublisherModule } from '../../messaging/nats/nats-publisher.module.js';
import { UserProfileEntity } from './entities/user-profile.entity.js';
import { EmailVerificationTokenEntity } from './entities/email-verification-token.entity.js';
import { UserProfileTypeormRepository } from './repositories/user-profile.typeorm.repository.js';
import { EmailVerificationTokenTypeormRepository } from './repositories/email-verification-token.typeorm.repository.js';

// NatsPublisherModule is imported so UserProfileTypeormRepository.runInTransaction
// can compose the transaction context with EVENT_PUBLISHER (Story 0.7
// OutboxPublisher). The publisher's TransactionContext.getEntityManager
// reads from AsyncLocalStorage, so all events inside the txn callback commit
// atomically with the aggregate save + token save.
@Module({
  imports: [
    TypeOrmModule.forFeature([UserProfileEntity, EmailVerificationTokenEntity]),
    NatsPublisherModule,
  ],
  providers: [
    {
      provide: EMAIL_VERIFICATION_TOKEN_REPOSITORY,
      useClass: EmailVerificationTokenTypeormRepository,
    },
    {
      provide: USER_PROFILE_REPOSITORY,
      useClass: UserProfileTypeormRepository,
    },
  ],
  exports: [USER_PROFILE_REPOSITORY, EMAIL_VERIFICATION_TOKEN_REPOSITORY],
})
export class TypeormRepositoriesModule {}
