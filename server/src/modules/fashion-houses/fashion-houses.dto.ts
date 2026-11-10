import { discoveryQuerySchema } from "../../schemas/pagination.schema";
import { idParamSchema } from "../../schemas/params.schema";
import type { ValidatedInput } from "../../core/http/endpoint-input";

export const fashionHousesInputs = {
  get: { query: discoveryQuerySchema },
  getById: { params: idParamSchema },
} as const;

export type FashionHousesInput<K extends keyof typeof fashionHousesInputs> = ValidatedInput<(typeof fashionHousesInputs)[K]>;
