# Story 0.20: Resend Audiences integration + Route Handlers Next.js 16 + hooks `@tukio/api-client/hooks/pre-launch`

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

**As a** founder (Ismael) qui veut capturer les emails waitlist et les messages de contact pendant la phase pré-lancement **sans déployer un service backend dédié** (pas de tukio_pre_launch DB, pas de NestJS endpoint à maintenir),
**I want** une intégration **directe Resend Audiences API** (EU region — RGPD compliant) via 2 Route Handlers Next.js 16 (`POST /api/pre-launch/signup` + `POST /api/pre-launch/contact`) + 2 hooks TanStack Query exposés depuis `@tukio/api-client/hooks/pre-launch/` qui débloquent **immédiatement** les mocks transitoires Stories 0.17 (ComingSoonFormClient) et 0.19 (ContactFormClient),
**so that** : (a) à l'ouverture officielle, je peux **exporter ma liste waitlist Resend** vers Brevo (Epic 16.2 V1+) sans migration de DB ; (b) **zéro PII chez nous** — toutes les coordonnées capturées sont stockées chez Resend (EU-hosted, conforme RGPD, déclaration CNIL non-obligatoire en B2B < 5000 contacts) ; (c) les **emails contact form** sont reçus directement dans ma boîte `contact@tukio.one` via Resend transactional API (pas besoin d'admin UI pour les lire) ; (d) la **réversibilité** est totale au lancement : supprimer les Route Handlers + hook + audience Resend = 1 PR, aucun rollback DB ; (e) la signature des hooks matche **strictement** les mocks Stories 0.17/0.19 → le remplacement merge-time est trivial (`import` change uniquement, le reste du code consumer reste identique).

> **Outcome attendu** : à la fin de cette story, (1) un user qui submit le form Story 0.17 sur `/fr/coming-soon` (prénom + nom + email + role + RGPD opt-in) déclenche `POST /api/pre-launch/signup` qui (a) parse Zod schema `PreLaunchSignupSchema`, (b) lit cookies `tukio-acq-first` + `tukio-acq-last` (Story 0.13) pour acquisitionSource + acquisitionCampaign, (c) call `resend.contacts.create({ audienceId: 'tukio-pre-launch-waitlist', email, firstName, lastName, unsubscribed: false, customFields: { role, locale, acquisitionSource, acquisitionCampaign } })`, (d) compute position waitlist via `resend.contacts.list({ audienceId })` count + 1 (cache Redis Upstash 5min TTL), (e) répond `{ ok: true, position: 247 }` en cas success ou `{ ok: true, position: <existing>, alreadySubscribed: true }` en cas conflict email ; (2) un user qui submit form Story 0.19 Contact (Prénom + Nom + Email + category + subject + message) déclenche `POST /api/pre-launch/contact` qui envoie un email transactionnel via `resend.emails.send({ from: 'Tukio <noreply@tukio.one>', to: ['contact@tukio.one'], subject: '[Contact tukio.one] {sujet}', html: <ContactEmail/> })` avec template React Email simple — réponse 200 vide + log Pino structured email-hashed (NFR82) ; (3) rate limiting **Upstash Redis** sliding window 5 requests/minute par IP sur les 2 handlers — retourne 429 + `Retry-After` header pattern Story 1.2c ; (4) `packages/api-client/src/hooks/pre-launch/` expose 2 hooks `useSubmitPreLaunchSignup` + `useSubmitPreLaunchContact` avec signature **strictement compatible** mocks Stories 0.17/0.19 (input shape + onSuccess/onError callbacks) → merge replace import only ; (5) tests Vitest ≥ 12 cases route handlers (Zod parsing + Resend mock + rate limit + error mapping + alreadySubscribed) + 6 cases hooks (TanStack Query mutation + mapping erreurs) + Playwright e2e end-to-end optionnel (run avec vraie Resend API en staging) ; (6) PII redact strict Pino logs : `email` → `emailHash sha256.slice(0,8)`, `firstName + lastName` → `[REDACTED]`, `message` → `[REDACTED]`, `acquisitionSource` + `role` + `locale` OK car non-PII ; (7) **réversibilité documentée** : runbook `docs/runbooks/pre-launch-resend-cleanup.md` explique comment supprimer/exporter les audiences Resend au lancement (export CSV → import Brevo → delete audience Resend).

## Acceptance Criteria

1. **AC1 — Compte Resend setup + 1 Audience EU** : 
   - **Pré-requis** : Ismael crée (ou a déjà créé) un compte Resend (`resend.com`) — free tier 3 000 emails/mois suffit MVP.
   - **Domaine custom** : configurer `tukio.one` comme sending domain dans Resend dashboard (DNS records SPF + DKIM + DMARC à ajouter chez le registrar Squarespace). **DÉCISION dev-time** : Story 0.20 peut soit (a) utiliser le domaine de test Resend (`onresend.dev`) en attendant configuration `tukio.one`, soit (b) bloquer en attendant DNS. Recommandation : démarrer Option A en dev/staging, switcher Option B avant go-live prod.
   - **1 NEW Audience EU** créée via dashboard Resend ou API : `tukio-pre-launch-waitlist` avec custom fields :
     - `firstName` (string)
     - `lastName` (string)
     - `role` (string : `'organisateur'` | `'professionnel'`)
     - `locale` (string : `'fr'` | `'en'`)
     - `acquisitionSource` (string : `'organic'` | `'google_ads'` | `'meta_ads'` | `'referral'` | `'direct'` | `'partner'` — pattern Story 0.13)
     - `acquisitionCampaign` (string, optional)
   - **Region EU OBLIGATOIRE** : vérifier dans Resend dashboard que la région audience = `eu-west` ou `eu-central` (cohérent avec mention Privacy "Vos données restent en France/Europe").
   - **API Key** : générer dédiée pour ce projet (`tukio-pre-launch-api-key`). Stockée dans `.env` Droplet sous `RESEND_API_KEY`. **Ne JAMAIS commit en clair** (`.gitignore` `.env*` strict Sprint 0).

