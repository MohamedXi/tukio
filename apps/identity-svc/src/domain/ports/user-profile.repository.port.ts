import type { UserProfile } from '../model/user-profile.aggregate.js';

export interface IUserProfileRepository {
  findById(id: string): Promise<UserProfile | null>;
  findByKeycloakUserId(keycloakUserId: string): Promise<UserProfile | null>;
  save(userProfile: UserProfile): Promise<void>;
}
