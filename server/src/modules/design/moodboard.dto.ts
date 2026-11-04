import { createMoodBoardSketchSchema, promoteSketchSchema } from "../../schemas/moodboard.schema";
import type { ValidatedInput } from "../../core/http/endpoint-input";

export const moodboardInputs = {
  post: { body: createMoodBoardSketchSchema },
  get: {},
  deleteById: {},
  getStaffByStaffId: {},
  postByIdPromote: { body: promoteSketchSchema },
} as const;

export type MoodboardInput<K extends keyof typeof moodboardInputs> = ValidatedInput<(typeof moodboardInputs)[K]>;
