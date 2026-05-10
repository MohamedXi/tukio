export interface FooterLink {
  label: string;
  href: string;
}

export interface FooterColumn {
  title: string;
  links: FooterLink[];
}

export interface FooterProps {
  columns: FooterColumn[];
  brandTagline?: string;
  legal?: string;
  legalRight?: string;
  className?: string;
}
