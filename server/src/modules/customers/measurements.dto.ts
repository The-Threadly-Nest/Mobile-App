
import type { ValidatedInput } from "../../core/http/endpoint-input";
import { measurementCaptureSchema } from "../../schemas/endpoint-bodies.schema";

export const measurementsInputs = {
  getMyMeasurements: {},
  getCheckByCustomerName: {},
  post: { body: measurementCaptureSchema },
  getCustomerByCustomerId: {},
  postParseVoice: {},
} as const;

export type MeasurementsInput<K extends keyof typeof measurementsInputs> = ValidatedInput<(typeof measurementsInputs)[K]>;
