import { getTranslations } from 'next-intl/server';
import { Zap } from 'lucide-react';
import { Block } from '@tukio/ui/patterns/EditorialPageShell';

// Update manually when the legal notice changes.
const LEGAL_LAST_UPDATED_FR = '20 mai 2026';
const LEGAL_LAST_UPDATED_EN = 'May 20, 2026';

interface LegalContentProps {
  locale: string;
}

export async function LegalContent({ locale }: LegalContentProps) {
  const t = await getTranslations({ locale, namespace: 'legal' });
  const lastUpdated = locale === 'fr' ? LEGAL_LAST_UPDATED_FR : LEGAL_LAST_UPDATED_EN;

  return (
    <>
      <p className="text-[12px] text-charcoal-500 mb-8">
        {t('lastUpdated', { date: lastUpdated })}
      </p>

      {/* Status banner */}
      <div className="mt-3 p-5 bg-brand-50 border border-brand-100 rounded-xl flex gap-3.5">
        <Zap size={20} className="text-brand-700 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <h3 className="text-[15px] font-semibold text-brand-700">{t('statusBanner.title')}</h3>
          <p className="text-[13px] text-charcoal-700 mt-1.5 leading-[1.55]">
            {t('statusBanner.body')}
          </p>
        </div>
      </div>

      <Block title={t('blocks.responsible.title')} className="mt-5">
        <p className="mb-2">{t('blocks.responsible.p1')}</p>
        <p>{t('blocks.responsible.p2')}</p>
      </Block>

      <Block title={t('blocks.company.title')} className="mt-5">
        <p className="mb-3">{t('blocks.company.intro')}</p>
        <ul className="pl-5 m-0">
          {(['0', '1', '2', '3', '4'] as const).map((i) => (
            <li key={i} className="mb-1.5 last:mb-0">
              {t(`blocks.company.items.${i}`)}
            </li>
          ))}
        </ul>
      </Block>

      <Block title={t('blocks.hosting.title')} className="mt-5">
        <p className="mb-2">{t('blocks.hosting.p1')}</p>
        <p>{t('blocks.hosting.p2')}</p>
      </Block>

      <Block title={t('blocks.nature.title')} className="mt-5">
        <p>{t('blocks.nature.body')}</p>
      </Block>

      <Block title={t('blocks.ip.title')} className="mt-5">
        <p>{t('blocks.ip.body')}</p>
      </Block>

      <Block title={t('blocks.contact.title')} className="mt-5">
        <p>{t('blocks.contact.body')}</p>
      </Block>
    </>
  );
}
