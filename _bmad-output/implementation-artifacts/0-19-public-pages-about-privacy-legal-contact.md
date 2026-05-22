# Story 0.19: 4 pages publiques institutionnelles — À propos + Confidentialité + Mentions légales + Contact

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

**As a** Visitor curieux, journaliste, autorité de contrôle (CNIL, presse, partenaire potentiel) ou pro de l'événementiel qui veut comprendre l'identité juridique et l'éthique du projet,
**I want** accéder aux **4 pages institutionnelles minimales** sur l'apex tukio.one en mode pré-lancement (`/${locale}/a-propos` + `/${locale}/confidentialite` + `/${locale}/mentions-legales` + `/${locale}/contact`) qui reprennent **strictement** le design `tukio-design/project/screens/public-pages.jsx`, avec en particulier (a) une **politique de confidentialité honnête et adaptée au statut pré-lancement** (8 sections explicites : ce qu'on collecte aujourd'hui = uniquement waitlist email + form contact, pas de cookies analytics sans consentement, rétention 12 mois post-launch, vos droits RGPD avec mention dpo@), (b) des **mentions légales transparentes sur le statut "projet en cours de structuration"** (SAS en cours d'immatriculation RCS Nantes, hébergement Vercel mentionné même si on est sur DO Droplet — DÉCISION : aligner sur DO Droplet réalité ou laisser Vercel "site vitrine" selon décision Ismael), (c) une **page Contact avec form 7 fields + 4 cards canaux dédiés** (contact@/dpo@/signalement@/presse@) qui établissent la crédibilité B2B, (d) une **page À propos avec comparaison "Sans tukio.one" vs "Avec tukio.one"** + section "Ancré en Pays de la Loire" + 4 engagements (no pay-to-rank, commission visible, pas de modération opaque, données restent en France),
**so that** : (i) le projet est conforme RGPD/CNIL dès J0 de la collecte d'email (Story 0.17/0.20 capture des coordonnées exige une Privacy policy accessible avec lien depuis le checkbox RGPD opt-in) ; (ii) le projet est conforme LCEN (mentions légales obligatoires pour tout site éditeur de contenu en France) ; (iii) un journaliste qui découvre tukio.one trouve un canal `presse@tukio.one` et une page About crédible avec mission + ancrage local ; (iv) un pro hésitant à laisser ses coordonnées trouve la rassurance que ses données ne seront ni revendues ni partagées hors RGPD ; (v) la CNIL ou tout auditeur qui visite peut vérifier la conformité du traitement (responsable du traitement, finalité, base légale, durée, droits, etc.).

> **Outcome attendu** : à la fin de cette story, (1) `pnpm --filter=public dev` + navigate les 4 URLs `/fr/{a-propos,confidentialite,mentions-legales,contact}` + leurs équivalents `/en/...` rend **exactement** le design `public-pages.jsx:31-619` pour chaque écran ; (2) **i18n FR + EN strict** sur les 4 pages (~140 keys × 2 locales = 280 strings dans 4 namespaces dédiés `about`, `privacy`, `legal`, `contact`) avec **validation humaine** OBLIGATOIRE pour Privacy et Legal (textes juridiques — un dev agent ne peut pas auto-traduire avec confiance suffisante) ; (3) la page Contact form 7 fields (Prénom, Nom, Email, Vous êtes select 5 options, Sujet select 5 options, Message textarea) soumet vers `/api/pre-launch/contact` (Story 0.20 livre le handler — Story 0.19 livre uniquement le formulaire UI + hook consumption avec mock transitoire si 0.20 pas done) ; (4) Lighthouse desktop ≥ 95 perf / ≥ 95 a11y / ≥ 100 SEO / ≥ 100 best practices sur les 4 pages ; (5) axe-core 0 violations sur les 4 pages ; (6) Playwright e2e ≥ 12 cases (4 pages × 2 locales + navigation depuis Footer + form Contact submission + axe-core) ; (7) chaque page est **indexable Google** (`robots: { index: true, follow: true }`) avec metadata propre (title + description + Open Graph + canonical + hreflang FR/EN strict) ; (8) la page Contact form respecte les mêmes patterns RHF + zodResolver que Story 0.17 (mais pour un form de contact, pas de signup) avec rate limit + sanitization server-side ; (9) le bloc RGPD opt-in Story 0.17 lié à `/${locale}/confidentialite` aboutit sur la page réelle (pas le placeholder Story 0.15).

## Acceptance Criteria

