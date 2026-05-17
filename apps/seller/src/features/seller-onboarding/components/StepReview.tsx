'use client';

import { useState } from 'react';
import { User, Building2, Tent, FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Alert } from '@tukio/ui/components/Alert';
import type { WizardState, WizardStep } from '../wizard-state';

interface SummaryItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  step: WizardStep;
  onEdit: (step: WizardStep) => void;
  editLabel: string;
  isFirst?: boolean;
}

function SummaryItem({ icon, label, value, step, onEdit, editLabel, isFirst }: SummaryItemProps) {
  return (
    <div
      className={`flex items-center gap-4 px-5 py-4${isFirst ? '' : ' border-t border-cream-200'}`}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-charcoal-500">{label}</p>
        <p className="mt-0.5 truncate text-sm font-medium text-charcoal-800">{value}</p>
      </div>
      <button
        type="button"
        onClick={() => onEdit(step)}
        className="shrink-0 text-xs font-medium text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30"
      >
        {editLabel}
      </button>
    </div>
  );
}

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

  return (
    <div className="flex flex-col gap-6" data-testid="step-review">
      <div>
        <h1 className="font-display text-2xl font-semibold text-charcoal-800">{t('title')}</h1>
        <p className="mt-2 text-sm text-charcoal-500">{t('subtitle')}</p>
      </div>

      {bannerError && <Alert variant="error">{bannerError}</Alert>}

      {/* Summary card */}
      <div className="overflow-hidden rounded-xl border border-cream-200 bg-cream-50">
        <SummaryItem
          icon={<User size={18} />}
          label={t('sections.identity')}
          value={identityValue}
          step={1}
          onEdit={onEdit}
          editLabel={tCommon('edit')}
          isFirst
        />
        <SummaryItem
          icon={<Building2 size={18} />}
          label={t('sections.activity')}
          value={activityValue}
          step={2}
          onEdit={onEdit}
          editLabel={tCommon('edit')}
        />
        <SummaryItem
          icon={<Tent size={18} />}
          label={t('labels.categories')}
          value={categoriesValue}
          step={2}
          onEdit={onEdit}
          editLabel={tCommon('edit')}
        />
        <SummaryItem
          icon={<FileText size={18} />}
          label={t('sections.documents')}
          value={documentsValue}
          step={3}
          onEdit={onEdit}
          editLabel={tCommon('edit')}
        />
      </div>

      {/* Charter */}
      <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-cream-100 px-4 py-4 text-sm leading-relaxed text-charcoal-600">
        <input
          type="checkbox"
          className="mt-0.5 accent-brand-500"
          checked={charterAccepted}
          onChange={(e) => {
            setCharterAccepted(e.target.checked);
            if (e.target.checked) setCharterError(undefined);
          }}
          data-testid="checkbox-charter"
        />
        <span>
          {t.rich('charter', {
            charterLink: (chunks) => (
              <a className="font-medium text-brand-700 hover:underline">{chunks}</a>
            ),
          })}
        </span>
      </label>
      {charterError && (
        <p className="text-xs text-error-600" role="alert">
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
