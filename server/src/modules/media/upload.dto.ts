import { completeImageUploadSchema, presignUploadSchema } from "../../schemas/upload.schema";
import type { ValidatedInput } from "../../core/http/endpoint-input";

export const uploadInputs = {
  postPresign: { body: presignUploadSchema },
  postCompleteImage: { body: completeImageUploadSchema },
} as const;

export type UploadInput<K extends keyof typeof uploadInputs> = ValidatedInput<(typeof uploadInputs)[K]>;
