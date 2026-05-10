import { MapPinOff, AlertOctagon, Wrench } from 'lucide-react';
import { Button } from '../../components/Button/Button';
import { cn } from '../../utils/cn';
import type { ErrorPageProps, ErrorPageVariant } from './ErrorPage.types';

const variantConfig: Record<
  ErrorPageVariant,
  { icon: React.ComponentType<{ size?: number }>; title: string; description: string }
> = {
  '404': {
    icon: MapPinOff,
    title: 'Page not found',
    description: 'The page you are looking for does not exist or has been moved.',
  },
  '500': {
    icon: AlertOctagon,
    title: 'Something went wrong',
    description: 'An unexpected error occurred. Our team has been notified.',
  },
  maintenance: {
    icon: Wrench,
    title: 'Under maintenance',
    description: 'We are performing scheduled maintenance. Please try again shortly.',
  },
};

export function ErrorPage({
  variant,
  title,
  description,
  eventId,
  eventIdLabel = 'Error ID',
  retryLabel = 'Try again',
  goHomeLabel = 'Back to home',
  onRetry,
  onGoHome,
  className,
}: ErrorPageProps) {
  const config = variantConfig[variant];
  const Icon = config.icon;
  const resolvedTitle = title ?? config.title;
  const resolvedDescription = description ?? config.description;

  return (
    <main
      className={cn(
        'min-h-screen bg-cream-50 flex flex-col items-center justify-center gap-6 p-12 text-center',
        className,
      )}
    >
      <div role="alert" className="contents">
        <Icon size={64} />
        <h1 className="text-5xl font-display text-charcoal-800">{resolvedTitle}</h1>
        <p className="text-base text-charcoal-500 max-w-md">{resolvedDescription}</p>
        {variant === '500' && eventId && (
          <p className="text-xs text-charcoal-400 mt-4 font-mono">
            {eventIdLabel}: <span>{eventId}</span>
          </p>
        )}
        <div className="flex gap-3 mt-2">
          {onRetry && (
            <Button variant="primary" onClick={onRetry}>
              {retryLabel}
            </Button>
          )}
          {onGoHome && (
            <Button variant="tertiary" onClick={onGoHome}>
              {goHomeLabel}
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}

ErrorPage.displayName = 'ErrorPage';
