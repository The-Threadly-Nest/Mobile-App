import { z } from "zod";
import { createOrderSchema } from "./orders.schema";

const email = z.string().trim().toLowerCase().email().max(254);
const positiveMeasurement = z.union([z.number().finite().positive().max(1000), z.string().trim().max(20)
  .regex(/^\d+(?:\.\d+)?$/, "Enter a positive measurement.")
  .refine((value) => Number(value) > 0 && Number(value) <= 1000, "Measurements must be greater than zero and no more than 1000.")]);
const measurementValue = z.union([positiveMeasurement, z.literal("")]);
export const verifyAccountCodeSchema = z.object({ email, code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{4}$/, "Enter the four-character code from your email.") });
export const resendAccountCodeSchema = z.object({ email });
export const googleSignInSchema = z.object({ idToken: z.string().min(1).max(16384), role: z.enum(["admin", "customer"]).optional() });
export const pushTokenSchema = z.object({ pushToken: z.string().min(1).max(4096) });
export const conversationMessageSchema = z.object({ fashionHouseId: z.string().min(1).max(128) });
export const customerStatusSchema = z.object({ status: z.enum(["active", "inactive"]) });
export const manualOrderSchema = createOrderSchema.extend({ staffId: z.string().uuid().nullish() });
export const assignOrderSchema = z.object({ staffId: z.string().uuid().nullish() });
export const measurementCaptureSchema = z.object({
  customerId: z.string().uuid().optional(), customerName: z.string().trim().min(1).max(100).optional(),
  field: z.string().min(1).max(100).optional(), value: positiveMeasurement.optional(), unit: z.enum(["in", "cm"]).optional(),
  standard: z.record(z.string().max(100), measurementValue.nullish()).refine((values) => Object.keys(values).length <= 100, "Save no more than 100 measurements at once.").optional(),
  custom: z.array(z.object({ label: z.string().max(100), value: measurementValue })).max(100).optional(),
}).refine((body) => body.customerId || body.customerName, "Customer ID or name is required.")
  .refine((body) => body.standard || (body.field && body.value !== undefined), "Measurement field and value are required.");
export const assignEscalationSchema = z.object({
  bookingId: z.string().uuid().nullish(), staffId: z.string().uuid().nullish(),
  serviceTitle: z.string().max(200).optional(), customerName: z.string().trim().min(1).max(100).optional(),
  price: z.number().finite().min(0).optional(),
  measurements: z.object({ bust: measurementValue.optional(), waist: measurementValue.optional(), hip: measurementValue.optional(), length: measurementValue.optional() }).optional(),
});
