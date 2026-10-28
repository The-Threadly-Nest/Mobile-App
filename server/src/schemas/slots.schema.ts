import { z } from "zod";

export const createAvailableSlotSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Time must be in HH:MM format"),
  durationMinutes: z.number().int().min(15).max(480).optional(),
});

export const updateAvailableSlotSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format").optional(),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Time must be in HH:MM format").optional(),
  durationMinutes: z.number().int().min(15).max(480).optional(),
  active: z.boolean().optional(),
  booked: z.boolean().optional(),
});
