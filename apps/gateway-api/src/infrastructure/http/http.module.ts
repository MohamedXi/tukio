import { Module } from '@nestjs/common';
import { ConfigurationModule } from '../config/config.module.js';
import { HealthController } from './controllers/health.controller.js';
import { AuthCustomerController } from './controllers/auth-customer.controller.js';
import { AuthProController } from './controllers/auth-pro.controller.js';

/**
 * Gateway-api HTTP layer (Story 1.2c + 1.3c). UseCasesProxyModule is global so
 * the forwarders are injectable here without an explicit import.
 */
@Module({
  imports: [ConfigurationModule],
  controllers: [HealthController, AuthCustomerController, AuthProController],
})
export class HttpModule {}
