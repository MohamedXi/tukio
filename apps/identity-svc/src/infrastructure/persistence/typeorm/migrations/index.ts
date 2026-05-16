/* Explicit migration registry — bundled into the prod webpack output.
   Order matters : TypeORM applies migrations in array order. Add new entries
   at the end as new migration files are generated. The CLI (`pnpm migration:run`
   from `apps/identity-svc/`) discovers files via the glob in `data-source.ts`;
   the runtime app (`TypeOrmModule.forRootAsync` in `app.module.ts`) uses this
   list so webpack can statically include the classes. */
import { CreateUserProfilesBaseline1715200000000 } from './1715200000000-CreateUserProfilesBaseline.js';
import { AddOutboxInboxTables1715210000000 } from './1715210000000-AddOutboxInboxTables.js';
import { AddAcquisitionColumns1715220000000 } from './1715220000000-AddAcquisitionColumns.js';
import { AddCustomerRegistrationFields1715230000000 } from './1715230000000-AddCustomerRegistrationFields.js';

export const ALL_MIGRATIONS = [
  CreateUserProfilesBaseline1715200000000,
  AddOutboxInboxTables1715210000000,
  AddAcquisitionColumns1715220000000,
  AddCustomerRegistrationFields1715230000000,
];
