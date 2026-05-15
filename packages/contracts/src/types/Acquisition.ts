export type AcquisitionSource =
  | 'organic'
  | 'google_ads'
  | 'meta_ads'
  | 'referral'
  | 'direct'
  | 'partner'
  | 'unknown';

export const ACQUISITION_SOURCES: AcquisitionSource[] = [
  'organic',
  'google_ads',
  'meta_ads',
  'referral',
  'direct',
  'partner',
  'unknown',
];

export function isAcquisitionSource(value: string): value is AcquisitionSource {
  return (ACQUISITION_SOURCES as string[]).includes(value);
}

export interface AcquisitionContext {
  source: AcquisitionSource;
  medium?: string;
  campaign?: string;
  referralId?: string;
  firstTouch: string; // ISO 8601
  lastTouch: string; // ISO 8601
}

const UTM_FIELD_MAX_LENGTH = 200;

function truncateUtm(value: string | null): string | undefined {
  if (value === null) return undefined;
  // Guard against adversarial large UTM values that would exceed browser cookie limit (4096 bytes).
  return value.slice(0, UTM_FIELD_MAX_LENGTH);
}

/**
 * Parse UTM search parameters into a partial AcquisitionContext.
 * Only extracts fields present in the URLSearchParams — does not set firstTouch/lastTouch.
 * Fields are truncated at 200 chars to prevent oversized cookies.
 */
export function parseUtmParams(searchParams: URLSearchParams): Partial<AcquisitionContext> {
  const utmSource = searchParams.get('utm_source');
  const source = utmSource ? mapUtmSourceToAcquisitionSource(utmSource) : undefined;
  const medium = truncateUtm(searchParams.get('utm_medium'));
  const campaign = truncateUtm(searchParams.get('utm_campaign'));

  return {
    ...(source !== undefined && { source }),
    ...(medium !== undefined && { medium }),
    ...(campaign !== undefined && { campaign }),
  };
}

export function mapUtmSourceToAcquisitionSource(utmSource: string): AcquisitionSource {
  const lower = utmSource.toLowerCase().trim();
  if (lower === 'google' || lower === 'google_ads' || lower === 'google-ads') {
    return 'google_ads';
  }
  if (
    lower === 'facebook' ||
    lower === 'instagram' ||
    lower === 'meta' ||
    lower === 'meta_ads' ||
    lower === 'fb'
  ) {
    return 'meta_ads';
  }
  if (lower === 'referral') return 'referral';
  if (lower === 'partner') return 'partner';
  if (lower === 'direct') return 'direct';
  if (lower === 'organic') return 'organic';
  return 'unknown';
}
