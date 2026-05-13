/**
 * Tukio — seed pilot MVP categories (Story 0.10)
 *
 * Seeds the two pilot MVP categories used by the Pays de la Loire launch:
 *   1. tents-marquees      (FR: tentes-chapiteaux)
 *   2. event-furniture     (FR: mobilier-evenementiel)
 *
 * Each category has a curated set of sub-categories + a per-sub-category
 * `service_types` array (delivery, setup, dismantling, lighting…).
 *
 * The catalog data model itself is owned by Story 3.1. This script is
 * forward-prepared: if the required tables (`categories`, `sub_categories`,
 * `category_translations`) do not exist yet, the script exits cleanly with
 * a friendly message so it can be called from `pnpm docker:bootstrap` today
 * without breaking the chain.
 *
 * Idempotent: every INSERT is wrapped in a NOT EXISTS guard, so re-running
 * the script is a no-op once the seed is in place.
 *
 * Usage:
 *   pnpm seed:categories
 */

import { Client } from 'pg';

type Locale = 'fr' | 'en';

interface SubCategorySeed {
  slug: string; // canonical EN slug
  translations: Record<Locale, { name: string; slug: string; description: string }>;
  serviceTypes: readonly string[];
}

interface CategorySeed {
  slug: string;
  translations: Record<Locale, { name: string; slug: string; description: string }>;
  subCategories: readonly SubCategorySeed[];
}

const CATEGORIES: readonly CategorySeed[] = [
  {
    slug: 'tents-marquees',
    translations: {
      fr: {
        slug: 'tentes-chapiteaux',
        name: 'Tentes & chapiteaux',
        description:
          'Tentes et chapiteaux événementiels — mariage, garden-party, salons et événements pro.',
      },
      en: {
        slug: 'tents-marquees',
        name: 'Tents & marquees',
        description:
          'Event tents and marquees — weddings, garden parties, trade shows and pro events.',
      },
    },
    subCategories: [
      {
        slug: 'wedding-marquees',
        translations: {
          fr: {
            slug: 'chapiteaux-mariage',
            name: 'Chapiteaux mariage',
            description: 'Chapiteaux dédiés aux cérémonies de mariage.',
          },
          en: {
            slug: 'wedding-marquees',
            name: 'Wedding marquees',
            description: 'Marquees dedicated to wedding ceremonies.',
          },
        },
        serviceTypes: ['delivery', 'setup', 'dismantling', 'lighting'],
      },
      {
        slug: 'professional-marquees',
        translations: {
          fr: {
            slug: 'chapiteaux-professionnels',
            name: 'Chapiteaux professionnels',
            description: 'Chapiteaux pour événements et salons pro.',
          },
          en: {
            slug: 'professional-marquees',
            name: 'Professional marquees',
            description: 'Marquees for trade shows and pro events.',
          },
        },
        serviceTypes: ['delivery', 'setup', 'dismantling', 'lighting'],
      },
      {
        slug: 'garden-tents',
        translations: {
          fr: {
            slug: 'tentes-jardin',
            name: 'Tentes de jardin',
            description: 'Tentes de jardin pour réceptions familiales.',
          },
          en: {
            slug: 'garden-tents',
            name: 'Garden tents',
            description: 'Garden tents for family gatherings.',
          },
        },
        serviceTypes: ['delivery', 'setup', 'dismantling'],
      },
      {
        slug: 'pop-up-tents',
        translations: {
          fr: {
            slug: 'tentes-pop-up',
            name: 'Tentes pop-up',
            description: 'Tentes pop-up légères et rapides à monter.',
          },
          en: {
            slug: 'pop-up-tents',
            name: 'Pop-up tents',
            description: 'Light and quick-to-pitch pop-up tents.',
          },
        },
        serviceTypes: ['delivery', 'setup'],
      },
    ],
  },
  {
    slug: 'event-furniture',
    translations: {
      fr: {
        slug: 'mobilier-evenementiel',
        name: 'Mobilier événementiel',
        description:
          'Mobilier de réception — tables, chaises, linge, bars, pistes de danse pour tous types d’événements.',
      },
      en: {
        slug: 'event-furniture',
        name: 'Event furniture',
        description:
          'Reception furniture — tables, chairs, linens, bars, dance floors for every event type.',
      },
    },
    subCategories: [
      {
        slug: 'chairs',
        translations: {
          fr: {
            slug: 'chaises',
            name: 'Chaises',
            description: 'Chaises de réception (Tiffany, Napoléon, etc.).',
          },
          en: {
            slug: 'chairs',
            name: 'Chairs',
            description: 'Reception chairs (Tiffany, Napoleon, etc.).',
          },
        },
        serviceTypes: ['delivery', 'setup', 'cleaning'],
      },
      {
        slug: 'tables',
        translations: {
          fr: {
            slug: 'tables',
            name: 'Tables',
            description: 'Tables rondes, rectangulaires, mange-debout.',
          },
          en: {
            slug: 'tables',
            name: 'Tables',
            description: 'Round, rectangular, and standing tables.',
          },
        },
        serviceTypes: ['delivery', 'setup', 'cleaning'],
      },
      {
        slug: 'linens',
        translations: {
          fr: {
            slug: 'linge-de-table',
            name: 'Linge de table',
            description: 'Nappes, serviettes, housses de chaise.',
          },
          en: {
            slug: 'linens',
            name: 'Linens',
            description: 'Tablecloths, napkins, chair covers.',
          },
        },
        serviceTypes: ['delivery', 'cleaning'],
      },
      {
        slug: 'bars',
        translations: {
          fr: {
            slug: 'bars',
            name: 'Bars & comptoirs',
            description: 'Bars mobiles et comptoirs de réception.',
          },
          en: {
            slug: 'bars',
            name: 'Bars & counters',
            description: 'Mobile bars and reception counters.',
          },
        },
        serviceTypes: ['delivery', 'setup', 'cleaning'],
      },
      {
        slug: 'dance-floors',
        translations: {
          fr: {
            slug: 'pistes-de-danse',
            name: 'Pistes de danse',
            description: 'Pistes de danse modulables, LED ou bois.',
          },
          en: {
            slug: 'dance-floors',
            name: 'Dance floors',
            description: 'Modular dance floors (LED, wood).',
          },
        },
        serviceTypes: ['delivery', 'setup', 'dismantling'],
      },
    ],
  },
] as const;

