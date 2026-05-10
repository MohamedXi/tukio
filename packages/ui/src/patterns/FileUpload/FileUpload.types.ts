export type FileUploadErrorCode = 'fileTypeNotAllowed' | 'fileTooLarge' | 'tooManyFiles';

export interface FileUploadError {
  code: FileUploadErrorCode;
  message: string;
  fileName?: string;
}

export interface FileUploadErrorLabels {
  fileTypeNotAllowed?: string;
  fileTooLarge?: string;
  tooManyFiles?: string;
}

export interface FileUploadProps {
  accept?: string;
  maxSize?: number;
  maxFiles?: number;
  multiple?: boolean;
  onChange: (files: File[]) => void;
  onError?: (error: FileUploadError) => void;
  uploadProgress?: Record<string, number>;
  dropZoneLabel?: string;
  clickToUploadLabel?: string;
  removeLabel?: string;
  errorLabels?: FileUploadErrorLabels;
  className?: string;
}
