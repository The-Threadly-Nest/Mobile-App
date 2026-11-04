import { inviteStaffSchema } from "../../schemas/staff.schema";
import type { ValidatedInput } from "../../core/http/endpoint-input";

export const staffInputs = {
  getMe: {},
  postInvite: { body: inviteStaffSchema },
  get: {},
  postByStaffIdResendActivation: {},
} as const;

export type StaffInput<K extends keyof typeof staffInputs> = ValidatedInput<(typeof staffInputs)[K]>;
