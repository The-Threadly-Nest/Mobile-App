import { z } from "zod";

export const createCatalogItemSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(1000).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  sizes: z.array(z.string()).optional(),
  colors: z.array(z.string()).optional(),
  priceFrom: z.number().int().positive().optional().nullable(),
  imageUrl: z.string().url(),
});

export const updateCatalogItemSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(1000).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  sizes: z.array(z.string()).optional(),
  colors: z.array(z.string()).optional(),
  priceFrom: z.number().int().positive().optional().nullable(),
  imageUrl: z.string().url().optional(),
});

