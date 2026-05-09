'use client';
import { useState, useEffect } from 'react';
import { cn } from '../../utils/cn';
import type { AvatarProps } from './Avatar.types';

const toneMap = {
  cream: 'bg-cream-200 text-charcoal-700',
  brand: 'bg-brand-100 text-brand-700',
  info: 'bg-info-50 text-info-700',
  success: 'bg-success-50 text-success-700',
} as const;

const statusMap = {
  online: 'bg-success-500',
  offline: 'bg-charcoal-400',
  busy: 'bg-error-500',
} as const;

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function Avatar({ name, size = 36, tone = 'cream', src, status, className }: AvatarProps) {
  const [imgError, setImgError] = useState(false);
  const fontSize = size * 0.36;
  const initials = getInitials(name);
  const showImage = Boolean(src) && !imgError;

  // Reset error state whenever src changes (P2 fix: new URL should be retried)
  useEffect(() => {
    setImgError(false);
  }, [src]);

  return (
    <span
      className={cn('relative inline-flex flex-shrink-0', className)}
      style={{ width: size, height: size }}
      // P8 fix: role="img" + aria-label on outer span; img alt="" to avoid double AT announcement
      role="img"
      aria-label={name}
    >
      <span
        className={cn(
          'inline-flex items-center justify-center rounded-full font-semibold w-full h-full',
          toneMap[tone],
        )}
        style={{ fontSize, letterSpacing: '0.02em' }}
      >
        {showImage ? (
          <img
            src={src}
            alt=""
            className="w-full h-full rounded-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          initials
        )}
      </span>
      {status && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full border-2 border-cream-50',
            statusMap[status],
          )}
          style={{ width: size * 0.28, height: size * 0.28 }}
          role="img"
          aria-label={status}
        />
      )}
    </span>
  );
}

Avatar.displayName = 'Avatar';
