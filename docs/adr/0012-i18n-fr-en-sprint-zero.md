# ADR-0012: i18n FR+EN bilingual from Sprint 0

- **Status**: ✅ Accepted
- **Date**: 2026-05-09
- **Deciders**: Ismael (founder), tech lead
- **Tags**: `architecture`, `frontend`, `data`

## Context

Tukio.one targets French customers (primary) and English-speaking customers (secondary, especially
international event planners in Pays de la Loire). Two approaches existed:

1. **i18n from day one (Sprint 0)**: wire translation infrastructure immediately, require all UI
   strings to go through `next-intl`, set up bilingual DB tables from the start.
2. **French-only MVP, add EN in V1**: ship faster, backfill translations later.

Forces:

- **Technical retrofitting is painful**: adding `next-intl` to existing pages after they were written
  in French requires touching every component, every string, every URL route. In practice, this is
  equivalent to rewriting the frontend.
- **DB slug retrofitting is destructive**: if `categories.slug` starts as `chapiteaux-et-tentes` (FR),
  changing to `canopies-and-tents` (EN canonical) later requires redirects, hreflang updates, and
  SEO signal transfer.
- **URL canonical convention**: the project enforces English-canonical URL paths (`/services/wedding-marquees`,
  not `/services/chapiteaux-mariage`). This is incompatible with a French-first MVP that adds English
  later.
- **Founder context**: the founder's network includes English-speaking venue managers and wedding
  planners. Launching EN-only or requiring a V1 wait risks losing early adopters.

## Decision

The platform is **bilingual FR+EN from Sprint 0**, linguistically (not geographically — no locale
routing based on IP). The implementation uses:

- **`next-intl` v4** for all 4 Next.js frontends. URL structure: `/{locale}/...` prefix (e.g.,
  `/fr/services/marquees`, `/en/services/marquees`). `next-intl` middleware handles locale detection
  (Accept-Language header → cookie → default `fr`).
- **Zero hardcoded user-facing text in components** — every visible string goes through `t('key')`.
  Enforced by `tukio/no-hardcoded-text` ESLint rule (Story 0.11).
- **EN canonical URL paths**: `/services/wedding-marquees` is the canonical path. French slugs live
  in `*_translations` tables (`category_translations.slug`) for SEO hreflang, not in the URL.
- **`*_translations` tables** in every service DB that has user-visible entity names
  (`category_translations`, `listing_translations`) — one row per `(entity_id, locale)`.
- **One Meilisearch index per locale** (`listings-fr`, `listings-en`) — stemming and synonyms differ
  between French and English (ADR-0005).
- **Resend email templates** dispatch based on `meta.locale` from the event payload — FR and EN
  templates maintained in `notification-svc`.
- **`messages/{fr,en}.json`** per app in `apps/<app>/src/messages/`. CI enforces parity: every key
  present in `fr.json` must exist in `en.json` (Story 0.11 lint check).

This decision **overrides** the K-05 acquisition doc rule that specified French slugs in URLs.

## Consequences

### Positive

- **No painful V1 migration**: all UI strings are already in translation files from day one.
  Adding a third language (e.g., `nl` for Netherlands V2+) is additive — a new `messages/nl.json`
  and a third Meilisearch index.
- **SEO ready**: hreflang tags in `<head>` (next-intl generates them), EN canonical URLs,
  French slugs in translation tables → both Google FR and Google EN index the correct pages.
- **Consistent developer habit**: every new component author knows strings go in `messages/*.json`.
  No "we'll translate this later" shortcuts survive code review.
- **French-English parity enforced**: CI rejects PRs where `en.json` is missing keys that are in
  `fr.json` — no silent English gaps.

### Negative / Trade-offs

- **+20 % frontend effort upfront**: every new component must extract its strings to `messages/*.json`
  and use `t('key')`. Small teams feel this overhead in the first sprint.
- **Two translation files to maintain**: `fr.json` and `en.json` must be updated together. A string
  added in FR but not EN causes CI failure — intentional friction, not a bug.
- **`*_translations` table joins**: queries on entity names (e.g., "find all categories in French")
  require a JOIN with `category_translations` — slightly more complex than a single-column `name` field.

### Neutral

- The language switch for end users is in the UI (locale switcher in the header) — not geo-IP-based.
  A French user who wants the EN UI can toggle; no automatic redirect based on IP.

## Alternatives Considered

### French-only MVP (add EN in V1)

Ship faster. **Rejected**: the effort to retrofit `next-intl` into existing pages and change URL
slugs after the fact is equivalent to rewriting the frontend. Observed in comparable projects — the
"we'll add i18n later" estimate is always underestimated by 3-5×.

### French URLs (K-05 doc: `/chapiteaux/` path)

The original acquisition doc (K-05) specified French slugs in URLs for local SEO. **Overridden**:
English canonical URLs are a project-wide hard rule (ADR-0012 + `tukio/no-fr-paths` lint). French
slugs live in `*_translations` tables and are used for hreflang — the URL bar shows EN slugs.

### gettext / i18next instead of next-intl

Mature i18n libraries with React support. **Rejected**: `next-intl` v4 is purpose-built for Next.js
App Router with Server Component support — it integrates cleanly with React Server Components and
generates `<link rel="alternate" hreflang>` automatically. No equivalent out of the box in i18next.

## References

- [Source: Architecture §i18n — lines 153, 671]
- [Source: Story 0.9 — @tukio/i18n-client + createNextIntlPlugin setup]
- [Source: Story 0.11 — `tukio/no-hardcoded-text` lint rule]
- [Source: Story 3.7 — Meilisearch locale-specific indexes]
- [ADR-0005 — one Meilisearch index per locale]
- [ADR-0013 — multi-zones routing uses locale-prefix URLs]

## Implementation Notes

- `createNextIntlPlugin('./src/i18n/request.ts')` wraps the Next.js config in each app.
- `messages/{fr,en}.json` are the only permitted string files. No inline string that would be visible
  to a user is allowed in component files (enforced by `tukio/no-hardcoded-text`).
- The default locale is `fr` — new sessions without a stored preference default to French.
- Locale is stored in a `NEXT_LOCALE` cookie (set by next-intl middleware) with `Max-Age=31536000`
  (1 year) and `SameSite=Lax`, `Domain=.tukio.one` for cross-subdomain persistence.
- `@tukio/i18n-client` provides `createI18nMiddleware()` and shared locale config constants.
