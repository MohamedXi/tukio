import { Module } from '@nestjs/common';
import { HealthController } from './controllers/health.controller.js';
import { UserController } from './controllers/user.controller.js';

// UseCasesProxyModule is registered globally by AppModule — no need to import here.
@Module({
  controllers: [HealthController, UserController],
})
export class HttpModule {}
