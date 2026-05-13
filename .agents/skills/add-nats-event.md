# Skill: add a new NATS event

Use this when a service needs to emit a new domain event (e.g.
`booking.requested.v1`). Covers the event schema in `@tukio/contracts`,
the producer wiring (`OutboxPublisher` from a use case), and the
consumer wiring (`Inbox` dedup + `@NatsSubscribe`).

## Prerequisites

- Story file with the event scope: subject, payload, producer, consumers.
- The producing service has the **outbox tables** (Story 0.7 migration
  `1715210000000-AddOutboxInboxTables.ts`) applied.
- Read `.agents/context/messaging.md` in full.
- Read `apps/identity-svc/src/usecases/<existing-usecase>.ts` for a
  reference of `OutboxPublisher` usage.

## Naming

Subject format: `<domain>.<entity>.<verb>.v<n>` — lowercase, dot-separated,
kebab-case within segments, **English-only**.

Examples:

- `identity.user.registered.v1`
- `identity.user.email-verified.v1`
- `catalog.listing.published.v1`
- `booking.requested.v1`
- `booking.accepted.v1`
- `payment.intent.captured.v1`
- `admin.action.pro-verified.v1` → goes to `TUKIO_AUDIT` stream

The `tukio/event-naming` ESLint rule (error) validates this at publish /
subscribe sites.

## Step-by-step

1. **Define the Zod schema** in
   `packages/contracts/src/events/<domain>/<event-name>.v<n>.ts`:

   ```ts
   import { z } from 'zod';
   import { ActorSchema } from '../../types/Actor.js';
   import { LocaleSchema } from '../../types/Locale.js';

   export const UserRegisteredV1Schema = z.object({
     userId: z.string().uuid(),
     email: z.email(),
     locale: LocaleSchema,
     registeredAt: z.iso.datetime(),
     actor: ActorSchema.optional(),
   });

   export type UserRegisteredV1 = z.infer<typeof UserRegisteredV1Schema>;

   export const USER_REGISTERED_V1 = 'identity.user.registered.v1' as const;
   ```

2. **Export the subpath** in `packages/contracts/package.json#exports`:

   ```json
   "./events/<domain>/<event-name>.v<n>": {
     "types": "./src/events/<domain>/<event-name>.v<n>.ts",
     "default": "./src/events/<domain>/<event-name>.v<n>.ts"
   }
   ```

3. **Update the event catalog doc** in
   `docs/tukio_event_catalog.md` (if it exists for this domain). Add a
   row: subject, producer, consumers, payload summary.

4. **Producer side — emit from a use case**:

   ```ts
   // apps/identity-svc/src/usecases/register-user.usecase.ts
   import type { IEventPublisher } from '../domain/ports/event-publisher.port.js';
   import {
     USER_REGISTERED_V1,
     UserRegisteredV1Schema,
   } from '@tukio/contracts/events/identity/user-registered.v1';

   export class RegisterUserUseCase {
     constructor(
       private readonly users: IUserProfileRepository,
       private readonly events: IEventPublisher, // bound to OutboxPublisher
     ) {}

     async execute(cmd: RegisterUserCommand): Promise<UserProfile> {
       const profile = UserProfile.create(cmd);
       await this.users.save(profile);

       await this.events.publish({
         type: USER_REGISTERED_V1,
         payload: UserRegisteredV1Schema.parse({
           userId: profile.id,
           email: profile.email.value,
           locale: cmd.locale,
           registeredAt: new Date().toISOString(),
         }),
         correlationId: cmd.correlationId,
       });

       return profile;
     }
   }
   ```

   The `OutboxPublisher` writes to the local `outbox` table in the same
   PG transaction. The `OutboxRelayService` (background) picks it up via
   `LISTEN tukio_outbox_new` and publishes to JetStream stream
   `TUKIO_<SERVICE>`. **Never** call `nats.publish()` directly —
   enforced by `tukio/no-direct-event-publish`.

