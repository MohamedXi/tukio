// Custom error class compatible with classifyPreLaunchError + classifyContactError:
// - has `status` (number) property → classifyPreLaunchError checks e['status']
// - message includes status code → classifyContactError checks message.includes('429')
// - message includes `retry-after: N` → classifyContactError retryMatch regex
export class PreLaunchApiError extends Error {
  readonly status: number;
  readonly retryAfterSeconds?: number;

  constructor(httpStatus: number, tukioCode: string, retryAfterSeconds?: number) {
    const retryPart = retryAfterSeconds !== undefined ? ` retry-after: ${retryAfterSeconds}` : '';
    super(`[${httpStatus}] ${tukioCode}${retryPart}`);
    this.name = 'PreLaunchApiError';
    this.status = httpStatus;
    this.retryAfterSeconds = retryAfterSeconds;
    Object.setPrototypeOf(this, PreLaunchApiError.prototype);
  }
}

export function mapPreLaunchError(
  httpStatus: number,
  body: unknown,
  headers: Headers,
): PreLaunchApiError {
  if (httpStatus === 429) {
    const retryHeader = headers.get('retry-after');
    const parsed = retryHeader ? parseInt(retryHeader, 10) : 60;
    // Clamp to [1, 3600]: rejects negative/zero/oversized values from servers.
    const safeRetry = Math.max(1, Math.min(3600, isNaN(parsed) ? 60 : parsed));
    return new PreLaunchApiError(429, 'PRE-LAUNCH-RATE-LIMITED-001', safeRetry);
  }
  if (httpStatus === 422) {
    return new PreLaunchApiError(422, 'PRE-LAUNCH-VALIDATION-001');
  }
  if (httpStatus >= 500) {
    return new PreLaunchApiError(httpStatus, 'PRE-LAUNCH-EXTERNAL-001');
  }
  const bodyRecord = body as Record<string, unknown> | null;
  const tukioCode =
    typeof bodyRecord?.['error'] === 'object' &&
    bodyRecord['error'] !== null &&
    typeof (bodyRecord['error'] as Record<string, unknown>)['tukioCode'] === 'string'
      ? ((bodyRecord['error'] as Record<string, unknown>)['tukioCode'] as string)
      : 'PRE-LAUNCH-UNKNOWN';
  return new PreLaunchApiError(httpStatus, tukioCode);
}
