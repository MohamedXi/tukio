import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Hreflang } from '../hreflang.js';

describe('<Hreflang>', () => {
  it('renders alternate links for each locale + x-default + canonical', () => {
    const markup = renderToStaticMarkup(
      <Hreflang
        canonicalHref="https://tukio.one/fr/about"
        alternates={[
          { locale: 'fr', href: 'https://tukio.one/fr/about' },
          { locale: 'en', href: 'https://tukio.one/en/about' },
        ]}
      />,
    );

    expect(markup).toContain('rel="alternate"');
    expect(markup).toContain('hrefLang="fr"');
    expect(markup).toContain('hrefLang="en"');
    expect(markup).toContain('hrefLang="x-default"');
    expect(markup).toContain('rel="canonical"');
    expect(markup).toContain('https://tukio.one/fr/about');
    expect(markup).toContain('https://tukio.one/en/about');
  });

  it('renders empty alternates safely', () => {
    const markup = renderToStaticMarkup(
      <Hreflang canonicalHref="https://tukio.one" alternates={[]} />,
    );
    expect(markup).toContain('hrefLang="x-default"');
    expect(markup).toContain('rel="canonical"');
  });
});

// LocaleLink uses next/link + useLocale (next-intl). Each test resets the
// module registry + re-mocks because vi.doMock is sticky across imports
// otherwise (the dynamic import returns the cached module).
async function importLocaleLinkWith(localeMock: 'fr' | 'en') {
  vi.resetModules();
  vi.doMock('next-intl', () => ({ useLocale: () => localeMock }));
  vi.doMock('next/link', () => ({
    __esModule: true,
    default: ({ href, children }: { href: string; children: unknown }) => (
      <a data-testid="link" href={href}>
        {children as never}
      </a>
    ),
  }));
  return import('../locale-link.js');
}

describe('<LocaleLink>', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unmock('next-intl');
    vi.unmock('next/link');
  });

  it('prefixes internal hrefs with the current locale', async () => {
    const { LocaleLink } = await importLocaleLinkWith('fr');
    const markup = renderToStaticMarkup(<LocaleLink href="/account">Account</LocaleLink>);
    expect(markup).toContain('href="/fr/account"');
  });

  it('passes external URLs through unchanged', async () => {
    const { LocaleLink } = await importLocaleLinkWith('fr');
    const markup = renderToStaticMarkup(<LocaleLink href="https://stripe.com">Stripe</LocaleLink>);
    expect(markup).toContain('href="https://stripe.com"');
  });

  it('handles root href', async () => {
    const { LocaleLink } = await importLocaleLinkWith('en');
    const markup = renderToStaticMarkup(<LocaleLink href="/">Home</LocaleLink>);
    expect(markup).toContain('href="/en"');
  });
});
