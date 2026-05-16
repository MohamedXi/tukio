import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Inject,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Public } from '@tukio/auth/decorators/public';
import type { GetUserProfileByIdUseCase } from '../../../usecases/get-user-profile.usecase.js';
import type { RegisterCustomerUseCase } from '../../../usecases/register-customer.usecase.js';
import { UseCaseProxy } from '../../usecases-proxy/usecases-proxy.js';
import { UseCasesProxyModule } from '../../usecases-proxy/usecases-proxy.module.js';
import { InternalServiceGuard } from '../guards/internal-service.guard.js';
import { RegisterCustomerHttpDto } from '../dtos/register-customer.dto.js';

interface RegisterCustomerResponseDto {
  userId: string;
  requiresEmailVerification: true;
}

/**
 * Story 1.2b — `POST /internal/customers` endpoint.
 *
 * Internal-only endpoint called by gateway-api (Story 1.2c) after the public
 * `POST /v1/auth/customer/register` body has passed the gateway-side
 * `ZodValidationPipe`, throttler, and acquisition cookie merge. The gateway
 * forwards a self-contained request signed with HMAC over a `timestamp.method.path`
 * canonical string (see `InternalServiceGuard`).
 *
 * NEVER exposed publicly — protected by K8s NetworkPolicy whitelist
 * `gateway-api → identity-svc:4001` in production (Story 0.12). V1+ supersedes
 * the HMAC guard with mTLS via Linkerd.
 */
// `@Public()` bypasses the global `KeycloakJwtGuard` (no Bearer JWT on
// internal traffic from gateway-api — the HMAC `InternalServiceGuard` is the
// authentication mechanism here).
@Controller('internal/customers')
@Public()
@UseGuards(InternalServiceGuard)
export class CustomerController {
  constructor(
    // Unused at runtime — present to anchor the controller to the use cases
    // proxy module's symbol so DI wiring stays explicit.
    @Inject(UseCasesProxyModule.GET_USER_PROFILE_USECASES_PROXY)
    private readonly _getUserProfileProxy: UseCaseProxy<GetUserProfileByIdUseCase>,
    @Inject(UseCasesProxyModule.REGISTER_CUSTOMER_USECASES_PROXY)
    private readonly registerCustomerProxy: UseCaseProxy<RegisterCustomerUseCase>,
  ) {
    void this._getUserProfileProxy;
  }

  @Post()
  @HttpCode(201)
  async register(
    @Body() dto: RegisterCustomerHttpDto,
    @Headers('x-tukio-correlation-id') correlationIdHeader?: string,
  ): Promise<RegisterCustomerResponseDto> {
    return this.registerCustomerProxy.getInstance().execute({
      email: dto.email,
      password: dto.password,
      firstName: dto.firstName,
      lastName: dto.lastName,
      locale: dto.locale,
      acceptTerms: dto.acceptTerms,
      acceptMarketing: dto.acceptMarketing,
      ...(dto.acquisition && { acquisition: dto.acquisition }),
      ...(correlationIdHeader && { correlationId: correlationIdHeader }),
    });
  }
}
