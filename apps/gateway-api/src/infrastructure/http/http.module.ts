import { Module } from '@nestjs/common';
import { ConfigurationModule } from '../config/config.module.js';
import { HealthController } from './controllers/health.controller.js';
import { AuthCustomerController } from './controllers/auth-customer.controller.js';

/**
 * Gateway-api HTTP layer (Story 1.2c). UseCasesProxyModule is global so the
 * forwarder is injectable here without an explicit import.
 */
@Module({
  imports: [ConfigurationModule],
  controllers: [HealthController, AuthCustomerController],
})
export class HttpModule {}
