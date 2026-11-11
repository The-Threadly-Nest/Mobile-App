import { createCatalogItemSchema, updateCatalogItemSchema } from "../../schemas/catalog.schema";
import { collectionPaginationSchema, discoveryQuerySchema } from "../../schemas/pagination.schema";
import { fashionHouseIdParamSchema, idParamSchema } from "../../schemas/params.schema";
import type { ValidatedInput } from "../../core/http/endpoint-input";

export const catalogInputs = {
  get: { query: collectionPaginationSchema },
  post: { body: createCatalogItemSchema },
  patchById: { params: idParamSchema, body: updateCatalogItemSchema },
  deleteById: { params: idParamSchema },
  getMarketplace: { query: discoveryQuerySchema },
  getFashionHouseByFashionHouseId: { params: fashionHouseIdParamSchema, query: discoveryQuerySchema },
  getItemById: { params: idParamSchema },
  getMeasurementSlots: { params: idParamSchema },
} as const;

export type CatalogInput<K extends keyof typeof catalogInputs> = ValidatedInput<(typeof catalogInputs)[K]>;
