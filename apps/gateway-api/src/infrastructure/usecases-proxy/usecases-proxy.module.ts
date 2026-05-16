import { type DynamicModule, Global, Module } from '@nestjs/common';
import { IdentitySvcModule } from '../external/identity-svc/identity-svc.module.js';
import { IDENTITY_SVC_CLIENT } from '../../domain/ports/tokens.js';
import type { IIdentitySvcClient } from '../../domain/ports/identity-svc.port.js';
import { RegisterCustomerForwarder } from '../../usecases/register-customer.forwarder.js';
import { UseCaseProxy } from './usecases-proxy.js';

/**
 * Story 1.2c — Pattern Pretre wiring (BFF flavour). Maps domain ports →
 * downstream-service-backed implementations, then exposes ready-to-inject
 * `UseCaseProxy` providers for controllers.
 *
 * Kept global so any controller can inject the forwarder by token without
 * importing this module explicitly (mirrors identity-svc Story 0.6 layout).
 */
export const REGISTER_CUSTOMER_FORWARDER = 'REGISTER_CUSTOMER_FORWARDER';
export type RegisterCustomerForwarderProxy =
  UseCaseProxy<RegisterCustomerForwarder>;

@Global()
@Module({})
export class UseCasesProxyModule {
  static register(): DynamicModule {
    return {
      module: UseCasesProxyModule,
      imports: [IdentitySvcModule],
      providers: [
        {
          inject: [IDENTITY_SVC_CLIENT],
          provide: REGISTER_CUSTOMER_FORWARDER,
          useFactory: (
            client: IIdentitySvcClient,
          ): RegisterCustomerForwarderProxy =>
            new UseCaseProxy(new RegisterCustomerForwarder(client)),
        },
      ],
      exports: [REGISTER_CUSTOMER_FORWARDER],
    };
  }
}
