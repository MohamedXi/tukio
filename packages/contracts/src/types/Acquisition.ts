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

/**
 * Parse UTM search parameters into a partial AcquisitionContext.
 * Only extracts fields present in the URLSearchParams — does not set firstTouch/lastTouch.
 */
export function parseUtmParams(searchParams: URLSearchParams): Partial<AcquisitionContext> {
  const utmSource = searchParams.get('utm_source');
  const source = utmSource ? mapUtmSourceToAcquisitionSource(utmSource) : undefined;
  const medium = searchParams.get('utm_medium') ?? undefined;
  const campaign = searchParams.get('utm_campaign') ?? undefined;

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
