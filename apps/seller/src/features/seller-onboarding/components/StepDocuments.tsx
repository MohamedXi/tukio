'use client';

import { useRef } from 'react';
import { Shield, Clock, FileText, Upload, X, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@tukio/ui/components/Button';
import type { DocumentsState } from '../wizard-state';

interface DocUploadProps {
  label: string;
  required?: boolean;
  formats: string;
  instructions: string;
  file: File | null;
  error?: string;
  onChange: (file: File | null) => void;
  uploadedLabel: string;
  replaceLabel: string;
  removeLabel: string;
  dropZoneText: string;
  dropZoneAction: string;
}

function DocUpload({
  label,
  required,
  formats,
  instructions,
  file,
  error,
  onChange,
  uploadedLabel,
  replaceLabel,
  removeLabel,
  dropZoneText,
  dropZoneAction,
}: DocUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isUploaded = file !== null;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    onChange(f);
    e.target.value = '';
  }

  return (
    <div
      className={`rounded-xl border p-5 transition-colors ${
        isUploaded ? 'border-success-200 bg-cream-50' : 'border-cream-300 bg-cream-50'
      }`}
    >
      {/* Header row */}
      <div className="mb-3.5 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-charcoal-800">
              {label}
              {required && (
                <span className="ml-0.5 text-brand-500" aria-hidden="true">
                  *
                </span>
              )}
            </h3>
            {isUploaded && (
              <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-[11px] font-semibold text-success-700">
                <Check size={11} strokeWidth={2.5} aria-hidden="true" />
                {uploadedLabel}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-charcoal-500">{instructions}</p>
        </div>
        <span className="shrink-0 pt-1 font-mono text-[11px] text-charcoal-400">{formats}</span>
      </div>

      {/* Hidden input for replace */}
      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.pdf"
        className="sr-only"
        onChange={handleFileChange}
        tabIndex={-1}
        aria-hidden="true"
      />

      {isUploaded ? (
        <div className="flex items-center gap-3 rounded-lg bg-cream-100 px-3.5 py-2.5">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-cream-50 text-charcoal-600"
            aria-hidden="true"
          >
            <FileText size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-charcoal-800">{file.name}</p>
            <p className="font-mono text-[11px] text-charcoal-500">
              {(file.size / (1024 * 1024)).toFixed(1)} Mo
            </p>
          </div>
          <Button variant="ghost" size="sm" type="button" onClick={() => inputRef.current?.click()}>
            {replaceLabel}
          </Button>
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label={removeLabel}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-error-600 hover:bg-error-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error-500/30"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <label className="flex cursor-pointer flex-col items-center gap-2.5 rounded-lg border-2 border-dashed border-cream-300 bg-cream-50 px-5 py-8 text-center transition-colors hover:border-brand-300 hover:bg-brand-50/30">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-cream-100">
            <Upload size={20} className="text-charcoal-600" aria-hidden="true" />
          </span>
          <span className="text-sm font-medium text-charcoal-700">
            {dropZoneText} <span className="font-semibold text-brand-700">{dropZoneAction}</span>
          </span>
          <span className="text-xs text-charcoal-400">{formats}</span>
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.pdf"
            className="sr-only"
            onChange={handleFileChange}
          />
        </label>
      )}

      {error && (
        <p className="mt-2 text-xs text-error-600" role="alert">
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

  const sharedProps = {
    uploadedLabel: t('uploaded'),
    replaceLabel: t('replace'),
    removeLabel: t('remove'),
    dropZoneText: t('dropZoneText'),
    dropZoneAction: t('dropZoneAction'),
  };

  return (
    <div className="flex flex-col gap-6" data-testid="step-documents">
      <div>
        <h1 className="font-display text-2xl font-semibold text-charcoal-800">{t('title')}</h1>
        <p className="mt-2 text-sm text-charcoal-500">{t('subtitle')}</p>
      </div>

      {/* KYC info banner */}
      <div className="flex gap-3 rounded-lg border border-brand-100 bg-brand-50 px-4 py-3">
        <Shield size={20} className="mt-0.5 shrink-0 text-brand-700" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-brand-700">{t('whyTitle')}</p>
          <p className="mt-1 text-xs leading-relaxed text-brand-700">{t('whyText')}</p>
        </div>
      </div>

      <DocUpload
        label={t('idCard')}
        required
        formats={t('formatsImages')}
        instructions={t('idCardInstructions')}
        file={values.idCard}
        error={errors['idCard']}
        onChange={(f) => onChange('idCard', f)}
        {...sharedProps}
      />

      <DocUpload
        label={t('kbis')}
        formats={t('formatsPdf')}
        instructions={t('kbisInstructions')}
        file={values.kbisOrInsee}
        error={errors['kbisOrInsee']}
        onChange={(f) => onChange('kbisOrInsee', f)}
        {...sharedProps}
      />

      <DocUpload
        label={t('rib')}
        required
        formats={t('formatsImages')}
        instructions={t('ribInstructions')}
        file={values.rib}
        error={errors['rib']}
        onChange={(f) => onChange('rib', f)}
        {...sharedProps}
      />

      {/* Validation note */}
      <div className="flex gap-3 rounded-lg bg-cream-100 px-4 py-3">
        <Clock size={16} className="mt-0.5 shrink-0 text-charcoal-500" aria-hidden="true" />
        <p className="text-xs leading-relaxed text-charcoal-600">{t('noteText')}</p>
      </div>
    </div>
  );
}
