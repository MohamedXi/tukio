interface MatcherResult {
  pass: boolean;
  message: () => string;
}

// RFC 4122: any version. Tukio always emits v4 (random), but we accept v1-v5
// for incoming Keycloak/Stripe IDs.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function toBeUuid(received: unknown): MatcherResult {
  if (typeof received !== 'string') {
    return {
      pass: false,
      message: () => `Expected a UUID string, got ${typeof received}: ${JSON.stringify(received)}`,
    };
  }
  const pass = UUID_RE.test(received);
  return {
    pass,
    message: () =>
      pass
        ? `Expected ${received} NOT to be a UUID, but it is`
        : `Expected ${received} to be a UUID (RFC 4122 v1-v5)`,
  };
}
