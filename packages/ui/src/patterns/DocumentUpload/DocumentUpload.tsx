'use client';
import { useRef } from 'react';
import { Check, FileText, Upload, X } from 'lucide-react';
import { cn } from '../../utils/cn';
import { Button } from '../../components/Button/Button';
import type { DocumentUploadProps } from './DocumentUpload.types';

const DEFAULT_ACCEPT = '.jpg,.jpeg,.png,.pdf';

/**
 * Single-document KYC-style upload card. Header (title + required asterisk +
 * uploaded badge + formats), then either an uploaded compact row
 * (file icon + name + size + Replace + X) or an empty dashed drop zone
 * (cloud icon + "Drop your file here or browse" + formats).
 *
 * Used by the Pro onboarding wizard (ID card, KBIS, RIB) and the Service-create
 * wizard V1 (listing photos). The visual matches the Cloud Design spec
 * `ProOnbStep3Screen`.
 */
export function DocumentUpload({
  label,
  required,
  formats,
  instructions,
  file,
  error,
  onChange,
  accept = DEFAULT_ACCEPT,
  labels,
  'data-testid': testId,
}: DocumentUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isUploaded = file !== null;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.files?.[0] ?? null;
    onChange(next);
    // Reset so the same file can be re-selected if the user changes their mind.
    e.target.value = '';
  }

  return (
    <div
      data-testid={testId}
      className={cn(
        'rounded-xl border p-5 transition-colors bg-cream-50',
        isUploaded ? 'border-success-200' : 'border-cream-300',
      )}
    >
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
                {labels.uploaded}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-charcoal-500">{instructions}</p>
        </div>
        <span className="shrink-0 pt-1 font-mono text-[11px] text-charcoal-400">{formats}</span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
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
            {labels.replace}
          </Button>
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label={labels.remove}
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
            {labels.dropZoneText}{' '}
            <span className="font-semibold text-brand-700">{labels.dropZoneAction}</span>
          </span>
          <span className="text-xs text-charcoal-400">{formats}</span>
          <input type="file" accept={accept} className="sr-only" onChange={handleFileChange} />
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

DocumentUpload.displayName = 'DocumentUpload';
