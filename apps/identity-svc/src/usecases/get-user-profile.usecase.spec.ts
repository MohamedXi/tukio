import { Email } from '../domain/model/email.value-object.js';
import { UserProfile } from '../domain/model/user-profile.aggregate.js';
import { UserRole } from '../domain/model/user-role.enum.js';
import { UserProfileNotFoundException } from '../domain/exception/user-profile-not-found.exception.js';
import type { IUserProfileRepository } from '../domain/ports/user-profile.repository.port.js';
import { GetUserProfileByIdUseCase } from './get-user-profile.usecase.js';

const buildProfile = (id: string): UserProfile =>
  UserProfile.create({
    id,
    keycloakUserId: 'kc-' + id,
    email: Email.create('jane@tukio.one'),
    firstName: 'Jane',
    lastName: 'Doe',
    role: UserRole.CLIENT,
    locale: 'fr',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    deletedAt: null,
  });

describe('GetUserProfileByIdUseCase', () => {
  let repo: jest.Mocked<IUserProfileRepository>;
  let useCase: GetUserProfileByIdUseCase;

  beforeEach(() => {
    repo = {
      findById: jest.fn(),
      findByKeycloakUserId: jest.fn(),
      save: jest.fn(),
    };
    useCase = new GetUserProfileByIdUseCase(repo);
  });

  it('returns the UserProfile when found', async () => {
    const userId = '11111111-1111-1111-1111-111111111111';
    const expected = buildProfile(userId);
    repo.findById.mockResolvedValue(expected);

    const result = await useCase.execute({ userId });

    expect(result).toBe(expected);
    expect(repo.findById).toHaveBeenCalledWith(userId);
    expect(repo.findById).toHaveBeenCalledTimes(1);
  });

  it('throws UserProfileNotFoundException when repository returns null', async () => {
    const userId = '00000000-0000-0000-0000-000000000000';
    repo.findById.mockResolvedValue(null);

    await expect(useCase.execute({ userId })).rejects.toMatchObject({
      tukioCode: 'USER-NOT-FOUND-001',
      httpStatus: 404,
      title: 'User profile not found',
      userId,
    });
    expect(repo.findById).toHaveBeenCalledWith(userId);
  });

  it('preserves the constructor name UserProfileNotFoundException', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(useCase.execute({ userId: 'x' })).rejects.toBeInstanceOf(
      UserProfileNotFoundException,
    );
  });
});
