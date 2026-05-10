import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KeycloakClient, extractRole } from './keycloak-client.js';
import { KeycloakInitError } from './types.js';

vi.mock('keycloak-js', () => ({ default: vi.fn() }));

describe('extractRole', () => {
  it('returns admin-super first', () => {
    expect(extractRole(['client', 'admin-super'])).toBe('admin-super');
  });

  it('returns client as fallback', () => {
    expect(extractRole(['unknown'])).toBe('client');
  });
});

const mockKcInstance = {
  init: vi.fn().mockResolvedValue(true),
  login: vi.fn().mockResolvedValue(undefined),
  logout: vi.fn().mockResolvedValue(undefined),
  register: vi.fn().mockResolvedValue(undefined),
  updateToken: vi.fn().mockResolvedValue(true),
  token: 'test-token',
  authenticated: true,
  tokenParsed: {
    sub: 'user-1',
    email: 'u@test.com',
    given_name: 'John',
    family_name: 'Doe',
    locale: 'fr',
    realm_access: { roles: ['client'] },
  },
};

describe('KeycloakClient', () => {
  let client: KeycloakClient;

  beforeEach(async () => {
    const Keycloak = (await import('keycloak-js')).default;
    vi.mocked(Keycloak).mockImplementation(
      // Regular function required — arrow functions are not constructible
      function () {
        return mockKcInstance;
      } as unknown as new () => InstanceType<typeof Keycloak>,
    );
    client = new KeycloakClient({ url: 'http://kc', realm: 'tukio', clientId: 'web' });
  });

  it('init resolves to true on success', async () => {
    const result = await client.init();
    expect(result).toBe(true);
  });

  it('throws KeycloakInitError when init rejects', async () => {
    const Keycloak = (await import('keycloak-js')).default;
    vi.mocked(Keycloak).mockImplementationOnce(function () {
      return { init: vi.fn().mockRejectedValue(new Error('connection refused')) };
    } as unknown as new () => InstanceType<typeof Keycloak>);
    const failingClient = new KeycloakClient({ url: 'http://kc', realm: 'tukio', clientId: 'web' });
    await expect(failingClient.init()).rejects.toBeInstanceOf(KeycloakInitError);
  });

  it('getToken returns the token', async () => {
    await client.init();
    expect(client.getToken()).toBe('test-token');
  });

  it('isAuthenticated returns true when authenticated', async () => {
    await client.init();
    expect(client.isAuthenticated()).toBe(true);
  });

  it('getUser returns user fields', async () => {
    await client.init();
    const user = client.getUser();
    expect(user?.userId).toBe('user-1');
    expect(user?.email).toBe('u@test.com');
  });

  it('getRole returns client role', async () => {
    await client.init();
    expect(client.getRole()).toBe('client');
  });

  it('getLocale returns fr', async () => {
    await client.init();
    expect(client.getLocale()).toBe('fr');
  });

  it('login delegates to keycloak-js', async () => {
    await client.login('/redirect');
    expect(mockKcInstance.login).toHaveBeenCalledWith({ redirectUri: '/redirect' });
  });

  it('logout delegates to keycloak-js', async () => {
    await client.logout('/bye');
    expect(mockKcInstance.logout).toHaveBeenCalledWith({ redirectUri: '/bye' });
  });

  it('register delegates to keycloak-js', async () => {
    await client.register();
    expect(mockKcInstance.register).toHaveBeenCalledOnce();
  });

  it('updateToken delegates to keycloak-js', async () => {
    const refreshed = await client.updateToken(30);
    expect(mockKcInstance.updateToken).toHaveBeenCalledWith(30);
    expect(refreshed).toBe(true);
  });

  it('getUser returns null when no tokenParsed', async () => {
    const Keycloak = (await import('keycloak-js')).default;
    vi.mocked(Keycloak).mockImplementationOnce(function () {
      return { ...mockKcInstance, tokenParsed: null };
    } as unknown as new () => InstanceType<typeof Keycloak>);
    const noTokenClient = new KeycloakClient({ url: 'http://kc', realm: 'tukio', clientId: 'web' });
    expect(noTokenClient.getUser()).toBeNull();
  });

  it('getRawKeycloak returns the underlying Keycloak instance', async () => {
    expect(client.getRawKeycloak()).toBeTruthy();
  });
});
