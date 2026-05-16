export interface LogoProps {
  /** Wordmark visual height in pixels. Default 28. */
  size?: number;
  /**
   * Monochrome mode — collapses the brand accent (the `1` and dot) onto the
   * word color. Used on coloured/photographic backgrounds.
   */
  mono?: boolean;
  /** When true, renders the `.1ne` domain suffix (direction B). Default true. */
  showDomain?: boolean;
  /**
   * When true, renders the slogan "Un événement. Une plateforme." beneath
   * the wordmark in Fraunces italic, uppercase-mono kicker style. Default false.
   */
  slogan?: boolean;
  /** Override word color (defaults to `--color-charcoal-800`). */
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
