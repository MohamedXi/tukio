import type { KeycloakClient } from '../keycloak/keycloak-client.js';

const REFRESH_INTERVAL_MS = 30_000;
const REFRESH_THRESHOLD_S = 120;
// Window during which a refresh from another tab counts as "fresh enough" so
// this tab can skip its own refresh — anti-thundering-herd guard.
const RECENT_REFRESH_SKIP_MS = 60_000;

// RefreshTokenRotationManager silently refreshes the access token before it
// expires. Uses BroadcastChannel for inter-tab anti-thundering-herd: when one
// tab refreshes, others see the timestamp via the channel and skip their own
// refresh window if it's still fresh.
export class RefreshTokenRotationManager {
  private timer?: ReturnType<typeof setInterval>;
  private channel?: BroadcastChannel;
  private lastRefreshAt = 0;
  private started = false;

  constructor(private readonly client: KeycloakClient) {}

  start(): void {
    // Idempotent: StrictMode double-mount or accidental double-start would
    // otherwise leak intervals/listeners.
    if (this.started) return;
    this.started = true;

    if (typeof window !== 'undefined') {
      try {
        this.channel = new BroadcastChannel('tukio-token-refresh');
        this.channel.onmessage = (e: MessageEvent<{ type: string; at?: number }>) => {
          if (e.data.type === 'refreshed' && typeof e.data.at === 'number') {
            this.lastRefreshAt = Math.max(this.lastRefreshAt, e.data.at);
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
    this.channel = undefined;
    this.timer = undefined;
    this.started = false;
  }

  isHealthy(): boolean {
    const token = this.client.getToken();
    if (!token) return false;
    try {
      const [, payloadB64] = token.split('.');
      if (!payloadB64) return false;
      const payload = JSON.parse(decodeBase64Url(payloadB64)) as { exp: number };
      const remaining = payload.exp - Date.now() / 1000;
      // Healthy = token is valid AND not in the refresh-imminent window.
      return remaining > REFRESH_THRESHOLD_S;
    } catch {
      return false;
    }
  }

  private checkAndRefresh = async (): Promise<void> => {
    // Skip if another tab refreshed within the last RECENT_REFRESH_SKIP_MS —
    // Keycloak adapter shares its token via the same cookie, so re-running
    // updateToken() now would just hit the network for nothing.
    if (Date.now() - this.lastRefreshAt < RECENT_REFRESH_SKIP_MS) return;

    try {
      const refreshed = await this.client.updateToken(REFRESH_THRESHOLD_S);
      if (refreshed) {
        const at = Date.now();
        this.lastRefreshAt = at;
        this.channel?.postMessage({ type: 'refreshed', at });
      }
    } catch {
      // Token expired and refresh failed — let the app handle the logout
    }
  };
}

// Decode base64url (RFC 4648 §5) — JWT payloads use URL-safe alphabet (`-`/`_`)
// and may omit padding, both of which crash plain `atob`.
function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return atob(normalized + pad);
}
