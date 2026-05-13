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
  await client.connect();

  try {
    // Forward-compat: catalog data model lives in Story 3.1. If tables are
    // missing, exit cleanly so that 0.10's `docker:bootstrap` chain stays green.
    const tablesExist = await client.query<{ to_regclass: string | null }>(
      `SELECT to_regclass('public.categories') AS to_regclass`,
    );
    if (!tablesExist.rows[0]?.to_regclass) {
      console.log(
        "  ⏭️  Table 'public.categories' does not exist yet (Story 3.1 builds the schema).",
      );
      console.log(
        '     Skipping seed — re-run `pnpm seed:categories` once catalog-svc migrations are applied.',
      );
      return;
    }

    let categoriesInserted = 0;
    let subCategoriesInserted = 0;
    let serviceTypesInserted = 0;

    for (const cat of CATEGORIES) {
      const upsert = await client.query<{ id: string; inserted: boolean }>(
        `WITH ins AS (
           INSERT INTO categories (slug)
           VALUES ($1)
           ON CONFLICT (slug) DO NOTHING
           RETURNING id, true AS inserted
         )
         SELECT id, inserted FROM ins
         UNION ALL
         SELECT id, false AS inserted FROM categories WHERE slug = $1
         LIMIT 1`,
        [cat.slug],
      );
      const categoryRow = upsert.rows[0];
      if (!categoryRow) throw new Error(`Category upsert returned no row for slug=${cat.slug}`);
      const categoryId = categoryRow.id;
      if (categoryRow.inserted) {
        categoriesInserted += 1;
        console.log(`  ✅ category '${cat.slug}' created (id=${categoryId})`);
      } else {
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
        const subUpsert = await client.query<{ id: string; inserted: boolean }>(
          `WITH ins AS (
             INSERT INTO sub_categories (category_id, slug)
             VALUES ($1, $2)
             ON CONFLICT (category_id, slug) DO NOTHING
             RETURNING id, true AS inserted
           )
           SELECT id, inserted FROM ins
           UNION ALL
           SELECT id, false AS inserted FROM sub_categories WHERE category_id = $1 AND slug = $2
           LIMIT 1`,
          [categoryId, sub.slug],
        );
        const subRow = subUpsert.rows[0];
        if (!subRow) throw new Error(`Sub-category upsert returned no row for slug=${sub.slug}`);
        const subCategoryId = subRow.id;
        if (subRow.inserted) {
          subCategoriesInserted += 1;
          console.log(`    ✅ sub-category '${sub.slug}' created`);
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
    await client.end();
  }
}

main().catch((err) => {
  console.error('❌ Seed failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
