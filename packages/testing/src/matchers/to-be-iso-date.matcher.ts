interface MatcherResult {
  pass: boolean;
  message: () => string;
}

// ISO 8601 format with optional milliseconds, plus Z timezone or ±hh:mm offset.
// Tukio servers always emit `new Date().toISOString()` which produces the Z form.
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;

export function toBeIsoDate(received: unknown): MatcherResult {
  if (typeof received !== 'string') {
    return {
      pass: false,
      message: () =>
        `Expected an ISO 8601 date string, got ${typeof received}: ${JSON.stringify(received)}`,
    };
  }
  if (!ISO_DATE_RE.test(received)) {
    return {
      pass: false,
      message: () => `Expected ${received} to match ISO 8601 (yyyy-mm-ddThh:mm:ss[.sss](Z|±hh:mm))`,
    };
  }
  if (Number.isNaN(Date.parse(received))) {
    return {
      pass: false,
      message: () => `Expected ${received} to parse as a valid Date`,
    };
  }
  return { pass: true, message: () => `${received} is a valid ISO 8601 date` };
}
