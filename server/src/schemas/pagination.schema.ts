import { z } from "zod";

export const collectionPaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type CollectionPagination = z.infer<typeof collectionPaginationSchema>;
export const discoveryQuerySchema = collectionPaginationSchema.extend({
  q: z.string().trim().max(100).optional(),
  fulfillmentType: z.enum(["ready_to_wear", "custom_fit"]).optional(),
  sort: z.enum(["newest", "price_asc", "price_desc"]).default("newest"),
});
