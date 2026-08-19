import { z } from "zod";

export const inviteStaffSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
});
