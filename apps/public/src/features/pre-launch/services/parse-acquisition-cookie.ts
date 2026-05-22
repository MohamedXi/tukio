import type { AcquisitionSource } from '@tukio/contracts/types/Acquisition';
import { isAcquisitionSource } from '@tukio/contracts/types/Acquisition';

// Matches the `tk_acq` cookie written by acquisition-cookie.ts middleware (Story 0.13).
// Cookie value is base64url-encoded JSON: { source, medium?, campaign? }.
export const TK_ACQ_COOKIE = 'tk_acq';

export interface ParsedAcquisition {
  source: AcquisitionSource;
  medium?: string;
  campaign?: string;
}

export function parseAcquisitionCookie(cookieValue: string | undefined): ParsedAcquisition {
  if (!cookieValue) return { source: 'direct' };
  try {
    const json = Buffer.from(cookieValue, 'base64url').toString('utf-8');
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const source = String(parsed['source'] ?? 'direct');
    return {
      source: isAcquisitionSource(source) ? source : 'direct',
      medium: typeof parsed['medium'] === 'string' ? parsed['medium'] : undefined,
      campaign: typeof parsed['campaign'] === 'string' ? parsed['campaign'] : undefined,
    };
  } catch {
    return { source: 'direct' };
  }
}
