import { Module } from '@nestjs/common';
import { ConfigurationModule } from '../config/config.module.js';
import { HealthController } from './controllers/health.controller.js';
import { UserController } from './controllers/user.controller.js';
import { CustomerController } from './controllers/customer.controller.js';
import { ProController } from './controllers/pro.controller.js';
import { InternalServiceGuard } from './guards/internal-service.guard.js';

// UseCasesProxyModule is registered globally by AppModule — no need to import here.
// ConfigurationModule is imported so the InternalServiceGuard (which injects
// IConfigService for the HMAC secret) resolves at controller bootstrap time.
@Module({
  imports: [ConfigurationModule],
  controllers: [
    HealthController,
    UserController,
    CustomerController,
    ProController,
  ],
  providers: [InternalServiceGuard],
})
export class HttpModule {}
