import { describe, it, expect } from 'vitest';
import { cn } from '../cn.js';

describe('cn — className merger', () => {
  it('merges conflicting Tailwind classes (last wins)', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('combines non-conflicting classes', () => {
    expect(cn('text-sm', 'font-bold')).toBe('text-sm font-bold');
  });

  it('filters falsy values', () => {
    expect(cn('text-sm', false, undefined, null, 'font-bold')).toBe('text-sm font-bold');
  });

  it('handles conditional classes', () => {
    expect(cn('base', { active: true, disabled: false })).toBe('base active');
  });

  it('handles arrays', () => {
    expect(cn(['text-sm', 'font-bold'])).toBe('text-sm font-bold');
  });

  it('merges bg classes correctly', () => {
    expect(cn('bg-brand-500', 'bg-brand-400')).toBe('bg-brand-400');
  });
});
