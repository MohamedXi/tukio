'use client';

import { useState } from 'react';
import { User, Building2, Tent, FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Alert } from '@tukio/ui/components/Alert';
import { Checkbox } from '@tukio/ui/components/Checkbox';
import { SummaryList } from '@tukio/ui/patterns/SummaryList';
import type { WizardState, WizardStep } from '../wizard-state';

interface StepReviewProps {
  state: WizardState;
  onEdit: (step: WizardStep) => void;
  onSubmit: (charterAccepted: true) => void;
  isSubmitting: boolean;
  bannerError?: string;
}

export function StepReview({
  state,
  onEdit,
  onSubmit,
  isSubmitting,
  bannerError,
}: StepReviewProps) {
  const t = useTranslations('seller.onboarding.review');
  const tActivity = useTranslations('seller.onboarding.activity');
  const tCommon = useTranslations('seller.onboarding.common');
  const [charterAccepted, setCharterAccepted] = useState(false);
  const [charterError, setCharterError] = useState<string | undefined>(undefined);

  const { identity, activity, documents } = state;
  const docCount = [documents.idCard, documents.rib, documents.kbisOrInsee].filter(Boolean).length;

  function handleSubmitClick() {
    if (!charterAccepted) {
      setCharterError(t('errors.charterRequired'));
      return;
    }
    setCharterError(undefined);
    onSubmit(true);
  }

  const identityValue = identity
    ? `${identity.firstName} ${identity.lastName} · ${identity.email}`
    : '—';

  const activityValue = activity
    ? `${activity.companyName} · ${tActivity(`legalForms.${activity.legalForm}`)} · SIRET ${activity.siret}`
    : '—';

  const categoriesValue = activity?.categories.length
    ? activity.categories.map((c) => tActivity(`categoryList.${c}`)).join(' + ')
    : '—';

  const documentsValue = t('documentsUploaded', { count: docCount });
  const editLabel = tCommon('edit');

  return (
    <div className="flex flex-col gap-6" data-testid="step-review">
      <div>
        <h1 className="font-display text-2xl font-semibold text-charcoal-800">{t('title')}</h1>
        <p className="mt-2 text-sm text-charcoal-500">{t('subtitle')}</p>
      </div>

      {bannerError && <Alert variant="error">{bannerError}</Alert>}

      <SummaryList>
        <SummaryList.Item
          icon={<User size={18} />}
          label={t('sections.identity')}
          value={identityValue}
          onEdit={() => onEdit(1)}
          editLabel={editLabel}
        />
        <SummaryList.Item
          icon={<Building2 size={18} />}
          label={t('sections.activity')}
          value={activityValue}
          onEdit={() => onEdit(2)}
          editLabel={editLabel}
        />
        <SummaryList.Item
          icon={<Tent size={18} />}
          label={t('labels.categories')}
          value={categoriesValue}
          onEdit={() => onEdit(2)}
          editLabel={editLabel}
        />
        <SummaryList.Item
          icon={<FileText size={18} />}
          label={t('sections.documents')}
          value={documentsValue}
          onEdit={() => onEdit(3)}
          editLabel={editLabel}
        />
      </SummaryList>

      <Checkbox
        checked={charterAccepted}
        error={Boolean(charterError)}
        onChange={(e) => {
          setCharterAccepted(e.target.checked);
          if (e.target.checked) setCharterError(undefined);
        }}
        wrapperClassName="rounded-lg bg-cream-100 px-4 py-4"
        data-testid="checkbox-charter"
      >
        {t.rich('charter', {
          charterLink: (chunks) => (
            <a className="font-medium text-brand-700 hover:underline">{chunks}</a>
          ),
        })}
      </Checkbox>
      {charterError && (
        <p className="-mt-3 text-xs text-error-600" role="alert">
          {charterError}
        </p>
      )}

      <button
        type="button"
        id="step-review-submit"
        className="hidden"
        onClick={handleSubmitClick}
        aria-hidden="true"
        disabled={isSubmitting}
      />
    </div>
  );
}
