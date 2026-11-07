import { createAvailableSlotSchema, updateAvailableSlotSchema, saveBookingScheduleSchema } from "../../schemas/slots.schema";
import type { ValidatedInput } from "../../core/http/endpoint-input";

export const slotsInputs = {
  get: {},
  post: { body: createAvailableSlotSchema },
  getSchedule: {},
  putSchedule: { body: saveBookingScheduleSchema },
  patchById: { body: updateAvailableSlotSchema },
  deleteById: {},
} as const;

export type SlotsInput<K extends keyof typeof slotsInputs> = ValidatedInput<(typeof slotsInputs)[K]>;
