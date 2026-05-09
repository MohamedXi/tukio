# Story 0.7: Setup @tukio/messaging (NATS JetStream + outbox/inbox helpers)

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

**As a** backend developer (équipe Sprint 0),
**I want** the `@tukio/messaging` library shipped avec **5 modules** : (1) `NatsJetStreamClient` wrapper sur `@horizon-republic/nestjs-jetstream` (ou fallback direct `nats` SDK), (2) `OutboxPublisher` qui consomme PG LISTEN/NOTIFY + fallback polling 30 s + publie en NATS (ADR-007), (3) `InboxConsumer` qui dédoublonne les events via `eventId` côté consommateur (idempotence), (4) `CorrelationContext` qui propage `correlationId` automatiquement à travers les events publiés (saga choréographée ADR-006), (5) `EventVersioning` helpers pour la coexistence v1/v2 ; livré avec une **migration template `outbox` + `inbox` tables** réutilisable par tous les services + le **branchement réel** dans `identity-svc` (replace le `NatsPublisher` placeholder de Story 0.6),
**so that** les 10 services backend ont une infra de messaging unifiée + transactionnellement cohérente (event publié uniquement si la transaction DB commit), les sagas distribuées Epic 4 (booking → order → payment) ont la **garantie de cohérence éventuelle** (NFR42, R13), et toute story Epic 1+ qui doit publier un event NATS (ex `admin.action.pro-verified.v1` Epic 2, `catalog.listing.published.v1` Epic 3, `booking.requested.v1` Epic 4) consomme `import { OutboxPublisher } from '@tukio/messaging'` sans réinventer la roue.

> **Outcome attendu** : à la fin de cette story, `apps/identity-svc/src/infrastructure/messaging/nats/nats.publisher.ts` (placeholder Story 0.6) est remplacé par une implémentation réelle qui (1) inscrit l'event dans la table `outbox` dans la transaction TypeORM, (2) le PG LISTEN/NOTIFY trigger réveille l'outbox-relay, (3) l'event est publié sur le stream NATS JetStream `tukio.identity` avec subject `<eventType>`, (4) marqué `published` dans l'outbox. Un test chaos minimal (NATS down 30 s → outbox accumule pending → NATS up → reprise automatique via fallback polling) valide la résilience NFR42.

## Acceptance Criteria

1. **AC1 — Structure du package `@tukio/messaging` complète** : Given `packages/messaging/src/`, When je l'ouvre, Then je trouve **exactement** cette arborescence (alignée Architecture lignes 2187-2193) :
   ```
   packages/messaging/src/
   ├─ index.ts                                          # barrel racine MINIMAL (types globaux uniquement)
   ├─ nats/
   │  ├─ nats-jetstream-client.ts                       # wrapper NATS (connexion, jetstream context, stream/consumer mgmt)
   │  ├─ nats-jetstream.module.ts                       # NestJS DynamicModule.forRoot({ url, streams })
   │  ├─ subjects.ts                                    # constantes subjects par stream (tukio.identity, tukio.catalog, ...)
   │  └─ types.ts                                       # NatsJetStreamConfig, StreamConfig, ConsumerConfig
   ├─ outbox/
   │  ├─ outbox.entity.ts                               # TypeORM Entity template (réutilisée par chaque service)
   │  ├─ outbox-publisher.ts                            # IEventPublisher impl : insert event in outbox table tx-attached
   │  ├─ outbox-publisher.module.ts                     # NestJS module
   │  ├─ outbox-relay.service.ts                        # PG LISTEN/NOTIFY listener + fallback polling 30 s + publish vers NATS
   │  ├─ outbox-relay.module.ts                         # NestJS module
   │  └─ migrations/
   │     └─ template-create-outbox-table.ts             # migration template (les services copient ce file vers leur migrations/)
   ├─ inbox/
   │  ├─ inbox.entity.ts                               # TypeORM Entity template
   │  ├─ inbox-consumer.ts                              # idempotence handler : check eventId in inbox before processing
   │  ├─ inbox-consumer.module.ts                       # NestJS module
   │  └─ migrations/
   │     └─ template-create-inbox-table.ts              # migration template
   ├─ correlation/
   │  ├─ correlation-context.ts                         # AsyncLocalStorage-based correlationId propagation
   │  ├─ correlation-context.module.ts                  # NestJS module global
   │  └─ correlation.middleware.ts                      # Fastify middleware qui extract `X-Tukio-Correlation-Id` header → set context
   ├─ versioning/
   │  ├─ event-versioning.ts                            # helpers v1/v2 (parseEventType, isCompatibleVersion, etc.)
   │  └─ event-versioning.spec.ts
   ├─ contracts.ts                                      # re-export utilitaire des types depuis @tukio/contracts (Actor, DomainEvent, Locale)
   └─ __tests__/                                        # tests cross-modules (intégration mockée)
      ├─ outbox-publisher.spec.ts
      ├─ outbox-relay.spec.ts
      ├─ inbox-consumer.spec.ts
      ├─ correlation-context.spec.ts
      └─ chaos-nats-disconnect.spec.ts                  # test chaos minimal NATS down 30s → reprise auto
   ```

2. **AC2 — `NatsJetStreamClient` wrapper avec connexion + JetStream context + stream/consumer mgmt** : Given `packages/messaging/src/nats/nats-jetstream-client.ts`, When je l'ouvre, Then il expose :
   - `class NatsJetStreamClient` avec méthodes :
     - `async connect(config: NatsJetStreamConfig): Promise<void>` — établit la connexion NATS via `connect({ servers, name, reconnect: true, maxReconnectAttempts: -1, reconnectTimeWait: 2000, pingInterval: 30000 })` (auto-reconnect infini + 2s wait + 30s ping)
     - `async ensureStream(streamConfig: StreamConfig): Promise<void>` — idempotent : crée le stream NATS s'il n'existe pas (storage `file`, replicas `3` en prod / `1` en dev, retention `limits`, max_age `7 days` par défaut, subjects `<stream>.>`)
     - `async ensureConsumer(streamName: string, consumerConfig: ConsumerConfig): Promise<void>` — idempotent : crée le pull consumer durable
     - `async publish<TPayload>(subject: string, event: DomainEvent<TPayload>): Promise<PubAck>` — publie un event sur un subject avec options `msgID: event.eventId` (déduplication NATS native via window 2 min) + `expect: { lastSeq, ... }` optionnel pour ordering strict
     - `async subscribe(streamName: string, consumerName: string, handler: (msg: JsMsg) => Promise<void>): Promise<void>` — pull consumer avec `manualAck` (ack manuel obligatoire après traitement réussi, sinon `nak` avec backoff exponentiel)
     - `async drain(): Promise<void>` — graceful shutdown (drain les messages in-flight + fermer la connexion)
   - **Wrapper sur `@horizon-republic/nestjs-jetstream`** si la lib est disponible et maintenue. **Fallback** : si la lib n'est pas disponible (vérifier `pnpm view @horizon-republic/nestjs-jetstream version` au moment du dev), wrapper direct sur le SDK officiel `nats` (npm `nats` package, classes `connect`, `JetStreamClient`, `JetStreamManager`). **Décision documentée dans `Debug Log References`** au moment de l'implémentation.
   - Logger structuré (Pino, injectée via DI cohérent Story 0.6 pattern `LOGGER` token)
   - Reconnexion automatique avec retry exponentiel (`maxReconnectAttempts: -1` = infini)
   - Métriques exposées (counter `tukio_nats_messages_published_total{stream,subject}`, gauge `tukio_nats_consumer_lag_messages{stream,consumer}`) via `prom-client` (latest stable, sera consommé par Story 0.12 Prometheus)

3. **AC3 — `OutboxPublisher` (`IEventPublisher` impl) attaché à la transaction TypeORM** : Given `packages/messaging/src/outbox/outbox-publisher.ts`, When je l'ouvre, Then :
   - `class OutboxPublisher implements IEventPublisher` (interface importée depuis `domain/ports/event-publisher.port.ts` du service consommateur — pas dans le lib, le lib définit son propre token `OUTBOX_PUBLISHER` Symbol exporté depuis `index.ts`)
   - Méthode `async publish<TPayload>(event: DomainEvent<TPayload>): Promise<void>` qui :
     - Récupère l'`EntityManager` courant via `@nestjs/typeorm` `@TransactionManager()` ou via `TypeORM`'s `getEntityManager()` (selon API stable au moment du dev)
     - Insert dans table `outbox` une row avec `{ id: event.eventId, aggregate_type: event.aggregate.type, aggregate_id: event.aggregate.id, event_type: event.eventType, event_version: parseInt(event.eventVersion.replace('v', '')), payload: event.payload, correlation_id: event.correlationId, status: 'pending', created_at: NOW() }`
     - **Atomic avec la transaction métier** : si la transaction TypeORM rollback, l'outbox row est rollback aussi → cohérence parfaite
     - Émet `NOTIFY tukio_outbox_new` (PG NOTIFY) après l'insert pour réveiller immédiatement l'outbox-relay (évite la latence du polling 30 s en happy path)
     - **Pas de publish direct vers NATS** dans ce code — c'est l'outbox-relay (AC4) qui le fait
   - Le service consommateur (ex `identity-svc`) wire ce `OutboxPublisher` comme implémentation de son port `IEventPublisher` dans son `usecases-proxy.module.ts` :
     ```ts
     { provide: EVENT_PUBLISHER, useClass: OutboxPublisher }
     ```

