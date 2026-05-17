import {
  Controller,
  Headers,
  HttpCode,
  Inject,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Public } from '@tukio/auth/decorators/public';
import type { ConvertCustomerToProUseCase } from '../../../usecases/convert-customer-to-pro.usecase.js';
import { UseCaseProxy } from '../../usecases-proxy/usecases-proxy.js';
import { UseCasesProxyModule } from '../../usecases-proxy/usecases-proxy.module.js';
import { InternalServiceGuard } from '../guards/internal-service.guard.js';
import { parseMultipartProRegister } from '../utils/parse-multipart-pro-register.js';

interface ConvertCustomerToProResponseDto {
  userId: string;
  proProfileId: string;
  requiresAdminReview: true;
  requiresEmailVerification: false;
}

// Structural request shape — avoids declaring `fastify` as a direct dep of
// identity-svc. Must be structurally compatible with the MultipartRequest
// interface expected by parseMultipartProRegister.
interface MultipartHttpRequest {
  isMultipart: () => boolean;
  parts: (options?: {
    limits?: { fileSize?: number };
  }) => AsyncIterableIterator<unknown>;
}

/**
 * Story 1.3b-bis — `POST /internal/pros` endpoint (authenticated conversion).
 *
 * Called by gateway-api (Story 1.3c) after the public `POST /v1/auth/pro/register`
 * has been authenticated (JWT guard, Customer with verified email), parsed, and
 * throttled. Gateway forwards the same multipart signed with HMAC + injects the
 * JWT `sub` as `payload.userId`.
 *
 * NEVER exposed publicly — protected by K8s/DO firewall (gateway-api → identity-svc:4001).
 */
@Controller('internal/pros')
@Public()
@UseGuards(InternalServiceGuard)
export class ProController {
  constructor(
    @Inject(UseCasesProxyModule.CONVERT_CUSTOMER_TO_PRO_USECASES_PROXY)
    private readonly convertProxy: UseCaseProxy<ConvertCustomerToProUseCase>,
  ) {}

  @Post()
  @HttpCode(201)
  async register(
    @Req() req: MultipartHttpRequest,
    @Headers('x-tukio-correlation-id') correlationIdHeader?: string,
  ): Promise<ConvertCustomerToProResponseDto> {
    const input = await parseMultipartProRegister(req);
    return this.convertProxy.getInstance().execute({
      ...input,
      correlationId: correlationIdHeader,
    });
  }
}
