import { createI18nRequestConfig } from '@tukio/i18n-client/config/next-intl';

export default createI18nRequestConfig(
  async (locale) => (await import(`../messages/${locale}.json`)).default,
);
