export type ContactError =
  | { kind: 'generic' }
  | { kind: 'network' }
  | { kind: 'rate_limited'; retryAfterSeconds: number };

export function classifyContactError(error: unknown): ContactError {
  if (!(error instanceof Error)) return { kind: 'generic' };

  if (error.message.includes('fetch') || error.message.includes('network')) {
    return { kind: 'network' };
  }

  const retryMatch = error.message.match(/retry[_-]?after[:\s]+(\d+)/i);
  if (retryMatch?.[1]) {
    return { kind: 'rate_limited', retryAfterSeconds: parseInt(retryMatch[1], 10) };
  }

  if (error.message.includes('429') || error.message.includes('rate')) {
    return { kind: 'rate_limited', retryAfterSeconds: 60 };
  }

  return { kind: 'generic' };
}
