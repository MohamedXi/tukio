import { describe, it, expect } from 'vitest';
import { formatDate, formatDateRange, formatDateTime } from '../date.js';
import { formatNumber, formatPercent } from '../number.js';
import { formatCurrency } from '../currency.js';
import { formatRelativeTime } from '../relative-time.js';

describe('formatDate', () => {
  it('formats a date in long FR style', () => {
    const result = formatDate('2026-06-15T10:00:00Z', 'fr');
    expect(result).toMatch(/15 juin 2026/);
  });

  it('formats a date in long EN style', () => {
    const result = formatDate('2026-06-15T10:00:00Z', 'en');
    // en-GB long: "15 June 2026"
    expect(result).toMatch(/15 June 2026/);
  });

  it('accepts a Date object directly', () => {
    const date = new Date('2026-06-15T10:00:00Z');
    expect(formatDate(date, 'fr')).toMatch(/15 juin 2026/);
  });

  it('respects custom options', () => {
    const result = formatDate('2026-06-15T10:00:00Z', 'fr', { dateStyle: 'short' });
    // fr-FR short: "15/06/2026"
    expect(result).toMatch(/15\/06\/2026/);
  });
});

describe('formatDateTime', () => {
  it('formats date + short time in FR locale (Europe/Paris)', () => {
    const result = formatDateTime('2026-06-15T08:00:00Z', 'fr');
    // fr-FR: "15 juin 2026 à 10:00" (Paris is UTC+2 in June DST)
    expect(result).toMatch(/15 juin 2026/);
    expect(result).toMatch(/10:00/);
  });
});

describe('formatDateRange', () => {
  it('formats a same-month range in FR', () => {
    const result = formatDateRange('2026-06-15', '2026-06-22', 'fr');
    expect(result).toContain('juin');
    expect(result).toContain('2026');
  });

  it('formats a cross-month range in EN', () => {
    const result = formatDateRange('2026-06-15', '2026-07-02', 'en');
    expect(result).toMatch(/June/);
    expect(result).toMatch(/July/);
  });
});

describe('formatNumber', () => {
  it('formats integer in FR (space thousand separator)', () => {
    // fr-FR thousand separator is a non-breaking space (U+202F).
    const result = formatNumber(1234567, 'fr');
    expect(result.replace(/\s/g, ' ')).toBe('1 234 567');
  });

  it('formats integer in EN (comma thousand separator)', () => {
    expect(formatNumber(1234567, 'en')).toBe('1,234,567');
  });

  it('respects custom options', () => {
    expect(formatNumber(0.5, 'fr', { style: 'percent' })).toMatch(/50/);
  });
});

describe('formatPercent', () => {
  it('formats fraction as percent', () => {
    expect(formatPercent(0.05, 'fr')).toMatch(/5/);
    expect(formatPercent(0.05, 'en')).toMatch(/5/);
  });
});

describe('formatCurrency', () => {
  it('formats EUR cents → euros in FR', () => {
    // fr-FR EUR: "800,00 €"
    const result = formatCurrency(80000, 'EUR', 'fr');
    expect(result).toMatch(/800/);
    expect(result).toContain('€');
  });

  it('formats EUR cents → euros in EN (en-GB)', () => {
    // en-GB EUR: "€800.00"
    const result = formatCurrency(80000, 'EUR', 'en');
    expect(result).toMatch(/800/);
    expect(result).toContain('€');
  });

  it('handles small amounts', () => {
    const result = formatCurrency(99, 'EUR', 'fr');
    expect(result).toMatch(/0,99/);
  });
});

describe('formatRelativeTime', () => {
  const now = new Date('2026-06-15T10:00:00Z');

  it('formats past minutes in FR', () => {
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const result = formatRelativeTime(fiveMinAgo, 'fr', { now });
    expect(result).toMatch(/5/);
    expect(result).toMatch(/minute/);
  });

  it('formats yesterday in FR (auto numeric)', () => {
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const result = formatRelativeTime(yesterday, 'fr', { now });
    expect(result).toMatch(/hier/);
  });

  it('formats yesterday in EN', () => {
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const result = formatRelativeTime(yesterday, 'en', { now });
    expect(result).toMatch(/yesterday/);
  });

  it('formats future hours', () => {
    const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);
    const result = formatRelativeTime(inOneHour, 'en', { now });
    expect(result).toMatch(/hour/);
  });

  it('handles seconds', () => {
    const result = formatRelativeTime(now, 'fr', { now });
    // 0-second diff → "maintenant" or "now" depending on locale.
    expect(result).toBeTruthy();
  });

  it('uses always-numeric when requested', () => {
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const result = formatRelativeTime(yesterday, 'en', { now, numeric: 'always' });
    expect(result).toMatch(/1 day/);
  });

  it('formats months', () => {
    const monthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const result = formatRelativeTime(monthsAgo, 'fr', { now });
    expect(result).toMatch(/mois/);
  });

  it('formats years', () => {
    const yearsAgo = new Date(now.getTime() - 2 * 365 * 24 * 60 * 60 * 1000);
    const result = formatRelativeTime(yearsAgo, 'en', { now });
    expect(result).toMatch(/year/);
  });
});

describe('formatters — invalid input guards (review fixes)', () => {
  it('formatDate throws RangeError on invalid string', () => {
    expect(() => formatDate('not-a-date', 'fr')).toThrow(RangeError);
  });

  it('formatDateTime throws RangeError on invalid string', () => {
    expect(() => formatDateTime('garbage', 'fr')).toThrow(RangeError);
  });

  it('formatDateRange throws RangeError on invalid `from`', () => {
    expect(() => formatDateRange('garbage', '2026-06-22', 'fr')).toThrow(RangeError);
  });

  it('formatDateRange swaps inverted range (from > to) instead of crashing', () => {
    const result = formatDateRange('2026-06-22', '2026-06-15', 'fr');
    expect(result).toContain('15');
    expect(result).toContain('22');
  });

  it('formatRelativeTime throws on invalid date input', () => {
    expect(() => formatRelativeTime('garbage', 'fr')).toThrow(RangeError);
  });

  it('formatCurrency throws TypeError on non-integer cents (ADR-014 invariant)', () => {
    expect(() => formatCurrency(99.99, 'EUR', 'fr')).toThrow(TypeError);
  });

  it('formatCurrency accepts 0', () => {
    expect(formatCurrency(0, 'EUR', 'fr')).toMatch(/0/);
  });
});
