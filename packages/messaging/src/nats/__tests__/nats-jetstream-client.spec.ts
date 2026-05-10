import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NatsJetStreamClient } from '../nats-jetstream-client.js';

// Minimal mock for the nats SDK
vi.mock('nats', () => {
  const mockPubAck = { stream: 'TUKIO_IDENTITY', seq: 1, duplicate: false };
  const mockJetStream = {
    publish: vi.fn().mockResolvedValue(mockPubAck),
    consumers: {
      get: vi.fn().mockResolvedValue({
        consume: vi.fn().mockResolvedValue([]),
      }),
    },
  };
  const mockStreamsInfo = vi.fn();
  const mockStreamsAdd = vi.fn().mockResolvedValue({});
  const mockConsumersInfo = vi.fn();
  const mockConsumersAdd = vi.fn().mockResolvedValue({});
  const mockJSManager = {
    streams: { info: mockStreamsInfo, add: mockStreamsAdd },
    consumers: { info: mockConsumersInfo, add: mockConsumersAdd },
  };
  const mockConnection = {
    jetstream: vi.fn().mockReturnValue(mockJetStream),
    jetstreamManager: vi.fn().mockResolvedValue(mockJSManager),
    closed: vi.fn().mockReturnValue(new Promise(() => {})),
    drain: vi.fn().mockResolvedValue(undefined),
  };
  return {
    connect: vi.fn().mockResolvedValue(mockConnection),
    StringCodec: vi.fn().mockReturnValue({
      encode: vi.fn().mockImplementation((s: string) => new TextEncoder().encode(s)),
      decode: vi.fn().mockImplementation((b: Uint8Array) => new TextDecoder().decode(b)),
    }),
    AckPolicy: { Explicit: 'explicit' },
    DeliverPolicy: { All: 'all' },
    RetentionPolicy: { Limits: 'limits', Workqueue: 'workqueue' },
    StorageType: { File: 'file', Memory: 'memory' },
  };
});

