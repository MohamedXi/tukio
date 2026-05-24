import { getTranslations } from 'next-intl/server';
import { Shield } from 'lucide-react';
import { Block } from '@tukio/ui/patterns/EditorialPageShell';

// Update this constant manually when the privacy policy changes.
// Story V1+ may sync from a CMS or env var.
const PRIVACY_LAST_UPDATED_FR = '20 mai 2026';
const PRIVACY_LAST_UPDATED_EN = 'May 20, 2026';

interface PrivacyContentProps {
  locale: string;
}

export async function PrivacyContent({ locale }: PrivacyContentProps) {
  const t = await getTranslations({ locale, namespace: 'privacy' });
  const lastUpdated = locale === 'fr' ? PRIVACY_LAST_UPDATED_FR : PRIVACY_LAST_UPDATED_EN;

  return (
    <>
      <p className="text-[12px] text-charcoal-500 mb-8">
        {t('lastUpdated', { date: lastUpdated })}
      </p>

      {/* Pre-launch banner */}
      <div className="p-5 bg-brand-50 border border-brand-100 rounded-xl mb-8 flex gap-3.5">
        <Shield size={20} className="text-brand-700 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <h3 className="text-[15px] font-semibold text-brand-700">{t('preLaunchBanner.title')}</h3>
          <p className="text-[13px] text-charcoal-700 mt-1.5 leading-[1.55]">
            {t('preLaunchBanner.body')}
          </p>
        </div>
      </div>

      <Block title={t('blocks.whoCollects.title')} className="mt-5">
        <p>{t('blocks.whoCollects.body')}</p>
      </Block>

      <Block title={t('blocks.whatCollected.title')} className="mt-5">
        <ul className="pl-5 m-0">
          {(['0', '1', '2'] as const).map((i) => (
            <li key={i} className="mb-2 last:mb-0">
              <strong>{t(`blocks.whatCollected.items.${i}.label`)}</strong>{' '}
              {t(`blocks.whatCollected.items.${i}.text`)}
            </li>
          ))}
        </ul>
      </Block>

      <Block title={t('blocks.whyCollected.title')} className="mt-5">
        <p>{t('blocks.whyCollected.body')}</p>
      </Block>

      <Block title={t('blocks.retention.title')} className="mt-5">
        <p>{t('blocks.retention.body')}</p>
      </Block>

      <Block title={t('blocks.postLaunch.title')} className="mt-5">
        <p>{t('blocks.postLaunch.body')}</p>
      </Block>

      <Block title={t('blocks.yourRights.title')} className="mt-5">
        <p>{t('blocks.yourRights.body')}</p>
      </Block>

      <Block title={t('blocks.hosting.title')} className="mt-5">
        <p>{t('blocks.hosting.body')}</p>
      </Block>

      <Block title={t('blocks.complaint.title')} className="mt-5">
        <p>{t('blocks.complaint.body')}</p>
      </Block>
    </>
  );
}
