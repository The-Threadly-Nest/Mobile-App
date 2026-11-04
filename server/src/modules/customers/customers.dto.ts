import { collectionPaginationSchema } from "../../schemas/pagination.schema";
import type { ValidatedInput } from "../../core/http/endpoint-input";
import { customerStatusSchema } from "../../schemas/endpoint-bodies.schema";

export const customersInputs = {
  get: { query: collectionPaginationSchema },
  patchByIdStatus: { body: customerStatusSchema },
} as const;

export type CustomersInput<K extends keyof typeof customersInputs> = ValidatedInput<(typeof customersInputs)[K]>;
