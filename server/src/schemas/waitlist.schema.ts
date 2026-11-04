import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).optional().transform((value) => value || undefined);

export const joinWaitlistSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
  audience: z.enum(["customer", "fashion_house"]),
  businessName: optionalText(120),
  teamSize: z.enum(["Just me", "2-5 people", "6-10 people", "11+ people"]).optional(),
  phone: optionalText(30),
  city: z.string().trim().max(100, "Keep your city name to 100 characters or fewer.")
    .refine((value) => !value || (
      value.length >= 2 && /\p{L}/u.test(value)
      && /^[\p{L}\p{N}][\p{L}\p{M}\p{N} .,'’()\-]*$/u.test(value)
      && value.toLowerCase() !== "other"
    ), "Please enter a valid city name.")
    .optional().transform((value) => value || undefined),
  instagram: optionalText(100),
  interests: optionalText(500),
  source: optionalText(100),
  referredBy: optionalText(24),
  consent: z.literal(true, { error: "Consent is required." }),
  website: z.string().max(200).optional(),
}).superRefine((value, context) => {
  if (value.audience === "fashion_house" && !value.businessName) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["businessName"], message: "Enter your fashion house name." });
  }
});

export const waitlistQuerySchema = z.object({
  audience: z.enum(["all", "customer", "fashion_house"]).default("all"),
  status: z.enum(["all", "waiting", "invited", "joined", "unsubscribed"]).default("all"),
  search: z.string().trim().max(100).default(""),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const waitlistIdSchema = z.object({ id: z.string().uuid() });

export const updateWaitlistStatusSchema = z.object({
  status: z.enum(["waiting", "invited", "joined", "unsubscribed"]),
});

export const inviteWaitlistSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
});

export const unsubscribeWaitlistSchema = z.object({
  token: z.string().min(20).max(2000),
});
