import { catalogCheckoutSchema, updateOrderStatusSchema } from "../../schemas/orders.schema";
import { collectionPaginationSchema } from "../../schemas/pagination.schema";
import type { ValidatedInput } from "../../core/http/endpoint-input";
import { manualOrderSchema, assignOrderSchema } from "../../schemas/endpoint-bodies.schema";

export const ordersInputs = {
  getMyOrders: { query: collectionPaginationSchema },
  postCatalogCheckout: { body: catalogCheckoutSchema },
  postMyOrders: {},
  getTrackById: {},
  postTrackByIdCancel: {},
  post: { body: manualOrderSchema },
  get: { query: collectionPaginationSchema },
  getById: {},
  patchByIdAssign: { body: assignOrderSchema },
  patchByIdStatus: { body: updateOrderStatusSchema },
} as const;

export type OrdersInput<K extends keyof typeof ordersInputs> = ValidatedInput<(typeof ordersInputs)[K]>;
