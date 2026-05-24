# Story 5.1: messaging-svc Pretre + `Conversation` + `Message` aggregates + rate-limit/R2/NATS infrastructure (Epic 5 kick-off — 2e référence canonique Pattern Pretre)

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

**As a** backend tech lead Epic 5 kick-off,
**I want** scaffolder `apps/messaging-svc/` **strictement** selon Pattern Pretre — domain pur (`Conversation` aggregate root 1:1 `Booking` + `Message` entity + 4 value objects + 5 ports + `AntiSpamService` pure + 7 exceptions tukioCode), 6 use cases (**1 FULL** `CreateConversationFromBookingUseCase` consumer `booking.requested.v1` + **5 SKELETON** que Stories 5.2/5.3 finaliseront sans toucher au scaffold), `UseCasesProxyModule` central wiring 6 PROXY tokens, infrastructure adapters (3 TypeORM entities + 4 migrations dont outbox/inbox baseline Story 0.7, `RedisRateLimitAdapter` ioredis Lua atomic, `R2StorageAdapter` @aws-sdk/client-s3 SSE-S3 multipart, `BookingRequestedConsumerHandler` NATS InboxConsumer Story 0.7 dedup), 1 cron `purge-old-messages.task.ts` baseline `@Cron('0 4 1 * *')` (logique R2 archive + DELETE 5y NFR1+FR74 finalisée Story 5.3), 4 `prom-client` metrics module-level (Story 0.6 pattern), 6 nouveaux event schemas sous `@tukio/contracts/events/messaging/` (1 émis + 5 STUB ready), lint boundaries strict (`eslint-plugin-boundaries` Story 0.6 AC8 + custom rule `tukio/pretre-domain-purity` Story 1.10 baseline + test fixture négatif `__fixtures__/bad-domain-import.ts`), DB `tukio_messaging` baseline (3 tables métier + 2 baseline outbox/inbox + 7 indexes), bootstrap Fastify + Pino + envelope ADR-014 + KeycloakJwtGuard global + ZodValidationPipe + EnvelopeExceptionFilter — réplication **fidèle** du scaffolding identity-svc (Story 1.10 référence canonique),

