import { getTranslations } from 'next-intl/server';
import { MessageSquare, Shield, Zap, User } from 'lucide-react';
import { Kicker } from '@tukio/ui/components/Kicker';
import { ContactFormClient } from './ContactFormClient.js';

interface ContactPageShellProps {
  locale: string;
}

const CHANNEL_ICONS = {
  support: MessageSquare,
  dpo: Shield,
  report: Zap,
  press: User,
} as const;

export async function ContactPageShell({ locale }: ContactPageShellProps) {
  const t = await getTranslations({ locale, namespace: 'contact' });

  return (
    <div className="max-w-[1200px] mx-auto px-10 py-[72px] pb-24 max-md:px-4 max-md:py-12">
      <Kicker color="brand">{t('kicker')}</Kicker>
      <h1 className="font-display font-normal tracking-[-0.025em] leading-[1.05] text-charcoal-800 mt-3.5 text-[52px] max-md:text-[40px]">
        {t('titleLine1')} <em className="italic text-brand-600">{t('titleEmphasis')}</em>.
      </h1>
      <p className="text-[17px] text-charcoal-600 mt-[18px] leading-[1.6] max-w-[600px]">
        {t('intro')}
      </p>

      <div className="grid grid-cols-[1.2fr_1fr] gap-12 mt-14 max-md:grid-cols-1">
        {/* Form — wrapped in a card to mirror design ref `<form class="tk-card">` */}
        <div className="p-8 rounded-xl bg-cream-50 border border-cream-200 max-md:p-6">
          <ContactFormClient locale={locale} />
        </div>

        {/* Channels aside */}
        <aside className="flex flex-col gap-4" aria-label={t('channelsAriaLabel')}>
          {(['support', 'dpo', 'report', 'press'] as const).map((channel) => {
            const Icon = CHANNEL_ICONS[channel];
            return (
              <div key={channel} className="p-5 rounded-xl bg-cream-50 border border-cream-200">
                <div className="flex gap-3 items-start">
                  <span
                    className="w-9 h-9 rounded-lg bg-brand-50 text-brand-700 inline-flex items-center justify-center flex-shrink-0"
                    aria-hidden="true"
                  >
                    <Icon size={18} />
                  </span>
                  <div className="flex-1">
                    <h3 className="text-[14px] font-semibold text-charcoal-800">
                      {t(`channels.${channel}.title`)}
                    </h3>
                    <a
                      href={`mailto:${t(`channels.${channel}.email`)}`}
                      className="block text-[14px] text-brand-700 font-mono mt-1 hover:text-brand-800 no-underline"
                    >
                      {t(`channels.${channel}.email`)}
                    </a>
                    <p className="text-[12px] text-charcoal-500 mt-1.5 leading-[1.5]">
                      {t(`channels.${channel}.description`)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Preparation note card */}
          <div className="p-5 rounded-xl bg-cream-100 border border-cream-200">
            <h3 className="text-[14px] font-semibold text-charcoal-800">{t('preparationTitle')}</h3>
            <p className="text-[13px] text-charcoal-600 mt-2 leading-[1.55]">
              {t('preparationNote')}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
