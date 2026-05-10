interface MatcherResult {
  pass: boolean;
  message: () => string;
}

const ENVELOPE_KEYS = ['method', 'code', 'meta'] as const;

function hasEnvelopeShape(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return ENVELOPE_KEYS.every((k) => k in v);
}

function deepMatch(actual: unknown, expected: unknown): boolean {
  if (expected === undefined) return true;
  if (typeof expected !== 'object' || expected === null) return actual === expected;
  if (typeof actual !== 'object' || actual === null) return false;
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (!deepMatch((actual as Record<string, unknown>)[key], expectedValue)) return false;
  }
  return true;
}

// expect(response).toMatchSuccessEnvelope({ data: { id: 'abc' }, code: 200 });
export function toMatchSuccessEnvelope(
  received: unknown,
  expected?: { data?: unknown; code?: number },
): MatcherResult {
  if (!hasEnvelopeShape(received)) {
    return {
      pass: false,
      message: () =>
        `Expected SuccessEnvelope shape (with method/code/meta), got: ${JSON.stringify(received)}`,
    };
  }
  if (!('data' in received)) {
    return {
      pass: false,
      message: () => 'Expected SuccessEnvelope to have a `data` field (got ErrorEnvelope?).',
    };
  }
  if (expected?.code !== undefined && received.code !== expected.code) {
    return {
      pass: false,
      message: () =>
        `Expected envelope code ${String(expected.code)}, got ${String(received.code)}`,
    };
  }
  if (expected?.data !== undefined && !deepMatch(received.data, expected.data)) {
    return {
      pass: false,
      message: () =>
        `Envelope data did not match expected partial.\nExpected: ${JSON.stringify(expected.data)}\nReceived: ${JSON.stringify(received.data)}`,
    };
  }
  return { pass: true, message: () => 'Envelope matched' };
}

// expect(response).toMatchErrorEnvelope({ tukioCode: 'USER-NOT-FOUND-001', httpStatus: 404 });
export function toMatchErrorEnvelope(
  received: unknown,
  expected: { tukioCode: string; httpStatus?: number },
): MatcherResult {
  if (!hasEnvelopeShape(received) || !('error' in received)) {
    return {
      pass: false,
      message: () =>
        `Expected ErrorEnvelope shape (with method/code/error/meta), got: ${JSON.stringify(received)}`,
    };
  }
  const r = received as { code: unknown; error: { tukioCode: unknown } };
  if (r.error.tukioCode !== expected.tukioCode) {
    return {
      pass: false,
      message: () =>
        `Expected tukioCode "${expected.tukioCode}", got "${String(r.error.tukioCode)}"`,
    };
  }
  if (expected.httpStatus !== undefined && r.code !== expected.httpStatus) {
    return {
      pass: false,
      message: () => `Expected httpStatus ${expected.httpStatus}, got ${String(r.code)}`,
    };
  }
  return { pass: true, message: () => 'ErrorEnvelope matched' };
}
