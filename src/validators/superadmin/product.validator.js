
import { z } from "zod";

// ─── Reusable primitives ─────────────────────────────────────


export const translationSchema = z.object({
  // langId = FK vers languages.id (entier positif)
  // La validité réelle (langue active) est vérifiée dans le controller via DB
  langId:          z.number().int().positive("langId doit être un entier positif"),
  title:           z.string().min(1, "Le titre est requis"),
  slug:            z.string()
                     .min(1, "Le slug est requis")
                     .regex(/^[a-z0-9-]+$/, "Slug : minuscules, chiffres et tirets uniquement"),
  seoTitle:        z.string().optional(),
  metaDescription: z.string().optional(),
  metaImage:       z.string().optional(),
});

export const galleryItemSchema = z.object({
  url:      z.string().min(1),
  type:     z.enum(["image", "video", "youtube"]),
  poster:   z.string().optional(),
  position: z.number().int().min(0).default(0),
});

export const packageTierSchema = z.object({
  qty:   z.number().int().positive("La quantité doit être un entier positif"),
  price: z.number().min(0, "Le prix doit être positif ou nul"),
});

export const cardTypePriceSchema = z.object({
  cardTypeId: z.string().min(1),
  price:      z.number().min(0),
});

// ─── Product Schemas ─────────────────────────────────────────

export const createProductSchema = z.object({
  price:  z.number().min(0),
  active: z.boolean().default(true),
  image:  z.string().optional(),
  translations: z.array(translationSchema)
    .min(1, "Au moins une traduction est requise")
    .refine(
      (ts) => new Set(ts.map((t) => t.langId)).size === ts.length,
      { message: "Traductions dupliquées pour la même langue" }
    ),
  gallery: z.array(galleryItemSchema).max(10).default([]),
  packageTiers: z.array(packageTierSchema)
    .default([])
    .refine(
      (tiers) => new Set(tiers.map((t) => t.qty)).size === tiers.length,
      { message: "Les quantités des paliers doivent être uniques" }
    ),
  cardTypePrices: z.array(cardTypePriceSchema)
    .default([])
    .refine(
      (prices) => new Set(prices.map((p) => p.cardTypeId)).size === prices.length,
      { message: "Types de carte dupliqués dans la tarification" }
    ),
});

export const updateProductSchema = createProductSchema.partial().extend({
  // On update, at least one field must be provided
});



export const createCardTypeSchema = z.object({
  name:   z.string().min(1, "Name is required"),
  color:  z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color").default("#6b7280"),
  image:  z.string().optional(),
  active: z.boolean().default(true),
});

export const updateCardTypeSchema = createCardTypeSchema.partial();

