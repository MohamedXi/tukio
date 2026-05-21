import type { ReactNode } from 'react';

export interface EditorialPageShellProps {
  /** Optional uppercase mono kicker rendered above the h1. */
  kicker?: string;
  /** H1 — accepts ReactNode so consumers can compose italic accents (<em>). */
  title: ReactNode;
  /** Optional intro paragraph rendered below the h1. */
  intro?: ReactNode;
  /** Max-width of the content column in pixels. Default 880; About uses 960. */
  maxWidth?: number;
  /** Header slot (typically `<SiteHeader>`). Rendered above the main area. */
  header?: ReactNode;
  /** Footer slot (typically `<Footer variant="minimal">`). Rendered below main. */
  footer?: ReactNode;
  /** Page body — typically one or more `<Block>` children. */
  children: ReactNode;
  className?: string;
}

export interface BlockProps {
  /** Block H2 — accepts ReactNode for inline italics. */
  title: ReactNode;
  /** Block body content (paragraphs, lists, grids…). */
  children: ReactNode;
  className?: string;
}
