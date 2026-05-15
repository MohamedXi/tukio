import { describe, it, expect } from 'vitest';
import {
  parseUtmParams,
  mapUtmSourceToAcquisitionSource,
  isAcquisitionSource,
  ACQUISITION_SOURCES,
} from '../Acquisition.js';

describe('mapUtmSourceToAcquisitionSource', () => {
  it('maps google to google_ads', () => {
    expect(mapUtmSourceToAcquisitionSource('google')).toBe('google_ads');
    expect(mapUtmSourceToAcquisitionSource('google_ads')).toBe('google_ads');
    expect(mapUtmSourceToAcquisitionSource('google-ads')).toBe('google_ads');
    expect(mapUtmSourceToAcquisitionSource('GOOGLE')).toBe('google_ads');
  });

  it('maps facebook/instagram/meta to meta_ads', () => {
    expect(mapUtmSourceToAcquisitionSource('facebook')).toBe('meta_ads');
    expect(mapUtmSourceToAcquisitionSource('instagram')).toBe('meta_ads');
    expect(mapUtmSourceToAcquisitionSource('meta')).toBe('meta_ads');
    expect(mapUtmSourceToAcquisitionSource('meta_ads')).toBe('meta_ads');
    expect(mapUtmSourceToAcquisitionSource('fb')).toBe('meta_ads');
  });

  it('maps known sources correctly', () => {
    expect(mapUtmSourceToAcquisitionSource('referral')).toBe('referral');
    expect(mapUtmSourceToAcquisitionSource('partner')).toBe('partner');
    expect(mapUtmSourceToAcquisitionSource('direct')).toBe('direct');
    expect(mapUtmSourceToAcquisitionSource('organic')).toBe('organic');
  });

  it('returns unknown for unrecognized sources', () => {
    expect(mapUtmSourceToAcquisitionSource('tiktok')).toBe('unknown');
    expect(mapUtmSourceToAcquisitionSource('newsletter')).toBe('unknown');
    expect(mapUtmSourceToAcquisitionSource('')).toBe('unknown');
    expect(mapUtmSourceToAcquisitionSource('   ')).toBe('unknown');
  });

  it('trims whitespace before mapping', () => {
    expect(mapUtmSourceToAcquisitionSource(' google ')).toBe('google_ads');
  });
});

describe('parseUtmParams', () => {
  it('parses a full UTM query string', () => {
    const params = new URLSearchParams(
      'utm_source=google_ads&utm_medium=cpc&utm_campaign=spring2026',
    );
    const result = parseUtmParams(params);
    expect(result).toEqual({
      source: 'google_ads',
      medium: 'cpc',
      campaign: 'spring2026',
    });
  });

  it('returns empty object for empty URLSearchParams', () => {
    const params = new URLSearchParams('');
    const result = parseUtmParams(params);
    expect(result).toEqual({});
  });

  it('returns only available fields when partial UTM params are present', () => {
    const params = new URLSearchParams('utm_source=facebook');
    const result = parseUtmParams(params);
    expect(result).toEqual({ source: 'meta_ads' });
    expect(result.medium).toBeUndefined();
    expect(result.campaign).toBeUndefined();
  });

  it('omits source when utm_source is absent', () => {
    const params = new URLSearchParams('utm_medium=email&utm_campaign=weekly');
    const result = parseUtmParams(params);
    expect(result.source).toBeUndefined();
    expect(result.medium).toBe('email');
    expect(result.campaign).toBe('weekly');
  });

  it('handles unrecognized utm_source gracefully (unknown fallback)', () => {
    const params = new URLSearchParams('utm_source=tiktok_ads');
    const result = parseUtmParams(params);
    expect(result.source).toBe('unknown');
  });

  it('handles URL with extra non-UTM params', () => {
    const params = new URLSearchParams(
      'q=chapiteau&utm_source=google&page=2&utm_campaign=tent-campaign',
    );
    const result = parseUtmParams(params);
    expect(result.source).toBe('google_ads');
    expect(result.campaign).toBe('tent-campaign');
  });

  it('truncates utm_campaign at 200 chars to prevent oversized cookies', () => {
    const longCampaign = 'a'.repeat(300);
    const params = new URLSearchParams(`utm_source=google&utm_campaign=${longCampaign}`);
    const result = parseUtmParams(params);
    expect(result.campaign).toHaveLength(200);
  });

  it('truncates utm_medium at 200 chars', () => {
    const longMedium = 'b'.repeat(300);
    const params = new URLSearchParams(`utm_source=google&utm_medium=${longMedium}`);
    const result = parseUtmParams(params);
    expect(result.medium).toHaveLength(200);
  });
});

describe('isAcquisitionSource', () => {
  it('returns true for all valid sources', () => {
    for (const source of ACQUISITION_SOURCES) {
      expect(isAcquisitionSource(source)).toBe(true);
    }
  });

  it('returns false for invalid values', () => {
    expect(isAcquisitionSource('tiktok')).toBe(false);
    expect(isAcquisitionSource('')).toBe(false);
    expect(isAcquisitionSource('GOOGLE_ADS')).toBe(false);
  });
});

describe('ACQUISITION_SOURCES', () => {
  it('contains all 7 expected values', () => {
    expect(ACQUISITION_SOURCES).toHaveLength(7);
    expect(ACQUISITION_SOURCES).toContain('organic');
    expect(ACQUISITION_SOURCES).toContain('google_ads');
    expect(ACQUISITION_SOURCES).toContain('meta_ads');
    expect(ACQUISITION_SOURCES).toContain('referral');
    expect(ACQUISITION_SOURCES).toContain('direct');
    expect(ACQUISITION_SOURCES).toContain('partner');
    expect(ACQUISITION_SOURCES).toContain('unknown');
  });
});
