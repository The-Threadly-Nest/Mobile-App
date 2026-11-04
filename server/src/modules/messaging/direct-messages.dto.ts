import { directMessageIdParamSchema, directMessageThreadParamSchema, directMessageThreadQuerySchema, sendDirectMessageSchema } from "../../schemas/directMessages.schema";
import type { ValidatedInput } from "../../core/http/endpoint-input";

export const directMessagesInputs = {
  getThreadByFashionHouseId: { params: directMessageThreadParamSchema, query: directMessageThreadQuerySchema },
  deleteThreadByFashionHouseId: { params: directMessageThreadParamSchema },
  deleteMessagesByMessageId: { params: directMessageIdParamSchema },
  deleteMessagesByMessageIdMe: { params: directMessageIdParamSchema },
  postThreadByFashionHouseId: { params: directMessageThreadParamSchema, body: sendDirectMessageSchema },
  patchThreadByFashionHouseIdRead: { params: directMessageThreadParamSchema },
  getMyThreads: {},
  getThreads: {},
} as const;

export type DirectMessagesInput<K extends keyof typeof directMessagesInputs> = ValidatedInput<(typeof directMessagesInputs)[K]>;
