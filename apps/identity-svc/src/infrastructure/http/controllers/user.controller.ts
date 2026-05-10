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
    // RBAC fine-grained: a client can only access their own profile.
    if (actor.role === 'client' && actor.userId !== id) {
      throw new AuthForbiddenException('Cannot access other user profile');
    }
    const profile = await this.getUserProfileProxy
      .getInstance()
      .execute({ userId: id });
    return toUserProfileResponseDto(profile);
  }
}
