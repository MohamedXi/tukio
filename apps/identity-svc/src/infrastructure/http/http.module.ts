import { Module } from '@nestjs/common';
import { UseCasesProxyModule } from '../usecases-proxy/usecases-proxy.module.js';
import { HealthController } from './controllers/health.controller.js';
import { UserController } from './controllers/user.controller.js';

@Module({
  imports: [UseCasesProxyModule.register()],
  controllers: [HealthController, UserController],
})
export class HttpModule {}
