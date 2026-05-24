import { SpacerProps } from './Spacer.types';

export const Spacer = ({ axis = 'vertical', size = 4, className }: SpacerProps) => (
  <span
    aria-hidden="true"
    className={`shrink-0 ${axis === 'horizontal' ? 'inline-block' : 'block'} ${className ?? ''}`}
    style={{
      [axis === 'horizontal' ? 'width' : 'height']: `${size * 0.25}rem`,
    }}
  />
);
