import { LOCALE_BCP47, type Locale } from '../config/locales.js';

// Threshold (seconds) → unit. Picks the largest unit whose magnitude makes
// sense for the diff ("il y a 5 min" not "il y a 300 sec").
const UNIT_THRESHOLDS: Array<{ unit: Intl.RelativeTimeFormatUnit; seconds: number }> = [
  { unit: 'year', seconds: 365 * 24 * 60 * 60 },
  { unit: 'month', seconds: 30 * 24 * 60 * 60 },
  { unit: 'week', seconds: 7 * 24 * 60 * 60 },
  { unit: 'day', seconds: 24 * 60 * 60 },
  { unit: 'hour', seconds: 60 * 60 },
  { unit: 'minute', seconds: 60 },
  { unit: 'second', seconds: 1 },
];

export interface FormatRelativeTimeOptions {
  // Inject `now` for deterministic tests.
  now?: Date;
  // Numeric mode: 'auto' = "yesterday"/"hier", 'always' = "1 day ago" / "il y a 1 jour".
  // Default 'auto' for nicer human output.
  numeric?: 'auto' | 'always';
}

// Examples:
//   formatRelativeTime(fiveMinAgo, 'fr') → "il y a 5 minutes"
//   formatRelativeTime(yesterday,  'fr') → "hier"
//   formatRelativeTime(inOneHour,  'en') → "in 1 hour"
export function formatRelativeTime(
  date: Date | string,
  locale: Locale,
  options: FormatRelativeTimeOptions = {},
): string {
  const target = typeof date === 'string' ? new Date(date) : date;
  const now = options.now ?? new Date();
  const diffSeconds = Math.round((target.getTime() - now.getTime()) / 1000);

  const rtf = new Intl.RelativeTimeFormat(LOCALE_BCP47[locale], {
    numeric: options.numeric ?? 'auto',
  });

  const absDiff = Math.abs(diffSeconds);
  for (const { unit, seconds } of UNIT_THRESHOLDS) {
    if (absDiff >= seconds) {
      return rtf.format(Math.round(diffSeconds / seconds), unit);
    }
  }
  // Diff < 1 second.
  return rtf.format(0, 'second');
}
