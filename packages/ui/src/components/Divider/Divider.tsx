import { cn } from '../../utils/cn';
import type { DividerProps } from './Divider.types';

export function Divider({ orientation = 'horizontal', label, className, ...props }: DividerProps) {
  if (label) {
    return (
      <div className={cn('flex items-center gap-3', className)} role="separator" {...props}>
        <hr className="flex-1 border-0 border-t border-cream-200 m-0" />
        <span className="text-xs text-charcoal-400 uppercase tracking-wider">{label}</span>
        <hr className="flex-1 border-0 border-t border-cream-200 m-0" />
      </div>
    );
  }

  if (orientation === 'vertical') {
    return (
      <div
        className={cn(
          'inline-block self-stretch border-0 border-l border-cream-200 m-0',
          className,
        )}
        role="separator"
        aria-orientation="vertical"
        {...props}
      />
    );
  }

  return <hr className={cn('border-0 border-t border-cream-200 m-0', className)} {...props} />;
}

Divider.displayName = 'Divider';