4. **AC4 — `OutboxRelayService` PG LISTEN/NOTIFY + fallback polling 30 s** : Given `packages/messaging/src/outbox/outbox-relay.service.ts`, When je l'ouvre, Then je trouve un `@Injectable()` qui implémente `OnModuleInit` + `OnModuleDestroy` :
   - **`onModuleInit()`** : (a) ouvrir une **connexion Postgres dédiée** (pool size 1, séparée de TypeORM main pool — évite la contention pendant LISTEN), (b) `LISTEN tukio_outbox_new` (réveille sur chaque NOTIFY), (c) à chaque notification reçue : appeler `processPendingOutbox()`, (d) lancer **un setInterval(30_000)** qui appelle aussi `processPendingOutbox()` (fallback polling NFR42), (e) appeler immédiatement `processPendingOutbox()` au démarrage (rattrape les events accumulés pendant downtime)
   - **`processPendingOutbox()`** : (a) `SELECT * FROM outbox WHERE status = 'pending' ORDER BY created_at LIMIT 100 FOR UPDATE SKIP LOCKED` (Postgres `SKIP LOCKED` pour scaler horizontalement plusieurs replicas du service sans race), (b) pour chaque event : reconstruct `DomainEvent` shape from row, publish via `NatsJetStreamClient.publish(subject, event)` avec `msgID: event.eventId` (dedup NATS), (c) si `pubAck` OK → `UPDATE outbox SET status='published', published_at=NOW() WHERE id=$id`, (d) si publish failed → `UPDATE outbox SET status='failed', error_message=$err, retry_count=retry_count+1 WHERE id=$id` + retry au prochain tick (3 retries max, puis DLQ stream `tukio.dlq` après)
   - **Subject NATS** dérivé via `subjects.ts` : `<service-stream>.<eventType>` (ex `tukio.identity.user.registered.v1`)
   - **Métriques Prometheus** : counter `tukio_outbox_published_total{service}`, counter `tukio_outbox_failed_total{service,reason}`, gauge `tukio_outbox_pending_lag_messages{service}` (alerte > 100 msg / > 1 min — NFR42)
   - **`onModuleDestroy()`** : graceful shutdown (clear interval + close PG LISTEN connection + drain NATS)
   - **Healthcheck dédié** : méthode `isHealthy(): Promise<boolean>` exposée pour `/ready` endpoint (Story 0.6) qui vérifie : (1) PG LISTEN connection active, (2) NATS connection active, (3) outbox pending lag < 1000 msg
   - **CRITICAL : un seul OutboxRelayService par service Postgres** (pas de duplication par worker thread). En K8s, le HPA peut scale horizontalement → `SKIP LOCKED` garantit qu'aucun event n'est traité 2× même si plusieurs replicas tournent.

5. **AC5 — `InboxConsumer` idempotence via `eventId`** : Given `packages/messaging/src/inbox/inbox-consumer.ts`, When je l'ouvre, Then :
   - `class InboxConsumer` avec méthode `async handle<TPayload>(jsMsg: JsMsg, handler: (event: DomainEvent<TPayload>) => Promise<void>): Promise<void>` qui :
     - Parse `event = JSON.parse(jsMsg.data)` + valide via `ajv` contre le JSON Schema correspondant (importé depuis `@tukio/contracts/events/...`) — si schema invalide → log + `nak` avec `backoff: 5min`
     - Check `SELECT 1 FROM inbox WHERE event_id = $eventId` — si row existe → c'est un duplicate → `ack` immédiatement + log "duplicate skipped" + return (idempotence)
     - Sinon : (a) `INSERT INTO inbox (event_id, event_type, correlation_id, received_at, payload) VALUES (...)`, (b) appeler `handler(event)` dans une transaction (le handler peut crash, on retry), (c) si handler success → `UPDATE inbox SET processed_at = NOW() WHERE event_id = $eventId` + `jsMsg.ack()`, (d) si handler crash → `jsMsg.nak({ delay: 30_000 })` (retry après 30 s) + log error
   - **Atomique** : insert inbox + handler + update processed_at sont dans une seule transaction TypeORM (cohérence si crash entre les étapes)
   - **Backoff exponentiel** sur les retries (30 s, 1 min, 2 min, 5 min, 10 min — max 5 retries) ; après 5 retries → DLQ stream `tukio.dlq` + alerte
   - Service consommateur (ex `notification-svc` qui consume `admin.action.pro-verified.v1`) écrit ses handlers comme :
     ```ts
     this.natsClient.subscribe('TUKIO_IDENTITY', 'notification-svc-consumer', (msg) =>
       this.inboxConsumer.handle<AdminActionProVerifiedV1Payload>(msg, async (event) => {
         await this.sendVerificationEmailUseCase.execute({ proId: event.payload.proId });
       })
     );
     ```

6. **AC6 — `CorrelationContext` propagation via AsyncLocalStorage** : Given `packages/messaging/src/correlation/`, When je l'ouvre, Then :
   - `correlation-context.ts` : utilise `AsyncLocalStorage` (Node natif) pour propager `correlationId` à travers tout l'arbre d'exécution async d'une requête HTTP ou d'un consumer NATS, sans avoir à le passer en argument partout
   - API publique :
     - `correlationContext.runWithContext(correlationId, () => { ... })` — exécute un callback dans un contexte avec correlationId set
     - `correlationContext.getCorrelationId(): string | undefined` — retrieve le current correlationId
   - `correlation.middleware.ts` (Fastify middleware) : à chaque requête HTTP entrante, (a) extract `X-Tukio-Correlation-Id` header, (b) si absent → générer nouveau `crypto.randomUUID()`, (c) wrap le reste du request handling dans `correlationContext.runWithContext(corrId, ...)`, (d) injecter dans `request.correlationId` pour usage par interceptor envelope (Story 0.6 AC10) + logger
   - **Auto-propagation dans `OutboxPublisher`** : si `event.correlationId` n'est pas fourni explicitement → utiliser `correlationContext.getCorrelationId()` (cas typique : un use case publie un event en consommant un autre event → la saga garde le même correlationId)
   - **Inter-service propagation** : quand un service publie un event NATS, `correlationId` est dans `event.correlationId` (fait partie du DomainEvent envelope Story 0.2). Quand un consommateur consume cet event, `InboxConsumer` (AC5) appelle `correlationContext.runWithContext(event.correlationId, () => handler(event))` → la chaîne saga garde le même corrId end-to-end
   - **HTTP downstream** (cas exception booking → catalog) : intercepteur axios qui injecte `X-Tukio-Correlation-Id` header automatiquement depuis le contexte (NB : pas activé Story 0.7, pas de HTTP downstream à ce stade — placeholder pour Stories Epic 4)

7. **AC7 — `EventVersioning` helpers v1/v2 coexistence** : Given `packages/messaging/src/versioning/event-versioning.ts`, When je l'ouvre, Then :
   - `parseEventType(eventType: string): { service: string; aggregate?: string; event: string; version: 'v1' | 'v2' }` — parse `<service>.<aggregate>.<event>.v<n>` ou `<service>.<event>.v<n>` (segments collapsés cf. Story 0.2 AC4)
   - `isCompatibleVersion(eventType: string, supportedVersions: ('v1' | 'v2')[]): boolean` — utilisé par `InboxConsumer` pour ignorer les events d'une version non supportée par ce consumer (logs warn, `ack` pour ne pas retry indéfiniment)
   - `migrateEventV1ToV2<V1Payload, V2Payload>(payload: V1Payload, mapper: (v1: V1Payload) => V2Payload): V2Payload` — helper pour les consumers qui veulent traiter les events v1 legacy en les migrant vers le shape v2 in-memory
   - **Pattern recommandé** dans Dev Notes : pour bumper un schema (cohérent Story 0.2 AC9) — créer `<event>.v2.{schema.json,ts}`, garder `v1` en parallèle, les producers publient en `v2` quand prêts, les consumers gèrent les deux versions pendant la migration (typiquement 1-2 sprints)

