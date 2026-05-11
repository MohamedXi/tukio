import { type Locale } from '../config/locales';

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
//
// Defensive: deduplicates alternates by locale (first wins) so a caller bug
// (duplicate locale entry) doesn't emit conflicting SEO signals; throws on
// empty `canonicalHref` because a canonical URL is the entire point.
export function Hreflang({ alternates, canonicalHref }: HreflangProps) {
  if (!canonicalHref) {
    throw new Error('[Hreflang] canonicalHref is required and must be non-empty.');
  }
  const seen = new Set<Locale>();
  const unique = alternates.filter((alt) => {
    if (seen.has(alt.locale)) return false;
    seen.add(alt.locale);
    return true;
  });
  return (
    <>
      {unique.map((alt) => (
        <link key={alt.locale} rel="alternate" hrefLang={alt.locale} href={alt.href} />
      ))}
      <link rel="alternate" hrefLang="x-default" href={canonicalHref} />
      <link rel="canonical" href={canonicalHref} />
    </>
  );
}
