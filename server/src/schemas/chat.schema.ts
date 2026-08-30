import { z } from "zod";

export const sendChatMessageSchema = z.object({
  fashionHouseId: z.string().uuid(),
  message: z.string().min(1).max(1000),
});
