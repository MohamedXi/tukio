import { Controller, Get } from '@nestjs/common';
import { Public } from '@tukio/auth/decorators/public';

interface HealthBody {
  status: 'ok';
}

interface ReadyBody {
  status: 'ready';
}

/**
 * BFF liveness + readiness. Gateway-api owns no Postgres connection (Story 1.2c
 * BFF Pretre), so `/ready` reports OK as soon as the process is up.
 *
 * Future hardening (V1) : probe downstream service health and Redis ping.
 */
@Controller()
export class HealthController {
  @Public()
  @Get('/health')
  health(): HealthBody {
    return { status: 'ok' };
  }

  @Public()
  @Get('/ready')
  ready(): ReadyBody {
    return { status: 'ready' };
  }
}
