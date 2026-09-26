import { z } from "zod";

export const sendChatMessageSchema = z.object({
  fashionHouseId: z.string().min(1),
  message: z.string().max(1000).optional(),
  garmentName: z.string().optional(),
  imageUrl: z.string().url().optional(),
  audioUrl: z.string().url().optional(),
  audioDuration: z.number().int().nonnegative().optional(),
  idempotencyKey: z.string().max(128).regex(/^[A-Za-z0-9:_-]+$/).optional(),
}).refine((data) => data.message?.trim() || data.imageUrl || data.audioUrl, {
  message: "A message, image, or voice note is required.",
});
