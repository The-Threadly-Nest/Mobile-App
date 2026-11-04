import { z } from "zod";

const passwordSchema = z.string().min(8).max(72).regex(/[A-Z]/, "Must include an uppercase letter").regex(/[0-9]/, "Must include a number")
  .refine((value) => Buffer.byteLength(value, "utf8") <= 72, "Choose a password no longer than 72 bytes.");
const emailSchema = z.string().trim().toLowerCase().email().max(254);

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(["admin", "customer"]), // staff accounts are created by an Admin invite only
  name: z.string().min(2).max(80),
  businessName: z.string().min(2).max(80).optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(1024),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  email: emailSchema,
  token: z.string().length(4).transform((val) => val.toUpperCase()),
  newPassword: passwordSchema,
});

export const activateAccountSchema = z.object({
  email: emailSchema,
  token: z.string().length(4).transform((val) => val.toUpperCase()),
  password: passwordSchema,
});
