import { describe, it, expect } from 'vitest';
import {
  LOCALES,
  DEFAULT_LOCALE,
  LOCALE_LABELS,
  LOCALE_FLAGS,
  LOCALE_BCP47,
  isLocale,
} from '../locales.js';

describe('locales config', () => {
  it('LOCALES is exactly fr, en (FR-only MVP business)', () => {
    expect(LOCALES).toEqual(['fr', 'en']);
  });

  it('DEFAULT_LOCALE is en (international fallback when Accept-Language is neither fr nor en)', () => {
    expect(DEFAULT_LOCALE).toBe('en');
  });

  it('LOCALE_LABELS covers every locale', () => {
    for (const locale of LOCALES) {
      expect(LOCALE_LABELS[locale]).toBeTruthy();
    }
  });

  it('LOCALE_FLAGS covers every locale', () => {
    for (const locale of LOCALES) {
      expect(LOCALE_FLAGS[locale]).toBeTruthy();
    }
  });

  it('LOCALE_BCP47 maps to BCP 47 tags Intl.* APIs accept', () => {
    expect(LOCALE_BCP47.fr).toBe('fr-FR');
    expect(LOCALE_BCP47.en).toBe('en-GB');
    // Sanity check: Intl can resolve them.
    expect(() => new Intl.NumberFormat(LOCALE_BCP47.fr)).not.toThrow();
    expect(() => new Intl.NumberFormat(LOCALE_BCP47.en)).not.toThrow();
  });

  it('isLocale narrows known locales', () => {
    expect(isLocale('fr')).toBe(true);
    expect(isLocale('en')).toBe(true);
  });

  it('isLocale rejects unknown values', () => {
    expect(isLocale('es')).toBe(false);
    expect(isLocale('FR')).toBe(false);
    expect(isLocale('fr-FR')).toBe(false);
    expect(isLocale('')).toBe(false);
  });
});
