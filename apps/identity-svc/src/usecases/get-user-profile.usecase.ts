import type { UserProfile } from '../domain/model/user-profile.aggregate.js';
import type { IUserProfileRepository } from '../domain/ports/user-profile.repository.port.js';
import { UserProfileNotFoundException } from '../domain/exception/user-profile-not-found.exception.js';

export interface GetUserProfileByIdInput {
  userId: string;
}

// Pattern Pretre — pure use case, NO NestJS decorators here.
// Wiring happens in infrastructure/usecases-proxy/usecases-proxy.module.ts.
export class GetUserProfileByIdUseCase {
  constructor(private readonly userProfileRepo: IUserProfileRepository) {}

  async execute(input: GetUserProfileByIdInput): Promise<UserProfile> {
    const profile = await this.userProfileRepo.findById(input.userId);
    if (profile === null) {
      throw new UserProfileNotFoundException(input.userId);
    }
    return profile;
  }
}