8. **AC8 — Migrations templates `outbox` + `inbox` réutilisables** : Given `packages/messaging/src/outbox/migrations/template-create-outbox-table.ts` + `packages/messaging/src/inbox/migrations/template-create-inbox-table.ts`, When je les ouvre, Then je trouve des templates TypeORM Migration **paramétrés** :
   - **Outbox template** crée la table `outbox` (cohérent Architecture lignes 634-650) :
     ```sql
     CREATE TABLE outbox (
       id UUID PRIMARY KEY,
       aggregate_type TEXT NOT NULL,
       aggregate_id UUID NOT NULL,
       event_type TEXT NOT NULL,
       event_version INT NOT NULL,
       payload JSONB NOT NULL,
       correlation_id UUID NOT NULL,
       status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'failed')),
       retry_count INT DEFAULT 0,
       created_at TIMESTAMPTZ DEFAULT NOW(),
       published_at TIMESTAMPTZ,
       error_message TEXT
     );
     CREATE INDEX idx_outbox_status_created ON outbox (status, created_at) WHERE status = 'pending';

     -- Trigger NOTIFY on insert (PG LISTEN/NOTIFY pattern)
     CREATE OR REPLACE FUNCTION notify_outbox_new() RETURNS trigger AS $$
     BEGIN
       PERFORM pg_notify('tukio_outbox_new', NEW.id::text);
       RETURN NEW;
     END;
     $$ LANGUAGE plpgsql;

     CREATE TRIGGER trg_outbox_notify AFTER INSERT ON outbox
       FOR EACH ROW EXECUTE FUNCTION notify_outbox_new();
     ```
   - **Inbox template** crée la table `inbox` (cohérent Architecture lignes 652-660) :
     ```sql
     CREATE TABLE inbox (
       event_id UUID PRIMARY KEY,
       event_type TEXT NOT NULL,
       correlation_id UUID NOT NULL,
       received_at TIMESTAMPTZ DEFAULT NOW(),
       processed_at TIMESTAMPTZ,
       payload JSONB NOT NULL
     );
     CREATE INDEX idx_inbox_received ON inbox (received_at) WHERE processed_at IS NULL;
     ```
   - **`down()` migration** : DROP TRIGGER, DROP FUNCTION, DROP TABLE (rollback NFR72)
   - **Comment intégrer** dans un service : copier le template dans `apps/<svc>/src/infrastructure/persistence/typeorm/migrations/<timestamp>-AddOutboxInboxTables.ts` puis ajuster le timestamp via `pnpm --filter=<svc> migration:generate`

