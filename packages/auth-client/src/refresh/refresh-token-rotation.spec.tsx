import { describe, it, expect, vi, afterEach } from 'vitest';
import { RefreshTokenRotationManager } from './refresh-token-rotation.js';
import type { KeycloakClient } from '../keycloak/keycloak-client.js';

const makeClient = (updateResult = true): KeycloakClient =>
  ({
    updateToken: vi.fn().mockResolvedValue(updateResult),
    getToken: vi.fn().mockReturnValue(undefined),
  }) as unknown as KeycloakClient;

afterEach(() => vi.restoreAllMocks());

describe('RefreshTokenRotationManager', () => {
  it('start and stop do not throw', () => {
    const mgr = new RefreshTokenRotationManager(makeClient());
    expect(() => mgr.start()).not.toThrow();
    expect(() => mgr.stop()).not.toThrow();
  });

  it('isHealthy returns false when no token', () => {
    const mgr = new RefreshTokenRotationManager(makeClient());
    expect(mgr.isHealthy()).toBe(false);
  });

  it('isHealthy returns true for non-expired token', () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const payload = btoa(JSON.stringify({ exp }));
    const token = `header.${payload}.sig`;
    const client = {
      updateToken: vi.fn(),
      getToken: vi.fn().mockReturnValue(token),
    } as unknown as KeycloakClient;
    const mgr = new RefreshTokenRotationManager(client);
    expect(mgr.isHealthy()).toBe(true);
  });

  it('isHealthy returns false for expired token', () => {
    const exp = Math.floor(Date.now() / 1000) - 100;
    const payload = btoa(JSON.stringify({ exp }));
    const token = `header.${payload}.sig`;
    const client = {
      updateToken: vi.fn(),
      getToken: vi.fn().mockReturnValue(token),
    } as unknown as KeycloakClient;
    const mgr = new RefreshTokenRotationManager(client);
    expect(mgr.isHealthy()).toBe(false);
  });

  it('stop after start does not throw when no timer', () => {
    const mgr = new RefreshTokenRotationManager(makeClient());
    expect(() => mgr.stop()).not.toThrow();
  });

  it('calls updateToken when start triggers interval', async () => {
    vi.useFakeTimers();
    const client = makeClient();
    const mgr = new RefreshTokenRotationManager(client);
    mgr.start();
    await vi.advanceTimersByTimeAsync(30_001);
    expect(client.updateToken).toHaveBeenCalled();
    mgr.stop();
    vi.useRealTimers();
  });
});
