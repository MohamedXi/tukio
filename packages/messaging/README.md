# @tukio/messaging

NATS JetStream client + transactional outbox/inbox patterns for Tukio microservices.

Guarantees: events are published **if and only if** the business DB transaction commits (outbox pattern — ADR-007). Consumers are idempotent (inbox deduplication by `eventId`). `correlationId` propagates transparently across services via `AsyncLocalStorage`.

## Architecture

```
Service A (identity-svc)            NATS JetStream               Service B (notification-svc)
──────────────────────              ──────────────               ──────────────────────────
UseCase.execute()
  └─ OutboxPublisher.publish()  →   outbox row (pending)
  [tx COMMIT]                       ↓ pg_notify
  OutboxRelayService                OutboxRelayService.processPendingOutbox()
  └─ NatsJetStreamClient.publish() → ack → status=published
                                                                  InboxConsumer.handle()
                                                                  ├─ dedup check (inbox table)
                                                                  ├─ handler(event) in tx
                                                                  └─ jsMsg.ack() → processed
```

## Quick-start: Publishing an event

1. **Wire `NatsPublisherModule`** (see `apps/identity-svc` as the canonical example):

   ```ts
   imports: [
     OutboxPublisherModule,
     OutboxRelayModule.forRoot({ streamName: 'TUKIO_<SVC>', subjectPrefix: 'tukio.<svc>' }),
     NatsJetStreamModule.forRoot({ url: process.env.NATS_URL, streams: [...] }),
   ],
   providers: [{ provide: EVENT_PUBLISHER, useExisting: OUTBOX_PUBLISHER }],
   ```

2. **Publish from a use case** — always via `IEventPublisher.publish()`:

   ```ts
   // ✅ Correct — transactionally atomic via outbox
   await this.eventPublisher.publish(event);

   // ❌ Wrong — bypasses outbox (caught by tukio/no-direct-event-publish lint rule)
   await this.natsClient.publish('subject', event);
   ```

## Quick-start: Consuming an event

Wrap every handler with `InboxConsumer.handle()` for idempotence + backoff retries:

```ts
await this.natsClient.subscribe('TUKIO_IDENTITY', 'my-svc-consumer', (msg) =>
  this.inboxConsumer.handle<AdminActionProVerifiedV1Payload>(msg, async (event) => {
    await this.sendVerificationEmailUseCase.execute({ proId: event.payload.proId });
  }),
);
```

## Quick-start: Correlation propagation

```ts
// In main.ts — wrap Fastify requests
app.addHook('onRequest', (req, reply, done) => correlationMiddleware(req, reply, done));

// InboxConsumer auto-propagates event.correlationId through the handler's async tree.
// OutboxPublisher picks up correlationId from context when not explicitly set.
```

## Adding outbox+inbox tables to a service

Copy and rename both migration templates:

```bash
# Template: packages/messaging/src/outbox/migrations/template-create-outbox-table.ts
# → apps/<svc>/src/infrastructure/persistence/typeorm/migrations/<timestamp>-AddOutboxInboxTables.ts
pnpm --filter=<svc> migration:run
```

## References

- ADR-002: NATS JetStream — `docs/adr/0002-nats-jetstream.md` _(Story 0.13)_
- ADR-006: Saga choréographée — `docs/adr/0006-saga-choreographie.md` _(Story 0.13)_
- ADR-007: Outbox pattern — `docs/adr/0007-transactional-outbox.md` _(Story 0.13)_