9. **AC9 — Branchement réel dans `identity-svc` (replace `NatsPublisher` placeholder Story 0.6)** : Given `apps/identity-svc/src/infrastructure/messaging/nats/nats.publisher.ts` (placeholder créé Story 0.6 task 5.6), When je l'ouvre maintenant, Then :
   - Fichier **supprimé** au profit de l'usage direct de `OutboxPublisher` depuis `@tukio/messaging`
   - `apps/identity-svc/src/infrastructure/messaging/nats/nats-publisher.module.ts` (Story 0.6 task 5.7) updated :
     ```ts
     @Module({
       imports: [
         OutboxPublisherModule,                      // depuis @tukio/messaging
         OutboxRelayModule.forRoot({
           streamName: 'TUKIO_IDENTITY',
           subjectPrefix: 'tukio.identity',
         }),
         NatsJetStreamModule.forRoot({               // depuis @tukio/messaging
           url: 'nats://localhost:4222',             // env var NATS_URL Story 0.6
           streams: [
             { name: 'TUKIO_IDENTITY', subjects: ['tukio.identity.>'], replicas: 1 /* dev — 3 prod */ },
           ],
         }),
       ],
       providers: [
         { provide: EVENT_PUBLISHER, useExisting: OUTBOX_PUBLISHER /* Symbol depuis @tukio/messaging */ },
       ],
       exports: [EVENT_PUBLISHER],
     })
     export class NatsPublisherModule {}
     ```
   - **Migration `1715210000000-AddOutboxInboxTables.ts` créée** dans `apps/identity-svc/src/infrastructure/persistence/typeorm/migrations/` (copie du template `@tukio/messaging`) — créera les tables `outbox` + `inbox` dans la DB `tukio_identity`
   - **`identity-svc/.env.example` updated** : ajouter `NATS_URL=nats://localhost:4222`, `NATS_STREAM_NAME=TUKIO_IDENTITY`, `NATS_REPLICAS=1`
   - **Test E2E** : nouveau fichier `apps/identity-svc/test/outbox.e2e-spec.ts` :
     - Démarrer app + DB testcontainer (NB : `@tukio/testing` n'est pas encore livré Story 0.9 — au scaffolding, utiliser un mock TypeORM ou `pg` direct, OU laisser le test marqué `it.skip()` avec TODO Story 0.9)
     - Mock NATS (utiliser un stub simple dans `__tests__/`)
     - Trigger un use case qui publish (créer un fake `RegisterDemoUserUseCase` temporaire pour tests, **supprimé en fin de story**)
     - Vérifier outbox row inserted, status = `published` après outbox-relay tick

10. **AC10 — Test chaos minimal NATS disconnect** : Given `packages/messaging/src/__tests__/chaos-nats-disconnect.spec.ts`, When je le lance, Then il vérifie le scénario R13 : NATS down → outbox accumule pending → NATS up → reprise auto via fallback polling 30 s :
    - Setup : DB Postgres mock (in-memory `sqlite` ou `pg-mem` pour test) + NATS mock controllable (fake client qui peut être stoppé/redémarré)
    - **Étape 1** : publish 5 events via `OutboxPublisher` → vérifier outbox table contient 5 rows status `pending`
    - **Étape 2** : démarrer outbox-relay → vérifier 5 rows passent à status `published`, NATS mock recoit 5 messages
    - **Étape 3** : stopper NATS mock (simule down) → publish 3 nouveaux events → vérifier outbox table contient 3 rows pending (NOTIFY essaie publish, fail, status reste `pending` ou `failed`)
    - **Étape 4** : relay tick polling (advance fake timer +30s) → tente toujours, échec
    - **Étape 5** : redémarrer NATS mock + advance timer +30s → relay reprend, 3 rows passent à `published`
    - **Assertions** : exit handler propre, pas de crash, logs cohérents
    - **NB** : ce test est conceptuel ; l'implémentation exacte peut nécessiter `@tukio/testing` (Story 0.9) pour les helpers chaos. Si trop complexe au Sprint 0, marquer `it.skip()` avec TODO Story 0.9. Mais tester au minimum la logique de retry + fallback polling sans NATS réel (pure unit tests avec mocks).

11. **AC11 — `package.json` `@tukio/messaging` complet** : Given `packages/messaging/package.json`, When je l'ouvre, Then :
    - `"name": "@tukio/messaging"`, `"version": "0.0.0"`, `"private": true`, `"sideEffects": false`, `"type": "module"`
    - Champ `"exports"` exhaustif (cf. Dev Notes §Subpath exports)
    - Scripts : `"test": "vitest run"`, `"test:watch": "vitest"`, `"lint": "eslint src --ext .ts"`, `"typecheck": "tsc --noEmit"`
    - Dépendances :
      - `runtime` : `nats` (latest stable, SDK officiel — base layer), `pg` (latest stable, pour PG LISTEN connection dédiée), `prom-client` (latest stable, métriques)
      - **Conditional runtime** : `@horizon-republic/nestjs-jetstream` (latest stable) — **OPTIONNEL** : si la lib n'est pas dispo / pas maintenue au moment du dev, utiliser uniquement `nats` SDK direct ; documenter le choix dans `Debug Log References`
      - `peerDependencies` : `@nestjs/core`, `@nestjs/common`, `@nestjs/typeorm`, `typeorm`, `@tukio/contracts: workspace:*`
      - `devDependencies` : `@nestjs/testing`, `vitest`, `@types/node`, `typescript`, `pg-mem` (pour tests in-memory PG, latest stable)
    - **Pas de version pinnée sans justification** (memory `feedback_latest_versions.md`) — vérifier `pnpm view <pkg> version` au moment du dev

12. **AC12 — Subpath imports + barrel racine minimal** : Given `packages/messaging/`, When une app/service importe :
    ```ts
    import { OutboxPublisher, OUTBOX_PUBLISHER } from '@tukio/messaging/outbox';
    import { OutboxRelayModule } from '@tukio/messaging/outbox/relay';
    import { InboxConsumer, INBOX_CONSUMER } from '@tukio/messaging/inbox';
    import { NatsJetStreamClient, NatsJetStreamModule } from '@tukio/messaging/nats';
    import { correlationContext, CorrelationMiddleware } from '@tukio/messaging/correlation';
    import { parseEventType, isCompatibleVersion } from '@tukio/messaging/versioning';
    ```
    Then aucune erreur de résolution. Le barrel racine `packages/messaging/src/index.ts` re-exporte UNIQUEMENT les types globaux les plus utilisés (Symbol tokens) :
    ```ts
    export { OUTBOX_PUBLISHER } from './outbox/outbox-publisher.module';
    export { INBOX_CONSUMER } from './inbox/inbox-consumer.module';
    export { CORRELATION_CONTEXT } from './correlation/correlation-context.module';
    ```
    Tout le reste passe par les subpaths (anti-barrel).

13. **AC13 — Lint custom `tukio/no-direct-event-publish` (warn)** : Given le plugin `eslint-plugin-tukio` (créé Story 0.2, étendu Stories 0.3+0.4), When un dev écrit dans un service backend `apps/<svc>/src/usecases/...usecase.ts` :
    ```ts
    await this.natsClient.publish('subject', event); // ❌ direct publish (bypass outbox)
    ```
    Then la lint rule `tukio/no-direct-event-publish` (sévérité `warn` Sprint 0, montée à `error` Story 0.11) signale la violation et propose en autofix :
    ```ts
    await this.outboxPublisher.publish(event); // ✅ pass through outbox (transactional consistency)
    ```
    - Détecte les patterns d'usage direct du NATS client dans `usecases/` (use cases ne devraient JAMAIS publish directement — toujours via outbox pour cohérence transactionnelle)
    - Tests Vitest : 2 valid (use case via OutboxPublisher) + 2 invalid (use case avec direct NATS client)

## Tasks / Subtasks

- [ ] **Task 1 — Configurer `package.json` + `tsconfig.json` + Vitest** (AC: #11, #12)
  - [ ] 1.1 — `pnpm --filter=@tukio/messaging add nats pg prom-client` (runtime)
  - [ ] 1.2 — Vérifier `pnpm view @horizon-republic/nestjs-jetstream version` → si dispo + maintenu (latest commit < 6 mois) → `pnpm --filter=@tukio/messaging add @horizon-republic/nestjs-jetstream`. Sinon → fallback direct `nats` SDK (documenter dans `Debug Log References`)
  - [ ] 1.3 — `pnpm --filter=@tukio/messaging add -D vitest @nestjs/testing pg-mem typescript @types/node`
  - [ ] 1.4 — `pnpm --filter=@tukio/messaging add @nestjs/core@latest @nestjs/common@latest @nestjs/typeorm@latest typeorm@latest @tukio/contracts@workspace:* --save-peer`
  - [ ] 1.5 — Mettre à jour `packages/messaging/package.json` avec `exports` field exhaustif (cf. Dev Notes §Subpath exports)
  - [ ] 1.6 — Créer `packages/messaging/vitest.config.ts` minimal (cohérent Story 0.2 setup, coverage thresholds `lines: 80, functions: 80, branches: 75`)

- [ ] **Task 2 — Implémenter `NatsJetStreamClient` + module NestJS** (AC: #2)
  - [ ] 2.1 — `nats/nats-jetstream-client.ts` : classe avec connexion + reconnect + ensureStream/ensureConsumer/publish/subscribe/drain (cf. AC2)
  - [ ] 2.2 — `nats/nats-jetstream.module.ts` : `DynamicModule.forRoot({ url, streams })` qui inject le client comme `NATS_JETSTREAM_CLIENT` Symbol token
  - [ ] 2.3 — `nats/subjects.ts` : exporter constantes subjects par stream (`SUBJECTS = { TUKIO_IDENTITY: 'tukio.identity.>', TUKIO_CATALOG: 'tukio.catalog.>', TUKIO_BOOKING: 'tukio.booking.>', TUKIO_PAYMENT: 'tukio.payment.>', ... }`)
  - [ ] 2.4 — `nats/types.ts` : `NatsJetStreamConfig`, `StreamConfig`, `ConsumerConfig`, `PubAck` exportés
  - [ ] 2.5 — Tests unit `nats/__tests__/nats-jetstream-client.spec.ts` : mock NATS SDK, vérifier connect retry behavior, ensureStream idempotent, publish msgID dedup

- [ ] **Task 3 — Implémenter `OutboxPublisher` + entity + module** (AC: #3)
  - [ ] 3.1 — `outbox/outbox.entity.ts` : TypeORM Entity `Outbox` avec décorateurs (id, aggregateType, aggregateId, eventType, eventVersion, payload jsonb, correlationId, status, retryCount, createdAt, publishedAt, errorMessage)
  - [ ] 3.2 — `outbox/outbox-publisher.ts` : `class OutboxPublisher` implements une interface générique `IEventPublisher` (re-exportée depuis `@tukio/messaging/contracts`), méthode `publish` insère dans `outbox` table dans la transaction courante + `pg_notify`
  - [ ] 3.3 — `outbox/outbox-publisher.module.ts` : NestJS module qui exporte `OUTBOX_PUBLISHER` Symbol + provider `{ provide: OUTBOX_PUBLISHER, useClass: OutboxPublisher }`
  - [ ] 3.4 — Tests `outbox/__tests__/outbox-publisher.spec.ts` : test insert outbox row attached to transaction, test rollback if transaction rollback, test pg_notify émis

- [ ] **Task 4 — Implémenter `OutboxRelayService` + module** (AC: #4)
  - [ ] 4.1 — `outbox/outbox-relay.service.ts` : `@Injectable()` avec `OnModuleInit`/`OnModuleDestroy`, PG LISTEN connection séparée, fallback polling 30s, processPendingOutbox via `SKIP LOCKED`, retry logic avec backoff
  - [ ] 4.2 — `outbox/outbox-relay.module.ts` : `DynamicModule.forRoot({ streamName, subjectPrefix })` qui inject NatsJetStreamClient + DataSource TypeORM + démarre le relay
  - [ ] 4.3 — Métriques Prometheus exposées (counter + gauge) via `prom-client` registry global
  - [ ] 4.4 — Healthcheck `isHealthy()` exposé pour `/ready` consommation
  - [ ] 4.5 — Tests `outbox/__tests__/outbox-relay.spec.ts` : test pg-mem + nats mock, test happy path (NOTIFY déclenche publish + status=published), test polling fallback (advance fake timer +30s), test SKIP LOCKED concurrent (2 instances ne traitent pas le même event), test retry logic + DLQ après 3 retries

- [ ] **Task 5 — Implémenter `InboxConsumer` + entity + module** (AC: #5)
  - [ ] 5.1 — `inbox/inbox.entity.ts` : TypeORM Entity `Inbox` (eventId PK, eventType, correlationId, receivedAt, processedAt, payload jsonb)
  - [ ] 5.2 — `inbox/inbox-consumer.ts` : `class InboxConsumer` avec méthode `handle<TPayload>(jsMsg, handler)` qui (a) parse + valide JSON Schema, (b) check duplicate via inbox, (c) execute handler en transaction, (d) ack/nak avec backoff
  - [ ] 5.3 — `inbox/inbox-consumer.module.ts` : NestJS module qui exporte `INBOX_CONSUMER` Symbol
  - [ ] 5.4 — Tests `inbox/__tests__/inbox-consumer.spec.ts` : test idempotence (duplicate skipped), test handler crash → nak with backoff, test schema validation fail → nak avec long backoff

- [ ] **Task 6 — Implémenter `CorrelationContext` + middleware Fastify** (AC: #6)
  - [ ] 6.1 — `correlation/correlation-context.ts` : utilise `node:async_hooks` `AsyncLocalStorage<{ correlationId: string }>` ; expose `runWithContext(corrId, callback)` + `getCorrelationId()`
  - [ ] 6.2 — `correlation/correlation.middleware.ts` : Fastify middleware (`(req, reply, done) => ...`) qui extract header `X-Tukio-Correlation-Id` ou génère via `crypto.randomUUID()`, set sur `request.correlationId`, wrap rest in `correlationContext.runWithContext(corrId, () => done())`
  - [ ] 6.3 — `correlation/correlation-context.module.ts` : NestJS Global Module qui exporte `CORRELATION_CONTEXT` Symbol + provider singleton
  - [ ] 6.4 — Tests `correlation/__tests__/correlation-context.spec.ts` : test ALS propagation through async chain (Promise, setTimeout), test middleware extract header, test middleware generate UUID si absent, test concurrent requests don't leak corrId

- [ ] **Task 7 — Implémenter `EventVersioning` helpers** (AC: #7)
  - [ ] 7.1 — `versioning/event-versioning.ts` : `parseEventType(str)`, `isCompatibleVersion(eventType, supportedVersions)`, `migrateEventV1ToV2(payload, mapper)`
  - [ ] 7.2 — Tests `versioning/event-versioning.spec.ts` : test parse `'catalog.listing.published.v1'` → `{ service: 'catalog', aggregate: 'listing', event: 'published', version: 'v1' }`, test parse `'booking.requested.v1'` → `{ service: 'booking', event: 'requested', version: 'v1' }` (sans aggregate), test isCompatibleVersion / migration

- [ ] **Task 8 — Créer migrations templates outbox + inbox** (AC: #8)
  - [ ] 8.1 — `outbox/migrations/template-create-outbox-table.ts` (TypeORM Migration class avec `up()` + `down()` complets, cf. AC8)
  - [ ] 8.2 — `inbox/migrations/template-create-inbox-table.ts` (TypeORM Migration class avec `up()` + `down()`)
  - [ ] 8.3 — Documenter dans `packages/messaging/README.md` la procédure : "copier ce template dans `apps/<svc>/src/infrastructure/persistence/typeorm/migrations/<timestamp>-AddOutboxInboxTables.ts` et regenerer le timestamp via `pnpm --filter=<svc> typeorm migration:create`"

- [ ] **Task 9 — Brancher `@tukio/messaging` réellement dans `identity-svc`** (AC: #9)
  - [ ] 9.1 — Supprimer `apps/identity-svc/src/infrastructure/messaging/nats/nats.publisher.ts` (placeholder Story 0.6)
  - [ ] 9.2 — Mettre à jour `apps/identity-svc/src/infrastructure/messaging/nats/nats-publisher.module.ts` avec import `OutboxPublisherModule` + `OutboxRelayModule.forRoot(...)` + `NatsJetStreamModule.forRoot(...)` + provider `{ provide: EVENT_PUBLISHER, useExisting: OUTBOX_PUBLISHER }` (cf. AC9)
  - [ ] 9.3 — Créer migration `apps/identity-svc/src/infrastructure/persistence/typeorm/migrations/1715210000000-AddOutboxInboxTables.ts` (copier les 2 templates `@tukio/messaging`, regénérer timestamp réel via `Date.now()` au moment du dev)
  - [ ] 9.4 — Mettre à jour `apps/identity-svc/.env.example` : ajouter `NATS_URL=nats://localhost:4222`, `NATS_STREAM_NAME=TUKIO_IDENTITY`, `NATS_REPLICAS=1`
  - [ ] 9.5 — Mettre à jour `EnvironmentConfigService` (Story 0.6) pour exposer `getNatsConfig()` typed
  - [ ] 9.6 — Smoke test : `pnpm --filter=identity-svc dev` démarre OK (NATS local doit tourner — laisser un TODO si Docker Compose Story 0.10 pas encore là, alternative `pnpm dlx nats-server` en stand-alone). Vérifier que `OutboxRelayService` log "PG LISTEN active" au boot.
  - [ ] 9.7 — Test E2E `apps/identity-svc/test/outbox.e2e-spec.ts` : créer un fake `RegisterDemoUserUseCase` (file temporaire `apps/identity-svc/src/usecases/_demo-publish.usecase.ts`), publish un event via OutboxPublisher, assert outbox row inserted. **Cleanup** : supprimer le fake use case + test E2E spec en fin de story (ne pas committer — purement validation locale)

- [ ] **Task 10 — Test chaos NATS disconnect** (AC: #10)
  - [ ] 10.1 — `__tests__/chaos-nats-disconnect.spec.ts` : implémenter scénario R13 avec mock NATS controllable
  - [ ] 10.2 — Si trop complexe sans `@tukio/testing` (Story 0.9) → marquer `it.skip()` avec TODO clair "Implémenter Story 0.9 quand `@tukio/testing/chaos/nats-disconnect.helper.ts` sera dispo"
  - [ ] 10.3 — En attendant : tests unitaires plus simples qui couvrent (a) retry logic OutboxRelayService.processPendingOutbox quand publish fail, (b) backoff exponentiel inboxConsumer, (c) status `failed` après 3 retries

- [ ] **Task 11 — Lint custom `tukio/no-direct-event-publish`** (AC: #13)
  - [ ] 11.1 — Étendre `tools/eslint-plugin-tukio/src/rules/` avec `no-direct-event-publish.js`
  - [ ] 11.2 — Détecte appels `*.publish(...)` dans fichiers `apps/*-svc/src/usecases/**/*.ts` quand l'objet appelé n'est PAS `outboxPublisher` (regex match fallback ou AST analysis pour vérifier le type via TypeScript service — MVP : regex sur identifiant)
  - [ ] 11.3 — Tests Vitest : 2 valid (`outboxPublisher.publish(event)`), 2 invalid (`natsClient.publish(...)`, `eventPublisher.publish(...)` quand l'instance ne wrap pas outbox)
  - [ ] 11.4 — Brancher dans `.eslintrc.cjs` racine : `'tukio/no-direct-event-publish': 'warn'`

- [ ] **Task 12 — Documenter `@tukio/messaging` README** (AC: tous)
  - [ ] 12.1 — `packages/messaging/README.md` (≤ 3 pages) : description + 4 patterns clés (publish via outbox, consume via inbox, correlation propagation, event versioning)
  - [ ] 12.2 — Quick-start "Comment publier un event depuis un service ?" en 3 étapes (importer OutboxPublisher, wire dans usecases-proxy.module, appeler `outboxPublisher.publish(event)` dans use case)
  - [ ] 12.3 — Quick-start "Comment consume un event ?" en 4 étapes (importer InboxConsumer + NatsJetStreamClient, créer un consumer module, wire handler, run en background NestJS)
  - [ ] 12.4 — Lien vers ADR-002 (NATS JetStream) + ADR-006 (saga choréographée) + ADR-007 (outbox pattern) + ADR-011 (`@tukio/contracts`) — à créer Story 0.13

- [ ] **Task 13 — Tests + lint + commit** (AC: tous)
  - [ ] 13.1 — `pnpm --filter=@tukio/messaging test --coverage` → ≥ 80 % coverage par module (modulo chaos test skipped)
  - [ ] 13.2 — `pnpm --filter=identity-svc test --coverage` → continue à passer (Story 0.6 thresholds maintenus)
  - [ ] 13.3 — `pnpm lint && pnpm typecheck` à la racine → tous passent
  - [ ] 13.4 — `pnpm dev` à la racine → 4 apps + 10 services démarrent (NB : si NATS local pas démarré, `identity-svc` peut log warning sans crash — graceful degradation)
  - [ ] 13.5 — Cleanup : supprimer `_demo-publish.usecase.ts` + `outbox.e2e-spec.ts` temporaires de Task 9.7
  - [ ] 13.6 — Commit `feat(messaging): @tukio/messaging NATS JetStream + outbox/inbox helpers + correlation context, wire into identity-svc` — Story 0.7 done

## Dev Notes

### Pourquoi cette story est la 7ᵉ — contexte stratégique

> **Sources canoniques** : `_bmad-output/planning-artifacts/architecture.md` §Cross-Cutting #6 Saga Distribuée + Event Sourcing partiel (lignes 268-275) + §Outbox & Inbox Tables (lignes 632-663) + §Détail libs partagées `@tukio/messaging` (lignes 2187-2193) + PRD NFR40-46 + R11/R12/R13.

Story 0.6 a posé le **template de service backend** (Pattern Pretre) avec un `NatsPublisher` placeholder. Story 0.7 livre la **vraie infra messaging** : NATS JetStream wrapper, outbox transactionnel (cohérence garantie DB ↔ NATS), inbox idempotent (déduplication consumer-side), propagation correlationId end-to-end (saga reconstructible).

**C'est la fondation des sagas distribuées Epic 4** (booking → order → payment) : sans `@tukio/messaging` correctement implémenté, R11 (saga partiellement échouée) devient incontrôlable, R12 (NATS perte de message) n'est pas mitigé, R13 (outbox relay panne) entraîne de la corruption de données.

**Décision technique majeure (à acter dans Story 0.7)** : la **transactional outbox** (ADR-007) est NON NÉGOCIABLE. Tous les publish d'events DOIVENT passer par `OutboxPublisher` (jamais publish NATS directement depuis un use case). La lint custom `tukio/no-direct-event-publish` enforce cette règle. Justification : si on publie directement vers NATS depuis un use case, et que la transaction DB rollback après, on a un event publié mais aucun changement persisté = **incohérence**. L'outbox garantit l'atomicité (event publié SI ET SEULEMENT SI la transaction commit).

### Versions à utiliser (latest stable au moment du Sprint 0)

| Lib | Rôle | Version cible |
|---|---|---|
| **`nats`** | SDK NATS officiel (base layer, JetStream support inclus) | latest stable (2.x) |
| **`@horizon-republic/nestjs-jetstream`** | Wrapper NestJS optionnel | latest stable **SI dispo + maintenu** au moment du dev. Sinon → fallback `nats` SDK direct. **Vérifier `pnpm view @horizon-republic/nestjs-jetstream version` + commit history**. |
| **`pg`** | Driver Postgres pour PG LISTEN connection dédiée (séparée de TypeORM) | latest stable |
| **`prom-client`** | Métriques Prometheus | latest stable |
| **`pg-mem`** | Tests in-memory PG (alternative à testcontainers) | latest stable |
| **`@nestjs/typeorm`**, **`typeorm`** | ORM (cohérent Story 0.6) | déjà figé Story 0.6 |
| **`vitest`** | Tests | déjà figé Story 0.2 |

> ⚠️ **Si `@horizon-republic/nestjs-jetstream` n'est pas dispo / pas maintenu** : utiliser uniquement `nats` SDK (npm `nats`). API : `import { connect, JetStreamClient, JetStreamManager } from 'nats';`. Documenter le choix dans Debug Log References.
>
> ⚠️ **`pg-mem` vs testcontainers** : pour les tests in-memory rapides, `pg-mem` est suffisant pour AC10 chaos test (95 % du SQL Postgres supporté). `@tukio/testing` (Story 0.9) ajoutera `testcontainers/postgres.helper.ts` pour les tests d'intégration plus poussés.

### Project Structure cible (cohérent Architecture lignes 2187-2193)

```
packages/messaging/
├─ package.json, tsconfig.json, vitest.config.ts, README.md
└─ src/
   ├─ index.ts                                    # barrel racine MINIMAL (Symbol tokens uniquement)
   ├─ contracts.ts                                # re-export Actor, DomainEvent, Locale depuis @tukio/contracts
   ├─ nats/
   │  ├─ nats-jetstream-client.ts
   │  ├─ nats-jetstream.module.ts
   │  ├─ subjects.ts
   │  ├─ types.ts
   │  └─ __tests__/nats-jetstream-client.spec.ts
   ├─ outbox/
   │  ├─ outbox.entity.ts
   │  ├─ outbox-publisher.ts
   │  ├─ outbox-publisher.module.ts
   │  ├─ outbox-relay.service.ts
   │  ├─ outbox-relay.module.ts
   │  ├─ migrations/template-create-outbox-table.ts
   │  └─ __tests__/{outbox-publisher,outbox-relay}.spec.ts
   ├─ inbox/
   │  ├─ inbox.entity.ts
   │  ├─ inbox-consumer.ts
   │  ├─ inbox-consumer.module.ts
   │  ├─ migrations/template-create-inbox-table.ts
   │  └─ __tests__/inbox-consumer.spec.ts
   ├─ correlation/
   │  ├─ correlation-context.ts
   │  ├─ correlation-context.module.ts
   │  ├─ correlation.middleware.ts
   │  └─ __tests__/correlation-context.spec.ts
   ├─ versioning/
   │  ├─ event-versioning.ts
   │  └─ event-versioning.spec.ts
   └─ __tests__/
      └─ chaos-nats-disconnect.spec.ts
```

### Subpath exports (`packages/messaging/package.json` — bloc à coller)

> Cohérent avec Stories 0.2/0.3/0.4 pattern. Exports par module pour préserver tree-shaking.

```json
{
  "name": "@tukio/messaging",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "sideEffects": false,
  "exports": {
    ".": "./src/index.ts",
    "./nats": "./src/nats/nats-jetstream.module.ts",
    "./nats/client": "./src/nats/nats-jetstream-client.ts",
    "./nats/subjects": "./src/nats/subjects.ts",
    "./nats/types": "./src/nats/types.ts",
    "./outbox": "./src/outbox/outbox-publisher.module.ts",
    "./outbox/publisher": "./src/outbox/outbox-publisher.ts",
    "./outbox/relay": "./src/outbox/outbox-relay.module.ts",
    "./outbox/entity": "./src/outbox/outbox.entity.ts",
    "./outbox/migrations/template": "./src/outbox/migrations/template-create-outbox-table.ts",
    "./inbox": "./src/inbox/inbox-consumer.module.ts",
    "./inbox/consumer": "./src/inbox/inbox-consumer.ts",
    "./inbox/entity": "./src/inbox/inbox.entity.ts",
    "./inbox/migrations/template": "./src/inbox/migrations/template-create-inbox-table.ts",
    "./correlation": "./src/correlation/correlation-context.module.ts",
    "./correlation/context": "./src/correlation/correlation-context.ts",
    "./correlation/middleware": "./src/correlation/correlation.middleware.ts",
    "./versioning": "./src/versioning/event-versioning.ts",
    "./contracts": "./src/contracts.ts"
  }
}
```

### Pattern code — `OutboxPublisher` (extrait pour le dev agent)

```ts
// packages/messaging/src/outbox/outbox-publisher.ts (squelette)
import { Inject, Injectable } from '@nestjs/common';
import type { DomainEvent } from '@tukio/contracts/types/DomainEvent';
import { EntityManager, getEntityManager } from 'typeorm';
import { Outbox } from './outbox.entity';
import { Pool } from 'pg';

@Injectable()
export class OutboxPublisher {
  constructor(
    private readonly entityManager: EntityManager,           // injected via TypeORM
    @Inject('NOTIFY_PG_POOL') private readonly notifyPool: Pool,  // pool dédié pour pg_notify
  ) {}

  async publish<TPayload>(event: DomainEvent<TPayload>): Promise<void> {
    // Insert dans outbox table dans la transaction TypeORM courante
    await this.entityManager.insert(Outbox, {
      id: event.eventId,
      aggregateType: event.aggregate.type,
      aggregateId: event.aggregate.id,
      eventType: event.eventType,
      eventVersion: parseInt(event.eventVersion.replace('v', ''), 10),
      payload: event.payload as object,
      correlationId: event.correlationId,
      status: 'pending',
      retryCount: 0,
      createdAt: new Date(),
    });

    // Émettre NOTIFY pour réveiller l'outbox-relay (best-effort, fallback polling 30s sinon)
    // Dans une vraie tx, le NOTIFY n'est délivré qu'au COMMIT (Postgres natif)
    await this.entityManager.query(`SELECT pg_notify('tukio_outbox_new', $1)`, [event.eventId]);
  }
}
```

### Pattern code — `OutboxRelayService` (squelette)

```ts
// packages/messaging/src/outbox/outbox-relay.service.ts (squelette)
import { Injectable, OnModuleInit, OnModuleDestroy, Inject, Logger } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import type { DataSource } from 'typeorm';
import { NatsJetStreamClient } from '../nats/nats-jetstream-client';

const POLL_INTERVAL_MS = 30_000;
const BATCH_SIZE = 100;
const MAX_RETRIES = 3;

@Injectable()
export class OutboxRelayService implements OnModuleInit, OnModuleDestroy {
  private listenClient!: PoolClient;
  private pollTimer?: NodeJS.Timeout;
  private isProcessing = false;

  constructor(
    @Inject('LISTEN_PG_POOL') private readonly pool: Pool,
    private readonly dataSource: DataSource,
    private readonly natsClient: NatsJetStreamClient,
    @Inject('OUTBOX_RELAY_CONFIG') private readonly config: { streamName: string; subjectPrefix: string },
    private readonly logger: Logger,
  ) {}

  async onModuleInit() {
    this.listenClient = await this.pool.connect();
    await this.listenClient.query('LISTEN tukio_outbox_new');
    this.listenClient.on('notification', () => this.processPendingOutbox().catch((e) => this.logger.error(e)));
    this.pollTimer = setInterval(() => this.processPendingOutbox().catch((e) => this.logger.error(e)), POLL_INTERVAL_MS);
    await this.processPendingOutbox(); // catch up at boot
  }

  async onModuleDestroy() {
    clearInterval(this.pollTimer);
    await this.listenClient.query('UNLISTEN tukio_outbox_new');
    this.listenClient.release();
    await this.natsClient.drain();
  }

  private async processPendingOutbox(): Promise<void> {
    if (this.isProcessing) return; // simple lock for single-replica safety
    this.isProcessing = true;
    try {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();
      try {
        const rows = await queryRunner.query(
          `SELECT * FROM outbox WHERE status='pending' ORDER BY created_at LIMIT $1 FOR UPDATE SKIP LOCKED`,
          [BATCH_SIZE],
        );
        for (const row of rows) {
          try {
            const event = this.rowToDomainEvent(row);
            const subject = `${this.config.subjectPrefix}.${event.eventType}`;
            await this.natsClient.publish(subject, event); // msgID dedup native
            await queryRunner.query(`UPDATE outbox SET status='published', published_at=NOW() WHERE id=$1`, [row.id]);
          } catch (e) {
            const newRetry = row.retry_count + 1;
            const newStatus = newRetry >= MAX_RETRIES ? 'failed' : 'pending';
            await queryRunner.query(
              `UPDATE outbox SET status=$1, retry_count=$2, error_message=$3 WHERE id=$4`,
              [newStatus, newRetry, (e as Error).message, row.id],
            );
            // TODO Story 0.7+ — DLQ stream tukio.dlq if newStatus === 'failed'
          }
        }
        await queryRunner.commitTransaction();
      } catch (e) {
        await queryRunner.rollbackTransaction();
        throw e;
      } finally {
        await queryRunner.release();
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private rowToDomainEvent(row: any): any {
    // Reconstruct DomainEvent shape from outbox row
    return {
      eventId: row.id,
      eventType: row.event_type,
      eventVersion: `v${row.event_version}`,
      occurredAt: row.created_at.toISOString(),
      correlationId: row.correlation_id,
      causationId: null, // row.causation_id si stocké, sinon null
      actor: row.payload._actor /* convention: payload contient _actor + payload réel — à figer */,
      aggregate: { type: row.aggregate_type, id: row.aggregate_id },
      payload: row.payload,
    };
  }

  async isHealthy(): Promise<boolean> {
    try {
      const isListening = !this.listenClient.connection;
      const natsUp = this.natsClient.isConnected();
      const pendingLag = await this.dataSource.query(`SELECT COUNT(*) FROM outbox WHERE status='pending'`);
      return !isListening && natsUp && pendingLag[0].count < 1000;
    } catch {
      return false;
    }
  }
}
```

### Critical Architecture Constraints

> Cf. Architecture lignes 268-275 + 632-663 + 2187-2193 + memories `feedback_clean_architecture_explicit.md`.

1. **Outbox NON NÉGOCIABLE** : tout publish d'event passe par `OutboxPublisher` (jamais publish NATS direct depuis use case). Lint `tukio/no-direct-event-publish` enforce.
2. **Inbox idempotence OBLIGATOIRE** : tous les consumers utilisent `InboxConsumer.handle()` pour dédoublonner via `eventId`. Pas de processing direct dans le `nats.subscribe()` callback.
3. **Correlation propagation transparente** : utiliser `AsyncLocalStorage` (Node natif), pas de passage manuel de `correlationId` à travers les méthodes. Le `OutboxPublisher` lit le contexte automatiquement si `event.correlationId` n'est pas explicitement fourni.
4. **`SKIP LOCKED` obligatoire** dans l'outbox-relay query : permet à plusieurs replicas du service de coexister sans race condition (HPA K8s). Sans `SKIP LOCKED`, 2 replicas peuvent traiter le même event 2× → duplicate publish (NATS dedup mitigerait via `msgID`, mais c'est ceinture-bretelles).
5. **Connexion PG dédiée pour LISTEN** (pas le pool TypeORM main) : `LISTEN` bloque la connexion, ne pas la réutiliser pour les queries normales. Pool size 1 dédié OK.
6. **Subjects NATS namespace par stream** : `tukio.<service>.<eventType>` (ex `tukio.identity.user.registered.v1`). Streams JetStream : `TUKIO_IDENTITY`, `TUKIO_CATALOG`, `TUKIO_BOOKING`, `TUKIO_PAYMENT`, etc. (1 stream par service producteur).
7. **NATS dedup window 2 min** via `msgID = event.eventId` : si le même event est publié 2× dans les 2 min, NATS le dédoublonne automatiquement. Coexiste avec inbox (defense in depth).
8. **Replicas R3 en prod, R1 en dev** : config via env var `NATS_REPLICAS=1` (dev) ou `3` (prod). Géré par `OutboxRelayModule.forRoot({ replicas })`.
9. **DLQ stream `tukio.dlq`** : events avec status `failed` après 3 retries → publiés vers DLQ stream + alerte admin. **Story 0.7 prépare la structure mais ne créé PAS le stream DLQ ni le replay tool** (Story 0.12 + Story 10.3 V1).
10. **Pas d'event consumption dans Story 0.7** : on livre `InboxConsumer` en lib, mais `identity-svc` Story 0.6 ne consume pas d'events (pas de Keycloak webhook real Story 1.x). Les premiers consumers réels arrivent en Stories Epic 1+.

### What this story does NOT do (out of scope)

- ❌ **DLQ stream `tukio.dlq` création + replay tool admin** → Story 0.12 (observability) + Story 10.3 V1 (event replay sensible 🔴)
- ❌ **Webhook Keycloak → identity-svc consume** → Story 1.1 (Provision Keycloak realm) + 1.x (use cases auth)
- ❌ **Stripe webhook → payment-svc transformation en NATS events** → Story 4.5 (Stripe checkout)
- ❌ **Metrics Prometheus exposées via `/metrics` endpoint** → Story 0.12 (Prometheus + Grafana setup)
- ❌ **Alertmanager rules** (NATS lag > 1000, outbox pending > 100 / > 1 min) → Story 0.12
- ❌ **Tests d'intégration testcontainers réels** (vrai PG + vrai NATS) → Story 0.9 (`@tukio/testing` testcontainers helpers)
- ❌ **Branchement dans les 9 autres services backend** (catalog-svc, booking-svc, etc.) → stories Epic 1+ quand chaque service en a besoin
- ❌ **Saga monitoring + alertes saga > 5 min** → Story 4.13 (Epic 4, R11 mitigation)
- ❌ **Multi-region NATS clustering** → V3+ (scale international)

### Files to UPDATE vs CREATE

> **À UPDATE** :
> - `packages/messaging/package.json` — placeholder Story 0.1, cette story ajoute deps + `exports` + scripts
> - `packages/messaging/tsconfig.json` — placeholder Story 0.1, cette story ajuste si besoin
> - `packages/messaging/src/index.ts` — placeholder `export {};` Story 0.1, cette story re-exporte les Symbol tokens
> - `apps/identity-svc/src/infrastructure/messaging/nats/nats-publisher.module.ts` — placeholder Story 0.6, cette story le remplace par real wiring `@tukio/messaging`
> - `apps/identity-svc/.env.example` — étendre avec NATS_URL, NATS_STREAM_NAME, NATS_REPLICAS
> - `apps/identity-svc/src/infrastructure/config/environment-config.service.ts` — ajouter `getNatsConfig()` typed
> - `.eslintrc.cjs` racine — ajouter `tukio/no-direct-event-publish: 'warn'`
> - `tools/eslint-plugin-tukio/src/index.js` — register la nouvelle rule

> **À CREATE** :
> - 5 modules dans `packages/messaging/src/{nats,outbox,inbox,correlation,versioning}/` (~25-30 fichiers)
> - 2 migrations templates dans `outbox/migrations/` + `inbox/migrations/`
> - `packages/messaging/src/__tests__/chaos-nats-disconnect.spec.ts`
> - `packages/messaging/README.md`
> - `tools/eslint-plugin-tukio/src/rules/no-direct-event-publish.js` + tests
> - **Migration baseline outbox+inbox** dans `apps/identity-svc/src/infrastructure/persistence/typeorm/migrations/1715210000000-AddOutboxInboxTables.ts`
> - **Estimation total fichiers créés** : ~35-40 fichiers

> **À DELETE** :
> - `apps/identity-svc/src/infrastructure/messaging/nats/nats.publisher.ts` (placeholder Story 0.6 — remplacé par @tukio/messaging)

### Previous Story Intelligence (Stories 0.1 → 0.6)

**Story 0.1** : `packages/messaging/` placeholder existant (package.json + tsconfig + src/index.ts vides).

**Story 0.2** : `@tukio/contracts` livré — Story 0.7 consomme `@tukio/contracts/types/DomainEvent` (interface DomainEvent root) + `@tukio/contracts/types/Actor` (pour event.actor). Lint custom `tukio/event-naming` actif → tout `eventType` doit respecter format `<service>.<aggregate>.<event>.v<n>` (la `subjects.ts` Task 2.3 doit produire des subjects compatibles).

**Story 0.3-0.5** : frontend uniquement, aucun impact sur Story 0.7.

**Story 0.6** : pattern Pretre + identity-svc complet avec :
- `NatsPublisher` placeholder (à supprimer Task 9.1)
- `EVENT_PUBLISHER` Symbol token défini dans `apps/identity-svc/src/domain/ports/tokens.ts` — Story 0.7 wire `OUTBOX_PUBLISHER` (depuis `@tukio/messaging`) sur ce token via `useExisting`
- `EnvironmentConfigService` avec validation Zod — Story 0.7 ajoute `getNatsConfig()` method
- `eslint-plugin-boundaries` strict actif sur Pattern Pretre — `@tukio/messaging` est consommée par `infrastructure/messaging/nats/`, jamais par `domain/` (lint enforce)
- DataSource TypeORM avec `tukio_identity` DB — Story 0.7 ajoute migration outbox/inbox dans cette même DB
- Pattern subpath `exports` figé — Story 0.7 réplique pour `@tukio/messaging`
- ConfigService Zod-validated — Story 0.7 étend le schema env vars
- ResponseEnvelopeInterceptor + EnvelopeExceptionFilter — Story 0.7 ne touche pas (pas de nouveaux endpoints)

### Conventions à respecter (rappel)

| Convention | Règle | Application Story 0.7 |
|---|---|---|
| EN strict | Files PascalCase ou kebab-case selon type | ✅ tous les fichiers |
| camelCase JS/TS | `outboxPublisher`, `correlationId` | ✅ tous |
| Symbol DI tokens SCREAMING_SNAKE_CASE | `OUTBOX_PUBLISHER`, `INBOX_CONSUMER`, `NATS_JETSTREAM_CLIENT` | ✅ tous |
| Subpath exports | `@tukio/messaging/outbox/relay`, jamais barrel | ✅ tous les imports |
| `<entity>.entity.ts` TypeORM | `outbox.entity.ts`, `inbox.entity.ts` | ✅ |
| Migrations `<timestamp>-<PascalCase>.ts` | `1715210000000-AddOutboxInboxTables.ts` | ✅ |
| EventType format strict | `<service>.<aggregate>.<event>.v<n>` lowercase | ✅ enforced via lint Story 0.2 |
| Outbox-first publish | Use cases publish via OutboxPublisher only | ✅ enforced via lint AC13 |
| Coverage NFR71 | infrastructure ≥ 50 %, lib internals ≥ 80 % | ✅ vitest thresholds |

### Testing Standards

- **Coverage cible** : ≥ 80 % par module dans `packages/messaging/src/` (cohérent NFR71 lib internals).
- **Framework** : Vitest 3.x (cohérent Story 0.2).
- **Niveaux de tests** :
  - **Unit tests** (Tasks 2.5, 3.4, 4.5, 5.4, 6.4, 7.2) : mocks tout (pg-mem pour DB, mock NATS client, fake timers Vitest pour polling)
  - **Tests chaos minimal** (Task 10) : scénario disconnect + reprise avec mocks (skip si trop complexe sans Story 0.9)
  - **E2E identity-svc** (Task 9.7) : démarrer app + insert outbox + assert (cleanup post-validation)
- **Pas de testcontainers réels** dans Story 0.7 (`@tukio/testing` arrive Story 0.9). `pg-mem` fait l'affaire pour les unit tests.

### Project Structure Notes

✅ **Aligné** avec Architecture §Détail libs partagées lignes 2187-2193 (5 modules: nats-jetstream-client, outbox-publisher, inbox-consumer, correlation-context, event-versioning + index).

✅ **Aligné** avec Architecture §Outbox & Inbox Tables lignes 632-663 (schema SQL exact reproduit dans migrations templates AC8).

✅ **Aligné** avec PRD NFR42 (fallback polling 30s) + R13 mitigation (healthcheck dédié + alerte > 100 msg pending).

✅ **Aligné** avec ADR-002 (NATS JetStream) + ADR-006 (saga choréographée) + ADR-007 (outbox pattern).

⚠️ **Décision documentée** : `@horizon-republic/nestjs-jetstream` est mentionné dans Architecture (ligne 123, 543, 2188) mais **sa maintenance et sa fraîcheur doivent être vérifiées au moment du dev**. Si la lib est stagnante (commit > 6 mois) ou si elle ne supporte pas NestJS 11, on **fallback sur le SDK officiel `nats`** directement (qui inclut JetStream support natif depuis nats.js 2.x). Cette décision est **flexible** et documentée dans Debug Log References.

⚠️ **Décision documentée** : la **convention de stocker `actor` dans le payload outbox** vs colonne séparée n'est pas figée. Le squelette code AC4 propose `actor` dans `payload._actor`, mais une alternative est d'avoir une colonne `actor JSONB` dans la table outbox. **Décision** : garder dans payload pour simplicité Sprint 0, refactoriser V1 si pattern devient encombrant. Documenter la décision dans le code TypeORM Entity.

⚠️ **À noter** : la **stratégie de subjects NATS** (`tukio.<service>.<eventType>`) coexiste avec le naming `eventType` (`<service>.<aggregate>.<event>.v<n>`). Exemple : event `eventType = 'identity.user.registered.v1'` est publié sur subject `tukio.identity.identity.user.registered.v1` (préfixe namespace + eventType). C'est verbeux mais cohérent. **Alternative envisagée** : subject = eventType direct (`'identity.user.registered.v1'`). **Décision finale Story 0.7** : préfixer avec `tukio.` pour permettre l'isolation prod/staging via subject hierarchy NATS (`tukio-staging.<service>.<eventType>`). Le préfixe est config dans `OutboxRelayModule.forRoot({ subjectPrefix })`.

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Cross-Cutting-Saga-Distribuée — Lines 268-275 (saga choréographée + outbox + inbox + DLQ)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Outbox-Inbox-Tables — Lines 632-663 (schema SQL outbox + inbox + PG LISTEN/NOTIFY)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Détail-libs-partagées-messaging — Lines 2187-2193 (5 modules structure)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Communication-Patterns — Lines 1572-1611 (Event Payload Structure NATS, DomainEvent envelope)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Saga-Correlation — Lines 1606-1611 (correlationId propagation logs centralisés)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Decision-Priority-Analysis — Line 571 (ADR-002 NATS JetStream), 575 (ADR-006 saga choréographée), 576 (ADR-007 outbox pattern)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Bundle-Optimization — Lines 956-962 (anti-barrel)]
- [Source: _bmad-output/planning-artifacts/epics.md#Story-0.7 — Lines 955-968 (6 ACs originaux : 5 modules, OutboxPublisher tx, InboxConsumer idempotence, CorrelationContext, EventVersioning, chaos test NATS down 30s)]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR40 — replicas R3 + DLQ stream]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR41 — consumer lag < 100 msg nominal, alerte > 1000]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR42 — outbox relay fallback polling 30s, alerte > 100 msg / > 1 min]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR43 — saga > 5min alert + replay (Story 4.13 V1)]
- [Source: _bmad-output/planning-artifacts/prd.md#R12 — NATS perte de message mitigation]
- [Source: _bmad-output/planning-artifacts/prd.md#R13 — outbox relay panne mitigation]
- [Source: _bmad-output/implementation-artifacts/0-2-initialize-tukio-contracts-envelope-nats-events-dtos.md — Story 0.2 dev context (DomainEvent envelope, eventType format `<service>.<aggregate>.<event>.v<n>`, lint `tukio/event-naming`)]
- [Source: _bmad-output/implementation-artifacts/0-6-pattern-pretre-scaffolding-template-identity-svc.md — Story 0.6 dev context (NatsPublisher placeholder à remplacer, EVENT_PUBLISHER Symbol token, EnvironmentConfigService Zod, ConfigService pattern)]
- [External: https://docs.nats.io/using-nats/developer/connecting (NATS connection patterns, reconnect strategies)]
- [External: https://docs.nats.io/nats-concepts/jetstream (JetStream concepts: streams, consumers, deduplication via msgID)]
- [External: https://node-postgres.com/features/notifications (PG LISTEN/NOTIFY pattern in node-postgres)]
- [Memory: feedback_latest_versions.md — vérifier `pnpm view <pkg> version` au moment du dev]
- [Memory: feedback_clean_architecture_explicit.md — interfaces dans domain/ports, impls dans infrastructure/]
- [Memory: feedback_tech_layer_english.md — code/aria-label EN strict]
- [Memory: feedback_api_envelope_response.md — enveloppe REST canonique (cohérent avec event publishing patterns ici)]

## Dev Agent Record

### Agent Model Used

(à remplir par le dev agent au démarrage de l'implémentation)

### Debug Log References

(à remplir au cours de l'implémentation — décision @horizon-republic/nestjs-jetstream vs nats SDK direct, version retenue, conflits de compat éventuels avec NestJS 11, stratégie subject naming finale, choix pg-mem vs autre lib in-memory PG)

### Completion Notes List

(à remplir à la fin — résumé des décisions, déviations vs Dev Notes avec justification, points d'attention pour Story 0.8 (KeycloakJwtGuard branchement), Story 0.9 (testcontainers réels remplacent pg-mem), Story 0.12 (DLQ stream + Prometheus exposition), Story 4.13 (saga monitoring V1))

### File List

(à remplir à la fin — liste exhaustive des fichiers créés / modifiés / supprimés, avec chemins relatifs depuis la racine du repo)

---

## Story Completion Status

- **Story Status** : `ready-for-dev`
- **Created** : 2026-05-09
- **Created by** : `bmad-create-story` workflow
- **Epic** : Epic 0 — Sprint 0 Foundation (MVP, foundational)
- **Sprint cible** : Sprint 0 (semaines 1-3 du planning MVP)
- **Estimation effort** : 4-5 jours (5 modules complexes : NATS wrapper + outbox/inbox + correlation context + versioning + chaos test + identity-svc wiring + lint custom)
- **Dépendances upstream** :
  - Story 0.1 (`ready-for-dev`) — `packages/messaging/` placeholder
  - Story 0.2 (`ready-for-dev`) — `@tukio/contracts/types/DomainEvent` + `Actor` consommés + lint `tukio/event-naming`
  - Story 0.6 (`ready-for-dev`) — pattern Pretre identity-svc avec `NatsPublisher` placeholder à remplacer + `EVENT_PUBLISHER` token + DataSource TypeORM
- **Dépendances downstream** :
  - **Stories Epic 1+ (toutes les stories qui publishent ou consomment des events NATS)** :
    - Story 1.1 (Provision Keycloak realm) — branche webhook Keycloak → identity-svc consume via InboxConsumer
    - Stories Epic 2 (Pro onboarding) — admin-svc publish `admin.action.pro-verified.v1` via OutboxPublisher
    - Stories Epic 3 (Catalog) — catalog-svc publish `catalog.listing.published.v1`, consume `media.uploaded.v1`
    - Stories Epic 4 (Booking + Payment) — saga choréographée : booking-svc → order-svc → payment-svc, propagation correlationId end-to-end
    - Stories Epic 5 (Messaging + Reviews + Notifications) — notification-svc consume tous events, review-svc publish `review.submitted.v1`
  - **Story 0.9** (`@tukio/testing`) — fournit testcontainers helpers (Postgres + NATS) pour replace pg-mem dans Story 0.7 chaos tests
  - **Story 0.10** (Docker Compose) — fournit NATS local pour dev `pnpm dev`
  - **Story 0.12** (Helm + observability) — DLQ stream + Prometheus metrics scraping + Alertmanager rules
  - **Story 4.13** (Saga monitoring V1) — alertes saga > 5 min consomment les métriques outbox + NATS lag
- **FRs covered** : aucun FR direct (foundational, prerequis to all messaging-based features)
- **NFRs touchés** :
  - **NFR40** — replicas R3 + DLQ stream (préparation, finalisation Story 0.12) ✅
  - **NFR41** — consumer lag monitoring (métriques exposées) ✅
  - **NFR42** — outbox fallback polling 30s + healthcheck (R13 mitigation) ✅
  - **NFR43** — saga > 5min (préparation infrastructure, finalisation Story 4.13) ✅
  - **NFR67** — pattern `@tukio/messaging` figé ✅
  - **NFR74** — naming + outbox-first enforced via lint custom ✅
  - **R12** — NATS perte mitigation (DLQ stream + monitoring) ✅
  - **R13** — outbox relay panne mitigation (fallback polling + healthcheck) ✅
  - **ADR-002** — préparé (formalisé Story 0.13)
  - **ADR-006** — préparé (formalisé Story 0.13)
  - **ADR-007** — préparé (formalisé Story 0.13)
