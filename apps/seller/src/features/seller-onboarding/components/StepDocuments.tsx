'use client';

import { Clock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Alert } from '@tukio/ui/components/Alert';
import { DocumentUpload } from '@tukio/ui/patterns/DocumentUpload';
import type { DocumentsState } from '../wizard-state';

interface StepDocumentsProps {
  values: DocumentsState;
  errors?: Record<string, string>;
  onChange: (field: keyof DocumentsState, file: File | null) => void;
}

export function StepDocuments({ values, errors = {}, onChange }: StepDocumentsProps) {
  const t = useTranslations('seller.onboarding.documents');

  const docLabels = {
    uploaded: t('uploaded'),
    replace: t('replace'),
    remove: t('remove'),
    dropZoneText: t('dropZoneText'),
    dropZoneAction: t('dropZoneAction'),
  };

  return (
    <div className="flex flex-col gap-6" data-testid="step-documents">
      <div>
        <h1 className="font-display text-2xl font-semibold text-charcoal-800">{t('title')}</h1>
        <p className="mt-2 text-sm text-charcoal-500">{t('subtitle')}</p>
      </div>

      <Alert variant="brand" title={t('whyTitle')}>
        {t('whyText')}
      </Alert>

      <DocumentUpload
        label={t('idCard')}
        required
        formats={t('formatsImages')}
        instructions={t('idCardInstructions')}
        file={values.idCard}
        error={errors['idCard']}
        onChange={(f) => onChange('idCard', f)}
        labels={docLabels}
        data-testid="doc-upload-idCard"
      />

      <DocumentUpload
        label={t('kbis')}
        formats={t('formatsPdf')}
        instructions={t('kbisInstructions')}
        file={values.kbisOrInsee}
        error={errors['kbisOrInsee']}
        onChange={(f) => onChange('kbisOrInsee', f)}
        labels={docLabels}
        data-testid="doc-upload-kbis"
      />

      <DocumentUpload
        label={t('rib')}
        required
        formats={t('formatsImages')}
        instructions={t('ribInstructions')}
        file={values.rib}
        error={errors['rib']}
        onChange={(f) => onChange('rib', f)}
        labels={docLabels}
        data-testid="doc-upload-rib"
      />

      <div className="flex gap-3 rounded-lg bg-cream-100 px-4 py-3">
        <Clock size={16} className="mt-0.5 shrink-0 text-charcoal-500" aria-hidden="true" />
        <p className="text-xs leading-relaxed text-charcoal-600">{t('noteText')}</p>
      </div>
    </div>
  );
}
