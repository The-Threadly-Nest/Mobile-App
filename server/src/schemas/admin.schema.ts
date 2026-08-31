import { z } from "zod";

export const adminOnboardingSchema = z.object({
  shopName: z.string().min(2, "Business name must be at least 2 characters").max(100),
  location: z.string().min(3, "Please enter your store address or city"),
  phone: z
    .string()
    .refine(
      (val) => !val || /^\+[1-9][0-9\s]{6,16}$/.test(val.trim()),
      "Please select a country code and enter a valid business phone number"
    )
    .optional(),
  bio: z.string().max(500).optional(),
  categories: z.array(z.string()).min(1, "Select at least one specialization category"),
  brandLogoUrl: z.string().url().optional().or(z.literal("")),
  currency: z.string().default("NGN"),
});

export type AdminOnboardingInput = z.infer<typeof adminOnboardingSchema>;
