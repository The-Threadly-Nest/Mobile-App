import { inviteWaitlistSchema, joinWaitlistSchema, updateWaitlistStatusSchema, unsubscribeWaitlistSchema, waitlistIdSchema, waitlistQuerySchema } from "../../schemas/waitlist.schema";
import type { ValidatedInput } from "../../core/http/endpoint-input";

export const waitlistInputs = {
  post: { body: joinWaitlistSchema },
  postUnsubscribe: { body: unsubscribeWaitlistSchema },
  getAdmin: { query: waitlistQuerySchema },
  patchAdminByIdStatus: { params: waitlistIdSchema, body: updateWaitlistStatusSchema },
  postAdminInvite: { body: inviteWaitlistSchema },
} as const;

export type WaitlistInput<K extends keyof typeof waitlistInputs> = ValidatedInput<(typeof waitlistInputs)[K]>;
