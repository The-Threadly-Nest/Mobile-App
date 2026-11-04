import { manualChatEscalationSchema, sendChatMessageSchema } from "../../schemas/chat.schema";
import type { ValidatedInput } from "../../core/http/endpoint-input";
import { conversationMessageSchema } from "../../schemas/endpoint-bodies.schema";
import { chatTargetParamSchema, chatMessageParamSchema } from "../../schemas/route-params.schema";

export const chatInputs = {
  postSessionByFashionHouseIdRestart: { params: chatTargetParamSchema },
  getSessionByFashionHouseId: { params: chatTargetParamSchema },
  deleteMessagesByMessageId: { params: chatMessageParamSchema, body: conversationMessageSchema },
  deleteMessagesByMessageIdMe: { params: chatMessageParamSchema, body: conversationMessageSchema },
  postMessage: { body: sendChatMessageSchema },
  postEscalate: { body: manualChatEscalationSchema },
} as const;

export type ChatInput<K extends keyof typeof chatInputs> = ValidatedInput<(typeof chatInputs)[K]>;
