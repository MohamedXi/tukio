// Minimal barrel — types + locale constants only. All functional imports
// must use subpath exports (e.g. @tukio/i18n-client/formatters/currency) to
// preserve tree-shaking and avoid pulling React/Next/Server-only code into
// every consumer.
export type { Locale } from './config/locales';
export {
  LOCALES,
  DEFAULT_LOCALE,
  LOCALE_LABELS,
  LOCALE_FLAGS,
  LOCALE_BCP47,
  isLocale,
} from './config/locales';
export { DEFAULT_TIME_ZONE } from './config/time-zones';
