import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Pool, type PoolClient } from 'pg';
import type { DataSource } from 'typeorm';
import { Counter, Gauge, Registry } from 'prom-client';
import type { NatsJetStreamClient } from '../nats/nats-jetstream-client.js';
import { NATS_JETSTREAM_CLIENT } from '../nats/nats-jetstream-client.js';
import type { DomainEvent } from '@tukio/contracts/types/DomainEvent';
import type { Actor } from '@tukio/contracts/types/Actor';

const POLL_INTERVAL_MS = 30_000;
const BATCH_SIZE = 100;
const MAX_RETRIES = 3;

export const OUTBOX_RELAY_CONFIG = Symbol('OUTBOX_RELAY_CONFIG');

export interface OutboxRelayConfig {
  streamName: string;
  subjectPrefix: string;
  replicas?: number;
}

export const promRegistry = new Registry();

@Injectable()
export class OutboxRelayService implements OnModuleInit, OnModuleDestroy {
  private listenClient?: PoolClient;
  private pollTimer?: ReturnType<typeof setInterval>;
  private isProcessing = false;

  private readonly publishedCounter: Counter;
  private readonly failedCounter: Counter;
  private readonly pendingGauge: Gauge;

  constructor(
    @Inject(OUTBOX_RELAY_CONFIG) private readonly config: OutboxRelayConfig,
    @Inject('OUTBOX_LISTEN_POOL') private readonly pool: Pool,
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(NATS_JETSTREAM_CLIENT) private readonly natsClient: NatsJetStreamClient,
  ) {
    this.publishedCounter = new Counter({
      name: 'tukio_outbox_published_total',
      help: 'Total outbox events successfully published to NATS',
      labelNames: ['service'] as const,
      registers: [promRegistry],
    });
    this.failedCounter = new Counter({
      name: 'tukio_outbox_failed_total',
      help: 'Total outbox events that failed to publish after max retries',
      labelNames: ['service', 'reason'] as const,
      registers: [promRegistry],
    });
    this.pendingGauge = new Gauge({
      name: 'tukio_outbox_pending_lag_messages',
      help: 'Number of outbox events currently pending',
      labelNames: ['service'] as const,
      registers: [promRegistry],
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      this.listenClient = await this.pool.connect();
      await this.listenClient.query('LISTEN tukio_outbox_new');
      this.listenClient.on('notification', () => {
        void this.processPendingOutbox().catch(() => {});
      });
    } catch {
      // PG LISTEN failed — relay falls back to polling only.
    }

    this.pollTimer = setInterval(
      () => void this.processPendingOutbox().catch(() => {}),
      POLL_INTERVAL_MS,
    );

    // Catch up any pending events accumulated during downtime.
    void this.processPendingOutbox().catch(() => {});
  }

  async onModuleDestroy(): Promise<void> {
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.listenClient) {
      try {
        await this.listenClient.query('UNLISTEN tukio_outbox_new');
        this.listenClient.release();
      } catch {
        /* graceful shutdown — ignore errors */
      }
    }
    if (this.natsClient.isConnected()) {
      await this.natsClient.drain();
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      const natsOk = this.natsClient.isConnected();
      const result: Array<{ count: string }> = await this.dataSource.query(
        `SELECT COUNT(*) AS count FROM outbox WHERE status = 'pending'`,
      );
      const pendingCount = parseInt(result[0]?.count ?? '0', 10);
      // listenClient may be absent when PG LISTEN failed at init — relay works via polling in that case.
      return natsOk && pendingCount < 1000;
    } catch {
      return false;
    }
  }

  async processPendingOutbox(): Promise<void> {
    if (this.isProcessing || !this.natsClient.isConnected()) return;
    this.isProcessing = true;

    try {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        const rows: Array<Record<string, unknown>> = await queryRunner.query(
          `SELECT * FROM outbox WHERE status = 'pending' ORDER BY created_at LIMIT $1 FOR UPDATE SKIP LOCKED`,
          [BATCH_SIZE],
        );

        for (const row of rows) {
          try {
            const event = this.rowToDomainEvent(row);
            const subject = `${this.config.subjectPrefix}.${String(row['event_type'])}`;
            await this.natsClient.publish(subject, event);
            await queryRunner.query(
              `UPDATE outbox SET status = 'published', published_at = NOW() WHERE id = $1`,
              [row['id']],
            );
            this.publishedCounter.inc({ service: this.config.streamName });
          } catch (err) {
            const newRetry = (Number(row['retry_count']) || 0) + 1;
            // > MAX_RETRIES gives MAX_RETRIES genuine retries after the first attempt.
            const newStatus = newRetry > MAX_RETRIES ? 'failed' : 'pending';
            const errorMsg = err instanceof Error ? err.message : String(err);
            await queryRunner.query(
              `UPDATE outbox SET status = $1, retry_count = $2, error_message = $3 WHERE id = $4`,
              [newStatus, newRetry, errorMsg, row['id']],
            );
            if (newStatus === 'failed') {
              this.failedCounter.inc({ service: this.config.streamName, reason: 'max_retries' });
            }
          }
        }

        await queryRunner.commitTransaction();
      } catch (err) {
        await queryRunner.rollbackTransaction();
        throw err;
      } finally {
        await queryRunner.release();
      }

      // Update pending gauge.
      try {
        const result: Array<{ count: string }> = await this.dataSource.query(
          `SELECT COUNT(*) AS count FROM outbox WHERE status = 'pending'`,
        );
        this.pendingGauge.set(
          { service: this.config.streamName },
          parseInt(result[0]?.count ?? '0', 10),
        );
      } catch {
        /* metrics are best-effort — never crash the relay */
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private rowToDomainEvent(row: Record<string, unknown>): DomainEvent<unknown> {
    const payload = row['payload'] as Record<string, unknown>;
    const actor = (payload['_actor'] ?? {}) as Actor;
    const { _actor: _removed, ...eventPayload } = payload;

    const rawCreatedAt = row['created_at'];
    if (rawCreatedAt == null) {
      throw new Error(`outbox row ${String(row['id'])} has null created_at — data integrity issue`);
    }
    const parsedDate = new Date(String(rawCreatedAt));
    if (isNaN(parsedDate.getTime())) {
      throw new Error(
        `outbox row ${String(row['id'])} has invalid created_at: "${String(rawCreatedAt)}"`,
      );
    }

    const rawCorrelationId = row['correlation_id'];
    if (rawCorrelationId == null || String(rawCorrelationId) === 'null') {
      throw new Error(`outbox row ${String(row['id'])} has null/invalid correlation_id`);
    }

    return {
      eventId: String(row['id']),
      eventType: String(row['event_type']),
      eventVersion: `v${String(row['event_version'])}` as 'v1' | 'v2',
      occurredAt: parsedDate.toISOString(),
      correlationId: String(rawCorrelationId),
      causationId: null,
      actor,
      aggregate: {
        type: String(row['aggregate_type']),
        id: String(row['aggregate_id']),
      },
      payload: eventPayload,
    };
  }
}
