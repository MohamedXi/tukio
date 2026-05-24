# @tukio/i18n-client

Shared `next-intl` 4.x config, middleware, formatters, and SEO components for Tukio frontend apps.

## What's inside

- **`config/locales`** — `LOCALES = ['fr', 'en']`, `DEFAULT_LOCALE = 'en'`, BCP 47 mapping, type guard.
- **`config/next-intl`** — `createI18nRequestConfig(loadMessages)` factory for Server Components.
- **`middleware/create-i18n-middleware`** — `createTukioI18nMiddleware()` factory + `composeMiddlewares(...)` helper to chain with `@tukio/auth-client` middleware.
- **Formatters** — `formatDate`, `formatDateTime`, `formatDateRange`, `formatNumber`, `formatPercent`, `formatCurrency`, `formatRelativeTime`. All locale-aware, all timezone-aware (Europe/Paris).
- **SEO components** — `<Hreflang>` (Server Component) + `<LocaleLink>` (Client Component, auto-prefixes locale).
- **`useCurrentLocale()`** — type-narrowed wrapper over `next-intl/useLocale`.

## Setup per app

Each Next.js app wires its own messages loader (keeps the bundle scoped):

```ts
// apps/customer/src/i18n.ts
import { createI18nRequestConfig } from '@tukio/i18n-client/config/next-intl';
export default createI18nRequestConfig(
  async (locale) => (await import(`./messages/${locale}.json`)).default,
);
```

```ts
// apps/customer/src/proxy.ts (Next.js 16) or middleware.ts (Next.js 15)
import { createTukioI18nMiddleware, composeMiddlewares } from '@tukio/i18n-client/middleware';
import { createKeycloakAuthMiddleware } from '@tukio/auth-client/middleware';

export default composeMiddlewares(
  createTukioI18nMiddleware(),
  createKeycloakAuthMiddleware({
    protectedPaths: ['/account', '/cart'],
    loginRedirectUri: 'https://auth.tukio.one/realms/tukio/protocol/openid-connect/auth',
  }),
);

export const config = {
  matcher: ['/((?!_next|api|.*\\..*).*)'],
};
```

## Formatters

```ts
import { formatCurrency } from '@tukio/i18n-client/formatters/currency';
import { formatDateRange } from '@tukio/i18n-client/formatters/date';
import { formatRelativeTime } from '@tukio/i18n-client/formatters/relative-time';

formatCurrency(80000, 'EUR', 'fr'); // "800,00 €"
formatDateRange('2026-06-15', '2026-06-22', 'fr'); // "15 – 22 juin 2026"
formatRelativeTime(new Date(Date.now() - 60_000), 'fr'); // "il y a 1 minute"
```

> **Money is always in cents** (cohérent ADR-014 `Money` type). Pass `80000` not `800.00`.

## SEO

```tsx
// apps/public/src/app/[locale]/about/page.tsx
import { Hreflang } from '@tukio/i18n-client/components/hreflang';

export default function About({ params }: { params: { locale: 'fr' | 'en' } }) {
  return (
    <>
      <Hreflang
        canonicalHref={`https://tukio.one/${params.locale}/about`}
        alternates={[
          { locale: 'fr', href: 'https://tukio.one/fr/about' },
          { locale: 'en', href: 'https://tukio.one/en/about' },
        ]}
      />
      <h1>About Tukio</h1>
    </>
  );
}
```

## See also

- PRD NFR56-58 — i18n + hreflang requirements
- next-intl 4.x docs: https://next-intl-docs.vercel.app/