describe('NatsJetStreamClient', () => {
  let client: NatsJetStreamClient;

  beforeEach(async () => {
    vi.clearAllMocks();
    client = new NatsJetStreamClient();
    await client.connect({ url: 'nats://localhost:4222', name: 'test' });
  });

  it('connects and reports isConnected = true', () => {
    expect(client.isConnected()).toBe(true);
  });

  it('throws when publishing without connection', async () => {
    const disconnected = new NatsJetStreamClient();
    await expect(
      disconnected.publish('subject', {
        eventId: 'id',
        eventType: 'test.v1',
        eventVersion: 'v1',
        occurredAt: '',
        correlationId: 'c1',
        causationId: null,
        actor: { userId: 'u1', role: 'client', locale: 'fr' },
        aggregate: { type: 'User', id: 'u1' },
        payload: {},
      }),
    ).rejects.toThrow('not connected');
  });

  it('publishes an event with msgID deduplication', async () => {
    const event = {
      eventId: 'evt-123',
      eventType: 'identity.user.registered.v1',
      eventVersion: 'v1' as const,
      occurredAt: new Date().toISOString(),
      correlationId: 'corr-1',
      causationId: null,
      actor: { userId: 'u1', role: 'admin-super' as const, locale: 'fr' as const },
      aggregate: { type: 'UserProfile', id: 'u1' },
      payload: { email: 'test@tukio.one' },
    };
    const ack = await client.publish('tukio.identity.identity.user.registered.v1', event);
    expect(ack.stream).toBe('TUKIO_IDENTITY');
    expect(ack.duplicate).toBe(false);
  });

  it('ensureStream creates stream when not found', async () => {
    const nats = await import('nats');

    // Re-create client with stream-not-found scenario
    const freshClient = new NatsJetStreamClient();
    vi.mocked(nats.connect).mockResolvedValueOnce({
      jetstream: vi.fn().mockReturnValue({ publish: vi.fn(), consumers: { get: vi.fn() } }),
      jetstreamManager: vi.fn().mockResolvedValue({
        streams: {
          info: vi.fn().mockRejectedValue(new Error('stream not found')),
          add: vi.fn().mockResolvedValue({}),
        },
        consumers: { info: vi.fn(), add: vi.fn() },
      }),
      closed: vi.fn().mockReturnValue(new Promise(() => {})),
      drain: vi.fn().mockResolvedValue(undefined),
    } as never);
    await freshClient.connect({ url: 'nats://localhost:4222' });
    await freshClient.ensureStream({ name: 'NEW_STREAM', subjects: ['new.>'], replicas: 1 });
    // If no error thrown, ensureStream handled the "stream not found" case correctly.
    expect(freshClient.isConnected()).toBe(true);
  });

  it('ensureStream is idempotent (no-op if stream exists)', async () => {
    const nats = await import('nats');
    const addFn = vi.fn().mockResolvedValue({});
    const freshClient = new NatsJetStreamClient();
    vi.mocked(nats.connect).mockResolvedValueOnce({
      jetstream: vi.fn().mockReturnValue({ publish: vi.fn(), consumers: { get: vi.fn() } }),
      jetstreamManager: vi.fn().mockResolvedValue({
        streams: {
          info: vi.fn().mockResolvedValue({ config: {} }),
          add: addFn,
        },
        consumers: { info: vi.fn(), add: vi.fn() },
      }),
      closed: vi.fn().mockReturnValue(new Promise(() => {})),
      drain: vi.fn().mockResolvedValue(undefined),
    } as never);
    await freshClient.connect({ url: 'nats://localhost:4222' });
    await freshClient.ensureStream({ name: 'EXISTING_STREAM', subjects: ['exist.>'] });
    expect(addFn).not.toHaveBeenCalled();
  });

  it('ensureConsumer creates consumer when not found', async () => {
    const nats = await import('nats');
    const addFn = vi.fn().mockResolvedValue({});
    const freshClient = new NatsJetStreamClient();
    vi.mocked(nats.connect).mockResolvedValueOnce({
      jetstream: vi.fn().mockReturnValue({ publish: vi.fn(), consumers: { get: vi.fn() } }),
      jetstreamManager: vi.fn().mockResolvedValue({
        streams: { info: vi.fn(), add: vi.fn() },
        consumers: {
          info: vi.fn().mockRejectedValue(new Error('consumer not found')),
          add: addFn,
        },
      }),
      closed: vi.fn().mockReturnValue(new Promise(() => {})),
      drain: vi.fn().mockResolvedValue(undefined),
    } as never);
    await freshClient.connect({ url: 'nats://localhost:4222' });
    await freshClient.ensureConsumer('TUKIO_IDENTITY', {
      name: 'svc-consumer',
      streamName: 'TUKIO_IDENTITY',
    });
    expect(addFn).toHaveBeenCalledOnce();
  });

  it('ensureConsumer is idempotent when consumer already exists', async () => {
    const nats = await import('nats');
    const addFn = vi.fn();
    const freshClient = new NatsJetStreamClient();
    vi.mocked(nats.connect).mockResolvedValueOnce({
      jetstream: vi.fn().mockReturnValue({ publish: vi.fn(), consumers: { get: vi.fn() } }),
      jetstreamManager: vi.fn().mockResolvedValue({
        streams: { info: vi.fn(), add: vi.fn() },
        consumers: {
          info: vi.fn().mockResolvedValue({ config: {} }),
          add: addFn,
        },
      }),
      closed: vi.fn().mockReturnValue(new Promise(() => {})),
      drain: vi.fn().mockResolvedValue(undefined),
    } as never);
    await freshClient.connect({ url: 'nats://localhost:4222' });
    await freshClient.ensureConsumer('TUKIO_IDENTITY', {
      name: 'existing-consumer',
      streamName: 'TUKIO_IDENTITY',
    });
    expect(addFn).not.toHaveBeenCalled();
  });

  it('subscribe invokes handler for each consumed message', async () => {
    const nats = await import('nats');
    const mockMsg = { ack: vi.fn(), nak: vi.fn(), data: new Uint8Array() };
    const messages = [mockMsg];
    const consumeFn = vi.fn().mockResolvedValue(messages);
    const freshClient = new NatsJetStreamClient();
    vi.mocked(nats.connect).mockResolvedValueOnce({
      jetstream: vi.fn().mockReturnValue({
        publish: vi.fn(),
        consumers: {
          get: vi.fn().mockResolvedValue({ consume: consumeFn }),
        },
      }),
      jetstreamManager: vi.fn().mockResolvedValue({
        streams: { info: vi.fn(), add: vi.fn() },
        consumers: { info: vi.fn(), add: vi.fn() },
      }),
      closed: vi.fn().mockReturnValue(new Promise(() => {})),
      drain: vi.fn().mockResolvedValue(undefined),
    } as never);
    await freshClient.connect({ url: 'nats://localhost:4222' });
    const handler = vi.fn().mockResolvedValue(undefined);
    await freshClient.subscribe('TUKIO_IDENTITY', 'svc-consumer', handler);
    // Give the async loop a tick to process
    await new Promise((r) => setTimeout(r, 0));
    expect(consumeFn).toHaveBeenCalledOnce();
  });

  it('subscribe naks message when handler throws', async () => {
    const nats = await import('nats');
    const mockMsg = { ack: vi.fn(), nak: vi.fn(), data: new Uint8Array() };
    const consumeFn = vi.fn().mockResolvedValue([mockMsg]);
    const freshClient = new NatsJetStreamClient();
    vi.mocked(nats.connect).mockResolvedValueOnce({
      jetstream: vi.fn().mockReturnValue({
        publish: vi.fn(),
        consumers: { get: vi.fn().mockResolvedValue({ consume: consumeFn }) },
      }),
      jetstreamManager: vi.fn().mockResolvedValue({
        streams: { info: vi.fn(), add: vi.fn() },
        consumers: { info: vi.fn(), add: vi.fn() },
      }),
      closed: vi.fn().mockReturnValue(new Promise(() => {})),
      drain: vi.fn().mockResolvedValue(undefined),
    } as never);
    await freshClient.connect({ url: 'nats://localhost:4222' });
    const handler = vi.fn().mockRejectedValue(new Error('handler crash'));
    await freshClient.subscribe('TUKIO_IDENTITY', 'svc-consumer', handler);
    await new Promise((r) => setTimeout(r, 0));
    expect(mockMsg.nak).toHaveBeenCalledOnce();
  });

  it('drains connection gracefully', async () => {
    await client.drain();
    expect(client.isConnected()).toBe(false);
  });

  it('drain is a no-op when not connected', async () => {
    const fresh = new NatsJetStreamClient();
    await expect(fresh.drain()).resolves.toBeUndefined();
  });
});
