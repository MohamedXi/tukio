import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OutboxPublisher } from '../outbox-publisher.js';
import { TransactionContext } from '../transaction-context.js';
import type { DomainEvent } from '@tukio/contracts/types/DomainEvent';

const makeEvent = (id = 'evt-1'): DomainEvent<{ value: string }> => ({
  eventId: id,
  eventType: 'identity.user.registered.v1',
  eventVersion: 'v1',
  occurredAt: new Date().toISOString(),
  correlationId: 'corr-1',
  causationId: null,
  actor: { userId: 'u1', role: 'admin-super', locale: 'fr' },
  aggregate: { type: 'UserProfile', id: 'u1' },
  payload: { value: 'test' },
});

describe('OutboxPublisher', () => {
  let insertFn: ReturnType<typeof vi.fn>;
  let queryFn: ReturnType<typeof vi.fn>;
  let mockManager: { getRepository: () => { insert: typeof insertFn }; query: typeof queryFn };
  let mockDataSource: { manager: typeof mockManager };
  let publisher: OutboxPublisher;

  beforeEach(() => {
    insertFn = vi.fn().mockResolvedValue(undefined);
    queryFn = vi.fn().mockResolvedValue(undefined);
    mockManager = {
      getRepository: () => ({ insert: insertFn }),
      query: queryFn,
    };
    mockDataSource = { manager: mockManager };
    publisher = new OutboxPublisher(mockDataSource as never, undefined);
  });

  it('inserts the event into the outbox table', async () => {
    const event = makeEvent();
    await publisher.publish(event);
    expect(insertFn).toHaveBeenCalledOnce();
    const call = insertFn.mock.calls[0] as [Record<string, unknown>] | undefined;
    const insertedRow = call?.[0];
    expect(insertedRow?.['id']).toBe('evt-1');
    expect(insertedRow?.['status']).toBe('pending');
    expect(insertedRow?.['retryCount']).toBe(0);
    expect(insertedRow?.['eventType']).toBe('identity.user.registered.v1');
  });

  it('uses the transaction-bound EntityManager when TransactionContext is active', async () => {
    const txInsert = vi.fn().mockResolvedValue(undefined);
    const txQuery = vi.fn().mockResolvedValue(undefined);
    const txManager = {
      getRepository: () => ({ insert: txInsert }),
      query: txQuery,
    };
    await TransactionContext.run(txManager as never, async () => {
      await publisher.publish(makeEvent('evt-tx'));
    });
    expect(txInsert).toHaveBeenCalledOnce();
    expect(insertFn).not.toHaveBeenCalled();
  });

  it('emits pg_notify after insert (best-effort)', async () => {
    await publisher.publish(makeEvent());
    expect(queryFn).toHaveBeenCalledWith("SELECT pg_notify('tukio_outbox_new', $1)", ['evt-1']);
  });

  it('does not throw if pg_notify fails (graceful degradation)', async () => {
    queryFn.mockRejectedValue(new Error('pg notify failed'));
    await expect(publisher.publish(makeEvent())).resolves.toBeUndefined();
  });

  it('uses notifyPool when provided', async () => {
    const poolQueryFn = vi.fn().mockResolvedValue(undefined);
    const releaseFn = vi.fn();
    const mockNotifyPool = {
      connect: vi.fn().mockResolvedValue({ query: poolQueryFn, release: releaseFn }),
    };
    const publisherWithPool = new OutboxPublisher(mockDataSource as never, mockNotifyPool as never);
    await publisherWithPool.publish(makeEvent());
    expect(poolQueryFn).toHaveBeenCalledWith(expect.stringContaining('pg_notify'), ['evt-1']);
    expect(releaseFn).toHaveBeenCalledOnce();
  });

  it('releases notifyPool client even when query throws', async () => {
    const releaseFn = vi.fn();
    const mockNotifyPool = {
      connect: vi.fn().mockResolvedValue({
        query: vi.fn().mockRejectedValue(new Error('pg notify failed')),
        release: releaseFn,
      }),
    };
    const publisherWithPool = new OutboxPublisher(mockDataSource as never, mockNotifyPool as never);
    await expect(publisherWithPool.publish(makeEvent())).resolves.toBeUndefined();
    expect(releaseFn).toHaveBeenCalledOnce();
  });
});
