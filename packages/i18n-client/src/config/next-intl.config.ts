import { getRequestConfig } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { isLocale, type Locale } from './locales.js';
import { DEFAULT_TIME_ZONE } from './time-zones.js';

export type LoadMessages = (locale: Locale) => Promise<Record<string, unknown>>;

// Factory that wires next-intl's getRequestConfig with Tukio defaults.
// Each app calls this with its own message loader (to keep the messages
// bundle scoped per app — apps/customer/messages/{fr,en}.json etc).
//
// Example usage in apps/customer/src/i18n.ts:
//
//   import { createI18nRequestConfig } from '@tukio/i18n-client/config/next-intl';
//   export default createI18nRequestConfig(
//     async (locale) => (await import(`./messages/${locale}.json`)).default,
//   );
export function createI18nRequestConfig(loadMessages: LoadMessages) {
  return getRequestConfig(async ({ requestLocale }) => {
    const requested = await requestLocale;
    if (!requested || !isLocale(requested)) {
      notFound();
    }
    const locale = requested as Locale;
    return {
      locale,
      messages: await loadMessages(locale),
      timeZone: DEFAULT_TIME_ZONE,
      now: new Date(),
    };
  });
}
