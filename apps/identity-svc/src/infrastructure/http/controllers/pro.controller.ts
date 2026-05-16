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
import type { RegisterProUseCase } from '../../../usecases/register-pro.usecase.js';
import { UseCaseProxy } from '../../usecases-proxy/usecases-proxy.js';
import { UseCasesProxyModule } from '../../usecases-proxy/usecases-proxy.module.js';
import { InternalServiceGuard } from '../guards/internal-service.guard.js';
import { parseMultipartProRegister } from '../utils/parse-multipart-pro-register.js';

interface RegisterProResponseDto {
  userId: string;
  proProfileId: string;
  requiresAdminReview: true;
  requiresEmailVerification: true;
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
 * Story 1.3b — `POST /internal/pros` endpoint.
 *
 * Internal-only endpoint called by gateway-api (Story 1.3c) after the public
 * `POST /v1/auth/pro/register` multipart body has passed gateway-side
 * validation and throttling. The gateway forwards the same multipart (files +
 * JSON `payload` field) signed with HMAC (`InternalServiceGuard`).
 *
 * NEVER exposed publicly — protected by K8s/DO firewall (gateway-api → identity-svc:4001).
 */
@Controller('internal/pros')
@Public()
@UseGuards(InternalServiceGuard)
export class ProController {
  constructor(
    @Inject(UseCasesProxyModule.REGISTER_PRO_USECASES_PROXY)
    private readonly registerProProxy: UseCaseProxy<RegisterProUseCase>,
  ) {}

  @Post()
  @HttpCode(201)
  async register(
    @Req() req: MultipartHttpRequest,
    @Headers('x-tukio-correlation-id') correlationIdHeader?: string,
  ): Promise<RegisterProResponseDto> {
    const input = await parseMultipartProRegister(req);
    return this.registerProProxy.getInstance().execute({
      ...input,
      correlationId: correlationIdHeader,
    });
  }
}
