import { z } from "zod";

export const presignUploadSchema = z.object({
  filename: z.string().trim().min(1, "Filename is required").max(180, "Filename is too long"),
  contentType: z.string().min(1, "Content type is required").regex(
    /^(image\/jpeg|image\/png|image\/gif|image\/webp|application\/pdf|audio\/m4a|audio\/mp4|audio\/mpeg|audio\/aac|audio\/wav|audio\/ogg|audio\/webm)$/,
    "Unsupported file type. Only images, PDFs, and audio files are allowed."
  ),
  fileSize: z.number().int().positive().max(20 * 1024 * 1024, "Files cannot exceed 20 MB"),
}).superRefine(({ filename, contentType, fileSize }, ctx) => {
  const extension = filename.toLowerCase().split(".").pop();
  const allowedExtensions: Record<string, string[]> = {
    "image/jpeg": ["jpg", "jpeg"],
    "image/png": ["png"],
    "image/gif": ["gif"],
    "image/webp": ["webp"],
    "application/pdf": ["pdf"],
    "audio/m4a": ["m4a"],
    "audio/mp4": ["m4a", "mp4"],
    "audio/mpeg": ["mp3", "mpeg"],
    "audio/aac": ["aac"],
    "audio/wav": ["wav"],
    "audio/ogg": ["ogg", "oga"],
    "audio/webm": ["webm"],
  };

  if (!extension || !allowedExtensions[contentType]?.includes(extension)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["filename"], message: "Filename extension does not match the file type" });
  }

  if (contentType.startsWith("image/") && fileSize > 10 * 1024 * 1024) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["fileSize"], message: "Images cannot exceed 10 MB" });
  }
});

export const completeImageUploadSchema = z.object({
  key: z.string().min(1).max(500).regex(
    /^pending\/(houses|customers)\/[0-9a-f-]{36}\/[a-zA-Z0-9._\/-]+$/,
    "Invalid pending image key",
  ),
});