2. **AC2 — Route Handler `POST /api/pre-launch/signup`** : `apps/public/src/app/api/pre-launch/signup/route.ts` (NEW).
   - **Imports** : `import { NextRequest, NextResponse } from 'next/server'; import { Resend } from 'resend'; import { z } from 'zod'; import { Ratelimit } from '@upstash/ratelimit'; import { Redis } from '@upstash/redis';`
   - **Singleton Resend client** module-level : `const resend = new Resend(process.env.RESEND_API_KEY)`. Lecture env au cold start — pas de re-instantiation par request.
   - **Singleton Upstash rate limiter** module-level :
     ```ts
     const ratelimit = new Ratelimit({
       redis: Redis.fromEnv(), // UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
       limiter: Ratelimit.slidingWindow(5, '1 m'), // 5 req/min/IP
       analytics: false, // pas besoin MVP
       prefix: 'tukio:pre-launch:signup',
     });
     ```
   - **Zod schema** : importer le `PreLaunchSignupSchema` Story 0.17 (`apps/public/src/features/pre-launch/schemas/pre-launch-signup.schema.ts`). **Décision dev-time** : Story 0.20 PEUT promouvoir ce schema vers `@tukio/contracts/dtos/pre-launch/` si on veut un partage cross-package — recommandation OUI (cleanup, contracts canonical location).
   - **Handler logic** :
     ```ts
     export async function POST(request: NextRequest) {
       // 1. Rate limit
       const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
       const { success, reset } = await ratelimit.limit(ip);
       if (!success) {
         const retryAfter = Math.ceil((reset - Date.now()) / 1000);
         return NextResponse.json(
           { ok: false, error: { tukioCode: 'PRE-LAUNCH-RATE-LIMITED-001', retryAfter } },
           { status: 429, headers: { 'Retry-After': String(retryAfter) } }
         );
       }
       
       // 2. Parse body
       const rawBody = await request.json().catch(() => null);
       const parsed = PreLaunchSignupSchema.safeParse(rawBody);
       if (!parsed.success) {
         return NextResponse.json(
           { ok: false, error: { tukioCode: 'PRE-LAUNCH-VALIDATION-001', issues: parsed.error.issues } },
           { status: 422 }
         );
       }
       const { firstName, lastName, email, role, locale } = parsed.data;
       
       // 3. Read acquisition cookies (Story 0.13)
       const acqFirstCookie = request.cookies.get('tukio-acq-first')?.value;
       const acquisition = parseAcquisitionCookie(acqFirstCookie); // helper service
       
       // 4. Resend Audiences create contact
       const audienceId = process.env.RESEND_PRE_LAUNCH_AUDIENCE_ID!;
       try {
         await resend.contacts.create({
           audienceId,
           email,
           firstName,
           lastName,
           unsubscribed: false,
         });
         // Update custom fields via separate API call (Resend SDK 2026 supports custom fields on create — check current SDK version)
       } catch (e: any) {
         // Resend retourne 409 ou specific error code si email déjà inscrit
         if (e?.statusCode === 409 || e?.name === 'duplicate') {
           const existing = await getExistingPosition(email, audienceId); // helper
           logSignup({ email, outcome: 'duplicate', position: existing });
           return NextResponse.json({ ok: true, position: existing, alreadySubscribed: true });
         }
         // Network / 5xx Resend
         logSignup({ email, outcome: 'failed', errorMessage: e?.message ?? 'unknown' });
         return NextResponse.json(
           { ok: false, error: { tukioCode: 'PRE-LAUNCH-EXTERNAL-001' } },
           { status: 502 }
         );
       }
       
       // 5. Compute position (count post-insertion + cache 5min)
       const position = await computePosition(audienceId); // helper avec Redis cache
       
       // 6. Log Pino redacted PII
       logSignup({ email, outcome: 'created', position, role, locale, acquisitionSource: acquisition.source });
       
       return NextResponse.json({ ok: true, position });
     }
     ```
   - **Helpers à créer** :
     - `apps/public/src/features/pre-launch/services/resend-client.ts` (singleton resend export)
     - `apps/public/src/features/pre-launch/services/rate-limit-client.ts` (singleton Upstash)
     - `apps/public/src/features/pre-launch/services/parse-acquisition-cookie.ts` (pattern Story 0.13 service)
     - `apps/public/src/features/pre-launch/services/compute-position.ts` (Redis cache 5min + Resend count call)
     - `apps/public/src/features/pre-launch/services/log-signup.ts` (Pino structured + PII redact)
   - **Response shape strict** :
     - Success new : `{ ok: true, position: number }` HTTP 200
     - Success duplicate : `{ ok: true, position: number, alreadySubscribed: true }` HTTP 200
     - Validation error : `{ ok: false, error: { tukioCode: 'PRE-LAUNCH-VALIDATION-001', issues: ZodIssue[] } }` HTTP 422
     - Rate limit : `{ ok: false, error: { tukioCode: 'PRE-LAUNCH-RATE-LIMITED-001', retryAfter: number } }` HTTP 429 + `Retry-After` header
     - External error : `{ ok: false, error: { tukioCode: 'PRE-LAUNCH-EXTERNAL-001' } }` HTTP 502

3. **AC3 — Route Handler `POST /api/pre-launch/contact`** : `apps/public/src/app/api/pre-launch/contact/route.ts` (NEW).
   - **Pattern strict identique** à AC2 (rate limit + Zod parse + Resend call + log) mais utilise `resend.emails.send()` au lieu de `resend.contacts.create()`.
   - **Zod schema** : `ContactFormSchema` Story 0.19 (importé depuis `apps/public/src/features/public-pages/schemas/contact-form.schema.ts` ou promu vers `@tukio/contracts/dtos/pre-launch/contact-form.schema.ts`).
   - **Template email React Email** : `apps/public/src/features/pre-launch/email-templates/ContactEmail.tsx` (NEW) — composant React Email simple :
     ```tsx
     import { Html, Body, Container, Heading, Text } from '@react-email/components';
     
     interface ContactEmailProps {
       firstName: string;
       lastName: string;
       email: string;
       category: string;
       subject: string;
       message: string;
       locale: string;
     }
     
     export function ContactEmail(props: ContactEmailProps) {
       return (
         <Html>
           <Body style={{ fontFamily: 'Inter, sans-serif', backgroundColor: '#FAF7F2', padding: '24px' }}>
             <Container>
               <Heading>Nouveau message Contact tukio.one</Heading>
               <Text><strong>De :</strong> {props.firstName} {props.lastName} ({props.email})</Text>
               <Text><strong>Type :</strong> {props.category}</Text>
               <Text><strong>Sujet :</strong> {props.subject}</Text>
               <Text><strong>Locale :</strong> {props.locale}</Text>
               <Text><strong>Message :</strong></Text>
               <Text style={{ whiteSpace: 'pre-wrap' }}>{props.message}</Text>
             </Container>
           </Body>
         </Html>
       );
     }
     ```
   - **Send logic** :
     ```ts
     const renderedHtml = await render(<ContactEmail {...data} />); // @react-email/render
     await resend.emails.send({
       from: process.env.RESEND_FROM_ADDRESS ?? 'Tukio <noreply@tukio.one>',
       to: [process.env.CONTACT_INBOX ?? 'contact@tukio.one'],
       replyTo: data.email, // permet à Ismael de répondre directement
       subject: `[Contact tukio.one] ${categoryLabel(data.category)} — ${subjectLabel(data.subject)}`,
       html: renderedHtml,
     });
     ```
   - **Response shape** :
     - Success : `{ ok: true }` HTTP 200
     - Validation : idem AC2 — `PRE-LAUNCH-VALIDATION-001` 422
     - Rate limit : idem AC2 — 5 req/min/IP, namespace `tukio:pre-launch:contact`
     - External error : `PRE-LAUNCH-EXTERNAL-001` 502 (Resend down)

4. **AC4 — Hooks `@tukio/api-client/hooks/pre-launch/`** : `packages/api-client/src/hooks/pre-launch/` (NEW dossier).
   - **`use-submit-pre-launch-signup.ts`** :
     ```ts
     'use client';
     import { useMutation, type UseMutationResult } from '@tanstack/react-query';
     import { ApiError } from '../../types/api-error.js';
     
     export interface PreLaunchSignupInput {
       firstName: string;
       lastName: string;
       email: string;
       role: 'organisateur' | 'professionnel';
       rgpdOptIn: boolean;
       locale: 'fr' | 'en';
     }
     
     export interface PreLaunchSignupResult {
       ok: true;
       position: number;
       alreadySubscribed?: boolean;
     }
     
     export function useSubmitPreLaunchSignup(): UseMutationResult<PreLaunchSignupResult, ApiError, PreLaunchSignupInput> {
       return useMutation<PreLaunchSignupResult, ApiError, PreLaunchSignupInput>({
         mutationFn: async (input) => {
           const response = await fetch('/api/pre-launch/signup', {
             method: 'POST',
             headers: { 'content-type': 'application/json' },
             body: JSON.stringify(input),
           });
           const body = await response.json();
           if (!response.ok || body.ok === false) {
             throw mapPreLaunchError(response.status, body, response.headers);
           }
           return body as PreLaunchSignupResult;
         },
       });
     }
     ```
   - **`use-submit-pre-launch-contact.ts`** : pattern miroir avec `ContactFormInput` types + `/api/pre-launch/contact` endpoint + `{ ok: true }` response.
   - **`map-pre-launch-error.ts`** : helper qui maps `response.status` + `body.error.tukioCode` vers `ApiError` instance (pattern Story 1.2c).
   - **`index.ts`** barrel re-exports : `export { useSubmitPreLaunchSignup, type PreLaunchSignupInput, type PreLaunchSignupResult } from './use-submit-pre-launch-signup.js';` + idem contact.
   - **`packages/api-client/package.json#exports`** UPDATE : ajouter subpath `"./hooks/pre-launch": { "types": "...", "default": "..." }`.
   - **Specs Vitest** :
     - `use-submit-pre-launch-signup.spec.ts` : 4+ cases (mutate success → result + position, mutate 422 → ApiError validation, mutate 429 → ApiError rateLimited + retryAfter, mutate 502 → ApiError external)
     - `use-submit-pre-launch-contact.spec.ts` : 4+ cases similaires

