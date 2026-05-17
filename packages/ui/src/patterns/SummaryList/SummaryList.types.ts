import type { ReactNode } from 'react';

export interface SummaryListProps {
  /** SummaryList.Item children. */
  children: ReactNode;
  className?: string;
}

export interface SummaryListItemProps {
  /** Leading icon — typically a 18px lucide-react icon. */
  icon: ReactNode;
  /** Small label above the value (e.g. "Identity"). */
  label: string;
  /** Main value text. */
  value: string;
  /** Optional edit handler — when provided, renders a trailing edit button. */
  onEdit?: () => void;
  /** Localized label for the edit button (e.g. "Edit"). Required if onEdit is set. */
  editLabel?: string;
  /** Optional className for the row wrapper. */
  className?: string;
}
