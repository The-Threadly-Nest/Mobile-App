import { z } from "zod";

export const createMeasurementSchema = z.object({
  customerId: z.string().uuid(),
  field: z.string().min(1).max(50),
  value: z.number().positive(),
  unit: z.string().min(1).max(10).default("in"),
});
