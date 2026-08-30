import { z } from "zod";

const passwordSchema = z.string().min(8).regex(/[A-Z]/, "Must include an uppercase letter").regex(/[0-9]/, "Must include a number");

export const signupSchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
  role: z.enum(["admin", "customer"]), // staff accounts are created by an Admin invite only
  name: z.string().min(2).max(80),
  businessName: z.string().min(2).max(80).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const forgotPasswordSchema = z.object({ email: z.string().email() });

export const resetPasswordSchema = z.object({
  email: z.string().email(),
  token: z.string().length(4).transform((val) => val.toUpperCase()),
  newPassword: passwordSchema,
});

export const activateAccountSchema = z.object({
  email: z.string().email(),
  token: z.string().length(4).transform((val) => val.toUpperCase()),
  password: passwordSchema,
});
