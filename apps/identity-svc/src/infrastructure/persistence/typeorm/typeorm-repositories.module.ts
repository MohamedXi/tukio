import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { USER_PROFILE_REPOSITORY } from '../../../domain/ports/tokens.js';
import { UserProfileEntity } from './entities/user-profile.entity.js';
import { UserProfileTypeormRepository } from './repositories/user-profile.typeorm.repository.js';

@Module({
  imports: [TypeOrmModule.forFeature([UserProfileEntity])],
  providers: [
    {
      provide: USER_PROFILE_REPOSITORY,
      useClass: UserProfileTypeormRepository,
    },
  ],
  exports: [USER_PROFILE_REPOSITORY],
})
export class TypeormRepositoriesModule {}
