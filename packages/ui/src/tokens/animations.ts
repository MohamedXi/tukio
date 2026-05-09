/** Tukio animation tokens — keyframe definitions live in theme.css (CSS @keyframes). */
export const keyframes = {
  typing: 'tk-typing',
  modalEnter: 'tk-modal-enter',
  shimmer: 'tk-shimmer',
} as const;

export const animations = {
  typing: 'tk-typing 1.4s ease-in-out infinite',
} as const;

export type KeyframeKey = keyof typeof keyframes;
export type AnimationKey = keyof typeof animations;
