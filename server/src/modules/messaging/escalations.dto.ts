import { escalationIdParamSchema, resolveEscalationSchema } from "../../schemas/escalation.schema";
import type { ValidatedInput } from "../../core/http/endpoint-input";
import { assignEscalationSchema } from "../../schemas/endpoint-bodies.schema";
import { z } from "zod";

export const escalationsInputs = {
  get: {},
  getByEscalationId: { params: escalationIdParamSchema },
  patchByEscalationIdResolve: { params: escalationIdParamSchema, body: resolveEscalationSchema },
  patchByEscalationIdDecline: { body: z.object({ comment: z.string().trim().min(3).max(500) }) },
  postAssign: { body: assignEscalationSchema },
} as const;

export type EscalationsInput<K extends keyof typeof escalationsInputs> = ValidatedInput<(typeof escalationsInputs)[K]>;
