import { type Locale } from '../config/locales.js';

export interface HreflangAlternate {
  locale: Locale;
  href: string;
}

export interface HreflangProps {
  alternates: HreflangAlternate[];
  // x-default alternate (typically the default-locale URL or a /about-locale page).
  canonicalHref: string;
}

// SEO bilingual link tags per NFR58. Renders <link rel="alternate" hreflang="…">
// for each provided locale + x-default + canonical.
//
// React Server Component — embed in app/<locale>/layout.tsx <head>.
export function Hreflang({ alternates, canonicalHref }: HreflangProps) {
  return (
    <>
      {alternates.map((alt) => (
        <link key={alt.locale} rel="alternate" hrefLang={alt.locale} href={alt.href} />
      ))}
      <link rel="alternate" hrefLang="x-default" href={canonicalHref} />
      <link rel="canonical" href={canonicalHref} />
    </>
  );
}
