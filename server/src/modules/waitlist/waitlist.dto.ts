import { inviteWaitlistSchema, joinWaitlistSchema, updateWaitlistStatusSchema, unsubscribeWaitlistSchema, waitlistIdSchema, waitlistQuerySchema, verifyWaitlistSchema } from "../../schemas/waitlist.schema";
import type { ValidatedInput } from "../../core/http/endpoint-input";

export const waitlistInputs = {
  post: { body: joinWaitlistSchema },
  postVerify: { body: verifyWaitlistSchema },
  postUnsubscribe: { body: unsubscribeWaitlistSchema },
  getAdmin: { query: waitlistQuerySchema },
  patchAdminByIdStatus: { params: waitlistIdSchema, body: updateWaitlistStatusSchema },
  postAdminInvite: { body: inviteWaitlistSchema },
} as const;

export type WaitlistInput<K extends keyof typeof waitlistInputs> = ValidatedInput<(typeof waitlistInputs)[K]>;
