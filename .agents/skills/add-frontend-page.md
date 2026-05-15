# Skill: add a new Next.js page

Use this when introducing a new route in a frontend app (`public`,
`seller`, `admin`). Covers App Router file layout, i18n wiring, Server /
Client Component split, auth gating, and tests.

## Prerequisites

- Story file with the route + audience clarified.
- Identify which app (Story 0.14 / ADR-016 — `apps/customer` was merged
  into `apps/public`; auth-gated routes live under
  `apps/public/src/app/[locale]/(authenticated)/`):
  - `public` (3000, `tukio.one` apex) — visitors + authenticated B2C
    customers (use `(authenticated)` route group for gated routes)
  - `seller` (3002, `seller.tukio.one`) — pro dashboard
  - `admin` (3003, `admin.tukio.one`) — moderation console (MFA TOTP)
- Identify the URL shape: `/{locale}/<path>`. EN-canonical
  (`/services/wedding-marquees`) — per-locale slug is read from the
  request and resolved against `category_translations.slug` at the DB
  level if applicable.
- Read `.agents/context/i18n.md` and `.agents/context/code-style.md`.

## File layout (App Router)

```
apps/<app>/src/app/
├── [locale]/                         next-intl locale segment
│   ├── layout.tsx                    Shared layout (TopBar, footer, providers)
│   ├── page.tsx                      Home (/{locale})
│   ├── <route>/
│   │   ├── page.tsx                  Server Component by default
│   │   ├── loading.tsx               (optional) Suspense fallback
│   │   ├── error.tsx                 (optional) Error Boundary
│   │   ├── not-found.tsx             (optional) 404 handler
│   │   ├── <Component>.tsx           Page-local components
│   │   ├── <Component>.spec.tsx      Vitest test (colocated)
│   │   └── use-<hook>.ts             Page-local hooks
│   └── …
├── globals.css                       Imports @tukio/ui/styles/globals.css
└── messages/                         (At app root) next-intl messages
    ├── fr.json
    └── en.json
```

## Step-by-step

1. **Create the route folder** under `[locale]/`. Use kebab-case in EN
   (`/{locale}/booking-confirmation`). If the route takes a dynamic
   segment, use `[param]/` (`/{locale}/services/[slug]/page.tsx`).

2. **Author `page.tsx` as a Server Component** by default:

   ```tsx
   import { getTranslations } from 'next-intl/server';

   interface PageProps {
     params: Promise<{ locale: 'fr' | 'en' }>;
   }

   export default async function MyPage({ params }: PageProps) {
     const { locale } = await params;
     const t = await getTranslations({ locale, namespace: 'my-page' });

     return (
       <main>
         <h1>{t('title')}</h1>
       </main>
     );
   }

   export async function generateMetadata({ params }: PageProps) {
     const { locale } = await params;
     const t = await getTranslations({ locale, namespace: 'my-page.meta' });
     return { title: t('title'), description: t('description') };
   }
   ```

3. **Add interactivity in a Client Component** when needed. Don't put
   `'use client'` on the page itself — extract the interactive piece:

   ```tsx
   // page.tsx (server)
   import { BookingForm } from './booking-form';

   export default async function Page({ params }) {
     const data = await fetchListingData(...); // server-side via @tukio/api-client
     return <BookingForm initialData={data} />;
   }
   ```

   ```tsx
   // booking-form.tsx (client)
   'use client';
   import { useState } from 'react';
   import { useTranslations } from 'next-intl';
   import { Button } from '@tukio/ui/components/Button';

   export function BookingForm({ initialData }: BookingFormProps) {
     const t = useTranslations('booking-form');
     const [
       /* ... */
     ] = useState(/* ... */);
     return <Button>{t('submit')}</Button>;
   }
   ```

4. **Compose `@tukio/ui` atoms / patterns.** Import via subpaths:

   ```tsx
   import { Button } from '@tukio/ui/components/Button';
   import { Input } from '@tukio/ui/components/Input';
   import { FilterSidebar } from '@tukio/ui/patterns/FilterSidebar';
   ```

