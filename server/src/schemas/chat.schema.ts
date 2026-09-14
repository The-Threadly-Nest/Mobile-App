import { z } from "zod";

export const sendChatMessageSchema = z.object({
  fashionHouseId: z.string().min(1),
  message: z.string().max(1000).optional(),
  garmentName: z.string().optional(),
  audioUrl: z.string().url().optional(),
  audioDuration: z.number().int().nonnegative().optional(),
}).refine((data) => data.message?.trim() || data.audioUrl, {
  message: "Either message or audioUrl is required.",
});
