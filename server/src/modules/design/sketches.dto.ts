import { createSketchSchema } from "../../schemas/sketch.schema";
import type { ValidatedInput } from "../../core/http/endpoint-input";

export const sketchesInputs = {
  get: {},
  post: { body: createSketchSchema },
} as const;

export type SketchesInput<K extends keyof typeof sketchesInputs> = ValidatedInput<(typeof sketchesInputs)[K]>;
