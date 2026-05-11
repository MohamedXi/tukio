import { createI18nRequestConfig } from '@tukio/i18n-client/config/next-intl';

// Each app loads its own messages bundle so unused translations don't leak
// into other apps' bundles.
export default createI18nRequestConfig(
  async (locale) => (await import(`../messages/${locale}.json`)).default,
);
