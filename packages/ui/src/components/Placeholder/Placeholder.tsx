import { cn } from '../../utils/cn';
import type { PlaceholderProps } from './Placeholder.types';

const aspectMap: Record<string, string> = {
  '4/3': 'aspect-[4/3]',
  '16/9': 'aspect-[16/9]',
  square: 'aspect-square',
};

export function Placeholder({
  label,
  aspect,
  height,
  className,
  style,
  ...props
}: PlaceholderProps) {
  const aspectClass = aspect ? (aspectMap[aspect] ?? undefined) : undefined;
  const customAspect = aspect && !aspectMap[aspect] ? { aspectRatio: aspect } : {};
  const heightStyle = height ? { height: typeof height === 'number' ? `${height}px` : height } : {};

  return (
    <div
      className={cn(
        'bg-cream-100 border border-cream-200 rounded-md flex items-center justify-center overflow-hidden',
        aspectClass,
        className,
      )}
      style={{
        backgroundImage:
          'repeating-linear-gradient(135deg, transparent 0, transparent 10px, rgba(194, 65, 12, 0.06) 10px, rgba(194, 65, 12, 0.06) 11px)',
        ...customAspect,
        ...heightStyle,
        ...style,
      }}
      role="img"
      aria-label={label ?? 'Placeholder'}
      {...props}
    >
      {label && (
        <span className="font-mono text-[10px] tracking-wider uppercase text-charcoal-400 bg-cream-50 border border-cream-300 rounded-sm px-2 py-1 text-center max-w-[calc(100%-16px)]">
          {label}
        </span>
      )}
    </div>
  );
}

Placeholder.displayName = 'Placeholder';
