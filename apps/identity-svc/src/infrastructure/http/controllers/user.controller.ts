import { Controller, Get, Inject, Param, ParseUUIDPipe } from '@nestjs/common';
import type { GetUserProfileByIdUseCase } from '../../../usecases/get-user-profile.usecase.js';
import { UseCaseProxy } from '../../usecases-proxy/usecases-proxy.js';
import { UseCasesProxyModule } from '../../usecases-proxy/usecases-proxy.module.js';
import {
  toUserProfileResponseDto,
  type UserProfileResponseDto,
} from '../dtos/user-profile-response.dto.js';

@Controller('/v1/users')
export class UserController {
  constructor(
    @Inject(UseCasesProxyModule.GET_USER_PROFILE_USECASES_PROXY)
    private readonly getUserProfileProxy: UseCaseProxy<GetUserProfileByIdUseCase>,
  ) {}

  @Get(':id')
  async getUser(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<UserProfileResponseDto> {
    const profile = await this.getUserProfileProxy
      .getInstance()
      .execute({ userId: id });
    return toUserProfileResponseDto(profile);
  }
}
