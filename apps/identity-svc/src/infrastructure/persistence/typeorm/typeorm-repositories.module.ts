import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  EMAIL_VERIFICATION_TOKEN_REPOSITORY,
  PRO_PROFILE_REPOSITORY,
  USER_PROFILE_REPOSITORY,
} from '../../../domain/ports/tokens.js';
import { NatsPublisherModule } from '../../messaging/nats/nats-publisher.module.js';
import { UserProfileEntity } from './entities/user-profile.entity.js';
import { EmailVerificationTokenEntity } from './entities/email-verification-token.entity.js';
import { ProProfileEntity } from './entities/pro-profile.entity.js';
import { UserProfileTypeormRepository } from './repositories/user-profile.typeorm.repository.js';
import { EmailVerificationTokenTypeormRepository } from './repositories/email-verification-token.typeorm.repository.js';
import { ProProfileTypeormRepository } from './repositories/pro-profile.typeorm.repository.js';

// NatsPublisherModule is imported so repositories' runInTransaction can compose
// the transaction context with EVENT_PUBLISHER (Story 0.7 OutboxPublisher).
@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserProfileEntity,
      EmailVerificationTokenEntity,
      ProProfileEntity,
    ]),
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
    {
      provide: PRO_PROFILE_REPOSITORY,
      useClass: ProProfileTypeormRepository,
    },
  ],
  exports: [
    USER_PROFILE_REPOSITORY,
    EMAIL_VERIFICATION_TOKEN_REPOSITORY,
    PRO_PROFILE_REPOSITORY,
  ],
})
export class TypeormRepositoriesModule {}
