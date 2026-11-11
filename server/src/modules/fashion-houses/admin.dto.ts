import { adminOnboardingSchema, paymentDetailsSchema } from "../../schemas/admin.schema";
import type { ValidatedInput } from "../../core/http/endpoint-input";
import { z } from "zod";

export const fashionHouseAdminInputs = {
  getDashboardSummary: { query: z.object({ period: z.enum(["this_month", "last_month", "this_year", "all_time"]).default("this_month") }) },
  getSummary: {},
  getProfile: {},
  putOnboarding: { body: adminOnboardingSchema },
  patchPaymentDetails: { body: paymentDetailsSchema },
} as const;

export type FashionHouseAdminInput<K extends keyof typeof fashionHouseAdminInputs> = ValidatedInput<(typeof fashionHouseAdminInputs)[K]>;