**so that** Epic 5 démarre **sur une fondation Pretre exemplaire** (audit code de tiers RGPD + sécurité + architecture trouve la même qualité que `identity-svc`), Stories 5.2 (Conversation thread UI), 5.3 (Send message + rate-limit FR73 + retention FR74 RGPD), 5.4 (notification-svc Pretre — 3e référence Pretre s'appuie sur le pattern posé ici) peuvent **brancher leurs use cases finaux sans refactor du scaffold** (les 5 SKELETONS sont signés avec input/output types exacts + TODO Story X.Y commentés inline), la **rate-limit Redis atomique** est en place (anti-race FR73 — pas de retravail Story 5.3), la **R2 storage** est en place (SSE-S3 + multipart 5MB chunks — pas de retravail Story 5.3 pour archive 5y), le **BookingRequestedConsumer** consume immédiatement `booking.requested.v1` Story 4.1 et persiste la `Conversation` (Customer voit son fil dès la création du booking), et la **DB `tukio_messaging` baseline** est créée idempotente via TypeORM `migrationsRun: true` (single-replica DO Droplet, pas de race multi-leader).

> **Outcome attendu** : à la fin de cette story, `pnpm --filter=messaging-svc lint` retourne **0 violations boundaries** (domain pure, fixture négative `__fixtures__/bad-domain-import.ts` provoque exit 1 avec message clair `"🚫 Pattern Pretre violation: domain/ must not import I/O libs"`) ; `pnpm --filter=messaging-svc test --coverage` rend **≥ 80% domain, ≥ 70% usecases, ≥ 50% infrastructure** (NFR71 CI fail-fast) ; `docker compose up messaging-svc` boot un container sain (port 4006, healthcheck `/health` 200) qui (a) applique 4 migrations en sequence (CreateConversationsTable + CreateMessagesTable + CreateMessageArchiveIndexTable + AddOutboxInboxTables) sur `tukio_messaging`, (b) souscrit au stream NATS `TUKIO_BOOKING` consumer durable `messaging-svc-booking-requested`, (c) sur `booking.requested.v1` reçu insère `conversations` row 1:1 booking + outbox `messaging.conversation.created.v1` + ack JetStream + inbox dedup row ; `pnpm --filter=@tukio/contracts test` montre 6 nouveaux event schemas messaging validés (1 émis + 5 STUB types-only ready pour Stories 5.2/5.3) ; `apps/messaging-svc/test/conversation-created.e2e-spec.ts` passe (testcontainer Postgres + NATS) — verify event NATS publié → conversation row visible → outbox row `status='published'` ; `_bmad-output/implementation-artifacts/sprint-status.yaml` flip Story 5.1 → `done` et Story 5.2 peut démarrer.

## Acceptance Criteria

1. **AC1 — Arborescence Pretre strictement répliquée** : `apps/messaging-svc/src/` contient exactement la structure ci-dessous (réplique de `apps/identity-svc/src/`, Story 1.10 référence canonique) :

   ```
   apps/messaging-svc/src/
   ├─ domain/
   │  ├─ model/
   │  │  ├─ conversation.aggregate.ts                    # AC2
   │  │  ├─ conversation.aggregate.spec.ts
   │  │  ├─ message.entity.ts                            # AC3
   │  │  ├─ message.entity.spec.ts
   │  │  ├─ conversation-id.value-object.ts              # UUID branded type
   │  │  ├─ conversation-id.value-object.spec.ts
   │  │  ├─ message-content.value-object.ts              # max 4000 chars, trim
   │  │  ├─ message-content.value-object.spec.ts
   │  │  ├─ participant.value-object.ts                  # actorId + role (customer|pro|system)
   │  │  ├─ participant.value-object.spec.ts
   │  │  └─ actor-id.value-object.ts                     # réutilise ActorId Story 1.10 si exporté, sinon impl locale
   │  ├─ ports/
   │  │  ├─ tokens.ts                                    # Symbol DI tokens — Pattern Pretre (Story 0.6 AC3)
   │  │  ├─ conversation-repository.port.ts              # IConversationRepository
   │  │  ├─ message-repository.port.ts                   # IMessageRepository
   │  │  ├─ message-archive-index-repository.port.ts     # IMessageArchiveIndexRepository (Story 5.3 finalise)
   │  │  ├─ rate-limit.port.ts                           # IRateLimitPort (Story 5.3 finalise check)
   │  │  ├─ r2-storage.port.ts                           # IR2StoragePort (Story 5.3 finalise archive)
   │  │  ├─ event-publisher.port.ts                      # IEventPublisher (re-exporte type @tukio/messaging)
   │  │  ├─ logger.port.ts                               # ILogger
   │  │  └─ config.port.ts                               # IConfigService
   │  ├─ service/
   │  │  ├─ anti-spam.service.ts                         # AC5 — pure logic FR73 (Redis adapter dans infra)
   │  │  └─ anti-spam.service.spec.ts
   │  └─ exception/
   │     ├─ messaging.exception.ts                       # AC6 — base abstract
   │     ├─ messaging-not-found.exception.ts             # MESSAGING-NOT-FOUND-001 → 404
   │     ├─ messaging-invalid-content.exception.ts       # MESSAGING-INVALID-CONTENT-001 → 422
   │     ├─ messaging-forbidden.exception.ts             # MESSAGING-FORBIDDEN-001 → 403
   │     ├─ messaging-rate-limited.exception.ts          # MESSAGING-RATE-LIMITED-001 → 429
   │     ├─ messaging-conflict.exception.ts              # MESSAGING-CONFLICT-001 → 409 (booking already linked)
   │     └─ messaging-external.exception.ts              # MESSAGING-EXTERNAL-001 → 502 (Redis/R2 unreachable)
   ├─ usecases/
   │  ├─ create-conversation-from-booking.usecase.ts     # AC7 — FULL impl (consumer booking.requested.v1)
   │  ├─ create-conversation-from-booking.usecase.spec.ts
   │  ├─ send-message.usecase.ts                         # SKELETON Story 5.3 → FULL
   │  ├─ send-message.usecase.spec.ts                    # 1 smoke test "Story 5.3 finalize"
   │  ├─ mark-message-as-read.usecase.ts                 # SKELETON Story 5.2 → FULL
   │  ├─ mark-message-as-read.usecase.spec.ts
   │  ├─ list-conversations.usecase.ts                   # SKELETON Story 5.2 → FULL
   │  ├─ list-conversations.usecase.spec.ts
   │  ├─ get-conversation-messages.usecase.ts            # SKELETON Story 5.2 → FULL
   │  ├─ get-conversation-messages.usecase.spec.ts
   │  └─ purge-old-messages.usecase.ts                   # SKELETON Story 5.3 → FULL (R2 archive + DELETE 5y)
   │     purge-old-messages.usecase.spec.ts
   ├─ infrastructure/
   │  ├─ config/
   │  │  ├─ env.schema.ts                                # Zod env vars (Story 1.2c pattern)
   │  │  ├─ environment-config.service.ts                # IConfigService impl
   │  │  └─ config.module.ts
   │  ├─ logger/
   │  │  ├─ pino-logger.service.ts                       # ILogger impl + redact rules NFR82 AC11
   │  │  └─ logger.module.ts
   │  ├─ http/
   │  │  ├─ controllers/
   │  │  │  └─ health.controller.ts                      # GET /health → 200 (no /v1/conversations* MVP — Story 5.2 BFF gateway-api)
   │  │  ├─ filters/
   │  │  │  └─ envelope-exception.filter.ts              # copie strict de identity-svc filter ADR-014
   │  │  ├─ interceptors/
   │  │  │  └─ response-envelope.interceptor.ts          # idem identity-svc
   │  │  └─ http.module.ts
   │  ├─ persistence/typeorm/
   │  │  ├─ entities/
   │  │  │  ├─ conversation.entity.ts                    # AC8
   │  │  │  ├─ message.entity.ts
   │  │  │  └─ message-archive-index.entity.ts
   │  │  ├─ repositories/
   │  │  │  ├─ typeorm-conversation.repository.ts        # IConversationRepository impl
   │  │  │  ├─ typeorm-message.repository.ts             # IMessageRepository impl (Story 5.2/5.3 finalisent)
   │  │  │  └─ typeorm-message-archive-index.repository.ts
   │  │  ├─ mappers/
   │  │  │  ├─ conversation.mapper.ts                    # toDomain / toEntity bidirectional
   │  │  │  └─ message.mapper.ts
   │  │  ├─ migrations/
   │  │  │  ├─ 1715300000000-CreateConversationsTable.ts          # AC8
   │  │  │  ├─ 1715310000000-CreateMessagesTable.ts
   │  │  │  ├─ 1715320000000-CreateMessageArchiveIndexTable.ts
   │  │  │  ├─ 1715330000000-AddOutboxInboxTables.ts              # copy template @tukio/messaging
   │  │  │  └─ index.ts                                            # ALL_MIGRATIONS array
   │  │  ├─ typeorm-repositories.module.ts
   │  │  └─ data-source.ts                                # standalone TypeORM CLI access
   │  ├─ external/
   │  │  ├─ redis/
   │  │  │  ├─ redis-rate-limit.adapter.ts               # AC9 — IRateLimitPort impl, ioredis Lua atomic
   │  │  │  ├─ redis-rate-limit.adapter.integration.spec.ts
   │  │  │  └─ redis.module.ts
   │  │  └─ r2/
   │  │     ├─ r2-storage.adapter.ts                     # AC10 — IR2StoragePort impl, @aws-sdk/client-s3
   │  │     ├─ r2-storage.adapter.integration.spec.ts
   │  │     └─ r2.module.ts
   │  ├─ messaging/nats/
   │  │  ├─ nats-publisher.module.ts                     # wraps OutboxPublisher + OutboxRelayService + NatsJetStreamModule
   │  │  ├─ consumers/
   │  │  │  └─ booking-requested-consumer.handler.ts     # AC11 — InboxConsumer pattern Story 0.7
   │  │  └─ consumers.module.ts
   │  ├─ metrics/
   │  │  ├─ messaging.metrics.ts                         # AC12 — 4 prom-client (module-level)
   │  │  └─ metrics.module.ts
   │  ├─ scheduling/
   │  │  ├─ purge-old-messages.task.ts                   # @Cron('0 4 1 * *') monthly — SKELETON wires purge-old-messages.usecase
   │  │  └─ scheduling.module.ts
   │  └─ usecases-proxy/
   │     ├─ usecases-proxy.ts                            # UseCaseProxy<T> generic (copie identity-svc)
   │     └─ usecases-proxy.module.ts                     # 6 PROXY tokens AC13
   ├─ test/
   │  ├─ conversation-created.e2e-spec.ts                # AC15 — testcontainer NATS + Postgres
   │  ├─ health.e2e-spec.ts
   │  ├─ helpers/
   │  │  └─ build-test-app.ts                            # bootstrap mini-app pattern identity-svc
   │  ├─ __fixtures__/
   │  │  └─ bad-domain-import.ts                         # AC14 — domain importe `@nestjs/common` → lint exit 1
   │  └─ jest-e2e.json
   ├─ app.module.ts                                       # AC16
   └─ main.ts                                             # AC17
   ```

   **Validation** : `tree apps/messaging-svc/src -L 3 -I node_modules` reproduit cette arborescence. Tout fichier listé doit exister (sinon Story 5.1 `done` est faux).

2. **AC2 — `Conversation` aggregate root (FULL impl)** : `apps/messaging-svc/src/domain/model/conversation.aggregate.ts` :
   - **Class final** avec `private constructor` + 2 factories static :
     - `Conversation.createFromBooking({ bookingId, customerActorId, proActorId, locale, now?, id? }): Conversation` → impose `participantsActorIds: [customerActorId, proActorId]` deux participants distincts (throw `InvalidConversationException` si `customerActorId === proActorId`), `lastMessageAt: null`, `unreadCounts: { customerUnread: 0, proUnread: 0 }`, `createdAt = updatedAt = now() ?? new Date()`, `status: 'active'`, `archivedAt: null`, `bookingId` immutable readonly.
     - `Conversation.rehydrate(props: ConversationProps): Conversation` → reconstruction depuis DB (mapper), pas de validation supplémentaire.
   - **Méthodes domain** (pure, immutable patterns) :
     - `canParticipantSend(actorId: ActorId): boolean` → check `actorId ∈ participantsActorIds && status === 'active'`.
     - `recordMessageSent(senderActorId: ActorId, sentAt: Date): void` (mutate state : `lastMessageAt = sentAt`, increment `unreadCounts[other-participant-role]`, `updatedAt = sentAt`) — Story 5.3 invoque depuis use case `send-message`.
     - `markReadFor(actorId: ActorId, readAt: Date): void` → reset `unreadCounts[actorRole] = 0`, `updatedAt = readAt`. Idempotent.
     - `archive(now: Date): void` → set `status = 'archived'`, `archivedAt = now`. Throw `InvalidConversationStateException` si déjà `archived`.
     - `isActive(): boolean`, `isArchived(): boolean`.
   - **Type `ParticipantRole`** : `'customer' | 'pro' | 'system'`.
   - **Props readonly** : `id: ConversationId`, `bookingId: string` (UUID), `participantsActorIds: readonly [ActorId, ActorId]` (tuple 2 strict), `locale: Locale`, `lastMessageAt: Date | null`, `unreadCounts: Readonly<{ customerUnread: number; proUnread: number }>`, `status: 'active' | 'archived'`, `archivedAt: Date | null`, `createdAt: Date`, `updatedAt: Date`.
   - **Spec coverage NFR71 ≥ 80%** : 12+ tests minimum (factory happy + factory same actorId throws + recordMessageSent updates lastMessageAt + recordMessageSent increments correct counter + markReadFor resets + idempotent markReadFor + archive sets state + archive double throws + canParticipantSend true/false matrix + rehydrate roundtrip).

3. **AC3 — `Message` entity (FULL impl)** : `apps/messaging-svc/src/domain/model/message.entity.ts` :
   - **Class** avec `private constructor` + 2 factories :
     - `Message.create({ conversationId, senderActorId, content, kind, now?, id? }): Message` → `kind: 'user' | 'system'` (default `'user'`), `content` doit être un `MessageContent` VO (non raw string). `sentAt = now()`, `deliveredAt = null`, `readAt = null`, `isAnonymized = false`.
     - `Message.rehydrate(props: MessageProps): Message`.
   - **Méthodes** :
     - `markAsDelivered(deliveredAt: Date): void` (idempotent).
     - `markAsRead(readAt: Date): void` (idempotent ; throw `InvalidMessageStateException` si message déjà soft-deleted/anonymized via flag).
     - `anonymize(now: Date): void` → set `isAnonymized = true`, `anonymizedAt = now`. **Le content reste intact** (FR74 rétention 5 ans, anonymisation = effacement du `senderActorId` côté display, pas du message — Story 5.3 finalise la logique consumer `identity.user.deleted.v1`).
   - **Props readonly** : `id: string` (UUID), `conversationId: ConversationId`, `senderActorId: ActorId`, `content: MessageContent` (VO ≤ 4000 chars), `kind: 'user' | 'system'`, `sentAt: Date`, `deliveredAt: Date | null`, `readAt: Date | null`, `isAnonymized: boolean`, `anonymizedAt: Date | null`.
   - **Spec coverage** : 8+ tests (create happy + create with system kind + create rejects raw string + markAsDelivered idempotent + markAsRead idempotent + markAsRead on anonymized throws + anonymize preserves content + rehydrate roundtrip).

4. **AC4 — 4 Value Objects** :
   - `ConversationId` : branded type `string & { __brand: 'ConversationId' }`, `ConversationId.create(raw: string): ConversationId` valide UUID v4 regex (throw `InvalidConversationIdException` 422 si invalid), `ConversationId.generate(): ConversationId` (`randomUUID()`), `asString` accessor, `equals(other)`. 4+ tests.
   - `MessageContent` : `MessageContent.create(raw: string): MessageContent` → trim, check length ∈ [1, 4000] (throw `InvalidMessageContentException` `MESSAGING-INVALID-CONTENT-001` 422 si empty post-trim ou > 4000), `asString` accessor. NE FAIT PAS PII REGEX MASKING (FR72 est gérée par gateway-api Story 4.7 PII reveal — pas dans le domain MVP). 6+ tests (1 char OK + 4000 chars OK + 4001 throws + empty throws + whitespace-only throws + trim preserves middle whitespace).
   - `Participant` : `{ actorId: ActorId, role: 'customer' | 'pro' | 'system' }` immutable. Factory `Participant.create({ actorId, role })`. 3+ tests.
   - `ActorId` : si `@tukio/contracts` exporte déjà `ActorId` branded type (cf. Story 1.10 audit_log), réutilise via `import type { ActorId } from '@tukio/contracts/types/Actor'`. **Sinon** crée local `domain/model/actor-id.value-object.ts` strict UUID v4 — flag dans Change Log + ouvrir issue follow-up "promote ActorId to @tukio/contracts".

5. **AC5 — `AntiSpamService` pure logic FR73** : `apps/messaging-svc/src/domain/service/anti-spam.service.ts` :
   - **Stateless class** (pas de `@Injectable()` — pure domain), **NE TOUCHE PAS REDIS** directement (le port `IRateLimitPort` Story 5.3 finalisera). Cette story livre **seulement la logique pure** :
     - `AntiSpamService.computeRateLimitKey(senderActorId: ActorId, recipientActorId: ActorId, conversationId: ConversationId): string` → retourne `tukio:messaging:ratelimit:${conversationId}:${senderActorId}->${recipientActorId}` (stable namespace Story 5.3 RedisRateLimitAdapter).
     - `AntiSpamService.computeWindowSeconds(): number` → `3600` (1h sliding window FR73).
     - `AntiSpamService.computeMaxMessagesInWindow(senderRole: ParticipantRole, isReplyAwaiting: boolean): number` → si `isReplyAwaiting === true` (le sender a déjà envoyé sans réponse) ET role !== `'system'` → `3` (FR73 strict). Si `system` → `Infinity` (bypass — notifs auto bookings).
     - `AntiSpamService.shouldResetCounter(lastSenderActorId: ActorId, currentSenderActorId: ActorId): boolean` → `true` si **les rôles s'inversent** (i.e., le current sender est le recipient du précédent message → reply détecté), `false` sinon (FR73 reset on reply).
   - **Spec coverage NFR71 ≥ 80%** : 8+ tests (computeRateLimitKey stable + computeRateLimitKey order-sensitive + computeWindowSeconds = 3600 + system bypass + isReplyAwaiting=true cap 3 + isReplyAwaiting=false unlimited + shouldResetCounter on role swap + shouldResetCounter false on same sender).

6. **AC6 — Exception hierarchy avec `tukioCode`** : `apps/messaging-svc/src/domain/exception/` :
   - `messaging.exception.ts` : `export abstract class MessagingException extends DomainException` (import `DomainException` depuis `@tukio/contracts/exceptions/domain`) → expose abstract `tukioCode: string`, `httpStatus: number`, `title: string`. Pattern strict identity-svc.
   - `messaging-not-found.exception.ts` : `MessagingNotFoundException` → `tukioCode = 'MESSAGING-NOT-FOUND-001'`, `httpStatus = 404`, `title = 'Conversation or message not found'`.
   - `messaging-invalid-content.exception.ts` : `tukioCode = 'MESSAGING-INVALID-CONTENT-001'`, `httpStatus = 422`.
   - `messaging-forbidden.exception.ts` : `tukioCode = 'MESSAGING-FORBIDDEN-001'`, `httpStatus = 403`. Lancée si sender ∉ conversation.participants (ownership).
   - `messaging-rate-limited.exception.ts` : `tukioCode = 'MESSAGING-RATE-LIMITED-001'`, `httpStatus = 429`. Field `retryAfterSeconds: number` lu par `EnvelopeExceptionFilter` pour set header `Retry-After` (pattern Story 1.2c P4).
   - `messaging-conflict.exception.ts` : `tukioCode = 'MESSAGING-CONFLICT-001'`, `httpStatus = 409`. Lancée si `booking.requested.v1` consumed deux fois sur le même `bookingId` (UNIQUE constraint hit Postgres 23505).
   - `messaging-external.exception.ts` : `tukioCode = 'MESSAGING-EXTERNAL-001'`, `httpStatus = 502`. Lancée par `RedisRateLimitAdapter` / `R2StorageAdapter` quand le service tiers est down ou throw post-retry.
   - Chaque exception **publique** (export) → spec test minimal qui vérifie `tukioCode`, `httpStatus`, `name`, message.

7. **AC7 — `CreateConversationFromBookingUseCase` FULL impl** : `apps/messaging-svc/src/usecases/create-conversation-from-booking.usecase.ts` :
   - **Pure class** (pas de `@Injectable()`), constructor inject 4 ports + 2 helpers :
     ```ts
     constructor(
       private readonly conversationRepo: IConversationRepository,
       private readonly logger: ILogger,
       private readonly now: () => Date = () => new Date(),
       private readonly newUuid: () => string = () => randomUUID(),
     ) {}
     ```
     L'`eventPublisher` n'est PAS injecté ici — il est invoqué via `txn.eventPublisher` dans `conversationRepo.runInTransaction()` (outbox atomicity pattern identity-svc).
   - **Méthode `execute(input: CreateConversationFromBookingInput): Promise<CreateConversationFromBookingResult>`** :
     - `input` : `{ bookingId: string, customerActorId: string, proActorId: string, locale: 'fr' | 'en', correlationId: string }`.
     - **Step 1** : `existing = await conversationRepo.findByBookingId(bookingId)`. Si existant → log warning "duplicate booking.requested.v1 consumed" + retourne `{ conversationId: existing.id }` (idempotent ack — Phasetwo-like behavior réutilise Story 1.10 pattern).
     - **Step 2** : `conversation = Conversation.createFromBooking({ bookingId, customerActorId, proActorId, locale, now: this.now(), id: ConversationId.create(this.newUuid()) })`.
     - **Step 3** : `await conversationRepo.runInTransaction(async (txn) => { txn.conversationRepo.save(conversation); txn.eventPublisher.publish(this.buildConversationCreatedEvent(conversation, input.correlationId)); })`.
     - **Step 4** : Catch Postgres `code === '23505'` (UNIQUE violation sur `conversations.booking_id`) → throw `MessagingConflictException('MESSAGING-CONFLICT-001', 'Booking already linked to a conversation')`. Le consumer InboxConsumer (AC11) catch et **ack** sans retry (race-safe : un autre worker l'a déjà créée).
     - **Step 5** : metric `conversations_created_total.inc({ outcome: 'created' | 'duplicate' })`.
   - **`buildConversationCreatedEvent()`** private helper retourne un `ConversationCreatedV1` event typé (cf. AC18), `correlationId` propagé depuis le `booking.requested.v1` consumer.
   - **Spec coverage NFR71 ≥ 70%** : 8+ tests (happy creates + duplicate booking idempotent return existing + same actorId throws + Postgres 23505 race → MessagingConflictException + outbox publish called inside txn + correlationId propagated to event + custom now/uuid injected for determinism + logger called on duplicate).

8. **AC8 — TypeORM entities + 3 migrations** :

   **`conversations` table** (`1715300000000-CreateConversationsTable.ts`) :
   ```sql
   CREATE TABLE "conversations" (
     "id" UUID PRIMARY KEY,
     "booking_id" UUID NOT NULL,
     "customer_actor_id" UUID NOT NULL,
     "pro_actor_id" UUID NOT NULL,
     "locale" VARCHAR(5) NOT NULL DEFAULT 'fr' CHECK ("locale" IN ('fr','en')),
     "last_message_at" TIMESTAMPTZ NULL,
     "customer_unread" INT NOT NULL DEFAULT 0 CHECK ("customer_unread" >= 0),
     "pro_unread" INT NOT NULL DEFAULT 0 CHECK ("pro_unread" >= 0),
     "status" VARCHAR(20) NOT NULL DEFAULT 'active' CHECK ("status" IN ('active','archived')),
     "archived_at" TIMESTAMPTZ NULL,
     "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
   );
   CREATE UNIQUE INDEX "uq_conversations_booking_id" ON "conversations" ("booking_id"); -- 1:1 booking strict
   CREATE INDEX "idx_conversations_customer_actor_id_last_message_at" ON "conversations" ("customer_actor_id", "last_message_at" DESC NULLS LAST);
   CREATE INDEX "idx_conversations_pro_actor_id_last_message_at" ON "conversations" ("pro_actor_id", "last_message_at" DESC NULLS LAST);
   ```

   **`messages` table** (`1715310000000-CreateMessagesTable.ts`) :
   ```sql
   CREATE TABLE "messages" (
     "id" UUID PRIMARY KEY,
     "conversation_id" UUID NOT NULL REFERENCES "conversations"("id") ON DELETE RESTRICT,
     "sender_actor_id" UUID NOT NULL,
     "content" TEXT NOT NULL CHECK (char_length("content") BETWEEN 1 AND 4000),
     "kind" VARCHAR(10) NOT NULL DEFAULT 'user' CHECK ("kind" IN ('user','system')),
     "sent_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     "delivered_at" TIMESTAMPTZ NULL,
     "read_at" TIMESTAMPTZ NULL,
     "is_anonymized" BOOLEAN NOT NULL DEFAULT FALSE,
     "anonymized_at" TIMESTAMPTZ NULL
   );
   CREATE INDEX "idx_messages_conversation_id_sent_at" ON "messages" ("conversation_id", "sent_at" DESC);
   CREATE INDEX "idx_messages_unread" ON "messages" ("conversation_id", "read_at") WHERE "read_at" IS NULL;
   ```

   **`message_archive_index` table** (`1715320000000-CreateMessageArchiveIndexTable.ts`) :
   ```sql
   CREATE TABLE "message_archive_index" (
     "id" UUID PRIMARY KEY,
     "message_id" UUID NOT NULL,                    -- ref logique uniquement (message peut être deleted post-5y)
     "conversation_id" UUID NOT NULL,
     "r2_bucket" VARCHAR(64) NOT NULL,
     "r2_object_key" VARCHAR(512) NOT NULL,
     "r2_sha256" VARCHAR(64) NOT NULL,              -- integrity check Story 5.3
     "archived_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     "original_sent_at" TIMESTAMPTZ NOT NULL,
     "byte_size" BIGINT NOT NULL
   );
   CREATE INDEX "idx_message_archive_index_message_id" ON "message_archive_index" ("message_id");
   CREATE INDEX "idx_message_archive_index_conversation_id_original_sent_at" ON "message_archive_index" ("conversation_id", "original_sent_at" DESC);
   ```

   **`outbox` + `inbox` baseline** (`1715330000000-AddOutboxInboxTables.ts`) : copie EXACTE de `apps/identity-svc/src/infrastructure/persistence/typeorm/migrations/1715210000000-AddOutboxInboxTables.ts` (mêmes 2 tables + trigger `notify_outbox_new()` + index partial — Story 0.7 baseline réutilisé verbatim).

   **`index.ts`** : `export const ALL_MIGRATIONS = [CreateConversationsTable, CreateMessagesTable, CreateMessageArchiveIndexTable, AddOutboxInboxTables]` (ordre strict — FK messages → conversations).

   **Entities TypeORM** : 3 fichiers `<name>.entity.ts` avec `@Entity({ name: 'conversations' })`, etc. Colonnes snake_case, decorateurs `@PrimaryColumn()`, `@Column({ type: 'varchar', length: 5 })`, `@Index(...)`, `@CreateDateColumn()`, `@UpdateDateColumn()`. **Tests integration testcontainer Postgres** : 3 fichiers `<entity>.entity.integration.spec.ts` qui vérifient roundtrip insert + read + unique constraint hit + check constraint hit.

9. **AC9 — `RedisRateLimitAdapter` (skeleton API + integration test)** : `apps/messaging-svc/src/infrastructure/external/redis/redis-rate-limit.adapter.ts` :
   - **Implements `IRateLimitPort`** port (`domain/ports/rate-limit.port.ts`) :
     ```ts
     export interface IRateLimitPort {
       /**
        * Atomic INCR + EXPIRE via Lua script (single round-trip).
        * Returns the resulting counter value AFTER increment.
        * Throws MessagingExternalException if Redis is unreachable post-retry.
        */
       incrementAndCheck(key: string, windowSeconds: number, maxCount: number): Promise<{ count: number; retryAfterSeconds: number | null }>;
       reset(key: string): Promise<void>;
     }
     ```
   - **ioredis** import `import Redis from 'ioredis'`. Config via `IConfigService.getRedisUrl()`.
   - **Lua script atomic** (chargé via `redis.defineCommand('incrAndExpire', { lua, numberOfKeys: 1 })`) — garantit anti-race entre `INCR` et `EXPIRE` :
     ```lua
     local current = redis.call('INCR', KEYS[1])
     if current == 1 then
       redis.call('EXPIRE', KEYS[1], ARGV[1])
     end
     local ttl = redis.call('TTL', KEYS[1])
     return { current, ttl }
     ```
   - **Retry** : ioredis `maxRetriesPerRequest: 3`, `retryStrategy: (times) => Math.min(times * 1000, 5000)`. Si toutes les tentatives échouent → catch + throw `MessagingExternalException('MESSAGING-EXTERNAL-001', 'Redis unreachable', { cause: e })`.
   - **Story 5.1 LIVE l'adapter + un seul test smoke** ; la consommation effective dans `send-message.usecase` est faite **Story 5.3**.
   - **Integration spec testcontainer** : `redis-rate-limit.adapter.integration.spec.ts` — 4 cas (1ère incr → count=1, ttl=3600 ; 2e incr same key → count=2 ; key TTL n'est PAS reset au 2e INCR ; reset() supprime la key).

10. **AC10 — `R2StorageAdapter` (skeleton API + integration test)** : `apps/messaging-svc/src/infrastructure/external/r2/r2-storage.adapter.ts` :
    - **Implements `IR2StoragePort`** port :
      ```ts
      export interface IR2StoragePort {
        upload(params: { bucket: string; key: string; body: Buffer; contentType: string; sha256: string }): Promise<{ etag: string; versionId?: string }>;
        delete(bucket: string, key: string): Promise<void>;
      }
      ```
    - **SDK** : `import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'`. Config R2 via `IConfigService.getR2Config()` (endpoint, accessKeyId, secretAccessKey, region='auto').
    - **SSE-S3 server-side encryption** : `PutObjectCommand` inclut `ServerSideEncryption: 'AES256'`.
    - **Multipart upload pour body > 5 MB** : utilise `@aws-sdk/lib-storage` `Upload` class avec `partSize: 5 * 1024 * 1024`. Story 5.1 livre l'API, Story 5.3 finalise l'archive 5y.
    - **Retry** : `@aws-sdk/middleware-retry` configuré `maxAttempts: 3`. Catch → `MessagingExternalException`.
    - **Pas de DELETE dans Story 5.1** (la rétention 5y supprime du DB chaud + archive R2 ; la DELETE R2 reste rare — Story 5.3 décidera si on supprime aussi de R2 après 10y RGPD-purge ou si on garde indéfiniment chiffré).
    - **Integration spec testcontainer LocalStack** : `r2-storage.adapter.integration.spec.ts` — 2 cas (upload 1 KB buffer happy + integrity verify via re-fetch + sha256 match).

11. **AC11 — `BookingRequestedConsumerHandler` NATS InboxConsumer Story 0.7 pattern** : `apps/messaging-svc/src/infrastructure/messaging/nats/consumers/booking-requested-consumer.handler.ts` :
    - **NestJS service** `@Injectable()` qui souscrit au stream NATS `TUKIO_BOOKING` consumer durable `messaging-svc-booking-requested` (Story 0.7 `NatsJetStreamClient` pattern).
    - **`onModuleInit()`** : subscribe via `jsm.consumers.get('TUKIO_BOOKING', 'messaging-svc-booking-requested')` → infinite loop `for await (const msg of consumer.consume()) { ... }`.
    - **Pour chaque message** :
      1. Parse JSON `BookingRequestedV1` (cf. `@tukio/contracts/events/booking/booking-requested.v1.ts`).
      2. Délègue à `InboxConsumer.handle(jsMsg, async (event) => { ... }, supportedVersions: ['v1'])` (idempotence inbox-level Story 0.7).
      3. Inside handler : invoke `createConversationFromBookingUseCaseProxy.getInstance().execute({ bookingId: event.payload.bookingId, customerActorId: event.payload.customerId, proActorId: event.payload.proId, locale: event.payload.locale ?? 'fr' /* fallback if absent */, correlationId: event.correlationId })`.
      4. Catch `MessagingConflictException` → log warn + `jsMsg.ack()` (race-safe, autre worker l'a créée). Catch autres exceptions → re-throw (laisse InboxConsumer faire le `jsMsg.nak()` avec backoff exponential Story 0.7 [30s, 60s, 120s, 300s, 600s], puis DLQ).
    - **NOTE** : `BookingRequestedV1Payload` actuel (cf. `packages/contracts/src/events/booking/booking-requested.v1.ts:4-11`) n'a PAS de champ `locale` — **flag dans Change Log** + fallback `'fr'` dans le consumer. Story 5.1 livre une **PR addendum** sur `@tukio/contracts` pour ajouter `locale: Locale` au payload `BookingRequestedV1` (bump pas requis car backwards-compatible — champ optional côté TS, NULLable côté schema JSON validation). Booking-svc Story 4.1 devra populer ce champ lors de la création (handoff documenté).
    - **Integration spec** : `booking-requested-consumer.integration.spec.ts` testcontainer NATS + Postgres — publie un `booking.requested.v1` synthétique → vérifie conversation row insérée + outbox row `messaging.conversation.created.v1` créée.

12. **AC12 — 4 `prom-client` metrics module-level** : `apps/messaging-svc/src/infrastructure/metrics/messaging.metrics.ts` :
    ```ts
    import { Counter, Histogram } from 'prom-client';
    
    export const conversationsCreatedTotal = new Counter({
      name: 'messaging_conversations_created_total',
      help: 'Conversations created via booking.requested.v1 consumer',
      labelNames: ['outcome'] as const,  // 'created' | 'duplicate'
    });
    
    export const bookingConsumerProcessedTotal = new Counter({
      name: 'messaging_booking_consumer_processed_total',
      help: 'booking.requested.v1 messages processed by inbox consumer',
      labelNames: ['outcome'] as const,  // 'success' | 'duplicate' | 'failed'
    });
    
    export const bookingConsumerDurationSeconds = new Histogram({
      name: 'messaging_booking_consumer_duration_seconds',
      help: 'Time to process one booking.requested.v1 message',
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
    });
    
    export const outboxRelayPendingGauge = new Counter({
      name: 'messaging_outbox_relay_pending_total',
      help: 'Pending outbox rows snapshot (set by OutboxRelayService Story 0.7)',
      labelNames: ['status'] as const,  // 'pending' | 'failed'
    });
    ```
    - **Module-level singleton** (pas dans un `@Injectable()` constructor) — pattern Story 0.6 anti-double-registration (`prom-client` throws si nom dupliqué).
    - **Exposés via `GET /metrics`** géré par module Story 0.6 baseline (à confirmer — sinon, MVP : metrics scraped via Pino logs structured, future Story 4.13 baseline).

13. **AC13 — `UseCasesProxyModule` central wiring 6 PROXY tokens** : `apps/messaging-svc/src/infrastructure/usecases-proxy/usecases-proxy.module.ts` :
    - `@Module({})` static `register(): DynamicModule` `global: true`.
    - **6 static string tokens** :
      - `CREATE_CONVERSATION_FROM_BOOKING_USECASES_PROXY` (FULL Story 5.1)
      - `SEND_MESSAGE_USECASES_PROXY` (SKELETON Story 5.3)
      - `MARK_MESSAGE_AS_READ_USECASES_PROXY` (SKELETON Story 5.2)
      - `LIST_CONVERSATIONS_USECASES_PROXY` (SKELETON Story 5.2)
      - `GET_CONVERSATION_MESSAGES_USECASES_PROXY` (SKELETON Story 5.2)
      - `PURGE_OLD_MESSAGES_USECASES_PROXY` (SKELETON Story 5.3)
    - Chaque `provide` a un `useFactory: (...ports) => new UseCaseProxy(new UseCase(...))` avec `inject: [PORT_TOKENS]` tirés de `domain/ports/tokens.ts`.
    - **Symbol DI tokens** dans `domain/ports/tokens.ts` (pattern identity-svc) :
      - `CONVERSATION_REPOSITORY`, `MESSAGE_REPOSITORY`, `MESSAGE_ARCHIVE_INDEX_REPOSITORY`, `RATE_LIMIT_PORT`, `R2_STORAGE_PORT`, `EVENT_PUBLISHER`, `LOGGER`, `CONFIG_SERVICE` — tous `Symbol(...)` (NOT `Symbol.for(...)`, unicité absolue).
    - **6 tokens exportés** via `exports: [...]` du `DynamicModule`.
    - **Spec** : `usecases-proxy.module.spec.ts` — 1 test "module register provides 6 tokens" + 1 test "each proxy resolves to UseCaseProxy instance with valid usecase".

14. **AC14 — Lint boundaries strict + fixture négative** :
    - **`eslint.config.mjs` root** : étendre le bloc `boundaries` avec un nouveau scope `messaging-svc` (cf. config existante identity-svc). Pattern :
      ```js
      {
        from: 'apps/messaging-svc/src/domain/**',
        disallow: ['@nestjs/*', 'typeorm', '@nestjs/typeorm', 'axios', 'ioredis', '@aws-sdk/*', 'pino', 'rxjs', '@tukio/messaging', '@tukio/auth'],
      }
      ```
    - **Test fixture négatif** : `apps/messaging-svc/test/__fixtures__/bad-domain-import.ts` contient un fichier sous `domain/` qui importe `@nestjs/common` — un script CI dédié (`pnpm --filter=messaging-svc lint:boundaries:negative`) le lint et **fail si exit code === 0** (i.e., fixture doit déclencher l'erreur ; si lint passe, la boundary règle ne marche plus → fail CI). Script bash :
      ```bash
      #!/bin/bash
      if pnpm eslint apps/messaging-svc/test/__fixtures__/bad-domain-import.ts 2>&1 | grep -q "Pattern Pretre violation"; then
        echo "✅ Boundary rule fires correctly on bad-domain-import fixture"
        exit 0
      else
        echo "🚫 Boundary rule did NOT fire — Pattern Pretre purity at risk"
        exit 1
      fi
      ```
    - **Custom rule `tukio/pretre-domain-purity`** (Story 1.10 baseline) : si déjà implémentée pour identity-svc, étendre la liste de scopes ; sinon, fallback `eslint-plugin-boundaries` suffit pour Story 5.1.

15. **AC15 — Bootstrap + DB + tests E2E happy path** :
    - **`apps/messaging-svc/src/main.ts`** : copie strict identity-svc (`FastifyAdapter`, `bufferLogs: true`, `app.register(multipart, ...)` pour future Story 5.x attachments V1+ (pas utilisé en MVP — laisser config commentée TODO V1), `ResponseEnvelopeInterceptor`, `EnvelopeExceptionFilter`, `ZodValidationPipe`, `enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })`, `app.useLogger(app.get<LoggerService>(LOGGER))`, `app.listen(port, '0.0.0.0')`.
    - **`apps/messaging-svc/src/app.module.ts`** : `TypeOrmModule.forRootAsync(...)` avec **CRITICAL** `entities: [ConversationEntity, MessageEntity, MessageArchiveIndexEntity, OutboxEntity, InboxEntity]` (les 5 entités — Story 1.2b P1 critical pattern : entité absente → runtime `EntityMetadataNotFoundError`). `migrations: ALL_MIGRATIONS`, `migrationsRun: true`, `synchronize: false`. `TukioAuthModule.forRootAsync(...)` (KeycloakJwtGuard global). `UseCasesProxyModule.register()`. `HttpModule`, `ConsumersModule`, `SchedulingModule`, `MetricsModule`.
    - **`apps/messaging-svc/Dockerfile`** : déjà existant, port 4006 — vérifier qu'il pointe `pnpm --filter=messaging-svc build`. Pas de modif requise (Dockerfile généré par `infra/scripts/gen-dockerfiles.sh` Sprint 0).
    - **`docker-compose.yml` racine** : ajouter service `messaging-svc` (port 4006, depends_on: postgres + nats + redis, healthcheck `curl http://localhost:4006/health`). Pattern réutilisé identity-svc.
    - **`scripts/bootstrap-databases.sh`** : ajouter `CREATE DATABASE tukio_messaging` (pattern existant identity-svc → catalog-svc → booking-svc).
    - **`apps/messaging-svc/test/conversation-created.e2e-spec.ts`** : testcontainer Postgres + NATS, scenario :
      1. Boot mini-NestJS app via `build-test-app.ts` helper.
      2. Publish synthetic `booking.requested.v1` event sur NATS (via `@tukio/messaging` `OutboxPublisher` test fixture).
      3. Attendre 2 sec (consumer poll loop).
      4. Query DB `SELECT * FROM conversations WHERE booking_id = $1` → assert 1 row avec bons participants.
      5. Query DB `SELECT * FROM outbox WHERE event_type = 'messaging.conversation.created.v1'` → assert 1 row.
      6. Cleanup containers.
    - **`apps/messaging-svc/test/health.e2e-spec.ts`** : `GET /health` → 200 + envelope `{ method: 'GET', code: 200, data: { status: 'ok' }, meta: { ... } }`.

16. **AC16 — `app.module.ts` final wiring (la pièce centrale)** : référence ligne par ligne au pattern identity-svc :

    ```ts
    @Module({
      imports: [
        ConfigurationModule,
        LoggerModule,
        TukioAuthModule.forRootAsync({
          inject: [EnvironmentConfigService],
          useFactory: (config: EnvironmentConfigService) => ({
            keycloakUrl: config.getKeycloakConfig().url,
            realm: config.getKeycloakConfig().realm,
            clientId: config.getKeycloakConfig().clientId,
            audience: config.getKeycloakConfig().audience,
            jwksRefreshIntervalMs: 600_000,
          }),
        }),
        UseCasesProxyModule.register(),
        TypeOrmModule.forRootAsync({
          imports: [ConfigurationModule],
          inject: [CONFIG_SERVICE],
          useFactory: (config: IConfigService) => ({
            type: 'postgres' as const,
            ...config.getDatabaseConfig(),
            entities: [
              ConversationEntity,
              MessageEntity,
              MessageArchiveIndexEntity,
              OutboxEntity,
              InboxEntity,
            ],
            migrations: ALL_MIGRATIONS,
            migrationsRun: true,
            synchronize: false,
            logging: ['error', 'warn', 'migration'],
          }),
        }),
        HttpModule,
        ConsumersModule,        // BookingRequestedConsumerHandler
        SchedulingModule,       // purge-old-messages.task
        MetricsModule,
      ],
      providers: [
        { provide: APP_GUARD, useClass: KeycloakJwtGuard },
      ],
    })
    export class AppModule {}
    ```

    **Note `OutboxEntity` + `InboxEntity`** : importer depuis `@tukio/messaging/outbox/entity` et `@tukio/messaging/inbox/entity` (pattern identity-svc `app.module.ts:14`).

17. **AC17 — env vars `.env.example` + Zod env.schema.ts** : `apps/messaging-svc/.env.example` étendre depuis baseline existant (cf. fichier actuel Story 0.10) :
    ```env
    NODE_ENV=development
    SERVICE_NAME=messaging-svc
    SERVICE_VERSION=0.0.0
    PORT=4006
    LOG_LEVEL=info
    
    # Postgres
    DB_HOST=localhost
    DB_PORT=5432
    DB_USER=tukio
    DB_PASSWORD=tukio_dev_password
    DB_NAME=tukio_messaging
    
    # Keycloak (réutilise realm identity-svc)
    KEYCLOAK_URL=http://localhost:8080
    KEYCLOAK_REALM=tukio
    KEYCLOAK_CLIENT_ID=tukio-api
    KEYCLOAK_AUDIENCE=tukio-api
    
    # NATS JetStream
    NATS_URL=nats://localhost:4222
    NATS_STREAM_NAME=TUKIO_MESSAGING
    NATS_REPLICAS=1
    NATS_BOOKING_CONSUMER_NAME=messaging-svc-booking-requested
    
    # Redis (rate limiting FR73 — Story 5.3 finalise consumer)
    REDIS_URL=redis://localhost:6379
    
    # Cloudflare R2 (archive 5y — Story 5.3 finalise upload)
    R2_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com
    R2_ACCESS_KEY_ID=
    R2_SECRET_ACCESS_KEY=
    R2_REGION=auto
    R2_MESSAGES_ARCHIVE_BUCKET=tukio-messages-archive-staging
    ```
    **`env.schema.ts`** : Zod `z.object({ NODE_ENV, PORT (coerce.number().int().positive()), DB_*, KEYCLOAK_*, NATS_*, REDIS_URL, R2_* })` — pattern identity-svc strict.

18. **AC18 — 6 nouveaux NATS event schemas sous `@tukio/contracts/events/messaging/`** :

    | File | Status Story 5.1 | Emis par | Schema fields |
    |------|------------------|----------|---------------|
    | `conversation-created.v1.ts` | **FULL émis** | `CreateConversationFromBookingUseCase` | `{ conversationId, bookingId, customerActorId, proActorId, locale, createdAt }` |
    | `message-sent.v1.ts` | **STUB** (type only, pas émis) | Story 5.3 finalise | `{ conversationId, messageId, senderActorId, sentAt, kind }` — **AUCUN `content`** (NFR82 audit strict, content reste DB-only) |
    | `message-read.v1.ts` | STUB | Story 5.2 | `{ conversationId, messageId, readerActorId, readAt }` |
    | `messages-anonymized.v1.ts` | STUB | Story 5.3 (consumer `identity.user.deleted.v1`) | `{ userId, messagesCount, anonymizedAt }` |
    | `messages-purged.v1.ts` | STUB | Story 5.3 (cron purge) | `{ olderThan, archivedCount, deletedCount }` |
    | `purge-failure.v1.ts` | STUB | Story 5.3 (alert) | `{ olderThan, errorMessage, occurredAt }` |

    **Pattern fichier** (strict `@tukio/contracts/events/identity/user-registered.v1.ts:1-29`) :
    ```ts
    import type { DomainEvent } from '../../types/DomainEvent.js';
    import type { Locale } from '../../types/Locale.js';
    
    export interface ConversationCreatedV1Payload {
      conversationId: string;
      bookingId: string;
      customerActorId: string;
      proActorId: string;
      locale: Locale;
      createdAt: string;
    }
    
    export type ConversationCreatedV1 = DomainEvent<ConversationCreatedV1Payload> & {
      eventType: 'messaging.conversation.created.v1';
      eventVersion: 'v1';
      aggregate: { type: 'conversation'; id: string };
    };
    
    export const CONVERSATION_CREATED_V1_TYPE = 'messaging.conversation.created.v1' as const;
    ```
    + 1 fichier `.schema.json` JSON Schema correspondant (cf. existing `packages/contracts/src/events/identity/user-registered.v1.schema.json` pour structure) — pour validation runtime côté consumers + documentation OpenAPI.
    
    **5 STUB events** : juste le `.ts` typé, pas de `.schema.json` (Stories 5.2/5.3 ajouteront le JSON Schema quand elles émettront).
    
    **README addendum** : update `packages/contracts/README.md` section "Messaging events" (création section si absente) avec table des 6 events + statut MVP/V1+.

19. **AC19 — Lint + typecheck + coverage CI strict** :
    - `pnpm --filter=messaging-svc lint` → **0 erreurs**, **0 warnings** (strict boundaries).
    - `pnpm --filter=messaging-svc typecheck` → 0 erreurs.
    - `pnpm --filter=messaging-svc test --coverage` → coverage CI gates **80% domain, 70% usecases, 50% infrastructure** (NFR71 ; CI fail-fast cf. Story 1.10 baseline). Fichiers SKELETON (use cases 5.2/5.3) **exclus du coverage path** via `coveragePathIgnorePatterns` car non implémentés Story 5.1.
    - `pnpm --filter=@tukio/contracts test` → 6 nouveaux event schema tests verts (existence type export + `eventType` constant correct).
    - Test fixture négatif `__fixtures__/bad-domain-import.ts` provoque `lint:boundaries:negative` exit code 1.

20. **AC20 — `runbook-messaging-svc-bootstrap.md` + ADR-001 Implementation Notes update** :
    - **NEW runbook** `docs/runbooks/messaging-svc-bootstrap.md` (~80 lignes) :
      - Section 1 : Démarrage local (`pnpm docker:up:wait` → `pnpm --filter=messaging-svc dev` → `curl http://localhost:4006/health`).
      - Section 2 : DB init (CREATE DATABASE tukio_messaging si pas via bootstrap-databases.sh, migrations auto via TypeORM `migrationsRun: true`).
      - Section 3 : NATS streams provisioning (`pnpm nats:streams:up` Story 0.7 baseline étend stream `TUKIO_MESSAGING`).
      - Section 4 : Smoke test booking.requested.v1 (commande `pnpm tukio:events:publish booking.requested.v1 --payload=...` test helper Story 0.7) → check DB `psql tukio_messaging -c "SELECT * FROM conversations"`.
      - Section 5 : Troubleshooting (consumer lag > 1000 → restart, OutboxRelayService PG LISTEN/NOTIFY check `SELECT * FROM pg_listening_channels`).
      - Section 6 : Rollback procedure (rollback dernière migration `pnpm --filter=messaging-svc migration:revert`, stop docker service).
    - **ADR-001 Implementation Notes** : add bullet "Story 5.1 — 2e application canonique Pattern Pretre dans messaging-svc, identique en structure à identity-svc Story 1.10. Confirme la viabilité du pattern pour services event-driven (Conversation aggregate 1:1 Booking, anti-spam pure domain, R2 + Redis adapters infra)."
    - **`project-context.md`** (généré Story 0.13) : append section "Messaging-svc (Epic 5 kick-off)" → résume use cases livrés (1 FULL + 5 SKELETON), tables DB (3 + outbox/inbox), NATS events (1 émis + 5 STUB), adapters externes (Redis Lua atomic + R2 SSE-S3), prochaines stories Epic 5 dépendantes (5.2 thread UI, 5.3 send + retention, 5.4 notification Pretre s'inspire).
    - **`AGENTS.md` hard rules** : append "2e référence canonique Pattern Pretre : `apps/messaging-svc`. Si un dev/IA hésite entre identity-svc et messaging-svc comme template, identity-svc reste la **référence finale** (audit Epic 1 close-out Story 1.10), messaging-svc est la **première réplique** (validation du pattern)."

## Tasks / Subtasks

- [ ] **Task 1 — Scaffold arborescence Pretre + fichiers vides** (AC: #1)
  - [ ] 1.1 Créer 4 dossiers domain (`model/`, `ports/`, `service/`, `exception/`)
  - [ ] 1.2 Créer `usecases/` avec 6 fichiers `.ts` + 6 `.spec.ts` (SKELETONS marquées TODO Story X.Y dans header)
  - [ ] 1.3 Créer arborescence `infrastructure/` complète (10 sous-dossiers cf AC1)
  - [ ] 1.4 Créer `test/__fixtures__/bad-domain-import.ts` + `test/helpers/build-test-app.ts` + `test/jest-e2e.json`
  - [ ] 1.5 Valider arborescence via `tree apps/messaging-svc/src -L 3` comparé à AC1

- [ ] **Task 2 — Domain layer FULL** (AC: #2, #3, #4, #5, #6)
  - [ ] 2.1 Implémenter `Conversation` aggregate + spec (12+ tests, ≥ 80%)
  - [ ] 2.2 Implémenter `Message` entity + spec (8+ tests)
  - [ ] 2.3 Implémenter 4 VOs (`ConversationId`, `MessageContent`, `Participant`, `ActorId` — décider local vs `@tukio/contracts`) + specs
  - [ ] 2.4 Implémenter `AntiSpamService` pure logic + spec (8+ tests)
  - [ ] 2.5 Implémenter 7 exceptions + specs (`tukioCode`, `httpStatus`, `title`)
  - [ ] 2.6 Implémenter 9 ports interfaces (`I*` prefix) + `domain/ports/tokens.ts` (8 Symbols)

- [ ] **Task 3 — Usecases layer** (AC: #7)
  - [ ] 3.1 Implémenter `CreateConversationFromBookingUseCase` FULL (.execute() + buildConversationCreatedEvent() + duplicate detection idempotent + 23505 → MessagingConflict)
  - [ ] 3.2 Spec FULL (8+ tests, ≥ 70%)
  - [ ] 3.3 Scaffolder 5 SKELETONS use cases avec `execute()` qui throw `new Error('TODO Story 5.X')` + JSDoc input/output types stricts. Spec minimal (1 smoke "throws TODO until Story 5.X").
  - [ ] 3.4 Exclure 5 SKELETONS du coverage path (`jest.config` `coveragePathIgnorePatterns`)

- [ ] **Task 4 — Infrastructure persistence TypeORM** (AC: #8, #15, #16)
  - [ ] 4.1 Créer 3 entities TypeORM + 1 spec integration testcontainer par entity
  - [ ] 4.2 Écrire 4 migrations (CreateConversations / CreateMessages / CreateMessageArchiveIndex / AddOutboxInboxTables — copier verbatim identity-svc/1715210000000)
  - [ ] 4.3 Index `migrations/index.ts` `ALL_MIGRATIONS`
  - [ ] 4.4 Implémenter 3 repositories TypeORM + 3 mappers bidirectional
  - [ ] 4.5 `typeorm-repositories.module.ts` + `data-source.ts` standalone CLI

- [ ] **Task 5 — Infrastructure external adapters** (AC: #9, #10)
  - [ ] 5.1 Implémenter `RedisRateLimitAdapter` (ioredis + Lua atomic) + integration spec testcontainer Redis (4 cas)
  - [ ] 5.2 Implémenter `R2StorageAdapter` (@aws-sdk/client-s3 + SSE-S3 + lib-storage multipart) + integration spec testcontainer LocalStack (2 cas)
  - [ ] 5.3 Ajouter `ioredis`, `@aws-sdk/client-s3`, `@aws-sdk/lib-storage` aux dépendances `apps/messaging-svc/package.json` (versions latest stable)
  - [ ] 5.4 Modules NestJS `redis.module.ts` + `r2.module.ts` (DynamicModule pattern identity-svc keycloak.module.ts)

- [ ] **Task 6 — NATS consumers + outbox infra** (AC: #11, #18)
  - [ ] 6.1 Créer 6 event files sous `packages/contracts/src/events/messaging/` (1 FULL + 5 STUB types-only) + 1 `.schema.json` pour `conversation-created.v1`
  - [ ] 6.2 Update `packages/contracts/README.md` section Messaging events
  - [ ] 6.3 Implémenter `BookingRequestedConsumerHandler` + integration spec testcontainer NATS + Postgres
  - [ ] 6.4 `consumers.module.ts` + `nats-publisher.module.ts` (wraps `@tukio/messaging` OutboxPublisher + OutboxRelayService + NatsJetStreamModule + CorrelationContextModule)
  - [ ] 6.5 **Addendum `@tukio/contracts`** : ajouter `locale?: Locale` à `BookingRequestedV1Payload` (backwards-compatible — flag PR dans Change Log + doc handoff booking-svc Story 4.1)

- [ ] **Task 7 — Metrics + scheduling + use cases proxy** (AC: #12, #13)
  - [ ] 7.1 Implémenter `messaging.metrics.ts` 4 prom-client module-level
  - [ ] 7.2 `metrics.module.ts` (exposer via `GET /metrics` si pattern Story 0.6 disponible, sinon TODO Story 4.13)
  - [ ] 7.3 Scaffolder `purge-old-messages.task.ts` `@Cron('0 4 1 * *')` SKELETON (invoke `purgeOldMessagesUseCaseProxy` qui throw TODO Story 5.3)
  - [ ] 7.4 `scheduling.module.ts` (`@nestjs/schedule` `ScheduleModule.forRoot()`)
  - [ ] 7.5 Implémenter `UseCasesProxyModule` 6 PROXY tokens + spec module register

- [ ] **Task 8 — HTTP layer + bootstrap** (AC: #15, #16, #17)
  - [ ] 8.1 `health.controller.ts` (`@Public()` + GET `/health` → `{ status: 'ok' }`)
  - [ ] 8.2 Copy verbatim `envelope-exception.filter.ts` + `response-envelope.interceptor.ts` depuis identity-svc
  - [ ] 8.3 `http.module.ts` exporte HealthController
  - [ ] 8.4 `main.ts` Fastify bootstrap strict identity-svc pattern (multipart commenté TODO V1+, ZodValidationPipe, EnvelopeFilter, Interceptor, useLogger, listen 0.0.0.0:4006)
  - [ ] 8.5 `app.module.ts` wiring final (entities array 5 entries CRITICAL + ALL_MIGRATIONS + TukioAuthModule + KeycloakJwtGuard global + UseCasesProxyModule.register())
  - [ ] 8.6 `.env.example` + `env.schema.ts` Zod validation booting
  - [ ] 8.7 `configuration.module.ts` + `environment-config.service.ts` (IConfigService impl) — pattern identity-svc
  - [ ] 8.8 `logger.module.ts` + `pino-logger.service.ts` avec redact rules (NFR82 — `req.body.content`, `res.body.data.messages[*].content`, `meta.user.email`, `meta.user.phone`)

- [ ] **Task 9 — Lint boundaries + fixture négative** (AC: #14)
  - [ ] 9.1 Étendre `eslint.config.mjs` racine avec scope `messaging-svc` (FORBIDDEN_IN_DOMAIN list strict)
  - [ ] 9.2 Créer fixture `__fixtures__/bad-domain-import.ts` qui importe `@nestjs/common` depuis `domain/`
  - [ ] 9.3 Script `lint:boundaries:negative` bash + ajout à `package.json` scripts messaging-svc
  - [ ] 9.4 CI workflow `.github/workflows/ci.yml` step "messaging-svc boundaries negative test" qui fail si fixture passe le lint

- [ ] **Task 10 — Docker + DB bootstrap + e2e** (AC: #15, #19)
  - [ ] 10.1 Update `docker-compose.yml` racine : section messaging-svc (port 4006, depends_on, healthcheck, env vars)
  - [ ] 10.2 Update `scripts/bootstrap-databases.sh` : `CREATE DATABASE tukio_messaging`
  - [ ] 10.3 Update `scripts/setup-nats-streams.sh` (ou équivalent Story 0.7) : déclarer stream `TUKIO_MESSAGING` + consumer durable `messaging-svc-booking-requested`
  - [ ] 10.4 Écrire `test/conversation-created.e2e-spec.ts` testcontainer Postgres + NATS (6 steps cf AC15)
  - [ ] 10.5 Écrire `test/health.e2e-spec.ts` (envelope ADR-014 valide)
  - [ ] 10.6 Run `pnpm --filter=messaging-svc test:e2e` localement → green

- [ ] **Task 11 — Coverage NFR71 + lint + typecheck final** (AC: #19)
  - [ ] 11.1 Configurer `jest.config.js` coverage thresholds (domain 80/80/80/75, usecases 70/70/65/70, infrastructure 50/50/50/50)
  - [ ] 11.2 Run `pnpm --filter=messaging-svc test --coverage` → green ≥ thresholds
  - [ ] 11.3 Run `pnpm --filter=messaging-svc lint` → 0 errors / 0 warnings
  - [ ] 11.4 Run `pnpm --filter=messaging-svc typecheck` → 0 errors
  - [ ] 11.5 Run `pnpm --filter=@tukio/contracts test` → 6 new event tests green

- [ ] **Task 12 — Documentation + ADR + runbook** (AC: #20)
  - [ ] 12.1 NEW `docs/runbooks/messaging-svc-bootstrap.md` (6 sections cf AC20)
  - [ ] 12.2 ADR-001 Implementation Notes bullet ajouté (2e canonical Pretre)
  - [ ] 12.3 `_bmad-output/planning-artifacts/project-context.md` append section "Messaging-svc"
  - [ ] 12.4 `AGENTS.md` hard rules append bullet 2e canonical
  - [ ] 12.5 `apps/messaging-svc/README.md` update : run/build/test/migrations commands, link runbook bootstrap

- [ ] **Task 13 — Smoke validation locale + handoff** (AC: #15)
  - [ ] 13.1 `pnpm docker:up:wait` → 6 conteneurs up (postgres, nats, redis, keycloak, mailhog, meilisearch — selon stack actuelle)
  - [ ] 13.2 `pnpm --filter=messaging-svc dev` → boot port 4006 sans erreur, migrations run, NATS consumer subscribed
  - [ ] 13.3 `curl localhost:4006/health` → 200 envelope
  - [ ] 13.4 Publish synthetic `booking.requested.v1` via test helper Story 0.7 → check `conversations` row + outbox row
  - [ ] 13.5 Document smoke trace dans Dev Agent Record (correlationId, durations)
  - [ ] 13.6 Run `/check` (pnpm lint && pnpm typecheck && pnpm test) — full monorepo green

## Dev Notes

### Architecture patterns à appliquer

- **Pattern Pretre Clean Architecture** (ADR-001, architecture.md:569+, 1162+) : `domain/` framework-free → `usecases/` pure orchestration → `infrastructure/` adapters. `apps/identity-svc/` (Story 1.10) est la **référence canonique** ; cette story est la **2e application validation**.
- **Outbox + Inbox pattern** (ADR-007, Story 0.7) : zéro `nats.publish()` direct depuis use case. Toujours `txn.eventPublisher.publish()` dans `repo.runInTransaction()`. La règle `tukio/no-direct-event-publish` ESLint l'enforce.
- **Database per service** (ADR-003) : `tukio_messaging` DB dédiée, **aucun** join cross-svc. Pour récupérer le snapshot booking (Story 5.2 thread header), un futur consumer `booking.confirmed.v1` syncera un `booking_snapshot` JSONB dans `conversations` (Story 5.2 finalise — Story 5.1 ne livre PAS ce snapshot).
- **REST envelope canonique** (ADR-014) : `{ method, code, data | error, pagination?, meta }`. `EnvelopeExceptionFilter` + `ResponseEnvelopeInterceptor` globaux. Story 5.1 expose **uniquement `/health`** (pas de `/v1/conversations*` — Story 5.2 livre les forwarders gateway-api).
- **NATS event naming** (architecture.md:1117+) : `<domain>.<entity>.<verb>.v<n>`, lowercase, dots, kebab inside segments. Donc `messaging.conversation.created.v1`, `messaging.message.sent.v1` — **pas** `messaging.conversation-created.v1` (ne pas réutiliser le subject avec dash).
- **Versioning events** (ADR-011) : suffix `v1`, `v2`, coexistence pendant migration. JSON Schema versioned sous `@tukio/contracts/events/<domain>/<event>.v<n>.schema.json`.
- **AsyncLocalStorage TransactionContext** (Story 1.2b) : `OutboxPublisher` lit l'`EntityManager` courant via `TransactionContext.getEntityManager()`. `IConversationRepository.runInTransaction()` doit appeler `this.dataSource.transaction(manager => TransactionContext.run(manager, () => callback(txn)))`. Sans ça, le `OutboxPublisher` fallback sur `DataSource.manager` et l'INSERT outbox arrive HORS de la transaction métier → **désynchro outbox/aggregate** (data corruption silencieuse).
- **`forRoot.entities` array explicit** (Story 1.2b P1 CRITICAL) : ne PAS s'appuyer sur `autoLoadEntities: true` ; lister explicitement les 5 entities (`ConversationEntity`, `MessageEntity`, `MessageArchiveIndexEntity`, `OutboxEntity`, `InboxEntity`) dans `TypeOrmModule.forRootAsync`. Sinon runtime `EntityMetadataNotFoundError` à la première écriture outbox.
- **`single-quote` Symbols pour DI tokens** : `Symbol(...)` (NOT `Symbol.for(...)`) garantit l'unicité absolue cross-service (cf. identity-svc `domain/ports/tokens.ts`).
- **Pino redact paths NFR82** : `req.body.content`, `res.body.data.messages[*].content`, `meta.user.email`, `meta.user.phone`. **Aucun message content ne doit apparaître dans les logs** — la persistance DB + JSON Schema NATS event suffit pour la traçabilité (FR74 5y), mais les logs sont sous coupe `[REDACTED]` ([rationale](architecture.md:256+) + RGPD).
- **Test fixture négatif boundaries** (Story 1.10 baseline) : sans ce fichier, on ne peut pas garantir que la règle ESLint marche encore après un futur changement de config. C'est la **preuve vivante** que la purity domain est défendue.

### Source tree composants à toucher

| Fichier / dossier | Action |
|--|--|
| `apps/messaging-svc/src/` | scaffold complet — `~80 fichiers` (incl. tests) |
| `apps/messaging-svc/test/` | scaffold complet — `~5 fichiers + helpers + jest-e2e.json` |
| `apps/messaging-svc/.env.example` | EXTEND (depuis baseline Story 0.10) avec R2_* + NATS_BOOKING_CONSUMER_NAME |
| `apps/messaging-svc/package.json` | EXTEND dependencies (ioredis, @aws-sdk/client-s3, @aws-sdk/lib-storage, prom-client, @nestjs/typeorm, @nestjs/schedule, typeorm, pg, nestjs-zod, zod, @tukio/messaging, @tukio/auth, @tukio/contracts, @tukio/testing) — versions latest stable |
| `apps/messaging-svc/jest.config.ts` | NEW (copie identity-svc avec thresholds NFR71) |
| `apps/messaging-svc/tsconfig.json` | UPDATE extends `tsconfig.base.json` + `moduleResolution: bundler` |
| `apps/messaging-svc/eslint.config.mjs` | EXTEND scope boundaries Pretre |
| `packages/contracts/src/events/messaging/` | NEW dossier — 6 fichiers `.ts` + 1 fichier `.schema.json` |
| `packages/contracts/src/events/booking/booking-requested.v1.ts` | EXTEND add `locale?: Locale` field (backwards-compat) |
| `packages/contracts/README.md` | EXTEND section "Messaging events" |
| `eslint.config.mjs` (racine) | EXTEND scope messaging-svc (FORBIDDEN_IN_DOMAIN + tukio/pretre-domain-purity) |
| `docker-compose.yml` | EXTEND service messaging-svc |
| `scripts/bootstrap-databases.sh` | EXTEND `CREATE DATABASE tukio_messaging` |
| `scripts/setup-nats-streams.sh` | EXTEND stream `TUKIO_MESSAGING` + consumer `messaging-svc-booking-requested` |
| `docs/runbooks/messaging-svc-bootstrap.md` | NEW |
| `AGENTS.md` | EXTEND bullet 2e canonical Pretre |
| `_bmad-output/planning-artifacts/project-context.md` | EXTEND section Messaging-svc |
| `_bmad-output/planning-artifacts/architecture.md` | ADR-001 Implementation Notes append bullet |
| `.github/workflows/ci.yml` | EXTEND step `lint:boundaries:negative` messaging-svc |

### Testing standards résumé

- **Unit tests** (`.spec.ts`) co-localisés avec source. Coverage NFR71 : ≥ 80 % domain, ≥ 70 % usecases, ≥ 50 % infrastructure (CI fail-fast).
- **Integration tests** (`.integration.spec.ts`) co-localisés. Utilisent `@tukio/testing` helpers (`startPostgresContainer`, `startNatsContainer`, `startRedisContainer`, LocalStack pour R2). Run via `pnpm --filter=messaging-svc test:integration` (séparé de `test` par convention identity-svc).
- **E2E tests** sous `test/` avec `jest-e2e.json`. `test/helpers/build-test-app.ts` boot mini-NestJS app + mock Keycloak (nock) + real DB (testcontainer). Exécution requiert `docker:up:wait` (cf. accord Stories 1.2b-d : dev livre code + specs, Ismael run docker locally).
- **Fixture négative lint** (`__fixtures__/bad-domain-import.ts`) : importe `@nestjs/common` depuis `domain/` ; `pnpm lint:boundaries:negative` doit fail (exit 1). Script bash dédié.
- **Specs use cases SKELETONS** : 1 smoke test minimum "throws TODO Story 5.X" — fail-loud signal qu'ils n'ont pas été oubliés ; les VRAIS tests viendront avec Stories 5.2/5.3.
- **prom-client metrics tests** : pas de spec dédié (Story 0.6 baseline confirme tests inutiles sur counters ; integration spec consumer + usecase teste indirectement les `.inc()`).

### Pièges connus à éviter

1. **`forRoot.entities` array manquant** : Story 1.2b P1 CRITICAL — toujours lister les 5 entities explicitement.
2. **Symbol DI tokens** : utiliser `Symbol('NAME')`, pas `Symbol.for('NAME')` (unicité absolue requise).
3. **OutboxPublisher hors transaction** : si `txn.eventPublisher.publish()` est appelé hors `runInTransaction`, l'INSERT outbox arrive dans une 2e connexion DB → désynchro silencieuse. Toujours wrapper dans `repo.runInTransaction(async (txn) => { ... txn.eventPublisher.publish(event) ... })`.
4. **Postgres 23505 (UNIQUE violation)** : `conversations.booking_id` UNIQUE garantit 1:1 strict. Le consumer InboxConsumer catch et **ack** (race-safe deux workers consument le même `booking.requested.v1` simultanément).
5. **Message content jamais dans NATS event** (NFR82) : `MessageSentV1Payload` n'a aucun champ `content`. La traçabilité passe par DB + correlationId. Story 5.1 le pose comme convention dans le STUB.
6. **NATS subject naming** : `messaging.conversation.created.v1` avec **dots** entre `conversation` et `created`, pas `messaging.conversation-created.v1` (cf. architecture.md:1117+ convention).
7. **`@tukio/messaging` barrel** : 4 Symbol exports uniquement. Pour les types (OutboxEntity, InboxEntity, NatsJetStreamConfig), import via subpath `@tukio/messaging/outbox/entity`, `@tukio/messaging/inbox/entity`, etc.
8. **`@tukio/contracts` events sans Zod schema runtime** : pattern actuel = TS types + JSON Schema fichier. Pas de Zod parse runtime des events (validation côté consumer via `@tukio/messaging` `InboxConsumer.handle()` qui n'enforce pas le schema MVP). Story 5.1 doit respecter ce pattern, pas inventer une Zod-based validation.
9. **Boundaries scope étendu** : oublier d'étendre `eslint.config.mjs` racine = règle ne s'applique pas à messaging-svc → fixture négative ne fail pas → règle silencieusement broken. Vérifier explicitement.
10. **Redis Lua atomic obligatoire** : sans Lua, `INCR` puis `EXPIRE` séparés = race condition (compte stuck si crash entre les 2). Le Lua script `INCR + conditional EXPIRE` est l'**ONLY safe pattern** Redis pour sliding window counter (cf. Redis docs canonical pattern).

### Coordination cross-story

- **Story 4.1 `booking-svc` Pretre saga** : émet `booking.requested.v1`. **Handoff** : Story 5.1 ajoute `locale?: Locale` au payload (backwards-compat) ; Story 4.1 devra le populer. Si Story 4.1 n'est pas démarrée au moment du dev Story 5.1, le consumer Story 5.1 fallback `'fr'` (cf. AC11).
- **Story 5.2 (Conversation thread UI)** : consomme les forwarders gateway-api `/v1/conversations/*` qui n'existent PAS encore (Story 5.1 ne livre que `/health`). Story 5.2 livre les forwarders + les 4 use cases SKELETONS → FULL.
- **Story 5.3 (Send message + rate-limit + retention)** : SKELETONS `send-message.usecase`, `mark-message-as-read.usecase`, `purge-old-messages.usecase` → FULL. Consomme `RedisRateLimitAdapter` + `R2StorageAdapter` posés ici.
- **Story 5.4 (notification-svc Pretre)** : 3e référence canonique Pretre. **N'EST PAS BLOQUÉE** par Story 5.1, peut démarrer en parallèle (services indépendants), mais le pattern est validé ici.
- **Story 0.7 (`@tukio/messaging`)** : déjà done. Story 5.1 réutilise OutboxPublisher, OutboxRelayService, InboxConsumer, NatsJetStreamModule, CorrelationContextModule.
- **Story 1.10 (identity-svc Pretre)** : référence canonique. Story 5.1 réplique strict — toute déviation = flag dans Change Log avec justification.

### Project Structure Notes

- **Alignement strict** avec `apps/identity-svc/src/` (Story 1.10) : même arborescence à 4 niveaux, mêmes patterns de naming, mêmes conventions Symbol DI.
- **Pas de conflit** détecté avec architecture.md (toutes les sections messaging-svc évoquées sont **forward-looking specs** — pas de code existant à respecter sauf le scaffold Sprint 0).
- **Variance assumée** : `app.controller.ts` / `app.service.ts` / `app.controller.spec.ts` Sprint 0 doivent être **supprimés** (pas de pattern controller/service à la racine — tout passe par `http/controllers/health.controller.ts` + use case proxies). Documenter dans Change Log "remove scaffold Sprint 0 placeholder files".
- **`@tukio/messaging` event schema location** : `packages/contracts/src/events/messaging/` n'existe pas encore (vérifié — dossier vide). Story 5.1 le crée. Pas de risque collision avec un autre track.
- **Coordination i18n** (`AGENTS.md` bilingue FR/EN obligatoire) : messaging-svc n'a **AUCUN** texte user-visible (pas de UI, pas de template email — Story 5.4 livre les templates). Les messages d'exception (`'Invalid content'`, etc.) sont **techniques** (logs + envelope `error.detail`), pas user-facing — autorisés en anglais strict (cf. code-style.md "Language" section).

### References

- [Source: `_bmad-output/planning-artifacts/architecture.md`#1162-1209] Pattern Pretre arborescence exacte
- [Source: `_bmad-output/planning-artifacts/architecture.md`#569-588] ADR-001 Pattern Pretre rationale
- [Source: `_bmad-output/planning-artifacts/architecture.md`#631-660] ADR-007 Outbox/Inbox pattern + PG LISTEN/NOTIFY
- [Source: `_bmad-output/planning-artifacts/architecture.md`#1117-1130] NATS event naming convention
- [Source: `_bmad-output/planning-artifacts/architecture.md`#1253-1407] ADR-014 REST envelope canonique
- [Source: `_bmad-output/planning-artifacts/architecture.md`#1414-1502] UseCaseProxy pattern + EnvelopeExceptionFilter
- [Source: `_bmad-output/planning-artifacts/architecture.md`#714-721] ADR-002 NATS JetStream + ADR-011 versioning
- [Source: `_bmad-output/planning-artifacts/architecture.md`#1812-1831] NFR71 coverage thresholds CI gate
- [Source: `_bmad-output/planning-artifacts/prd.md`#1181-1188] FR67-74 + FR72 PII regex + FR73 rate limit + FR74 retention 5y
- [Source: `_bmad-output/planning-artifacts/prd.md`#1406] NFR71 coverage 80/70/50 fail-fast
- [Source: `_bmad-output/planning-artifacts/prd.md`#1423] NFR82 audit + messaging-svc deployment split
- [Source: `_bmad-output/planning-artifacts/epics.md`#1866-1890] Epic 5 + Story 5.1 raw spec
- [Source: `apps/identity-svc/src/main.ts:1-63`] Fastify bootstrap canonical
- [Source: `apps/identity-svc/src/app.module.ts:19-88`] AppModule wiring canonical (entities array CRITICAL)
- [Source: `apps/identity-svc/src/infrastructure/usecases-proxy/usecases-proxy.module.ts:1-126`] UseCasesProxyModule pattern
- [Source: `apps/identity-svc/src/domain/ports/tokens.ts:1-16`] Symbol DI tokens convention
- [Source: `apps/identity-svc/src/infrastructure/persistence/typeorm/migrations/1715210000000-AddOutboxInboxTables.ts:1-75`] Outbox + Inbox migrations template (copier verbatim)
- [Source: `apps/identity-svc/src/domain/model/user-profile.aggregate.ts:1-80`] Aggregate factory + props pattern canonical
- [Source: `packages/contracts/src/events/identity/user-registered.v1.ts:1-29`] Event TS type + constant pattern canonical
- [Source: `packages/contracts/src/events/booking/booking-requested.v1.ts:1-19`] Source event consommé par AC11
- [Source: `packages/messaging/src/outbox/outbox-publisher.ts`] OutboxPublisher API (Story 0.7)
- [Source: `packages/messaging/src/outbox/transaction-context.ts`] TransactionContext AsyncLocalStorage (Story 0.7)
- [Source: `packages/messaging/src/inbox/inbox-consumer.ts`] InboxConsumer.handle() pattern (Story 0.7)
- [Source: `packages/messaging/src/nats/nats-jetstream-client.ts`] NATS reconnect + retention config (Story 0.7)
- [Source: `packages/auth/src/guards/keycloak-jwt.guard.ts`] KeycloakJwtGuard pattern (global APP_GUARD)
- [Source: `_bmad-output/implementation-artifacts/1-10-identity-svc-pretre-implementation.md`] Référence canonique boundaries + audit_log baseline
- [Source: `_bmad-output/implementation-artifacts/0-6-pattern-pretre-scaffolding-template-identity-svc.md`] Pattern Pretre AC8 lint boundaries spec
- [Source: `_bmad-output/implementation-artifacts/0-7-setup-tukio-messaging-nats-jetstream.md`] @tukio/messaging baseline livrables

### Latest tech specifics

- **NestJS 11.x** + Fastify adapter (architecture stack lockée — `pnpm` packageManager ^10).
- **TypeORM 0.3.x** + Postgres 16 + `migrationsRun: true` idempotent.
- **`@nestjs/schedule` ^4** pour `@Cron` decorators (purge-old-messages task — Story 5.3 finalise).
- **`@aws-sdk/client-s3` ^3.700+** + `@aws-sdk/lib-storage` ^3.700+ — Cloudflare R2 S3-compatible.
- **`ioredis` ^5.x** — Redis client avec Lua script support (`defineCommand`).
- **`nats.js` ^2.x** (déjà dans `@tukio/messaging` — pas une dep directe messaging-svc).
- **`prom-client` ^15.x** — Prometheus metrics (module-level pattern Story 0.6 baseline).
- **`zod` ^3.x** + `nestjs-zod` ^4.x — `env.schema.ts` validation booting.
- **`pino` ^9.x** — structured logs + redact paths NFR82.
- **`testcontainers` ^10.x** + `@testcontainers/postgresql`, `@testcontainers/redis`, `@testcontainers/nats`, `@testcontainers/localstack` — déjà dans `@tukio/testing`.

### Sécurité

- **KeycloakJwtGuard global** : tout endpoint sous `apps/messaging-svc/` requiert JWT valide sauf `@Public()` (health). Story 5.1 expose seulement `/health` public.
- **Internal endpoints futurs** (Story 5.2 expose `POST /internal/conversations/messages` consumed par gateway-api) : guarded par `InternalServiceGuard` HMAC pattern Story 1.2b. Pas livré Story 5.1.
- **Redis URL secret** : via `IConfigService.getRedisUrl()` lu d'env var. Aucun mot de passe logué (Pino redact `req.headers.authorization` + `req.body.password` baseline identity-svc).
- **R2 secrets** : `R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY` via env vars Doppler en prod (cf. architecture.md:689). `.env.example` vide (placeholder), jamais committés.
- **Pas de PII regex masking dans `MessageContent` VO MVP** : la PII reveal post-booking-accept est gérée par gateway-api Story 4.7 (cf. epics.md). Le domain conserve le content brut, le masking est une couche outbound display-only.

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m]

### Debug Log References

- Aucun (story scaffolding, pas de bug investigation à ce stade).

### Completion Notes List

- Story 5.1 prend pour acquis que **identity-svc est state-of-the-art** (Story 1.10 done + Stories 1.2-1.9 done) ; toute déviation du pattern identity-svc DOIT être justifiée dans le Change Log.
- Les 5 SKELETONS use cases sont **intentionnels** — ils existent pour que les Stories 5.2/5.3 n'aient PAS à toucher au scaffolding (UseCasesProxyModule registration stable). Tester en CI qu'ils throw `TODO Story X.Y` quand invoqués.
- L'addendum `BookingRequestedV1Payload.locale` peut être livré dans la même PR ou en PR séparée — privilégier PR séparée si Story 4.1 (booking-svc) est en parallèle pour éviter conflicts.

### File List

(à compléter par le dev agent au fil du développement)

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2026-05-19 | bmad-create-story (Opus 4.7) | Initial story creation — 2e référence Pretre, Epic 5 kick-off, 80+ fichiers prévus, ~109+ tests scenarios cibles, addendum @tukio/contracts BookingRequestedV1 locale field flaggé |
