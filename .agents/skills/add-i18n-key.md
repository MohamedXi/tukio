# Skill: add an i18n key

Use this when introducing new user-facing text in a frontend. Every
string a user sees must go through `next-intl`. Keys are added to
**both** `messages/fr.json` and `messages/en.json` of the consuming app.

## Prerequisites

- The app you're working in is wired with `next-intl` (Story 7.1 sets
  up the infrastructure across all 4 frontends).
- Read `.agents/context/i18n.md` in full.
- Know which app you're editing — keys are scoped per app, not shared.

## Key naming

- **Top-level groups**: `kebab-case`, named after feature / screen.
- **Sub-keys**: `camelCase`.
- **Depth**: max 4 levels. Beyond that, refactor into a sub-group.
- **Reusable across multiple screens?** Extract to a `shared` group at
  the top level of the messages file.

```json
{
  "booking": {
    "confirmation": {
      "title": "Votre réservation est confirmée",
      "subtitle": "Le pro vous contactera sous 24 h"
    },
    "cta": {
      "bookNow": "Réserver maintenant",
      "viewCart": "Voir le panier"
    }
  },
  "shared": {
    "actions": {
      "cancel": "Annuler",
      "save": "Enregistrer"
    }
  }
}
```

## Step-by-step

1. **Identify the messages file.** It lives at
   `apps/<app>/messages/{fr,en}.json`.

2. **Find or create the group.** Use an existing group when the string
   logically belongs there (`booking.cta.bookNow`); only create a new
   group when starting a new screen / feature.

3. **Add the FR key first**, then add the EN key with the same path:

   ```diff
   // apps/customer/messages/fr.json
   {
     "booking": {
       "confirmation": {
         "title": "Votre réservation est confirmée",
         "subtitle": "Le pro vous contactera sous 24 h",
   +     "callPro": "Appeler le pro"
       }
     }
   }
   ```

   ```diff
   // apps/customer/messages/en.json
   {
     "booking": {
       "confirmation": {
         "title": "Your booking is confirmed",
         "subtitle": "The pro will reach out within 24h",
   +     "callPro": "Call the pro"
       }
     }
   }
   ```

   **Both files MUST have the same keys.** Story 7.7 will add CI lint.
   Until then, the rule is on you.

4. **Use the key in the component.**

   **Server Component**:

   ```tsx
   import { getTranslations } from 'next-intl/server';

   export default async function Page({ params }: { params: Promise<{ locale: 'fr' | 'en' }> }) {
     const { locale } = await params;
     const t = await getTranslations({ locale, namespace: 'booking.confirmation' });
     return <button>{t('callPro')}</button>;
   }
   ```

   **Client Component**:

   ```tsx
   'use client';
   import { useTranslations } from 'next-intl';

   export function CallProButton() {
     const t = useTranslations('booking.confirmation');
     return <button>{t('callPro')}</button>;
   }
   ```

5. **For interpolation**:

   ```json
   {
     "booking": {
       "welcomeBack": "Bonjour {name}, vous avez {count} réservations en cours"
     }
   }
   ```

   ```tsx
   t('welcomeBack', { name: 'Ismael', count: 3 });
   ```

6. **For plurals** (ICU MessageFormat):

   ```json
   {
     "booking": {
       "messageCount": "{count, plural, =0 {Aucun message} one {# message} other {# messages}}"
     }
   }
   ```

   ```tsx
   t('messageCount', { count: 0 }); // → "Aucun message"
   t('messageCount', { count: 1 }); // → "1 message"
   t('messageCount', { count: 5 }); // → "5 messages"
   ```

7. **For dates / numbers**, use `useFormatter()` / `getFormatter()`,
   never `Intl.DateTimeFormat` directly:

   ```tsx
   import { useFormatter } from 'next-intl';
   const format = useFormatter();
   format.dateTime(date, { dateStyle: 'medium' }); // FR: "5 mai 2026"  EN: "May 5, 2026"
   format.number(price, { style: 'currency', currency: 'EUR' });
   ```

8. **For locale-specific assets / links** (e.g. legal pages exist in
   both locales but with different slugs), use
   `useLocale()` + a lookup table colocated in the component, or push
   to `messages.json` keys storing the URL paths.

9. **Test**:

   ```tsx
   import { NextIntlClientProvider } from 'next-intl';
   import messages from '../messages/fr.json';

   function renderWithIntl(ui) {
     return render(
       <NextIntlClientProvider locale="fr" messages={messages}>
         {ui}
       </NextIntlClientProvider>,
     );
   }

   it('renders the welcome message', () => {
     renderWithIntl(<CallProButton />);
     expect(screen.getByRole('button', { name: 'Appeler le pro' })).toBeInTheDocument();
   });
   ```

10. **Run `/check`** — typecheck + lint + test.

11. **Verify in both locales**:

    ```bash
    pnpm --filter=<app> dev
    # → http://localhost:<port>/fr/<route>  → FR text
    # → http://localhost:<port>/en/<route>  → EN text
    ```

12. **Commit + PR.** `feat(<app>): add booking.confirmation.callPro key — Story <X.Y>`.

## Adding a new top-level group

When starting a new feature / screen, add the group to both `fr.json`
and `en.json` at the same depth:

```json
{
  "existing-group": { ... },
+ "new-feature": {
+   "title": "...",
+   "subtitle": "..."
+ }
}
```

Document the group's scope inline if non-obvious (use a key like
`_comment` if you must — `next-intl` ignores keys starting with `_`).

## Translating from FR to EN (or vice versa)

If you're adding a key in FR and aren't comfortable with the EN
translation:

1. Add the FR string.
2. Add a **draft EN** translation (mark it with `[TODO]` prefix or a
   `_todo` sibling key).
3. Surface in the PR description: "EN translation needs review".
4. Don't ship with a missing EN key — the missing-key fallback is
   `next-intl` showing the FR string in EN context, which is worse
   than a translated-but-imperfect string.

## Anti-patterns to refuse

- **Hardcoded `<p>Texte</p>`** in a component. Always `t('key')`.
- **`if (locale === 'fr') return 'Texte'`** in components. Use
  translation files.
- **Storing translations in a JS / TS object** instead of `messages.json`.
- **Dynamic key composition**: `t(\`label.${variant}\`)`. `next-intl`static analysis can't track it. Use ICU`select` instead.
- **String concatenation** for interpolation: `t('hello') + ' ' + name`.
  Use `t('hello', { name })`.
- **Missing the matching key in the other locale.** CI will catch
  later, but ship clean.
- **Pluralisation via JS**: `count === 1 ? 'message' : 'messages'`. Use
  ICU `plural`.
- **Translating identifiers, paths, or events.** The tech layer is
  English-only — see `.agents/context/code-style.md`.
