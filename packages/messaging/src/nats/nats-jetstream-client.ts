import {
  connect,
  type NatsConnection,
  type JetStreamClient,
  type JetStreamManager,
  type JsMsg,
  type PubAck as NatsPubAck,
  AckPolicy,
  DeliverPolicy,
  RetentionPolicy,
  StorageType,
  StringCodec,
} from 'nats';
import { Counter, Gauge, Registry } from 'prom-client';
import type { DomainEvent } from '@tukio/contracts/types/DomainEvent';
import type { ConsumerConfig, NatsJetStreamConfig, PubAck, StreamConfig } from './types.js';

const sc = StringCodec();

export const natsClientRegistry = new Registry();

// Module-level metrics — registered once, shared across all client instances.
const natsPublishedCounter = new Counter({
  name: 'tukio_nats_messages_published_total',
  help: 'Total NATS JetStream messages published',
  labelNames: ['stream', 'subject'] as const,
  registers: [natsClientRegistry],
});

const natsConsumerLagGauge = new Gauge({
  name: 'tukio_nats_consumer_lag_messages',
  help: 'Approximate number of pending messages in a NATS consumer',
  labelNames: ['stream', 'consumer'] as const,
  registers: [natsClientRegistry],
});

// Singleton NATS JetStream client — wraps the official nats.js SDK.
// @horizon-republic/nestjs-jetstream was evaluated but unavailable on npm (2026-05-10).
// Using nats@2.29.3 SDK directly (includes full JetStream support).
export class NatsJetStreamClient {
  private connection?: NatsConnection;
  private jsClient?: JetStreamClient;
  private jsManager?: JetStreamManager;
  private connected = false;

  async connect(config: NatsJetStreamConfig): Promise<void> {
    const servers = Array.isArray(config.url) ? config.url : [config.url];
    this.connection = await connect({
      servers,
      name: config.name ?? 'tukio-service',
      reconnect: config.reconnect ?? true,
      maxReconnectAttempts: config.maxReconnectAttempts ?? -1,
      reconnectTimeWait: config.reconnectTimeWait ?? 2_000,
      pingInterval: config.pingInterval ?? 30_000,
    });
    this.jsClient = this.connection.jetstream();
    this.jsManager = await this.connection.jetstreamManager();
    this.connected = true;

    this.connection
      .closed()
      .then(() => {
        this.connected = false;
      })
      .catch(() => {
        this.connected = false;
      });
  }

  isConnected(): boolean {
    return this.connected;
  }

  async ensureStream(streamConfig: StreamConfig): Promise<void> {
    this.assertConnected();
    const mgr = this.jsManager!;
    const maxAgeSecs = (streamConfig.maxAgeDays ?? 7) * 86_400;
    try {
      await mgr.streams.info(streamConfig.name);
    } catch (err) {
      if (!isNotFoundError(err)) throw err;
      await mgr.streams.add({
        name: streamConfig.name,
        subjects: streamConfig.subjects,
        storage: streamConfig.storageType === 'memory' ? StorageType.Memory : StorageType.File,
        num_replicas: streamConfig.replicas ?? 1,
        retention:
          streamConfig.retentionPolicy === 'workqueue'
            ? RetentionPolicy.Workqueue
            : RetentionPolicy.Limits,
        max_age: maxAgeSecs * 1_000_000_000, // nanoseconds (Nanos = number in nats SDK)
      });
    }
  }

  async ensureConsumer(streamName: string, consumerConfig: ConsumerConfig): Promise<void> {
    this.assertConnected();
    const mgr = this.jsManager!;
    try {
      await mgr.consumers.info(streamName, consumerConfig.name);
    } catch (err) {
      if (!isNotFoundError(err)) throw err;
      await mgr.consumers.add(streamName, {
        durable_name: consumerConfig.name,
        ack_policy: AckPolicy.Explicit,
        deliver_policy: DeliverPolicy.All,
        max_deliver: consumerConfig.maxDeliver ?? 5,
        ack_wait: (consumerConfig.ackWaitSeconds ?? 30) * 1_000_000_000,
        filter_subject: consumerConfig.filterSubject,
      });
    }
  }

  async publish<TPayload>(subject: string, event: DomainEvent<TPayload>): Promise<PubAck> {
    this.assertConnected();
    const js = this.jsClient!;
    const payload = sc.encode(JSON.stringify(event));
    const ack: NatsPubAck = await js.publish(subject, payload, {
      msgID: event.eventId,
    });
    natsPublishedCounter.inc({ stream: ack.stream, subject });
    return {
      stream: ack.stream,
      seq: ack.seq,
      duplicate: ack.duplicate,
    };
  }

  async subscribe(
    streamName: string,
    consumerName: string,
    handler: (msg: JsMsg) => Promise<void>,
  ): Promise<void> {
    this.assertConnected();
    const js = this.jsClient!;
    const consumer = await js.consumers.get(streamName, consumerName);

    // Update lag gauge from consumer info (best-effort).
    try {
      const info = await consumer.info();
      natsConsumerLagGauge.set({ stream: streamName, consumer: consumerName }, info.num_pending);
    } catch {
      /* best-effort — gauge stays at last known value */
    }

    const messages = await consumer.consume();
    void (async () => {
      for await (const msg of messages) {
        try {
          await handler(msg);
        } catch {
          msg.nak();
        }
      }
    })();
  }

  async drain(): Promise<void> {
    if (this.connection) {
      await this.connection.drain();
      this.connected = false;
    }
  }

  private assertConnected(): void {
    if (!this.connected || !this.jsClient) {
      throw new Error('NatsJetStreamClient: not connected — call connect() first.');
    }
  }
}

export const NATS_JETSTREAM_CLIENT = Symbol('NATS_JETSTREAM_CLIENT');

// NATS "not found" detection: nats.js throws a NatsError with a message containing
// "not found" or "404" for non-existent streams/consumers.
function isNotFoundError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return msg.includes('not found') || msg.includes('404');
}
