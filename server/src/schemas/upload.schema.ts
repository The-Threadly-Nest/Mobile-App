import { z } from "zod";

export const presignUploadSchema = z.object({
  filename: z.string().min(1, "Filename is required"),
  contentType: z.string().min(1, "Content type is required").regex(
    /^(image\/jpeg|image\/png|image\/gif|image\/webp|image\/svg\+xml|application\/pdf)$/,
    "Unsupported file type. Only JPEG, PNG, GIF, WEBP, SVG, and PDF files are allowed."
  ),
});