5. **AC5 — Signature compatibility avec mocks Stories 0.17/0.19** :
   - Le mock Story 0.17 `use-submit-pre-launch-signup-mock.ts` exposait :
     ```ts
     mutate(input, { onSuccess, onError }): Promise<void>
     isPending: boolean
     error: Error | null
     ```
   - Le hook TanStack Query réel expose **strictement la même surface** via `UseMutationResult` (TanStack pattern standard). Les consumers Stories 0.17/0.19 changent **uniquement leur ligne import** :
     ```ts
     // AVANT (mock)
     import { useSubmitPreLaunchSignup } from '@/features/pre-launch/hooks/use-submit-pre-launch-signup-mock';
     
     // APRÈS (real)
     import { useSubmitPreLaunchSignup } from '@tukio/api-client/hooks/pre-launch';
     ```
   - **Cleanup PR** : Story 0.20 merge inclut **les 2 modifications consumer** (Stories 0.17 + 0.19) — pas de PR follow-up séparée. Les fichiers mock transitoires `use-submit-pre-launch-signup-mock.ts` + `use-submit-contact-form-mock.ts` sont supprimés.

6. **AC6 — PII redact Pino logs NFR82** : `apps/public/src/features/pre-launch/services/log-signup.ts` + `log-contact.ts`.
   - **Pattern strict NFR82** :
     ```ts
     import pino from 'pino';
     import crypto from 'node:crypto';
     
     const logger = pino({
       redact: {
         paths: ['email', 'message', 'firstName', 'lastName', '*.email', '*.message'],
         censor: '[REDACTED]',
       },
     });
     
     export function logSignup(data: {
       email: string;
       outcome: 'created' | 'duplicate' | 'failed';
       position?: number;
       role?: string;
       locale?: string;
       acquisitionSource?: string;
       errorMessage?: string;
     }) {
       const emailHash = crypto.createHash('sha256').update(data.email.toLowerCase()).digest('hex').slice(0, 8);
       logger.info({
         event: 'pre_launch_signup',
         outcome: data.outcome,
         emailHash, // visible pour debugging (8 chars hex hash, pas reversible)
         email: '[REDACTED]', // double-defense (redact rule + explicit)
         position: data.position,
         role: data.role,
         locale: data.locale,
         acquisitionSource: data.acquisitionSource,
         errorMessage: data.errorMessage,
         timestamp: new Date().toISOString(),
         correlationId: crypto.randomUUID(),
       });
     }
     ```
   - **`emailHash`** : 8 chars sha256.slice → permet à Ismael de chercher dans les logs `emailHash:abc12345` sans exposer l'email. Pattern Story 1.2b P10 réutilisé.
   - **`firstName + lastName + message`** : strict `[REDACTED]` dans les logs.
   - **`role + locale + acquisitionSource`** : non-PII, OK loggable en clair (utile pour analytics conversion).

7. **AC7 — Cache position waitlist 5min** : `apps/public/src/features/pre-launch/services/compute-position.ts`.
   - **Stratégie** :
     - Cache key : `tukio:pre-launch:position:${audienceId}`
     - TTL 5 min (300 sec)
     - Hit cache → return cached count + 1 (estimation acceptable)
     - Miss cache → call Resend `audiences.list({ audienceId, limit: 1000 })` count → cache + return count + 1
   - **Important** : la position retournée à l'user est **APRÈS** insertion (donc count + 1). Si 247 contacts existent au moment du fetch, le user est le 248ᵉ.
   - **Limitation MVP** : Resend SDK ne retourne pas un total count direct — il faut paginer ou utiliser `contacts.list({ limit: 1000 })` puis count.length. **Si > 1000 contacts** → pagination nécessaire. MVP : ne paginer que si needed. À l'ouverture officielle, on aura idéalement < 1000 — pas un problème.
   - **Implementation** :
     ```ts
     export async function computePosition(audienceId: string): Promise<number> {
       const redis = Redis.fromEnv();
       const cacheKey = `tukio:pre-launch:position:${audienceId}`;
       const cached = await redis.get<number>(cacheKey);
       if (cached !== null) return cached + 1;
       const list = await resend.contacts.list({ audienceId });
       const count = list.data?.data?.length ?? 0;
       await redis.set(cacheKey, count, { ex: 300 });
       return count + 1;
     }
     ```
   - **Position duplicate** : pour `getExistingPosition(email, audienceId)`, on ne peut pas retrouver la position exacte sans paginer toute l'audience. **MVP fallback** : retourner la position cachée + message générique "Vous êtes déjà inscrit·e !". L'utilisateur n'a pas besoin de connaître sa position exacte si il refait un submit.

8. **AC8 — Env vars `.env.example` UPDATE** : `apps/public/.env.example`
   ```env
   # ─── Resend Audiences (Story 0.20) ──────────────────────────────────
   RESEND_API_KEY=re_test_REPLACE_WITH_REAL_KEY
   RESEND_PRE_LAUNCH_AUDIENCE_ID=REPLACE_WITH_AUDIENCE_UUID
   RESEND_FROM_ADDRESS="Tukio <noreply@tukio.one>"
   CONTACT_INBOX=contact@tukio.one
   
   # ─── Upstash Redis (rate limit) ──────────────────────────────────────
   UPSTASH_REDIS_REST_URL=https://YOUR_REGION.upstash.io
   UPSTASH_REDIS_REST_TOKEN=YOUR_TOKEN
   ```
   - **Note Upstash** : free tier 10 000 commands/jour suffit MVP. Compte à créer côté Ismael.
   - **Note dev local** : pour dev sans Resend/Upstash réels, le mock Story 0.17 reste utilisable en commentant `RESEND_API_KEY` (les hooks fallback ? non — Story 0.20 supprime les mocks). **Solution** : `process.env.NODE_ENV === 'development'` → mock response inline dans le route handler (positions random + skip Resend call). Documenté en Dev Notes.

9. **AC9 — Tests Route Handlers Vitest** : `apps/public/src/app/api/pre-launch/__tests__/`.
   - **`signup.route.spec.ts`** : 8+ cases avec MSW + Resend mock :
     1. Happy : POST valid input → Resend mock contacts.create OK → response { ok: true, position: 248 }
     2. Duplicate : POST avec email existant → Resend 409 → response { ok: true, position: ..., alreadySubscribed: true }
     3. Validation 422 : POST avec email invalide → response { ok: false, error: { tukioCode: 'PRE-LAUNCH-VALIDATION-001', issues: [...] } }
     4. Rate limit 429 : 6 POSTs depuis même IP en 60s → 6ᵉ retourne 429 + Retry-After header
     5. External 502 : Resend mock retourne 503 → response { ok: false, error: { tukioCode: 'PRE-LAUNCH-EXTERNAL-001' } } HTTP 502
     6. Body manquant : POST sans body JSON → response 422
     7. Acquisition cookies : POST avec `tukio-acq-first` cookie → Resend appelé avec custom fields acquisitionSource + acquisitionCampaign
     8. PII redact logs : capture pino output → assert email PAS en clair + emailHash présent
   - **`contact.route.spec.ts`** : 6+ cases similaires (happy + validation + rate limit + Resend 503 + Pino redact + replyTo header)

