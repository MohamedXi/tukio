export type LogoVariant = 'wordmark' | 'icon';

export interface LogoProps {
  /**
   * Visual height in pixels. Width is derived from the variant's aspect ratio
   * (wordmark ≈ 5.39:1, icon ≈ 0.81:1). Default 28.
   */
  size?: number;
  /**
   * Asset variant. `wordmark` (default) renders the full `tukio.1ne` mark;
   * `icon` renders the compact `io.` monogram only.
   */
  variant?: LogoVariant;
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
