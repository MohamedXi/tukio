export interface DocumentUploadLabels {
  /** Pill badge shown next to the title when a file is uploaded. */
  uploaded: string;
  /** Action button on the uploaded row — opens the file picker to pick a new file. */
  replace: string;
  /** Aria-label for the X (remove) button on the uploaded row. */
  remove: string;
  /** First half of the drop-zone copy, e.g. "Drop your file here or". */
  dropZoneText: string;
  /** Linked / accented part of the drop-zone copy, e.g. "browse". */
  dropZoneAction: string;
}

export interface DocumentUploadProps {
  /** Section title shown in the card header, e.g. "ID card". */
  label: string;
  /** Whether the field is required — adds a brand-500 asterisk after the title. */
  required?: boolean;
  /** Short formats line shown top-right of the header, e.g. "JPG · PNG · PDF · 5 MB". */
  formats: string;
  /** Long instructions paragraph shown under the title. */
  instructions: string;
  /** Currently uploaded file, or null when empty. */
  file: File | null;
  /** Optional error message rendered below the upload area. */
  error?: string;
  /** Called when the file changes — null when removed. */
  onChange: (file: File | null) => void;
  /** HTML `accept` attribute for the file input. Default: ".jpg,.jpeg,.png,.pdf". */
  accept?: string;
  /** Localized labels. Consumer is responsible for translation. */
  labels: DocumentUploadLabels;
  /** Optional data-testid passthrough for E2E tests. */
  'data-testid'?: string;
}
