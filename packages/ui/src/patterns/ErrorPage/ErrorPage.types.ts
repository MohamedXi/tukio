export type ErrorPageVariant = '404' | '500' | 'maintenance';

export interface ErrorPageProps {
  variant: ErrorPageVariant;
  title?: string;
  description?: string;
  eventId?: string;
  eventIdLabel?: string;
  retryLabel?: string;
  goHomeLabel?: string;
  onRetry?: () => void;
  onGoHome?: () => void;
  className?: string;
}