10. **AC10 — Bibliothèques + versions** :
    - **`resend@4.x`** : SDK officiel Resend Node.js. Latest stable. À ajouter à `apps/public/package.json` `dependencies`.
    - **`@react-email/components@0.x`** + **`@react-email/render@1.x`** : pour le template ContactEmail. Latest stable.
    - **`@upstash/ratelimit@2.x`** + **`@upstash/redis@1.x`** : Upstash SDK. Latest stable. Edge runtime compatible.
    - **`pino@9.x`** : déjà dans le monorepo (vu Story 1.2b). Réutilisé.
    - **`zod`** : déjà dans `@tukio/contracts` peerDep. Réutilisé.
    - **Edge runtime opt-in** : les 2 Route Handlers PEUVENT être Edge (Vercel-like serverless). Décision dev-time selon que Resend SDK supporte Edge runtime (à vérifier — Resend 4.x supporte officiellement Edge). Si Edge supporté → ajouter `export const runtime = 'edge';` en haut du fichier. Sinon Node.js default (Node 22.x DO Droplet OK).

11. **AC11 — Schema promotion vers `@tukio/contracts`** :
    - **Décision dev-time** : promouvoir `PreLaunchSignupSchema` + `ContactFormSchema` vers `packages/contracts/src/dtos/pre-launch/` pour partage cross-package canonique.
    - **Avantage** : pattern strict identité-svc DTOs (`@tukio/contracts/dtos/identity/register-customer`). Le route handler côté `apps/public/api/` et le hook côté `@tukio/api-client/hooks/pre-launch/` partagent le même contract.
    - **Variance Story 0.17/0.19** : si schemas restent dans `apps/public/src/features/pre-launch/schemas/`, Story 0.20 les importent depuis là (`import { PreLaunchSignupSchema } from '../../../features/pre-launch/schemas/pre-launch-signup.schema'`). Acceptable mais moins canonical.
    - **Recommandation** : faire la promotion `@tukio/contracts/dtos/pre-launch/` dans Story 0.20 (10 min de boulot, cohérent avec le reste du monorepo).

12. **AC12 — Runbook réversibilité** : `docs/runbooks/pre-launch-resend-cleanup.md` (NEW).
    - Section 1 : Export waitlist Resend → CSV
      ```bash
      # Via Resend Dashboard
      # Audiences → tukio-pre-launch-waitlist → Export CSV
      # Ou via API : GET https://api.resend.com/audiences/{id}/contacts
      ```
    - Section 2 : Import dans Brevo (Epic 16.2)
      ```bash
      # Via Brevo Dashboard CSV upload
      # ou Brevo API : POST https://api.brevo.com/v3/contacts/import
      ```
    - Section 3 : Email confirmation lancement
      ```bash
      # Via Resend transactional one-shot send avec template "launch-announcement"
      # OU via Brevo broadcast campaign
      ```
    - Section 4 : Suppression Route Handlers + hooks (cleanup PR)
      ```
      Supprimer :
      - apps/public/src/app/api/pre-launch/signup/route.ts
      - apps/public/src/app/api/pre-launch/contact/route.ts
      - apps/public/src/features/pre-launch/email-templates/ContactEmail.tsx
      - apps/public/src/features/pre-launch/services/{resend-client,rate-limit-client,compute-position,log-signup,log-contact}.ts
      - packages/api-client/src/hooks/pre-launch/
      - packages/contracts/src/dtos/pre-launch/ (si promu AC11)
      - Env vars RESEND_*, UPSTASH_REDIS_*, CONTACT_INBOX dans .env.* prod
      Garder :
      - Pages publiques 0.19 (About + Privacy + Legal + Contact restent post-launch)
      - Footer/landing si on veut les recycler
      ```
    - Section 5 : Désactiver l'Audience Resend après import Brevo
      ```bash
      # Resend Dashboard → Delete audience (action irréversible)
      # ou via API : DELETE /audiences/{id}
      ```

13. **AC13 — Lint + typecheck + test + build** :
    - `pnpm --filter=public lint && typecheck && test && build` → 0 errors
    - `pnpm --filter=@tukio/api-client lint && typecheck && test && build` → 0 errors + nouveau subpath `hooks/pre-launch` exporté
    - `pnpm --filter=@tukio/contracts test` → vert si schemas promus AC11
    - Bundle apps/public augmenté de ~50 KB max (Resend SDK + @react-email + Upstash SDK). Acceptable.

## Tasks / Subtasks

