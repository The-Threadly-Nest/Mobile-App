import { z } from "zod";

export const adminOnboardingSchema = z.object({
  shopName: z.string().min(2, "Business name must be at least 2 characters").max(100),
  location: z.string().min(3, "Please enter your store address or city"),
  phone: z.string().optional(),
  bio: z.string().max(500).optional(),
  categories: z.array(z.string()).min(1, "Select at least one specialization category"),
  brandLogoUrl: z.string().url().optional().or(z.literal("")),
  currency: z.string().default("NGN"),
});

export type AdminOnboardingInput = z.infer<typeof adminOnboardingSchema>;
