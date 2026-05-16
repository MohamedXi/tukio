import type { AcquisitionInputDto } from '@tukio/contracts/dtos/identity/acquisition';
import { mergeAcquisition } from './merge-acquisition.js';

const encodeCookie = (value: AcquisitionInputDto): string =>
  Buffer.from(JSON.stringify(value)).toString('base64url');

describe('mergeAcquisition (Story 1.2c — first-touch wins)', () => {
  const cookieAttribution: AcquisitionInputDto = {
    source: 'google_ads',
    medium: 'cpc',
    campaign: 'spring2026',
  };

  const bodyAttribution: AcquisitionInputDto = {
    source: 'meta_ads',
    medium: 'social',
  };

  it('returns the cookie value when both cookie and body are present (first-touch wins)', () => {
    const merged = mergeAcquisition(
      encodeCookie(cookieAttribution),
      bodyAttribution,
    );
    expect(merged).toEqual(cookieAttribution);
  });

  it('returns the body when cookie is absent', () => {
    expect(mergeAcquisition(undefined, bodyAttribution)).toEqual(
      bodyAttribution,
    );
  });

  it('returns undefined when neither cookie nor body is present', () => {
    expect(mergeAcquisition(undefined, undefined)).toBeUndefined();
  });

  it('falls back to the body when the cookie is base64-malformed', () => {
    expect(mergeAcquisition('!!!not-base64!!!', bodyAttribution)).toEqual(
      bodyAttribution,
    );
  });

  it('falls back to the body when the cookie payload is missing a string `source` field', () => {
    const tampered = Buffer.from(
      JSON.stringify({ medium: 'cpc' }),
      'utf8',
    ).toString('base64url');
    expect(mergeAcquisition(tampered, bodyAttribution)).toEqual(
      bodyAttribution,
    );
  });

  it('falls back to the body when the cookie decodes to non-JSON', () => {
    const garbage = Buffer.from('not json at all', 'utf8').toString(
      'base64url',
    );
    expect(mergeAcquisition(garbage, bodyAttribution)).toEqual(bodyAttribution);
  });
});
