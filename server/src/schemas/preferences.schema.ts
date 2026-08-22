import { z } from "zod";

export const preferenceSchema = z.object({
  styles: z.array(z.string()).default([]),
  budget: z.string().default("mid"),
  timeline: z.string().default("2-4 weeks"),
});
