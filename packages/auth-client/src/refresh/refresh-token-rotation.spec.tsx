import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AUTH_BROADCAST_CHANNEL,
  RefreshTokenRotationManager,
  type RefreshManagerConfig,
} from './refresh-token-rotation.js';

function envelope(expiresIn: number): Response {
  return new Response(JSON.stringify({ data: { expiresIn, refreshExpiresIn: 1800 } }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function status(code: number): Response {
  return new Response(JSON.stringify({ error: { tukioCode: 'X' } }), { status: code });
}

function makeConfig(overrides: Partial<RefreshManagerConfig> = {}): RefreshManagerConfig {
  return {
    gatewayBaseUrl: 'https://api.tukio.test',
    getCsrfToken: () => 'csrf-token',
    fetchImpl: vi.fn().mockResolvedValue(envelope(300)) as unknown as typeof fetch,
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('RefreshTokenRotationManager (Story 1.4d AC6)', () => {
  it('1. start() then stop() do not throw and are idempotent', () => {
    const mgr = new RefreshTokenRotationManager(makeConfig());
    expect(() => mgr.start()).not.toThrow();
    expect(() => mgr.start()).not.toThrow(); // idempotent
    expect(() => mgr.stop()).not.toThrow();
    expect(() => mgr.stop()).not.toThrow();
  });

  it('2. schedules first refresh ~60s before expiry (240s for a 300s token)', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn().mockResolvedValue(envelope(300));
    const mgr = new RefreshTokenRotationManager(makeConfig({ fetchImpl: fetchImpl as never }));
    mgr.start(300);

    await vi.advanceTimersByTimeAsync(239_000);
    expect(fetchImpl).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    mgr.stop();
  });

  it('3. refreshNow() POSTs /v1/auth/refresh with X-CSRF-Token + credentials', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(envelope(300));
    const mgr = new RefreshTokenRotationManager(
      makeConfig({ fetchImpl: fetchImpl as never, getCsrfToken: () => 'the-csrf' }),
    );
    const ok = await mgr.refreshNow();

    expect(ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.tukio.test/v1/auth/refresh',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
    const init = fetchImpl.mock.calls[0]![1] as RequestInit;
    expect((init.headers as Headers).get('X-CSRF-Token')).toBe('the-csrf');
    mgr.stop();
  });

  it('4. on success → reschedules using the response expiresIn', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(envelope(600)) // first refresh says 600s
      .mockResolvedValue(envelope(300));
    const mgr = new RefreshTokenRotationManager(makeConfig({ fetchImpl: fetchImpl as never }));
    mgr.start(300);

    await vi.advanceTimersByTimeAsync(240_000); // first refresh fires
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    // Next scheduled at 600-60 = 540s. Not yet at 539s.
    await vi.advanceTimersByTimeAsync(539_000);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    mgr.stop();
  });

  it('5. on 401 → calls onLoggedOut and stops scheduling', async () => {
    vi.useFakeTimers();
    const onLoggedOut = vi.fn();
    const fetchImpl = vi.fn().mockResolvedValue(status(401));
    const mgr = new RefreshTokenRotationManager(
      makeConfig({ fetchImpl: fetchImpl as never, onLoggedOut }),
    );
    mgr.start(300);

    await vi.advanceTimersByTimeAsync(241_000);
    expect(onLoggedOut).toHaveBeenCalledTimes(1);
    // No further refreshes after logout.
    await vi.advanceTimersByTimeAsync(600_000);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    mgr.stop();
  });

  it('6. on network error → does NOT log out, retries later (transient)', async () => {
    vi.useFakeTimers();
    const onLoggedOut = vi.fn();
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue(envelope(300));
    const mgr = new RefreshTokenRotationManager(
      makeConfig({ fetchImpl: fetchImpl as never, onLoggedOut }),
    );
    mgr.start(300);

    await vi.advanceTimersByTimeAsync(241_000); // first attempt → network error
    expect(onLoggedOut).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(16_000); // transient retry (~15s)
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    mgr.stop();
  });

  it('7. concurrent refreshNow() calls share one in-flight request', async () => {
    let resolveFetch!: (r: Response) => void;
    const fetchImpl = vi.fn().mockReturnValue(
      new Promise<Response>((r) => {
        resolveFetch = r;
      }),
    );
    const mgr = new RefreshTokenRotationManager(makeConfig({ fetchImpl: fetchImpl as never }));

    const p1 = mgr.refreshNow();
    const p2 = mgr.refreshNow();
    expect(fetchImpl).toHaveBeenCalledTimes(1); // deduped

    resolveFetch(envelope(300));
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBe(true);
    expect(r2).toBe(true);
    mgr.stop();
  });

  it('8. broadcasts tokenRefreshed on the tukio-auth channel after success', async () => {
    const received: unknown[] = [];
    const listener = new BroadcastChannel(AUTH_BROADCAST_CHANNEL);
    listener.onmessage = (e) => received.push(e.data);

    const mgr = new RefreshTokenRotationManager(makeConfig());
    mgr.start(300); // opens the BroadcastChannel
    await mgr.refreshNow();
    // BroadcastChannel delivery is async; poll until it lands (robust under
    // v8 coverage instrumentation, which slows macrotask delivery).
    await vi.waitFor(() =>
      expect(received.some((m) => (m as { type: string }).type === 'tokenRefreshed')).toBe(true),
    );
    listener.close();
    mgr.stop();
  });

  it('9. a tokenRefreshed message from another tab updates the skip window', async () => {
    const now = vi.fn().mockReturnValue(1_000_000);
    const fetchImpl = vi.fn().mockResolvedValue(envelope(300));
    const mgr = new RefreshTokenRotationManager(makeConfig({ fetchImpl: fetchImpl as never, now }));
    mgr.start(300);

    // Probe listens on the same channel to detect when the message was delivered.
    // BroadcastChannel dispatches to each subscriber as a separate task, so the
    // probe seeing the message does not guarantee the manager's onmessage has fired.
    // We add an extra event-loop tick after the probe fires to give the manager's
    // handler a chance to update lastRefreshAt before we call refreshNow().
    let delivered = false;
    const probe = new BroadcastChannel(AUTH_BROADCAST_CHANNEL);
    probe.onmessage = (e: MessageEvent<{ type: string }>) => {
      if (e.data.type === 'tokenRefreshed') delivered = true;
    };
    const other = new BroadcastChannel(AUTH_BROADCAST_CHANNEL);
    other.postMessage({ type: 'tokenRefreshed', at: 1_000_000, expiresIn: 300 });
    await vi.waitFor(() => expect(delivered).toBe(true));
    // One extra task turn to let the manager's onmessage handler fire.
    await new Promise((r) => setTimeout(r, 0));

    // Now this tab should skip its own refresh (within the skip window).
    // The cross-tab skip returns `true` (token still fresh, safe to retry
    // the original request) — not `false` which would mean refresh failed.
    const refreshed = await mgr.refreshNow();
    expect(refreshed).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
    probe.close();
    other.close();
    mgr.stop();
  });

  it('10. a loggedOut message from another tab triggers onLoggedOut', async () => {
    const onLoggedOut = vi.fn();
    const mgr = new RefreshTokenRotationManager(makeConfig({ onLoggedOut }));
    mgr.start(300);

    const other = new BroadcastChannel(AUTH_BROADCAST_CHANNEL);
    other.postMessage({ type: 'loggedOut' });
    await vi.waitFor(() => expect(onLoggedOut).toHaveBeenCalledTimes(1));
    other.close();
    mgr.stop();
  });
});
