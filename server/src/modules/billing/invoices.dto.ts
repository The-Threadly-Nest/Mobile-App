
import type { ValidatedInput } from "../../core/http/endpoint-input";
import { z } from "zod";
const generateInvoiceSchema = z.object({ orderId: z.string().uuid() });

export const invoicesInputs = {
  post: { body: generateInvoiceSchema },
  getOrderByOrderId: {},
} as const;

export type InvoicesInput<K extends keyof typeof invoicesInputs> = ValidatedInput<(typeof invoicesInputs)[K]>;
