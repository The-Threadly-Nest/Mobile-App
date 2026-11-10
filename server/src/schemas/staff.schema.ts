import { z } from "zod";
import { passwordSchema } from "./auth.schema";

export const inviteStaffSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(254),
  password: passwordSchema.optional(),
});
