import { SearchX, ShoppingCart, Calendar, Inbox, Tag, MessageSquare, Star } from 'lucide-react';
import { Button } from '../../components/Button/Button';
import { cn } from '../../utils/cn';
import type { EmptyStateProps, EmptyStateVariant } from './EmptyState.types';

const variantConfig: Record<
  EmptyStateVariant,
  {
    icon: React.ComponentType<{ size?: number }>;
    title: string;
    description: string;
    actionLabel: string | null;
  }
> = {
  'search-no-results': {
    icon: SearchX,
    title: 'No results found',
    description: 'Try adjusting your filters or search terms.',
    actionLabel: 'Clear filters',
  },
  'cart-empty': {
    icon: ShoppingCart,
    title: 'Your cart is empty',
    description: 'Browse services and add them to your cart.',
    actionLabel: 'Discover services',
  },
  'customer-no-bookings': {
    icon: Calendar,
    title: 'No bookings yet',
    description: 'When you book a service, it will appear here.',
    actionLabel: 'Find a service',
  },
  'seller-no-bookings': {
    icon: Inbox,
    title: 'No booking requests',
    description: 'New requests from customers will show up here.',
    actionLabel: null,
  },
  'seller-no-services': {
    icon: Tag,
    title: 'No services yet',
    description: 'Create your first service to start receiving bookings.',
    actionLabel: 'Create a service',
  },
  'messages-empty': {
    icon: MessageSquare,
    title: 'No messages',
    description: 'Conversations with customers will appear here.',
    actionLabel: null,
  },
  'reviews-empty': {
    icon: Star,
    title: 'No reviews yet',
    description: 'Reviews will appear here after the first completed booking.',
    actionLabel: null,
  },
};

export function EmptyState({
  variant,
  title,
  description,
  actionLabel,
  onAction,
  icon,
  cta,
  className,
}: EmptyStateProps) {
  const config = variantConfig[variant];
  const Icon = config.icon;
  const resolvedTitle = title ?? config.title;
  const resolvedDescription = description ?? config.description;
  const resolvedActionLabel = actionLabel ?? config.actionLabel;
  const showCta = variant !== 'reviews-empty' && (cta || (resolvedActionLabel && onAction));

  return (
    <section
      className={cn('flex flex-col items-center justify-center gap-4 p-12 text-center', className)}
    >
      {icon ?? <Icon size={48} />}
      <h2 className="text-2xl font-display text-charcoal-800">{resolvedTitle}</h2>
      <p className="text-base text-charcoal-500 max-w-md">{resolvedDescription}</p>
      {showCta && (cta ?? <Button onClick={onAction}>{resolvedActionLabel}</Button>)}
    </section>
  );
}

EmptyState.displayName = 'EmptyState';
