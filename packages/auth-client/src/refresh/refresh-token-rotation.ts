// Story 1.4d AC6 — cookie/fetch-based silent access-token rotation.
//
// Reworked from the Story 0.8 Keycloak.js placeholder (which read the in-memory
// token via `keycloak-js.updateToken`). The MVP auth flow is fully cookie-based
// (Story 1.4a/b): the access + refresh tokens are HttpOnly cookies the browser
// JS cannot read, so rotation happens server-side via `POST /v1/auth/refresh`
// (CsrfGuard). This manager schedules that POST shortly before the access token
// expires and coordinates across tabs to avoid a thundering herd.
//
// Cross-tab coordination uses BroadcastChannel('tukio-auth'): the tab that
// refreshes broadcasts `tokenRefreshed{at}`; other tabs record `at` and skip
// their own refresh while it is fresh (RECENT_REFRESH_SKIP_MS). On a permanent
// refresh failure (refresh token expired/reused → 401) the tab broadcasts
// `loggedOut` so every tab redirects to login.
//
// Anti-thundering-herd note (deviation from AC6's "sessionStorage lock"):
// sessionStorage is per-tab, so it cannot coordinate across tabs — the
// BroadcastChannel skip window is the real cross-tab guard. Within a single tab
// we dedup concurrent callers (rotation timer + axios 401 interceptor) with an
// in-flight promise, which is strictly safer than a timestamp key.

export interface RefreshManagerConfig {
  /** gateway-api origin, e.g. `https://api.tukio.one` (no trailing slash). */
  gatewayBaseUrl: string;
  /** Reads the non-HttpOnly CSRF cookie (CookieManager.getCsrfToken). */
  getCsrfToken: () => string | null;
  /** Called once when refresh fails permanently (refresh token gone/expired/reused). */
  onLoggedOut?: () => void;
  /** Injection seams for tests. */
  now?: () => number;
  fetchImpl?: typeof fetch;
}

export const AUTH_BROADCAST_CHANNEL = 'tukio-auth';
// Refresh this many seconds before the access token expires.
const REFRESH_BUFFER_S = 60;
// Assumed access-token lifetime when the manager has no fresher signal
// (Keycloak default access token = 5 min). After the first refresh the real
// `expiresIn` from the response drives scheduling.
const DEFAULT_EXPIRES_IN_S = 300;
// Minimum delay floor so a near-expired token doesn't busy-loop the timer.
const MIN_DELAY_MS = 5_000;
// A refresh from any tab within this window means this tab can skip its own.
const RECENT_REFRESH_SKIP_MS = 60_000;
// Transient failure (5xx/network) backoff before retrying.
const TRANSIENT_RETRY_MS = 15_000;

type ChannelMessage =
  | { type: 'tokenRefreshed'; at: number; expiresIn: number }
  | { type: 'loggedOut' };

export class RefreshTokenRotationManager {
  private timer?: ReturnType<typeof setTimeout>;
  private channel?: BroadcastChannel;
  private lastRefreshAt = 0;
  private started = false;
  private loggedOut = false;
  private stopped = false;
  private inFlight: Promise<boolean> | null = null;

  constructor(private readonly config: RefreshManagerConfig) {}

  private now(): number {
    return (this.config.now ?? Date.now)();
  }

  private get fetchImpl(): typeof fetch {
    return this.config.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  /** Begin the rotation cycle. Idempotent (StrictMode double-mount safe). */
  start(expiresInSeconds: number = DEFAULT_EXPIRES_IN_S): void {
    if (this.started) return;
    this.started = true;

    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.channel = new BroadcastChannel(AUTH_BROADCAST_CHANNEL);
        this.channel.onmessage = (e: MessageEvent<ChannelMessage>) => this.onChannelMessage(e.data);
      } catch {
        // BroadcastChannel unavailable — degrade to single-tab rotation.
      }
    }

