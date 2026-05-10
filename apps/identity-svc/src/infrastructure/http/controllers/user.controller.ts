import {
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import type { GetUserProfileByIdUseCase } from '../../../usecases/get-user-profile.usecase.js';
import { UseCaseProxy } from '../../usecases-proxy/usecases-proxy.js';
import { UseCasesProxyModule } from '../../usecases-proxy/usecases-proxy.module.js';
import {
  toUserProfileResponseDto,
  type UserProfileResponseDto,
} from '../dtos/user-profile-response.dto.js';
import { KeycloakJwtGuard } from '@tukio/auth/guards';
import { RolesGuard } from '@tukio/auth/guards/roles';
import { Roles } from '@tukio/auth/decorators';
import { CurrentActor } from '@tukio/auth/decorators/current-actor';
import { AuthForbiddenException } from '@tukio/auth/exceptions';
import type { BackendActor } from '@tukio/auth/types';

@Controller('users')
@UseGuards(KeycloakJwtGuard, RolesGuard)
@Roles('client', 'pro', 'admin-modo', 'admin-super')
export class UserController {
  constructor(
    @Inject(UseCasesProxyModule.GET_USER_PROFILE_USECASES_PROXY)
    private readonly getUserProfileProxy: UseCaseProxy<GetUserProfileByIdUseCase>,
  ) {}

  @Get(':id')
  async getUser(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentActor() actor: BackendActor,
  ): Promise<UserProfileResponseDto> {
    // Load the profile FIRST so we can compare ownership using the local
    // `keycloakUserId` column. The path `:id` is the local UserProfile.id
    // (Postgres UUID); `actor.userId` is the Keycloak `sub` (different UUID).
    // The previous version compared `actor.userId !== id` which was always
    // true for clients in production, breaking the self-read path entirely.
    const profile = await this.getUserProfileProxy
      .getInstance()
      .execute({ userId: id });

    // RBAC fine-grained: client and pro can only read their OWN profile.
    // Admins (admin-modo / admin-super) reach this endpoint via @Roles and
    // can read any profile (moderation / support).
    const isOwnProfile = actor.userId === profile.keycloakUserId;
    const isAdmin = actor.roles.some(
      (r) => r === 'admin-modo' || r === 'admin-super',
    );
    if (!isAdmin && !isOwnProfile) {
      throw new AuthForbiddenException('Cannot access other user profile');
    }

    return toUserProfileResponseDto(profile);
  }
}
