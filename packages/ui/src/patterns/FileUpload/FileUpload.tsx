'use client';
import { useState, useRef, useEffect, type DragEvent, type ChangeEvent } from 'react';
import { Upload, File as FileIcon, X } from 'lucide-react';
import { Button } from '../../components/Button/Button';
import { ProgressBar } from '../../components/ProgressBar/ProgressBar';
import { cn } from '../../utils/cn';
import type { FileUploadProps, FileUploadError } from './FileUpload.types';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function matchesAccept(file: File, accept?: string): boolean {
  if (!accept) return true;
  const types = accept.split(',').map((t) => t.trim());
  return types.some((type) => {
    if (type.endsWith('/*')) {
      const prefix = type.slice(0, -1);
      return file.type.startsWith(prefix);
    }
    if (type.startsWith('.')) {
      return file.name.toLowerCase().endsWith(type.toLowerCase());
    }
    return file.type === type;
  });
}

export function FileUpload({
  accept,
  maxSize,
  maxFiles,
  multiple,
  onChange,
  onError,
  uploadProgress = {},
  dropZoneLabel = 'Drop files here or click to upload',
  clickToUploadLabel = 'Click to upload',
  removeLabel = 'Remove file',
  errorLabels = {
    fileTypeNotAllowed: 'File type not allowed',
    fileTooLarge: 'File is too large',
    tooManyFiles: 'Too many files',
  },
  className,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [previews, setPreviews] = useState<Record<string, string>>({});

  // Generate object URLs for image previews; revoke on unmount/cleanup
  useEffect(() => {
    const urls: Record<string, string> = {};
    files.forEach((f) => {
      if (f.type.startsWith('image/')) {
        urls[f.name] = URL.createObjectURL(f);
      }
    });
    setPreviews(urls);
    return () => {
      Object.values(urls).forEach(URL.revokeObjectURL);
    };
  }, [files]);

  const validateFiles = (incoming: File[]): { valid: File[]; errors: FileUploadError[] } => {
    const errors: FileUploadError[] = [];
    if (maxFiles && files.length + incoming.length > maxFiles) {
      errors.push({ code: 'tooManyFiles', message: errorLabels.tooManyFiles ?? 'Too many files' });
      return { valid: [], errors };
    }
    const valid = incoming.filter((file) => {
      if (!matchesAccept(file, accept)) {
        errors.push({
          code: 'fileTypeNotAllowed',
          message: errorLabels.fileTypeNotAllowed ?? 'File type not allowed',
          fileName: file.name,
        });
        return false;
      }
      if (maxSize && file.size > maxSize) {
        errors.push({
          code: 'fileTooLarge',
          message: errorLabels.fileTooLarge ?? 'File is too large',
          fileName: file.name,
        });
        return false;
      }
      return true;
    });
    return { valid, errors };
  };

  const handleFiles = (incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    const { valid, errors } = validateFiles(arr);
    errors.forEach((err) => onError?.(err));
    if (valid.length === 0) return;
    const next = multiple ? [...files, ...valid] : valid;
    setFiles(next);
    onChange(next);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files);
  };

  const handleDragOver = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
  };

  const removeFile = (index: number) => {
    const next = files.filter((_, i) => i !== index);
    setFiles(next);
    onChange(next);
  };

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleInputChange}
        className="sr-only"
        id="tukio-file-upload-input"
        aria-label={dropZoneLabel}
      />
      <label
        htmlFor="tukio-file-upload-input"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'flex flex-col items-center justify-center gap-2 p-8 rounded-md border-2 border-dashed cursor-pointer transition-colors',
          'focus-within:outline-none focus-within:ring-2 focus-within:ring-brand-200',
          isDragOver
            ? 'border-brand-500 bg-brand-100'
            : 'border-cream-300 hover:border-brand-500 hover:bg-brand-50',
        )}
      >
        <Upload size={32} className="text-charcoal-400" aria-hidden="true" />
        <p className="text-sm text-charcoal-700">{dropZoneLabel}</p>
        <p className="text-xs text-charcoal-400">{clickToUploadLabel}</p>
      </label>
      {files.length > 0 && (
        <ul className="flex flex-col gap-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex items-center gap-3 p-2 bg-cream-50 border border-cream-200 rounded-md"
            >
              {previews[file.name] ? (
                <img src={previews[file.name]} alt="" className="w-10 h-10 rounded object-cover" />
              ) : (
                <FileIcon
                  size={20}
                  className="text-charcoal-400 flex-shrink-0"
                  aria-hidden="true"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-charcoal-700 truncate">{file.name}</p>
                <p className="text-xs text-charcoal-400">{formatBytes(file.size)}</p>
                {uploadProgress[file.name] !== undefined && (
                  <ProgressBar
                    value={uploadProgress[file.name]}
                    max={100}
                    className="mt-1"
                    aria-label={`Uploading ${file.name}`}
                  />
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                icon={<X size={14} />}
                onClick={() => removeFile(index)}
                aria-label={removeLabel}
              >
                {''}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

FileUpload.displayName = 'FileUpload';