1. **AC1 — Architecture 4 pages Server Components + 1 Client form Contact** :
   - **3 pages Server Components purs** (about + privacy + legal — pas d'interactivité, juste du contenu éditorial) :
     - `apps/public/src/app/[locale]/a-propos/page.tsx` (UPDATE depuis placeholder Story 0.15)
     - `apps/public/src/app/[locale]/confidentialite/page.tsx` (UPDATE)
     - `apps/public/src/app/[locale]/mentions-legales/page.tsx` (UPDATE)
   - **1 page mixte** (contact — Server shell + Client form) :
     - `apps/public/src/app/[locale]/contact/page.tsx` (UPDATE — Server) qui render `<ContactPageClient>` (NEW Client) pour le form
   - **Sous-composants Server** :
     - `apps/public/src/features/public-pages/components/AboutContent.tsx` (NEW)
     - `apps/public/src/features/public-pages/components/PrivacyContent.tsx` (NEW)
     - `apps/public/src/features/public-pages/components/LegalContent.tsx` (NEW)
     - `apps/public/src/features/public-pages/components/ContactPageShell.tsx` (NEW — Server, contient le layout + canaux aside)
     - `apps/public/src/features/public-pages/components/ContactFormClient.tsx` (NEW — Client, RHF + zodResolver pattern Story 0.17)
   - **Réutilisation forte** des atoms/patterns Story 0.16 : `<EditorialPageShell>` + `<Block>` + `<SiteHeader>` + `<Footer variant="minimal">` + `<Kicker>` + atoms Story 0.4 (`<Card>` + `<FormField>` + `<Input>` + `<Select>` + `<Textarea>` + `<Button>` + `<Alert>`).

2. **AC2 — Page À propos `/a-propos`** : réplique strict `public-pages.jsx:32-110` (fonction `AboutScreen`).
   - **Shell** : `<EditorialPageShell kicker="À propos" title={<><>Une plateforme, </> <em italic brand-600>un événement</em>.</>} intro="..." maxWidth={960}>`
   - **Intro** : `"tukio.one rassemble les professionnels de l'événementiel et les personnes qui ont quelque chose à célébrer. Sans détour, sans devis qui traînent, sans cousin qui connaît un mec."` (FR — note absence de tirets longs comme dans le design)
   - **Block 1 — "Pourquoi tukio.one"** : 2 paragraphes — pitch problème ("Organiser un événement c'est souvent dix appels, trois devis perdus...") + pitch solution ("tukio.one est une marketplace française dédiée à l'événementiel local...")
   - **Block 2 — "Ce que la plateforme propose"** : 4 cards grid 2-col responsive desktop → 1-col mobile :
     | Title | Description |
     |---|---|
     | "Trouver le bon pro" | "Recherche par catégorie, ville et date. Profils détaillés, photos réelles, avis vérifiés." |
     | "Réserver en ligne" | "Plus besoin de jongler entre 5 sites. Paniers multi-vendeurs, devis personnalisés, calendrier de paiement." |
     | "Paiement protégé" | "Tukio garde les fonds jusqu'à la fin de l'événement. Si quelque chose ne va pas, on intervient." |
     | "Communiquer sans friction" | "Messagerie intégrée avec chaque pro. Tout l'historique au même endroit." |
   - **Block 3 — "Ce qui change par rapport à l'existant"** : intro 2 paragraphes + **comparaison 2-col** :
     - **Colonne gauche "Sans tukio.one"** (background cream-100, rounded-xl, padding 5) : kicker mono uppercase charcoal-500 + `<ul>` 5 items :
       - "5 à 10 contacts à gérer"
       - "Devis sur PDF, Excel ou SMS"
       - "Paiement par chèque ou virement direct"
       - "Aucune protection en cas de litige"
       - "Recherche dispersée sur 6 plateformes"
     - **Colonne droite "Avec tukio.one"** (background brand-50, border brand-100, rounded-xl, padding 5) : kicker brand-700 + `<ul>` 5 items avec `<Check size={14} color="var(--color-brand-700)" strokeWidth={2.5} />` :
       - "Un interlocuteur unique par projet"
       - "Devis normalisés, comparables, archivés"
       - "Paiement Stripe sécurisé, J+1 au pro"
       - "Médiation tukio en cas de litige"
       - "Tout dans la même app, sur tous vos écrans"
   - **Block 4 — "Ancré en Pays de la Loire"** : 2 paragraphes ancrage local (Loire-Atlantique 44 + Maine-et-Loire 49, Bretagne ensuite, autres régions plus tard).
   - **Block 5 — "Notre engagement"** : `<ul>` 4 commitments :
     - "Aucun pay-to-rank : la mise en avant ne se vend pas."
     - "Commission visible, fixe, expliquée à chaque transaction."
     - "Pas de modération éditoriale opaque : règles publiques, sanctions graduées, droit d'appel."
     - "Vos données restent en France et ne sont jamais revendues."

3. **AC3 — Page Confidentialité `/confidentialite`** : réplique strict `public-pages.jsx:401-456` (fonction `PrivacyPolicyScreen`).
   - **Shell** : `<EditorialPageShell kicker="Politique de confidentialité" title={<><>Vos données, </> <em italic brand-600>en clair</em>.</>} intro="tukio.one est aujourd'hui un site de présentation. Cette page décrit ce que nous faisons des seules données collectées en phase de pré-lancement, et anticipe ce qui s'appliquera à la plateforme une fois ouverte.">`
   - **Date update** : `<p text-[12px] color-charcoal-500 mb-8>` "Dernière mise à jour : {date}" (i18n avec interpolation `{date}`. Date initiale "20 mai 2026" FR / "May 20, 2026" EN. **Source canonical** : `process.env.NEXT_PUBLIC_PRIVACY_POLICY_UPDATED_AT` ou date hardcodée à mettre à jour manuellement — décision dev-time. Recommandation : hardcoded constant dans le fichier `PrivacyContent.tsx` avec commentaire "// Update manually when privacy policy changes — Story V1+ may sync from CMS").
   - **Banner brand-50 "En phase de pré-lancement"** : `<div className="p-5 bg-brand-50 border border-brand-100 rounded-xl mb-8 flex gap-3.5">` :
     - `<Shield size={20} color="var(--color-brand-700)" />`
     - `<div>` :
       - `<h3 text-[15px] font-semibold color-brand-700>` "En phase de pré-lancement"
       - `<p text-[13px] color-charcoal-700 mt-1.5 leading-[1.55]>` "Aujourd'hui, tukio.one ne collecte que les informations laissées volontairement via le formulaire d'inscription à la liste d'attente : prénom, nom, email, profil. Pas de cookie analytique, pas de pixel publicitaire, pas de revente."
   - **8 Blocks** :
     1. **"1. Qui collecte vos données aujourd'hui"** : paragraphe "Pendant cette phase de préparation, les données sont collectées et conservées par le porteur du projet tukio.one, basé en Pays de la Loire. Dès l'immatriculation officielle de la société, c'est cette dernière qui deviendra responsable du traitement. Une déléguée à la protection des données sera nommée à ce moment-là."
     2. **"2. Ce que nous collectons aujourd'hui"** : `<ul>` 3 items :
        - **Inscription liste d'attente** : prénom, nom, email, profil (organisateur ou pro).
        - **Contact** : prénom, nom, email, sujet et contenu du message.
        - **Aucune autre donnée** n'est collectée à ce stade. Pas de cookie analytique sans consentement.
     3. **"3. Pourquoi nous les collectons"** : paragraphe finalité strict : "Uniquement pour vous prévenir à l'ouverture de la plateforme et pour répondre à vos questions. Vos coordonnées ne seront jamais utilisées pour d'autres communications sans votre accord explicite. Aucune revente, jamais."
     4. **"4. Combien de temps nous les gardons"** : "Vos données sont conservées jusqu'au lancement de la plateforme, plus 12 mois maximum. Si tukio.one ne voit jamais le jour, elles seront supprimées dans un délai raisonnable. Vous pouvez demander la suppression à tout moment."
     5. **"5. Ce qui s'appliquera après le lancement"** : paragraphe extension future ("identification, paiement via Stripe sans accès aux données bancaires côté tukio, KYC pour les pros, messagerie, factures. Cette page sera mise à jour en détail, et vous serez prévenu·e.")
     6. **"6. Vos droits"** : paragraphe RGPD complet ("droit d'accéder, corriger, supprimer, vous opposer, export. Pour exercer ces droits, écrivez à contact@tukio.one. Réponse sous 30 jours maximum, comme l'exige le RGPD.")
     7. **"7. Hébergement et sous-traitants en pré-lancement"** : ⚠️ **DÉCISION DEV-TIME** :
        - **Option A (design original)** : "Ce site vitrine est hébergé par Vercel (USA). Les emails de la liste d'attente sont traités via un outil européen (Resend). Aucun autre sous-traitant n'a accès à vos données aujourd'hui."
        - **Option B (réalité DO Droplet)** : "Ce site vitrine est hébergé par DigitalOcean (Allemagne — région Frankfurt). Les emails de la liste d'attente sont traités via Resend (région EU). Aucun autre sous-traitant n'a accès à vos données aujourd'hui."
        - **Décision recommandée Option B** car cohérent avec la réalité infra (DO Phase B Story 0.12). À ajuster selon Resend region effective (Story 0.20 décidera).
     8. **"8. Réclamation"** : paragraphe CNIL ("Si vous estimez que vos droits ne sont pas respectés, vous pouvez saisir la CNIL (cnil.fr). Mais d'abord, écrivez-nous. On essaie de régler tout cas en moins de 48 heures.")
   - **⚠️ VALIDATION HUMAINE OBLIGATOIRE** : ce texte est juridique. Avant merge Story 0.19, **Ismael DOIT lire mot-pour-mot** la version FR + faire valider EN par un humain (avocat numérique ou personne native EN compétente sur RGPD). Si pas validé au moment du dev → marker `"_NEEDS_LEGAL_REVIEW": true` dans le namespace JSON et **bloquer le merge en production tant que pas validé** (acceptable en staging).

4. **AC4 — Page Mentions légales `/mentions-legales`** : réplique strict `public-pages.jsx:460-518` (fonction `LegalScreen`).
   - **Shell** : `<EditorialPageShell kicker="Mentions légales" title={<><>Un projet </> <em italic brand-600>en préparation</em>.</>} intro="tukio.one est un projet en cours de structuration. Cette page sera mise à jour avec toutes les mentions légales complètes (forme juridique, RCS, siège social, TVA, hébergeur définitif) au moment du lancement officiel.">`
   - **Date update** : idem AC3 "20 mai 2026" FR.
   - **Banner brand-50 "Statut du projet"** avec icône `Zap` (bolt mapping Story 0.16) : "À ce jour, tukio.one est un projet en phase de préparation. La structure juridique (SAS) est en cours d'enregistrement. Aucune transaction commerciale n'est encore possible sur le site, et aucune donnée personnelle n'est collectée en dehors du formulaire d'inscription à la liste d'attente."
   - **6 Blocks** :
     1. **"Responsable du projet"** : 2 paragraphes : "tukio.one est un projet porté en nom propre par son fondateur, basé en Pays de la Loire." + "Pour toute question, écrivez à contact@tukio.one. L'identité complète du responsable et les coordonnées de la future société seront publiées dès l'immatriculation officielle."
        - ⚠️ **Décision Ismael** : la version actuelle anonymise le fondateur (juste "son fondateur"). Si Ismael préfère mentionner son nom complet (cohérent avec LCEN qui demande l'identité de l'éditeur), c'est à inscrire dans cette story. Recommandation : suivre le design design (anonyme jusqu'à immatriculation officielle) mais en gardant un message clair que c'est temporaire.
     2. **"Société en cours de création"** : intro + `<ul>` 5 items à compléter post-immat :
        - "la raison sociale et la forme juridique définitives"
        - "le capital social et le numéro RCS"
        - "le numéro SIRET et le numéro de TVA intracommunautaire"
        - "l'adresse du siège social"
        - "le nom du directeur de la publication"
     3. **"Hébergement de ce site de présentation"** : ⚠️ **MÊME DÉCISION qu'AC3.7** :
        - **Option A (design original)** : Vercel Inc. (340 S Lemon Ave #4133, Walnut, CA 91789, USA, vercel.com)
        - **Option B (réalité DO)** : DigitalOcean LLC (101 Avenue of the Americas, 10th Floor, New York, NY 10013, USA, digitalocean.com) + "L'infrastructure principale est localisée en Allemagne (région Frankfurt) ou en France (selon le data center cible)."
        - **Décision recommandée Option B**, à confirmer avec Ismael.
     4. **"Nature actuelle du site"** : paragraphe LCEN détaillé : "Le site tukio.one accessible aujourd'hui est un site de présentation. Il décrit un projet en cours de développement. Il ne permet aucune transaction commerciale, ne stocke aucune donnée bancaire et n'agit pas en tant qu'éditeur ou hébergeur au sens de la LCEN. Son seul objectif est de communiquer sur le projet et de constituer une liste d'intéressés pour le lancement."
     5. **"Propriété intellectuelle"** : "Le nom tukio, le logo, le design, le code source et les contenus éditoriaux de ce site sont la propriété du porteur du projet. Toute reproduction sans accord est interdite. Cette propriété sera transférée à la société tukio dès son immatriculation."
     6. **"Contact"** : "Pour toute question juridique, presse ou demande d'information avant le lancement, écrivez à contact@tukio.one. Nous répondons sous 5 jours ouvrés en phase de préparation."
   - **⚠️ VALIDATION HUMAINE OBLIGATOIRE** : idem AC3. Textes juridiques LCEN-conformes — révision humaine recommandée avant merge prod.

5. **AC5 — Page Contact `/contact`** : réplique strict `public-pages.jsx:522-619` (fonction `ContactScreen`).
   - **Shell** : pas `<EditorialPageShell>` simple — layout custom avec form 2-col (form left + 4 cards aside right) `public-pages.jsx:535`.
   - **Container** : `<div className="tk-root bg-cream-50 min-h-screen">` + `<SiteHeader />` + `<div className="max-w-[1200px] mx-auto px-10 py-[72px] pb-24">` + content + `<Footer variant="minimal">`
   - **Heading** : `<Kicker color="brand">Contact</Kicker>` + `<h1 text-[52px] font-display ...>` "On <em italic brand-600>vous écoute</em>." / "We're <em italic>listening</em>." + `<p text-[17px] color-charcoal-600 mt-4 leading-[1.6] max-w-[600px]>` intro
   - **Grid 2-col** : `<div className="grid grid-cols-[1.2fr_1fr] gap-12 mt-14 max-md:grid-cols-1">`
   - **Form left (Client Component `ContactFormClient.tsx`)** :
     - Container `<Card padding="lg">` (32 padding)
     - Heading `<h2 text-[22px] font-display font-medium mb-5>` "Nous écrire" / "Write to us"
     - **7 fields** :
       1. **Prénom + Nom 2-col** : `<FormField label="Prénom" placeholder="Camille" />` + `<FormField label="Nom" placeholder="Renaud" />`
       2. **Email** : `<FormField label="Email" type="email" placeholder="vous@exemple.fr" />`
       3. **Vous êtes select** : `<Select label="Vous êtes">` 5 options :
          - "Organisateur d'événement"
          - "Professionnel de l'événementiel"
          - "Journaliste, presse"
          - "Partenaire potentiel"
          - "Autre"
       4. **Sujet select** : `<Select label="Sujet">` 5 options :
          - "Question générale"
          - "Devenir pro tukio.one"
          - "Problème technique"
          - "Proposition partenariat"
          - "Presse et communication"
       5. **Message** : `<Textarea label="Votre message" rows={6} placeholder="Décrivez votre demande en quelques lignes" />`
     - **CTA** : `<Button type="submit" variant="primary" size="lg" fullWidth>` "Envoyer" + `<ArrowRight size={16} />`
     - **Disclaimer footer** : `<p text-[12px] color-charcoal-500 mt-3 text-center leading-[1.5]>` "Vos données sont traitées conformément à notre politique de confidentialité. Réponse sous 48h ouvrées."
   - **Aside right** : `<aside className="flex flex-col gap-4">` :
     - **4 cards canaux** chaque : `<Card padding="md">` avec icon + title + email-link mono + description
       | Icon | Title | Email | Sub |
       |---|---|---|---|
       | `MessageSquare` | "Support général" | contact@tukio.one | "Pour toute question sur la plateforme. Réponse sous 48h ouvrées." |
       | `Shield` | "Données personnelles" | dpo@tukio.one | "Demandes RGPD : accès, rectification, suppression." |
       | `Zap` | "Signalement urgent" | signalement@tukio.one | "Contenu illicite, fraude, comportement abusif." |
       | `User` | "Presse et partenariats" | presse@tukio.one | "Journalistes, partenaires médias, collaborations." |
     - **Card "En phase de préparation"** : `<Card padding="md" background="cream-100">` "L'entreprise tukio est en cours de création. L'adresse postale et les coordonnées définitives seront publiées au moment du lancement officiel."
   - **Form RHF + zodResolver** : pattern Story 0.17 réutilisé.
     - **Schema** : `apps/public/src/features/public-pages/schemas/contact-form.schema.ts` (NEW)
       ```ts
       export const ContactFormSchema = z.object({
         firstName: z.string().trim().min(1).max(80),
         lastName: z.string().trim().min(1).max(80),
         email: z.string().trim().toLowerCase().email().max(254),
         category: z.enum(['organisateur', 'professionnel', 'journaliste', 'partenaire', 'autre']),
         subject: z.enum(['general', 'devenir-pro', 'technique', 'partenariat', 'presse']),
         message: z.string().trim().min(10, 'message.tooShort').max(2000, 'message.tooLong'),
         locale: z.enum(['fr', 'en']),
       });
       ```
   - **Hook submission** : `useSubmitContactForm()` Story 0.20 (mock transitoire si pas done).
   - **On success** : `<Alert variant="success">` "Message envoyé. Réponse sous 48h ouvrées." + reset form (`form.reset()` RHF). Pas de redirect (Contact form est inline).
   - **On error** : `<Alert variant="danger">` au top du form avec banner focus management (pattern Story 0.17 / Story 1.2d).

6. **AC6 — i18n FR + EN strict (ADR-012)** : 4 namespaces distincts.
   - **`apps/public/src/messages/fr.json`** UPDATE : append 4 namespaces `about` (~35 keys) + `privacy` (~45 keys) + `legal` (~30 keys) + `contact` (~30 keys) = ~140 keys × 2 locales = **280 strings**.
   - **`apps/public/src/messages/en.json`** UPDATE : namespaces EN équivalents.
   - **⚠️ VALIDATION HUMAINE** : Privacy + Legal **OBLIGATOIRE**. About + Contact peuvent être traduits par GPT-4 review humaine. Marker `"_NEEDS_LEGAL_REVIEW": true` dans privacy + legal namespaces si pas validé.
   - **Structure attendue** :
     ```json
     "about": {
       "meta": { "title": "À propos — tukio.one", "description": "..." },
       "kicker": "À propos",
       "titleLine1": "Une plateforme,",
       "titleEmphasis": "un événement",
       "intro": "tukio.one rassemble les professionnels de l'événementiel...",
       "blocks": {
         "why": { "title": "Pourquoi tukio.one", "p1": "...", "p2": "..." },
         "whatPlatform": {
           "title": "Ce que la plateforme propose",
           "cards": [
             { "title": "Trouver le bon pro", "description": "..." },
             ...
           ]
         },
         "comparison": {
           "title": "Ce qui change par rapport à l'existant",
           "intro": "...",
           "without": { "kicker": "Sans tukio.one", "items": ["...", "..."] },
           "with": { "kicker": "Avec tukio.one", "items": ["...", "..."] }
         },
         "anchored": { "title": "Ancré en Pays de la Loire", "p1": "...", "p2": "..." },
         "commitments": { "title": "Notre engagement", "items": ["...", "...", "...", "..."] }
       }
     },
     "privacy": {
       "meta": { ... },
       "kicker": "Politique de confidentialité",
       "titleLine1": "Vos données,",
       "titleEmphasis": "en clair",
       "intro": "...",
       "lastUpdated": "Dernière mise à jour : {date}",
       "preLaunchBanner": { "title": "En phase de pré-lancement", "body": "..." },
       "blocks": {
         "1_whoCollects": { "title": "1. Qui collecte vos données aujourd'hui", "body": "..." },
         "2_whatCollected": { "title": "2. Ce que nous collectons aujourd'hui", "items": [...] },
         "3_whyCollected": { ... },
         "4_retention": { ... },
         "5_postLaunch": { ... },
         "6_yourRights": { ... },
         "7_hosting": { ... },
         "8_complaint": { ... }
       }
     },
     "legal": { ... }, // 6 blocks similar
     "contact": {
       "meta": { ... },
       "kicker": "Contact",
       "titleLine1": "On",
       "titleEmphasis": "vous écoute",
       "intro": "...",
       "form": {
         "title": "Nous écrire",
         "fields": {
           "firstName": { "label": "Prénom", "placeholder": "Camille" },
           "lastName": { ... },
           "email": { ... },
           "category": { "label": "Vous êtes", "options": { "organisateur": "...", ... } },
           "subject": { "label": "Sujet", "options": { ... } },
           "message": { "label": "Votre message", "placeholder": "..." }
         },
         "submit": "Envoyer",
         "submitting": "Envoi en cours…",
         "disclaimer": "...",
         "successMessage": "Message envoyé. Réponse sous 48h ouvrées.",
         "errors": { "generic": "...", "network": "...", "rateLimited": "..." }
       },
       "channels": {
         "support": { "title": "Support général", "email": "contact@tukio.one", "description": "..." },
         "dpo": { ... },
         "report": { ... },
         "press": { ... }
       },
       "preparationNote": "L'entreprise tukio est en cours de création..."
     }
     ```

7. **AC7 — Server vs Client split** :
   - **About + Privacy + Legal** : 100% Server Components purs. Pas un seul `'use client'`. Bundle JS = framework Next.js seul, ~5 KB.
   - **Contact** : `page.tsx` est Server + `ContactPageShell.tsx` est Server (layout grid + cards aside) + `ContactFormClient.tsx` est `'use client'` (form RHF + state). Le Client est isolé pour ne pas hydrater le layout entier.
   - **i18n Server vs Client** : `getTranslations` pour Server, `useTranslations` pour Client (pattern Story 0.17 strict).

8. **AC8 — SEO metadata (Next.js 16 `generateMetadata`)** : 4 implementations distinctes (un par page).
   - **Pattern strict** par page :
     ```ts
     export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
       const t = await getTranslations({ locale: params.locale, namespace: '<namespace>.meta' });
       const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://tukio.one';
       return {
         title: t('title'),
         description: t('description'),
         openGraph: { ... images: [{ url: `${baseUrl}/og/<slug>.png`, ... }], ... },
         twitter: { card: 'summary_large_image', ... },
         alternates: {
           canonical: `${baseUrl}/${params.locale}/<slug>`,
           languages: { fr: `${baseUrl}/fr/<slug>`, en: `${baseUrl}/en/<slug>`, 'x-default': `${baseUrl}/fr/<slug>` },
         },
         robots: { index: true, follow: true }, // toutes les 4 pages indexables
       };
     }
     ```
   - **OG images** : 4 visuels distincts livrés par Story 0.21 (`/og/{a-propos,confidentialite,mentions-legales,contact}.png`). Fallback Story 0.19 : placeholder unique `/og/placeholder.png`.
   - **Canonical FR par défaut** + hreflang `x-default` pointe vers FR (le projet est francophone primaire).

9. **AC9 — A11y RGAA AA (NFR50/54)** :
   - **Sémantique HTML** : `<header>` + `<main>` + `<h1>` unique + `<h2>` par Block + `<footer>` sur les 4 pages.
   - **Form Contact** : tous les `<label htmlFor>` + `<Select>` avec accessible name + `<Textarea>` aria-describedby + erreurs `role="alert" aria-live="polite"`.
   - **Comparison 2-col About** : structure `<dl>` (definition list) plutôt que 2 `<ul>` pour sémantique a11y (chaque comparaison = dt/dd pair). OU `<ul>` simples avec aria-label distinct. Décision dev-time.
   - **Card canaux Contact** : `<a href="mailto:..."` avec text content explicite (pas juste l'email — accessible name est suffisant).
   - **axe-core 0 violations** : sur les 4 pages, vérifié dans Playwright spec.
   - **Skip-link** : `<a href="#main-content">` sur chacune des 4 pages.

10. **AC10 — Lighthouse ≥ 95 perf / ≥ 95 a11y / ≥ 100 SEO / ≥ 100 best practices sur les 4 pages** :
    - Server Components → bundle JS minimal → perf optimal.
    - Pas d'images lourdes (le design est typographique).
    - Privacy + Legal pages : ~1500 mots chacune — page longue mais light HTML.
    - Contact form : bundle Client ≤ 30 KB (RHF + Zod + lucide icons).

11. **AC11 — Hook `useSubmitContactForm()` Story 0.20 consumption + mock transitoire** :
    - Pattern strict Story 0.17 AC11 réutilisé.
    - Si Story 0.20 done → import direct depuis `@tukio/api-client/hooks/pre-launch`.
    - Si pas done → mock local `apps/public/src/features/public-pages/hooks/use-submit-contact-form-mock.ts` (NEW transitoire).

12. **AC12 — Robots + indexabilité** :
    - Les 4 pages ont `robots: { index: true, follow: true }` (différence vs `/coming-soon/success` qui est noindex).
    - Story 0.21 finalisera sitemap.xml avec les 4 URLs × 2 locales × hreflang.
    - Story 0.15 robots.txt déjà whitelist : `/_next/`, `/api/` Disallow ; `/` Allow.

13. **AC13 — Playwright e2e ≥ 12 cases** : `apps/public/test/e2e/public-pages.spec.ts`.
    - **Mode flag ON (NEXT_PUBLIC_COMING_SOON_MODE=true)** — les 4 pages sont whitelist Story 0.15, accessibles même en pré-lancement :
      1. `GET /fr/a-propos` → 200 + H1 "Une plateforme, un événement" + 5 blocks visibles.
      2. `GET /en/a-propos` → 200 + H1 EN.
      3. `GET /fr/confidentialite` → 200 + H1 "Vos données, en clair" + 8 blocks visibles.
      4. `GET /en/confidentialite` → 200 + H1 EN.
      5. `GET /fr/mentions-legales` → 200 + H1 + 6 blocks visibles + Statut banner.
      6. `GET /en/mentions-legales` → 200 + H1 EN.
      7. `GET /fr/contact` → 200 + form + 4 canaux cards visibles.
      8. `GET /en/contact` → 200 + form EN.
      9. **Contact form submit happy** : remplir 7 fields valides + submit → Alert success "Message envoyé".
      10. **Contact form submit invalide** : submit vide → 6+ erreurs inline.
      11. **Footer navigation** : depuis `/fr/coming-soon`, click "Mentions légales" → navigate `/fr/mentions-legales`.
      12. **axe-core 0 violations** sur les 4 pages.
    - **Conformément accords Stories 1.2b-d** : dev livre code + spec **NON-EXÉCUTÉ** localement.

14. **AC14 — Lint + typecheck + test + build final** :
    - `pnpm --filter=public lint && typecheck && test && build` → 0 errors.
    - Coverage ≥ 70% sur ContactFormClient + ContactFormSchema spec.
    - Smoke local : navigate les 4 pages + soumettre form Contact (mock retourne success).

## Tasks / Subtasks

- [x] **Task 1 — i18n FR + EN namespaces** (AC: #6)
  - [x] 1.1 UPDATE `apps/public/src/messages/fr.json` — append 4 namespaces (`about` ~35 + `privacy` ~45 + `legal` ~30 + `contact` ~30 = ~140 keys)
  - [x] 1.2 UPDATE `apps/public/src/messages/en.json` — namespaces EN équivalents
  - [x] 1.3 **Marker validation humaine** : `"_NEEDS_LEGAL_REVIEW": true` dans `privacy` + `legal` namespaces si pas validé
  - [x] 1.4 Décision dev-time : **Option B (DigitalOcean Frankfurt)** — cohérent avec infra réelle Story 0.12

- [x] **Task 2 — Page About + AboutContent** (AC: #2)
  - [x] 2.1 UPDATE `apps/public/src/app/[locale]/a-propos/page.tsx` (Server Component shell)
  - [x] 2.2 Créer `features/public-pages/components/AboutContent.tsx` (Server, 5 Blocks)
  - [x] 2.3 Comparaison 2-col "Sans/Avec tukio.one" avec Check icon lucide

- [x] **Task 3 — Page Privacy + PrivacyContent** (AC: #3)
  - [x] 3.1 UPDATE `apps/public/src/app/[locale]/confidentialite/page.tsx`
  - [x] 3.2 Créer `features/public-pages/components/PrivacyContent.tsx` (Server, 8 Blocks + banner + date)
  - [x] 3.3 Date hardcoded constant "20 mai 2026" / "May 20, 2026"

- [x] **Task 4 — Page Legal + LegalContent** (AC: #4)
  - [x] 4.1 UPDATE `apps/public/src/app/[locale]/mentions-legales/page.tsx`
  - [x] 4.2 Créer `features/public-pages/components/LegalContent.tsx` (Server, 6 Blocks + banner Statut projet)

- [x] **Task 5 — Page Contact (Server shell + Client form)** (AC: #5, #11)
  - [x] 5.1 UPDATE `apps/public/src/app/[locale]/contact/page.tsx` (Server)
  - [x] 5.2 Créer `features/public-pages/components/ContactPageShell.tsx` (Server, grid 2-col + 4 cards aside + preparation note)
  - [x] 5.3 Créer `features/public-pages/components/ContactFormClient.tsx` (Client, RHF + zodResolver pattern Story 0.17)
  - [x] 5.4 Créer `features/public-pages/schemas/contact-form.schema.ts` + spec (13 tests)
  - [x] 5.5 Créer `features/public-pages/services/classify-contact-error.ts` (pattern Story 0.17)
  - [x] 5.6 Créer `features/public-pages/hooks/use-submit-contact-form-mock.ts` (transitoire Story 0.20)

- [x] **Task 6 — SEO metadata × 4** (AC: #8)
  - [x] 6.1 `generateMetadata` sur chacune des 4 pages avec namespace dédié `<x>.meta`
  - [x] 6.2 alternates.languages hreflang FR/EN + x-default sur les 4 URLs
  - [x] 6.3 Story 0.21 OG images attendues — fallback `/og/{slug}.png`

- [x] **Task 7 — A11y + Lighthouse** (AC: #9, #10)
  - [x] 7.1 Skip-link sur chacune des 4 pages
  - [x] 7.2 Form Contact `<label htmlFor>` + `aria-describedby` + `role="alert"`
  - [x] 7.3 Comparison About : `<ul>` × 2 avec `aria-label` distinct (décision dev-time — simpler)
  - [x] 7.4 axe-core via Playwright e2e (4 cases dédiés)

- [x] **Task 8 — Playwright e2e** (AC: #13)
  - [x] 8.1 Créer `apps/public/e2e/public-pages.spec.ts` (17 cases FR+EN + 2 test.skip Lighthouse)
  - [x] 8.2 NON-EXÉCUTÉ localement par dev agent

- [x] **Task 9 — Lint + typecheck + test + build + smoke** (AC: #14)
  - [x] 9.1 `pnpm --filter=public lint` 0 errors · typecheck 0 errors · test 103/103 · build ✅
  - [x] 9.2 Build confirme 4 routes ƒ (dynamic SSR) présentes dans la sortie

## Dev Notes

### Architecture patterns à appliquer

- **3 pages 100% Server Components** (about + privacy + legal) — pas d'interactivité, juste éditorial.
- **1 page mixte Server + Client form isolé** (contact) — pattern Story 0.17 strict réutilisé.
- **EditorialPageShell + Block Story 0.16** pour about + privacy + legal — pas pour contact (layout custom 2-col).
- **i18n strict** via next-intl namespace dédié par page (4 namespaces distincts).
- **Atomes Story 0.4/0.5** réutilisés : `<Card>`, `<FormField>`, `<Select>`, `<Textarea>`, `<Button>`, `<Alert>`.
- **Icons lucide direct** : `Check`, `Shield`, `Zap`, `MessageSquare`, `User`, `ArrowRight` (mapping Story 0.16).
- **Validation humaine OBLIGATOIRE** pour Privacy + Legal — flag explicite si pas validé.

### Source tree composants à toucher

| Fichier | Action | Estimation |
|--|--|--|
| `apps/public/src/app/[locale]/a-propos/page.tsx` | UPDATE | ~25 lignes |
| `apps/public/src/app/[locale]/confidentialite/page.tsx` | UPDATE | ~25 lignes |
| `apps/public/src/app/[locale]/mentions-legales/page.tsx` | UPDATE | ~25 lignes |
| `apps/public/src/app/[locale]/contact/page.tsx` | UPDATE | ~30 lignes |
| `apps/public/src/features/public-pages/components/AboutContent.tsx` | NEW | ~150 lignes (5 Blocks) |
| `apps/public/src/features/public-pages/components/PrivacyContent.tsx` | NEW | ~200 lignes (8 Blocks) |
| `apps/public/src/features/public-pages/components/LegalContent.tsx` | NEW | ~170 lignes (6 Blocks) |
| `apps/public/src/features/public-pages/components/ContactPageShell.tsx` | NEW | ~100 lignes |
| `apps/public/src/features/public-pages/components/ContactFormClient.tsx` | NEW | ~250 lignes |
| `apps/public/src/features/public-pages/components/__tests__/ContactFormClient.spec.tsx` | NEW | ~120 lignes |
| `apps/public/src/features/public-pages/schemas/contact-form.schema.ts` | NEW | ~30 lignes |
| `apps/public/src/features/public-pages/schemas/contact-form.schema.spec.ts` | NEW | ~100 lignes |
| `apps/public/src/features/public-pages/services/classify-contact-error.ts` | NEW | ~50 lignes |
| `apps/public/src/features/public-pages/hooks/use-submit-contact-form-mock.ts` | NEW (transitoire) | ~30 lignes |
| `apps/public/src/messages/fr.json` | UPDATE | +280 lignes (~140 keys × FR) |
| `apps/public/src/messages/en.json` | UPDATE | +280 lignes EN |
| `apps/public/test/e2e/public-pages.spec.ts` | NEW | ~300 lignes (12+ cases × 2 locales) |

**Total** : ~17 fichiers (12 NEW + 5 UPDATE), ~1700-2000 lignes + 560 i18n. **Estimation 2.5-3 jours** dev solo (volume copy juridique + form Contact + 4 pages distinctes).

### Testing standards résumé

- **Schema tests** : ContactFormSchema 10+ cases (firstName/lastName/email/category enum/subject enum/message length).
- **ContactFormClient spec** : 6+ cases (render + submit happy + submit invalid + error mapping + a11y).
- **Pages éditoriales** : pas de unit tests (Server Components statiques — testés via E2E).
- **E2E Playwright** : 12+ cases × 2 locales. NON-EXÉCUTÉ par dev agent.
- **Coverage cible** : ≥ 70% ContactFormClient + ContactFormSchema.

### Pièges connus à éviter

1. **Validation humaine textes juridiques** : Privacy + Legal **NE PEUVENT PAS** être traduits sans relecture humaine FR + EN. Marker `_NEEDS_LEGAL_REVIEW` si pas validé + bloquer merge prod.
2. **Décision hosting Vercel vs DO** : Privacy 7 + Legal 3 mentionnent l'hébergeur. **Recommandation : Option B (DO Droplet)** cohérent avec infra réelle. Ajuster avec Ismael.
3. **Décision anonymisation fondateur** : Legal 1 mentionne "le porteur du projet". LCEN exige identité éditeur. Décision : maintenir anonyme jusqu'à immat OR mentionner nom complet Ismael. Confirm dev-time.
4. **Contact form pas un signup** : différent Story 0.17. Pas de redirect post-submit, juste Alert success + form reset. Pattern simple.
5. **Comparison 2-col About** : choix `<dl>` vs `<ul>` × 2. Sémantique `<dl>` plus correct mais design simple `<ul>` acceptable.
6. **Date privacy hardcoded** : "20 mai 2026" — mettre dans constant exportée pour faciliter update future. Story V1+ pourra synchroniser depuis CMS si besoin.
7. **Pages Privacy + Legal indexables** : oui (`robots: index, follow`). Google peut crawler. Pas de PII exposée — paragraphes éditoriaux.
8. **Footer cross-link** : `/coming-soon` Story 0.17 footer link vers `/mentions-legales` doit fonctionner. Cette story livre la cible.
9. **Hook mock transitoire** : signature strict compatible avec real hook Story 0.20 — cleanup PR au merge 0.20.
10. **i18n ICU pluriels** : pas besoin sur ces 4 pages (pas de count dynamique comme position waitlist Story 0.17).

### Coordination cross-story

- **Story 0.15 (toggle middleware)** : whitelist déjà strict pour `/a-propos`, `/confidentialite`, `/mentions-legales`, `/contact`. Placeholders Story 0.15 écrasés par Story 0.19.
- **Story 0.16 (atoms)** : EditorialPageShell + Block + SiteHeader + Footer minimal + Kicker utilisés strictement.
- **Story 0.17 (landing coming-soon)** : link RGPD opt-in checkbox vers `/confidentialite` aboutit sur page réelle Story 0.19.
- **Story 0.18 (landing seller)** : "Une question ? Nous écrire" → `/contact` (cross-zone vers apex) aboutit sur page Story 0.19.
- **Story 0.20 (Resend handlers)** : hook `useSubmitContactForm` + endpoint `/api/pre-launch/contact`. Mock transitoire si pas done.
- **Story 0.21 (SEO)** : OG images dédiées par page + sitemap inclut les 4 URLs × 2 locales.

### Project Structure Notes

- **Alignement** : pattern Story 0.17 strict — feature-folder + Server/Client split + i18n namespace + atoms `@tukio/ui`.
- **Variance** : 4 pages distinctes mais structure cohérente. Privacy 8 blocks + Legal 6 blocks = scope copy plus large que les autres stories.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md`#Story-0.19] Spec brute
- [Source: `tukio-design/project/screens/public-pages.jsx:31-619`] Design canonical (5 fonctions)
- [Source: `_bmad-output/implementation-artifacts/0-17-landing-coming-soon-apex.md`] Pattern Server/Client form + i18n + SEO
- [Source: `_bmad-output/implementation-artifacts/0-16-design-system-atoms-pre-launch.md`] EditorialPageShell + Block + Kicker + SiteHeader + Footer minimal
- [Source: `_bmad-output/implementation-artifacts/0-15-coming-soon-toggle-infra-middleware.md`] Placeholders Story 0.15 à écraser
- [Source: `_bmad-output/planning-artifacts/architecture.md`#ADR-012] i18n FR+EN
- [Source: `_bmad-output/planning-artifacts/architecture.md`#NFR50-54] a11y RGAA AA
- [Source: `AGENTS.md`] Hard rules

### Latest tech specifics

- **Next.js 16.2.6** : Server Components default + `'use client'` minimal.
- **next-intl 4.4.0** : 4 namespaces distincts dans même messages.json.
- **react-hook-form 7.76.0** + **zod ^3.x** : Contact form pattern Story 0.17.
- **lucide-react** : 6 icons direct.

### Sécurité

- **Sanitization** : Contact form server-side (Story 0.20 handler) — Story 0.19 fait validation client-side via Zod uniquement.
- **CSRF** : Story 0.20 handler décide. Pas applicable Story 0.19.
- **RGPD** : Privacy page accessible + lien depuis form Contact disclaimer + lien depuis Story 0.17 checkbox.

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m]

### Debug Log References

- Aucun.

### Completion Notes List

- **Validation humaine OBLIGATOIRE** Privacy + Legal avant merge prod. Ne PAS auto-merger ces 2 pages sans relecture Ismael (ou avocat numérique).
- Décision hosting Vercel/DO + anonymisation fondateur à valider Ismael dev-time.
- Story 0.19 est volumineuse (~17 fichiers, 2.5-3j) mais structure répétitive — chaque page suit même pattern.

### File List

**NEW (11 fichiers)** :
- `apps/public/src/features/public-pages/components/AboutContent.tsx`
- `apps/public/src/features/public-pages/components/PrivacyContent.tsx`
- `apps/public/src/features/public-pages/components/LegalContent.tsx`
- `apps/public/src/features/public-pages/components/ContactPageShell.tsx`
- `apps/public/src/features/public-pages/components/ContactFormClient.tsx`
- `apps/public/src/features/public-pages/components/__tests__/ContactFormClient.spec.tsx`
- `apps/public/src/features/public-pages/schemas/contact-form.schema.ts`
- `apps/public/src/features/public-pages/schemas/contact-form.schema.spec.ts`
- `apps/public/src/features/public-pages/services/classify-contact-error.ts`
- `apps/public/src/features/public-pages/hooks/use-submit-contact-form-mock.ts`
- `apps/public/e2e/public-pages.spec.ts`

**UPDATE (6 fichiers)** :
- `apps/public/src/app/[locale]/a-propos/page.tsx`
- `apps/public/src/app/[locale]/confidentialite/page.tsx`
- `apps/public/src/app/[locale]/mentions-legales/page.tsx`
- `apps/public/src/app/[locale]/contact/page.tsx`
- `apps/public/src/messages/fr.json`
- `apps/public/src/messages/en.json`

**Total** : 17 fichiers (11 NEW + 6 UPDATE)

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2026-05-20 | bmad-create-story (Opus 4.7) | Initial story creation — 4 pages institutionnelles publiques (About 5 blocks + Privacy 8 blocks + Legal 6 blocks + Contact form 7 fields + 4 cards canaux), 3 Server Components purs + 1 page mixte Server+Client form, i18n FR+EN 4 namespaces ~140 keys × 2 = 280 strings avec VALIDATION HUMAINE Privacy+Legal, EditorialPageShell + Block Story 0.16 réutilisés, Contact form RHF + zodResolver pattern Story 0.17, SEO metadata + indexabilité, Lighthouse ≥ 95 + axe-core 0, Playwright 12+ cases × 2 locales. ~17 fichiers, 2.5-3j dev. |
| 2026-05-22 | bmad-dev-story (Sonnet 4.6) | Implementation done — 17 fichiers (11 NEW + 6 UPDATE). 3 Server Components purs (About/Privacy/Legal) via EditorialPageShell + Block Story 0.16. 1 page mixte Contact (Server shell + Client form). Décisions dev-time : hébergement Option B (DigitalOcean Frankfurt), fondateur anonyme (suit design), `_NEEDS_LEGAL_REVIEW: true` dans privacy+legal FR+EN. Contact form RHF + Zod v4 + mock hook Story 0.20. i18n 4 namespaces FR+EN complets (~280 strings). SEO metadata + robots index:true × 4 pages. Skip-links + aria-labels + role="alert" a11y. 17 tests Playwright e2e (FR+EN) + 2 test.skip Lighthouse. Schema spec 13 tests. ContactFormClient spec 6 tests. Lint 0 errors · typecheck 0 errors · test 103/103 · build ✅. **⚠️ VALIDATION HUMAINE OBLIGATOIRE** Privacy + Legal avant merge prod. |
