import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Check, ArrowRight, Mail, Tag, Clock } from 'lucide-react';
import { Kicker } from '@tukio/ui/components/Kicker';
import { Button } from '@tukio/ui/components/Button';

type SubjectKey = 'general' | 'devenirPro' | 'technique' | 'partenariat' | 'presse';

interface ContactSuccessHeroProps {
  locale: string;
  firstName: string;
  email: string;
  subject: SubjectKey;
  submittedAt: Date;
}

export async function ContactSuccessHero({
  locale,
  firstName,
  email,
  subject,
  submittedAt,
}: ContactSuccessHeroProps) {
  const t = await getTranslations({ locale, namespace: 'contact.success' });
  const sellerBaseUrl = process.env['NEXT_PUBLIC_SELLER_BASE_URL'] ?? 'https://seller.tukio.one';

  const formattedTime = new Intl.DateTimeFormat(locale, {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(submittedAt);

  return (
    <main
      id="main-content"
      className="flex-1 flex items-center justify-center px-6 py-16 max-md:px-4 max-md:py-10"
    >
      <div className="max-w-[620px] text-center w-full">
        <div className="mx-auto flex items-center justify-center w-20 h-20 rounded-full bg-success-50 border-2 border-success-500">
          <Check size={36} color="var(--color-success-700)" strokeWidth={2.5} />
        </div>

        <div className="mt-6">
          <Kicker color="success">{t('kicker')}</Kicker>
        </div>

        <h1 className="font-display font-normal text-[44px] tracking-tight text-charcoal-800 mt-3 leading-[1.05] max-md:text-[36px]">
          {t('titleLine1')}{' '}
          <em className="italic text-brand-600">
            {firstName}
            {t('titleEmphasisSuffix')}
          </em>
        </h1>

        <p className="text-[16px] text-charcoal-600 mt-4 leading-[1.6]">{t('lead')}</p>

        <div className="mt-8 rounded-xl bg-cream-50 border border-cream-200 px-6 py-5 text-left">
          <p className="text-[12px] font-mono uppercase tracking-wider text-charcoal-500 mb-3">
            {t('recapTitle')}
          </p>
          <dl className="flex flex-col gap-3">
            <RecapRow
              icon={<Mail size={16} aria-hidden="true" />}
              label={t('recapEmailLabel')}
              value={email}
              mono
            />
            <RecapRow
              icon={<Tag size={16} aria-hidden="true" />}
              label={t('recapSubjectLabel')}
              value={t(`subjects.${subject}`)}
            />
            <RecapRow
              icon={<Clock size={16} aria-hidden="true" />}
              label={t('recapTimeLabel')}
              value={formattedTime}
            />
          </dl>
        </div>

        <div className="mt-6 rounded-md bg-cream-100 px-5 py-4 text-left">
          <p className="text-[13px] font-semibold text-charcoal-800 mb-1.5">{t('whatNextTitle')}</p>
          <p className="text-[13px] text-charcoal-600 leading-[1.6]">{t('whatNextBody')}</p>
        </div>

        <div className="mt-8 flex gap-3 justify-center max-sm:flex-col">
          <Link href={`/${locale}`} className="no-underline">
            <Button
              variant="primary"
              size="lg"
              iconRight={<ArrowRight size={16} aria-hidden="true" />}
            >
              {t('ctaHome')}
            </Button>
          </Link>
          <a href={`${sellerBaseUrl}/${locale}/seller-coming-soon`} className="no-underline">
            <Button variant="secondary" size="lg">
              {t('ctaBecomePro')}
            </Button>
          </a>
        </div>
      </div>
    </main>
  );
}

function RecapRow({
  icon,
  label,
  value,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-8 h-8 rounded-md bg-brand-50 text-brand-700 inline-flex items-center justify-center flex-shrink-0">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <dt className="text-[12px] text-charcoal-500 mb-0.5">{label}</dt>
        <dd
          className={`text-[14px] text-charcoal-800 break-words ${mono ? 'font-mono' : 'font-medium'}`}
        >
          {value}
        </dd>
      </div>
    </div>
  );
}
