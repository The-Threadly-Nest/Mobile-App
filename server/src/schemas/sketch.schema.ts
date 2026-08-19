import { z } from "zod";

export const createSketchSchema = z.object({
  title: z.string().min(1, "Title is required").max(100),
  imageUrl: z.string().url("Valid image URL is required"),
});
