import { z } from "zod";

export const createCatalogItemSchema = z.object({
  name: z.string().min(2).max(100),
  priceFrom: z.number().int().positive(), // Stored as integer cents/kobo
  imageUrl: z.string().url(),
});

export const updateCatalogItemSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  priceFrom: z.number().int().positive().optional(),
  imageUrl: z.string().url().optional(),
});
