import { Module } from '@nestjs/common';
import { ConfigurationModule } from '../config/config.module.js';
import { HealthController } from './controllers/health.controller.js';
import { AuthCustomerController } from './controllers/auth-customer.controller.js';
import { AuthProController } from './controllers/auth-pro.controller.js';
import { AuthLoginController } from './controllers/auth-login.controller.js';

/**
 * Gateway-api HTTP layer (Story 1.2c + 1.3c + 1.4b). UseCasesProxyModule is
 * global so the forwarders + login use cases are injectable here without an
 * explicit import.
 */
@Module({
  imports: [ConfigurationModule],
  controllers: [
    HealthController,
    AuthCustomerController,
    AuthProController,
    AuthLoginController,
  ],
})
export class HttpModule {}
