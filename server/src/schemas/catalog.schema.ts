import { z } from "zod";

export const createCatalogItemSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(1000).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  sizes: z.array(z.string().trim().min(1).max(50)).max(30).optional(),
  colors: z.array(z.string().trim().min(1).max(50)).max(30).optional(),
  fulfillmentType: z.enum(["ready_to_wear", "custom_fit"]).default("custom_fit"),
  priceFrom: z.number().int().positive().max(2147483647).optional().nullable(),
  imageUrl: z.string().url(),
});

export const updateCatalogItemSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(1000).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  sizes: z.array(z.string().trim().min(1).max(50)).max(30).optional(),
  colors: z.array(z.string().trim().min(1).max(50)).max(30).optional(),
  fulfillmentType: z.enum(["ready_to_wear", "custom_fit"]).optional(),
  priceFrom: z.number().int().positive().max(2147483647).optional().nullable(),
  imageUrl: z.string().url().optional(),
});