async function ensureSchemaReady(client: Client): Promise<boolean> {
  // M12 — probe ALL required tables, not just `categories`. Otherwise we can
  // crash mid-seed leaving partial data.
  const requiredTables = [
    'categories',
    'category_translations',
    'sub_categories',
    'sub_category_translations',
  ];
  for (const table of requiredTables) {
    const res = await client.query<{ to_regclass: string | null }>(
      `SELECT to_regclass($1) AS to_regclass`,
      [`public.${table}`],
    );
    if (!res.rows[0]?.to_regclass) {
      console.log(
        `  ⏭️  Table 'public.${table}' does not exist yet (Story 3.1 builds the schema).`,
      );
      console.log(
        '     Skipping seed — re-run `pnpm seed:categories` once catalog-svc migrations are applied.',
      );
      return false;
    }
  }
  // EH-14 — also probe the `service_types` column so we don't UPDATE-crash later.
  const colRes = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'sub_categories' AND column_name = 'service_types'
     ) AS exists`,
  );
  if (!colRes.rows[0]?.exists) {
    console.log(
      "  ⏭️  Column 'public.sub_categories.service_types' does not exist yet (Story 3.1 will add it).",
    );
    console.log('     Skipping seed.');
    return false;
  }
  return true;
}

async function main(): Promise<void> {
  const client = new Client({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? '5432'),
    user: process.env.DB_USER ?? 'tukio',
    password: process.env.DB_PASSWORD ?? 'tukio_dev_password',
    database: process.env.DB_NAME ?? 'tukio_catalog',
  });

  console.log(
    `🌱 Seeding catalog categories into ${client.database}@${client.host}:${client.port}…`,
  );

  // M13 — wrap connect+work in try/finally so client.end() always runs,
  // even if connect() itself throws. Also install a SIGINT handler so a
  // Ctrl-C during seeding doesn't leak idle-in-transaction connections.
  let connected = false;
  const onSignal = (signal: NodeJS.Signals) => {
    console.error(`\n⚠️  Received ${signal} — closing PG client and exiting.`);
    if (connected) {
      void client.end().finally(() => process.exit(130));
    } else {
      process.exit(130);
    }
  };
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);

  try {
    await client.connect();
    connected = true;

    if (!(await ensureSchemaReady(client))) return;

    let categoriesInserted = 0;
    let subCategoriesInserted = 0;
    let serviceTypesInserted = 0;

    for (const cat of CATEGORIES) {
      // M14 — refactored upsert without UNION ALL race: try INSERT-RETURNING
      // first; on conflict, SELECT the existing row. Two queries, both
      // unambiguous about the "newly inserted" signal.
      const insertRes = await client.query<{ id: string }>(
        `INSERT INTO categories (slug) VALUES ($1)
         ON CONFLICT (slug) DO NOTHING
         RETURNING id`,
        [cat.slug],
      );
      let categoryId: string;
      if (insertRes.rows[0]) {
        categoryId = insertRes.rows[0].id;
        categoriesInserted += 1;
        console.log(`  ✅ category '${cat.slug}' created (id=${categoryId})`);
      } else {
        const selectRes = await client.query<{ id: string }>(
          `SELECT id FROM categories WHERE slug = $1`,
          [cat.slug],
        );
        const row = selectRes.rows[0];
        if (!row) throw new Error(`Category select returned no row for slug=${cat.slug}`);
        categoryId = row.id;
        console.log(`  ⏭️  category '${cat.slug}' already present`);
      }

      // Translations
      for (const locale of ['fr', 'en'] as const) {
        const t = cat.translations[locale];
        await client.query(
          `INSERT INTO category_translations (category_id, locale, slug, name, description)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (category_id, locale) DO UPDATE
               SET slug = EXCLUDED.slug, name = EXCLUDED.name, description = EXCLUDED.description`,
          [categoryId, locale, t.slug, t.name, t.description],
        );
      }

      // Sub-categories
      for (const sub of cat.subCategories) {
        const subInsertRes = await client.query<{ id: string }>(
          `INSERT INTO sub_categories (category_id, slug) VALUES ($1, $2)
           ON CONFLICT (category_id, slug) DO NOTHING
           RETURNING id`,
          [categoryId, sub.slug],
        );
        let subCategoryId: string;
        if (subInsertRes.rows[0]) {
          subCategoryId = subInsertRes.rows[0].id;
          subCategoriesInserted += 1;
          console.log(`    ✅ sub-category '${sub.slug}' created`);
        } else {
          const subSelectRes = await client.query<{ id: string }>(
            `SELECT id FROM sub_categories WHERE category_id = $1 AND slug = $2`,
            [categoryId, sub.slug],
          );
          const row = subSelectRes.rows[0];
          if (!row) throw new Error(`Sub-category select returned no row for slug=${sub.slug}`);
          subCategoryId = row.id;
        }

        for (const locale of ['fr', 'en'] as const) {
          const t = sub.translations[locale];
          await client.query(
            `INSERT INTO sub_category_translations (sub_category_id, locale, slug, name, description)
               VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (sub_category_id, locale) DO UPDATE
                 SET slug = EXCLUDED.slug, name = EXCLUDED.name, description = EXCLUDED.description`,
            [subCategoryId, locale, t.slug, t.name, t.description],
          );
        }

        // Service types (stored as a `service_types text[]` column on sub_categories)
        await client.query(`UPDATE sub_categories SET service_types = $1::text[] WHERE id = $2`, [
          sub.serviceTypes,
          subCategoryId,
        ]);
        serviceTypesInserted += sub.serviceTypes.length;
      }
    }

    console.log('');
    console.log('✅ Seed complete');
    console.log(`   • categories       : ${CATEGORIES.length} (new: ${categoriesInserted})`);
    console.log(
      `   • sub-categories   : ${CATEGORIES.reduce((n, c) => n + c.subCategories.length, 0)} (new: ${subCategoriesInserted})`,
    );
    console.log(`   • service-type tags: ${serviceTypesInserted}`);
  } finally {
    process.off('SIGINT', onSignal);
    process.off('SIGTERM', onSignal);
    if (connected) {
      await client.end();
    }
  }
}

main().catch((err) => {
  console.error('❌ Seed failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
