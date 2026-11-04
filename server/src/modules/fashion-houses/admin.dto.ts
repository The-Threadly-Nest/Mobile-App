import { adminOnboardingSchema, paymentDetailsSchema } from "../../schemas/admin.schema";
import type { ValidatedInput } from "../../core/http/endpoint-input";

export const fashionHouseAdminInputs = {
  getDashboardSummary: {},
  getSummary: {},
  getProfile: {},
  putOnboarding: { body: adminOnboardingSchema },
  patchPaymentDetails: { body: paymentDetailsSchema },
} as const;

export type FashionHouseAdminInput<K extends keyof typeof fashionHouseAdminInputs> = ValidatedInput<(typeof fashionHouseAdminInputs)[K]>;
