import { z } from "zod";

const onboardingSlotSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be in HH:MM format"),
});

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
  timezone: z.string().trim().min(1).max(100).default("Africa/Lagos"),
  slotDurationMinutes: z.number().int().min(15).max(480).default(60),
  bankName: z.string().trim().min(2).max(100).optional(),
  accountNumber: z.string().trim().regex(/^\d{10}$/, "Account number must be 10 digits").optional(),
  accountName: z.string().trim().min(2).max(100).optional(),
  availableSlots: z
    .array(onboardingSlotSchema)
    .min(1, "Add at least one fitting slot")
    .max(100, "You can add up to 100 fitting slots"),
});

export const paymentDetailsSchema = z.object({
  bankName: z.string().trim().min(2, "Enter the bank name").max(100),
  accountNumber: z.string().trim().regex(/^\d{10}$/, "Account number must be 10 digits"),
  accountName: z.string().trim().min(2, "Enter the account name").max(100),
});

export type AdminOnboardingInput = z.infer<typeof adminOnboardingSchema>;