5. **Consumer side — handle in another service**:

   ```ts
   // apps/notification-svc/src/infrastructure/messaging/handlers/user-registered.handler.ts
   import { NatsSubscribe } from '@tukio/messaging';
   import { InboxService } from '@tukio/messaging/inbox';
   import {
     USER_REGISTERED_V1,
     UserRegisteredV1Schema,
   } from '@tukio/contracts/events/identity/user-registered.v1';

   @Injectable()
   export class UserRegisteredHandler {
     constructor(
       private readonly inbox: InboxService,
       private readonly useCase: SendWelcomeEmailUseCase,
     ) {}

     @NatsSubscribe(USER_REGISTERED_V1, {
       stream: 'TUKIO_IDENTITY',
       durable: 'notification-user-registered',
     })
     async handle(msg: NatsMessage): Promise<void> {
       const event = UserRegisteredV1Schema.parse(msg.payload);
       await this.inbox.dedupAndProcess(msg.event_id, async () => {
         await this.useCase.execute({
           userId: event.userId,
           email: event.email,
           locale: event.locale,
         });
       });
     }
   }
   ```

6. **Wire the handler** in `app.module.ts` of the consuming service:

   ```ts
   @Module({
     imports: [
       NatsJetStreamModule.forRootAsync({
         /* … */
       }),
       InboxModule,
       // …
     ],
     providers: [UserRegisteredHandler],
   })
   export class AppModule {}
   ```

7. **Tests.**
   - **Producer**: use-case spec mocks `IEventPublisher` and asserts
     `.publish({ type: USER_REGISTERED_V1, payload: ..., correlationId: ... })`
     was called with the right shape.
   - **Producer e2e**: with testcontainers PG + NATS, trigger the use
     case and assert the outbox row is written **and** picked up by
     the relay (`published_at IS NOT NULL` after ~100 ms).
   - **Consumer**: handler spec mocks `InboxService.dedupAndProcess` and
     asserts the use case fires with the correct args.
   - **Consumer e2e**: publish a synthetic event via testcontainers
     NATS, assert the side effect (e.g. an email row written to
     notification-svc's DB) and that the inbox is marked
     `processed_at IS NOT NULL`.
   - **Chaos**: add a chaos spec for the new event in
     `test/chaos/<event>.chaos-spec.ts` covering: producer crashes
     between `save` and `publish` (idempotent via outbox), consumer
     crashes between `dedup` and use-case completion (rolled back by
     transaction, redelivered).

8. **Bump versions when payload changes.** Breaking payload changes
   require a new `.v<n+1>` file. Old consumers stay on `v<n>` until
   migrated. Never reuse a `v<n>` with breaking changes.

9. **Run `/check`**:

   ```bash
   pnpm --filter=@tukio/contracts typecheck
   pnpm --filter=<producer-svc> typecheck && test && test:e2e
   pnpm --filter=<consumer-svc> typecheck && test && test:e2e
   pnpm lint        # tukio/event-naming + no-direct-event-publish
   pnpm chaos:test  # if chaos suite touched
   ```

10. **Commit + PR.**
    `feat(@tukio/contracts): add <event-name>.v1 schema — Story <X.Y>`
    (+ separate or same commit for producer / consumer wiring,
    depending on PR scope).

## Anti-patterns to refuse

- Naming the event `UserRegistered` or `userRegistered` — must be
  `identity.user.registered.v1`.
- Skipping the `v1` suffix — versioning is mandatory.
- Publishing without `OutboxPublisher` — `nats.publish()` directly is
  rejected by `tukio/no-direct-event-publish`.
- Consuming without `InboxService.dedupAndProcess` — at-least-once
  delivery becomes at-many-times-very-bad delivery.
- Skipping `Schema.parse(msg.payload)` on consume — silent payload drift
  becomes silent bugs.
- Reusing a `v1` schema after a breaking payload change — bump to `v2`.
- Forgetting `correlationId` — propagation breaks observability.
- Putting French in the event subject (`identite.utilisateur.cree.v1`)
  — tech layer is English-only.
- Forgetting to add the `durable: '<service>-<handler>'` name on
  `@NatsSubscribe` — anonymous consumers don't survive restarts.
