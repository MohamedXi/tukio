import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OutboxRelayService } from '../outbox-relay.service.js';

vi.mock('prom-client', () => ({
  Counter: function Counter() {
    return { inc: vi.fn() };
  },
  Gauge: function Gauge() {
    return { set: vi.fn() };
  },
  Registry: function Registry() {
    return {};
  },
}));

const makeRow = (id: string, retryCount = 0) => ({
  id,
  aggregate_type: 'UserProfile',
  aggregate_id: 'u1',
  event_type: 'identity.user.registered.v1',
  event_version: 1,
  payload: { _actor: { userId: 'u1', role: 'client', locale: 'fr' }, value: 'data' },
  correlation_id: 'corr-1',
  status: 'pending',
  retry_count: retryCount,
  created_at: new Date(),
});

describe('OutboxRelayService', () => {
  let relay: OutboxRelayService;
  let natsPublishFn: ReturnType<typeof vi.fn>;
  let queryFn: ReturnType<typeof vi.fn>;
  let queryRunnerQueryFn: ReturnType<typeof vi.fn>;
  let mockQR: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    natsPublishFn = vi
      .fn()
      .mockResolvedValue({ stream: 'TUKIO_IDENTITY', seq: 1, duplicate: false });
    queryFn = vi.fn().mockResolvedValue([{ count: '0' }]);
    queryRunnerQueryFn = vi.fn();

    mockQR = {
      connect: vi.fn().mockResolvedValue(undefined),
      startTransaction: vi.fn().mockResolvedValue(undefined),
      commitTransaction: vi.fn().mockResolvedValue(undefined),
      rollbackTransaction: vi.fn().mockResolvedValue(undefined),
      release: vi.fn().mockResolvedValue(undefined),
      query: queryRunnerQueryFn,
    };

    const mockDataSource = {
      createQueryRunner: vi.fn().mockReturnValue(mockQR),
      query: queryFn,
    };
    const mockNats = {
      publish: natsPublishFn,
      isConnected: vi.fn().mockReturnValue(true),
      drain: vi.fn().mockResolvedValue(undefined),
    };
    const mockPool = {
      connect: vi.fn().mockResolvedValue({
        query: vi.fn().mockResolvedValue(undefined),
        on: vi.fn(),
        release: vi.fn(),
      }),
    };
    const config = { streamName: 'TUKIO_IDENTITY', subjectPrefix: 'tukio.identity' };

    relay = new OutboxRelayService(
      config,
      mockPool as never,
      mockDataSource as never,
      mockNats as never,
    );
  });

  afterEach(() => vi.restoreAllMocks());

  it('publishes pending rows and marks them published', async () => {
    queryRunnerQueryFn
      .mockResolvedValueOnce([makeRow('evt-1')]) // SELECT pending
      .mockResolvedValue(undefined); // UPDATE

    await relay.processPendingOutbox();
    expect(natsPublishFn).toHaveBeenCalledOnce();
    expect(queryRunnerQueryFn).toHaveBeenCalledWith(
      expect.stringContaining("status = 'published'"),
      ['evt-1'],
    );
  });

  it('increments retry_count on NATS publish failure and keeps status pending', async () => {
    natsPublishFn.mockRejectedValue(new Error('NATS down'));
    queryRunnerQueryFn.mockResolvedValueOnce([makeRow('evt-fail', 0)]).mockResolvedValue(undefined);

    await relay.processPendingOutbox();
    const updateCall = queryRunnerQueryFn.mock.calls.find(
      (args) => Array.isArray(args) && args[0]?.includes('retry_count'),
    );
    expect(updateCall).toBeTruthy();
    expect(updateCall![1]).toContain('pending'); // still pending (retry_count < MAX)
  });

  it('sets status=failed after MAX_RETRIES (3)', async () => {
    natsPublishFn.mockRejectedValue(new Error('NATS down'));
    queryRunnerQueryFn
      .mockResolvedValueOnce([makeRow('evt-fail', 3)]) // retry_count already 3
      .mockResolvedValue(undefined);

    await relay.processPendingOutbox();
    const updateCall = queryRunnerQueryFn.mock.calls.find(
      (args) => Array.isArray(args) && args[0]?.includes('retry_count'),
    );
    expect(updateCall![1]).toContain('failed');
  });

  it('skips processing when NATS is not connected', async () => {
    (relay as unknown as { natsClient: { isConnected: () => boolean } }).natsClient.isConnected = vi
      .fn()
      .mockReturnValue(false);
    await relay.processPendingOutbox();
    expect(queryRunnerQueryFn).not.toHaveBeenCalled();
  });

  it('is not reentrant — concurrent processPendingOutbox calls are skipped', async () => {
    queryRunnerQueryFn.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 10));
      return [];
    });
    const [, second] = await Promise.all([
      relay.processPendingOutbox(),
      relay.processPendingOutbox(),
    ]);
    expect(second).toBeUndefined();
    expect(queryRunnerQueryFn).toHaveBeenCalledTimes(1);
  });

  it('onModuleInit starts LISTEN and sets up poll timer', async () => {
    vi.useFakeTimers();
    queryRunnerQueryFn.mockResolvedValue([]);
    await relay.onModuleInit();
    expect((relay as unknown as { listenClient: unknown }).listenClient).toBeTruthy();
    vi.useRealTimers();
  });

  it('onModuleDestroy clears timer and releases LISTEN client', async () => {
    vi.useFakeTimers();
    queryRunnerQueryFn.mockResolvedValue([]);
    await relay.onModuleInit();
    await relay.onModuleDestroy();
    const listenClient = (
      relay as unknown as {
        listenClient: { query: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> };
      }
    ).listenClient;
    expect(listenClient.release).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('isHealthy returns true when NATS connected and pending < 1000', async () => {
    queryRunnerQueryFn.mockResolvedValue([]);
    await relay.onModuleInit();
    queryFn.mockResolvedValue([{ count: '5' }]);
    const healthy = await relay.isHealthy();
    expect(healthy).toBe(true);
  });

  it('isHealthy returns false when pending >= 1000', async () => {
    queryRunnerQueryFn.mockResolvedValue([]);
    await relay.onModuleInit();
    queryFn.mockResolvedValue([{ count: '1001' }]);
    const healthy = await relay.isHealthy();
    expect(healthy).toBe(false);
  });

  it('isHealthy returns false on DB error', async () => {
    queryRunnerQueryFn.mockResolvedValue([]);
    await relay.onModuleInit();
    queryFn.mockRejectedValue(new Error('db down'));
    const healthy = await relay.isHealthy();
    expect(healthy).toBe(false);
  });

  it('rolls back transaction when queryRunner.commitTransaction throws', async () => {
    queryRunnerQueryFn.mockResolvedValueOnce([makeRow('evt-1')]);
    (mockQR.commitTransaction as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('commit failed'),
    );
    await expect(relay.processPendingOutbox()).rejects.toThrow('commit failed');
    expect(mockQR.rollbackTransaction).toHaveBeenCalledOnce();
  });
});
