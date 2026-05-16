'use client';

import { useEffect, useState } from 'react';
import type { AcquisitionInputDto } from '@tukio/contracts/dtos/identity/acquisition';

const ACQUISITION_COOKIE_NAME = 'tk_acq';
// Hard cap matches the gateway-api MAX_ACQUISITION_COOKIE_LENGTH (2048 bytes).
// Bound runs before atob() so a crafted oversized cookie cannot exhaust memory.
const MAX_ACQUISITION_COOKIE_LENGTH = 2048;
const UTM_SOURCE_MAP: Record<string, string> = {
  google: 'google_ads',
  google_ads: 'google_ads',
  'google-ads': 'google_ads',
  facebook: 'meta_ads',
  instagram: 'meta_ads',
  meta: 'meta_ads',
  meta_ads: 'meta_ads',
  referral: 'referral',
  partner: 'partner',
  direct: 'direct',
  organic: 'organic',
};

const VALID_SOURCES = [
  'organic',
  'google_ads',
  'meta_ads',
  'referral',
  'direct',
  'partner',
  'unknown',
];

function mapUtmSource(raw: string): string {
  const lower = raw.toLowerCase().trim();
  return UTM_SOURCE_MAP[lower] ?? 'unknown';
}

function readCookieFromDocument(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.split('; ').find((row) => row.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : undefined;
}

function parseTkAcqCookie(raw: string | undefined): AcquisitionInputDto | undefined {
  if (!raw) return undefined;
  // Cap BEFORE atob() to prevent memory exhaustion via crafted oversized cookie.
  if (raw.length > MAX_ACQUISITION_COOKIE_LENGTH) return undefined;
  try {
    const decoded = atob(raw.replace(/-/g, '+').replace(/_/g, '/'));
    const parsed: unknown = JSON.parse(decoded);
    if (
      parsed &&
      typeof parsed === 'object' &&
      'source' in parsed &&
      typeof (parsed as Record<string, unknown>).source === 'string' &&
      VALID_SOURCES.includes(String((parsed as Record<string, unknown>).source))
    ) {
      return parsed as AcquisitionInputDto;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function readQueryParam(search: string, key: string): string | undefined {
  if (typeof URLSearchParams === 'undefined') return undefined;
  const params = new URLSearchParams(search);
  return params.get(key) ?? undefined;
}

function readClientAcquisition(): AcquisitionInputDto | undefined {
  // 1. Cookie (first-touch, set by middleware)
  const cookieRaw = readCookieFromDocument(ACQUISITION_COOKIE_NAME);
  const fromCookie = parseTkAcqCookie(cookieRaw);
  if (fromCookie) return fromCookie;

  // 2. Current URL UTM params (fallback before cookie propagates)
  if (typeof window === 'undefined') return undefined;
  const search = window.location.search;
  const utmSource = readQueryParam(search, 'utm_source');
  if (!utmSource) return undefined;
  return {
    source: mapUtmSource(utmSource) as AcquisitionInputDto['source'],
    medium: readQueryParam(search, 'utm_medium'),
    campaign: readQueryParam(search, 'utm_campaign'),
    content: readQueryParam(search, 'utm_content'),
    term: readQueryParam(search, 'utm_term'),
  };
}

/**
 * Returns the acquisition context for the current user session (Story 1.2d AC2).
 *
 * Priority:
 *   1. Cookie `tk_acq` (set by Next.js middleware on first-touch landing)
 *   2. Current page URL UTM query params (for SSR-rendered registration pages
 *      where the cookie may not yet be written)
 *   3. undefined (no attribution context — omit acquisition field from payload)
 *
 * Reads cookie/URL via `useEffect` after mount so the server render returns
 * `undefined` consistently — avoids a hydration mismatch when the cookie is
 * present client-side but the SSR has no document/window context.
 */
export function useAcquisitionTracking(): AcquisitionInputDto | undefined {
  const [value, setValue] = useState<AcquisitionInputDto | undefined>(undefined);
  useEffect(() => {
    setValue(readClientAcquisition());
  }, []);
  return value;
}