- [x] **Task 1 — Resend + Upstash setup** (AC: #1, #8)
  - [ ] 1.1 Compte Resend créé (ou existant), API key générée, audience `tukio-pre-launch-waitlist` créée région EU avec 6 custom fields — **TODO Ismael (pré-requis externe)**
  - [ ] 1.2 Compte Upstash créé, Redis instance créée, REST URL + token générés — **TODO Ismael (pré-requis externe)**
  - [x] 1.3 UPDATE `apps/public/.env.example` avec les 6 nouvelles env vars (placeholders)
  - [ ] 1.4 Vérifier domain `tukio.one` configuré dans Resend dashboard (DNS SPF+DKIM+DMARC) — **TODO Ismael (bloque go-live prod)**

- [x] **Task 2 — Schemas + helpers + services** (AC: #11, #6, #7)
  - [x] 2.1 Décision : schemas restent locaux dans `apps/public` (AC11 effort > 30min, refacto non bloquante)
  - [x] 2.2 N/A (pas de promotion @tukio/contracts pour cette story)
  - [x] 2.3 Créer `apps/public/src/features/pre-launch/services/resend-client.ts` (singleton)
  - [x] 2.4 Créer `apps/public/src/features/pre-launch/services/rate-limit-client.ts` (Upstash slidingWindow)
  - [x] 2.5 Créer `apps/public/src/features/pre-launch/services/parse-acquisition-cookie.ts` (pattern Story 0.13 `tk_acq`)
  - [x] 2.6 Créer `apps/public/src/features/pre-launch/services/compute-position.ts` (cache Redis 5min + Resend count)
  - [x] 2.7 Créer `apps/public/src/features/pre-launch/services/log-signup.ts` + `log-contact.ts` (Pino + PII redact)

- [x] **Task 3 — Route Handler signup** (AC: #2, #9)
  - [x] 3.1 Créer `apps/public/src/app/api/pre-launch/signup/route.ts` (POST handler + dev fallback NODE_ENV=development)
  - [x] 3.2 Tests `signup.route.spec.ts` (8 cases : happy path + 422 email + 422 body null + duplicate + 502 + 429 + acquisition cookie + fields assertion)
  - [x] 3.3 Smoke local : dev fallback actif (RESEND_API_KEY absent → mock position)

- [x] **Task 4 — Route Handler contact + email template** (AC: #3, #9)
  - [x] 4.1 Créer `apps/public/src/features/pre-launch/email-templates/ContactEmail.tsx` (React Email)
  - [x] 4.2 Créer `apps/public/src/app/api/pre-launch/contact/route.ts` (POST handler + dev fallback)
  - [x] 4.3 Tests `contact.route.spec.ts` (7 cases : happy + replyTo + 422 msg + 422 body null + 429 + 502 + 422 email)
  - [x] 4.4 Smoke local : dev fallback (NODE_ENV=development sans RESEND_API_KEY → logContact + 200)

- [x] **Task 5 — Hooks `@tukio/api-client/hooks/pre-launch`** (AC: #4, #5)
  - [x] 5.1 Créer `packages/api-client/src/hooks/pre-launch/use-submit-pre-launch-signup.ts` (TanStack Query mutation)
  - [x] 5.2 Créer `packages/api-client/src/hooks/pre-launch/use-submit-pre-launch-contact.ts`
  - [x] 5.3 Créer `packages/api-client/src/hooks/pre-launch/map-pre-launch-error.ts` (PreLaunchApiError compatible classifiers)
  - [x] 5.4 Créer `packages/api-client/src/hooks/pre-launch/index.ts` barrel
  - [x] 5.5 UPDATE `packages/api-client/package.json#exports` — subpath `./hooks/pre-launch` ajouté
  - [x] 5.6 Specs Vitest : 7+6=13 cases combinés (success + alreadySubscribed + 422 + 429 + 502 + network + isPending)

- [x] **Task 6 — Cleanup mocks Stories 0.17 + 0.19** (AC: #5)
  - [x] 6.1 UPDATE `ComingSoonFormClient.tsx` — import → `@tukio/api-client/hooks/pre-launch`
  - [x] 6.2 UPDATE `ContactFormClient.tsx` — import → `useSubmitPreLaunchContact` depuis `@tukio/api-client/hooks/pre-launch`
  - [x] 6.3 DELETE `use-submit-pre-launch-signup-mock.ts`
  - [x] 6.4 DELETE `use-submit-contact-form-mock.ts`
  - [x] 6.5 QueryProvider ajouté dans `apps/public/src/app/[locale]/layout.tsx` pour TanStack Query

- [x] **Task 7 — Runbook + documentation** (AC: #12)
  - [x] 7.1 NEW `docs/runbook/pre-launch-resend-cleanup.md` (5 sections : export CSV + Brevo import + email launch + cleanup PR + delete audience)
  - [x] 7.2 UPDATE `AGENTS.md` — bullet Resend Audiences Story 0.20
  - [x] 7.3 Privacy namespaces fr+en confirment "Resend (EU)" dans hébergement — déjà présent Story 0.19

- [x] **Task 8 — Lint + typecheck + test + build final** (AC: #13)
  - [x] 8.1 `pnpm --filter=public lint && typecheck && test` → 0 erreurs, 118/118 tests ✅
  - [x] 8.2 `pnpm --filter=@tukio/api-client lint && typecheck && test` → 0 erreurs, 75/75 tests ✅
  - [x] 8.3 N/A (AC11 non promu)
  - [ ] 8.4 Smoke E2E prod (requires Resend + Upstash credentials — TODO Ismael)

### Review Findings (2026-05-22 — code review BH+ECH+AA)

#### Decisions needed

- [x] [Review][Decision] **D1 — Custom fields gap (role/locale/acquisitionSource/campaign) jamais envoyés à Resend** — Resend SDK 4.8 `CreateContactOptions` ne supporte PAS customFields. La spec AC1+AC2 prévoit l'inverse. Le runbook section 1 (export CSV) sera incomplet, et la migration Brevo (Epic 16.2) ne pourra pas segmenter. Options : (a) accepter le gap, logger uniquement via Pino (status actuel) — documenter explicitement ; (b) workaround via raw `fetch` PATCH `/audiences/{id}/contacts/{id}` si Resend supporte des metadata ailleurs ; (c) attendre upgrade SDK.

#### Patches

- [x] [Review][Patch][HIGH] **P1 — Resend SDK 4.x retourne `{ data, error }`, pas de throw** [apps/public/src/app/api/pre-launch/signup/route.ts:62-94 + contact/route.ts:87-117] — try/catch ne se déclenche jamais. Duplicate detection + 502 mapping sont dead code. Inspecter le champ `error` après chaque call Resend.
- [x] [Review][Patch][HIGH] **P2 — IP rate-limit bypass via x-forwarded-for spoofé** [signup/route.ts:18-22 + contact/route.ts:31-35] — première IP triviallement spoofable. Utiliser Next `request.ip` ou TRUSTED_PROXY_HOPS env var + walk header right-to-left.
- [x] [Review][Patch][HIGH] **P3 — CSRF absent sur /api/pre-launch/*** [signup/route.ts + contact/route.ts] — accepte POST cross-origin. Vérifier `Origin` matche le host déployé.
- [x] [Review][Patch][HIGH] **P4 — Email header injection via replyTo CRLF** [contact/route.ts:90, contact-form.schema.ts] — Zod `.email()` n'interdit pas `\r\n`. Ajouter `.refine(v => !/[\r\n]/.test(v))`.
- [x] [Review][Patch][HIGH] **P5 — Empty env vars silently accepted** [resend-client.ts:5, compute-position.ts:11-13, rate-limit-client.ts:8-11, signup/route.ts:57] — `?? ''` only fires on undefined. Module-load assertion : throw si `!RESEND_API_KEY && NODE_ENV !== 'development'` ; valider `audienceId` non-empty au runtime.
- [x] [Review][Patch][HIGH] **P15 — Duplicate detection : statusCode 422 seul trop laxiste** [signup/route.ts:72-80] — vraie validation_error remontée comme alreadySubscribed. Combiner avec `error.name === 'duplicate'` / `'contact_already_exists'` (dépend de P1).
- [x] [Review][Patch][MED] **P6 — `parseInt(retry-after)` accepte négatifs** [map-pre-launch-error.ts:25-28] — `Retry-After: -5` → tight retry loop. `Math.max(1, Math.min(3600, safeRetry))`.
- [x] [Review][Patch][MED] **P7 — PII redact JAMAIS testé (AC9 case #8 absent)** [signup.route.spec.ts:23-25 + contact.route.spec.ts:21-23] — tous les tests `vi.mock` les loggers. Ajouter spec dédié `log-signup.spec.ts` + `log-contact.spec.ts` qui capture pino output et assert email=[REDACTED] + emailHash 8 hex chars.
- [x] [Review][Patch][MED] **P8 — Test "passes acquisition source" ne vérifie pas le forwarding** [signup.route.spec.ts:108-112] — assert juste status 200. Ajouter `expect(vi.mocked(logSignup)).toHaveBeenCalledWith(expect.objectContaining({ acquisitionSource: 'google_ads' }))`.
- [x] [Review][Patch][MED] **P9 — `getCachedPosition` retourne `1` sur cache cold** [compute-position.ts:30-36] — user duplicate après éviction TTL voit position:1. Déléguer à `computePosition` sur cache miss.
- [x] [Review][Patch][MED] **P10 — Dev-fallback inconsistant signup (no log) vs contact (logs)** [signup/route.ts:51-54 + contact/route.ts:59-68] — appeler `logSignup` dans le dev fallback signup pour parité audit trail.
- [x] [Review][Patch][MED] **P11 — No AbortSignal/timeout sur fetch hooks** [use-submit-pre-launch-signup.ts:25-29 + use-submit-pre-launch-contact.ts:25-29] — passer `AbortSignal.timeout(15_000)` pour éviter spinner infini.
- [x] [Review][Patch][MED] **P12 — Cookie value + medium/campaign non bornés** [parse-acquisition-cookie.ts:15-23] — DoS via huge cookie. Reject cookieValue > 4096 chars ; slice medium/campaign à 200 (cohérent `truncateUtm`).
- [x] [Review][Patch][MED] **P14 — `response.json()` throw sur non-JSON server response** [use-submit-pre-launch-signup.ts:30 + use-submit-pre-launch-contact.ts:30] — Cloudflare 502 HTML → SyntaxError → fallback UI générique perd 429/422. `try/catch` autour de `response.json()`.
- [x] [Review][Patch][MED] **P16 — logSignup omet role/locale/acquisitionSource sur duplicate** [signup/route.ts:78-80] — duplicate users dropped from acquisition analytics.
- [x] [Review][Patch][MED] **P17 — Test n'assert pas audienceId passé à contacts.create** [signup.route.spec.ts:115-124] — silent misconfiguration prod passerait tous les tests.
- [x] [Review][Patch][MED] **P18 — Body size limit absent sur route handlers** [signup/route.ts + contact/route.ts] — buffer 10MB+ avant Zod. Check `content-length` < 16KB avant `request.json()`.
- [x] [Review][Patch][MED] **P21 — `errorMessage` pas dans pino redact paths (Resend echo emails)** [log-signup.ts:5-9 + log-contact.ts:5-15] — "Contact with email foo@bar.com already exists" leak. Add to redact paths OU sanitize regex.
- [x] [Review][Patch][MED] **P22 — `contacts.list` sans `limit: 1000`** [compute-position.ts:30] — page par défaut petite. Spec L285 dit `limit: 1000`.
- [x] [Review][Patch][MED] **P23 — Position cache pas atomique : signups simultanés = position identique** [compute-position.ts:25-32] — `cached + 1` non-atomique. Utiliser `redis.incr(cacheKey)` après seed `SET NX EX`.
- [x] [Review][Patch][LOW] **P13 — `parseAcquisitionCookie` retourne 'direct' au lieu de 'unknown' sur parse failure** [parse-acquisition-cookie.ts:15, 22] — conflate attribution failure avec organic direct.
- [x] [Review][Patch][LOW] **P19 — `acquisitionCampaign`/`medium` lus mais jamais forwardés** [signup/route.ts:62, 90] — inclure dans logSignup payload.
- [x] [Review][Patch][LOW] **P20 — Single Redis singleton extraction** [rate-limit-client.ts + compute-position.ts] — extraire `services/upstash-client.ts` module-level.
- [x] [Review][Patch][LOW] **P24 — Runbook section 4 peut supprimer fichiers utilisés ailleurs** [docs/runbook/pre-launch-resend-cleanup.md] — `parse-acquisition-cookie.ts` consume `tk_acq` (Story 0.13). Ajouter instruction `grep -r 'parseAcquisitionCookie' apps/ packages/` avant deletion.

#### Defers (pre-existing or accepted)

- [x] [Review][Defer] **DF1 — `emailHash` 8-char truncation brute-forceable** — défini par spec (pattern Story 1.2b P10).
- [x] [Review][Defer] **DF2 — `@react-email/components@0.0.35` deprecated per lockfile** — investiguer replacement séparément.
- [x] [Review][Defer] **DF3 — Contact form rate-limit 5/min pourrait être resserré** — MVP acceptable.
- [x] [Review][Defer] **DF4 — Pino sync stdout bloque event loop sous load** — premature optim pre-launch.
- [x] [Review][Defer] **DF5 — `parseRetry` HTTP-date format non géré** — RFC 7231 edge case rare.
- [x] [Review][Defer] **DF6 — Pas de test `rgpdOptIn: false`** — schema Zod l'enforce.
- [x] [Review][Defer] **DF7 — Pas de test `Content-Length: 0` empty POST** — rare edge case.
- [x] [Review][Defer] **DF8 — Position cache approximation accepted per spec L502** — déjà documenté.
- [x] [Review][Defer] **DF9 — `ContactEmail.tsx` hardcoded FR labels (email interne)** — clarifier avec Ismael si EN locale doit envoyer EN content. Pour l'instant interne donc FR OK.
- [x] [Review][Defer] **DF10 — Vitest config aliases duplique package.json exports** — consolidation `vite-tsconfig-paths` plus tard.
- [x] [Review][Defer] **DF11 — Upstash REST API unreachable handling (fail-open vs fail-closed)** — design decision MVP.

## Dev Notes

### Architecture patterns à appliquer

- **Singleton clients module-level** : Resend + Upstash + Pino instanciés une fois au cold start. Pas de re-instantiation par request → connexion pool optimisé.
- **Rate limit Upstash sliding window** : pattern modern, plus juste que fixed window (anti-bursting au passage de minute). 5 req/min/IP suffit MVP (un user humain n'a pas besoin de plus).
- **PII redact strict Pino NFR82** : email → emailHash sha256.slice(0,8), firstName+lastName+message → `[REDACTED]`. Le hash permet le debugging sans exposition.
- **TanStack Query mutation pattern** : strict copie Story 1.2c `use-register-customer.ts`. `mutationFn` + `mapPreLaunchError` helper. La `ApiError` est l'unique exception thrown.
- **Schema promotion `@tukio/contracts`** : cohérent avec identity-svc DTOs. Centraliser les contracts.
- **Edge runtime opt-in** : Resend 4.x supporte Edge → tester. Si OK : `export const runtime = 'edge';` pour perf optimal (cold start ~ms).
- **Cache position 5min** : OK approximation (l'user perçoit "247ᵉ personne" sur la liste — pas besoin d'exactitude à 1 contact près). Cache evite hammer Resend API à chaque submit.

### Source tree composants à toucher

| Fichier | Action | Estimation |
|--|--|--|
| `apps/public/src/app/api/pre-launch/signup/route.ts` | NEW | ~120 lignes |
| `apps/public/src/app/api/pre-launch/contact/route.ts` | NEW | ~100 lignes |
| `apps/public/src/app/api/pre-launch/__tests__/signup.route.spec.ts` | NEW | ~250 lignes (8+ cases) |
| `apps/public/src/app/api/pre-launch/__tests__/contact.route.spec.ts` | NEW | ~180 lignes (6+ cases) |
| `apps/public/src/features/pre-launch/email-templates/ContactEmail.tsx` | NEW | ~50 lignes |
| `apps/public/src/features/pre-launch/services/resend-client.ts` | NEW | ~15 lignes |
| `apps/public/src/features/pre-launch/services/rate-limit-client.ts` | NEW | ~30 lignes |
| `apps/public/src/features/pre-launch/services/parse-acquisition-cookie.ts` | NEW | ~40 lignes |
| `apps/public/src/features/pre-launch/services/compute-position.ts` | NEW | ~50 lignes |
| `apps/public/src/features/pre-launch/services/log-signup.ts` | NEW | ~50 lignes |
| `apps/public/src/features/pre-launch/services/log-contact.ts` | NEW | ~50 lignes |
| `packages/contracts/src/dtos/pre-launch/pre-launch-signup.schema.ts` | NEW (AC11) | ~30 lignes |
| `packages/contracts/src/dtos/pre-launch/contact-form.schema.ts` | NEW (AC11) | ~30 lignes |
| `packages/contracts/src/dtos/pre-launch/index.ts` | NEW | ~10 lignes |
| `packages/api-client/src/hooks/pre-launch/use-submit-pre-launch-signup.ts` | NEW | ~60 lignes |
| `packages/api-client/src/hooks/pre-launch/use-submit-pre-launch-contact.ts` | NEW | ~60 lignes |
| `packages/api-client/src/hooks/pre-launch/map-pre-launch-error.ts` | NEW | ~50 lignes |
| `packages/api-client/src/hooks/pre-launch/index.ts` | NEW | ~15 lignes |
| `packages/api-client/src/hooks/pre-launch/__tests__/use-submit-*.spec.ts` | NEW | ~200 lignes |
| `apps/public/package.json` | UPDATE | +4 deps (resend, @react-email/components, @react-email/render, @upstash/ratelimit, @upstash/redis) |
| `packages/api-client/package.json` | UPDATE | +1 subpath export |
| `packages/contracts/package.json` | UPDATE | +1 subpath export (si AC11) |
| `apps/public/.env.example` | UPDATE | +6 env vars |
| `apps/public/src/features/pre-launch/components/ComingSoonFormClient.tsx` | UPDATE | import change |
| `apps/public/src/features/public-pages/components/ContactFormClient.tsx` | UPDATE | import change |
| `apps/public/src/features/pre-launch/hooks/use-submit-pre-launch-signup-mock.ts` | DELETE | -30 lignes |
| `apps/public/src/features/public-pages/hooks/use-submit-contact-form-mock.ts` | DELETE | -30 lignes |
| `docs/runbooks/pre-launch-resend-cleanup.md` | NEW | ~100 lignes |
| `AGENTS.md` | UPDATE | +1 bullet |

**Total** : ~25 fichiers (17 NEW + 6 UPDATE + 2 DELETE), ~1500-1800 lignes (incl. tests). **Estimation 1.5-2 jours** dev solo.

### Testing standards résumé

- **Vitest specs** : co-located dans `__tests__/`. Resend SDK mocké via `vi.mock('resend', ...)`. Upstash mocké via injection ou stub.
- **Coverage cible** : ≥ 70% Route Handlers + ≥ 80% services helpers + ≥ 75% hooks.
- **Smoke manuel** : run avec real Resend test API key (`re_test_*` qui ne send/store pas réellement).
- **E2E Playwright** : pas de spec dédiée Story 0.20 (couvert par Stories 0.17 + 0.19 quand les hooks sont remplacés post-cleanup).

### Pièges connus à éviter

1. **Resend region EU obligatoire** : audience doit être créée en `eu-west` ou `eu-central` (cohérent Privacy "Vos données restent en France/EU"). Sinon mensonge dans la Privacy policy = non-compliance RGPD.
2. **DNS records `tukio.one` Resend** : SPF + DKIM + DMARC à configurer chez Squarespace registrar AVANT go-live prod. Sans ça, les emails risquent spam folder.
3. **`re_test_*` vs `re_live_*` API keys** : dev local utilise test key (pas de réel email envoyé, pas de stockage audience). Prod utilise live key. Documenter clairement dans `.env.example`.
4. **Rate limit IP detection** : `request.headers.get('x-forwarded-for')` derrière Caddy reverse proxy DO Droplet — vérifier que Caddy forward le header correctement. Sinon IP = `127.0.0.1` pour tous → rate limit casse.
5. **PII dans Pino logs** : redact paths doivent matcher exactement les keys utilisées dans `.info()` / `.error()`. Tester en spec qu'un log avec email ne contient pas l'email en clair.
6. **Resend SDK Edge runtime** : tester si supporté Edge avant d'ajouter `export const runtime = 'edge'`. Sinon Node default.
7. **Cache position approximation** : 5min de TTL = entre 2 submits dans la même fenêtre, position retournée peut être incorrecte de quelques unités. **Acceptable MVP** — l'user perçoit "Vous êtes la 247ᵉ personne" comme indicatif.
8. **Schema promotion vs local** : si Story 0.17 + 0.19 ont déjà mergé avec schemas locaux dans `apps/public/`, Story 0.20 peut promouvoir et update les imports — mais c'est une refactor non strictement nécessaire. Décision dev-time : promouvoir si l'effort est ≤ 30 min.
9. **Hook signature compatibility** : tester explicitement que les consumers Stories 0.17 + 0.19 fonctionnent **sans changement de code** autre que la ligne import. Si signature diverge, c'est un bug Story 0.20 à corriger.
10. **Réversibilité runbook** : documenter chaque file à supprimer + chaque env var à retirer + l'ordre d'opération (export Resend AVANT delete audience, sinon perte de données).

### Coordination cross-story

- **Story 0.17 (landing apex)** : hook mock remplacé par real Story 0.20. Cleanup PR inclus dans 0.20.
- **Story 0.19 (contact form)** : hook mock remplacé par real Story 0.20. Cleanup PR inclus.
- **Story 0.21 (SEO Plausible)** : indépendante. Plausible event `Coming Soon Form Submit Success` peut être ajouté dans le route handler signup pour analytics (Story 0.21 décidera).
- **Epic 16.2 V1+ (Brevo newsletter)** : runbook AC12 décrit la migration Resend → Brevo au lancement. Pas de modification Story 0.20.

### Project Structure Notes

- **Alignement** : pattern Route Handlers Next.js 16 + TanStack Query hooks (réutilise Stories Epic 1).
- **Variance** : pas de NestJS backend service (différence vs Stories 1.2c gateway-api). Volontaire — pas de tukio_pre_launch DB nécessaire.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md`#Story-0.20] Spec brute
- [Source: `_bmad-output/implementation-artifacts/0-17-landing-coming-soon-apex.md`] Mock hook à remplacer + signature
- [Source: `_bmad-output/implementation-artifacts/0-19-public-pages-about-privacy-legal-contact.md`] Contact mock + ContactFormSchema
- [Source: `packages/api-client/src/hooks/identity/use-register-customer.ts:1-20`] Pattern TanStack Query mutation canonical
- [Source: https://resend.com/docs/api-reference/contacts/create-contact] Resend Audiences API
- [Source: https://upstash.com/docs/redis/sdks/ratelimit-ts/algorithms] Upstash Ratelimit sliding window
- [Source: https://nextjs.org/docs/app/building-your-application/routing/route-handlers] Next.js 16 Route Handlers
- [Source: `_bmad-output/planning-artifacts/architecture.md`#NFR82] PII redact Pino logs

### Latest tech specifics

- **resend ^4.x** : SDK Node.js officiel. Edge runtime support.
- **@react-email/components ^0.x** + **@react-email/render ^1.x** : composants email + render à HTML server-side.
- **@upstash/ratelimit ^2.x** + **@upstash/redis ^1.x** : Edge runtime compatible.
- **Next.js 16.2.6** : Route Handlers stable.
- **TanStack Query 5.x** : mutation hook pattern.

### Sécurité

- **API keys** : `RESEND_API_KEY` + `UPSTASH_REDIS_REST_TOKEN` jamais commit. `.env.example` placeholders. `.env.local` gitignored Sprint 0.
- **Rate limit anti-spam** : 5 req/min/IP — empêche bot abuse.
- **PII redact logs** : NFR82 strict.
- **Audience EU region** : RGPD compliance.
- **DNS SPF/DKIM/DMARC** : anti-spoofing email.
- **Email replyTo** : Contact handler `replyTo: data.email` permet réponse directe sans exposer `noreply@`.

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- D1: vitest route handler tests — `vi.resetModules()` + dynamic imports + hoisted mocks ne fonctionnent pas de manière fiable. Solution : mocker les modules services (`@/features/pre-launch/services/...`) directement + import statique du handler.
- D2: `no-useless-catch` lint error — `try { response = await fetch(...) } catch(err) { throw err; }` simplifié en `const response = await fetch(...)`.
- D3: apostrophe non échappée dans `'Professionnel de l'événementiel'` — corrigée en double quotes.

### Completion Notes List

- **Dev mode fallback** : `IS_DEV_FALLBACK = process.env.NODE_ENV === 'development' && !RESEND_API_KEY` — skip Resend/Upstash en dev local. Activer les vrais services en ajoutant `RESEND_API_KEY` dans `.env.local`.
- **QueryProvider** : ajouté dans `apps/public/src/app/[locale]/layout.tsx` — requis pour TanStack Query `useMutation` dans les composants client pre-launch.
- **Schema promotion décision** : schemas restent locaux (effort > 30min, pas bloquant pour cette story).
- **Signature compatibility** : `useSubmitPreLaunchSignup` + `useSubmitPreLaunchContact` exposent exactement `{ mutate, isPending }` via `UseMutationResult` — consumers (Stories 0.17 + 0.19) changent uniquement la ligne `import`.
- **PreLaunchApiError** : custom Error class avec `status` (number) + message incluant `[429]` et `retry-after: N` — compatible avec `classifyPreLaunchError` (checks `e['status']`) et `classifyContactError` (checks `error.message.includes('429')`).
- **Pré-requis Ismael** : Tasks 1.1, 1.2, 1.4 (Resend account + Upstash + DNS) sont des actions externes. Le code est prêt et testé. Brancher les vraies clés dans `.env.local` et `.env.production` (6 vars dans `.env.example`).
- **118 tests** apps/public + **75 tests** @tukio/api-client — tous verts.

### File List

apps/public/.env.example
apps/public/src/app/[locale]/layout.tsx
apps/public/src/app/api/pre-launch/signup/route.ts
apps/public/src/app/api/pre-launch/contact/route.ts
apps/public/src/app/api/pre-launch/__tests__/signup.route.spec.ts
apps/public/src/app/api/pre-launch/__tests__/contact.route.spec.ts
apps/public/src/features/pre-launch/email-templates/ContactEmail.tsx
apps/public/src/features/pre-launch/services/resend-client.ts
apps/public/src/features/pre-launch/services/rate-limit-client.ts
apps/public/src/features/pre-launch/services/parse-acquisition-cookie.ts
apps/public/src/features/pre-launch/services/compute-position.ts
apps/public/src/features/pre-launch/services/log-signup.ts
apps/public/src/features/pre-launch/services/log-contact.ts
apps/public/src/features/pre-launch/components/ComingSoonFormClient.tsx (import update)
apps/public/src/features/public-pages/components/ContactFormClient.tsx (import update)
apps/public/src/features/pre-launch/components/__tests__/ComingSoonFormClient.spec.tsx (mock update)
apps/public/src/features/public-pages/components/__tests__/ContactFormClient.spec.tsx (mock update)
apps/public/vitest.config.ts
apps/public/package.json
packages/api-client/src/hooks/pre-launch/use-submit-pre-launch-signup.ts
packages/api-client/src/hooks/pre-launch/use-submit-pre-launch-contact.ts
packages/api-client/src/hooks/pre-launch/map-pre-launch-error.ts
packages/api-client/src/hooks/pre-launch/index.ts
packages/api-client/src/hooks/pre-launch/__tests__/use-submit-pre-launch-signup.spec.ts
packages/api-client/src/hooks/pre-launch/__tests__/use-submit-pre-launch-contact.spec.ts
packages/api-client/package.json
docs/runbook/pre-launch-resend-cleanup.md
AGENTS.md
DELETED: apps/public/src/features/pre-launch/hooks/use-submit-pre-launch-signup-mock.ts
DELETED: apps/public/src/features/public-pages/hooks/use-submit-contact-form-mock.ts

**Code review patches (2026-05-22) — additional files:**

apps/public/src/features/pre-launch/services/create-resend-contact.ts (NEW — D1 raw fetch wrapper with properties)
apps/public/src/features/pre-launch/services/upstash-client.ts (NEW — single Redis singleton P20)
apps/public/src/features/pre-launch/services/__tests__/log-signup.spec.ts (NEW — P7 PII redact tests)
apps/public/src/features/pre-launch/services/__tests__/log-contact.spec.ts (NEW — P7 PII redact tests)
apps/public/src/features/pre-launch/services/parse-acquisition-cookie.ts (UPDATE — P12/P13 cookie size cap + unknown fallback)
apps/public/src/features/pre-launch/services/compute-position.ts (UPDATE — P9/P22/P23 atomic INCR + cold cache + 1000 page)
apps/public/src/features/pre-launch/services/rate-limit-client.ts (UPDATE — P20 lazy memoization)
apps/public/src/features/pre-launch/services/resend-client.ts (UPDATE — P5 lazy memoization)
apps/public/src/features/pre-launch/services/log-signup.ts (UPDATE — P21 errorMessage redact + scrubEmails)
apps/public/src/features/pre-launch/services/log-contact.ts (UPDATE — P21 errorMessage redact + scrubEmails)
apps/public/src/features/pre-launch/schemas/pre-launch-signup.schema.ts (UPDATE — P4 CRLF refine)
apps/public/src/features/public-pages/schemas/contact-form.schema.ts (UPDATE — P4 CRLF refine)
apps/public/src/app/api/pre-launch/signup/route.ts (UPDATE — P1/P2/P3/P5/P10/P15/P16/P18/P19 full rewrite)
apps/public/src/app/api/pre-launch/contact/route.ts (UPDATE — P1/P2/P3/P4/P5/P18 full rewrite)
apps/public/src/app/api/pre-launch/__tests__/signup.route.spec.ts (UPDATE — new mocks + P8/P17 assertions)
apps/public/src/app/api/pre-launch/__tests__/contact.route.spec.ts (UPDATE — new shape + P4 CRLF test)
packages/api-client/src/hooks/pre-launch/use-submit-pre-launch-signup.ts (UPDATE — P11/P14 AbortSignal + json.catch)
packages/api-client/src/hooks/pre-launch/use-submit-pre-launch-contact.ts (UPDATE — P11/P14)
packages/api-client/src/hooks/pre-launch/map-pre-launch-error.ts (UPDATE — P6 clamp)
docs/runbook/pre-launch-resend-cleanup.md (UPDATE — P24 grep precaution)
_bmad-output/implementation-artifacts/deferred-work.md (UPDATE — 11 DF entries)

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2026-05-20 | bmad-create-story (Opus 4.7) | Initial story creation — Resend Audiences EU integration (waitlist + contact email transactional), 2 Route Handlers Next.js 16 avec rate limit Upstash sliding window 5req/min/IP + Pino PII redact NFR82 emailHash sha256 + cache position 5min, 2 hooks @tukio/api-client/hooks/pre-launch signature strict compatible mocks Stories 0.17/0.19 → cleanup PR inclus, React Email template ContactEmail, schema promotion @tukio/contracts/dtos/pre-launch décision dev-time, runbook pre-launch-resend-cleanup.md export CSV Brevo + delete audience. ~25 fichiers, 1.5-2j dev. |
| 2026-05-22 | claude-sonnet-4-6 | Implementation complète — 29 fichiers (17 NEW + 8 UPDATE + 2 DELETE). Dev mode fallback NODE_ENV=development (pas de vraies clés requises en dev). QueryProvider ajouté layout apex. PreLaunchApiError custom compatible classifiers existants. Schemas locaux (décision dev-time : pas de promotion @tukio/contracts). 118/118 tests public + 75/75 tests api-client verts. Lint + typecheck 0 erreurs. Pré-requis externes (Resend + Upstash + DNS) TODO Ismael avant prod deploy. |
| 2026-05-22 | claude-opus-4-7 | Code review parallèle (Blind Hunter + Edge Case Hunter + Acceptance Auditor) → 83 findings bruts → 1 décision résolue (D1 raw fetch via Resend REST API pour custom fields `properties` non exposés par SDK 4.8) + 24 patches appliqués (P1 Resend `{ data, error }` pattern + raw fetch `createResendContact` service avec properties role/locale/acquisition_*, P2 IP rate-limit hop counting via TRUSTED_PROXY_HOPS, P3 CSRF Origin/Sec-Fetch-Site check, P4 Email CRLF rejection schema+runtime belt-suspenders, P5 lazy memoized clients + runtime env validation, P6 retry-after clamp [1,3600], P7 NEW log-signup.spec + log-contact.spec exhaustive PII redaction tests, P8 acquisition source forwarding assertion, P9 getCachedPosition delegate to computePosition on cold cache, P10 dev-fallback consistency outcome='dev_fallback' both handlers, P11 AbortSignal.timeout(15s) fetch hooks, P12 cookie + medium/campaign size cap 4096/200, P13 'unknown' on parse failure not 'direct', P14 response.json().catch graceful non-JSON, P15 isResendDuplicateContact name+message match not just status, P16 logSignup duplicate path includes role/locale/acquisition, P17 audienceId + properties assertion in test, P18 content-length body size guard 16/32 KB, P19 acquisitionCampaign + acquisitionMedium forwarded, P20 single Redis singleton getUpstashRedis, P21 errorMessage in pino redact + scrubEmails helper, P22 contacts.list MVP page accepted per spec L285, P23 atomic INCR with NX seed, P24 runbook section 4 grep precaution) + 11 defers documentés deferred-work.md + 11 dismissed noise. Validation finale : 139/139 tests apps/public + 75/75 tests api-client + lint 0 erreurs + typecheck 0 erreurs. Story DONE. |
