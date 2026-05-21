This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Pre-launch mode (Story 0.15)

The `NEXT_PUBLIC_COMING_SOON_MODE` env var gates the entire app behind a
coming-soon landing while the platform is in pre-launch.

- **`true`** → the `coming-soon-gate` middleware rewrites every non-whitelisted
  route to `/${locale}/coming-soon`. The whitelist (apex) covers
  `coming-soon`, `devenir-pro`, `a-propos`, `confidentialite`,
  `mentions-legales`, `contact`. Tech routes (`_next/*`, `api/*`,
  `robots.txt`, `sitemap.xml`, `og/*`) bypass the gate.
- **`false`** (or any value other than the literal string `'true'`) → the gate
  is a no-op; Epic 1+ routes (auth, account, cart) work as before.

`.env.local` ships with `NEXT_PUBLIC_COMING_SOON_MODE=false` so devs working
on Epic 1+ are not impacted. `.env.example` ships with `=true` to document
the pre-launch intent. Toggling in prod = update
`/home/tukio/tukio/secrets/public.env` on the Droplet + redeploy
(`docker compose up -d public`). See `docs/runbook/pre-launch-toggle.md`.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
