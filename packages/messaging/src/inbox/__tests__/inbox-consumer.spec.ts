import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InboxConsumer } from '../inbox-consumer.js';
import type { DomainEvent } from '@tukio/contracts/types/DomainEvent';

vi.mock('nats', () => ({
  StringCodec: () => ({
    encode: (s: string) => new TextEncoder().encode(s),
    decode: (b: Uint8Array) => new TextDecoder().decode(b),
  }),
}));

const makeJsMsg = (event: DomainEvent<unknown>, redeliveryCount = 0) => ({
  data: new TextEncoder().encode(JSON.stringify(event)),
  ack: vi.fn(),
  nak: vi.fn(),
  term: vi.fn(),
  info: { redeliveryCount },
});

const makeEvent = (id = 'evt-1'): DomainEvent<{ val: number }> => ({
  eventId: id,
  eventType: 'identity.user.registered.v1',
  eventVersion: 'v1',
  occurredAt: new Date().toISOString(),
  correlationId: 'corr-1',
  causationId: null,
  actor: { userId: 'u1', role: 'client', locale: 'fr' },
  aggregate: { type: 'UserProfile', id: 'u1' },
  payload: { val: 42 },
});

describe('InboxConsumer', () => {
  let consumer: InboxConsumer;
  let findOneFn: ReturnType<typeof vi.fn>;
  let insertFn: ReturnType<typeof vi.fn>;
  let updateFn: ReturnType<typeof vi.fn>;
  let mockQR: Record<string, unknown>;

  beforeEach(() => {
    findOneFn = vi.fn().mockResolvedValue(null);
    insertFn = vi.fn().mockResolvedValue(undefined);
    updateFn = vi.fn().mockResolvedValue(undefined);

    mockQR = {
      connect: vi.fn().mockResolvedValue(undefined),
      startTransaction: vi.fn().mockResolvedValue(undefined),
      commitTransaction: vi.fn().mockResolvedValue(undefined),
      rollbackTransaction: vi.fn().mockResolvedValue(undefined),
      release: vi.fn().mockResolvedValue(undefined),
      manager: {
        findOne: findOneFn,
        getRepository: () => ({ insert: insertFn }),
        update: updateFn,
      },
    };

    consumer = new InboxConsumer({
      createQueryRunner: vi.fn().mockReturnValue(mockQR),
    } as never);
  });

  it('processes a new event and acks the message', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const msg = makeJsMsg(makeEvent());
    await consumer.handle(msg as never, handler);
    expect(handler).toHaveBeenCalledOnce();
    expect(msg.ack).toHaveBeenCalledOnce();
    expect(insertFn).toHaveBeenCalledOnce();
  });

  it('skips a duplicate event and acks without calling handler', async () => {
    findOneFn.mockResolvedValue({ eventId: 'evt-1' }); // already processed
    const handler = vi.fn();
    const msg = makeJsMsg(makeEvent());
    await consumer.handle(msg as never, handler);
    expect(handler).not.toHaveBeenCalled();
    expect(msg.ack).toHaveBeenCalledOnce();
  });

  it('naks with backoff on handler failure', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('handler crash'));
    const msg = makeJsMsg(makeEvent());
    await consumer.handle(msg as never, handler);
    expect(msg.nak).toHaveBeenCalledOnce();
    expect(msg.ack).not.toHaveBeenCalled();
  });

  it('terms the message after MAX_RETRIES (5) delivery attempts', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('handler crash'));
    const msg = makeJsMsg(makeEvent(), 5);
    await consumer.handle(msg as never, handler);
    expect(msg.term).toHaveBeenCalledOnce();
    expect(msg.nak).not.toHaveBeenCalled();
  });

  it('skips events with unsupported version', async () => {
    const handler = vi.fn();
    const event = { ...makeEvent(), eventType: 'identity.user.registered.v3' };
    const msg = makeJsMsg(event as never);
    await consumer.handle(msg as never, handler, ['v1', 'v2']);
    expect(handler).not.toHaveBeenCalled();
    expect(msg.ack).toHaveBeenCalledOnce();
  });

  it('terms the message when JSON is invalid', async () => {
    const handler = vi.fn();
    const msg = {
      data: new TextEncoder().encode('not-valid-json'),
      ack: vi.fn(),
      nak: vi.fn(),
      term: vi.fn(),
      info: { redeliveryCount: 0 },
    };
    await consumer.handle(msg as never, handler);
    expect(msg.term).toHaveBeenCalledOnce();
    expect(handler).not.toHaveBeenCalled();
  });
});
