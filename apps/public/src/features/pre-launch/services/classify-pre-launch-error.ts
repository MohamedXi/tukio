export type PreLaunchFailure =
  | { kind: 'rate_limited'; retryAfterSeconds: number }
  | { kind: 'network' }
  | { kind: 'generic' };

const DEFAULT_RATE_LIMIT_SECONDS = 60;

export function classifyPreLaunchError(error: unknown): PreLaunchFailure {
  if (!error || typeof error !== 'object') return { kind: 'generic' };

  const e = error as Record<string, unknown>;

  if (e['status'] === 429) {
    return {
      kind: 'rate_limited',
      retryAfterSeconds:
        typeof e['retryAfterSeconds'] === 'number'
          ? e['retryAfterSeconds']
          : DEFAULT_RATE_LIMIT_SECONDS,
    };
  }

  if (isNetworkError(e)) return { kind: 'network' };

  return { kind: 'generic' };
}

function isNetworkError(e: Record<string, unknown>): boolean {
  const name = String(e['name'] ?? '');
  const message = String(e['message'] ?? '');
  if (name === 'AbortError') return true;
  if (name === 'TypeError') return /fetch|network|cors|failed/i.test(message);
  return false;
}
