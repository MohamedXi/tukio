import { describe, it, expect } from 'vitest';
import { keyframes, animations } from '../animations';
import type { KeyframeKey, AnimationKey } from '../animations';

describe('animation tokens', () => {
  it('exposes the canonical keyframe identifiers', () => {
    expect(keyframes).toEqual({
      typing: 'tk-typing',
      modalEnter: 'tk-modal-enter',
      shimmer: 'tk-shimmer',
    });
  });

  it('exposes ready-to-use animation shorthands', () => {
    expect(animations.typing).toBe('tk-typing 1.4s ease-in-out infinite');
  });

  it('keyframe identifiers all start with the tk- namespace prefix', () => {
    for (const id of Object.values(keyframes)) {
      expect(id).toMatch(/^tk-/);
    }
  });

  it('exports KeyframeKey + AnimationKey type aliases (compile-time check)', () => {
    const k: KeyframeKey = 'typing';
    const a: AnimationKey = 'typing';
    expect(k).toBe('typing');
    expect(a).toBe('typing');
  });
});
