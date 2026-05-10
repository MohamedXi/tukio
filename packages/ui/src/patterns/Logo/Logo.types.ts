export interface LogoProps {
  size?: number;
  mono?: boolean;
  showDomain?: boolean;
  color?: string;
  className?: string;
  'aria-label'?: string;
}

export interface LogoMarkProps {
  size?: number;
  color?: string;
  className?: string;
  'aria-label'?: string;
  /** When true, renders as decorative (aria-hidden), no role="img". Default false. */
  decorative?: boolean;
}
