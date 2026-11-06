import { z } from "zod";

export const preferenceSchema = z.object({
  styles: z.array(z.string().max(100)).max(50).optional(),
  budget: z.string().max(100).optional(),
  timeline: z.string().max(100).optional(),
  phone: z.string().trim().max(30).optional(),
  location: z.string().trim().max(200).optional(),
  photoKey: z.string().min(1).max(512).nullable().optional(),
  savedCatalogIds: z.array(z.string().uuid()).max(100).transform(ids => [...new Set(ids)]).optional(),
});
