import type { AcquisitionSource } from '@tukio/contracts/types/Acquisition';
import { isAcquisitionSource } from '@tukio/contracts/types/Acquisition';

// Matches the `tk_acq` cookie written by acquisition-cookie.ts middleware (Story 0.13).
// Cookie value is base64url-encoded JSON: { source, medium?, campaign? }.
export const TK_ACQ_COOKIE = 'tk_acq';

const MAX_COOKIE_VALUE_BYTES = 4096; // Browser cookie ceiling — also DoS guard.
const MAX_UTM_FIELD_LENGTH = 200; // Matches `truncateUtm` in Acquisition.ts.

export interface ParsedAcquisition {
  source: AcquisitionSource;
  medium?: string;
  campaign?: string;
}

function truncate(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  return value.slice(0, MAX_UTM_FIELD_LENGTH);
}

export function parseAcquisitionCookie(cookieValue: string | undefined): ParsedAcquisition {
  // No cookie → genuine direct traffic (visitor hit the page without UTM/referrer history).
  if (!cookieValue) return { source: 'direct' };
  // Oversized cookie → DoS guard. Treat as unknown (parse failure).
  if (cookieValue.length > MAX_COOKIE_VALUE_BYTES) return { source: 'unknown' };

  try {
    const json = Buffer.from(cookieValue, 'base64url').toString('utf-8');
    if (json.length === 0) return { source: 'unknown' };
    const parsed = JSON.parse(json) as unknown;
    // Reject primitives (e.g. JSON.parse('42') yields 42, which would silently downgrade to direct).
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { source: 'unknown' };
    }
    const record = parsed as Record<string, unknown>;
    const sourceRaw = String(record['source'] ?? '');
    return {
      source: isAcquisitionSource(sourceRaw) ? sourceRaw : 'unknown',
      medium: truncate(record['medium']),
      campaign: truncate(record['campaign']),
    };
  } catch {
    // Parse failure → attribution lost, NOT direct traffic.
    return { source: 'unknown' };
  }
}
