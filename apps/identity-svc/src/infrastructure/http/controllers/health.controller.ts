import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Optional,
} from '@nestjs/common';
import { Public } from '@tukio/auth/decorators/public';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';

interface HealthBody {
  status: 'ok';
}

interface ReadyBody {
  status: 'ready';
  dependencies: { postgres: 'up' };
}

@Controller()
export class HealthController {
  constructor(
    @Optional() @InjectDataSource() private readonly dataSource?: DataSource,
  ) {}

  @Public()
  @Get('/health')
  health(): HealthBody {
    return { status: 'ok' };
  }

  @Public()
  @Get('/ready')
  ready(): ReadyBody {
    const dbUp = this.dataSource?.isInitialized ?? false;
    if (!dbUp) {
      throw new HttpException(
        { status: 'not-ready', dependencies: { postgres: 'down' } },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return { status: 'ready', dependencies: { postgres: 'up' } };
  }
}
