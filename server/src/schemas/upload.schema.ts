import { z } from "zod";

export const presignUploadSchema = z.object({
  filename: z.string().min(1, "Filename is required"),
  contentType: z.string().min(1, "Content type is required").regex(
    /^(image\/jpeg|image\/png|image\/gif|image\/webp|image\/svg\+xml|application\/pdf|audio\/m4a|audio\/mp4|audio\/mpeg|audio\/aac|audio\/wav|audio\/ogg|audio\/webm)$/,
    "Unsupported file type. Only images, PDFs, and audio files are allowed."
  ),
});