    this.schedule(expiresInSeconds);
  }

  /** Cancel timers + close the channel. Idempotent. */
  stop(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    this.channel?.close();
    this.channel = undefined;
    this.started = false;
    this.stopped = true; // prevents any in-flight doRefresh() from re-scheduling
    this.inFlight = null;
  }

  /**
   * Refresh the access token now. Used by the rotation timer and by the
   * api-client 401 interceptor (AC9). Concurrent callers share one in-flight
   * request. Returns true on a successful rotation.
   */
  refreshNow(): Promise<boolean> {
    if (this.loggedOut) return Promise.resolve(false);
    // Cross-tab skip: another tab refreshed recently — the session is still fresh.
    // Return `true` so api-client 401 interceptors can distinguish "skipped (still
    // valid, retry the request)" from "refresh failed (do not retry)". The timer
    // was already rescheduled by `onChannelMessage` when the broadcast arrived —
    // do NOT call `schedule()` here again or we create a double-scheduled timer.
    if (this.now() - this.lastRefreshAt < RECENT_REFRESH_SKIP_MS && this.lastRefreshAt !== 0) {
      return Promise.resolve(true);
    }
    // Intra-tab dedup: a refresh is already running.
    if (this.inFlight) return this.inFlight;

    this.inFlight = this.doRefresh().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async doRefresh(): Promise<boolean> {
    const url = `${this.config.gatewayBaseUrl}/v1/auth/refresh`;
    const headers = new Headers({ 'Content-Type': 'application/json' });
    const token = this.config.getCsrfToken();
    if (token) headers.set('X-CSRF-Token', token);

    let res: Response;
    try {
      res = await this.fetchImpl(url, { method: 'POST', credentials: 'include', headers });
    } catch {
      // Network error — transient, retry soon without logging out.
      this.schedule(TRANSIENT_RETRY_MS / 1000);
      return false;
    }

    if (res.status === 401 || res.status === 403) {
      // Refresh token expired / reused / CSRF mismatch → permanent. Log out.
      this.handleLoggedOut(true);
      return false;
    }
    if (!res.ok) {
      // 5xx etc. — transient.
      this.schedule(TRANSIENT_RETRY_MS / 1000);
      return false;
    }

    const expiresIn = await this.readExpiresIn(res);
    const at = this.now();
    this.lastRefreshAt = at;
    // Schedule our own timer BEFORE broadcasting so this tab's next refresh is
    // set before other tabs receive the message and potentially reschedule ours.
    this.schedule(expiresIn);
    this.post({ type: 'tokenRefreshed', at, expiresIn });
    return true;
  }

  private async readExpiresIn(res: Response): Promise<number> {
    try {
      const body = (await res.json()) as { data?: { expiresIn?: number }; expiresIn?: number };
      // gateway wraps in the REST envelope `{ data: { expiresIn } }`; tolerate
      // a flat `{ expiresIn }` too.
      const value = body?.data?.expiresIn ?? body?.expiresIn;
      return typeof value === 'number' && value > 0 ? value : DEFAULT_EXPIRES_IN_S;
    } catch {
      return DEFAULT_EXPIRES_IN_S;
    }
  }

  private schedule(expiresInSeconds: number): void {
    // Guard against scheduling after loggedOut OR after stop() (which sets stopped=true).
    // Without this guard, an in-flight doRefresh() completing after stop() would
    // resurrect a timer on a permanently-stopped manager (timer leak after unmount).
    if (this.loggedOut || this.stopped) return;
    const delayMs = Math.max(MIN_DELAY_MS, (expiresInSeconds - REFRESH_BUFFER_S) * 1000);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.refreshNow(), delayMs);
  }

  private onChannelMessage(msg: ChannelMessage): void {
    if (msg.type === 'tokenRefreshed') {
      // Another tab refreshed — record it and resync our timer to its expiry.
      this.lastRefreshAt = Math.max(this.lastRefreshAt, msg.at);
      this.schedule(msg.expiresIn);
    } else if (msg.type === 'loggedOut') {
      this.handleLoggedOut(false);
    }
  }

  private handleLoggedOut(broadcast: boolean): void {
    if (this.loggedOut) return;
    this.loggedOut = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    if (broadcast) this.post({ type: 'loggedOut' });
    this.config.onLoggedOut?.();
  }

  private post(msg: ChannelMessage): void {
    try {
      this.channel?.postMessage(msg);
    } catch {
      // channel closed — ignore
    }
  }
}

/**
 * Broadcast a `loggedOut` signal on the `tukio-auth` channel so every other tab
 * tears down its session and redirects to login. Used by `useLogout` (AC5).
 * Opens a transient channel, posts, and closes it.
 */
export function broadcastLoggedOut(): void {
  if (typeof BroadcastChannel === 'undefined') return;
  try {
    const channel = new BroadcastChannel(AUTH_BROADCAST_CHANNEL);
    channel.postMessage({ type: 'loggedOut' } satisfies ChannelMessage);
    // Defer close by one event-loop turn so the browser has time to deliver the
    // message to all subscribers before the port is torn down. The BroadcastChannel
    // spec guarantees delivery from a closed sender, but some implementations
    // may drop messages sent immediately before close.
    setTimeout(() => channel.close(), 0);
  } catch {
    // BroadcastChannel unavailable — single-tab logout still proceeds.
  }
}