5. **Add i18n keys.** Edit `apps/<app>/messages/{fr,en}.json` —
   matching keys in both:

   ```json
   {
     "my-page": {
       "title": "Mon titre",
       "description": "Ma description",
       "meta": {
         "title": "Mon titre — Tukio",
         "description": "Description SEO"
       }
     }
   }
   ```

   See `.agents/skills/add-i18n-key.md` for the full convention.

6. **Wire auth (if needed).** For routes that require login:
   - On `public`, place the route under
     `[locale]/(authenticated)/...` — the middleware
     `apps/public/src/middleware.ts` redirects unauthenticated requests
     to `/login?callback=...` (Story 0.14 / ADR-016).
   - On `seller` / `admin`, the `[locale]/layout.tsx` wraps children
     with `<RequireAuth>` from `@tukio/auth-client`. Verify yours
     inherits.
   - For routes that need a specific role, wrap with
     `<RequireRole roles={['admin-super']}>` or check `actor.roles` in
     the page Server Component (Story 1.x patterns).
   - For MFA-gated routes (admin), wrap with `<RequireMfa>`.

7. **Wire data fetching via `@tukio/api-client`.** Never raw `fetch`:

   ```ts
   import { apiClient } from '@/lib/api-client';

   const response = await apiClient.listings.getBySlug({ slug });
   if (!response.ok) {
     // typed error: response.error.tukioCode === 'LISTING-NOT-FOUND-001'
   }
   ```

8. **Add a route handler** (`route.ts`) under `[locale]/api/<endpoint>/`
   only if the page needs a Next.js BFF endpoint (rare — most data flows
   directly to `gateway-api`). Document why in the story Dev Notes.

9. **Add `loading.tsx`** if the page does meaningful server work. Use
   `@tukio/ui/components/Skeleton` for the loading skeleton.

10. **Add `error.tsx`** for graceful failures:

    ```tsx
    'use client';
    import { useTranslations } from 'next-intl';
    import { Alert } from '@tukio/ui/components/Alert';

    export default function ErrorBoundary({ error, reset }: { error: Error; reset: () => void }) {
      const t = useTranslations('errors');
      return (
        <Alert variant="danger">
          {t('generic')}
          <button onClick={reset}>{t('retry')}</button>
        </Alert>
      );
    }
    ```

11. **Tests.** Vitest + Testing Library for client components and hooks;
    integration / Playwright (V1+) for Server Component flows.

    ```tsx
    // booking-form.spec.tsx
    import { render, screen } from '@testing-library/react';
    import userEvent from '@testing-library/user-event';
    import { BookingForm } from './booking-form';
    import { NextIntlClientProvider } from 'next-intl';
    import messages from '../../../../messages/fr.json';

    function renderWithIntl(ui: React.ReactElement) {
      return render(
        <NextIntlClientProvider locale="fr" messages={messages}>
          {ui}
        </NextIntlClientProvider>,
      );
    }

    it('submits the booking on click', async () => {
      const onSubmit = vi.fn();
      renderWithIntl(<BookingForm onSubmit={onSubmit} />);
      await userEvent.click(screen.getByRole('button', { name: /réserver/i }));
      expect(onSubmit).toHaveBeenCalled();
    });
    ```

12. **Verify with `pnpm --filter=<app> dev`** — visit
    `http://localhost:<port>/fr/<your-route>` and
    `/en/<your-route>` (different slug if applicable).

13. **Run `/check`** — `pnpm --filter=<app> typecheck && lint && test`.

14. **Commit + PR.** `feat(<app>): add <route> page — Story <X.Y>`.

## Anti-patterns to refuse

- `'use client'` on the top-level `page.tsx` — extract the client piece.
- Raw `fetch()` instead of `@tukio/api-client`.
- Hardcoded user-facing text (`<h1>Bienvenue</h1>`) — `t('title')`.
- Calling `useTranslations()` in a Server Component — use
  `getTranslations({ locale, namespace })`.
- Skipping `generateMetadata` for public / SEO-relevant pages.
- Skipping `loading.tsx` for pages that fetch on the server.
- Putting business logic in the page — extract a `use<X>` hook.
- Forgetting to add the matching keys to **both** `fr.json` and
  `en.json` (CI will catch in Story 7.7, but don't ship broken).
- Importing from another app (`apps/seller/src/...` from
  `apps/admin/`) — frontends are isolated.
