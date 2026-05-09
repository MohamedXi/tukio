import { z } from 'zod';

const TranslationSchema = z.object({
  locale: z.enum(['fr', 'en']),
  title: z.string().min(5).max(120),
  description: z.string().min(50).max(5000),
  slug: z
    .string()
    .min(3)
    .max(80)
    .regex(/^[a-z0-9-]+$/, { message: 'Slug must be kebab-case' }),
});

const MoneySchema = z.object({
  amount: z.number().int().nonnegative(),
  currency: z.literal('EUR'),
});

export const CreateListingSchema = z.object({
  categorySlug: z.string().min(1),
  translations: z.array(TranslationSchema).min(1),
  basePrice: MoneySchema,
  photos: z.array(z.url()).min(4).max(12),
  deliveryRadius: z.number().int().min(0).max(200),
});

export type CreateListingDto = z.infer<typeof CreateListingSchema>;
