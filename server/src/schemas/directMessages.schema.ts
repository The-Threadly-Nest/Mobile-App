import { z } from "zod";

const messageUrlSchema = z
  .string()
  .trim()
  .url()
  .max(2048)
  .regex(/^https?:\/\//i, "Media URL must use HTTP or HTTPS");

export const directMessageThreadParamSchema = z.object({
  fashionHouseId: z.string().uuid(),
});

export const directMessageIdParamSchema = z.object({
  messageId: z.string().uuid(),
});

export const directMessageThreadQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    cursor: z.string().uuid().optional(),
    after: z.string().uuid().optional(),
    since: z.string().datetime({ offset: true }).optional(),
  })
  .refine((query) => !(query.cursor && query.after), {
    message: "cursor and after cannot be used together",
  })
  .refine((query) => !query.since || Boolean(query.after), {
    message: "since can only be used with after",
  });

export const sendDirectMessageSchema = z
  .object({
    clientMessageId: z
      .string()
      .min(1)
      .max(128)
      .regex(/^[A-Za-z0-9:_-]+$/, "clientMessageId contains unsupported characters"),
    text: z.string().trim().max(4000).optional(),
    imageUrl: messageUrlSchema.optional(),
    audioUrl: messageUrlSchema.optional(),
    audioDuration: z.coerce.number().finite().int().min(0).max(3600).optional(),
  })
  .refine((message) => Boolean(message.text || message.imageUrl || message.audioUrl), {
    message: "Message text, image, or audio is required",
  })
  .refine((message) => message.audioDuration === undefined || Boolean(message.audioUrl), {
    message: "audioDuration can only be supplied with an audio message",
    path: ["audioDuration"],
  })
  .refine((message) => !(message.imageUrl && message.audioUrl), {
    message: "A message cannot contain both an image and audio",
  });
