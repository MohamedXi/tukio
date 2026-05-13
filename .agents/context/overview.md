# Project overview

**Tukio.one** is a B2B2C marketplace for **event services** — tents,
marquees, event furniture, decor, catering, lighting — launching in **Pays
de la Loire** with two MVP categories: `tents-marquees` and
`event-furniture`.

Founder: **Ismael Mohamed** (Tukio.one). The repo is a monolithic monorepo
of frontends + backend microservices, with a strong opinion on Clean
Architecture (Pretre pattern) on the backend and an atomic design system on
the frontend.

## What this repo IS

- A **monorepo** of 14 codebases (4 Next.js 16 frontends + 10 NestJS 11
  microservices) + 8 shared `@tukio/*` packages, orchestrated by Turborepo
  - pnpm.
- The **production runtime** for tukio.one. Frontends run on Vercel
  (multi-zones); backends run on Kubernetes (1 cluster MVP) — Helm
  charts arrive in Story 0.12.
- **Bilingual FR/EN from day one.** The user-facing content is bilingual
  (`next-intl`), but the **tech layer is 100 % English** — paths,
  identifiers, DB names, NATS event names, branches, commit messages.
- **Driven by BMad story files.** Every change is scoped through a BMad
  story under `_bmad-output/implementation-artifacts/`. Sprint state lives
  in `sprint-status.yaml`.

## What this repo IS NOT

- **No native mobile app yet.** React Native scaffolding is V2 (Epic 14).
  The Keycloak `tukio-mobile` client is preconfigured but nothing consumes
  it.
- **No customer self-service KYC at MVP.** Pros onboard via Stripe Connect
  Express, then admin verifies KYC manually (Epic 2). Auto-rejection /
  reminder cron is Story 2.8.
- **No multi-vendor cart at MVP.** One booking = one pro. Multi-vendor
  parallel saga arrives in Epic 8 (V1, B2B accounts).
- **No advanced ML / AI.** Semantic search, recommendations,
  configurator are V2 (Epic 13).
- **No dedicated SSO at MVP.** B2B SAML SSO arrives V2 (Story 15.1).

## Marketplace shape

- **Two-sided.** Customers (B2C particuliers + B2B pros) book pros (tents,
  furniture providers, …) for events.
- **Escrowed Stripe Connect Express payments.** Money is held by Stripe
  until the pro accepts; if the pro refuses or the booking expires,
  payment is voided. After the event, payout to the pro via cron
  (Story 4.10).
- **Saga-driven booking** (Story 4.x): booking-svc orchestrates a state
  machine that fans out to order-svc + payment-svc via NATS JetStream
  events with transactional outbox + inbox dedup.
- **3-layer race-condition protection** on submission (Story 4.4) to
  prevent double-bookings of the same slot.
- **Bilingual content with EN-canonical URLs.** SEO hreflang via
  `category_translations.slug` (FR + EN per row).

## User profiles (5)

Drives RBAC + screen counts. ~75 screens total (per UX spec, 31 distinct
designs in the Cloud Design bundle).

| Profile        | Audience                                                               | Screens |
| -------------- | ---------------------------------------------------------------------- | ------- |
| Visitor        | Public marketing + search + listing detail (no auth)                   | ~10     |
| Customer (B2C) | Authenticated particuliers — bookings, messaging, reviews              | ~20     |
| Customer (B2B) | Pro purchaser — multi-user accounts (V1+, Story 8.x)                   | ~5 (V1) |
| Pro (Seller)   | Pro dashboard — KYC, listings, requests, payouts                       | ~25     |
| Admin          | Moderation console (2FA TOTP required) — KYC, listings, reviews, audit | ~15     |

## Pilot launch (MVP — Pays de la Loire)

**Two pilot categories** (per PRD §Pilotes MVP, validated with
product owner):

1. **`tents-marquees`** (FR `tentes-chapiteaux`)
   - Sub-cats: wedding-marquees, professional-marquees, garden-tents,
     pop-up-tents
2. **`event-furniture`** (FR `mobilier-evenementiel`)
   - Sub-cats: chairs, tables, linens, bars, dance-floors

Service types per sub-cat are **curated** (delivery, setup, dismantling,
lighting, cleaning) — see `infra/scripts/seed-categories.ts` for the
seed. Story 3.1 will canonise the service-type taxonomy.

## Compliance floors

These are non-negotiable, MVP-included, and enforced at the application
layer where relevant. See `.agents/context/security.md` (the persona) +
relevant FR/NFR in PRD.

- **RGPD** — consent, right to access / delete, audit log, soft-delete
  with retention windows (Story 1.9).
- **Email verification mandatory** before booking (FR8 — Story 1.6).
- **MFA TOTP mandatory for admins** (FR9 + NFR12 — Story 1.7). Currently
  partially wired in Story 0.10 (Conditional OTP elevated realm-wide); per-client
  scoping + admin user seeding land in Story 1.7.
- **PII masking in messaging** to detect anti-désintermédiation (Story 12.1, V1).
- **Audit log immutable** for admin actions (Story 2.7 — outbox event
  `admin.action.<verb>.v1` to a dedicated audit topic).
- **Stripe-managed KYC** — Tukio never touches IBAN / passport scans.
- **Encryption** in transit (HTTPS only) and at rest (PG, Cloudflare R2,
  Stripe). No sensitive data in localStorage / sessionStorage.

## Volume targets (MVP)

- ~500 active pros across the two pilot categories
- ~10 000 visitor sessions / month at launch (ramp-up plan in
  acquisition doc)
- ~200 bookings / month at end of MVP quarter
- Average booking value ~ €450
- Payment processing: 100 % Stripe Connect Express (no manual transfers)

## Stakeholders

- **Founder / Product / Tech**: Ismael Mohamed (Tukio.one)
- **AI agent collaboration**: this repo (CLAUDE.md / AGENTS.md / `.agents/`)

## Approach

- **MVP-first.** Drop scope before quality. The PRD has 130 FRs across MVP
  - V1 + V2 — most are behind explicit feature gates. Surface trade-offs
    explicitly when scope creeps.
- **No premature features.** B2B accounts, multi-vendor cart, configurator,
  ML semantic search, native mobile — all gated post-MVP.
- **Reference docs:**
  - `_bmad-output/planning-artifacts/prd.md` — PRD (130 FRs + 84 NFRs)
  - `_bmad-output/planning-artifacts/architecture.md` — 14 ADRs + project
    structure
  - `_bmad-output/planning-artifacts/ux-spec.md` — 31 screens + design
    system gap analysis
  - `_bmad-output/planning-artifacts/epics.md` — 17 epics × 115 stories
  - `docs/tukio_*_deepdive.md` — booking, catalog, paiements, UX flows
  - `docs/tukio_design_brief.md` — Cloud Design bundle reference
