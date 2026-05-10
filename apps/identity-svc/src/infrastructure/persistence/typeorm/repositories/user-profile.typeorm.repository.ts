import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { IUserProfileRepository } from '../../../../domain/ports/user-profile.repository.port.js';
import type { UserProfile } from '../../../../domain/model/user-profile.aggregate.js';
import { UserProfileEntity } from '../entities/user-profile.entity.js';
import { UserProfileMapper } from '../mappers/user-profile.mapper.js';

@Injectable()
export class UserProfileTypeormRepository implements IUserProfileRepository {
  constructor(
    @InjectRepository(UserProfileEntity)
    private readonly repo: Repository<UserProfileEntity>,
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

  async save(userProfile: UserProfile): Promise<void> {
    await this.repo.save(UserProfileMapper.toEntity(userProfile));
  }
}
