import { z } from "zod";

export const chatTurnSchema = z.object({
  role: z.enum(["user", "model"]),
  text: z.string().min(1).max(1000),
});

export const sendChatMessageSchema = z.object({
  fashionHouseId: z.string().uuid(),
  message: z.string().min(1).max(1000),
  history: z.array(chatTurnSchema).max(30).default([]),
});
