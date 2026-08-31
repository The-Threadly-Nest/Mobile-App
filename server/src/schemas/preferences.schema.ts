import { z } from "zod";

export const preferenceSchema = z.object({
  styles: z.array(z.string()).optional().default([]),
  budget: z.string().optional().default("mid"),
  timeline: z.string().optional().default("2-4 weeks"),
  phone: z.string().optional(),
  location: z.string().optional(),
});
