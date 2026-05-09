'use client';
import { forwardRef, type KeyboardEvent } from 'react';
import { cn } from '../../utils/cn';
import type { CardProps, CardSectionProps } from './Card.types';

function CardHeader({ className, children, ...props }: CardSectionProps) {
  return (
    <div className={cn('p-4 border-b border-cream-200', className)} {...props}>
      {children}
    </div>
  );
}
CardHeader.displayName = 'Card.Header';

function CardBody({ className, children, ...props }: CardSectionProps) {
  return (
    <div className={cn('p-4', className)} {...props}>
      {children}
    </div>
  );
}
CardBody.displayName = 'Card.Body';

function CardFooter({ className, children, ...props }: CardSectionProps) {
  return (
    <div className={cn('p-4 border-t border-cream-200', className)} {...props}>
      {children}
    </div>
  );
}
CardFooter.displayName = 'Card.Footer';

const CardBase = forwardRef<HTMLElement, CardProps>(
  (
    { as: Comp = 'div', hoverable, interactive, className, onClick, onKeyDown, children, ...props },
    ref,
  ) => {
    const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
      if (interactive && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        // P11 fix: trigger native click so onClick receives a real MouseEvent, not a cast KeyboardEvent
        (e.currentTarget as HTMLElement).click();
      }
      onKeyDown?.(e);
    };

    return (
      <Comp
        ref={ref}
        className={cn(
          'bg-cream-50 border border-cream-200 rounded-lg overflow-hidden',
          hoverable && 'hover:shadow-md transition-shadow cursor-pointer',
          interactive &&
            'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200',
          className,
        )}
        role={interactive ? 'button' : undefined}
        tabIndex={interactive ? 0 : undefined}
        onClick={onClick}
        onKeyDown={interactive ? handleKeyDown : onKeyDown}
        {...props}
      >
        {children}
      </Comp>
    );
  },
);
CardBase.displayName = 'Card';

export const Card = Object.assign(CardBase, {
  Header: CardHeader,
  Body: CardBody,
  Footer: CardFooter,
});
