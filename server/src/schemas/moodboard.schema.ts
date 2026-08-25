import { z } from "zod";

export const createMoodBoardSketchSchema = z.object({
  title: z.string().min(1, "Title is required").max(100),
  imageUrl: z.string().url("Valid image URL is required"),
});

export const promoteSketchSchema = z.object({
  priceFrom: z.number().int().min(0).optional().default(0),
  name: z.string().min(1).max(100).optional(),
});
