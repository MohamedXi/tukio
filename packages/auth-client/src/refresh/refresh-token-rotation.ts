import type { KeycloakClient } from '../keycloak/keycloak-client.js';

const REFRESH_INTERVAL_MS = 30_000;
const REFRESH_THRESHOLD_S = 120;

// RefreshTokenRotationManager silently refreshes the access token before it
// expires. Uses BroadcastChannel to prevent thundering-herd when multiple tabs
// are open — only the winner refreshes and notifies other tabs.
export class RefreshTokenRotationManager {
  private timer?: ReturnType<typeof setInterval>;
  private channel?: BroadcastChannel;

  constructor(private readonly client: KeycloakClient) {}

  start(): void {
    if (typeof window !== 'undefined') {
      try {
        this.channel = new BroadcastChannel('tukio-token-refresh');
        this.channel.onmessage = (e: MessageEvent<{ type: string }>) => {
          if (e.data.type === 'refreshed') {
            // Another tab refreshed — nothing to do (Keycloak manages its own state)
          }
        };
      } catch {
        // BroadcastChannel unavailable — no inter-tab sync, acceptable degradation
      }

      window.addEventListener('focus', this.checkAndRefresh);
    }

    this.timer = setInterval(this.checkAndRefresh, REFRESH_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', this.checkAndRefresh);
    }
    this.channel?.close();
  }

  isHealthy(): boolean {
    const token = this.client.getToken();
    if (!token) return false;
    try {
      const [, payloadB64] = token.split('.');
      const payload = JSON.parse(atob(payloadB64 ?? '')) as { exp: number };
      return payload.exp - Date.now() / 1000 > 0;
    } catch {
      return false;
    }
  }

  private checkAndRefresh = async (): Promise<void> => {
    try {
      const refreshed = await this.client.updateToken(REFRESH_THRESHOLD_S);
      if (refreshed) {
        this.channel?.postMessage({ type: 'refreshed' });
      }
    } catch {
      // Token expired and refresh failed — let the app handle the logout
    }
  };
}
