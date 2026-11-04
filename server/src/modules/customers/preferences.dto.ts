import { preferenceSchema } from "../../schemas/preferences.schema";
import type { ValidatedInput } from "../../core/http/endpoint-input";

export const preferencesInputs = {
  post: { body: preferenceSchema },
  get: {},
} as const;

export type PreferencesInput<K extends keyof typeof preferencesInputs> = ValidatedInput<(typeof preferencesInputs)[K]>;
