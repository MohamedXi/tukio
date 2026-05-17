'use client';

import { useTranslations } from 'next-intl';
import { FileUpload } from '@tukio/ui/patterns/FileUpload';
import type { DocumentsState } from '../wizard-state';

const ACCEPT = '.jpg,.jpeg,.png,.pdf';
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

interface DocumentSlotProps {
  label: string;
  hint: string;
  required?: boolean;
  file: File | null;
  error?: string;
  onChange: (file: File | null) => void;
  tDocuments: ReturnType<typeof useTranslations>;
}

function DocumentSlot({
  label,
  hint,
  required,
  file,
  error,
  onChange,
  tDocuments,
}: DocumentSlotProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-sm font-medium text-charcoal-700">
        {label}
        {required && <span className="ml-0.5 text-error-500">*</span>}
      </p>
      <p className="text-xs text-charcoal-500">{hint}</p>
      <FileUpload
        accept={ACCEPT}
        maxSize={MAX_SIZE_BYTES}
        maxFiles={1}
        multiple={false}
        onChange={(files: File[]) => onChange(files[0] ?? null)}
        dropZoneLabel={tDocuments('uploadLabel')}
        clickToUploadLabel={tDocuments('uploadLabel')}
        errorLabels={{
          fileTypeNotAllowed: tDocuments('errors.fileType'),
          fileTooLarge: tDocuments('errors.fileTooLarge'),
          tooManyFiles: tDocuments('tooManyFiles'),
        }}
      />
      {file && (
        <p className="flex items-center gap-1 text-xs text-success-700">
          <span>✓</span>
          <span>{file.name}</span>
        </p>
      )}
      {error && (
        <p className="text-xs text-error-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

interface StepDocumentsProps {
  values: DocumentsState;
  errors?: Record<string, string>;
  onChange: (field: keyof DocumentsState, file: File | null) => void;
}

export function StepDocuments({ values, errors = {}, onChange }: StepDocumentsProps) {
  const t = useTranslations('seller.onboarding.documents');

  return (
    <div className="flex flex-col gap-8" data-testid="step-documents">
      <div>
        <h1 className="font-display text-2xl font-semibold text-charcoal-800">{t('title')}</h1>
        <p className="mt-2 text-sm text-charcoal-500">{t('subtitle')}</p>
      </div>

      <DocumentSlot
        label={t('idCard')}
        hint={t('idCardHint')}
        required
        file={values.idCard}
        error={errors['idCard']}
        onChange={(f) => onChange('idCard', f)}
        tDocuments={t}
      />

      <DocumentSlot
        label={t('rib')}
        hint={t('ribHint')}
        required
        file={values.rib}
        error={errors['rib']}
        onChange={(f) => onChange('rib', f)}
        tDocuments={t}
      />

      <DocumentSlot
        label={`${t('kbis')} ${t('kbisOptional')}`}
        hint={t('kbisHint')}
        file={values.kbisOrInsee}
        onChange={(f) => onChange('kbisOrInsee', f)}
        tDocuments={t}
      />
    </div>
  );
}
